package com.gameoflife.service;

import com.gameoflife.api.dto.GameStateResponse;
import com.gameoflife.engine.LifeEngine;
import com.gameoflife.engine.Patterns;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.concurrent.ThreadLocalRandom;

@Service
public class GameService {

    public static final int DEFAULT_ROWS = 42;
    public static final int DEFAULT_COLS = 72;
    public static final int MIN_SIZE = 10;
    public static final int MAX_SIZE = 120;

    private final Object lock = new Object();
    private boolean[][] cells;
    private int generation;

    public GameService() {
        reset(DEFAULT_ROWS, DEFAULT_COLS);
    }

    public GameStateResponse snapshot() {
        synchronized (lock) {
            return toResponse();
        }
    }

    public GameStateResponse reset(int rows, int cols) {
        validateSize(rows, cols);
        synchronized (lock) {
            cells = new boolean[rows][cols];
            generation = 0;
            return toResponse();
        }
    }

    public GameStateResponse clear() {
        synchronized (lock) {
            cells = new boolean[cells.length][cells[0].length];
            generation = 0;
            return toResponse();
        }
    }

    public GameStateResponse toggle(int row, int col) {
        synchronized (lock) {
            assertInBounds(row, col);
            cells[row][col] = !cells[row][col];
            return toResponse();
        }
    }

    public GameStateResponse setCell(int row, int col, boolean alive) {
        synchronized (lock) {
            assertInBounds(row, col);
            cells[row][col] = alive;
            return toResponse();
        }
    }

    public GameStateResponse step() {
        synchronized (lock) {
            cells = LifeEngine.nextGeneration(cells);
            generation++;
            return toResponse();
        }
    }

    public GameStateResponse randomize(double density) {
        if (density < 0 || density > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "density must be between 0 and 1");
        }
        synchronized (lock) {
            ThreadLocalRandom random = ThreadLocalRandom.current();
            for (int r = 0; r < cells.length; r++) {
                for (int c = 0; c < cells[r].length; c++) {
                    cells[r][c] = random.nextDouble() < density;
                }
            }
            generation = 0;
            return toResponse();
        }
    }

    public GameStateResponse stampPattern(String id, int originRow, int originCol) {
        Patterns.Pattern pattern = Patterns.get(id);
        if (pattern == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown pattern: " + id);
        }
        synchronized (lock) {
            int rows = cells.length;
            int cols = cells[0].length;
            for (Patterns.Offset offset : pattern.cells()) {
                int r = Math.floorMod(originRow + offset.row(), rows);
                int c = Math.floorMod(originCol + offset.col(), cols);
                cells[r][c] = true;
            }
            return toResponse();
        }
    }

    private void validateSize(int rows, int cols) {
        if (rows < MIN_SIZE || cols < MIN_SIZE || rows > MAX_SIZE || cols > MAX_SIZE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Grid size must be between " + MIN_SIZE + " and " + MAX_SIZE
            );
        }
    }

    private void assertInBounds(int row, int col) {
        if (row < 0 || col < 0 || row >= cells.length || col >= cells[0].length) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cell is outside the grid");
        }
    }

    private GameStateResponse toResponse() {
        int rows = cells.length;
        int cols = cells[0].length;
        boolean[][] copy = new boolean[rows][cols];
        for (int r = 0; r < rows; r++) {
            System.arraycopy(cells[r], 0, copy[r], 0, cols);
        }
        return new GameStateResponse(rows, cols, generation, LifeEngine.countLiveCells(cells), copy);
    }
}
