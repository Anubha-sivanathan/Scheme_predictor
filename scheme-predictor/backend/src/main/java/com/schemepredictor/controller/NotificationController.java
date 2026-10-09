package com.schemepredictor.controller;

import com.schemepredictor.model.Notification;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        String userId = CurrentUser.id();
        List<Notification> notifications = notificationService.list(userId);
        long unread = notificationService.unreadCount(userId);
        return ResponseEntity.ok(Map.of("notifications", notifications, "unreadCount", unread));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable String id) {
        notificationService.markAsRead(CurrentUser.id(), id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        notificationService.delete(CurrentUser.id(), id);
        return ResponseEntity.ok().build();
    }
}
