package com.gameoflife.api.dto;

public record GameStateResponse(
        int rows,
        int cols,
        int generation,
        int liveCells,
        boolean[][] cells,
        String engineMode
) {
    public GameStateResponse(int rows, int cols, int generation, int liveCells, boolean[][] cells) {
        this(rows, cols, generation, liveCells, cells, "SEQUENTIAL");
    }
}
