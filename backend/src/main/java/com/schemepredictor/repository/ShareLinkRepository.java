package com.schemepredictor.repository;

import com.schemepredictor.model.ShareLink;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ShareLinkRepository extends MongoRepository<ShareLink, String> {
    Optional<ShareLink> findByTokenHash(String tokenHash);
    List<ShareLink> findByDocumentIdAndOwnerId(String documentId, String ownerId);
    List<ShareLink> findByDocumentId(String documentId);
}
