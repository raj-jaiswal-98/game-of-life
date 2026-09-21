package com.gameoflife.engine;

import org.junit.jupiter.api.Test;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ParallelLifeEngineTest {

    @Test
    void blockIsStillLife() {
        boolean[][] grid = empty(6, 6);
        grid[2][2] = true;
        grid[2][3] = true;
        grid[3][2] = true;
        grid[3][3] = true;

        boolean[][] next = ParallelLifeEngine.nextGeneration(grid);
        assertArrayEquals(grid, next);
    }

    @Test
    void blinkerOscillates() {
        boolean[][] horizontal = empty(5, 5);
        horizontal[2][1] = true;
        horizontal[2][2] = true;
        horizontal[2][3] = true;

        boolean[][] vertical = ParallelLifeEngine.nextGeneration(horizontal);
        assertEquals(true, vertical[1][2]);
        assertEquals(true, vertical[2][2]);
        assertEquals(true, vertical[3][2]);
        assertEquals(false, vertical[2][1]);
        assertEquals(false, vertical[2][3]);

        boolean[][] back = ParallelLifeEngine.nextGeneration(vertical);
        assertArrayEquals(horizontal, back);
    }

    @Test
    void deadCellWithThreeNeighborsIsBorn() {
        boolean[][] grid = empty(3, 3);
        grid[0][0] = true;
        grid[0][1] = true;
        grid[1][0] = true;

        boolean[][] next = ParallelLifeEngine.nextGeneration(grid);
        assertEquals(true, next[1][1]);
    }

    @Test
    void parityWithSequentialEngineAcrossMultipleGenerations() {
        int rows = 64;
        int cols = 64;
        boolean[][] gridSequential = new boolean[rows][cols];
        boolean[][] gridParallel = new boolean[rows][cols];

        Random random = new Random(42);
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                boolean val = random.nextDouble() < 0.3;
                gridSequential[r][c] = val;
                gridParallel[r][c] = val;
            }
        }

        for (int gen = 0; gen < 25; gen++) {
            gridSequential = LifeEngine.nextGeneration(gridSequential);
            gridParallel = ParallelLifeEngine.nextGeneration(gridParallel);

            for (int r = 0; r < rows; r++) {
                assertArrayEquals(gridSequential[r], gridParallel[r], "Mismatch at gen " + gen + ", row " + r);
            }
            assertEquals(LifeEngine.countLiveCells(gridSequential), ParallelLifeEngine.countLiveCells(gridParallel));
        }
    }

    private static boolean[][] empty(int rows, int cols) {
        return new boolean[rows][cols];
    }
}
