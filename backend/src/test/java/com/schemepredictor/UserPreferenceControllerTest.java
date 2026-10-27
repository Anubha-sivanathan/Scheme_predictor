package com.schemepredictor;

import com.schemepredictor.controller.UserPreferenceController;
import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.model.User;
import com.schemepredictor.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserPreferenceControllerTest {

    private UserRepository users;
    private UserPreferenceController controller;
    private final User user = User.builder().id("u1").name("A").build();

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        when(users.findById("u1")).thenReturn(Optional.of(user));
        controller = new UserPreferenceController(users);
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken("u1", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void savesSupportedLanguage() {
        controller.setLanguage(Map.of("language", "ta"));
        assertEquals("ta", user.getLanguage());
        verify(users).save(user);
    }

    @Test
    void rejectsUnsupportedOrMissingLanguage() {
        assertThrows(BadRequestException.class, () -> controller.setLanguage(Map.of("language", "fr")));
        assertThrows(BadRequestException.class, () -> controller.setLanguage(Map.of()));
        verify(users, never()).save(any());
    }
}
