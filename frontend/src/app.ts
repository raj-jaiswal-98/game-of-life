/**
 * Conway's Game of Life — Multi-Engine UI & Simulator
 *
 * Supports:
 *  1. Client GPU (WebGL 2.0 Fragment Shader) — ultra-fast 60-144 FPS simulation
 *  2. Server CPU Multi-threaded (Java 21 Parallel Streams / ForkJoin)
 *  3. Server CPU Single-threaded (Java 21 Baseline)
 *
 * Features:
 *  - Fullscreen view mode
 *  - 4 Dynamic Color & Segmentation modes (Classic, Age Heatmap, Cyberpunk, Thermal)
 *  - 2-Width Wall Collision Buffer with UI Toggle (Absorbing barrier / non-toroidal)
 *  - Interactive Pattern Ghost Preview & Rotation ('R' key / Toolbar)
 *  - Zero-Loss Grid Size Resizing (preserves cells on resize)
 *  - Bidirectional GPU ⇄ Server Engine State Synchronization
 *  - 1-Click Live GPU Stress Test Presets
 *  - Real-time Performance HUD: FPS, GPS, Frame Latency, Live Cells, Grid Dimension.
 */

import { api } from './api';
import { WebGLEngine } from './gpu/webgl-engine';
import type {
  GameState,
  PatternInfo,
  PaintRequest,
  RandomizeRequest,
  GridSizeRequest,
  GridSyncRequest,
  WallModeRequest,
  EngineRequest,
  BenchmarkResponse,
  HardwareInfo,
} from './types';

// ── DOM elements ─────────────────────────────────────────────────────────────

const boardFrame        = document.getElementById('boardFrame')        as HTMLElement;
const board             = document.getElementById('board')             as HTMLCanvasElement;
const generationEl      = document.getElementById('generation')        as HTMLElement;
const liveEl            = document.getElementById('live')              as HTMLElement;
const sizeEl            = document.getElementById('size')              as HTMLElement;
const hintEl            = document.getElementById('hint')              as HTMLElement;
const playBtn           = document.getElementById('play')              as HTMLButtonElement;
const stepBtn           = document.getElementById('step')              as HTMLButtonElement;
const clearBtn          = document.getElementById('clear')             as HTMLButtonElement;
const randomBtn         = document.getElementById('random')            as HTMLButtonElement;
const speedInput        = document.getElementById('speed')             as HTMLInputElement;
const speedValue        = document.getElementById('speedValue')        as HTMLElement;
const densityInput      = document.getElementById('density')           as HTMLInputElement;
const densityValue      = document.getElementById('densityValue')      as HTMLElement;
const patternList       = document.getElementById('patternList')       as HTMLElement;
const cancelPattern     = document.getElementById('cancelPattern')     as HTMLButtonElement;
const patternBadge      = document.getElementById('patternBadge')      as HTMLElement;
const patternTools      = document.getElementById('patternTools')      as HTMLElement;
const rotatePatternBtn  = document.getElementById('rotatePatternBtn')  as HTMLButtonElement;
const centerPatternBtn  = document.getElementById('centerPatternBtn')  as HTMLButtonElement;

const wallToggle        = document.getElementById('wallToggle')        as HTMLInputElement;
const engineSelect      = document.getElementById('engineSelect')      as HTMLSelectElement;
const colorModeSelect   = document.getElementById('colorModeSelect')   as HTMLSelectElement;
const gridSizeSelect    = document.getElementById('gridSizeSelect')    as HTMLSelectElement;
const engineBadge       = document.getElementById('engineBadge')       as HTMLElement;
const activeEngineText  = document.getElementById('activeEngineText')   as HTMLElement;
const fpsEl             = document.getElementById('fps')               as HTMLElement;
const gpsEl             = document.getElementById('gps')               as HTMLElement;
const frameTimeEl       = document.getElementById('frameTime')         as HTMLElement;
const runBenchmarkBtn   = document.getElementById('runBenchmark')      as HTMLButtonElement;
const benchmarkResult   = document.getElementById('benchmarkResult')   as HTMLElement;
const fullscreenBtn     = document.getElementById('fullscreenBtn')     as HTMLButtonElement;
const substepsSelect    = document.getElementById('substepsSelect')    as HTMLSelectElement;

