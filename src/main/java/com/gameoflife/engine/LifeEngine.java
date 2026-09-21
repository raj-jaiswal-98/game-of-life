package com.gameoflife.engine;

public final class LifeEngine {

    private LifeEngine() {
    }

    public static boolean[][] nextGeneration(boolean[][] grid) {
        int rows = grid.length;
        int cols = grid[0].length;
        boolean[][] next = new boolean[rows][cols];
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                int neighbors = countNeighbors(grid, r, c);
                if (grid[r][c]) {
                    next[r][c] = neighbors == 2 || neighbors == 3;
                } else {
                    next[r][c] = neighbors == 3;
                }
            }
        }
        return next;
    }

    public static int countLiveCells(boolean[][] grid) {
        int live = 0;
        for (boolean[] row : grid) {
            for (boolean cell : row) {
                if (cell) {
                    live++;
                }
            }
        }
        return live;
    }

    static int countNeighbors(boolean[][] grid, int row, int col) {
        int rows = grid.length;
        int cols = grid[0].length;
        int count = 0;
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) {
                    continue;
                }
                int nr = Math.floorMod(row + dr, rows);
                int nc = Math.floorMod(col + dc, cols);
                if (grid[nr][nc]) {
                    count++;
                }
            }
        }
        return count;
    }
}
