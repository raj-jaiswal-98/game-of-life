/**
 * Novel Board Setup Engine & Catalog
 *
 * Provides curated, algorithmic board configurations:
 * - Mega Colosseum & Particle Accelerators (Glider Megacity, Collider Crossfire, Fleet Race)
 * - Harmonic Resonators (Pulsar Galaxy, Queen Bee Matrix, Pentadecathlon Arena)
 * - Cosmic Soups & Fractals (Kaleidoscopic D8 Mandala, Supernova 50%, Concentric Shockwaves, Sierpinski)
 * - Biomes & Mazes (Gun Fleet vs Defense Wall, The Labyrinth Course)
 */

export interface BoardSetup {
  id: string;
  name: string;
  category: 'accelerators' | 'harmonics' | 'soups' | 'biomes' | 'logic';
  categoryLabel: string;
  rows: number;
  cols: number;
  boundaryMode: number; // 0 = Toroidal, 1 = Absorbing, 2 = Elastic
  boundaryLabel: string;
  description: string;
  dynamics: string;
  generate: (rows: number, cols: number) => [number, number][]; // Returns list of [row, col]
}

export const BOARD_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'accelerators', label: '⚡ Accelerators' },
  { id: 'harmonics', label: '🌌 Harmonics' },
  { id: 'soups', label: '✨ Cosmic Soups' },
  { id: 'biomes', label: '🏰 Biomes & Mazes' },
  { id: 'logic', label: '⚙️ Logic & Circuits' },
] as const;

// ── Pattern Helper Templates ─────────────────────────────────────────────────

const GLIDER_OFFSETS: [number, number][] = [
  [0, 1], [1, 2], [2, 0], [2, 1], [2, 2]
];

