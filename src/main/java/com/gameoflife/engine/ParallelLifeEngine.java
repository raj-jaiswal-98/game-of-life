package com.gameoflife.engine;

import java.util.stream.IntStream;

/**
 * High-performance multi-threaded LifeEngine for Conway's Game of Life.
 * Divides rows across available CPU cores using Java Parallel Streams / ForkJoinPool,
 * computing B3/S23 rules in parallel with toroidal wrapping.
 */
public final class ParallelLifeEngine {

    private ParallelLifeEngine() {
    }

    /**
     * Computes the next generation in parallel and allocates a new grid.
     */
    public static boolean[][] nextGeneration(boolean[][] grid) {
        int rows = grid.length;
        int cols = grid[0].length;
        boolean[][] next = new boolean[rows][cols];
        nextGeneration(grid, next);
        return next;
    }

    /**
     * In-place double-buffered computation: reads from {@code current} and writes to {@code next}
     * in parallel without any dynamic memory allocations.
     */
    public static void nextGeneration(boolean[][] current, boolean[][] next) {
        int rows = current.length;
        int cols = current[0].length;

        // Parallelize across rows: each thread operates independently on distinct row indices.
        IntStream.range(0, rows).parallel().forEach(r -> {
            boolean[] currRow = current[r];
            boolean[] nextRow = next[r];
            for (int c = 0; c < cols; c++) {
                int neighbors = countNeighbors(current, r, c, rows, cols);
                if (currRow[c]) {
                    nextRow[c] = (neighbors == 2 || neighbors == 3);
                } else {
                    nextRow[c] = (neighbors == 3);
                }
            }
        });
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
     * Counts Moore neighborhood neighbors with toroidal (wrap-around) boundaries.
     */
    static int countNeighbors(boolean[][] grid, int row, int col, int rows, int cols) {
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
