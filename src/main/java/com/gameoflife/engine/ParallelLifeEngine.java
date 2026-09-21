package com.gameoflife.engine;

import java.util.stream.IntStream;

/**
 * High-performance multi-threaded LifeEngine for Conway's Game of Life.
 * Divides rows across available CPU cores using Java Parallel Streams / ForkJoinPool,
 * computing B3/S23 rules in parallel with toroidal wrapping or 2-width wall collision buffer.
 */
public final class ParallelLifeEngine {

    public static final int WALL_WIDTH = 2;

    private ParallelLifeEngine() {
    }

    /**
     * Computes the next generation in parallel and allocates a new grid.
     */
    public static boolean[][] nextGeneration(boolean[][] grid) {
        return nextGeneration(grid, LifeEngine.WALL_MODE_TORUS);
    }

    public static boolean[][] nextGeneration(boolean[][] grid, boolean wallMode) {
        return nextGeneration(grid, wallMode ? LifeEngine.WALL_MODE_ABSORBING : LifeEngine.WALL_MODE_TORUS);
    }

    public static boolean[][] nextGeneration(boolean[][] grid, int wallMode) {
        int rows = grid.length;
        int cols = grid[0].length;
        boolean[][] next = new boolean[rows][cols];
        nextGeneration(grid, next, wallMode);
        return next;
    }

    /**
     * In-place double-buffered computation: reads from {@code current} and writes to {@code next}
     * in parallel without any dynamic memory allocations.
     */
    public static void nextGeneration(boolean[][] current, boolean[][] next) {
        nextGeneration(current, next, LifeEngine.WALL_MODE_TORUS);
    }

    public static void nextGeneration(boolean[][] current, boolean[][] next, boolean wallMode) {
        nextGeneration(current, next, wallMode ? LifeEngine.WALL_MODE_ABSORBING : LifeEngine.WALL_MODE_TORUS);
    }

    public static void nextGeneration(boolean[][] current, boolean[][] next, int wallMode) {
        int rows = current.length;
        int cols = current[0].length;
        boolean isWallBoundary = wallMode == LifeEngine.WALL_MODE_ABSORBING || wallMode == LifeEngine.WALL_MODE_ELASTIC;

        // Parallelize across rows: each thread operates independently on distinct row indices.
        IntStream.range(0, rows).parallel().forEach(r -> {
            boolean[] currRow = current[r];
            boolean[] nextRow = next[r];
            for (int c = 0; c < cols; c++) {
                if (wallMode == LifeEngine.WALL_MODE_ABSORBING && LifeEngine.isWall(r, c, rows, cols)) {
                    nextRow[c] = false;
                    continue;
                }
                int neighbors = countNeighbors(current, r, c, rows, cols, isWallBoundary);
                if (currRow[c]) {
                    nextRow[c] = (neighbors == 2 || neighbors == 3);
                } else {
                    nextRow[c] = (neighbors == 3);
                }
            }
        });

        if (wallMode == LifeEngine.WALL_MODE_ELASTIC) {
            LifeEngine.applyElasticBounce(next, rows, cols);
        }
    }

    /**
     * Counts live cells using parallel reduction for large grids.
     */
    public static int countLiveCells(boolean[][] grid) {
        return IntStream.range(0, grid.length).parallel().map(r -> {
            int count = 0;
            for (boolean cell : grid[r]) {
                if (cell) count++;
            }
            return count;
        }).sum();
    }

    /**
     * Counts Moore neighborhood neighbors with toroidal (wrap-around) boundaries or 2-width wall collision buffer.
     */
    static int countNeighbors(boolean[][] grid, int row, int col, int rows, int cols) {
        return countNeighbors(grid, row, col, rows, cols, false);
    }

    static int countNeighbors(boolean[][] grid, int row, int col, int rows, int cols, boolean wallMode) {
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
                    if (LifeEngine.isWall(nr, nc, rows, cols)) {
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
