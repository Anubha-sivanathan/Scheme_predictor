package com.schemepredictor.repository;

import com.schemepredictor.model.DocumentRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DocumentRepository extends MongoRepository<DocumentRecord, String> {
    List<DocumentRecord> findByUserId(String userId);
}
