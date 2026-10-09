package com.schemepredictor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.schemepredictor.dto.ImportSummaryDto;
import com.schemepredictor.dto.RejectStagingRequest;
import com.schemepredictor.model.Scheme;
import com.schemepredictor.model.StagingScheme;
import com.schemepredictor.repository.SchemeRepository;
import com.schemepredictor.repository.StagingSchemeRepository;
import com.schemepredictor.service.StagingSchemeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StagingSchemeServiceTest {

    @Mock
    private StagingSchemeRepository stagingSchemeRepository;

    @Mock
    private SchemeRepository schemeRepository;

    private StagingSchemeService stagingSchemeService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        stagingSchemeService = new StagingSchemeService(stagingSchemeRepository, schemeRepository, objectMapper);
    }

    @Test
    void testValidation_RejectsMissingName() {
        Scheme scheme = Scheme.builder()
                .name("")
                .department("Department of Education")
                .category("Education")
                .applicationLink("https://scholarships.gov.in")
                .build();

        List<String> errors = stagingSchemeService.validateScheme(scheme);
        assertFalse(errors.isEmpty());
        assertTrue(errors.stream().anyMatch(e -> e.contains("Scheme name is required")));
    }

    @Test
    void testValidation_RejectsMissingDepartment() {
        Scheme scheme = Scheme.builder()
                .name("National Scholarship Scheme")
                .department("")
                .category("Education")
                .applicationLink("https://scholarships.gov.in")
                .build();

        List<String> errors = stagingSchemeService.validateScheme(scheme);
        assertFalse(errors.isEmpty());
        assertTrue(errors.stream().anyMatch(e -> e.contains("Department is required")));
    }

    @Test
    void testValidation_RejectsUnsupportedCategory() {
        Scheme scheme = Scheme.builder()
                .name("Crypto Grant Scheme")
                .department("Ministry of Finance")
                .category("Cryptocurrency")
                .applicationLink("https://gov.in/crypto")
                .build();

        List<String> errors = stagingSchemeService.validateScheme(scheme);
        assertFalse(errors.isEmpty());
        assertTrue(errors.stream().anyMatch(e -> e.contains("not supported")));
    }

    @Test
    void testValidation_RejectsNonHttpsApplicationLink() {
        Scheme scheme = Scheme.builder()
                .name("State Welfare Scheme")
                .department("Social Welfare")
                .category("Social Welfare") // Will fail if not normalized, or fail on http
                .applicationLink("http://insecure-portal.gov.in")
                .build();

        List<String> errors = stagingSchemeService.validateScheme(scheme);
        assertFalse(errors.isEmpty());
        assertTrue(errors.stream().anyMatch(e -> e.contains("must use HTTPS")));
    }

    @Test
    void testValidation_PassesValidScheme() {
        Scheme scheme = Scheme.builder()
                .name("Post Matric Scholarship")
                .department("Ministry of Social Justice")
                .category("Education")
                .applicationLink("https://scholarships.gov.in")
                .build();

        List<String> errors = stagingSchemeService.validateScheme(scheme);
        assertTrue(errors.isEmpty(), "Valid scheme should have no validation errors");
    }

    @Test
    void testDuplicateDetection_ExactDuplicateSkipped() {
        Scheme proposed = Scheme.builder()
                .name("PM Kisan Samman Nidhi")
                .department("Ministry of Agriculture")
                .category("Agriculture")
                .description("Direct income support")
                .applicationLink("https://pmkisan.gov.in")
                .externalId("PM-KISAN-01")
                .sourceSystem("DATA_GOV_IN")
                .build();

        String hash = stagingSchemeService.computeContentHash(proposed);
        proposed.setContentHash(hash);

        Scheme liveScheme = Scheme.builder()
                .id("live-101")
                .name("PM Kisan Samman Nidhi")
                .department("Ministry of Agriculture")
                .category("Agriculture")
                .description("Direct income support")
                .applicationLink("https://pmkisan.gov.in")
                .externalId("PM-KISAN-01")
                .sourceSystem("DATA_GOV_IN")
                .contentHash(hash)
                .build();

        when(schemeRepository.findBySourceSystemAndExternalId("DATA_GOV_IN", "PM-KISAN-01"))
                .thenReturn(Optional.of(liveScheme));

        StagingSchemeService.DuplicateCheckResult result = stagingSchemeService.detectDuplicates(proposed, hash);

        assertTrue(result.isExactDuplicate());
        assertEquals("EXACT_DUPLICATE", result.getChangeType());
        assertEquals("live-101", result.getExistingSchemeId());
    }

    @Test
    void testDuplicateDetection_ChangeDetected_FlaggedAsUpdate() {
        Scheme proposed = Scheme.builder()
                .name("PM Kisan Samman Nidhi")
                .department("Ministry of Agriculture")
                .category("Agriculture")
                .description("Updated income support of ₹8,000 per year")
                .applicationLink("https://pmkisan.gov.in")
                .externalId("PM-KISAN-01")
                .sourceSystem("DATA_GOV_IN")
                .build();

        String proposedHash = stagingSchemeService.computeContentHash(proposed);
        proposed.setContentHash(proposedHash);

        Scheme liveScheme = Scheme.builder()
                .id("live-101")
                .name("PM Kisan Samman Nidhi")
                .department("Ministry of Agriculture")
                .category("Agriculture")
                .description("Old income support of ₹6,000 per year")
                .applicationLink("https://pmkisan.gov.in")
                .externalId("PM-KISAN-01")
                .sourceSystem("DATA_GOV_IN")
                .contentHash("old-hash-value-123")
                .build();

        when(schemeRepository.findBySourceSystemAndExternalId("DATA_GOV_IN", "PM-KISAN-01"))
                .thenReturn(Optional.of(liveScheme));

        StagingSchemeService.DuplicateCheckResult result = stagingSchemeService.detectDuplicates(proposed, proposedHash);

        assertFalse(result.isExactDuplicate());
        assertEquals("UPDATE", result.getChangeType());
        assertEquals("live-101", result.getExistingSchemeId());
        assertNotNull(result.getChangedFields());
        assertTrue(result.getChangedFields().containsKey("description"));
    }

    @Test
    void testDuplicateDetection_MatchByApplicationLink() {
        Scheme proposed = Scheme.builder()
                .name("Ayushman Bharat PMJAY Revised")
                .department("Ministry of Health")
                .category("Healthcare")
                .applicationLink("https://pmjay.gov.in")
                .sourceSystem("GOV_FEED")
                .build();

        String proposedHash = stagingSchemeService.computeContentHash(proposed);

        Scheme liveScheme = Scheme.builder()
                .id("live-202")
                .name("Ayushman Bharat - PMJAY")
                .department("Ministry of Health and Family Welfare")
                .category("Healthcare")
                .applicationLink("https://pmjay.gov.in")
                .contentHash("live-pmjay-hash")
                .build();

        when(schemeRepository.findByApplicationLink("https://pmjay.gov.in"))
                .thenReturn(Optional.of(liveScheme));

        StagingSchemeService.DuplicateCheckResult result = stagingSchemeService.detectDuplicates(proposed, proposedHash);

        assertFalse(result.isExactDuplicate());
        assertEquals("UPDATE", result.getChangeType());
        assertEquals("live-202", result.getExistingSchemeId());
    }

    @Test
    void testDuplicateDetection_NewRecordWhenNoMatch() {
        Scheme proposed = Scheme.builder()
                .name("Brand New Solar Pump Scheme")
                .department("Ministry of New and Renewable Energy")
                .category("Agriculture")
                .applicationLink("https://solarpump.gov.in")
                .externalId("SOLAR-001")
                .sourceSystem("DATA_GOV_IN")
                .build();

        String proposedHash = stagingSchemeService.computeContentHash(proposed);

        when(schemeRepository.findBySourceSystemAndExternalId("DATA_GOV_IN", "SOLAR-001"))
                .thenReturn(Optional.empty());
        when(schemeRepository.findByApplicationLink("https://solarpump.gov.in"))
                .thenReturn(Optional.empty());
        when(schemeRepository.findByNameIgnoreCaseAndDepartmentIgnoreCase(
                "Brand New Solar Pump Scheme", "Ministry of New and Renewable Energy"))
                .thenReturn(List.of());
        when(stagingSchemeRepository.findByContentHashAndReviewStatus(proposedHash, "PENDING"))
                .thenReturn(Optional.empty());

        StagingSchemeService.DuplicateCheckResult result = stagingSchemeService.detectDuplicates(proposed, proposedHash);

        assertFalse(result.isExactDuplicate());
        assertEquals("NEW", result.getChangeType());
        assertNull(result.getExistingSchemeId());
    }

    @Test
    void testImportJson_StagesRecordsWithoutModifyingLiveCollection() {
        String json = """
        [
          {
            "name": "Higher Education Grant",
            "department": "Higher Education Department",
            "category": "Education",
            "description": "Scholarship for postgraduate students",
            "applicationLink": "https://education.gov.in/grant",
            "externalId": "HED-01",
            "sourceSystem": "DATA_GOV_IN",
            "sourceUrl": "https://data.gov.in/dataset/hed"
          }
        ]
        """;

        when(schemeRepository.findBySourceSystemAndExternalId("DATA_GOV_IN", "HED-01"))
                .thenReturn(Optional.empty());
        when(schemeRepository.findByApplicationLink("https://education.gov.in/grant"))
                .thenReturn(Optional.empty());
        when(schemeRepository.findByNameIgnoreCaseAndDepartmentIgnoreCase("Higher Education Grant", "Higher Education Department"))
                .thenReturn(List.of());
        when(stagingSchemeRepository.findByContentHashAndReviewStatus(any(), eq("PENDING")))
                .thenReturn(Optional.empty());

        when(stagingSchemeRepository.save(any(StagingScheme.class))).thenAnswer(invocation -> {
            StagingScheme s = invocation.getArgument(0);
            s.setId("stage-999");
            return s;
        });

        ImportSummaryDto summary = stagingSchemeService.importRawData(json, "json", "DATA_GOV_IN", null);

        assertEquals(1, summary.getTotalProcessed());
        assertEquals(1, summary.getStagedNew());
        assertEquals(0, summary.getRejectedErrors());
        assertEquals(1, summary.getStagedSchemeIds().size());

        // Verify Staging collection was saved to
        verify(stagingSchemeRepository, times(1)).save(any(StagingScheme.class));
        // Crucial test: verify that LIVE schemes collection was NEVER saved to during import
        verify(schemeRepository, never()).save(any(Scheme.class));
    }

    @Test
    void testImportCsv_ParsesAndStagesRecords() {
        String csv = """
        name,department,category,applicationLink,description,externalId,sourceSystem
        "Tamil Nadu Rural Housing","Rural Development Dept","Housing","https://rural.tn.gov.in","Housing assistance for rural poor","TN-RUR-01","TN_OPEN_DATA"
        """;

        when(schemeRepository.findBySourceSystemAndExternalId("TN_OPEN_DATA", "TN-RUR-01"))
                .thenReturn(Optional.empty());
        when(schemeRepository.findByApplicationLink("https://rural.tn.gov.in"))
                .thenReturn(Optional.empty());
        when(schemeRepository.findByNameIgnoreCaseAndDepartmentIgnoreCase("Tamil Nadu Rural Housing", "Rural Development Dept"))
                .thenReturn(List.of());
        when(stagingSchemeRepository.findByContentHashAndReviewStatus(any(), eq("PENDING")))
                .thenReturn(Optional.empty());

        when(stagingSchemeRepository.save(any(StagingScheme.class))).thenAnswer(invocation -> {
            StagingScheme s = invocation.getArgument(0);
            s.setId("stage-888");
            return s;
        });

        ImportSummaryDto summary = stagingSchemeService.importRawData(csv, "csv", "TN_OPEN_DATA", null);

        assertEquals(1, summary.getTotalProcessed());
        assertEquals(1, summary.getStagedNew());
        assertEquals(0, summary.getRejectedErrors());
        verify(schemeRepository, never()).save(any(Scheme.class));
    }

    @Test
    void testApprove_NewRecordBecomesLiveScheme() {
        Scheme proposed = Scheme.builder()
                .name("National Youth Empowerment")
                .department("Ministry of Youth Affairs")
                .category("Employment")
                .applicationLink("https://youth.gov.in")
                .externalId("NYE-01")
                .sourceSystem("DATA_GOV_IN")
                .build();

        StagingScheme staging = StagingScheme.builder()
                .id("stage-001")
                .changeType("NEW")
                .reviewStatus("PENDING")
                .proposedData(proposed)
                .sourceSystem("DATA_GOV_IN")
                .sourceUrl("https://data.gov.in/dataset/youth")
                .externalId("NYE-01")
                .dataOrigin("BULK_IMPORT")
                .contentHash("hash-xyz")
                .build();

        when(stagingSchemeRepository.findById("stage-001")).thenReturn(Optional.of(staging));
        when(schemeRepository.save(any(Scheme.class))).thenAnswer(inv -> {
            Scheme s = inv.getArgument(0);
            s.setId("live-999");
            return s;
        });

        Scheme liveScheme = stagingSchemeService.approve("stage-001", "admin-user-42");

        assertNotNull(liveScheme);
        assertEquals("National Youth Empowerment", liveScheme.getName());
        assertEquals("APPROVED", liveScheme.getReviewStatus());
        assertEquals("DATA_GOV_IN", liveScheme.getSourceSystem());
        assertEquals("ACTIVE", liveScheme.getStatus());

        // Staging record updated to APPROVED
        assertEquals("APPROVED", staging.getReviewStatus());
        assertEquals("admin-user-42", staging.getReviewedBy());
        assertNotNull(staging.getReviewedAt());
        verify(stagingSchemeRepository, times(1)).save(staging);
    }

    @Test
    void testApprove_UpdateRecordModifiesLiveScheme() {
        Scheme existingLive = Scheme.builder()
                .id("live-old-1")
                .name("Post Matric Scholarship")
                .department("Ministry of Social Justice")
                .category("Education")
                .description("Old benefits amount ₹2000")
                .applicationLink("https://scholarships.gov.in")
                .status("ACTIVE")
                .build();

        Scheme proposedUpdated = Scheme.builder()
                .name("Post Matric Scholarship")
                .department("Ministry of Social Justice")
                .category("Education")
                .description("Increased benefits amount ₹5000")
                .applicationLink("https://scholarships.gov.in")
                .deadline(LocalDate.of(2026, 12, 31))
                .build();

        StagingScheme staging = StagingScheme.builder()
                .id("stage-update-1")
                .changeType("UPDATE")
                .existingSchemeId("live-old-1")
                .reviewStatus("PENDING")
                .proposedData(proposedUpdated)
                .sourceSystem("DATA_GOV_IN")
                .contentHash("new-hash-456")
                .build();

        when(stagingSchemeRepository.findById("stage-update-1")).thenReturn(Optional.of(staging));
        when(schemeRepository.findById("live-old-1")).thenReturn(Optional.of(existingLive));
        when(schemeRepository.save(any(Scheme.class))).thenAnswer(inv -> inv.getArgument(0));

        Scheme updatedLive = stagingSchemeService.approve("stage-update-1", "admin-user-42");

        assertEquals("live-old-1", updatedLive.getId());
        assertEquals("Increased benefits amount ₹5000", updatedLive.getDescription());
        assertEquals(LocalDate.of(2026, 12, 31), updatedLive.getDeadline());
        assertEquals("APPROVED", updatedLive.getReviewStatus());
        assertEquals("new-hash-456", updatedLive.getContentHash());
        assertEquals("APPROVED", staging.getReviewStatus());
    }

    @Test
    void testReject_SetsReasonAndPreservesLiveCollection() {
        StagingScheme staging = StagingScheme.builder()
                .id("stage-bad-1")
                .changeType("NEW")
                .reviewStatus("PENDING")
                .proposedData(Scheme.builder().name("Doubtful Scheme").build())
                .build();

        when(stagingSchemeRepository.findById("stage-bad-1")).thenReturn(Optional.of(staging));
        when(stagingSchemeRepository.save(any(StagingScheme.class))).thenAnswer(inv -> inv.getArgument(0));

        RejectStagingRequest req = new RejectStagingRequest("Ineligible or duplicate of state gazette");
        StagingScheme rejected = stagingSchemeService.reject("stage-bad-1", req, "admin-user-42");

        assertEquals("REJECTED", rejected.getReviewStatus());
        assertEquals("Ineligible or duplicate of state gazette", rejected.getRejectionReason());
        assertEquals("admin-user-42", rejected.getReviewedBy());

        // Live scheme collection must NEVER be modified on rejection
        verify(schemeRepository, never()).save(any(Scheme.class));
    }
}
