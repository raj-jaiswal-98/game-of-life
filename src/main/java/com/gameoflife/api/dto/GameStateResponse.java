package com.gameoflife.api.dto;

public record GameStateResponse(
        int rows,
        int cols,
        int generation,
        int liveCells,
        boolean[][] cells
) {
}
