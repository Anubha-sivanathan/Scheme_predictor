package com.schemepredictor;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.service.FileValidationService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.*;

class FileValidationServiceTest {

    private final FileValidationService service = new FileValidationService();

    private static final byte[] PDF = "%PDF-1.4 test".getBytes();
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10};

    private MockMultipartFile file(String name, byte[] content) {
        return new MockMultipartFile("file", name, "application/octet-stream", content);
    }

    @Test
    void acceptsRealPdfPngJpg() {
        assertEquals("application/pdf", service.validate(file("a.pdf", PDF)).contentType());
        assertEquals("image/png", service.validate(file("a.PNG", PNG)).contentType());
        assertEquals("image/jpeg", service.validate(file("a.jpeg", JPG)).contentType());
    }

    @Test
    void rejectsDisallowedExtensions() {
        assertThrows(BadRequestException.class, () -> service.validate(file("run.exe", PDF)));
        assertThrows(BadRequestException.class, () -> service.validate(file("page.html", "<html>".getBytes())));
        assertThrows(BadRequestException.class, () -> service.validate(file("noext", PDF)));
    }

    @Test
    void rejectsContentThatDoesNotMatchExtension() {
        assertThrows(BadRequestException.class, () -> service.validate(file("fake.pdf", "<script>".getBytes())));
        assertThrows(BadRequestException.class, () -> service.validate(file("fake.png", PDF)));
        assertThrows(BadRequestException.class, () -> service.validate(file("tiny.pdf", new byte[]{'%'})));
    }

    @Test
    void rejectsEmptyOrMissingFile() {
        assertThrows(BadRequestException.class, () -> service.validate(file("a.pdf", new byte[0])));
        assertThrows(BadRequestException.class, () -> service.validate(null));
    }

    @Test
    void sanitizesTraversalAndOddCharacters() {
        assertEquals("passwd", service.sanitizeFileName("../../etc/passwd"));
        assertEquals("evil.pdf", service.sanitizeFileName("..\\..\\windows\\evil.pdf"));
        assertEquals("my_file_.pdf", service.sanitizeFileName("my file;.pdf"));
        assertEquals("file", service.sanitizeFileName(""));
        assertEquals("file", service.sanitizeFileName(null));
        assertFalse(service.sanitizeFileName(".hidden.pdf").startsWith("."));
        assertTrue(service.sanitizeFileName("a".repeat(300) + ".pdf").length() <= 100);
    }

    @Test
    void sanitizedNameStillValidatesWithTraversalInput() {
        assertEquals("secret.pdf", service.validate(file("../../secret.pdf", PDF)).safeName());
    }

    @Test
    void documentTypeMustBeKnown() {
        assertEquals("AADHAAR", service.validateDocumentType(" aadhaar "));
        assertThrows(BadRequestException.class, () -> service.validateDocumentType("../x"));
        assertThrows(BadRequestException.class, () -> service.validateDocumentType(null));
    }
}
