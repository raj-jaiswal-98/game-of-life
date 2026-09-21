package com.gameoflife.api.dto;

public record BenchmarkResponse(
        int generations,
        int rows,
        int cols,
        int totalCells,
        int availableProcessors,
        long sequentialDurationMs,
        long parallelDurationMs,
        double sequentialGps,
        double parallelGps,
        double speedupFactor
) {
}
