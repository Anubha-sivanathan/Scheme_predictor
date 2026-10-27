package com.schemepredictor;

import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.DocumentVersion;
import com.schemepredictor.model.ShareLink;
import com.schemepredictor.repository.DocumentRepository;
import com.schemepredictor.repository.ShareAccessEventRepository;
import com.schemepredictor.repository.ShareLinkRepository;
import com.schemepredictor.service.FileValidationService;
import com.schemepredictor.service.ShareService;
import com.schemepredictor.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WalletServiceTest {

    @TempDir
    Path uploads;

    private final Map<String, DocumentRecord> store = new HashMap<>();
    private ShareLinkRepository shareLinks;
    private ShareAccessEventRepository shareEvents;
    private WalletService service;

    private static MockMultipartFile pdf(String name, String body) {
        return new MockMultipartFile("file", name, "application/pdf", ("%PDF-1.4 " + body).getBytes());
    }

    @BeforeEach
    void setUp() {
        DocumentRepository repo = mock(DocumentRepository.class);
        when(repo.save(any(DocumentRecord.class))).thenAnswer(inv -> {
            DocumentRecord d = inv.getArgument(0);
            if (d.getId() == null) d.setId(UUID.randomUUID().toString());
            store.put(d.getId(), d);
            return d;
        });
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(store.get((String) inv.getArgument(0))));

        // Real RestTemplate against a closed port: the OCR service is "down", which must not block uploads.
        RestTemplate rest = new RestTemplate();

        shareLinks = mock(ShareLinkRepository.class);
        shareEvents = mock(ShareAccessEventRepository.class);
        ShareService shareService = new ShareService(repo, shareLinks, shareEvents, Clock.systemUTC());
        // The profile-sync collaborator is only used by verifyFields, which these tests don't touch.
        service = new WalletService(repo, rest, null, new FileValidationService(), shareService);
        ReflectionTestUtils.setField(service, "uploadDir", uploads.toString());
        ReflectionTestUtils.setField(service, "ocrServiceUrl", "http://127.0.0.1:1");
    }

    @Test
    void uploadCreatesVersionOneAndStoresUnderUploadsWithGeneratedName() throws Exception {
        DocumentRecord d = service.upload("alice", "education", pdf("../../marks sheet.pdf", "one"));

        assertEquals("EDUCATION", d.getDocumentType());
        assertEquals(1, d.getCurrentVersion());
        assertEquals(1, d.getVersions().size());
        Path stored = Path.of(d.getStoragePath());
        assertTrue(stored.startsWith(uploads.toAbsolutePath()));
        assertFalse(stored.getFileName().toString().contains("marks"));
        assertTrue(Files.exists(stored));
        assertEquals(64, d.getVersions().get(0).getSha256().length());
        assertEquals("OCR_FAILED", d.getVerificationStatus(), "OCR failure must not block the upload");
    }

    @Test
    void uploadRejectsBadTypeAndBadFile() {
        assertThrows(RuntimeException.class, () -> service.upload("alice", "WEIRD", pdf("a.pdf", "x")));
        assertThrows(RuntimeException.class, () ->
                service.upload("alice", "OTHER", new MockMultipartFile("file", "a.exe", "x", "MZ....".getBytes())));
        assertTrue(store.isEmpty());
    }

    @Test
    void newVersionKeepsHistoryAndInvalidatesVerification() {
        DocumentRecord d = service.upload("alice", "OTHER", pdf("a.pdf", "one"));
        d.setVerificationStatus("VERIFIED");
        d.setVerifiedFields(Map.of("name", "A"));

        DocumentRecord v2 = service.addVersion("alice", d.getId(), pdf("b.pdf", "two"));

        assertEquals(2, v2.getCurrentVersion());
        assertEquals(List.of(1, 2), v2.getVersions().stream().map(DocumentVersion::getVersionNumber).toList());
        assertEquals("b.pdf", v2.getFileName());
        assertEquals("OCR_FAILED", v2.getVerificationStatus());
        assertNull(v2.getVerifiedFields());
        assertTrue(Files.exists(Path.of(v2.getVersions().get(0).getStoragePath())), "old file kept");
    }

    @Test
    void restoreCopiesOldVersionForwardWithoutRewritingHistory() throws Exception {
        DocumentRecord d = service.upload("alice", "OTHER", pdf("a.pdf", "one"));
        service.addVersion("alice", d.getId(), pdf("b.pdf", "two"));

        DocumentRecord restored = service.restoreVersion("alice", d.getId(), 1);

        assertEquals(3, restored.getCurrentVersion());
        assertEquals(3, restored.getVersions().size());
        assertEquals("a.pdf", restored.getFileName());
        DocumentVersion v1 = restored.getVersions().get(0);
        DocumentVersion v3 = restored.getVersions().get(2);
        assertNotEquals(v1.getStoragePath(), v3.getStoragePath());
        assertArrayEquals(Files.readAllBytes(Path.of(v1.getStoragePath())),
                Files.readAllBytes(Path.of(v3.getStoragePath())));
        assertThrows(ResourceNotFoundException.class, () -> service.restoreVersion("alice", d.getId(), 99));
    }

    @Test
    void versionHistoryIsCappedAndEvictedFilesAreDeleted() {
        DocumentRecord d = service.upload("alice", "OTHER", pdf("a.pdf", "v1"));
        Path firstFile = Path.of(d.getVersions().get(0).getStoragePath());

        for (int i = 2; i <= WalletService.MAX_VERSIONS + 2; i++) {
            d = service.addVersion("alice", d.getId(), pdf("a.pdf", "v" + i));
        }

        assertEquals(WalletService.MAX_VERSIONS, d.getVersions().size());
        assertEquals(WalletService.MAX_VERSIONS + 2, d.getCurrentVersion());
        assertEquals(3, d.getVersions().get(0).getVersionNumber());
        assertFalse(Files.exists(firstFile));
    }

    @Test
    void otherUsersCannotReadVersionOrRestoreDocument() {
        DocumentRecord d = service.upload("alice", "OTHER", pdf("a.pdf", "one"));
        assertThrows(ResourceNotFoundException.class, () -> service.getDocument("mallory", d.getId()));
        assertThrows(ResourceNotFoundException.class, () -> service.listVersions("mallory", d.getId()));
        assertThrows(ResourceNotFoundException.class, () -> service.addVersion("mallory", d.getId(), pdf("x.pdf", "x")));
        assertThrows(ResourceNotFoundException.class, () -> service.restoreVersion("mallory", d.getId(), 1));
        assertThrows(ResourceNotFoundException.class, () -> service.delete("mallory", d.getId()));
    }

    @Test
    void legacyDocumentWithoutVersionsIsTreatedAsVersionOne() {
        DocumentRecord legacy = DocumentRecord.builder().id("old").userId("alice").documentType("OTHER")
                .fileName("old.pdf").storagePath(uploads.resolve("old.pdf").toString()).build();
        store.put("old", legacy);

        List<DocumentVersion> versions = service.listVersions("alice", "old");
        assertEquals(1, versions.size());
        assertEquals(1, versions.get(0).getVersionNumber());
    }

    @Test
    void deleteRemovesFilesAndDeletesShareLinks() {
        DocumentRecord d = service.upload("alice", "OTHER", pdf("a.pdf", "one"));
        d = service.addVersion("alice", d.getId(), pdf("b.pdf", "two"));
        List<Path> files = d.getVersions().stream().map(v -> Path.of(v.getStoragePath())).toList();

        ShareLink link = ShareLink.builder().id("s1").documentId(d.getId()).ownerId("alice").build();
        when(shareLinks.findByDocumentId(d.getId())).thenReturn(List.of(link));

        service.delete("alice", d.getId());

        files.forEach(f -> assertFalse(Files.exists(f)));
        verify(shareLinks).delete(link);
        verify(shareEvents).deleteByShareId("s1");
    }

    @Test
    void storedPathsOutsideUploadDirAreNeverServed() {
        DocumentVersion rogue = DocumentVersion.builder().versionNumber(1).fileName("x.pdf")
                .storagePath(uploads.getParent().resolve("outside.pdf").toString()).build();
        assertThrows(ResourceNotFoundException.class, () -> service.fileOf(rogue));
    }
}
