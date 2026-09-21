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
 *  - Grid sizes up to 2048x2048 (4.19M cells)
 *  - 1-Click Live GPU Stress Test Presets
 *  - Real-time Performance HUD: FPS, GPS, Frame Latency, Live Cells, Grid Dimension.
 */

import { api } from './api';
import { WebGLEngine } from './gpu/webgl-engine';
import type {
  GameState,
  PatternInfo,
  PaintRequest,
  PatternStampRequest,
  RandomizeRequest,
  GridSizeRequest,
  EngineRequest,
  BenchmarkResponse,
} from './types';

// ── DOM elements ─────────────────────────────────────────────────────────────

const boardFrame      = document.getElementById('boardFrame')      as HTMLElement;
const board           = document.getElementById('board')           as HTMLCanvasElement;
const generationEl    = document.getElementById('generation')      as HTMLElement;
const liveEl          = document.getElementById('live')            as HTMLElement;
const sizeEl          = document.getElementById('size')            as HTMLElement;
const hintEl          = document.getElementById('hint')            as HTMLElement;
const playBtn         = document.getElementById('play')            as HTMLButtonElement;
const stepBtn         = document.getElementById('step')            as HTMLButtonElement;
const clearBtn        = document.getElementById('clear')           as HTMLButtonElement;
const randomBtn       = document.getElementById('random')          as HTMLButtonElement;
const speedInput      = document.getElementById('speed')           as HTMLInputElement;
const speedValue      = document.getElementById('speedValue')      as HTMLElement;
const densityInput    = document.getElementById('density')         as HTMLInputElement;
const densityValue    = document.getElementById('densityValue')    as HTMLElement;
const patternList     = document.getElementById('patternList')     as HTMLElement;
const cancelPattern   = document.getElementById('cancelPattern')   as HTMLButtonElement;

const engineSelect    = document.getElementById('engineSelect')    as HTMLSelectElement;
const colorModeSelect = document.getElementById('colorModeSelect') as HTMLSelectElement;
const gridSizeSelect  = document.getElementById('gridSizeSelect')  as HTMLSelectElement;
const engineBadge     = document.getElementById('engineBadge')     as HTMLElement;
const activeEngineText = document.getElementById('activeEngineText') as HTMLElement;
const fpsEl           = document.getElementById('fps')             as HTMLElement;
const gpsEl           = document.getElementById('gps')             as HTMLElement;
const frameTimeEl     = document.getElementById('frameTime')       as HTMLElement;
const runBenchmarkBtn = document.getElementById('runBenchmark')    as HTMLButtonElement;
const benchmarkResult = document.getElementById('benchmarkResult') as HTMLElement;
const fullscreenBtn   = document.getElementById('fullscreenBtn')   as HTMLButtonElement;
const substepsSelect  = document.getElementById('substepsSelect')  as HTMLSelectElement;

// ── UI & Engine state ─────────────────────────────────────────────────────────

type EngineMode = 'client-gpu' | 'server-parallel' | 'server-single';

let currentEngine: EngineMode = 'client-gpu';
let state: GameState = { rows: 42, cols: 72, generation: 0, liveCells: 0, cells: [] };
let running = false;
let painting = false;
let paintAlive = true;
let selectedPattern: string | null = null;
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
      webglEngine.resize(rows, cols);
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

  if (webglEngine) {
    if (webglEngine.rows !== state.rows || webglEngine.cols !== state.cols) {
      webglEngine.resize(state.rows, state.cols);
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

async function stamp(row: number, col: number): Promise<void> {
  const pattern = patternCatalog.get(selectedPattern!);

  if (currentEngine === 'client-gpu' && webglEngine) {
    if (pattern && pattern.cells && pattern.cells.length > 0) {
      for (const offset of pattern.cells) {
        const r = ((row + offset.row) % state.rows + state.rows) % state.rows;
        const c = ((col + offset.col) % state.cols + state.cols) % state.cols;
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
    const body: PatternStampRequest = { id: selectedPattern!, row, col };
    const updated = await api<GameState>('/api/game/pattern', {
      method: 'POST',
      body: JSON.stringify(body),
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
    // Uncapped: runs natively at hardware display refresh rate (60Hz, 120Hz, 144Hz, 240Hz+)
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

  // Sample live cell count every 60 frames without stalling GPU pipeline
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

// ── Pattern Catalog ───────────────────────────────────────────────────────────

function setPattern(id: string | null): void {
  selectedPattern = id;
  cancelPattern.hidden = !id;
  hintEl.textContent = id
    ? `Stamping \u201c${id}\u201d. Click the board to place it.`
    : 'Click or drag to paint cells. Choose a pattern, then click the board to stamp it.';

  [...patternList.querySelectorAll<HTMLButtonElement>('.pattern')].forEach((button) => {
    button.classList.toggle('active', button.dataset.id === id);
  });
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

cancelPattern.addEventListener('click', () => setPattern(null));

// Color mode segmentation listener
colorModeSelect.addEventListener('change', () => {
  const mode = Number(colorModeSelect.value);
  if (webglEngine) {
    webglEngine.setColorMode(mode);
    renderGPU();
  }
});

// Engine switcher listener
engineSelect.addEventListener('change', async () => {
  const wasRunning = running;
  stop();

  currentEngine = engineSelect.value as EngineMode;
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

  // Refresh and sync state
  applyState(await api<GameState>('/api/game'));

  if (wasRunning) {
    start();
  }
});

// Grid resolution resize listener
gridSizeSelect.addEventListener('change', async () => {
  stop();
  const [rows, cols] = gridSizeSelect.value.split('x').map(Number);

  state.rows = rows;
  state.cols = cols;
  state.generation = 0;
  sizeEl.textContent = `${rows} \u00d7 ${cols}`;

  // Maintain aspect ratio: square boards use 1024x1024 internal buffer
  if (rows === cols) {
    board.width = 1024;
    board.height = 1024;
  } else {
    board.width = 1152;
    board.height = 672;
  }

  if (webglEngine) {
    webglEngine.resize(rows, cols);
    webglEngine.clear();
  }

  // Keep server in sync
  try {
    const body: GridSizeRequest = { rows, cols };
    await api<GameState>('/api/game/reset', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn('Backend resize sync:', e);
  }

  generationEl.textContent = '0';
  liveEl.textContent = '0';
  renderGPU();
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
      webglEngine.resize(rows, cols);
      webglEngine.loadStressPreset(preset);
      const extracted = webglEngine.extractGrid();
      state.liveCells = extracted.liveCells;
      liveEl.textContent = String(state.liveCells);
      renderGPU();
    }

    try {
      await api<GameState>('/api/game/reset', {
        method: 'POST',
        body: JSON.stringify({ rows, cols } as GridSizeRequest),
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
  if (!painting || selectedPattern) return;
  const { row, col } = cellFromEvent(event);
  if (state.cells && state.cells[row] && state.cells[row][col] === paintAlive) return;
  await paintCell(row, col, paintAlive);
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
}

boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  hintEl.textContent = `Could not reach the Game of Life API: ${message}`;
});
