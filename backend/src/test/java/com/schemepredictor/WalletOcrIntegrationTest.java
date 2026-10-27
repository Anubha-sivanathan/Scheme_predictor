package com.schemepredictor;

import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.Profile;
import com.schemepredictor.repository.DocumentRepository;
import com.schemepredictor.repository.ProfileRepository;
import com.schemepredictor.repository.ShareAccessEventRepository;
import com.schemepredictor.repository.ShareLinkRepository;
import com.schemepredictor.service.FileValidationService;
import com.schemepredictor.service.ProfileNormalizationService;
import com.schemepredictor.service.ShareService;
import com.schemepredictor.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Path;
import java.time.Clock;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Flask /extract response -> wallet storage -> review -> profile (fill blanks, never silently overwrite). */
class WalletOcrIntegrationTest {

    @TempDir
    Path uploads;

    private final Map<String, DocumentRecord> docs = new HashMap<>();
    private final Map<String, Profile> profiles = new HashMap<>();
    private final StubOcr rest = new StubOcr();
    private WalletService wallet;

    @BeforeEach
    void setUp() {
        DocumentRepository docRepo = mock(DocumentRepository.class);
        when(docRepo.save(any(DocumentRecord.class))).thenAnswer(inv -> {
            DocumentRecord d = inv.getArgument(0);
            if (d.getId() == null) d.setId(UUID.randomUUID().toString());
            docs.put(d.getId(), d);
            return d;
        });
        when(docRepo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(docs.get((String) inv.getArgument(0))));
        when(docRepo.findByUserId(anyString())).thenAnswer(inv -> new ArrayList<>(docs.values()));

        ProfileRepository profileRepo = mock(ProfileRepository.class);
        when(profileRepo.findByUserId(anyString())).thenAnswer(inv -> Optional.ofNullable(profiles.get((String) inv.getArgument(0))));
        when(profileRepo.save(any(Profile.class))).thenAnswer(inv -> {
            Profile p = inv.getArgument(0);
            profiles.put(p.getUserId(), p);
            return p;
        });

        ProfileNormalizationService normalizer = new ProfileNormalizationService(profileRepo, docRepo);
        ShareService shares = new ShareService(docRepo, mock(ShareLinkRepository.class),
                mock(ShareAccessEventRepository.class), Clock.systemUTC());
        wallet = new WalletService(docRepo, rest, normalizer, new FileValidationService(), shares);
        ReflectionTestUtils.setField(wallet, "uploadDir", uploads.toString());
        ReflectionTestUtils.setField(wallet, "ocrServiceUrl", "http://ocr");
    }

    /** Stands in for the Flask service; Mockito cannot mock concrete classes on this JDK. */
    static class StubOcr extends RestTemplate {
        Map<?, ?> body;
        RuntimeException failure;

        @Override
        @SuppressWarnings("unchecked")
        public <T> T postForObject(String url, Object request, Class<T> type, Object... vars) {
            if (failure != null) throw failure;
            return (T) body;
        }
    }

    private void ocrReturns(Map<?, ?> body) {
        rest.failure = null;
        rest.body = body;
    }

    private DocumentRecord upload(String type) {
        return wallet.upload("u1", type, new MockMultipartFile("file", "a.pdf", "application/pdf", "%PDF-1.4 x".getBytes()));
    }

    @Test
    void storesEveryFieldFlaskReturnedAndMarksForReview() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", " Raj Kumar ");
        fields.put("dateOfBirth", "12/05/1998");
        fields.put("pinCode", "641001");
        fields.put("issuingAuthority", "Tahsildar");
        fields.put("percentage", 78.5);      // non-string from a future Flask build
        fields.put("blank", "  ");
        fields.put("nothing", null);
        ocrReturns(Map.of("documentType", "AADHAAR", "fields", fields));

        DocumentRecord d = upload("AADHAAR");

