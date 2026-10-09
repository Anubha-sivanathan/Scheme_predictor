package com.schemepredictor.util;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.io.StringReader;
import java.util.*;

/**
 * Standard RFC-4180 compliant CSV parser that supports quotes, escaped quotes,
 * commas inside values, and multiline values without third-party dependencies.
 */
public final class CsvParserUtil {

    private CsvParserUtil() {}

    public static List<Map<String, String>> parseCsv(String csvContent) throws IOException {
        try (Reader reader = new StringReader(csvContent)) {
            return parseCsv(reader);
        }
    }

    public static List<Map<String, String>> parseCsv(Reader inputReader) throws IOException {
        BufferedReader reader = new BufferedReader(inputReader);
        List<List<String>> rows = new ArrayList<>();
        List<String> currentRow = new ArrayList<>();
        StringBuilder currentField = new StringBuilder();
        boolean insideQuotes = false;
        int ch;

        while ((ch = reader.read()) != -1) {
            char c = (char) ch;

            if (c == '"') {
                if (insideQuotes) {
                    reader.mark(1);
                    int next = reader.read();
                    if (next == '"') {
                        currentField.append('"');
                    } else {
                        reader.reset();
                        insideQuotes = false;
                    }
                } else {
                    insideQuotes = true;
                }
            } else if (c == ',' && !insideQuotes) {
                currentRow.add(currentField.toString().trim());
                currentField.setLength(0);
            } else if ((c == '\n' || c == '\r') && !insideQuotes) {
                if (c == '\r') {
                    reader.mark(1);
                    int next = reader.read();
                    if (next != '\n') {
                        reader.reset();
                    }
                }
                currentRow.add(currentField.toString().trim());
                currentField.setLength(0);
                if (hasAnyNonEmpty(currentRow)) {
                    rows.add(currentRow);
                }
                currentRow = new ArrayList<>();
            } else {
                currentField.append(c);
            }
        }

        if (currentField.length() > 0 || !currentRow.isEmpty()) {
            currentRow.add(currentField.toString().trim());
            if (hasAnyNonEmpty(currentRow)) {
                rows.add(currentRow);
            }
        }

        if (rows.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> rawHeaders = rows.get(0);
        List<String> headers = new ArrayList<>();
        for (String h : rawHeaders) {
            headers.add(h.trim().toLowerCase());
        }

        List<Map<String, String>> result = new ArrayList<>();
        for (int i = 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            Map<String, String> map = new LinkedHashMap<>();
            for (int j = 0; j < headers.size(); j++) {
                String header = headers.get(j);
                String val = j < row.size() ? row.get(j) : "";
                map.put(header, val);
            }
            result.add(map);
        }

        return result;
    }

    private static boolean hasAnyNonEmpty(List<String> row) {
        for (String s : row) {
            if (s != null && !s.trim().isEmpty()) {
                return true;
            }
        }
        return false;
    }
}
