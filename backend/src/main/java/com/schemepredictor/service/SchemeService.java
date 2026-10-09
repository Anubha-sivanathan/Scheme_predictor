package com.schemepredictor.service;

import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.Scheme;
import com.schemepredictor.repository.SchemeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SchemeService {

    private final SchemeRepository schemeRepository;

    public List<Scheme> findAll() {
        return schemeRepository.findByStatus("ACTIVE");
    }

    public Scheme findById(String id) {
        return schemeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Scheme not found: " + id));
    }

    public List<Scheme> findByCategory(String category) {
        return schemeRepository.findByCategoryIgnoreCase(category);
    }

    /**
     * Simple keyword search over name/description. Tokenizes a natural-language
     * query and matches schemes containing any meaningful token — a lightweight
     * stand-in that can later be swapped for a semantic/AI-powered search service
     * without changing the API contract (GET /api/schemes/search?q=...).
     */
    public List<Scheme> search(String query) {
        if (query == null || query.trim().isEmpty()) {
            return findAll();
        }

        // Try a direct substring match first (handles "scholarship", "agriculture" etc.)
        List<Scheme> direct = schemeRepository
                .findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(query, query);
        if (!direct.isEmpty()) {
            return direct;
        }

        // Fall back to token-based matching for natural-language queries.
        List<String> stopWords = List.of("for", "the", "a", "an", "of", "in", "with", "from", "and", "to");
        String[] tokens = query.toLowerCase().split("\\s+");

        return schemeRepository.findByStatus("ACTIVE").stream()
                .filter(scheme -> {
                    String haystack = (scheme.getName() + " " + scheme.getDescription() + " " + scheme.getCategory())
                            .toLowerCase();
                    for (String token : tokens) {
                        if (token.length() > 2 && !stopWords.contains(token) && haystack.contains(token)) {
                            return true;
                        }
                    }
                    return false;
                })
                .toList();
    }

    public Scheme save(Scheme scheme) {
        return schemeRepository.save(scheme);
    }

    public List<Scheme> findAllForAdmin() {
        return schemeRepository.findAll();
    }

    public Scheme create(Scheme scheme) {
        scheme.setId(null);
        if (scheme.getStatus() == null || scheme.getStatus().isBlank()) {
            scheme.setStatus("ACTIVE");
        }
        java.time.Instant now = java.time.Instant.now();
        scheme.setCreatedAt(now);
        scheme.setUpdatedAt(now);
        return schemeRepository.save(scheme);
    }

    public Scheme update(String id, Scheme updated) {
        Scheme existing = findById(id);
        existing.setName(updated.getName());
        existing.setDepartment(updated.getDepartment());
        existing.setCategory(updated.getCategory());
        existing.setDescription(updated.getDescription());
        existing.setBenefits(updated.getBenefits());
        existing.setEligibilityCriteria(updated.getEligibilityCriteria());
        existing.setRequiredDocuments(updated.getRequiredDocuments());
        existing.setApplicationProcess(updated.getApplicationProcess());
        existing.setApplicationLink(updated.getApplicationLink());
        existing.setDeadline(updated.getDeadline());
        if (updated.getStatus() != null && !updated.getStatus().isBlank()) {
            existing.setStatus(updated.getStatus());
        }
        existing.setUpdatedAt(java.time.Instant.now());
        return schemeRepository.save(existing);
    }

    public Scheme toggleStatus(String id) {
        Scheme scheme = findById(id);
        scheme.setStatus("ACTIVE".equalsIgnoreCase(scheme.getStatus()) ? "INACTIVE" : "ACTIVE");
        scheme.setUpdatedAt(java.time.Instant.now());
        return schemeRepository.save(scheme);
    }

    public void delete(String id) {
        Scheme scheme = findById(id);
        schemeRepository.delete(scheme);
    }
}
