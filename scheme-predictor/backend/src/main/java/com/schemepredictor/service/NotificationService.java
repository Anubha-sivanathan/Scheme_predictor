package com.schemepredictor.service;

import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.Notification;
import com.schemepredictor.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public List<Notification> list(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public long unreadCount(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    public void markAsRead(String userId, String notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (!n.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Notification not found");
        }
        n.setRead(true);
        notificationRepository.save(n);
    }

    public void delete(String userId, String notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (!n.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Notification not found");
        }
        notificationRepository.deleteById(notificationId);
    }

    public Notification create(String userId, String type, String message, String relatedSchemeId) {
        Notification n = Notification.builder()
                .userId(userId)
                .type(type)
                .message(message)
                .relatedSchemeId(relatedSchemeId)
                .read(false)
                .createdAt(Instant.now())
                .build();
        return notificationRepository.save(n);
    }

    /** Called by a scheduled job (or manually) to notify users of approaching deadlines. */
    public void notifyDeadlineApproaching(String userId, String schemeName, String schemeId, long daysRemaining) {
        create(userId, "DEADLINE_APPROACHING",
                "The application deadline for " + schemeName + " is approaching (" + daysRemaining + " days remaining).",
                schemeId);
    }
}
