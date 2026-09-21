/**
 * Conway's Game of Life — Desktop Studio & Hardware Accelerated Workstation
 *
 * Capabilities:
 *  1. Client GPU (WebGL 2.0 Fragment Shader) — ultra-fast 60-144 FPS simulation
 *  2. Server CPU Multi-threaded (Java 21 Parallel Streams / ForkJoin)
 *  3. Server CPU Single-threaded (Java 21 Baseline)
 *
 * Desktop UX:
 *  - 100vh Viewport-filling studio layout with zero page scroll
 *  - Native WebGL-accelerated Pan & Zoom (1× to 32× magnification)
 *  - Floating DAW-style bottom transport dock (Play, Step, Undo, Clear, Random)
 *  - Interactive Tool Palette (Draw, Erase, Pan, Stamp) with 1×, 3×, 5× Brush Sizes
 *  - Live hover cell inspector tooltip with (X, Y) coordinates and cell state
 *  - Categorized Pattern Studio with auto-generated mini pixel canvas previews
 *  - Interactive pattern transformations: Rotate 90° ('R'), Flip H ('H'), Flip V ('V'), Stamp Center
 *  - 2-Width Wall Collision Buffer with UI Toggle ('W')
 *  - Zero-Loss Grid Size Resizing (preserves cells on resize)
 *  - Bidirectional GPU ⇄ Server Engine State Synchronization
 *  - Real-time Population Sparkline History Graph with trend classification
 *  - Desktop Keyboard Accelerators & interactive Shortcuts modal ('?')
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

const board           = document.getElementById('board')           as HTMLCanvasElement;
const viewport        = document.getElementById('viewport')        as HTMLElement;
const cellInspector   = document.getElementById('cellInspector')   as HTMLElement;
const inspectorCoords = document.getElementById('inspectorCoords') as HTMLElement;
const inspectorState  = document.getElementById('inspectorState')  as HTMLElement;

const quickEngine     = document.getElementById('quickEngine')     as HTMLElement;
const quickGen        = document.getElementById('quickGen')        as HTMLElement;
const quickLive       = document.getElementById('quickLive')       as HTMLElement;
const quickSize       = document.getElementById('quickSize')       as HTMLElement;

const zoomLevel       = document.getElementById('zoomLevel')       as HTMLElement;
const zoomInBtn       = document.getElementById('zoomInBtn')       as HTMLButtonElement;
const zoomOutBtn      = document.getElementById('zoomOutBtn')      as HTMLButtonElement;
const resetZoomBtn    = document.getElementById('resetZoomBtn')    as HTMLButtonElement;
const shortcutsBtn    = document.getElementById('shortcutsBtn')    as HTMLButtonElement;
const fullscreenBtn   = document.getElementById('fullscreenBtn')   as HTMLButtonElement;

const fpsEl           = document.getElementById('fps')             as HTMLElement;
const gpsEl           = document.getElementById('gps')             as HTMLElement;
const frameTimeEl     = document.getElementById('frameTime')       as HTMLElement;
const engineBadge     = document.getElementById('engineBadge')     as HTMLElement;
const hintEl          = document.getElementById('hint')            as HTMLElement;

// Transport Dock
const playBtn         = document.getElementById('play')            as HTMLButtonElement;
const stepBtn         = document.getElementById('step')            as HTMLButtonElement;
const undoBtn         = document.getElementById('undo')            as HTMLButtonElement;
const clearBtn        = document.getElementById('clear')           as HTMLButtonElement;
const randomBtn       = document.getElementById('random')          as HTMLButtonElement;

const toolDrawBtn     = document.getElementById('toolDraw')        as HTMLButtonElement;
const toolEraseBtn    = document.getElementById('toolErase')       as HTMLButtonElement;
const toolPanBtn      = document.getElementById('toolPan')         as HTMLButtonElement;
const toolStampBtn    = document.getElementById('toolStamp')       as HTMLButtonElement;

const brush1Btn       = document.getElementById('brush1')          as HTMLButtonElement;
const brush3Btn       = document.getElementById('brush3')          as HTMLButtonElement;
const brush5Btn       = document.getElementById('brush5')          as HTMLButtonElement;

// Tab 1: Config
const generationEl    = document.getElementById('generation')      as HTMLElement;
const liveEl          = document.getElementById('live')            as HTMLElement;
const sizeEl          = document.getElementById('size')            as HTMLElement;
const activeEngineText = document.getElementById('activeEngineText') as HTMLElement;
const engineSelect    = document.getElementById('engineSelect')    as HTMLSelectElement;
const wallToggle      = document.getElementById('wallToggle')      as HTMLInputElement;
const colorModeSelect = document.getElementById('colorModeSelect') as HTMLSelectElement;
const gridSizeSelect  = document.getElementById('gridSizeSelect')  as HTMLSelectElement;
const substepsSelect  = document.getElementById('substepsSelect')  as HTMLSelectElement;
const speedInput      = document.getElementById('speed')           as HTMLInputElement;
const speedValue      = document.getElementById('speedValue')      as HTMLElement;
const densityInput    = document.getElementById('density')         as HTMLInputElement;
const densityValue    = document.getElementById('densityValue')    as HTMLElement;

// Tab 2: Patterns
const patternSearch   = document.getElementById('patternSearch')   as HTMLInputElement;
const patternGrid     = document.getElementById('patternGrid')     as HTMLElement;
const patternTools    = document.getElementById('patternTools')    as HTMLElement;
const activePatternLabel = document.getElementById('activePatternLabel') as HTMLElement;
const rotatePatternBtn = document.getElementById('rotatePatternBtn') as HTMLButtonElement;
const flipHBtn        = document.getElementById('flipHBtn')        as HTMLButtonElement;
const flipVBtn        = document.getElementById('flipVBtn')        as HTMLButtonElement;
const centerPatternBtn = document.getElementById('centerPatternBtn') as HTMLButtonElement;
const cancelPattern   = document.getElementById('cancelPattern')   as HTMLButtonElement;

// Tab 3: Telemetry
const sparklineCanvas = document.getElementById('sparklineCanvas') as HTMLCanvasElement;
const popTrendBadge   = document.getElementById('popTrendBadge')   as HTMLElement;
const popMinEl        = document.getElementById('popMin')          as HTMLElement;
const popAvgEl        = document.getElementById('popAvg')          as HTMLElement;
const popMaxEl        = document.getElementById('popMax')          as HTMLElement;
const runBenchmarkBtn = document.getElementById('runBenchmark')    as HTMLButtonElement;
const benchmarkResult = document.getElementById('benchmarkResult') as HTMLElement;

// Shortcuts Modal
const shortcutsModal  = document.getElementById('shortcutsModal')  as HTMLDialogElement;
const closeShortcutsModal = document.getElementById('closeShortcutsModal') as HTMLButtonElement;

// ── State ─────────────────────────────────────────────────────────────────────

type EngineMode = 'client-gpu' | 'server-parallel' | 'server-single';
type ActiveTool = 'draw' | 'erase' | 'pan' | 'stamp';

let currentEngine: EngineMode = 'client-gpu';
let state: GameState = { rows: 42, cols: 72, generation: 0, liveCells: 0, cells: [] };
let running = false;
let painting = false;
let paintAlive = true;

// Tools & Navigation
let activeTool: ActiveTool = 'draw';
let brushRadius: 1 | 3 | 5 = 1;
let zoom = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panStartOffset = { x: 0, y: 0 };
let spaceHeld = false;

// Undo Stack (max 20 snapshots)
const undoStack: boolean[][][] = [];

// Patterns & Transforms
let selectedPattern: string | null = null;
let patternRotation = 0; // 0, 90, 180, 270
let patternFlipH = false;
let patternFlipV = false;
let activeCategory = 'all';
let lastHoverCell: { row: number; col: number } | null = null;
const patternCatalog = new Map<string, PatternInfo>();

// Telemetry History
const popHistory: number[] = [];

let webglEngine: WebGLEngine | null = null;
let animFrameId: number | null = null;
let serverTimer: ReturnType<typeof setTimeout> | null = null;

// Performance metrics
let frameCount = 0;
let genCount = 0;
let lastPerfTime = performance.now();
let lastTickTime = performance.now();

// ── Pattern Catalog Definitions ───────────────────────────────────────────────

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

const PATTERN_CATEGORIES: Record<string, string> = {
  glider: 'spaceships',
  lwss: 'spaceships',
  gosper: 'guns',
  blinker: 'oscillators',
  toad: 'oscillators',
  beacon: 'oscillators',
  pulsar: 'oscillators',
  pentadecathlon: 'oscillators',
  block: 'still',
  beehive: 'still',
};

// ── WebGL Initialization ──────────────────────────────────────────────────────

function initGPU(rows: number, cols: number): void {
  try {
    if (!webglEngine) {
      webglEngine = new WebGLEngine(board, rows, cols);
    } else {
      webglEngine.resize(rows, cols, false);
    }
    webglEngine.setPanZoom(panX, panY, zoom);
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
    quickEngine.textContent = 'GPU WebGL2';
    activeEngineText.textContent = 'GPU Shader';
    activeEngineText.style.color = 'var(--phosphor)';
  } else if (currentEngine === 'server-parallel') {
    engineBadge.textContent = 'CPU Multi-thread';
    quickEngine.textContent = 'Java Parallel';
    activeEngineText.textContent = 'Java Parallel';
    activeEngineText.style.color = 'var(--amber)';
  } else {
    engineBadge.textContent = 'CPU Single-thread';
    quickEngine.textContent = 'Java Sequential';
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

  quickGen.textContent  = String(state.generation);
  quickLive.textContent = String(state.liveCells);
  quickSize.textContent = `${state.rows} × ${state.cols}`;

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
    webglEngine.setPanZoom(panX, panY, zoom);
    webglEngine.render(board.width, board.height);
  }

  recordPopulation(state.liveCells);
}

function renderGPU(): void {
  if (!webglEngine) return;
  webglEngine.setPanZoom(panX, panY, zoom);
  webglEngine.render(board.width, board.height);
  frameCount++;
}

// ── Undo Stack Management ────────────────────────────────────────────────────

function pushUndoSnapshot(): void {
  if (!state.cells || state.cells.length === 0) return;
  const copy = state.cells.map(row => [...row]);
  undoStack.push(copy);
  if (undoStack.length > 25) {
    undoStack.shift();
  }
}

async function performUndo(): Promise<void> {
  if (undoStack.length === 0) {
    hintEl.textContent = 'Nothing to undo.';
    return;
  }
  const previous = undoStack.pop()!;
  state.cells = previous;

  let liveCount = 0;
  for (const row of previous) {
    for (const cell of row) {
      if (cell) liveCount++;
    }
  }
  state.liveCells = liveCount;
  liveEl.textContent = String(liveCount);
  quickLive.textContent = String(liveCount);

  if (currentEngine === 'client-gpu' && webglEngine) {
    webglEngine.loadGrid(previous);
    renderGPU();
  } else {
    try {
      await api<GameState>('/api/game/grid', {
        method: 'POST',
        body: JSON.stringify({
          rows: state.rows,
          cols: state.cols,
          generation: state.generation,
          cells: previous,
        } as GridSyncRequest),
      });
    } catch (e) {
      console.warn('Undo sync to server:', e);
    }
  }
  hintEl.textContent = 'Undid last canvas action.';
}

// ── Pan & Zoom Navigation ────────────────────────────────────────────────────

function updateZoomUI(): void {
  zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
}

function zoomToFit(): void {
  zoom = 1.0;
  panX = 0;
  panY = 0;
  updateZoomUI();
  if (webglEngine) {
    webglEngine.setPanZoom(panX, panY, zoom);
    renderGPU();
  }
  hintEl.textContent = 'Zoom reset to 100% fit.';
}

function zoomBy(factor: number): void {
  const nextZoom = Math.max(1.0, Math.min(zoom * factor, 32.0));
  zoom = nextZoom;
  updateZoomUI();
  if (webglEngine) {
    webglEngine.setPanZoom(panX, panY, zoom);
    renderGPU();
  }
}

zoomInBtn.addEventListener('click', () => zoomBy(1.25));
zoomOutBtn.addEventListener('click', () => zoomBy(1 / 1.25));
resetZoomBtn.addEventListener('click', zoomToFit);

board.addEventListener('wheel', (e: WheelEvent) => {
  e.preventDefault();
  const rect = board.getBoundingClientRect();
  const mouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const mouseY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

  // Position under cursor in normalized UV space before zoom
  const uvX = (mouseX - 0.5) / zoom + 0.5 + panX;
  const uvY = (mouseY - 0.5) / zoom + 0.5 + panY;

  const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
  const nextZoom = Math.max(1.0, Math.min(zoom * factor, 32.0));

  // Offset pan to keep the point under the mouse cursor fixed
  panX = uvX - 0.5 - (mouseX - 0.5) / nextZoom;
  panY = uvY - 0.5 - (mouseY - 0.5) / nextZoom;
  zoom = nextZoom;

  // Bound pan within reasonable borders
  const maxPan = 0.5;
  panX = Math.max(-maxPan, Math.min(maxPan, panX));
  panY = Math.max(-maxPan, Math.min(maxPan, panY));

  updateZoomUI();
  if (webglEngine) {
    webglEngine.setPanZoom(panX, panY, zoom);
    renderGPU();
  }
}, { passive: false });

// ── Coordinate Translation with Pan & Zoom ────────────────────────────────────

function cellFromEvent(event: PointerEvent): { row: number; col: number; inBounds: boolean } {
  const rect = board.getBoundingClientRect();
  const mouseX = (event.clientX - rect.left) / rect.width;
  const mouseY = (event.clientY - rect.top) / rect.height;

  // Reverse shader transformation:
  // zoomedUV = (screenUV - 0.5) / zoom + 0.5 + pan
  const uvX = (mouseX - 0.5) / zoom + 0.5 + panX;
  const uvY = (mouseY - 0.5) / zoom + 0.5 + panY;

  if (uvX < 0 || uvX >= 1 || uvY < 0 || uvY >= 1) {
    return { row: -1, col: -1, inBounds: false };
  }

  const col = Math.floor(uvX * state.cols);
  const row = Math.floor(uvY * state.rows);
  return { row, col, inBounds: true };
}

// ── Tool Selection & Brush Logic ──────────────────────────────────────────────

function setTool(tool: ActiveTool): void {
  activeTool = tool;
  [toolDrawBtn, toolEraseBtn, toolPanBtn, toolStampBtn].forEach(btn => btn.classList.remove('active'));

  if (tool === 'draw') toolDrawBtn.classList.add('active');
  if (tool === 'erase') toolEraseBtn.classList.add('active');
  if (tool === 'pan') toolPanBtn.classList.add('active');
  if (tool === 'stamp') toolStampBtn.classList.add('active');

  if (tool === 'pan') {
    board.style.cursor = 'grab';
  } else if (tool === 'stamp') {
    board.style.cursor = 'copy';
  } else {
    board.style.cursor = 'crosshair';
  }

  if (tool !== 'stamp' && selectedPattern) {
    setPattern(null);
  }
}

toolDrawBtn.addEventListener('click', () => setTool('draw'));
toolEraseBtn.addEventListener('click', () => setTool('erase'));
toolPanBtn.addEventListener('click', () => setTool('pan'));
toolStampBtn.addEventListener('click', () => {
  setTool('stamp');
  // Auto open pattern tab
  switchTab('patterns');
  if (!selectedPattern && patternCatalog.size > 0) {
    const first = patternCatalog.keys().next().value;
    if (first) setPattern(first);
  }
});

function setBrushSize(size: 1 | 3 | 5): void {
  brushRadius = size;
  [brush1Btn, brush3Btn, brush5Btn].forEach(b => b.classList.remove('active'));
  if (size === 1) brush1Btn.classList.add('active');
  if (size === 3) brush3Btn.classList.add('active');
  if (size === 5) brush5Btn.classList.add('active');
}

brush1Btn.addEventListener('click', () => setBrushSize(1));
brush3Btn.addEventListener('click', () => setBrushSize(3));
brush5Btn.addEventListener('click', () => setBrushSize(5));

async function paintBrush(centerRow: number, centerCol: number, alive: boolean): Promise<void> {
  const half = Math.floor(brushRadius / 2);
  const affected: [number, number][] = [];

  for (let dr = -half; dr <= half; dr++) {
    for (let dc = -half; dc <= half; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
        affected.push([r, c]);
      }
    }
  }

  if (currentEngine === 'client-gpu' && webglEngine) {
    for (const [r, c] of affected) {
      if (!webglEngine.wallMode || (r >= 2 && r < state.rows - 2 && c >= 2 && c < state.cols - 2)) {
        webglEngine.setCell(r, c, alive);
        if (state.cells && state.cells[r]) {
          state.cells[r][c] = alive;
        }
      }
    }
    webglEngine.render(board.width, board.height);
    const extracted = webglEngine.extractGrid();
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(state.liveCells);
    quickLive.textContent = String(state.liveCells);
  } else {
    for (const [r, c] of affected) {
      if (state.cells && state.cells[r]) {
        state.cells[r][c] = alive;
      }
      await api<GameState>('/api/game/paint', {
        method: 'POST',
        body: JSON.stringify({ row: r, col: c, alive } as PaintRequest),
      });
    }
    const snap = await api<GameState>('/api/game');
    applyState(snap);
  }
}

// ── Transformed Patterns (Rotate, Flip H, Flip V) ─────────────────────────────

function getTransformedPatternCells(patternId: string, rotationDeg: number, flipH: boolean, flipV: boolean): [number, number][] {
  const pattern = patternCatalog.get(patternId);
  const rawCells: [number, number][] = (pattern && pattern.cells && pattern.cells.length > 0)
    ? pattern.cells.map(c => [c.row, c.col] as [number, number])
    : (DEFAULT_PATTERNS[patternId.toLowerCase()] || []);

  if (rawCells.length === 0) return [];

  let cells = rawCells.map(([r, c]) => [r, c] as [number, number]);

  // Apply 90° clockwise rotation steps
  const steps = Math.floor(((rotationDeg % 360) + 360) % 360 / 90);
  for (let s = 0; s < steps; s++) {
    cells = cells.map(([r, c]) => [c, -r]);
  }

  // Apply horizontal flip
  if (flipH) {
    cells = cells.map(([r, c]) => [r, -c]);
  }

  // Apply vertical flip
  if (flipV) {
    cells = cells.map(([r, c]) => [-r, c]);
  }

  // Normalize so bounding box starts at (0, 0)
  const minR = Math.min(...cells.map(c => c[0]));
  const minC = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

async function stamp(row: number, col: number): Promise<void> {
  if (!selectedPattern) return;
  pushUndoSnapshot();

  const patternId = selectedPattern;
  const rawCells = getTransformedPatternCells(patternId, patternRotation, patternFlipH, patternFlipV);
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
    quickLive.textContent = String(state.liveCells);
  } else {
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

// ── Pattern Studio & Miniature Previews ───────────────────────────────────────

function createPatternPreviewCanvas(rawCells: [number, number][]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 60;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx || rawCells.length === 0) return canvas;

  const maxR = Math.max(...rawCells.map(c => c[0])) + 1;
  const maxC = Math.max(...rawCells.map(c => c[1])) + 1;

  const cellSize = Math.min(Math.floor(40 / Math.max(maxR, maxC)), 7);
  const startX = Math.floor((60 - maxC * cellSize) / 2);
  const startY = Math.floor((48 - maxR * cellSize) / 2);

  ctx.fillStyle = '#d9e36a';
  for (const [r, c] of rawCells) {
    ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize - 1, cellSize - 1);
  }
  return canvas;
}

function renderPatternGrid(): void {
  patternGrid.innerHTML = '';
  const search = (patternSearch?.value || '').toLowerCase().trim();

  patternCatalog.forEach((pattern) => {
    const cat = PATTERN_CATEGORIES[pattern.id.toLowerCase()] || 'other';
    if (activeCategory !== 'all' && cat !== activeCategory) {
      return;
    }
    if (search && !pattern.name.toLowerCase().includes(search) && !pattern.description.toLowerCase().includes(search)) {
      return;
    }

    const card = document.createElement('div');
    card.className = `pattern-card ${selectedPattern === pattern.id ? 'active' : ''}`;
    card.dataset.id = pattern.id;

    const rawCells = (pattern.cells && pattern.cells.length > 0)
      ? pattern.cells.map(c => [c.row, c.col] as [number, number])
      : (DEFAULT_PATTERNS[pattern.id.toLowerCase()] || []);

    const preview = document.createElement('div');
    preview.className = 'pattern-card-preview';
    preview.appendChild(createPatternPreviewCanvas(rawCells));

    const title = document.createElement('div');
    title.className = 'pattern-card-title';
    title.textContent = pattern.name;

    const catBadge = document.createElement('div');
    catBadge.className = 'pattern-card-cat';
    catBadge.textContent = cat;

    card.appendChild(preview);
    card.appendChild(title);
    card.appendChild(catBadge);

    card.addEventListener('click', () => {
      setPattern(selectedPattern === pattern.id ? null : pattern.id);
    });

    patternGrid.appendChild(card);
  });
}

function setPattern(id: string | null): void {
  selectedPattern = id;
  patternRotation = 0;
  patternFlipH = false;
  patternFlipV = false;

  if (id) {
    setTool('stamp');
    patternTools.hidden = false;
    const pat = patternCatalog.get(id);
    activePatternLabel.textContent = pat ? pat.name : id;
  } else {
    patternTools.hidden = true;
    if (webglEngine) {
      webglEngine.clearGhostPattern();
      renderGPU();
    }
  }

  updatePatternHint();
  renderPatternGrid();
}

function updatePatternHint(): void {
  if (selectedPattern) {
    const rot = patternRotation > 0 ? ` [${patternRotation}°]` : '';
    const h = patternFlipH ? ' [FlipH]' : '';
    const v = patternFlipV ? ' [FlipV]' : '';
    hintEl.textContent = `Stamping \u201c${selectedPattern}\u201d${rot}${h}${v} · Move over board to preview, click to place. (R: Rotate, H/V: Flip, Esc: Cancel)`;
  } else {
    hintEl.textContent = 'Click or drag to paint cells. Hold Space or use Pan tool to navigate canvas.';
  }
}

rotatePatternBtn.addEventListener('click', () => {
  if (!selectedPattern) return;
  patternRotation = (patternRotation + 90) % 360;
  updatePatternHint();
  updateGhostOverlay();
});

flipHBtn.addEventListener('click', () => {
  if (!selectedPattern) return;
  patternFlipH = !patternFlipH;
  updatePatternHint();
  updateGhostOverlay();
});

flipVBtn.addEventListener('click', () => {
  if (!selectedPattern) return;
  patternFlipV = !patternFlipV;
  updatePatternHint();
  updateGhostOverlay();
});

centerPatternBtn.addEventListener('click', async () => {
  if (!selectedPattern) return;
  const rawCells = getTransformedPatternCells(selectedPattern, patternRotation, patternFlipH, patternFlipV);
  if (rawCells.length === 0) return;
  const maxR = Math.max(...rawCells.map(c => c[0]));
  const maxC = Math.max(...rawCells.map(c => c[1]));
  const centerR = Math.max(0, Math.floor((state.rows - maxR) / 2));
  const centerC = Math.max(0, Math.floor((state.cols - maxC) / 2));
  await stamp(centerR, centerC);
  hintEl.textContent = `Stamped \u201c${selectedPattern}\u201d at grid center!`;
});

cancelPattern.addEventListener('click', () => setPattern(null));

function updateGhostOverlay(): void {
  if (!selectedPattern || !webglEngine || !lastHoverCell) return;
  const rawCells = getTransformedPatternCells(selectedPattern, patternRotation, patternFlipH, patternFlipV);
  webglEngine.setGhostPattern(lastHoverCell.col, lastHoverCell.row, rawCells);
  renderGPU();
}

// Category filter tabs
document.querySelectorAll<HTMLButtonElement>('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeCategory = pill.dataset.cat || 'all';
    renderPatternGrid();
  });
});

patternSearch?.addEventListener('input', () => renderPatternGrid());

// ── Tabbed Sidebar Controller ─────────────────────────────────────────────────

function switchTab(tabId: string): void {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');
}

document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    if (tabId) switchTab(tabId);
  });
});

// ── Telemetry Sparkline Graph ─────────────────────────────────────────────────

function recordPopulation(count: number): void {
  popHistory.push(count);
  if (popHistory.length > 100) {
    popHistory.shift();
  }
  drawSparkline();
}

function drawSparkline(): void {
  if (!sparklineCanvas) return;
  const ctx = sparklineCanvas.getContext('2d');
  if (!ctx) return;

  const w = sparklineCanvas.width;
  const h = sparklineCanvas.height;
  ctx.clearRect(0, 0, w, h);

  if (popHistory.length < 2) return;

  const min = Math.min(...popHistory);
  const max = Math.max(...popHistory);
  const avg = Math.round(popHistory.reduce((a, b) => a + b, 0) / popHistory.length);

  popMinEl.textContent = String(min);
  popAvgEl.textContent = String(avg);
  popMaxEl.textContent = String(max);

  // Classify trend
  const last10 = popHistory.slice(-10);
  const diff = last10[last10.length - 1] - last10[0];
  if (diff > 5) {
    popTrendBadge.textContent = 'Growing';
    popTrendBadge.style.color = 'var(--phosphor)';
  } else if (diff < -5) {
    popTrendBadge.textContent = 'Declining';
    popTrendBadge.style.color = 'var(--danger)';
  } else {
    popTrendBadge.textContent = 'Stable';
    popTrendBadge.style.color = 'var(--cyan)';
  }

  // Draw sparkline path
  const range = max === min ? 1 : max - min;
  const stepX = w / (popHistory.length - 1);

  // Gradient fill under curve
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
  grad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');

  ctx.beginPath();
  for (let i = 0; i < popHistory.length; i++) {
    const x = i * stepX;
    const y = h - ((popHistory[i] - min) / range) * (h - 16) - 8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line stroke
  ctx.beginPath();
  for (let i = 0; i < popHistory.length; i++) {
    const x = i * stepX;
    const y = h - ((popHistory[i] - min) / range) * (h - 16) - 8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.stroke();
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
  quickGen.textContent = String(state.generation);
  renderGPU();

  if (state.generation % 30 === 0 && webglEngine) {
    const extracted = webglEngine.extractGrid();
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(extracted.liveCells);
    quickLive.textContent = String(extracted.liveCells);
    recordPopulation(extracted.liveCells);
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
    for (let i = 0; i < stepsPerFrame; i++) {
      stepGPUNoRender();
    }
    generationEl.textContent = String(state.generation);
    quickGen.textContent = String(state.generation);
    renderGPU();
  } else {
    const now = performance.now();
    if (now - lastTickTime >= interval) {
      for (let i = 0; i < stepsPerFrame; i++) {
        stepGPUNoRender();
      }
      generationEl.textContent = String(state.generation);
      quickGen.textContent = String(state.generation);
      renderGPU();
      lastTickTime = now;
    } else {
      renderGPU();
    }
  }

  if (state.generation % 30 === 0 && webglEngine) {
    const extracted = webglEngine.extractGrid();
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(extracted.liveCells);
    quickLive.textContent = String(extracted.liveCells);
    recordPopulation(extracted.liveCells);
  }

  updateMetrics();
  animFrameId = requestAnimationFrame(gpuPlayLoop);
}

function start(): void {
  if (running) return;
  running = true;
  playBtn.textContent = '⏸ Pause';
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
  playBtn.textContent = '▶ Play';
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
    quickLive.textContent = String(state.liveCells);
    recordPopulation(extracted.liveCells);
  }
}

// ── Performance Metrics ───────────────────────────────────────────────────────

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

// ── Pointer & Drag Interactions (Draw, Erase, Pan, Stamp) ─────────────────────

board.addEventListener('pointerdown', async (event: PointerEvent) => {
  // Check if middle-click or space-drag for pan
  if (event.button === 1 || spaceHeld || activeTool === 'pan') {
    isPanning = true;
    panStart = { x: event.clientX, y: event.clientY };
    panStartOffset = { x: panX, y: panY };
    board.setPointerCapture(event.pointerId);
    board.style.cursor = 'grabbing';
    return;
  }

  const { row, col, inBounds } = cellFromEvent(event);
  if (!inBounds) return;

  if (activeTool === 'stamp' && selectedPattern) {
    await stamp(row, col);
    return;
  }

  pushUndoSnapshot();
  painting = true;
  board.setPointerCapture(event.pointerId);

  if (activeTool === 'erase') {
    paintAlive = false;
  } else {
    // Toggle on draw
    paintAlive = !(state.cells && state.cells[row] && state.cells[row][col]);
  }
  await paintBrush(row, col, paintAlive);
});

board.addEventListener('pointermove', async (event: PointerEvent) => {
  if (isPanning) {
    const rect = board.getBoundingClientRect();
    const dx = (event.clientX - panStart.x) / rect.width / zoom;
    const dy = (event.clientY - panStart.y) / rect.height / zoom;
    panX = panStartOffset.x - dx;
    panY = panStartOffset.y - dy;
    const maxPan = 0.5;
    panX = Math.max(-maxPan, Math.min(maxPan, panX));
    panY = Math.max(-maxPan, Math.min(maxPan, panY));
    if (webglEngine) {
      webglEngine.setPanZoom(panX, panY, zoom);
      renderGPU();
    }
    return;
  }

  const { row, col, inBounds } = cellFromEvent(event);

  // Update cell inspector chip
  if (inBounds) {
    lastHoverCell = { row, col };
    cellInspector.hidden = false;
    cellInspector.style.left = `${event.clientX}px`;
    cellInspector.style.top = `${event.clientY}px`;
    const alive = state.cells && state.cells[row] && state.cells[row][col];
    inspectorCoords.textContent = `X: ${col}, Y: ${row}`;
    inspectorState.textContent = alive ? '● Alive' : '○ Dead';
    inspectorState.style.color = alive ? 'var(--phosphor)' : 'var(--muted)';
  } else {
    cellInspector.hidden = true;
    lastHoverCell = null;
  }

  // Ghost pattern overlay
  if (activeTool === 'stamp' && selectedPattern && inBounds) {
    updateGhostOverlay();
    return;
  }

  if (!painting || !inBounds) return;
  await paintBrush(row, col, paintAlive);
});

board.addEventListener('pointerup', (event: PointerEvent) => {
  if (isPanning) {
    isPanning = false;
    board.releasePointerCapture(event.pointerId);
    board.style.cursor = activeTool === 'pan' ? 'grab' : 'crosshair';
  }
  painting = false;
});

board.addEventListener('pointercancel', () => {
  isPanning = false;
  painting = false;
});

board.addEventListener('pointerleave', () => {
  cellInspector.hidden = true;
  lastHoverCell = null;
  if (selectedPattern && webglEngine) {
    webglEngine.clearGhostPattern();
    renderGPU();
  }
});

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

undoBtn.addEventListener('click', performUndo);

clearBtn.addEventListener('click', async () => {
  pushUndoSnapshot();
  stop();
  if (currentEngine === 'client-gpu' && webglEngine) {
    webglEngine.clear();
    state.generation = 0;
    state.liveCells = 0;
    generationEl.textContent = '0';
    liveEl.textContent = '0';
    quickGen.textContent = '0';
    quickLive.textContent = '0';
    renderGPU();
  }
  applyState(await api<GameState>('/api/game/clear', { method: 'POST' }));
  hintEl.textContent = 'Grid cleared.';
});

randomBtn.addEventListener('click', async () => {
  pushUndoSnapshot();
  stop();
  const density = Number(densityInput.value);
  if (currentEngine === 'client-gpu' && webglEngine) {
    webglEngine.randomize(density);
    state.generation = 0;
    generationEl.textContent = '0';
    quickGen.textContent = '0';
    const extracted = webglEngine.extractGrid();
    state.cells = extracted.cells;
    state.liveCells = extracted.liveCells;
    liveEl.textContent = String(state.liveCells);
    quickLive.textContent = String(state.liveCells);
    renderGPU();
  } else {
    const body: RandomizeRequest = { density };
    applyState(await api<GameState>('/api/game/random', {
      method: 'POST',
      body: JSON.stringify(body),
    }));
  }
  hintEl.textContent = `Spawned random soup at ${Math.round(density * 100)}% density.`;
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
    quickLive.textContent = String(state.liveCells);
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
    ? '🧱 2-Cell Wall Barrier active: Boundary acts as an absorbing collision wall.'
    : '🔄 Toroidal Wrap active: Cells wrap around boundaries seamlessly.';
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

  const serverState = await api<GameState>('/api/game');
  applyState(serverState);

  if (wasRunning) {
    start();
  }
});

// Grid resolution resize listener — Zero-Loss Resizing
gridSizeSelect.addEventListener('change', async () => {
  const wasRunning = running;
  stop();

  const [rows, cols] = gridSizeSelect.value.split('x').map(Number);

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
  quickSize.textContent = `${rows} × ${cols}`;
  liveEl.textContent = String(liveCount);
  quickLive.textContent = String(liveCount);

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
    webglEngine.setPanZoom(panX, panY, zoom);
    renderGPU();
  }

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
    quickSize.textContent = `${rows} × ${cols}`;

    board.width = 1024;
    board.height = 1024;

    if (webglEngine) {
      webglEngine.resize(rows, cols, false);
      webglEngine.loadStressPreset(preset);
      const extracted = webglEngine.extractGrid();
      state.cells = extracted.cells;
      state.liveCells = extracted.liveCells;
      liveEl.textContent = String(state.liveCells);
      quickLive.textContent = String(state.liveCells);
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

    hintEl.textContent = `🚀 Stress preset "${btn.querySelector('strong')?.textContent?.trim()}" running at full GPU speed!`;
    start();
  });
});

// Benchmark runner listener
runBenchmarkBtn.addEventListener('click', async () => {
  runBenchmarkBtn.disabled = true;
  runBenchmarkBtn.textContent = 'Running...';
  benchmarkResult.hidden = false;
  benchmarkResult.innerHTML = '<em>Warming up JIT & benchmarking all CPU cores...</em>';

  try {
    const res = await api<BenchmarkResponse>('/api/game/benchmark', {
      method: 'POST',
      body: JSON.stringify({ generations: 200, rows: 128, cols: 128 }),
    });

    benchmarkResult.innerHTML = `
      <div>Grid: <strong>${res.rows} × ${res.cols}</strong> (${res.totalCells.toLocaleString()} cells) · Cores: <strong>${res.availableProcessors}</strong></div>
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

// Fullscreen
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    viewport.requestFullscreen().catch(() => {});
    fullscreenBtn.textContent = '✕ Exit';
  } else {
    document.exitFullscreen().catch(() => {});
    fullscreenBtn.textContent = '⛶ Fullscreen';
  }
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    fullscreenBtn.textContent = '⛶ Fullscreen';
  }
});

// Shortcuts Modal
shortcutsBtn.addEventListener('click', () => shortcutsModal.showModal());
closeShortcutsModal.addEventListener('click', () => shortcutsModal.close());
shortcutsModal.addEventListener('click', (e) => {
  if (e.target === shortcutsModal) shortcutsModal.close();
});

// ── Global Keyboard Accelerators ──────────────────────────────────────────────

window.addEventListener('keydown', (e: KeyboardEvent) => {
  // If active in text input, ignore simulation shortcuts
  if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
    if (e.key === 'Escape') {
      (document.activeElement as HTMLElement).blur();
    }
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    running ? stop() : start();
  } else if (e.key === 'ArrowRight' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    stop();
    if (currentEngine === 'client-gpu') stepGPU();
    else stepServer();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    performUndo();
  } else if (e.key === 'c' || e.key === 'C') {
    clearBtn.click();
  } else if (e.key === 'w' || e.key === 'W') {
    wallToggle.checked = !wallToggle.checked;
    wallToggle.dispatchEvent(new Event('change'));
  } else if (e.key === 'r' || e.key === 'R') {
    if (selectedPattern) {
      patternRotation = (patternRotation + 90) % 360;
      updatePatternHint();
      updateGhostOverlay();
    } else {
      randomBtn.click();
    }
  } else if (e.key === 'h' || e.key === 'H') {
    if (selectedPattern) {
      patternFlipH = !patternFlipH;
      updatePatternHint();
      updateGhostOverlay();
    }
  } else if (e.key === 'v' || e.key === 'V') {
    if (selectedPattern) {
      patternFlipV = !patternFlipV;
      updatePatternHint();
      updateGhostOverlay();
    }
  } else if (e.key === 'd' || e.key === 'D') {
    setTool('draw');
  } else if (e.key === 'e' || e.key === 'E') {
    setTool('erase');
  } else if (e.key === 'p' || e.key === 'P') {
    setTool('pan');
  } else if (e.key === 't' || e.key === 'T') {
    setTool('stamp');
  } else if (e.key === '1') {
    colorModeSelect.value = '0';
    colorModeSelect.dispatchEvent(new Event('change'));
  } else if (e.key === '2') {
    colorModeSelect.value = '1';
    colorModeSelect.dispatchEvent(new Event('change'));
  } else if (e.key === '3') {
    colorModeSelect.value = '2';
    colorModeSelect.dispatchEvent(new Event('change'));
  } else if (e.key === '4') {
    colorModeSelect.value = '3';
    colorModeSelect.dispatchEvent(new Event('change'));
  } else if (e.key === '+' || e.key === '=') {
    zoomBy(1.25);
  } else if (e.key === '-' || e.key === '_') {
    zoomBy(1 / 1.25);
  } else if (e.key === '0') {
    zoomToFit();
  } else if (e.key === 'f' || e.key === 'F') {
    fullscreenBtn.click();
  } else if (e.key === '?') {
    shortcutsModal.open ? shortcutsModal.close() : shortcutsModal.showModal();
  } else if (e.key === 'Escape') {
    if (shortcutsModal.open) {
      shortcutsModal.close();
    } else if (selectedPattern) {
      setPattern(null);
    }
  }
});

// Spacebar hold for temporary panning
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Space' && !spaceHeld && !(document.activeElement instanceof HTMLInputElement)) {
    spaceHeld = true;
    if (activeTool !== 'pan') {
      board.style.cursor = 'grab';
    }
  }
});

window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spaceHeld = false;
    if (activeTool !== 'pan') {
      board.style.cursor = activeTool === 'stamp' ? 'copy' : 'crosshair';
    }
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  updateEngineLabels();
  updateZoomUI();

  const patterns = await api<PatternInfo[]>('/api/game/patterns');
  patternCatalog.clear();
  patterns.forEach((pattern) => {
    patternCatalog.set(pattern.id, pattern);
  });
  renderPatternGrid();

  const initial = await api<GameState>('/api/game');
  initGPU(initial.rows, initial.cols);
  applyState(initial);

  const initialSpeed = Number(speedInput.value);
  if (initialSpeed === 0) {
    speedValue.textContent = '⚡ Uncapped (Hardware Native Hz)';
  } else {
    speedValue.textContent = `${initialSpeed} ms (${Math.round(1000 / initialSpeed)} tps)`;
  }

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
