package com.gameoflife.engine;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LifeEngineTest {

    @Test
    void blockIsStillLife() {
        boolean[][] grid = empty(6, 6);
        grid[2][2] = true;
        grid[2][3] = true;
        grid[3][2] = true;
        grid[3][3] = true;

        boolean[][] next = LifeEngine.nextGeneration(grid);
        assertArrayEquals(grid, next);
    }

    @Test
    void blinkerOscillates() {
        boolean[][] horizontal = empty(5, 5);
        horizontal[2][1] = true;
        horizontal[2][2] = true;
        horizontal[2][3] = true;

        boolean[][] vertical = LifeEngine.nextGeneration(horizontal);
        assertEquals(true, vertical[1][2]);
        assertEquals(true, vertical[2][2]);
        assertEquals(true, vertical[3][2]);
        assertEquals(false, vertical[2][1]);
        assertEquals(false, vertical[2][3]);

        boolean[][] back = LifeEngine.nextGeneration(vertical);
        assertArrayEquals(horizontal, back);
    }

    @Test
    void deadCellWithThreeNeighborsIsBorn() {
        boolean[][] grid = empty(3, 3);
        grid[0][0] = true;
        grid[0][1] = true;
        grid[1][0] = true;

        boolean[][] next = LifeEngine.nextGeneration(grid);
        assertEquals(true, next[1][1]);
    }

    @Test
    void wallBufferLayerNeverGrowsLiveCells() {
        int rows = 10;
        int cols = 10;
        boolean[][] grid = empty(rows, cols);
        // Put 3 live cells right against the inner boundary at row 2
        grid[2][2] = true;
        grid[2][3] = true;
        grid[3][2] = true;

        // In wallMode, row 1 (which is part of the 2-cell buffer layer 0..1) must NEVER be born
        boolean[][] next = LifeEngine.nextGeneration(grid, true);
        assertFalse(next[1][2], "Buffer layer row 1 should stay dead in wall mode");
        assertFalse(next[1][3], "Buffer layer row 1 should stay dead in wall mode");
        assertFalse(next[0][2], "Buffer layer row 0 should stay dead in wall mode");
    }

    @Test
    void wallCollisionPreventsToroidalWrapping() {
        int rows = 10;
        int cols = 10;
        boolean[][] grid = empty(rows, cols);
        // Place cells at top-left edge of interior
        grid[2][2] = true;
        grid[2][3] = true;
        grid[3][2] = true;

        // In non-wall (torus) mode, cells at row 2 and col 2 would wrap neighbors to bottom/right
        // In wall mode, no wrapping occurs across boundaries
        boolean[][] nextWall = LifeEngine.nextGeneration(grid, true);
        assertFalse(nextWall[rows - 1][cols - 1], "Wall mode must prevent toroidal wrap-around");
        assertFalse(nextWall[rows - 2][cols - 2], "Wall mode must prevent toroidal wrap-around");

        // Verify parallel engine produces exact same output in wall mode
        boolean[][] nextPar = ParallelLifeEngine.nextGeneration(grid, true);
        assertArrayEquals(nextWall, nextPar);
    }

    private static boolean[][] empty(int rows, int cols) {
        return new boolean[rows][cols];
    }
}
