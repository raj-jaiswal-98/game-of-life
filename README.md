# Conway's Game of Life

> *"The Game of Life is not a game in the conventional sense — there are no players, no strategy, no winner. Yet it is richer than almost any game ever invented."*
> — Martin Gardner, *Scientific American*, October 1970 [[1]](#references)

An interactive implementation of Conway's Game of Life: a **Spring Boot 3** server computes the rules, and a browser canvas lets you paint, stamp patterns, and watch emergent complexity unfold in real time.

---

## Table of Contents

1. [The Science Behind the Game](#1-the-science-behind-the-game)
2. [Why This Problem Matters](#2-why-this-problem-matters)
3. [What This Implementation Does](#3-what-this-implementation-does)
4. [Quick Start](#4-quick-start)
5. [Docker](#5-docker)
6. [Architecture](#6-architecture)
7. [Feature Status](#7-feature-status)
8. [Known Limitations](#8-known-limitations)
9. [Further Reading](#9-further-reading)
10. [References](#references)

---

## 1. The Science Behind the Game

### 1.1 Origins

In 1970, British mathematician **John Horton Conway** devised a zero-player game played on an infinite two-dimensional grid of square cells [[1]](#references)[[2]](#references). Conway designed his rules with three criteria in mind:

1. No initial pattern should grow without limit in an *obvious* way.
2. Simple initial patterns should produce surprising, unpredictable behavior.
3. There should be initial patterns that "live" forever without growing.

The result was B3/S23 — the only ruleset to satisfy all three criteria after months of exploration.

### 1.2 The Rules (B3/S23)

Each cell is either **alive** or **dead**. Every generation, all cells update simultaneously based on their eight Moore-neighborhood neighbors:

| Cell state | Neighbor count | Next state |
|---|---|---|
| Alive | 2 or 3 | Stays alive (survival) |
| Alive | < 2 | Dies (underpopulation) |
| Alive | > 3 | Dies (overpopulation) |
| Dead | exactly 3 | Becomes alive (birth) |

The notation **B3/S23** encodes this compactly: Born with 3 neighbors, Survives with 2 or 3. This ruleset sits at the boundary of order and chaos — Wolfram's complexity **Class IV** — where patterns are complex enough to be universal but structured enough to be meaningful [[3]](#references).

### 1.3 Emergent Complexity

From three rules emerge phenomena that no designer specified:

- **Still lifes** — patterns that never change (e.g., the 2×2 Block, the Beehive). Conway proved some must exist.
- **Oscillators** — patterns that cycle with a fixed period (Blinker: period 2; Pulsar: period 3; Pentadecathlon: period 15).
- **Spaceships** — patterns that translate across the grid (the Glider, discovered by Richard K. Guy in 1969; the Lightweight Spaceship).
- **The Gosper Glider Gun** (1970) — the first pattern discovered to grow without bound [[4]](#references). Bill Gosper built it to win a $50 prize Conway offered for a proof that infinite growth was possible. It emits a new Glider every 30 generations.

These structures interact: guns can shoot spaceships into eaters, creating logic gates. In 2002, Paul Chapman constructed a **Turing-complete** computer inside Life — any computation that can be described algorithmically can, in principle, be run inside the Game of Life [[5]](#references).

### 1.4 Topology

This implementation runs on a **torus**: the grid wraps at every edge. A glider that exits the right side re-enters on the left; the top and bottom wrap the same way. The alternative — a **dead-border** topology where edges count as dead cells — is a planned feature (R9).

---

## 2. Why This Problem Matters

### 2.1 A Laboratory for Complexity Theory

Cellular automata, of which Life is the most famous example, are studied as models of how **global complexity can arise from local rules** with no central coordinator. This has direct relevance to:

- **Biology** — morphogenesis, how embryos develop spatial structure from homogeneous cells (Turing's reaction-diffusion model [[6]](#references) predates Life but shares its philosophy)
- **Physics** — lattice-gas automata model fluid dynamics; Life-like rules approximate conservation laws
- **Computer science** — Life is a model of massively parallel computation; its Turing completeness shows that computation is substrate-independent

### 2.2 Wolfram's Classification

Stephen Wolfram's systematic study of one-dimensional cellular automata (*A New Kind of Science*, 2002 [[3]](#references)) extended Conway's intuition into a formal taxonomy:

| Class | Behavior | Example |
|---|---|---|
| I | All cells converge to uniform state | Rule 0 |
| II | Stable or periodic structures | Rule 4 |
| III | Chaotic, aperiodic | Rule 30 |
| **IV** | **Complex localized structures, long transients** | **Life, Rule 110** |

Class IV automata are hypothesized to be universal — capable of universal computation. Rule 110 was proven Turing-complete by Matthew Cook in 2004 [[7]](#references); Life was proven Turing-complete by Conway himself (and later formalized by others).

### 2.3 Game Theory Roots

Berlekamp, Conway, and Guy's *Winning Ways for your Mathematical Plays* (2001) [[8]](#references) used Life as a central example in combinatorial game theory, showing that Life positions can be analyzed as sums of simpler games. This connection between Life and abstract algebra is still an active research area.

---

## 3. What This Implementation Does

- **Server-side engine** (Java / Spring Boot 3.4): the B3/S23 rules are computed exclusively on the server. The browser never implements Life — it is a pure rendering client. This makes rule correctness easy to test and verify independently.
- **REST API**: nine endpoints expose the full board state as a JSON boolean grid after every mutation.
- **Canvas UI**: click or drag to paint cells; choose from 10 built-in patterns and stamp them anywhere; play/pause/step with adjustable tick speed.
- **Pattern catalog**: Glider, LWSS, Blinker, Toad, Beacon, Pulsar, Pentadecathlon, Block, Beehive, and the Gosper Glider Gun.
- **Torus topology**: edges wrap so spaceships never disappear.

---

## 4. Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Java | 21+ |
| Maven | 3.9+ |

```bash
# Clone
git clone <repo-url>
cd game-of-life

# Run
mvn spring-boot:run

# Open
open http://localhost:8080
```

The server starts on port `8080`. The UI is served as static HTML from Spring Boot — no separate build step needed.

### Interact with the API directly

```bash
# Current board state
curl http://localhost:8080/api/game

# Step one generation
curl -X POST http://localhost:8080/api/game/step

# Randomize at 30% density
curl -X POST http://localhost:8080/api/game/random \
     -H "Content-Type: application/json" \
     -d '{"density": 0.30}'

# Stamp a Gosper Glider Gun at (2, 2)
curl -X POST http://localhost:8080/api/game/pattern \
     -H "Content-Type: application/json" \
     -d '{"id": "gosper", "row": 2, "col": 2}'

# Resize the board to 60 x 100
curl -X POST http://localhost:8080/api/game/reset \
     -H "Content-Type: application/json" \
     -d '{"rows": 60, "cols": 100}'
```

---

## 5. Docker

```bash
# Build and run
docker compose up

# Or build the image manually
docker build -t game-of-life .
docker run -p 8080:8080 game-of-life
```

The Dockerfile uses a **multi-stage build**: Maven compiles in one layer, the runtime image is JRE-only (`eclipse-temurin:21-jre-alpine`) and runs as a non-root user.

---

## 6. Architecture

```
Browser (HTML + Canvas + Vanilla JS)
       |
       | HTTP (fetch)
       v
Spring Boot 3 — GameController  (REST /api/game/*)
       |
       v
    GameService  (singleton board, thread-safe via synchronized lock)
       |
       +---> LifeEngine   (pure static methods: nextGeneration, countLiveCells)
       |
       +---> Patterns     (static catalog of 10 built-in patterns)
```

| Layer | File | Responsibility |
|---|---|---|
| Entry point | `GameOfLifeApplication.java` | Spring Boot bootstrap |
| Engine | `engine/LifeEngine.java` | Pure B3/S23 computation — no Spring, fully testable |
| Patterns | `engine/Patterns.java` | Immutable catalog; stamped at an (row, col) origin |
| Service | `service/GameService.java` | Holds the board; serializes mutations; composes engine calls |
| Controller | `api/GameController.java` | Maps HTTP verbs to service calls; handles default params |
| DTOs | `api/dto/*.java` | `record`-based request/response shapes |
| Frontend | `resources/static/` | Single `index.html`, `css/styles.css`, `js/app.js` |

---

## 7. Feature Status

Full specs live under [`docs/features/`](docs/features/index.md).

| ID | Feature | Status |
|---|---|---|
| F01 | B3/S23 rules + topology toggle | partial (rules shipped; toggle pending) |
| F02 | Simulation REST API | shipped |
| F03 | Canvas paint / toggle | shipped |
| F04 | Step, play, pause, speed | shipped |
| F05 | Random soup | shipped |
| F06 | Pattern catalog and stamp | shipped |
| F07 | Grid resize | partial (API shipped; UI pending) |
| F08 | URL game identity (shareable boards) | proposed |
| F09 | Import / export (JSON / RLE) | proposed |

See [`docs/PENDING_TASKS.md`](docs/PENDING_TASKS.md) for the full task list.

---

## 8. Known Limitations

| Limitation | Detail | Planned fix |
|---|---|---|
| **Shared board** | All browser tabs share one in-memory `GameService`. Two tabs fight. | F08 (URL game id) |
| **No topology toggle** | Wrapping is hard-coded. A glider never dies at the edge. | F01/R9 |
| **No resize UI** | `POST /api/game/reset` exists but the browser has no controls to invoke it. | F07 UI |
| **Chatty paint** | Each cell paint downloads the full board JSON. | F09 sparse delta |
| **Chatty play** | Each tick is a full HTTP round trip + full JSON grid transfer. | R14 WebSocket |
| **No persistence** | Restarting the JVM wipes the board. | F08 + F09 |

---

## 9. Further Reading

### Primary Sources

- **Conway, J.H.** (1970) — The game was first described by Martin Gardner in *Scientific American*, not in a paper by Conway himself; Conway's contribution was the ruleset and the problem statements he posed.
- **Gardner, M.** (1970). "Mathematical Games: The fantastic combinations of John Conway's new solitaire game 'life'." *Scientific American*, 223(4), 120–123. The article that introduced Life to the world.

### Books

- **Berlekamp, E.R., Conway, J.H., & Guy, R.K.** (2001). *Winning Ways for your Mathematical Plays* (2nd ed.). A K Peters. — Definitive combinatorial game theory text; uses Life as a central example.
- **Wolfram, S.** (2002). *A New Kind of Science*. Wolfram Media. — Exhaustive computational classification of cellular automata; argues they form a new foundation for science.
- **Poundstone, W.** (1985). *The Recursive Universe: Cosmic Complexity and the Limits of Scientific Knowledge*. William Morrow. — Accessible exploration of Life, information theory, and self-replicating machines.
- **Johnston, N., & Greene, D.** (2022). *Conway's Game of Life: Mathematics and Construction*. Self-published. — Modern, rigorous treatment of Life mathematics, including Turing machines, self-replication, and pattern construction.

### Online Resources

- **LifeWiki** — https://conwaylife.com/wiki/ — the canonical encyclopedia of Life patterns, algorithms, and history
- **Golly** — https://golly.sourceforge.net/ — open-source, high-performance Life simulator supporting HashLife and many other rulesets
- **CATAGOLUE** — https://catagolue.hatsya.com/ — census of naturally occurring ash objects from random soups

### Papers

- **Cook, M.** (2004). "Universality in Elementary Cellular Automata." *Complex Systems*, 15(1), 1–40. — Proof that Rule 110 is Turing-complete.
- **Rendell, P.** (2002). "Turing Universality of the Game of Life." In *Collision-Based Computing*, Springer. — Formal construction of a Turing machine inside Life.

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

*Spring Boot 3.4 · Java 21 · Maven · Vanilla HTML/CSS/JS*
