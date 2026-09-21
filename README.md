# Conway's Game of Life

> *"The Game of Life is not a game in the conventional sense — there are no players, no strategy, no winner. Yet it is richer than almost any game ever invented."*  
> — Martin Gardner, *Scientific American*, October 1970 [[1]](#references)

An interactive, high-performance implementation of Conway's Game of Life: featuring a **Spring Boot 3 / Java 21** server-side engine (sequential & parallel ForkJoin), a client-side **WebGL 2.0 GPU** compute shader running at 60 FPS, a comprehensive **Pattern Studio** with rotation, flipping, and **RLE / Plaintext / JSON import**, and **3 boundary topologies** including kinetic **elastic wall collision physics**.

---

https://github.com/user-attachments/assets/26bb1215-743d-4b4e-8521-c6d81fe6f998

---

## Table of Contents

1. [The Science Behind the Game](#1-the-science-behind-the-game)
2. [Why This Problem Matters](#2-why-this-problem-matters)
3. [What This Implementation Does](#3-what-this-implementation-does)
4. [Quick Start](#4-quick-start)
5. [Docker](#5-docker)
6. [Architecture & Dual-Engine System](#6-architecture--dual-engine-system)
7. [Boundary Modes & Collision Physics](#7-boundary-modes--collision-physics)
8. [Adding & Importing Patterns](#8-adding--importing-patterns)
9. [REST API Reference](#9-rest-api-reference)
10. [Further Reading](#10-further-reading)
11. [References](#references)

---

## 1. The Science Behind the Game

### 1.1 Origins

In 1970, British mathematician **John Horton Conway** devised a zero-player game played on a two-dimensional grid of square cells [[1]](#references)[[2]](#references). Conway designed his rules with three criteria in mind:

1. No initial pattern should grow without limit in an *obvious* way.
2. Simple initial patterns should produce surprising, unpredictable behavior.
3. There should be initial patterns that "live" forever without growing.

The result was B3/S23 — the only ruleset to satisfy all three criteria after months of manual exploration on Go boards.

### 1.2 The Rules (B3/S23)

Each cell is either **alive** ($1$) or **dead** ($0$). Every generation, all cells update synchronously based on their eight Moore-neighborhood neighbors:

| Cell state | Neighbor count | Next state | Cause |
|---|---|---|---|
| Alive | 2 or 3 | Stays alive | Survival |
| Alive | < 2 | Dies | Underpopulation / Starvation |
| Alive | > 3 | Dies | Overpopulation / Crowding |
| Dead | exactly 3 | Becomes alive | Reproduction / Birth |

The notation **B3/S23** encodes this compactly: **B**orn with 3 neighbors, **S**urvives with 2 or 3. This ruleset sits precisely at the boundary of order and chaos — Wolfram's complexity **Class IV** — where patterns are complex enough to be universal but structured enough to be stable [[3]](#references).

### 1.3 Emergent Complexity

From three simple local rules emerge macroscopic phenomena that no designer programmed:

- **Still lifes** — stationary patterns that never change (e.g., the 2×2 Block, the Beehive, the Tub).
- **Oscillators** — periodic patterns that cycle through a sequence of states (Blinker: period 2; Toad: period 2; Pulsar: period 3; Pentadecathlon: period 15).
- **Spaceships** — finite patterns that translate across the grid over time (the Glider, discovered by Richard K. Guy in 1969; the Lightweight Spaceship / LWSS).
- **The Gosper Glider Gun** (1970) — the first pattern discovered to grow without bound [[4]](#references). Bill Gosper built it to win a $50 prize Conway offered for a proof that infinite growth was possible. It emits a new Glider every 30 generations.

These structures interact: guns can shoot streams of spaceships into logic gates and eaters. In 2002, Paul Rendell constructed a formal **Turing machine** inside Life — proving that any computation that can be described algorithmically can run inside the Game of Life [[5]](#references).

---

## 2. Why This Problem Matters

### 2.1 A Laboratory for Complexity Theory

Cellular automata are primary models of how **global complexity arises from decentralized local interactions**:

- **Biology** — morphogenesis, cell division, and pigmentation patterns (Turing's reaction-diffusion model [[6]](#references) shares this philosophy).
- **Physics** — lattice-gas automata model fluid dynamics; cellular automata approximate conservation laws and statistical mechanics.
- **Computer Science** — Life models massively parallel computing architectures; its Turing completeness proves that computation is substrate-independent.

### 2.2 Wolfram's Classification

Stephen Wolfram's classification of cellular automata (*A New Kind of Science*, 2002 [[3]](#references)) categorizes dynamical systems into four fundamental classes:

| Class | Behavior | Example |
|---|---|---|
| I | All cells converge to a uniform, dead state | Rule 0 |
| II | Stable or simple periodic structures | Rule 4 |
| III | Chaotic, pseudorandom, aperiodic | Rule 30 |
| **IV** | **Complex localized structures, long transients, universality** | **Conway's Life, Rule 110** |

Class IV automata are capable of universal computation. Rule 110 was proven Turing-complete by Matthew Cook in 2004 [[7]](#references); Life was proven Turing-complete by Conway, Rendell [[5]](#references), and others.

---

## 3. What This Implementation Does

- **Dual-Engine Architecture**:
  - **Client-Side WebGL 2.0 GPU Shader**: Computes generations directly on the GPU in fragment shaders using ping-pong framebuffer textures at 60 FPS, with seamless pan/zoom and viewport virtualization.
  - **Server-Side Spring Boot 3 Engine**: Computes generations in Java 21 with both sequential (`LifeEngine`) and parallel multithreaded (`ParallelLifeEngine` with ForkJoin) engines.
- **Three Boundary Topologies**:
  - 🌐 **Torus**: Wraps coordinates across edges seamlessly.
  - 🧱 **Absorbing Wall**: Enforces a 2-cell buffer perimeter where cells die, highlighted by hazard stripes.
  - ⚡ **Elastic Wall**: Kinetic cluster reflection algorithm reversing momentum ($v_n \to -v_n$) while preserving cell counts and allowing gliders to bounce without collapsing.
- **Comprehensive Pattern Studio**:
  - 10 built-in patterns categorized into Spaceships, Oscillators, Still Lifes, and Guns.
  - Pattern rotation ($90^\circ, 180^\circ, 270^\circ$) and horizontal/vertical flipping.
  - Ghost stamping preview directly on the canvas.
  - **`+ Import` Pattern Modal**: Import any custom pattern from the web using **RLE**, **Plaintext (.cells)**, or **JSON Coordinates** with real-time preview.
- **Interactive Desktop UX**:
  - Non-resetting workflow: Changing grid sizes (30×50 up to 80×160), pattern selections, or speeds maintains the current living cell state.
  - Real-time population telemetry and sparkline activity graphs.
  - Play, pause, single-step, speed control (1–30 FPS), and density soup generator.
  - Keyboard shortcuts: `Space` (play/pause), `S` (step), `C` (clear), `R` (rotate / random), `H`/`V` (flip), `W` (cycle wall mode), `Ctrl+Z` (undo).

---

## 4. Quick Start

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Java (JDK) | 21+ |
| Maven | 3.9+ |
| Node.js / npm *(optional, for frontend dev)* | Node 20+, npm 10+ |

### Running the Application

```bash
# Clone the repository
git clone <repo-url>
cd game-of-life

# Start the Spring Boot server
mvn spring-boot:run
```

Open your browser at **`http://localhost:8080`**.

The application serves the pre-bundled modern frontend directly from Spring Boot static resources — no separate web server is required.

### Interacting with the REST API

```bash
# Get current board state and active boundary mode
curl http://localhost:8080/api/game

# Step simulation by one generation
curl -X POST http://localhost:8080/api/game/step

# Switch boundary mode (0 = Torus, 1 = Absorbing Wall, 2 = Elastic Wall)
curl -X POST http://localhost:8080/api/game/wall \
     -H "Content-Type: application/json" \
     -d '{"mode": 2}'

# Stamp a Gosper Glider Gun at row 5, col 5
curl -X POST http://localhost:8080/api/game/pattern \
     -H "Content-Type: application/json" \
     -d '{"id": "gosper", "row": 5, "col": 5}'

# Randomize grid at 25% density
curl -X POST http://localhost:8080/api/game/random \
     -H "Content-Type: application/json" \
     -d '{"density": 0.25}'

# Resize grid to 60 x 100 while preserving center cells
curl -X POST http://localhost:8080/api/game/reset \
     -H "Content-Type: application/json" \
     -d '{"rows": 60, "cols": 100}'

# Run CPU benchmark comparing sequential vs parallel engine (100 gens, 120x160)
curl -X POST http://localhost:8080/api/game/benchmark \
     -H "Content-Type: application/json" \
     -d '{"generations": 100, "rows": 120, "cols": 160}'
```

---

## 5. Docker

```bash
# Run with Docker Compose
docker compose up

# Or build and run standalone container
docker build -t game-of-life .
docker run -p 8080:8080 game-of-life
```

The `Dockerfile` uses a multi-stage build: Stage 1 builds the TypeScript frontend and compiles the Java application with Maven; Stage 2 creates an ultra-lean runtime container using `eclipse-temurin:21-jre-alpine` running under an unprivileged user.

---

## 6. Architecture & Dual-Engine System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Browser UI (Client)                              │
│                                                                             │
│  ┌─────────────────────────┐  WebGL 2.0 Ping-Pong FBO   ┌────────────────┐  │
│  │ Pattern Studio & Import ├───────────────────────────►│ GPU Simulation │  │
│  │ (RLE / .cells / JSON)   │                            │ FragmentShader │  │
│  └─────────────────────────┘                            └───────┬────────┘  │
│               │                                                 │           │
│               ▼ HTTP (REST / JSON)                              │ Fallback  │
└───────────────┼─────────────────────────────────────────────────┼───────────┘
                │                                                 │
                ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Spring Boot 3 Server (Java 21)                           │
│                                                                             │
│  GameController (/api/game/*) ──► GameService (Thread-safe Board Singleton) │
│                                             │                               │
│                      ┌──────────────────────┴──────────────────────┐        │
│                      ▼                                             ▼        │
│         com.gameoflife.engine.LifeEngine       ParallelLifeEngine (ForkJoin)│
│         - B3/S23 Moore Neighborhood            - Multithreaded chunking     │
│         - Boundary: Torus (0)                  - Boundary: Torus (0)        │
│         - Boundary: Absorbing (1)              - Boundary: Absorbing (1)    │
│         - Boundary: Elastic Rebound (2)        - Boundary: Elastic (2)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Source Files

| Layer | File Path | Responsibility |
|---|---|---|
| **Spring Boot App** | `src/main/java/com/gameoflife/GameOfLifeApplication.java` | Application bootstrap & configuration |
| **REST Controller** | `src/main/java/com/gameoflife/api/GameController.java` | REST endpoints for stepping, stamping, patterns, walls, benchmarks |
| **Game Service** | `src/main/java/com/gameoflife/service/GameService.java` | In-memory grid state, thread synchronization, engine delegation |
| **Core Engine** | `src/main/java/com/gameoflife/engine/LifeEngine.java` | Pure B3/S23 math, boundary topologies (0, 1, 2), elastic bounce physics |
| **Parallel Engine**| `src/main/java/com/gameoflife/engine/ParallelLifeEngine.java` | ForkJoin multithreaded simulation for large grids |
| **Pattern Library**| `src/main/java/com/gameoflife/engine/Patterns.java` | Immutable catalog of built-in patterns with relative offsets |
| **GPU Engine** | `frontend/src/gpu/webgl-engine.ts` | WebGL 2.0 FBO shader simulation, pan/zoom rendering, client elastic bounce |
| **Frontend App** | `frontend/src/app.ts` | Pattern studio, RLE/cells parser, sync logic, canvas renderer fallback |
| **Styles** | `src/main/resources/static/css/styles.css` | Cyberpunk glassmorphic HUD styling, CSS grid layout |

---

## 7. Boundary Modes & Collision Physics

Standard Game of Life implementations either wrap coordinates or zero out cells outside the grid. This project provides three mathematically distinct boundary modes:

### 1. 🌐 Torus Mode (`boundaryMode = 0`)
Periodic boundary conditions:
$$x' = (x \bmod \text{cols} + \text{cols}) \bmod \text{cols}$$
$$y' = (y \bmod \text{rows} + \text{rows}) \bmod \text{rows}$$
Spaceships and gliders wrap endlessly without interruption.

### 2. 🧱 Absorbing Wall Mode (`boundaryMode = 1`)
A **2-cell dead buffer layer** surrounds the perimeter:
$$\text{grid}[r][c] = 0 \quad \text{for } r < 2 \lor r \ge \text{rows}-2 \lor c < 2 \lor c \ge \text{cols}-2$$
Any glider entering the buffer layer is extinguished. Visually represented by amber hazard stripes.

### 3. ⚡ Elastic Wall Mode (`boundaryMode = 2`)
Standard mirror/reflective boundaries fail in Life because gliders collide with their own reflections and annihilate. Absorbing boundaries cause gliders to lose their forward phase and collapse into a static 4-cell Block still life.

To achieve **true elastic bouncing**, this engine implements **kinetic cluster rebound physics**:
1. **Contact Detection**: Checks if active clusters enter the 2-cell buffer layer.
2. **Cluster Isolation**: Isolates contiguous live-cell components entering the boundary zone.
3. **Momentum Reversal**: Inverts velocity along the contact normal:
   $$v_x \to -v_x \quad \text{or} \quad v_y \to -v_y$$
4. **Inward Setback**: Reflects the subgrid across the axis with a 1-cell setback into the active grid area.

**Result**: 100% cell count preservation ($5 \text{ cells in} \to 5 \text{ cells out}$). Gliders bounce indefinitely back and forth across the arena!

---

## 8. Adding & Importing Patterns

You can add patterns either **interactively through the UI** without writing any code, or **programmatically in the backend / frontend**.

### Method 1: Import via the Web UI (`+ Import` Button)

The easiest way to import any pattern from the web:

1. Open the **Pattern Studio** in the right sidebar.
2. Click the **`+ Import`** button next to the search bar.
3. Choose a format and paste your pattern data:
   - **RLE Format** (Run Length Encoded — standard format used by [LifeWiki](https://conwaylife.com/wiki/)):
     ```rle
     #N Glider
     #O Richard K. Guy, 1969
     x = 3, y = 3, rule = B3/S23
     bob$2bo$3o!
     ```
   - **Plaintext Format** (`.cells`):
     ```cells
     !Name: Glider
     .O.
     ..O
     OOO
     ```
   - **JSON Coordinate Array**:
     ```json
     [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]]
     ```
4. Check the **Live Preview** canvas to verify the shape.
5. Click **"Import Pattern"**. The pattern is immediately added to your active catalog, selected, and ready to stamp onto the grid!

---

### Method 2: Adding in Java Backend (`Patterns.java`)

To make a pattern permanently available in the backend catalog:

1. Open `src/main/java/com/gameoflife/engine/Patterns.java`.
2. Add your pattern registration to the `static` initialization block:

```java
register(new PatternInfo(
    "diehard",                      // Unique ID
    "Diehard",                      // Display Name
    "A methuselah that disappears completely after 130 generations.", // Description
    List.of(
        new PatternOffset(0, 6),
        new PatternOffset(1, 0),
        new PatternOffset(1, 1),
        new PatternOffset(2, 1),
        new PatternOffset(2, 5),
        new PatternOffset(2, 6),
        new PatternOffset(2, 7)
    )
));
```

---

### Method 3: Adding to Frontend Defaults (`app.ts`)

To include the pattern in the offline / client-GPU catalog, add an entry to `DEFAULT_PATTERNS` in `frontend/src/app.ts`:

```typescript
{
  id: 'diehard',
  name: 'Diehard',
  description: 'A methuselah that vanishes after 130 generations.',
  cells: [
    { row: 0, col: 6 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 1 },
    { row: 2, col: 5 },
    { row: 2, col: 6 },
    { row: 2, col: 7 }
  ]
}
```

Then rebuild the bundle:
```bash
cd frontend && npm run build
```

---

## 9. REST API Reference

All requests and responses use JSON (`Content-Type: application/json`).

| Endpoint | Method | Request Body | Description |
|---|---|---|---|
| `/api/game` | `GET` | — | Retrieve current board state, dimensions, generation, live cell count, boundary mode |
| `/api/game/step` | `POST` | — | Advance the simulation by exactly one generation |
| `/api/game/toggle` | `POST` | `{"row": 10, "col": 15}` | Toggle a single cell alive $\leftrightarrow$ dead |
| `/api/game/random` | `POST` | `{"density": 0.25}` | Populate the grid with random soup at given density (0.0 to 1.0) |
| `/api/game/clear` | `POST` | — | Clear all cells and reset generation counter to 0 |
| `/api/game/reset` | `POST` | `{"rows": 60, "cols": 100}` | Resize the board; preserves existing cells centered |
| `/api/game/wall` | `POST` | `{"mode": 2}` | Set boundary mode: `0` = Torus, `1` = Absorbing, `2` = Elastic |
| `/api/game/engine` | `POST` | `{"mode": "parallel"}` | Switch server engine between `"sequential"` and `"parallel"` |
| `/api/game/grid` | `POST` | `{"rows": 40, "cols": 80, "cells": [[...]]}` | Full state synchronization from client to server |
| `/api/game/patterns` | `GET` | — | Retrieve all available patterns in the server catalog |
| `/api/game/pattern` | `POST` | `{"id": "glider", "row": 5, "col": 5}` | Stamp a pattern at the specified row and column origin |
| `/api/game/benchmark` | `POST` | `{"generations": 100, "rows": 80, "cols": 160}` | Run benchmark comparing sequential vs parallel engine throughput |

---

## 10. Further Reading

### Primary Sources
- **Conway, J.H.** (1970) — The game was first introduced by Martin Gardner in *Scientific American*, Vol. 223, No. 4, October 1970, pp. 120–123.
- **Gardner, M.** (1970). "Mathematical Games: The fantastic combinations of John Conway's new solitaire game 'life'." *Scientific American*, 223(4), 120–123.

### Books
- **Berlekamp, E.R., Conway, J.H., & Guy, R.K.** (2001). *Winning Ways for your Mathematical Plays* (2nd ed.). A K Peters. — Definitive combinatorial game theory text using Life as a central example.
- **Wolfram, S.** (2002). *A New Kind of Science*. Wolfram Media. — Exhaustive computational classification of cellular automata.
- **Poundstone, W.** (1985). *The Recursive Universe: Cosmic Complexity and the Limits of Scientific Knowledge*. William Morrow.
- **Johnston, N., & Greene, D.** (2022). *Conway's Game of Life: Mathematics and Construction*.

### Online Archives & Tools
- **LifeWiki** — [https://conwaylife.com/wiki/](https://conwaylife.com/wiki/) — The definitive encyclopedia of Life patterns, rules, and history.
- **Golly** — [https://golly.sourceforge.net/](https://golly.sourceforge.net/) — Open-source cellular automata simulator.
- **Catagolue** — [https://catagolue.hatsya.com/](https://catagolue.hatsya.com/) — Census of naturally occurring ash objects from random soups.

---

## References

[1] Gardner, M. (1970). "Mathematical Games: The fantastic combinations of John Conway's new solitaire game 'life'." *Scientific American*, 223(4), 120–123.

[2] Conway, J.H. (as described in Gardner, 1970 and Berlekamp et al., 2001).

[3] Wolfram, S. (2002). *A New Kind of Science*. Wolfram Media. Chapter 2: "The Crucial Experiment." https://www.wolframscience.com/nks/

[4] Gosper, R.W. (1970). Gosper Glider Gun. Reported in Gardner's follow-up column, November 1970.

[5] Rendell, P. (2002). "Turing Universality of the Game of Life." In A. Adamatzky (Ed.), *Collision-Based Computing* (pp. 513–539). Springer.

[6] Turing, A.M. (1952). "The Chemical Basis of Morphogenesis." *Philosophical Transactions of the Royal Society B*, 237(641), 37–72.

[7] Cook, M. (2004). "Universality in Elementary Cellular Automata." *Complex Systems*, 15(1), 1–40.

[8] Berlekamp, E.R., Conway, J.H., & Guy, R.K. (2001). *Winning Ways for your Mathematical Plays* (2nd ed., Vols. 1–4). A K Peters / CRC Press.

---

*Spring Boot 3.4 · Java 21 · Maven · WebGL 2.0 · TypeScript / Vite*
