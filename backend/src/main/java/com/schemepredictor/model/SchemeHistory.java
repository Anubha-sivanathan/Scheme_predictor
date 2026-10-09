package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "scheme_history")
public class SchemeHistory {
    @Id
    private String id;
    private String userId;
    private String schemeId;
    private Instant viewedAt;
}
