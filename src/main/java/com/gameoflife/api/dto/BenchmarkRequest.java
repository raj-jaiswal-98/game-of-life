package com.gameoflife.api.dto;

public record BenchmarkRequest(
        Integer generations,
        Integer rows,
        Integer cols
) {
}
