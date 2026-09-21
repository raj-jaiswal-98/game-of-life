/**
 * Conway's Game of Life — browser UI
 *
 * Responsibilities:
 *  - Render the board on an HTML <canvas> element.
 *  - Translate pointer events into API calls (paint, stamp, toggle).
 *  - Drive the play / pause loop via setTimeout.
 *  - Keep the stat panel (generation, live cells, grid size) in sync.
 *
 * The Life rules themselves run exclusively on the Spring Boot server.
 * This file never implements B3/S23 — it is a pure rendering and input client.
 */

import { api } from './api';
import type {
  GameState,
  PatternInfo,
  PaintRequest,
  PatternStampRequest,
  RandomizeRequest,
} from './types';

// ── DOM elements ─────────────────────────────────────────────────────────────

const board       = document.getElementById('board')         as HTMLCanvasElement;
const ctx         = board.getContext('2d')!;
const generationEl = document.getElementById('generation')   as HTMLElement;
const liveEl      = document.getElementById('live')          as HTMLElement;
const sizeEl      = document.getElementById('size')          as HTMLElement;
const hintEl      = document.getElementById('hint')          as HTMLElement;
const playBtn     = document.getElementById('play')          as HTMLButtonElement;
const stepBtn     = document.getElementById('step')          as HTMLButtonElement;
const clearBtn    = document.getElementById('clear')         as HTMLButtonElement;
const randomBtn   = document.getElementById('random')        as HTMLButtonElement;
const speedInput  = document.getElementById('speed')         as HTMLInputElement;
const speedValue  = document.getElementById('speedValue')    as HTMLElement;
const densityInput = document.getElementById('density')      as HTMLInputElement;
const densityValue = document.getElementById('densityValue') as HTMLElement;
const patternList = document.getElementById('patternList')   as HTMLElement;
const cancelPattern = document.getElementById('cancelPattern') as HTMLButtonElement;

// ── UI state ─────────────────────────────────────────────────────────────────

let state: GameState = { rows: 42, cols: 72, generation: 0, liveCells: 0, cells: [] };
let running           = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let painting          = false;
let paintAlive        = true;
let selectedPattern: string | null = null;

// ── Rendering ─────────────────────────────────────────────────────────────────

function applyState(next: GameState): void {
  state = next;
  generationEl.textContent = String(state.generation);
  liveEl.textContent       = String(state.liveCells);
  sizeEl.textContent       = `${state.rows} \u00d7 ${state.cols}`;
  draw();
}

function cellSize(): { w: number; h: number } {
  return {
    w: board.width  / state.cols,
    h: board.height / state.rows,
  };
}

function draw(): void {
  const { w, h } = cellSize();

  // Background
  ctx.fillStyle = '#0d0c0a';
  ctx.fillRect(0, 0, board.width, board.height);

  // Grid lines
  ctx.strokeStyle = 'rgba(58, 52, 40, 0.45)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= state.cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * w + 0.5, 0);
    ctx.lineTo(c * w + 0.5, board.height);
    ctx.stroke();
  }
  for (let r = 0; r <= state.rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * h + 0.5);
    ctx.lineTo(board.width, r * h + 0.5);
    ctx.stroke();
  }

  // Live cells
  for (let r = 0; r < state.rows; r++) {
    const row = state.cells[r];
    if (!row) continue;
    for (let c = 0; c < state.cols; c++) {
      if (!row[c]) continue;
      const x = c * w;
      const y = r * h;
      ctx.fillStyle = '#d9e36a';
      ctx.fillRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
      // Subtle highlight along the top edge
      ctx.fillStyle = 'rgba(224, 164, 90, 0.28)';
      ctx.fillRect(x + 1, y + 1, Math.max(1, w - 2), 3);
    }
  }
}

// ── Pointer input ─────────────────────────────────────────────────────────────

function cellFromEvent(event: PointerEvent): { row: number; col: number } {
  const rect   = board.getBoundingClientRect();
  const scaleX = board.width  / rect.width;
  const scaleY = board.height / rect.height;
  const x      = (event.clientX - rect.left) * scaleX;
  const y      = (event.clientY - rect.top)  * scaleY;
  const { w, h } = cellSize();
  const col = Math.min(state.cols - 1, Math.max(0, Math.floor(x / w)));
  const row = Math.min(state.rows - 1, Math.max(0, Math.floor(y / h)));
  return { row, col };
}

