package com.schemepredictor.repository;

import com.schemepredictor.model.Scheme;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SchemeRepository extends MongoRepository<Scheme, String> {
    List<Scheme> findByCategoryIgnoreCase(String category);
    List<Scheme> findByStatus(String status);
    List<Scheme> findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String name, String description);
}
