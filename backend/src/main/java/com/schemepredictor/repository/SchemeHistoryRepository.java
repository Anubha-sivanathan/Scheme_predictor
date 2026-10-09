package com.schemepredictor.repository;

import com.schemepredictor.model.SchemeHistory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SchemeHistoryRepository extends MongoRepository<SchemeHistory, String> {
    List<SchemeHistory> findByUserIdOrderByViewedAtDesc(String userId);
}
