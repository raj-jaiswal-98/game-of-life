/**
 * TypeScript interfaces that mirror the Spring Boot Java DTOs exactly.
 *
 * Keep this file in sync with the Java records under:
 *   src/main/java/com/gameoflife/api/dto/
 *
 * When a new field is added to a Java record (e.g. `wrap` in GameStateResponse
 * for F01/R9), add it here too so the compiler catches every callsite that
 * needs to handle the new field.
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
}

/**
 * Mirrors PatternInfo.java
 * Returned as an array by GET /api/game/patterns.
 */
export interface PatternInfo {
  id: string;
  name: string;
  description: string;
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

/** Mirrors GridSizeRequest.java — used by POST /api/game/reset */
export interface GridSizeRequest {
  rows: number;
  cols: number;
}
