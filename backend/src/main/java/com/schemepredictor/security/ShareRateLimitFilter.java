package com.schemepredictor.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window, per-client limiter for the public /api/share/** endpoints, to slow token guessing and
 * bulk downloading. State is in memory, so with several backend instances each enforces its own limit.
 * The client is identified by the servlet remote address; behind a reverse proxy set
 * server.forward-headers-strategy=framework so that address is the real client, not the proxy.
 */
@Component
public class ShareRateLimitFilter extends OncePerRequestFilter {

    static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final Clock clock;
    private final int limitPerWindow;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        final Instant start;
        int count;

        Window(Instant start) {
            this.start = start;
        }
    }

    public ShareRateLimitFilter(Clock clock,
                                @Value("${app.share.rate-limit-per-minute:30}") int limitPerWindow) {
        this.clock = clock;
        this.limitPerWindow = limitPerWindow;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/share/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long retryAfter = tryAcquire(request.getRemoteAddr());
        if (retryAfter > 0) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":429,\"message\":\"Too many requests. Please try again shortly.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    /** Returns 0 if the request may proceed, otherwise the seconds until the client's window resets. */
    long tryAcquire(String client) {
        Instant now = clock.instant();
        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.values().removeIf(w -> !now.isBefore(w.start.plus(WINDOW)));
        }
        Window w = windows.compute(client, (k, existing) ->
                existing == null || !now.isBefore(existing.start.plus(WINDOW)) ? new Window(now) : existing);
        synchronized (w) {
            if (w.count >= limitPerWindow) {
                return Math.max(1, Duration.between(now, w.start.plus(WINDOW)).toSeconds());
            }
            w.count++;
            return 0;
        }
    }
}
