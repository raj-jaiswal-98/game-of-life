package com.gameoflife.engine;

public final class LifeEngine {

    public static final int WALL_WIDTH = 2;

    private LifeEngine() {
    }

    public static boolean[][] nextGeneration(boolean[][] grid) {
        return nextGeneration(grid, false);
    }

    public static boolean[][] nextGeneration(boolean[][] grid, boolean wallMode) {
        int rows = grid.length;
        int cols = grid[0].length;
        boolean[][] next = new boolean[rows][cols];
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                if (wallMode && isWall(r, c, rows, cols)) {
                    next[r][c] = false;
                    continue;
                }
                int neighbors = countNeighbors(grid, r, c, wallMode);
                if (grid[r][c]) {
                    next[r][c] = neighbors == 2 || neighbors == 3;
                } else {
                    next[r][c] = neighbors == 3;
                }
            }
        }
        return next;
    }

    public static boolean isWall(int r, int c, int rows, int cols) {
        return r < WALL_WIDTH || r >= rows - WALL_WIDTH || c < WALL_WIDTH || c >= cols - WALL_WIDTH;
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
        return countNeighbors(grid, row, col, false);
    }

    static int countNeighbors(boolean[][] grid, int row, int col, boolean wallMode) {
        int rows = grid.length;
        int cols = grid[0].length;
        int count = 0;
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) {
                    continue;
                }
                int nr = row + dr;
                int nc = col + dc;
                if (wallMode) {
                    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                        continue;
                    }
                    if (isWall(nr, nc, rows, cols)) {
                        continue;
                    }
                } else {
                    nr = Math.floorMod(nr, rows);
                    nc = Math.floorMod(nc, cols);
                }
                if (grid[nr][nc]) {
                    count++;
                }
            }
        }
        return count;
    }
}
