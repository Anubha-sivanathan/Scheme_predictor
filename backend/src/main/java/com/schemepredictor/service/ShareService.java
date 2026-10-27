package com.schemepredictor.service;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.exception.ForbiddenException;
import com.schemepredictor.exception.GoneException;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.ShareAccessEvent;
import com.schemepredictor.model.ShareLink;
import com.schemepredictor.repository.DocumentRepository;
import com.schemepredictor.repository.ShareAccessEventRepository;
import com.schemepredictor.repository.ShareLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ShareService {

    public static final int DEFAULT_EXPIRY_HOURS = 24;
    public static final int MAX_EXPIRY_HOURS = 24 * 7;

    /** Never shareable unless app.share.allow-sensitive is switched on. */
    private static final Set<String> BLOCKED_TYPES = Set.of("AADHAAR");
    /** Shareable only after the owner explicitly acknowledges the risk. */
    private static final Set<String> RISKY_TYPES = Set.of(
            "INCOME_CERTIFICATE", "CASTE_CERTIFICATE", "DISABILITY", "LAND", "RESIDENCE_CERTIFICATE",
            "RATION_CARD", "BANK_PASSBOOK", "EMPLOYMENT");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final DocumentRepository documentRepository;
    private final ShareLinkRepository shareLinkRepository;
    private final ShareAccessEventRepository eventRepository;
    private final Clock clock;

    @Value("${app.share.allow-sensitive:false}")
    private boolean allowSensitive;

    /** Result of creating a link; the raw token exists only here. */
    public record CreatedShare(ShareLink link, String token) {}

    public record ShareAccess(ShareLink link, DocumentRecord document) {}

    public CreatedShare create(String userId, String documentId, String permission, Integer expiresInHours,
                               boolean acknowledgeRisk) {
        DocumentRecord doc = ownedDocument(userId, documentId);
        String type = doc.getDocumentType() == null ? "" : doc.getDocumentType().toUpperCase(Locale.ROOT);

        if (BLOCKED_TYPES.contains(type) && !allowSensitive) {
            throw new ForbiddenException("Aadhaar documents cannot be shared.");
        }
        if ((RISKY_TYPES.contains(type) || BLOCKED_TYPES.contains(type)) && !acknowledgeRisk) {
            throw new BadRequestException("You must acknowledge the sharing risks for this document type.");
        }

        String perm = permission == null ? ShareLink.VIEW : permission.toUpperCase(Locale.ROOT);
        if (!perm.equals(ShareLink.VIEW) && !perm.equals(ShareLink.DOWNLOAD)) {
            throw new BadRequestException("Permission must be VIEW or DOWNLOAD");
        }
        int hours = expiresInHours == null ? DEFAULT_EXPIRY_HOURS : expiresInHours;
        if (hours < 1 || hours > MAX_EXPIRY_HOURS) {
            throw new BadRequestException("Expiry must be between 1 and " + MAX_EXPIRY_HOURS + " hours");
        }

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        Instant now = clock.instant();
        ShareLink link = shareLinkRepository.save(ShareLink.builder()
                .documentId(documentId)
                .ownerId(userId)
                .tokenHash(hash(token))
                .permission(perm)
                .createdAt(now)
                .expiresAt(now.plus(Duration.ofHours(hours)))
                .build());
        return new CreatedShare(link, token);
    }

    public List<ShareLink> list(String userId, String documentId) {
        ownedDocument(userId, documentId);
        return shareLinkRepository.findByDocumentIdAndOwnerId(documentId, userId);
    }

    public ShareLink revoke(String userId, String documentId, String shareId) {
        ownedDocument(userId, documentId);
        ShareLink link = ownedLink(userId, documentId, shareId);
        if (link.getRevokedAt() == null) {
            link.setRevokedAt(clock.instant());
            link = shareLinkRepository.save(link);
        }
        return link;
    }

    public List<ShareAccessEvent> events(String userId, String documentId, String shareId) {
        ownedDocument(userId, documentId);
        ownedLink(userId, documentId, shareId);
        return eventRepository.findByShareIdOrderByAtDesc(shareId);
    }

    /** Called when a document is deleted so no live link can outlive it. */
    public void deleteAllForDocument(String documentId) {
        for (ShareLink link : shareLinkRepository.findByDocumentId(documentId)) {
            eventRepository.deleteByShareId(link.getId());
            shareLinkRepository.delete(link);
        }
    }

    /**
     * Validates a public token for the requested access mode and records the outcome.
     * Unknown tokens are 404; known-but-dead links are 410.
     */
    public ShareAccess resolve(String token, boolean download) {
        return check(token, download, true);
    }

    /** Same checks as {@link #resolve}, but a successful metadata lookup is not logged as an access. */
    public ShareAccess inspect(String token) {
        return check(token, false, false);
    }

    private ShareAccess check(String token, boolean download, boolean auditSuccess) {
        ShareLink link = shareLinkRepository.findByTokenHash(hash(token == null ? "" : token))
                .orElseThrow(() -> new ResourceNotFoundException("Share link not found"));

        if (link.getRevokedAt() != null) {
            record(link, ShareAccessEvent.DENIED_REVOKED);
            throw new GoneException("This share link has been revoked.");
        }
        if (!clock.instant().isBefore(link.getExpiresAt())) {
            record(link, ShareAccessEvent.DENIED_EXPIRED);
            throw new GoneException("This share link has expired.");
        }
        if (download && !ShareLink.DOWNLOAD.equals(link.getPermission())) {
            record(link, ShareAccessEvent.DENIED_PERMISSION);
            throw new ForbiddenException("This link does not allow downloading.");
        }

        DocumentRecord doc = documentRepository.findById(link.getDocumentId())
                .orElseThrow(() -> new ResourceNotFoundException("Share link not found"));
        if (auditSuccess) {
            record(link, download ? ShareAccessEvent.DOWNLOADED : ShareAccessEvent.VIEWED);
        }
        return new ShareAccess(link, doc);
    }

    private void record(ShareLink link, String outcome) {
        eventRepository.save(ShareAccessEvent.builder()
                .shareId(link.getId())
                .outcome(outcome)
                .at(clock.instant())
                .build());
    }

    private ShareLink ownedLink(String userId, String documentId, String shareId) {
        return shareLinkRepository.findById(shareId)
                .filter(l -> userId.equals(l.getOwnerId()) && documentId.equals(l.getDocumentId()))
                .orElseThrow(() -> new ResourceNotFoundException("Share link not found"));
    }

    private DocumentRecord ownedDocument(String userId, String documentId) {
        DocumentRecord doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
        if (!userId.equals(doc.getUserId())) {
            throw new ResourceNotFoundException("Document not found");
        }
        return doc;
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
