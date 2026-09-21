package com.gameoflife.api.dto;

public record GameStateResponse(
        int rows,
        int cols,
        int generation,
        int liveCells,
        boolean[][] cells,
        String engineMode,
        boolean wallMode
) {
    public GameStateResponse(int rows, int cols, int generation, int liveCells, boolean[][] cells) {
        this(rows, cols, generation, liveCells, cells, "SEQUENTIAL", false);
    }

    public GameStateResponse(int rows, int cols, int generation, int liveCells, boolean[][] cells, String engineMode) {
        this(rows, cols, generation, liveCells, cells, engineMode, false);
    }
}