// ── UI & Engine state ─────────────────────────────────────────────────────────

type EngineMode = 'client-gpu' | 'server-parallel' | 'server-single';

let currentEngine: EngineMode = 'client-gpu';
let state: GameState = { rows: 42, cols: 72, generation: 0, liveCells: 0, cells: [] };
let running = false;
let painting = false;
let paintAlive = true;
let selectedPattern: string | null = null;
let patternRotation = 0; // 0, 90, 180, 270 degrees
let lastHoverCell: { row: number; col: number } | null = null;
const patternCatalog = new Map<string, PatternInfo>();

let webglEngine: WebGLEngine | null = null;
let animFrameId: number | null = null;
let serverTimer: ReturnType<typeof setTimeout> | null = null;

// Performance metrics
let frameCount = 0;
let genCount = 0;
let lastPerfTime = performance.now();
let lastTickTime = performance.now();

// ── WebGL Initialization ──────────────────────────────────────────────────────

function initGPU(rows: number, cols: number): void {
  try {
    if (!webglEngine) {
      webglEngine = new WebGLEngine(board, rows, cols);
    } else {
      webglEngine.resize(rows, cols, false);
    }
  } catch (e) {
    console.warn('WebGL2 not available, falling back to server simulation:', e);
    currentEngine = 'server-parallel';
    engineSelect.value = 'server-parallel';
    updateEngineLabels();
  }
}

function updateEngineLabels(): void {
  if (currentEngine === 'client-gpu') {
    engineBadge.textContent = 'GPU WebGL2';
    activeEngineText.textContent = 'GPU Shader';
    activeEngineText.style.color = 'var(--phosphor)';
  } else if (currentEngine === 'server-parallel') {
    engineBadge.textContent = 'CPU Multi-thread';
    activeEngineText.textContent = 'Java Parallel';
    activeEngineText.style.color = 'var(--amber)';
  } else {
    engineBadge.textContent = 'CPU Single-thread';
    activeEngineText.textContent = 'Java Sequential';
    activeEngineText.style.color = 'var(--muted)';
  }
}

// ── Rendering & State ─────────────────────────────────────────────────────────

function applyState(next: GameState): void {
  state = next;
  generationEl.textContent = String(state.generation);
  liveEl.textContent       = String(state.liveCells);
  sizeEl.textContent       = `${state.rows} \u00d7 ${state.cols}`;

  // Ensure state.cells has complete 2D dimensions
  if (!state.cells || state.cells.length !== state.rows || (state.cells[0] && state.cells[0].length !== state.cols)) {
    const safeCells: boolean[][] = [];
    for (let r = 0; r < state.rows; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < state.cols; c++) {
        row.push(state.cells && state.cells[r] && state.cells[r][c] ? true : false);
      }
      safeCells.push(row);
    }
    state.cells = safeCells;
  }

  if (state.wallMode !== undefined && wallToggle) {
    wallToggle.checked = state.wallMode;
  }

  // Keep grid resolution select in sync
  const sizeVal = `${state.rows}x${state.cols}`;
  if ([...gridSizeSelect.options].some(o => o.value === sizeVal)) {
    gridSizeSelect.value = sizeVal;
  }

  if (webglEngine) {
    if (webglEngine.rows !== state.rows || webglEngine.cols !== state.cols) {
      webglEngine.resize(state.rows, state.cols, false);
    }
    if (state.wallMode !== undefined) {
      webglEngine.wallMode = state.wallMode;
    }
    if (state.cells && state.cells.length > 0) {
      webglEngine.loadGrid(state.cells);
    }
    webglEngine.render(board.width, board.height);
  }
}

function renderGPU(): void {
  if (!webglEngine) return;
  webglEngine.render(board.width, board.height);
  frameCount++;
}

// ── Performance HUD Tracker ───────────────────────────────────────────────────

