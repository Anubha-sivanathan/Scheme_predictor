package com.schemepredictor.controller;

import com.schemepredictor.dto.AuthResponse;
import com.schemepredictor.dto.LoginRequest;
import com.schemepredictor.dto.RegisterRequest;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.User;
import com.schemepredictor.repository.UserRepository;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        String userId = CurrentUser.id();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "role", user.getRole(),
                "profileImage", user.getProfileImage() == null ? "" : user.getProfileImage()
        ));
    }
}
