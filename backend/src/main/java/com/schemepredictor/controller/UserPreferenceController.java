package com.schemepredictor.controller;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.User;
import com.schemepredictor.repository.UserRepository;
import com.schemepredictor.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserPreferenceController {

    static final Set<String> LANGUAGES = Set.of("en", "ta", "hi");

    private final UserRepository userRepository;

    @PutMapping("/language")
    public ResponseEntity<Map<String, String>> setLanguage(@RequestBody Map<String, String> body) {
        String language = body.get("language");
        if (language == null || !LANGUAGES.contains(language)) {
            throw new BadRequestException("Unsupported language");
        }
        User user = userRepository.findById(CurrentUser.id())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setLanguage(language);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("language", language));
    }
}