function updateMetrics(): void {
  const now = performance.now();
  const elapsed = now - lastPerfTime;

  if (elapsed >= 1000) {
    const fps = Math.round((frameCount * 1000) / elapsed);
    const gps = Math.round((genCount * 1000) / elapsed);

    fpsEl.textContent = String(fps);
    gpsEl.textContent = String(gps);

    frameCount = 0;
    genCount = 0;
    lastPerfTime = now;
  }
}

// ── Pointer input ─────────────────────────────────────────────────────────────

function cellFromEvent(event: PointerEvent): { row: number; col: number } {
  const rect = board.getBoundingClientRect();
  const normX = Math.max(0, Math.min(0.9999, (event.clientX - rect.left) / rect.width));
  const normY = Math.max(0, Math.min(0.9999, (event.clientY - rect.top) / rect.height));
  const col = Math.floor(normX * state.cols);
  const row = Math.floor(normY * state.rows);
  return { row, col };
}

async function paintCell(row: number, col: number, alive: boolean): Promise<void> {
  if (currentEngine === 'client-gpu' && webglEngine) {
    webglEngine.setCell(row, col, alive);
    if (state.cells && state.cells[row]) {
      state.cells[row][col] = alive;
    }
    webglEngine.render(board.width, board.height);
  } else {
    const body: PaintRequest = { row, col, alive };
    applyState(await api<GameState>('/api/game/paint', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
  }
}

const DEFAULT_PATTERNS: Record<string, [number, number][]> = {
  glider: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  lwss: [[0, 1], [0, 4], [1, 0], [2, 0], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3]],
  blinker: [[0, 0], [0, 1], [0, 2]],
  toad: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2]],
  beacon: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2], [2, 3], [3, 2], [3, 3]],
  pulsar: [
    [0, 2], [0, 3], [0, 4], [0, 8], [0, 9], [0, 10],
    [2, 0], [2, 5], [2, 7], [2, 12],
    [3, 0], [3, 5], [3, 7], [3, 12],
    [4, 0], [4, 5], [4, 7], [4, 12],
    [5, 2], [5, 3], [5, 4], [5, 8], [5, 9], [5, 10],
    [7, 2], [7, 3], [7, 4], [7, 8], [7, 9], [7, 10],
    [8, 0], [8, 5], [8, 7], [8, 12],
    [9, 0], [9, 5], [9, 7], [9, 12],
    [10, 0], [10, 5], [10, 7], [10, 12],
    [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10]
  ],
  pentadecathlon: [
    [0, 1], [1, 1], [2, 0], [2, 2], [3, 1], [4, 1],
    [5, 1], [6, 1], [7, 0], [7, 2], [8, 1], [9, 1]
  ],
  block: [[0, 0], [0, 1], [1, 0], [1, 1]],
  beehive: [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 2]],
  gosper: [
    [0, 24],
    [1, 22], [1, 24],
    [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
    [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35],
    [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
    [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
    [6, 10], [6, 16], [6, 24],
    [7, 11], [7, 15],
    [8, 12], [8, 13]
  ],
};

function getTransformedPatternCells(patternId: string, rotationDeg: number): [number, number][] {
  const pattern = patternCatalog.get(patternId);
  const rawCells: [number, number][] = (pattern && pattern.cells && pattern.cells.length > 0)
    ? pattern.cells.map(c => [c.row, c.col] as [number, number])
    : (DEFAULT_PATTERNS[patternId.toLowerCase()] || []);

  if (rawCells.length === 0) return [];

  let cells = rawCells.map(([r, c]) => [r, c] as [number, number]);
  const steps = Math.floor(((rotationDeg % 360) + 360) % 360 / 90);
  for (let s = 0; s < steps; s++) {
    // 90° clockwise: newRow = oldCol, newCol = -oldRow
    cells = cells.map(([r, c]) => [c, -r]);
  }

  // Normalize so top-left bounding box starts at (0, 0)
  const minR = Math.min(...cells.map(c => c[0]));
  const minC = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

async function stamp(row: number, col: number): Promise<void> {
  if (!selectedPattern) return;
  const patternId = selectedPattern;
  const rawCells = getTransformedPatternCells(patternId, patternRotation);
  if (rawCells.length === 0) return;

  if (currentEngine === 'client-gpu' && webglEngine) {
    for (const [dr, dc] of rawCells) {
      const r = ((row + dr) % state.rows + state.rows) % state.rows;
      const c = ((col + dc) % state.cols + state.cols) % state.cols;
      if (!webglEngine.wallMode || (r >= 2 && r < state.rows - 2 && c >= 2 && c < state.cols - 2)) {
        webglEngine.setCell(r, c, true);
        if (state.cells && state.cells[r]) {
          state.cells[r][c] = true;
        }
      }
    }
    renderGPU();
    const extracted = webglEngine.extractGrid();
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(state.liveCells);
  } else {
    // Server mode: update client grid array and upload cleanly
    for (const [dr, dc] of rawCells) {
      const r = ((row + dr) % state.rows + state.rows) % state.rows;
      const c = ((col + dc) % state.cols + state.cols) % state.cols;
      if (state.cells && state.cells[r]) {
        state.cells[r][c] = true;
      }
    }
    const updated = await api<GameState>('/api/game/grid', {
      method: 'POST',
      body: JSON.stringify({
        rows: state.rows,
        cols: state.cols,
        generation: state.generation,
        cells: state.cells,
      } as GridSyncRequest),
    });
    applyState(updated);
  }
}

// ── Simulation Step & Playback ────────────────────────────────────────────────

function stepGPUNoRender(): void {
  if (!webglEngine) return;
  const t0 = performance.now();
  webglEngine.step();
  const t1 = performance.now();

  frameTimeEl.textContent = (t1 - t0).toFixed(1);
  state.generation++;
  genCount++;
}

function stepGPU(): void {
  stepGPUNoRender();
  generationEl.textContent = String(state.generation);
  renderGPU();

  if (state.generation % 60 === 0 && webglEngine) {
    const extracted = webglEngine.extractGrid();
    liveEl.textContent = String(extracted.liveCells);
  }
}

async function stepServer(): Promise<void> {
  const t0 = performance.now();
  const next = await api<GameState>('/api/game/step', { method: 'POST' });
  const t1 = performance.now();

  frameTimeEl.textContent = (t1 - t0).toFixed(1);
  genCount++;
  applyState(next);
}

function gpuPlayLoop(): void {
  if (!running || currentEngine !== 'client-gpu') return;

  const interval = Number(speedInput.value);
  const stepsPerFrame = substepsSelect ? Number(substepsSelect.value) : 1;

  if (interval === 0) {
    // Uncapped: runs natively at hardware display refresh rate
    for (let i = 0; i < stepsPerFrame; i++) {
      stepGPUNoRender();
    }
    generationEl.textContent = String(state.generation);
    renderGPU();
  } else {
    const now = performance.now();
    if (now - lastTickTime >= interval) {
      for (let i = 0; i < stepsPerFrame; i++) {
        stepGPUNoRender();
      }
      generationEl.textContent = String(state.generation);
      renderGPU();
      lastTickTime = now;
    } else {
      renderGPU();
    }
  }

  // Sample live cell count every 60 frames
  if (state.generation % 60 === 0 && webglEngine) {
    const extracted = webglEngine.extractGrid();
    liveEl.textContent = String(extracted.liveCells);
  }

  updateMetrics();
  animFrameId = requestAnimationFrame(gpuPlayLoop);
}

function start(): void {
  if (running) return;
  running = true;
  playBtn.textContent = 'Pause';
  playBtn.classList.add('running');
  lastTickTime = performance.now();

  if (currentEngine === 'client-gpu') {
    animFrameId = requestAnimationFrame(gpuPlayLoop);
  } else {
    const tick = async (): Promise<void> => {
      if (!running) return;
      try {
        await stepServer();
        updateMetrics();
        serverTimer = setTimeout(tick, Number(speedInput.value));
      } catch (error: unknown) {
        stop();
        const message = error instanceof Error ? error.message : String(error);
        hintEl.textContent = `Play stopped: ${message}. Press Play to resume.`;
      }
    };
    tick();
  }
}

function stop(): void {
  running = false;
  playBtn.textContent = 'Play';
  playBtn.classList.remove('running');

  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (serverTimer !== null) {
    clearTimeout(serverTimer);
    serverTimer = null;
  }

  if (currentEngine === 'client-gpu' && webglEngine) {
    const extracted = webglEngine.extractGrid();
    state.cells = extracted.cells;
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(state.liveCells);
  }
}

// ── Fullscreen Toggle ─────────────────────────────────────────────────────────

function toggleFullscreen(): void {
  const isFs = boardFrame.classList.toggle('fullscreen');
  fullscreenBtn.textContent = isFs ? '✕ Exit Fullscreen' : '⛶ Fullscreen';

  if (isFs && document.fullscreenEnabled && !document.fullscreenElement) {
    boardFrame.requestFullscreen().catch(() => {});
  } else if (!isFs && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  if (webglEngine) {
    webglEngine.render(board.width, board.height);
  }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && boardFrame.classList.contains('fullscreen')) {
    boardFrame.classList.remove('fullscreen');
    fullscreenBtn.textContent = '⛶ Fullscreen';
  }
});

// ── Pattern Catalog & Precision Placement ────────────────────────────────────

function updatePatternHint(): void {
  if (selectedPattern) {
    const rotText = patternRotation > 0 ? ` (Rotated ${patternRotation}°) ` : ' ';
    hintEl.textContent = `Stamping \u201c${selectedPattern}\u201d${rotText}· Move mouse for preview, click to stamp. Press "R" to rotate.`;
  } else {
    hintEl.textContent = 'Click or drag to paint cells. Choose a pattern, then click the board to stamp it.';
  }
}

function setPattern(id: string | null): void {
  selectedPattern = id;
  patternRotation = 0;

  if (patternBadge) patternBadge.hidden = !id;
  if (patternTools) patternTools.hidden = !id;
  if (cancelPattern) cancelPattern.hidden = !id;

  updatePatternHint();

  [...patternList.querySelectorAll<HTMLButtonElement>('.pattern')].forEach((button) => {
    button.classList.toggle('active', button.dataset.id === id);
  });

  if (!id && webglEngine) {
    webglEngine.clearGhostPattern();
    renderGPU();
  }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

playBtn.addEventListener('click', () => { running ? stop() : start(); });

stepBtn.addEventListener('click', async () => {
  stop();
  if (currentEngine === 'client-gpu') {
    stepGPU();
  } else {
    await stepServer();
  }
});

clearBtn.addEventListener('click', async () => {
  stop();
  if (currentEngine === 'client-gpu' && webglEngine) {
    webglEngine.clear();
    state.generation = 0;
    state.liveCells = 0;
    generationEl.textContent = '0';
    liveEl.textContent = '0';
    renderGPU();
  }
  applyState(await api<GameState>('/api/game/clear', { method: 'POST' }));
});

randomBtn.addEventListener('click', async () => {
  stop();
  const density = Number(densityInput.value);
  if (currentEngine === 'client-gpu' && webglEngine) {
    webglEngine.randomize(density);
    state.generation = 0;
    generationEl.textContent = '0';
    const extracted = webglEngine.extractGrid();
    state.cells = extracted.cells;
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(state.liveCells);
    renderGPU();
  } else {
    const body: RandomizeRequest = { density };
    applyState(await api<GameState>('/api/game/random', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
  }
});

speedInput.addEventListener('input', () => {
  const val = Number(speedInput.value);
  if (val === 0) {
    speedValue.textContent = '⚡ Uncapped (Hardware Native Hz)';
  } else {
    const tps = Math.round(1000 / val);
    speedValue.textContent = `${val} ms (${tps} tps)`;
  }
});

densityInput.addEventListener('input', () => {
  densityValue.textContent = `${Math.round(Number(densityInput.value) * 100)}%`;
});

cancelPattern?.addEventListener('click', () => setPattern(null));

rotatePatternBtn?.addEventListener('click', () => {
  if (!selectedPattern) return;
  patternRotation = (patternRotation + 90) % 360;
  updatePatternHint();
  if (lastHoverCell && webglEngine) {
    webglEngine.setGhostPattern(
      lastHoverCell.col,
      lastHoverCell.row,
      getTransformedPatternCells(selectedPattern, patternRotation)
    );
    renderGPU();
  }
});

centerPatternBtn?.addEventListener('click', async () => {
  if (!selectedPattern) return;
  const rawCells = getTransformedPatternCells(selectedPattern, patternRotation);
  if (rawCells.length === 0) return;
  const maxR = Math.max(...rawCells.map(c => c[0]));
  const maxC = Math.max(...rawCells.map(c => c[1]));
  const centerR = Math.max(0, Math.floor((state.rows - maxR) / 2));
  const centerC = Math.max(0, Math.floor((state.cols - maxC) / 2));
  await stamp(centerR, centerC);
  hintEl.textContent = `Stamped \u201c${selectedPattern}\u201d at grid center!`;
});

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.key === 'r' || e.key === 'R') && selectedPattern) {
    patternRotation = (patternRotation + 90) % 360;
    updatePatternHint();
    if (lastHoverCell && webglEngine) {
      webglEngine.setGhostPattern(
        lastHoverCell.col,
        lastHoverCell.row,
        getTransformedPatternCells(selectedPattern, patternRotation)
      );
      renderGPU();
    }
  } else if (e.key === 'Escape' && selectedPattern) {
    setPattern(null);
  }
});

// Wall Collision Buffer Toggle Listener
wallToggle?.addEventListener('change', async () => {
  const enabled = wallToggle.checked;
  if (webglEngine) {
    webglEngine.setWallMode(enabled);
    renderGPU();
    const extracted = webglEngine.extractGrid();
    state.cells = extracted.cells;
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(state.liveCells);
  }

  try {
    const res = await api<GameState>('/api/game/wall', {
      method: 'POST',
      body: JSON.stringify({ enabled } as WallModeRequest),
    });
    if (currentEngine !== 'client-gpu') {
      applyState(res);
    }
  } catch (e) {
    console.warn('Wall mode backend sync:', e);
  }

  hintEl.textContent = enabled
    ? '🧱 2-Cell Wall Barrier active: Boundary acts as an absorbing collision wall (stops wrap-around).'
    : '🔄 Toroidal Wrap active: Cells wrap around grid boundaries seamlessly.';
});

// Color mode segmentation listener
colorModeSelect.addEventListener('change', () => {
  const mode = Number(colorModeSelect.value);
  if (webglEngine) {
    webglEngine.setColorMode(mode);
    renderGPU();
  }
});

// Engine switcher listener — Zero-Loss Bidirectional Synchronization
engineSelect.addEventListener('change', async () => {
  const wasRunning = running;
  stop();

  const nextEngine = engineSelect.value as EngineMode;

  // If switching from GPU to Server CPU: upload current GPU cells to server!
  if (currentEngine === 'client-gpu' && (nextEngine === 'server-parallel' || nextEngine === 'server-single')) {
    if (webglEngine) {
      const extracted = webglEngine.extractGrid();
      state.cells = extracted.cells;
      state.liveCells = extracted.liveCells;
      try {
        await api<GameState>('/api/game/grid', {
          method: 'POST',
          body: JSON.stringify({
            rows: state.rows,
            cols: state.cols,
            generation: state.generation,
            cells: extracted.cells,
          } as GridSyncRequest),
        });
      } catch (e) {
        console.warn('Grid upload to server:', e);
      }
    }
  }

  currentEngine = nextEngine;
  updateEngineLabels();

  if (currentEngine === 'server-parallel') {
    await api<GameState>('/api/game/engine', {
      method: 'POST',
      body: JSON.stringify({ mode: 'PARALLEL' } as EngineRequest),
    });
  } else if (currentEngine === 'server-single') {
    await api<GameState>('/api/game/engine', {
      method: 'POST',
      body: JSON.stringify({ mode: 'SEQUENTIAL' } as EngineRequest),
    });
  }

  // Sync state from server
  const serverState = await api<GameState>('/api/game');
  applyState(serverState);

  if (wasRunning) {
    start();
  }
});

// Grid resolution resize listener — Zero-Loss Resizing (preserves cells)
gridSizeSelect.addEventListener('change', async () => {
  const wasRunning = running;
  stop();

  const [rows, cols] = gridSizeSelect.value.split('x').map(Number);

  // Extract currently alive cells to preserve them
  let currentCells: boolean[][] = [];
  if (currentEngine === 'client-gpu' && webglEngine) {
    currentCells = webglEngine.extractGrid().cells;
  } else if (state.cells && state.cells.length > 0) {
    currentCells = state.cells;
  }

  const newCells: boolean[][] = [];
  const copyR = Math.min(currentCells.length, rows);
  const copyC = currentCells.length > 0 ? Math.min(currentCells[0].length, cols) : 0;
  let liveCount = 0;
  const isWall = webglEngine ? webglEngine.wallMode : false;

  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      let alive = (r < copyR && c < copyC) ? currentCells[r][c] : false;
      if (isWall && (r < 2 || r >= rows - 2 || c < 2 || c >= cols - 2)) {
        alive = false;
      }
      row.push(alive);
      if (alive) liveCount++;
    }
    newCells.push(row);
  }

  state.rows = rows;
  state.cols = cols;
  state.cells = newCells;
  state.liveCells = liveCount;
  sizeEl.textContent = `${rows} \u00d7 ${cols}`;
  liveEl.textContent = String(liveCount);

  // Maintain aspect ratio: square boards use 1024x1024 internal buffer
  if (rows === cols) {
    board.width = 1024;
    board.height = 1024;
  } else {
    board.width = 1152;
    board.height = 672;
  }

  if (webglEngine) {
    webglEngine.resize(rows, cols, false);
    webglEngine.loadGrid(newCells);
    renderGPU();
  }

  // Keep server in sync with preserved cells
  try {
    await api<GameState>('/api/game/resize', {
      method: 'POST',
      body: JSON.stringify({ rows, cols, preserveCells: true } as GridSizeRequest),
    });
    await api<GameState>('/api/game/grid', {
      method: 'POST',
      body: JSON.stringify({
        rows,
        cols,
        generation: state.generation,
        cells: newCells,
      } as GridSyncRequest),
    });
  } catch (e) {
    console.warn('Backend resize sync:', e);
  }

  if (wasRunning) {
    start();
  }
});

