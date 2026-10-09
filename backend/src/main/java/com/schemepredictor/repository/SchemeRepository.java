package com.schemepredictor.repository;

import com.schemepredictor.model.Scheme;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SchemeRepository extends MongoRepository<Scheme, String> {
    List<Scheme> findByCategoryIgnoreCase(String category);
    List<Scheme> findByStatus(String status);
    List<Scheme> findByNameContainingIgnoreCaseOrDescriptionContainingIgnoreCase(String name, String description);

    java.util.Optional<Scheme> findBySourceSystemAndExternalId(String sourceSystem, String externalId);
    java.util.Optional<Scheme> findByApplicationLink(String applicationLink);
    List<Scheme> findByNameIgnoreCaseAndDepartmentIgnoreCase(String name, String department);
}
