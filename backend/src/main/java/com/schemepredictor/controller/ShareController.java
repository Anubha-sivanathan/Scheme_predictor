package com.schemepredictor.controller;

import com.schemepredictor.model.DocumentVersion;
import com.schemepredictor.model.ShareLink;
import com.schemepredictor.service.ShareService;
import com.schemepredictor.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Public (token-authenticated) side of document sharing. No JWT is required or consulted. */
@RestController
@RequestMapping("/api/share")
@RequiredArgsConstructor
public class ShareController {

    private final ShareService shareService;
    private final WalletService walletService;

    /** Metadata only: the recipient sees what they were given, never owner or document fields. */
    @GetMapping("/{token}")
    public ResponseEntity<Map<String, Object>> info(@PathVariable String token) {
        ShareService.ShareAccess access = shareService.inspect(token);
        DocumentVersion v = walletService.currentVersion(access.document());
        return noStore(ResponseEntity.ok()).body(Map.of(
                "fileName", String.valueOf(v.getFileName()),
                "contentType", String.valueOf(v.getContentType()),
                "permission", access.link().getPermission(),
                "expiresAt", access.link().getExpiresAt().toString()));
    }

    /** Inline rendering. Allowed for both VIEW and DOWNLOAD links. */
    @GetMapping("/{token}/view")
    public ResponseEntity<Resource> view(@PathVariable String token) {
        return stream(shareService.resolve(token, false), false);
    }

    /** Attachment download. Only for DOWNLOAD links. */
    @GetMapping("/{token}/download")
    public ResponseEntity<Resource> download(@PathVariable String token) {
        return stream(shareService.resolve(token, true), true);
    }

    private ResponseEntity<Resource> stream(ShareService.ShareAccess access, boolean attachment) {
        DocumentVersion v = walletService.currentVersion(access.document());
        Resource body = new FileSystemResource(walletService.fileOf(v));
        ContentDisposition disposition = (attachment ? ContentDisposition.attachment() : ContentDisposition.inline())
                .filename(v.getFileName() == null ? "document" : v.getFileName())
                .build();
        return noStore(ResponseEntity.ok())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(
                        v.getContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : v.getContentType()))
                .body(body);
    }

    private static ResponseEntity.BodyBuilder noStore(ResponseEntity.BodyBuilder builder) {
        return builder.cacheControl(CacheControl.noStore()).header(HttpHeaders.PRAGMA, "no-cache");
    }
}