// Stress test preset buttons
document.querySelectorAll<HTMLButtonElement>('.stress-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const preset = btn.dataset.preset as 'glider-megacity' | 'gun-matrix' | 'supernova-soup' | 'pulsar-galaxy';
    stop();

    // Ensure GPU mode is active for massive stress grids
    currentEngine = 'client-gpu';
    engineSelect.value = 'client-gpu';
    updateEngineLabels();

    let targetSize = '1024x1024';
    if (preset === 'gun-matrix' || preset === 'pulsar-galaxy') {
      targetSize = '512x512';
    }
    gridSizeSelect.value = targetSize;
    const [rows, cols] = targetSize.split('x').map(Number);
    state.rows = rows;
    state.cols = cols;
    state.generation = 0;
    sizeEl.textContent = `${rows} \u00d7 ${cols}`;

    board.width = 1024;
    board.height = 1024;

    if (webglEngine) {
      webglEngine.resize(rows, cols, false);
      webglEngine.loadStressPreset(preset);
      const extracted = webglEngine.extractGrid();
      state.cells = extracted.cells;
      state.liveCells = extracted.liveCells;
      liveEl.textContent = String(state.liveCells);
      renderGPU();
    }

    try {
      await api<GameState>('/api/game/reset', {
        method: 'POST',
        body: JSON.stringify({ rows, cols, preserveCells: false } as GridSizeRequest),
      });
    } catch {
      // Ignored for huge GPU grids
    }

    hintEl.textContent = `🚀 Stress preset "${btn.textContent?.trim()}" loaded! Running at full GPU speed.`;
    start();
  });
});