        assertEquals("OCR_EXTRACTED", d.getVerificationStatus());
        assertEquals(Map.of("name", "Raj Kumar", "dateOfBirth", "12/05/1998", "pinCode", "641001",
                "issuingAuthority", "Tahsildar", "percentage", "78.5"), d.getExtractedFields());
    }

    @Test
    void emptyOcrResultIsReportedAsEmptyNotFailed() {
        ocrReturns(Map.of("documentType", "OTHER", "fields", Map.of()));
        DocumentRecord d = upload("OTHER");
        assertEquals("OCR_EMPTY", d.getVerificationStatus());
        assertTrue(d.getExtractedFields().isEmpty());
    }

    @Test
    void missingFieldsKeyIsEmptyNotACrash() {
        ocrReturns(Map.of("error", "boom"));
        assertEquals("OCR_EMPTY", upload("OTHER").getVerificationStatus());
    }

    @Test
    void ocrServiceErrorKeepsDocumentAndMarksFailed() {
        rest.failure = new RestClientException("Aadhaar 1234 5678 9012");
        DocumentRecord d = upload("AADHAAR");
        assertEquals("OCR_FAILED", d.getVerificationStatus());
        assertNull(d.getExtractedFields());
        assertNotNull(d.getId(), "document is still stored");
    }

    @Test
    void verifyFillsBlankProfileFieldsAndNeverOverwritesConflicts() {
        profiles.put("u1", Profile.builder().userId("u1").state("Kerala").gender("Female").build());
        ocrReturns(Map.of("fields", Map.of("name", "Raj Kumar", "gender", "Male", "state", "Tamil Nadu",
                "district", "Coimbatore", "pinCode", "641001", "address", "12 Gandhi St",
                "dateOfBirth", "12/05/1998")));
        DocumentRecord d = upload("AADHAAR");

        wallet.verifyFields("u1", d.getId(), new HashMap<>(d.getExtractedFields()));

        Profile p = profiles.get("u1");
        assertEquals("Raj Kumar", p.getFullName());
        assertEquals("Coimbatore", p.getDistrict());
        assertEquals("641001", p.getPinCode());
        assertEquals("12 Gandhi St", p.getAddress());
        assertEquals("12/05/1998", p.getDateOfBirth());
        assertNotNull(p.getAge());
        assertEquals("Kerala", p.getState(), "existing value must survive a conflicting OCR result");
        assertEquals("Female", p.getGender());

        Set<String> conflictFields = new HashSet<>();
        wallet.profileConflicts("u1", d.getId()).forEach(c -> conflictFields.add(c.field()));
        assertEquals(Set.of("state", "gender"), conflictFields);
    }

    @Test
    void acceptingAConflictOverwritesOnlyThatField() {
        profiles.put("u1", Profile.builder().userId("u1").state("Kerala").gender("Female").build());
        ocrReturns(Map.of("fields", Map.of("gender", "Male", "state", "Tamil Nadu")));
        DocumentRecord d = upload("AADHAAR");
        wallet.verifyFields("u1", d.getId(), new HashMap<>(d.getExtractedFields()));

        Profile p = wallet.applyProfileChanges("u1", d.getId(), Set.of("state", "fullName"));

        assertEquals("Tamil Nadu", p.getState());
        assertEquals("Female", p.getGender());
        assertNull(p.getFullName(), "a field the document does not propose is ignored");
    }

    @Test
    void cannotApplyProfileChangesFromAnUnconfirmedDocument() {
        ocrReturns(Map.of("fields", Map.of("state", "Tamil Nadu")));
        DocumentRecord d = upload("AADHAAR");
        assertThrows(RuntimeException.class, () -> wallet.applyProfileChanges("u1", d.getId(), Set.of("state")));
    }

    @Test
    void otherUsersCannotSeeOrApplyChanges() {
        ocrReturns(Map.of("fields", Map.of("state", "Tamil Nadu")));
        DocumentRecord d = upload("AADHAAR");
        assertThrows(RuntimeException.class, () -> wallet.profileConflicts("intruder", d.getId()));
    }
}
