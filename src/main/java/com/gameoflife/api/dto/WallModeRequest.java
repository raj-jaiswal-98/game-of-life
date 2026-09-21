package com.gameoflife.api.dto;

public record WallModeRequest(Boolean enabled, Integer mode) {
    public int resolveMode() {
        if (mode != null) {
            return mode;
        }
        return (enabled != null && Boolean.TRUE.equals(enabled)) ? 1 : 0;
    }
}
