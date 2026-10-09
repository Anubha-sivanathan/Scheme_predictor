package com.schemepredictor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportSummaryDto {
    private int totalProcessed;
    private int stagedNew;
    private int stagedUpdate;
    private int skippedDuplicates;
    private int rejectedErrors;

    @Builder.Default
    private List<String> errors = new ArrayList<>();

    @Builder.Default
    private List<String> stagedSchemeIds = new ArrayList<>();
}
