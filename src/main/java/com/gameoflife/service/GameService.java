package com.gameoflife.service;

import com.gameoflife.api.dto.BenchmarkRequest;
import com.gameoflife.api.dto.BenchmarkResponse;
import com.gameoflife.api.dto.GameStateResponse;
import com.gameoflife.engine.LifeEngine;
import com.gameoflife.engine.ParallelLifeEngine;
import com.gameoflife.engine.Patterns;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class GameService {

    public static final int DEFAULT_ROWS = 42;
    public static final int DEFAULT_COLS = 72;
    public static final int MIN_SIZE = 10;
    public static final int MAX_SIZE = 8192;

    private final Object lock = new Object();
    private boolean[][] cells;
    private int generation;
    private String engineMode = "PARALLEL";
    private int boundaryMode = LifeEngine.WALL_MODE_ELASTIC;

    public GameService() {
        reset(DEFAULT_ROWS, DEFAULT_COLS);
    }

    public GameStateResponse snapshot() {
        synchronized (lock) {
            return toResponse();
        }
    }

    public GameStateResponse setEngineMode(String mode) {
        if (mode == null || (!mode.equalsIgnoreCase("SEQUENTIAL") && !mode.equalsIgnoreCase("PARALLEL"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Engine mode must be SEQUENTIAL or PARALLEL");
        }
        synchronized (lock) {
            this.engineMode = mode.toUpperCase();
            return toResponse();
        }
    }

    public String getEngineMode() {
        synchronized (lock) {
            return engineMode;
        }
    }

    public GameStateResponse setWallMode(boolean enabled) {
        return setBoundaryMode(enabled ? LifeEngine.WALL_MODE_ABSORBING : LifeEngine.WALL_MODE_TORUS);
    }

    public GameStateResponse setBoundaryMode(int mode) {
        synchronized (lock) {
            this.boundaryMode = (mode < 0 || mode > 2) ? LifeEngine.WALL_MODE_TORUS : mode;
            if (boundaryMode == LifeEngine.WALL_MODE_ABSORBING && cells != null) {
                int rows = cells.length;
                int cols = cells[0].length;
                for (int r = 0; r < rows; r++) {
                    for (int c = 0; c < cols; c++) {
                        if (LifeEngine.isWall(r, c, rows, cols)) {
                            cells[r][c] = false;
                        }
                    }
                }
            }
            return toResponse();
        }
    }

    public boolean isWallMode() {
        synchronized (lock) {
            return boundaryMode != LifeEngine.WALL_MODE_TORUS;
        }
    }

    public int getBoundaryMode() {
        synchronized (lock) {
            return boundaryMode;
        }
    }

    public GameStateResponse reset(int rows, int cols) {
        return resize(rows, cols, false);
    }

    public GameStateResponse resize(int rows, int cols, boolean preserveCells) {
        validateSize(rows, cols);
        synchronized (lock) {
            boolean[][] newCells = new boolean[rows][cols];
            if (preserveCells && cells != null) {
                int copyRows = Math.min(cells.length, rows);
                int copyCols = Math.min(cells[0].length, cols);
                for (int r = 0; r < copyRows; r++) {
                    System.arraycopy(cells[r], 0, newCells[r], 0, copyCols);
                }
            } else {
                generation = 0;
            }
            cells = newCells;
            if (boundaryMode == LifeEngine.WALL_MODE_ABSORBING) {
                for (int r = 0; r < rows; r++) {
                    for (int c = 0; c < cols; c++) {
                        if (LifeEngine.isWall(r, c, rows, cols)) {
                            cells[r][c] = false;
                        }
                    }
                }
            }
            return toResponse();
        }
    }

    public GameStateResponse setGrid(int rows, int cols, Integer gen, boolean[][] newCells) {
        validateSize(rows, cols);
        synchronized (lock) {
            cells = new boolean[rows][cols];
            if (newCells != null) {
                int rLimit = Math.min(rows, newCells.length);
                for (int r = 0; r < rLimit; r++) {
                    if (newCells[r] != null) {
                        int cLimit = Math.min(cols, newCells[r].length);
                        System.arraycopy(newCells[r], 0, cells[r], 0, cLimit);
                    }
                }
            }
            if (gen != null && gen >= 0) {
                this.generation = gen;
            }
            if (boundaryMode == LifeEngine.WALL_MODE_ABSORBING) {
                for (int r = 0; r < rows; r++) {
                    for (int c = 0; c < cols; c++) {
                        if (LifeEngine.isWall(r, c, rows, cols)) {
                            cells[r][c] = false;
                        }
                    }
                }
            }
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
            if (boundaryMode == LifeEngine.WALL_MODE_ABSORBING && LifeEngine.isWall(row, col, cells.length, cells[0].length)) {
                return toResponse();
            }
            cells[row][col] = !cells[row][col];
            return toResponse();
        }
    }

    public GameStateResponse setCell(int row, int col, boolean alive) {
        synchronized (lock) {
            assertInBounds(row, col);
            if (boundaryMode == LifeEngine.WALL_MODE_ABSORBING && LifeEngine.isWall(row, col, cells.length, cells[0].length)) {
                return toResponse();
            }
            cells[row][col] = alive;
            return toResponse();
        }
    }

    public GameStateResponse step() {
        synchronized (lock) {
            if ("PARALLEL".equalsIgnoreCase(engineMode)) {
                cells = ParallelLifeEngine.nextGeneration(cells, boundaryMode);
            } else {
                cells = LifeEngine.nextGeneration(cells, boundaryMode);
            }
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
                    if (boundaryMode == LifeEngine.WALL_MODE_ABSORBING && LifeEngine.isWall(r, c, cells.length, cells[r].length)) {
                        cells[r][c] = false;
                    } else {
                        cells[r][c] = random.nextDouble() < density;
                    }
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
                int r = originRow + offset.row();
                int c = originCol + offset.col();
                if (r >= 0 && r < rows && c >= 0 && c < cols) {
                    if (boundaryMode != LifeEngine.WALL_MODE_ABSORBING || !LifeEngine.isWall(r, c, rows, cols)) {
                        cells[r][c] = true;
                    }
                }
            }
            return toResponse();
        }
    }

    public BenchmarkResponse benchmark(BenchmarkRequest request) {
        int generations = (request != null && request.generations() != null && request.generations() > 0)
                ? request.generations() : 200;
        int rows = (request != null && request.rows() != null && request.rows() >= MIN_SIZE && request.rows() <= MAX_SIZE)
                ? request.rows() : 128;
        int cols = (request != null && request.cols() != null && request.cols() >= MIN_SIZE && request.cols() <= MAX_SIZE)
                ? request.cols() : 128;

        // Create identical initial random grids
        boolean[][] gridSeq = new boolean[rows][cols];
        boolean[][] gridPar = new boolean[rows][cols];
        Random rand = new Random(1337);
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                boolean val = rand.nextDouble() < 0.25;
                gridSeq[r][c] = val;
                gridPar[r][c] = val;
            }
        }

        // Warm-up JIT
        for (int i = 0; i < 20; i++) {
            gridSeq = LifeEngine.nextGeneration(gridSeq);
            gridPar = ParallelLifeEngine.nextGeneration(gridPar);
        }

        // Sequential benchmark
        long startSeq = System.nanoTime();
        for (int i = 0; i < generations; i++) {
            gridSeq = LifeEngine.nextGeneration(gridSeq);
        }
        long seqDurationNanos = Math.max(1, System.nanoTime() - startSeq);
        long seqDurationMs = seqDurationNanos / 1_000_000L;

        // Parallel benchmark
        long startPar = System.nanoTime();
        for (int i = 0; i < generations; i++) {
            gridPar = ParallelLifeEngine.nextGeneration(gridPar);
        }
        long parDurationNanos = Math.max(1, System.nanoTime() - startPar);
        long parDurationMs = parDurationNanos / 1_000_000L;

        double seqGps = (generations * 1_000_000_000.0) / seqDurationNanos;
        double parGps = (generations * 1_000_000_000.0) / parDurationNanos;
        double speedup = (double) seqDurationNanos / (double) parDurationNanos;

        return new BenchmarkResponse(
                generations,
                rows,
                cols,
                rows * cols,
                Runtime.getRuntime().availableProcessors(),
                seqDurationMs,
                parDurationMs,
                Math.round(seqGps * 10.0) / 10.0,
                Math.round(parGps * 10.0) / 10.0,
                Math.round(speedup * 100.0) / 100.0
        );
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
        int liveCount = "PARALLEL".equalsIgnoreCase(engineMode)
                ? ParallelLifeEngine.countLiveCells(cells)
                : LifeEngine.countLiveCells(cells);
        return new GameStateResponse(rows, cols, generation, liveCount, copy, engineMode, boundaryMode != LifeEngine.WALL_MODE_TORUS, boundaryMode);
    }
}
