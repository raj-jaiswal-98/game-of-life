package com.gameoflife.api.dto;

public record GameStateResponse(
        int rows,
        int cols,
        int generation,
        int liveCells,
        boolean[][] cells,
        String engineMode,
        boolean wallMode,
        int boundaryMode
) {
    public GameStateResponse(int rows, int cols, int generation, int liveCells, boolean[][] cells) {
        this(rows, cols, generation, liveCells, cells, "SEQUENTIAL", false, 0);
    }

    public GameStateResponse(int rows, int cols, int generation, int liveCells, boolean[][] cells, String engineMode) {
        this(rows, cols, generation, liveCells, cells, engineMode, false, 0);
    }

    public GameStateResponse(int rows, int cols, int generation, int liveCells, boolean[][] cells, String engineMode, boolean wallMode) {
        this(rows, cols, generation, liveCells, cells, engineMode, wallMode, wallMode ? 1 : 0);
    }
}