async function paintCell(row: number, col: number, alive: boolean): Promise<void> {
  const body: PaintRequest = { row, col, alive };
  applyState(await api<GameState>('/api/game/paint', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

async function stamp(row: number, col: number): Promise<void> {
  const body: PatternStampRequest = { id: selectedPattern!, row, col };
  applyState(await api<GameState>('/api/game/pattern', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

// ── Playback ──────────────────────────────────────────────────────────────────

function start(): void {
  if (running) return;
  running = true;
  playBtn.textContent = 'Pause';
  playBtn.classList.add('running');

  const tick = async (): Promise<void> => {
    if (!running) return;
    try {
      applyState(await api<GameState>('/api/game/step', { method: 'POST' }));
      timer = setTimeout(tick, Number(speedInput.value));
    } catch (error: unknown) {
      // A network or server error during play: stop cleanly and surface the message.
      stop();
      const message = error instanceof Error ? error.message : String(error);
      hintEl.textContent = `Play stopped: ${message}. Fix the issue and press Play to resume.`;
    }
  };

  tick();
}

function stop(): void {
  running = false;
  playBtn.textContent = 'Play';
  playBtn.classList.remove('running');
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

// ── Pattern selection ─────────────────────────────────────────────────────────

function setPattern(id: string | null): void {
  selectedPattern    = id;
  cancelPattern.hidden = !id;
  hintEl.textContent = id
    ? `Stamping \u201c${id}\u201d. Click the board to place it.`
    : 'Click or drag to paint cells. Choose a pattern, then click the board to stamp it.';

  [...patternList.querySelectorAll<HTMLButtonElement>('.pattern')].forEach((button) => {
    button.classList.toggle('active', button.dataset.id === id);
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

playBtn.addEventListener('click', () => { running ? stop() : start(); });

stepBtn.addEventListener('click', async () => {
  stop();
  applyState(await api<GameState>('/api/game/step', { method: 'POST' }));
});

clearBtn.addEventListener('click', async () => {
  stop();
  applyState(await api<GameState>('/api/game/clear', { method: 'POST' }));
});

randomBtn.addEventListener('click', async () => {
  stop();
  const body: RandomizeRequest = { density: Number(densityInput.value) };
  applyState(await api<GameState>('/api/game/random', {
    method: 'POST',
    body: JSON.stringify(body),
  }));
});

speedInput.addEventListener('input', () => {
  speedValue.textContent = `${speedInput.value} ms`;
});

densityInput.addEventListener('input', () => {
  densityValue.textContent = `${Math.round(Number(densityInput.value) * 100)}%`;
});

cancelPattern.addEventListener('click', () => setPattern(null));

board.addEventListener('pointerdown', async (event: PointerEvent) => {
  const { row, col } = cellFromEvent(event);
  if (selectedPattern) {
    await stamp(row, col);
    return;
  }
  painting = true;
  board.setPointerCapture(event.pointerId);
  paintAlive = !(state.cells[row] && state.cells[row][col]);
  await paintCell(row, col, paintAlive);
});

board.addEventListener('pointermove', async (event: PointerEvent) => {
  if (!painting || selectedPattern) return;
  const { row, col } = cellFromEvent(event);
  if (state.cells[row] && state.cells[row][col] === paintAlive) return;
  await paintCell(row, col, paintAlive);
});

board.addEventListener('pointerup',     () => { painting = false; });
board.addEventListener('pointercancel', () => { painting = false; });

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  const patterns = await api<PatternInfo[]>('/api/game/patterns');

  patternList.innerHTML = '';
  patterns.forEach((pattern) => {
    const button = document.createElement('button');
    button.type      = 'button';
    button.className = 'pattern';
    button.dataset.id = pattern.id;
    button.innerHTML  = `${pattern.name}<small>${pattern.description}</small>`;
    button.addEventListener('click', () => {
      setPattern(selectedPattern === pattern.id ? null : pattern.id);
    });
    patternList.appendChild(button);
  });

  applyState(await api<GameState>('/api/game'));
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  hintEl.textContent = `Could not reach the Game of Life API: ${message}`;
});
