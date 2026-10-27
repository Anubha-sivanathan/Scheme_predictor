package com.schemepredictor.service;

import com.schemepredictor.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Upload checks: extension allow-list, magic-byte sniffing, filename sanitising and document-type allow-list. */
@Service
public class FileValidationService {

    public static final Set<String> DOCUMENT_TYPES = Set.of(
            "AADHAAR", "INCOME_CERTIFICATE", "CASTE_CERTIFICATE", "RESIDENCE_CERTIFICATE",
            "EDUCATION", "LAND", "DISABILITY", "RATION_CARD", "EMPLOYMENT", "BANK_PASSBOOK", "OTHER");

    private static final Map<String, String> CONTENT_TYPE_BY_EXT = Map.of(
            "pdf", "application/pdf",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "png", "image/png");

    public record ValidatedFile(String safeName, String extension, String contentType) {}

    public String validateDocumentType(String documentType) {
        String normalised = documentType == null ? "" : documentType.trim().toUpperCase(Locale.ROOT);
        if (!DOCUMENT_TYPES.contains(normalised)) {
            throw new BadRequestException("Unsupported document type");
        }
        return normalised;
    }

    public ValidatedFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided");
        }
        String safeName = sanitizeFileName(file.getOriginalFilename());
        int dot = safeName.lastIndexOf('.');
        String ext = dot < 0 ? "" : safeName.substring(dot + 1).toLowerCase(Locale.ROOT);
        String expectedType = CONTENT_TYPE_BY_EXT.get(ext);
        if (expectedType == null) {
            throw new BadRequestException("Only PDF, JPG and PNG files are allowed");
        }
        if (!matchesSignature(file, ext)) {
            throw new BadRequestException("File content does not match its extension");
        }
        return new ValidatedFile(safeName, ext, expectedType);
    }

    /** Strips any path, then everything outside [A-Za-z0-9._-]; never returns empty or dot-leading names. */
    public String sanitizeFileName(String original) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        name = name.replaceAll("[^A-Za-z0-9._-]", "_").replaceAll("\\.{2,}", ".");
        name = name.replaceAll("^\\.+", "");
        if (name.length() > 100) {
            int dot = name.lastIndexOf('.');
            String ext = dot > 0 && name.length() - dot <= 6 ? name.substring(dot) : "";
            name = name.substring(0, 100 - ext.length()) + ext;
        }
        return name.isBlank() ? "file" : name;
    }

    private boolean matchesSignature(MultipartFile file, String ext) {
        byte[] head = new byte[8];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.readNBytes(head, 0, head.length);
        } catch (IOException e) {
            return false;
        }
        if (read < 4) return false;
        return switch (ext) {
            case "pdf" -> head[0] == '%' && head[1] == 'P' && head[2] == 'D' && head[3] == 'F';
            case "png" -> (head[0] & 0xFF) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G';
            case "jpg", "jpeg" -> (head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF;
            default -> false;
        };
    }
}
