package com.gameoflife.api.dto;

public record GridSizeRequest(int rows, int cols, Boolean preserveCells) {
    public GridSizeRequest(int rows, int cols) {
        this(rows, cols, Boolean.TRUE);
    }
}