// Benchmark runner listener
runBenchmarkBtn.addEventListener('click', async () => {
  runBenchmarkBtn.disabled = true;
  runBenchmarkBtn.textContent = 'Running...';
  benchmarkResult.hidden = false;
  benchmarkResult.innerHTML = '<em>Warming up JIT & running 200 generations across all CPU cores...</em>';

  try {
    const res = await api<BenchmarkResponse>('/api/game/benchmark', {
      method: 'POST',
      body: JSON.stringify({ generations: 200, rows: 128, cols: 128 }),
    });

    benchmarkResult.innerHTML = `
      <div>Grid: <strong>${res.rows} × ${res.cols}</strong> (${res.totalCells.toLocaleString()} cells) · CPU Cores: <strong>${res.availableProcessors}</strong></div>
      <div>Sequential: <strong>${res.sequentialDurationMs}ms</strong> (${res.sequentialGps} gen/s)</div>
      <div>Parallel: <strong>${res.parallelDurationMs}ms</strong> (${res.parallelGps} gen/s)</div>
      <div style="margin-top:4px; color:var(--phosphor);">Speedup Factor: <strong>${res.speedupFactor}×</strong> faster</div>
    `;
  } catch (e) {
    benchmarkResult.textContent = 'Benchmark failed: ' + (e instanceof Error ? e.message : String(e));
  } finally {
    runBenchmarkBtn.disabled = false;
    runBenchmarkBtn.textContent = 'Run Test';
  }
});

