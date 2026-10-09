package com.schemepredictor.service;

import com.schemepredictor.dto.AuthResponse;
import com.schemepredictor.dto.LoginRequest;
import com.schemepredictor.dto.RegisterRequest;
import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.model.Profile;
import com.schemepredictor.model.User;
import com.schemepredictor.repository.ProfileRepository;
import com.schemepredictor.repository.UserRepository;
import com.schemepredictor.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().toLowerCase())) {
            throw new BadRequestException("An account with this email already exists.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .role("CITIZEN")
                .build();

        user = userRepository.save(user);

        // Create an empty profile shell so the wallet/eligibility flow has something to attach to.
        Profile profile = Profile.builder().userId(user.getId()).build();
        profileRepository.save(profile);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole());
        return toAuthResponse(user, token);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole());
        return toAuthResponse(user, token);
    }

    private AuthResponse toAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }
}
