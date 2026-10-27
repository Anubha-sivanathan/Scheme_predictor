package com.schemepredictor.repository;

import com.schemepredictor.model.ShareAccessEvent;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ShareAccessEventRepository extends MongoRepository<ShareAccessEvent, String> {
    List<ShareAccessEvent> findByShareIdOrderByAtDesc(String shareId);
    void deleteByShareId(String shareId);
}