// Board Pointer Interactions
board.addEventListener('pointerdown', async (event: PointerEvent) => {
  const { row, col } = cellFromEvent(event);
  if (selectedPattern) {
    await stamp(row, col);
    return;
  }
  painting = true;
  board.setPointerCapture(event.pointerId);
  paintAlive = !(state.cells && state.cells[row] && state.cells[row][col]);
  await paintCell(row, col, paintAlive);
});

board.addEventListener('pointermove', async (event: PointerEvent) => {
  const { row, col } = cellFromEvent(event);
  lastHoverCell = { row, col };

  if (selectedPattern) {
    const rawCells = getTransformedPatternCells(selectedPattern, patternRotation);
    if (webglEngine) {
      webglEngine.setGhostPattern(col, row, rawCells);
      renderGPU();
    }
    return;
  }

  if (!painting) return;
  if (state.cells && state.cells[row] && state.cells[row][col] === paintAlive) return;
  await paintCell(row, col, paintAlive);
});

board.addEventListener('pointerleave', () => {
  lastHoverCell = null;
  if (selectedPattern && webglEngine) {
    webglEngine.clearGhostPattern();
    renderGPU();
  }
});

board.addEventListener('pointerup',     () => { painting = false; });
board.addEventListener('pointercancel', () => { painting = false; });

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  updateEngineLabels();

  const patterns = await api<PatternInfo[]>('/api/game/patterns');
  patternList.innerHTML = '';
  patternCatalog.clear();
  patterns.forEach((pattern) => {
    patternCatalog.set(pattern.id, pattern);
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

  const initial = await api<GameState>('/api/game');
  initGPU(initial.rows, initial.cols);
  applyState(initial);

  // Set initial speed label
  const initialSpeed = Number(speedInput.value);
  if (initialSpeed === 0) {
    speedValue.textContent = '⚡ Uncapped (Hardware Native Hz)';
  } else {
    speedValue.textContent = `${initialSpeed} ms (${Math.round(1000 / initialSpeed)} tps)`;
  }

  // Probe backend hardware status
  try {
    const hw = await api<HardwareInfo>('/api/game/hardware');
    if (hw.gpuAvailable) {
      console.log(`⚡ Backend Container GPU: ${hw.deviceName}`);
    } else {
      console.log(`⚙️ Backend Container CPU: ${hw.deviceName}`);
    }
  } catch {
    // Non-critical
  }
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  hintEl.textContent = `Could not reach the Game of Life API: ${message}`;
});
