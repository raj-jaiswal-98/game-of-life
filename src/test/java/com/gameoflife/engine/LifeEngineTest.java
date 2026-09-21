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

    @Test
    void absorbingWallCausesGliderToShrinkIntoStillLife() {
        int rows = 24;
        int cols = 24;
        boolean[][] grid = empty(rows, cols);

        // Place glider at (15, 15) heading south-east (+r, +c) towards (21, 21)
        grid[15][16] = true;
        grid[16][17] = true;
        grid[17][15] = true;
        grid[17][16] = true;
        grid[17][17] = true;
        assertEquals(5, LifeEngine.countLiveCells(grid));

        // Advance 30 generations in absorbing mode
        for (int i = 0; i < 30; i++) {
            grid = LifeEngine.nextGeneration(grid, LifeEngine.WALL_MODE_ABSORBING);
        }

        // Glider should have hit the absorbing wall and shrunk into 4 cells (still-life Block)
        int finalLive = LifeEngine.countLiveCells(grid);
        assertTrue(finalLive <= 4, "Absorbing wall should cause glider to shrink to <= 4 cells, got: " + finalLive);
    }

    @Test
    void elasticWallBouncesGliderPreservingAllFiveCells() {
        int rows = 36;
        int cols = 36;
        boolean[][] grid = empty(rows, cols);

        // Place glider at (4, 4) heading south-east
        grid[4][5] = true;
        grid[5][6] = true;
        grid[6][4] = true;
        grid[6][5] = true;
        grid[6][6] = true;
        assertEquals(5, LifeEngine.countLiveCells(grid));

        // Advance through multiple bounces in elastic mode
        for (int i = 0; i < 150; i++) {
            grid = LifeEngine.nextGeneration(grid, LifeEngine.WALL_MODE_ELASTIC);
        }

        // Glider must maintain all 5 cells after bouncing cleanly off walls
        int finalLive = LifeEngine.countLiveCells(grid);
        assertEquals(5, finalLive, "Elastic wall must preserve all 5 cells of the glider after wall bounces");

        // Verify ParallelLifeEngine matches LifeEngine in elastic mode
        boolean[][] seqNext = LifeEngine.nextGeneration(grid, LifeEngine.WALL_MODE_ELASTIC);
        boolean[][] parNext = ParallelLifeEngine.nextGeneration(grid, LifeEngine.WALL_MODE_ELASTIC);
        assertArrayEquals(seqNext, parNext, "Parallel and sequential engines must produce identical elastic bounce results");
    }

    private static boolean[][] empty(int rows, int cols) {
        return new boolean[rows][cols];
    }
}