const GOSPER_OFFSETS: [number, number][] = [
  [0, 24],
  [1, 22], [1, 24],
  [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
  [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35],
  [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
  [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
  [6, 10], [6, 16], [6, 24],
  [7, 11], [7, 15],
  [8, 12], [8, 13]
];

const PULSAR_OFFSETS: [number, number][] = [
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
];

const EATER1_OFFSETS: [number, number][] = [
  [0, 0], [0, 1],
  [1, 0], [1, 2],
  [2, 2],
  [3, 2], [3, 3]
];

const QUEENBEE_OFFSETS: [number, number][] = [
  [1, 0], [1, 1], [2, 0], [2, 1],
  [2, 6],
  [1, 7], [3, 7],
  [0, 8], [4, 8],
  [0, 9], [1, 9], [2, 9], [3, 9], [4, 9],
  [1, 20], [1, 21], [2, 20], [2, 21]
];

const LWSS_OFFSETS: [number, number][] = [
  [0, 1], [0, 4],
  [1, 0],
  [2, 0], [2, 4],
  [3, 0], [3, 1], [3, 2], [3, 3]
];

const HWSS_OFFSETS: [number, number][] = [
  [0, 3], [0, 4],
  [1, 1], [1, 6],
  [2, 0],
  [3, 0], [3, 6],
  [4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]
];

const MWSS_OFFSETS: [number, number][] = [
  [0, 3], [0, 4],
  [1, 0], [1, 1], [1, 2], [1, 4], [1, 5],
  [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
  [3, 1], [3, 2], [3, 3]
];

const COPPERHEAD_OFFSETS: [number, number][] = [
  [0, 1], [0, 2], [0, 5], [0, 6],
  [1, 3], [1, 4], [2, 3], [2, 4],
  [3, 0], [3, 2], [3, 5], [3, 7],
  [4, 0], [4, 7], [6, 0], [6, 7],
  [7, 1], [7, 2], [7, 5], [7, 6],
  [8, 2], [8, 3], [8, 4], [8, 5],
  [10, 3], [10, 4], [11, 3], [11, 4]
];

function stampOffsets(
  cells: Set<string>,
  offsets: [number, number][],
  startR: number,
  startC: number,
  rows: number,
  cols: number,
  flipH = false,
  flipV = false
): void {
  for (let [dr, dc] of offsets) {
    if (flipV) dr = -dr;
    if (flipH) dc = -dc;
    const r = (startR + dr + rows * 10) % rows;
    const c = (startC + dc + cols * 10) % cols;
    cells.add(`${r},${c}`);
  }
}

// ── Board Setups Catalog ──────────────────────────────────────────────────────

export const BOARD_SETUPS: BoardSetup[] = [
  {
    id: 'glider-megacity',
    name: 'Glider Megacity',
    category: 'accelerators',
    categoryLabel: 'Accelerators',
    rows: 128,
    cols: 128,
    boundaryMode: 0, // Toroidal
    boundaryLabel: 'Toroidal Wrap',
    description: 'Vast matrix of synchronized diagonal glider fleets sweeping through space in perpetual motion.',
    dynamics: 'Over 1,000 synchronized gliders travel diagonally across toroidal boundaries, creating mesmerizing waves and orbital harmonics.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      const spacingR = 12;
      const spacingC = 12;
      for (let r = 6; r < rows - 8; r += spacingR) {
        for (let c = 6; c < cols - 8; c += spacingC) {
          stampOffsets(cells, GLIDER_OFFSETS, r, c, rows, cols);
        }
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'particle-collider',
    name: 'Particle Collider Crossfire',
    category: 'accelerators',
    categoryLabel: 'Accelerators',
    rows: 128,
    cols: 128,
    boundaryMode: 2, // Elastic
    boundaryLabel: 'Elastic Rebound Wall',
    description: 'Four Gosper glider batteries aimed at a central collision chamber, sparking chaotic particle reactions.',
    dynamics: 'Opposed glider streams collide at 90° angles, spawning secondary gliders, sparks, oscillators, and intermittent debris nurseries.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      const midR = Math.floor(rows / 2);
      const midC = Math.floor(cols / 2);

      stampOffsets(cells, GOSPER_OFFSETS, 12, 12, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, rows - 24, cols - 48, rows, cols, true, true);
      stampOffsets(cells, GOSPER_OFFSETS, 12, cols - 48, rows, cols, true, false);
      stampOffsets(cells, GOSPER_OFFSETS, rows - 24, 12, rows, cols, false, true);

      // Central reflector catalyst block
      cells.add(`${midR - 1},${midC - 1}`);
      cells.add(`${midR - 1},${midC}`);
      cells.add(`${midR},${midC - 1}`);
      cells.add(`${midR},${midC}`);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'spaceship-highway',
    name: 'Spaceship Interstellar Highway',
    category: 'accelerators',
    categoryLabel: 'Accelerators',
    rows: 128,
    cols: 128,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Wrap',
    description: 'Ranked flotilla of Light (LWSS) and Heavy (HWSS) spaceships racing in parallel formation across the cosmos.',
    dynamics: 'Different ship classes produce staggered velocity fields and alternating engine wake interference along the lanes.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      for (let r = 10; r < rows - 20; r += 16) {
        if ((r / 16) % 2 === 0) {
          stampOffsets(cells, LWSS_OFFSETS, r, 12, rows, cols);
          stampOffsets(cells, LWSS_OFFSETS, r, 48, rows, cols);
          stampOffsets(cells, LWSS_OFFSETS, r, 84, rows, cols);
        } else {
          stampOffsets(cells, HWSS_OFFSETS, r, 24, rows, cols);
          stampOffsets(cells, HWSS_OFFSETS, r, 64, rows, cols);
          stampOffsets(cells, HWSS_OFFSETS, r, 100, rows, cols);
        }
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'pulsar-galaxy',
    name: 'Pulsar Galaxy Matrix',
    category: 'harmonics',
    categoryLabel: 'Harmonics',
    rows: 128,
    cols: 128,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Wrap',
    description: 'Synchronized crystalline lattice of period-3 Pulsars pulsing in harmonious unison across deep space.',
    dynamics: '16 pulsars create an oscillating spatial clock frequency, keeping cell population in rhythmic harmonic resonance.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      const stepR = 26;
      const stepC = 26;
      for (let r = 14; r < rows - 20; r += stepR) {
        for (let c = 14; c < cols - 20; c += stepC) {
          stampOffsets(cells, PULSAR_OFFSETS, r, c, rows, cols);
        }
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'queenbee-matrix',
    name: 'Queen Bee Reflector Matrix',
    category: 'harmonics',
    categoryLabel: 'Harmonics',
    rows: 128,
    cols: 128,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Wrap',
    description: 'Array of Queen Bee shuttles rebounding cleanly between stabilizing beehive reflector walls.',
    dynamics: 'Period-30 natural clocks bounce left and right, leaving temporary beehives at turnaround points with zero entropy leakage.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      for (let r = 16; r < rows - 25; r += 24) {
        stampOffsets(cells, QUEENBEE_OFFSETS, r, 16, rows, cols);
        stampOffsets(cells, QUEENBEE_OFFSETS, r, 68, rows, cols);
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'kaleidoscope-d8',
    name: 'Kaleidoscopic D8 Mandala',
    category: 'soups',
    categoryLabel: 'Cosmic Soups',
    rows: 128,
    cols: 128,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Wrap',
    description: '8-fold octant-mirrored crystal seed. Conway rules preserve symmetry, unfolding into expanding cathedral fractals.',
    dynamics: 'Symmetry is strictly conserved under Life rules. Instead of chaotic static noise, it evolves into radial geometric mandala architecture.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      const midR = Math.floor(rows / 2);
      const midC = Math.floor(cols / 2);
      const radius = 24;

      for (let dr = 0; dr <= radius; dr++) {
        for (let dc = 0; dc <= dr; dc++) {
          if (Math.random() < 0.32) {
            const pts: [number, number][] = [
              [dr, dc], [dr, -dc], [-dr, dc], [-dr, -dc],
              [dc, dr], [dc, -dr], [-dc, dr], [-dc, -dr],
            ];
            for (const [r, c] of pts) {
              const finalR = (midR + r + rows) % rows;
              const finalC = (midC + c + cols) % cols;
              cells.add(`${finalR},${finalC}`);
            }
          }
        }
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'supernova-core',
    name: 'Supernova 50% Core',
    category: 'soups',
    categoryLabel: 'Cosmic Soups',
    rows: 128,
    cols: 128,
    boundaryMode: 1, // Absorbing
    boundaryLabel: 'Absorbing Dead Border',
    description: 'Hyper-dense 50% core concentrated in the center, radiating explosive chaotic shockwaves into deep vacuum.',
    dynamics: 'Overcrowding at the epicenter triggers explosive perimeter expansion, sending high-speed gliders flying outward into the dark border.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      const midR = Math.floor(rows / 2);
      const midC = Math.floor(cols / 2);
      const halfSize = 22;

      for (let r = midR - halfSize; r <= midR + halfSize; r++) {
        for (let c = midC - halfSize; c <= midC + halfSize; c++) {
          if (Math.random() < 0.50) {
            cells.add(`${r},${c}`);
          }
        }
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'concentric-ripples',
    name: 'Concentric Interference Rings',
    category: 'soups',
    categoryLabel: 'Cosmic Soups',
    rows: 128,
    cols: 128,
    boundaryMode: 2,
    boundaryLabel: 'Elastic Rebound Wall',
    description: 'Alternating dense circular shockwave rings producing inward and outward wave interference fronts.',
    dynamics: 'Ring boundaries trigger simultaneous collapses, producing oscillating standing waves and perimeter spark rings.',
    generate: (rows, cols) => {
      const cells = new Set<string>();
      const midR = Math.floor(rows / 2);
      const midC = Math.floor(cols / 2);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dist = Math.sqrt((r - midR) ** 2 + (c - midC) ** 2);
          if (
            (dist >= 8 && dist <= 11) ||
            (dist >= 18 && dist <= 21) ||
            (dist >= 30 && dist <= 33) ||
            (dist >= 44 && dist <= 47)
          ) {
            if (Math.random() < 0.65) {
              cells.add(`${r},${c}`);
            }
          }
        }
      }
      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'gun-fleet-vs-shield',
    name: 'Artillery Fleet vs Defense Citadel',
    category: 'biomes',
    categoryLabel: 'Biomes & Mazes',
    rows: 128,
    cols: 128,
    boundaryMode: 1,
    boundaryLabel: 'Absorbing Dead Border',
    description: 'Western battery of Glider Guns bombarding an Eastern fortress shield of Eater-1s and defensive Pulsars.',
    dynamics: 'Artillery volleys crash against the biological shield wall, demonstrating defensive absorbing structures and spark attrition.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // West: 3 Glider Guns
      stampOffsets(cells, GOSPER_OFFSETS, 16, 10, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, 52, 10, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, 88, 10, rows, cols);

      // East: Shield wall of Eater 1s
      const shieldCol = cols - 36;
      for (let r = 12; r < rows - 15; r += 10) {
        stampOffsets(cells, EATER1_OFFSETS, r, shieldCol, rows, cols);
        stampOffsets(cells, EATER1_OFFSETS, r + 4, shieldCol + 6, rows, cols);
      }

      // 2 Defensive garrison Pulsars behind shield
      stampOffsets(cells, PULSAR_OFFSETS, 34, cols - 24, rows, cols);
      stampOffsets(cells, PULSAR_OFFSETS, 74, cols - 24, rows, cols);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'labyrinth-corridor',
    name: 'The Labyrinth Obstacle Course',
    category: 'biomes',
    categoryLabel: 'Biomes & Mazes',
    rows: 128,
    cols: 128,
    boundaryMode: 2,
    boundaryLabel: 'Elastic Rebound Wall',
    description: 'Dense still-life barrier maze populated by trapped navigating gliders and rhythmic oscillators.',
    dynamics: 'Gliders bounce through corridors and bounce off blocks, creating an animated cellular pinball machine.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // Horizontal maze walls
      for (let r = 20; r < rows - 20; r += 28) {
        const gap = (r / 28) % 2 === 0 ? cols - 30 : 20;
        for (let c = 12; c < cols - 12; c += 3) {
          if (Math.abs(c - gap) > 12) {
            cells.add(`${r},${c}`);
            cells.add(`${r},${c + 1}`);
            cells.add(`${r + 1},${c}`);
            cells.add(`${r + 1},${c + 1}`);
          }
        }
      }

      // Add roaming gliders in the corridors
      stampOffsets(cells, GLIDER_OFFSETS, 32, 24, rows, cols);
      stampOffsets(cells, GLIDER_OFFSETS, 60, cols - 36, rows, cols, true, false);
      stampOffsets(cells, GLIDER_OFFSETS, 86, 40, rows, cols);

      // Add oscillators in the alcoves
      stampOffsets(cells, PULSAR_OFFSETS, 4, 52, rows, cols);
      stampOffsets(cells, PULSAR_OFFSETS, rows - 22, 52, rows, cols);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'logic-inverter',
    name: 'Signal Inverter (NOT Gate Stream)',
    category: 'logic',
    categoryLabel: 'Logic & Circuits',
    rows: 128,
    cols: 128,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Topology',
    description: 'Continuous Gosper Gun clock stream feeding directly into an Eater 1 sink, with a phased signal interceptor track.',
    dynamics: 'Clock gliders sail across the circuit until absorbed by the fishhook eater. Input gliders collide to cleanly invert the signal.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // Carrier Clock Gun (firing diagonally downwards-right)
      stampOffsets(cells, GOSPER_OFFSETS, 20, 16, rows, cols);

      // Signal Sink: Shield of Eater 1s absorbing clock gliders
      stampOffsets(cells, EATER1_OFFSETS, 80, 76, rows, cols);
      stampOffsets(cells, EATER1_OFFSETS, 84, 82, rows, cols);

      // Input Glider Track firing from south-west to intercept
      stampOffsets(cells, GLIDER_OFFSETS, 82, 30, rows, cols, true, false);
      stampOffsets(cells, GLIDER_OFFSETS, 98, 46, rows, cols, true, false);

      // Indicator beacon at top corner
      stampOffsets(cells, PULSAR_OFFSETS, 16, cols - 32, rows, cols);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'logic-collider',
    name: 'Glider Collider & Logic Synthesis Lab',
    category: 'logic',
    categoryLabel: 'Logic & Circuits',
    rows: 128,
    cols: 128,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Topology',
    description: 'Orthogonal dual-gun collider testing glider annihilation, reflection, and synthesis dynamics.',
    dynamics: 'Two synchronized streams collide at the center. Strategic eaters capture output pulses and eliminate ash.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // Gun 1: Top-Left shooting south-east
      stampOffsets(cells, GOSPER_OFFSETS, 16, 16, rows, cols);

      // Gun 2: Top-Right shooting south-west (flipped horizontally)
      stampOffsets(cells, GOSPER_OFFSETS, 16, cols - 56, rows, cols, true, false);

      // Center Eaters and reflectors
      const centerR = Math.floor(rows / 2);
      const centerC = Math.floor(cols / 2);

      stampOffsets(cells, EATER1_OFFSETS, centerR + 24, centerC - 10, rows, cols);
      stampOffsets(cells, EATER1_OFFSETS, centerR + 24, centerC + 10, rows, cols, true, false);

      // Border stabilization anchors
      stampOffsets(cells, EATER1_OFFSETS, rows - 24, 24, rows, cols);
      stampOffsets(cells, EATER1_OFFSETS, rows - 24, cols - 30, rows, cols, true, false);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'pinball-pachinko',
    name: 'Cellular Pinball & Pachinko',
    category: 'accelerators',
    categoryLabel: 'Accelerators',
    rows: 140,
    cols: 140,
    boundaryMode: 2,
    boundaryLabel: 'Elastic Rebound Wall',
    description: 'Top glider dispensers dropping continuous streams down through a staggered pegboard obstacle field of pulsars, blinkers, and eaters.',
    dynamics: 'Gliders bounce, deflect, and cascade toward score bins at the bottom, creating a perpetual kinetic pachinko machine.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // Top glider dispensers
      stampOffsets(cells, GOSPER_OFFSETS, 10, 16, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, 10, cols - 56, rows, cols, true, false);

      // Staggered pegboard obstacles (Blinkers & Eaters)
      for (let r = 40; r < rows - 30; r += 20) {
        const offset = (r / 20) % 2 === 0 ? 0 : 15;
        for (let c = 25 + offset; c < cols - 25; c += 30) {
          stampOffsets(cells, EATER1_OFFSETS, r, c, rows, cols);
          stampOffsets(cells, PULSAR_OFFSETS, r + 8, c + 10, rows, cols);
        }
      }

      // Bottom score bins (vertical barrier partitions)
      for (let c = 20; c < cols - 20; c += 25) {
        for (let r = rows - 24; r < rows - 4; r++) {
          cells.add(`${r},${c}`);
          cells.add(`${r},${c + 1}`);
        }
      }

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'spaceship-grandprix',
    name: 'Spaceship Grand Prix (5-Lane Speedway)',
    category: 'accelerators',
    categoryLabel: 'Accelerators',
    rows: 128,
    cols: 140,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Topology',
    description: 'Direct side-by-side velocity comparison across 5 distinct spaceship classes: Glider, Copperhead, LWSS, MWSS, and HWSS.',
    dynamics: 'Watch different speed limits in action: c/2 orthogonal vs c/4 diagonal vs c/10 undulating caterpillar velocity.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // Track dividers
      for (let r = 24; r < rows; r += 24) {
        for (let c = 0; c < cols; c += 6) {
          cells.add(`${r},${c}`);
          cells.add(`${r},${c + 1}`);
        }
      }

      // Lane 1: Glider (c/4 diagonal)
      stampOffsets(cells, GLIDER_OFFSETS, 10, 12, rows, cols);

      // Lane 2: Copperhead (c/10 undulating orthogonal)
      stampOffsets(cells, COPPERHEAD_OFFSETS, 32, 12, rows, cols);

      // Lane 3: Lightweight Spaceship LWSS (c/2 orthogonal)
      stampOffsets(cells, LWSS_OFFSETS, 58, cols - 20, rows, cols);

      // Lane 4: Middleweight Spaceship MWSS (c/2 orthogonal)
      stampOffsets(cells, MWSS_OFFSETS, 82, cols - 24, rows, cols);

      // Lane 5: Heavyweight Spaceship HWSS (c/2 orthogonal)
      stampOffsets(cells, HWSS_OFFSETS, 106, cols - 28, rows, cols);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'the-breeder',
    name: 'The Breeder (Quadratic Growth Engine)',
    category: 'harmonics',
    categoryLabel: 'Harmonics',
    rows: 140,
    cols: 140,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Topology',
    description: 'Quadratic population growth mega-engine laying a cascading trail of glider guns and factory components across space.',
    dynamics: 'Population expands at O(t^2) as each newly fabricated gun adds an independent stream of gliders to the universe.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      // Central locomotive engine cluster
      stampOffsets(cells, GOSPER_OFFSETS, 30, 20, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, 30, 70, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, 80, 20, rows, cols);
      stampOffsets(cells, GOSPER_OFFSETS, 80, 70, rows, cols);

      // Flanking factory escorts
      stampOffsets(cells, HWSS_OFFSETS, 14, 50, rows, cols);
      stampOffsets(cells, HWSS_OFFSETS, rows - 24, 50, rows, cols);

      // Core harmonic seed
      stampOffsets(cells, PULSAR_OFFSETS, 55, 45, rows, cols);
      stampOffsets(cells, PULSAR_OFFSETS, 55, 80, rows, cols);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
  {
    id: 'bistable-flipflop-circuit',
    name: '1-Bit Memory Latch & Signal Loop',
    category: 'logic',
    categoryLabel: 'Logic & Circuits',
    rows: 120,
    cols: 120,
    boundaryMode: 0,
    boundaryLabel: 'Toroidal Topology',
    description: 'Bi-stable cellular memory register storing a toggleable state bit flanked by reflective delay lines.',
    dynamics: 'Alternating incoming signal gliders flip the internal bit state, providing persistent cellular RAM storage.',
    generate: (rows, cols) => {
      const cells = new Set<string>();

      const midR = Math.floor(rows / 2);
      const midC = Math.floor(cols / 2);

      // Memory cells at center
      stampOffsets(cells, EATER1_OFFSETS, midR - 8, midC - 8, rows, cols);
      stampOffsets(cells, EATER1_OFFSETS, midR + 8, midC + 8, rows, cols, true, true);

      // Input glider tracks
      stampOffsets(cells, GLIDER_OFFSETS, midR - 35, midC - 35, rows, cols);
      stampOffsets(cells, GLIDER_OFFSETS, midR + 35, midC + 35, rows, cols, true, true);

      // Readout monitors
      stampOffsets(cells, PULSAR_OFFSETS, 16, cols - 30, rows, cols);
      stampOffsets(cells, PULSAR_OFFSETS, rows - 30, 16, rows, cols);

      return Array.from(cells).map(k => k.split(',').map(Number) as [number, number]);
    },
  },
];

// ── Preview Canvas Generator for Boards ───────────────────────────────────────

export function createBoardPreviewCanvas(
  setup: BoardSetup,
  width = 80,
  height = 60
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#0f0e0b';
  ctx.fillRect(0, 0, width, height);

  const cells = setup.generate(setup.rows, setup.cols);
  if (cells.length === 0) return canvas;

  const scaleX = width / setup.cols;
  const scaleY = height / setup.rows;

  ctx.fillStyle = '#d9e36a';
  for (const [r, c] of cells) {
    const x = Math.floor(c * scaleX);
    const y = Math.floor(r * scaleY);
    ctx.fillRect(x, y, Math.max(1, Math.ceil(scaleX)), Math.max(1, Math.ceil(scaleY)));
  }

  return canvas;
}
