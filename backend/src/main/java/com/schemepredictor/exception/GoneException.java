package com.schemepredictor.exception;

/** The resource existed but is no longer available (expired or revoked share link). */
public class GoneException extends RuntimeException {
    public GoneException(String message) {
        super(message);
    }
}
