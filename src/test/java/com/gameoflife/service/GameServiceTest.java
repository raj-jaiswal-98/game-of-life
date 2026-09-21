package com.gameoflife.service;

import com.gameoflife.api.dto.GameStateResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameServiceTest {

    private GameService service;

    @BeforeEach
    void setUp() {
        service = new GameService();
        service.clear();
    }

    @Test
    void resizePreservesCellsWhenRequested() {
        service.setCell(5, 5, true);
        service.setCell(10, 10, true);

        // Resize from 42x72 to 128x128 with preserveCells = true
        GameStateResponse response = service.resize(128, 128, true);
        assertEquals(128, response.rows());
        assertEquals(128, response.cols());
        assertTrue(response.cells()[5][5], "Cell (5,5) should be preserved after resize");
        assertTrue(response.cells()[10][10], "Cell (10,10) should be preserved after resize");
        assertEquals(2, response.liveCells());
    }

    @Test
    void wallModeTogglesAndClearsWallBuffer() {
        service.setCell(0, 0, true);
        service.setCell(1, 1, true);
        service.setCell(5, 5, true);

        // Turn on wall mode
        GameStateResponse response = service.setWallMode(true);
        assertTrue(response.wallMode());
        assertFalse(response.cells()[0][0], "Wall buffer (0,0) must be cleared in wall mode");
        assertFalse(response.cells()[1][1], "Wall buffer (1,1) must be cleared in wall mode");
        assertTrue(response.cells()[5][5], "Interior cell (5,5) must remain intact");
    }

    @Test
    void setGridSyncsFullState() {
        boolean[][] custom = new boolean[20][20];
        custom[5][5] = true;
        custom[6][6] = true;

        GameStateResponse response = service.setGrid(20, 20, 42, custom);
        assertEquals(20, response.rows());
        assertEquals(20, response.cols());
        assertEquals(42, response.generation());
        assertTrue(response.cells()[5][5]);
        assertTrue(response.cells()[6][6]);
    }
}
