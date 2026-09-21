package com.gameoflife.api.dto;

public record GridSyncRequest(
        int rows,
        int cols,
        Integer generation,
        boolean[][] cells
) {
}
