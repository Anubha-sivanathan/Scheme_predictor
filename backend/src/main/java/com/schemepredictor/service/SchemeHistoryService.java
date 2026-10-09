package com.schemepredictor.service;

import com.schemepredictor.model.SchemeHistory;
import com.schemepredictor.repository.SchemeHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SchemeHistoryService {

    private final SchemeHistoryRepository schemeHistoryRepository;

    public void recordView(String userId, String schemeId) {
        SchemeHistory entry = SchemeHistory.builder()
                .userId(userId)
                .schemeId(schemeId)
                .viewedAt(Instant.now())
                .build();
        schemeHistoryRepository.save(entry);
    }

    public List<SchemeHistory> recentlyViewed(String userId) {
        return schemeHistoryRepository.findByUserIdOrderByViewedAtDesc(userId);
    }
}
