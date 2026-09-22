/**
 * TypeScript interfaces that mirror the Spring Boot Java DTOs exactly.
 *
 * Keep this file in sync with the Java records under:
 *   src/main/java/com/gameoflife/api/dto/
 */

// ── Responses ────────────────────────────────────────────────────────────────

/**
 * Mirrors GameStateResponse.java
 * Returned by every mutating endpoint and by GET /api/game.
 */
export interface GameState {
  rows: number;
  cols: number;
  generation: number;
  liveCells: number;
  /** Dense boolean grid: cells[row][col] === true means the cell is alive. */
  cells: boolean[][];
  engineMode?: string;
  wallMode?: boolean;
  boundaryMode?: number;
}

/**
 * Mirrors PatternInfo.java
 * Returned as an array by GET /api/game/patterns.
 */
export interface PatternOffset {
  row: number;
  col: number;
}

export interface PatternInfo {
  id: string;
  name: string;
  category?: string;
  description: string;
  cells?: PatternOffset[];
}

/**
 * Mirrors BenchmarkResponse.java
 */
export interface BenchmarkResponse {
  generations: number;
  rows: number;
  cols: number;
  totalCells: number;
  availableProcessors: number;
  sequentialDurationMs: number;
  parallelDurationMs: number;
  sequentialGps: number;
  parallelGps: number;
  speedupFactor: number;
}

/**
 * Mirrors HardwareInfo.java
 */
export interface HardwareInfo {
  gpuAvailable: boolean;
  deviceName: string;
  cpuCores: number;
  os: string;
  javaVersion: string;
}

// ── Requests ─────────────────────────────────────────────────────────────────

/** Mirrors CellRequest.java — used by POST /api/game/toggle */
export interface CellRequest {
  row: number;
  col: number;
}

/** Mirrors PaintRequest.java — used by POST /api/game/paint */
export interface PaintRequest {
  row: number;
  col: number;
  alive: boolean;
}

/** Mirrors RandomizeRequest.java — used by POST /api/game/random */
export interface RandomizeRequest {
  density: number;
}

/** Mirrors PatternStampRequest.java — used by POST /api/game/pattern */
export interface PatternStampRequest {
  id: string;
  row: number;
  col: number;
}

/** Mirrors GridSizeRequest.java — used by POST /api/game/reset and /api/game/resize */
export interface GridSizeRequest {
  rows: number;
  cols: number;
  preserveCells?: boolean;
}

/** Mirrors GridSyncRequest.java — used by POST /api/game/grid */
export interface GridSyncRequest {
  rows: number;
  cols: number;
  generation?: number;
  cells: boolean[][];
}

/** Mirrors WallModeRequest.java — used by POST /api/game/wall */
export interface WallModeRequest {
  enabled?: boolean;
  mode?: number;
}

/** Mirrors EngineRequest.java — used by POST /api/game/engine */
export interface EngineRequest {
  mode: string;
}

/** Mirrors BenchmarkRequest.java — used by POST /api/game/benchmark */
export interface BenchmarkRequest {
  generations?: number;
  rows?: number;
  cols?: number;
}
