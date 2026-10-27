package com.schemepredictor;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.exception.ForbiddenException;
import com.schemepredictor.exception.GoneException;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.ShareAccessEvent;
import com.schemepredictor.model.ShareLink;
import com.schemepredictor.repository.DocumentRepository;
import com.schemepredictor.repository.ShareAccessEventRepository;
import com.schemepredictor.repository.ShareLinkRepository;
import com.schemepredictor.service.ShareService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ShareServiceTest {

    /** Clock the test can move forward. */
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final List<ShareLink> links = new ArrayList<>();
    private final List<ShareAccessEvent> events = new ArrayList<>();
    private final MutableClock clock = new MutableClock();

    private DocumentRepository documents;
    private ShareService service;

    private DocumentRecord doc(String id, String owner, String type) {
        DocumentRecord d = DocumentRecord.builder().id(id).userId(owner).documentType(type).fileName("f.pdf").build();
        when(documents.findById(id)).thenReturn(Optional.of(d));
        return d;
    }

    @BeforeEach
    void setUp() {
        documents = mock(DocumentRepository.class);
        ShareLinkRepository linkRepo = mock(ShareLinkRepository.class);
        ShareAccessEventRepository eventRepo = mock(ShareAccessEventRepository.class);

        when(linkRepo.save(any(ShareLink.class))).thenAnswer(inv -> {
            ShareLink l = inv.getArgument(0);
            if (l.getId() == null) {
                l.setId(UUID.randomUUID().toString());
                links.add(l);
            }
            return l;
        });
        when(linkRepo.findByTokenHash(anyString())).thenAnswer(inv ->
                links.stream().filter(l -> l.getTokenHash().equals(inv.getArgument(0))).findFirst());
        when(linkRepo.findById(anyString())).thenAnswer(inv ->
                links.stream().filter(l -> l.getId().equals(inv.getArgument(0))).findFirst());
        when(linkRepo.findByDocumentIdAndOwnerId(anyString(), anyString())).thenAnswer(inv ->
                links.stream().filter(l -> l.getDocumentId().equals(inv.getArgument(0))
                        && l.getOwnerId().equals(inv.getArgument(1))).toList());
        when(eventRepo.save(any(ShareAccessEvent.class))).thenAnswer(inv -> {
            events.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(eventRepo.findByShareIdOrderByAtDesc(anyString())).thenAnswer(inv ->
                events.stream().filter(e -> e.getShareId().equals(inv.getArgument(0))).toList());

        service = new ShareService(documents, linkRepo, eventRepo, clock);
        ReflectionTestUtils.setField(service, "allowSensitive", false);
    }

    @Test
    void createStoresOnlyTheTokenHash() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 2, false);

        assertNotNull(created.token());
        assertTrue(created.token().length() >= 43, "256-bit token expected");
        assertNotEquals(created.token(), created.link().getTokenHash());
        assertEquals(64, created.link().getTokenHash().length());
        assertEquals(clock.now.plus(Duration.ofHours(2)), created.link().getExpiresAt());
        // the raw token must not appear anywhere in what is persisted
        assertFalse(links.toString().contains(created.token()));
    }

    @Test
    void tokensAreUnique() {
        doc("d1", "alice", "EDUCATION");
        String a = service.create("alice", "d1", "VIEW", 1, false).token();
        String b = service.create("alice", "d1", "VIEW", 1, false).token();
        assertNotEquals(a, b);
    }

    @Test
    void nonOwnerCannotShareListOrRevoke() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);

        assertThrows(ResourceNotFoundException.class, () -> service.create("mallory", "d1", "VIEW", 1, false));
        assertThrows(ResourceNotFoundException.class, () -> service.list("mallory", "d1"));
        assertThrows(ResourceNotFoundException.class, () -> service.revoke("mallory", "d1", created.link().getId()));
        assertThrows(ResourceNotFoundException.class, () -> service.events("mallory", "d1", created.link().getId()));
        assertNull(created.link().getRevokedAt());
    }

    @Test
    void ownerCannotRevokeLinkOfAnotherDocumentViaPathMixing() {
        doc("d1", "alice", "EDUCATION");
        doc("d2", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);
        assertThrows(ResourceNotFoundException.class, () -> service.revoke("alice", "d2", created.link().getId()));
    }

    @Test
    void aadhaarCannotBeSharedEvenWithAcknowledgement() {
        doc("d1", "alice", "AADHAAR");
        assertThrows(ForbiddenException.class, () -> service.create("alice", "d1", "VIEW", 1, true));
        assertTrue(links.isEmpty());
    }

    @Test
    void aadhaarCanBeEnabledOnlyByExplicitConfigAndStillNeedsAcknowledgement() {
        ReflectionTestUtils.setField(service, "allowSensitive", true);
        doc("d1", "alice", "AADHAAR");
        assertThrows(BadRequestException.class, () -> service.create("alice", "d1", "VIEW", 1, false));
        assertDoesNotThrow(() -> service.create("alice", "d1", "VIEW", 1, true));
    }

    @Test
    void sensitiveTypesRequireRiskAcknowledgement() {
        doc("d1", "alice", "INCOME_CERTIFICATE");
        assertThrows(BadRequestException.class, () -> service.create("alice", "d1", "VIEW", 1, false));
        assertDoesNotThrow(() -> service.create("alice", "d1", "VIEW", 1, true));
    }

    @Test
    void invalidPermissionAndExpiryRejected() {
        doc("d1", "alice", "EDUCATION");
        assertThrows(BadRequestException.class, () -> service.create("alice", "d1", "EDIT", 1, false));
        assertThrows(BadRequestException.class, () -> service.create("alice", "d1", "VIEW", 0, false));
        assertThrows(BadRequestException.class, () -> service.create("alice", "d1", "VIEW", 169, false));
    }

    @Test
    void validTokenResolvesAndRecordsAnEventWithoutContent() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "DOWNLOAD", 1, false);

        ShareService.ShareAccess access = service.resolve(created.token(), true);
        assertEquals("d1", access.document().getId());
        assertEquals(1, events.size());
        assertEquals(ShareAccessEvent.DOWNLOADED, events.get(0).getOutcome());
        assertFalse(events.get(0).toString().contains(created.token()));
    }

    @Test
    void expiredLinkIsGoneAndAudited() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);

        clock.now = clock.now.plus(Duration.ofHours(1)); // exactly at expiry counts as expired
        assertThrows(GoneException.class, () -> service.resolve(created.token(), false));
        assertEquals(ShareAccessEvent.DENIED_EXPIRED, events.get(0).getOutcome());
    }

    @Test
    void linkStillValidJustBeforeExpiry() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);
        clock.now = clock.now.plus(Duration.ofMinutes(59));
        assertDoesNotThrow(() -> service.resolve(created.token(), false));
    }

    @Test
    void revokedLinkStopsWorkingImmediately() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 24, false);
        assertDoesNotThrow(() -> service.resolve(created.token(), false));

        service.revoke("alice", "d1", created.link().getId());
        assertThrows(GoneException.class, () -> service.resolve(created.token(), false));
        assertEquals(ShareAccessEvent.DENIED_REVOKED, events.get(events.size() - 1).getOutcome());
    }

    @Test
    void viewLinkCannotDownload() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);
        assertThrows(ForbiddenException.class, () -> service.resolve(created.token(), true));
        assertEquals(ShareAccessEvent.DENIED_PERMISSION, events.get(0).getOutcome());
        assertDoesNotThrow(() -> service.resolve(created.token(), false));
    }

    @Test
    void unknownOrBlankTokenIsNotFound() {
        assertThrows(ResourceNotFoundException.class, () -> service.resolve("nope", false));
        assertThrows(ResourceNotFoundException.class, () -> service.resolve(null, false));
        assertThrows(ResourceNotFoundException.class, () -> service.resolve("", false));
    }

    @Test
    void ownerSeesAccessEvents() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);
        service.resolve(created.token(), false);
        assertEquals(1, service.events("alice", "d1", created.link().getId()).size());
    }

    @Test
    void inspectDoesNotLogASuccessfulAccessButStillLogsDenials() {
        doc("d1", "alice", "EDUCATION");
        ShareService.CreatedShare created = service.create("alice", "d1", "VIEW", 1, false);

        service.inspect(created.token());
        assertTrue(events.isEmpty(), "a metadata lookup is not an access");

        service.revoke("alice", "d1", created.link().getId());
        assertThrows(GoneException.class, () -> service.inspect(created.token()));
        assertEquals(ShareAccessEvent.DENIED_REVOKED, events.get(0).getOutcome());
    }
}
