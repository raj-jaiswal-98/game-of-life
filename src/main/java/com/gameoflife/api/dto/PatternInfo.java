package com.gameoflife.api.dto;

import com.gameoflife.engine.Patterns;

import java.util.List;

public record PatternInfo(
        String id,
        String name,
        String description,
        List<Patterns.Offset> cells
) {
    public PatternInfo(String id, String name, String description) {
        this(id, name, description, List.of());
    }
}
