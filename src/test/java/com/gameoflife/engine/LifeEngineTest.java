package com.gameoflife.engine;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

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

    private static boolean[][] empty(int rows, int cols) {
        return new boolean[rows][cols];
    }
}
