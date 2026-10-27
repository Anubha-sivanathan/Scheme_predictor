package com.schemepredictor;

import com.schemepredictor.security.ShareRateLimitFilter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class ShareRateLimitFilterTest {

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final ShareRateLimitFilter filter = new ShareRateLimitFilter(clock, 3);

    private MockHttpServletResponse call(String uri, String ip) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        req.setRequestURI(uri);
        req.setRemoteAddr(ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(req, res, chain);
        if (chain.getRequest() == null && res.getStatus() == 200) res.setStatus(599); // chain not reached
        return res;
    }

    @Test
    void allowsUpToTheLimitThenReturns429WithRetryAfter() throws Exception {
        for (int i = 0; i < 3; i++) assertEquals(200, call("/api/share/tok", "1.1.1.1").getStatus());
        MockHttpServletResponse blocked = call("/api/share/tok", "1.1.1.1");
        assertEquals(429, blocked.getStatus());
        assertNotNull(blocked.getHeader("Retry-After"));
        assertTrue(Long.parseLong(blocked.getHeader("Retry-After")) >= 1);
    }

    @Test
    void limitsAreTrackedPerClient() throws Exception {
        for (int i = 0; i < 3; i++) call("/api/share/tok", "1.1.1.1");
        assertEquals(429, call("/api/share/tok", "1.1.1.1").getStatus());
        assertEquals(200, call("/api/share/tok", "2.2.2.2").getStatus());
    }

    @Test
    void windowResetsAfterAMinute() throws Exception {
        for (int i = 0; i < 3; i++) call("/api/share/tok", "1.1.1.1");
        assertEquals(429, call("/api/share/tok", "1.1.1.1").getStatus());
        clock.now = clock.now.plus(Duration.ofMinutes(1));
        assertEquals(200, call("/api/share/tok", "1.1.1.1").getStatus());
    }

    @Test
    void otherEndpointsAreNotThrottled() throws Exception {
        for (int i = 0; i < 10; i++) assertEquals(200, call("/api/schemes", "1.1.1.1").getStatus());
    }
}
