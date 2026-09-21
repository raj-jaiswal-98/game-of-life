/**
 * High-performance WebGL 2.0 Ping-Pong GPU Simulation & Rendering Engine
 * for Conway's Game of Life.
 *
 * Computes generations in parallel on the GPU fragment shader at 60-144 FPS
 * without CPU bottlenecks, supporting grids up to 2048x2048 (4+ million cells).
 * Includes multi-channel state (Alive, Age, Density, Trail) and advanced color segmentation.
 */

const VERTEX_SHADER_SRC = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    v_uv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

const SIMULATION_SHADER_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_grid;
uniform vec2 u_resolution; // (cols, rows)
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;

    int count = 0;
    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) continue;
            vec2 offset = vec2(float(dx), float(dy)) * texel;
            vec2 sampleCoord = fract(v_uv + offset);
            if (texture(u_grid, sampleCoord).r > 0.5) {
                count++;
            }
        }
    }

    vec4 current = texture(u_grid, v_uv);
    float aliveNow = current.r;
    float nextAlive = 0.0;
    float nextAge = 0.0;
    float nextTrail = 0.0;

    if (aliveNow > 0.5) {
        if (count == 2 || count == 3) {
            nextAlive = 1.0;
            nextAge = min(1.0, current.g + 0.04);
            nextTrail = 1.0;
        } else {
            nextAlive = 0.0;
            nextAge = 0.0;
            nextTrail = 0.82;
        }
    } else {
        if (count == 3) {
            nextAlive = 1.0;
            nextAge = 0.0;
            nextTrail = 1.0;
        } else {
            nextAlive = 0.0;
            nextAge = 0.0;
            nextTrail = max(0.0, current.a - 0.07);
        }
    }

    fragColor = vec4(nextAlive, nextAge, float(count) / 8.0, nextTrail);
}
`;

const DISPLAY_SHADER_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_grid;
uniform vec2 u_resolution; // grid (cols, rows)
uniform vec2 u_screenSize; // canvas (width, height)
uniform float u_showGrid;
uniform int u_colorMode;    // 0: Classic, 1: Age Heatmap, 2: Cyberpunk, 3: Thermal Glow
out vec4 fragColor;

void main() {
    vec2 gridUV = vec2(v_uv.x, 1.0 - v_uv.y);
    vec4 cellData = texture(u_grid, gridUV);
    float alive = cellData.r;
    float age = cellData.g;
    float density = cellData.b;
    float trail = cellData.a;

    vec3 bgColor = vec3(13.0 / 255.0, 12.0 / 255.0, 10.0 / 255.0); // #0d0c0a
    vec3 color = bgColor;

    // Subtle fading phosphor trail for dead cells
    if (alive <= 0.5 && trail > 0.01) {
        if (u_colorMode == 1) {
            color = mix(bgColor, vec3(0.08, 0.12, 0.22), trail * 0.7);
        } else if (u_colorMode == 2) {
            color = mix(bgColor, vec3(0.18, 0.03, 0.20), trail * 0.8);
        } else if (u_colorMode == 3) {
            color = mix(bgColor, vec3(0.22, 0.04, 0.03), trail * 0.7);
        } else {
            color = mix(bgColor, vec3(0.06, 0.10, 0.05), trail * 0.5);
        }
    }

    if (alive > 0.5) {
        if (u_colorMode == 0) {
            // 0: Classic Phosphor & Amber
            vec3 liveColor = vec3(217.0 / 255.0, 227.0 / 255.0, 106.0 / 255.0); // #d9e36a
            vec3 highlight = vec3(224.0 / 255.0, 164.0 / 255.0, 90.0 / 255.0);  // #e0a45a
            vec2 cellPos = fract(gridUV * u_resolution);
            color = (cellPos.y < 0.15) ? mix(liveColor, highlight, 0.45) : liveColor;

        } else if (u_colorMode == 1) {
            // 1: Age Segmentation Heatmap
            // Newborn: Cyan -> Young: Neon Lime -> Mature: Gold/Amber -> Ancient: Ruby/Magenta
            vec3 cNewborn = vec3(0.15, 0.95, 1.00);  // Electric Cyan
            vec3 cYoung   = vec3(0.45, 0.98, 0.25);  // Lime Green
            vec3 cMature  = vec3(1.00, 0.72, 0.12);  // Bright Gold
            vec3 cAncient = vec3(1.00, 0.20, 0.45);  // Ruby Rose

            if (age < 0.25) {
                color = mix(cNewborn, cYoung, age / 0.25);
            } else if (age < 0.65) {
                color = mix(cYoung, cMature, (age - 0.25) / 0.40);
            } else {
                color = mix(cMature, cAncient, (age - 0.65) / 0.35);
            }

        } else if (u_colorMode == 2) {
            // 2: Cyberpunk Neon (Hot Pink / Electric Violet / Turquoise)
            vec3 cHotPink = vec3(1.00, 0.02, 0.55);
            vec3 cTurq    = vec3(0.00, 0.96, 0.92);
            vec3 cViolet  = vec3(0.70, 0.15, 1.00);
            color = mix(cTurq, cHotPink, age);
            if (density > 0.35) {
                color = mix(color, cViolet, 0.5);
            }

        } else if (u_colorMode == 3) {
            // 3: Thermal Energy Glow
            // Dark Crimson -> Hot Orange -> Solar Yellow -> White-Hot
            vec3 cCrimson = vec3(0.85, 0.08, 0.10);
            vec3 cOrange  = vec3(1.00, 0.45, 0.05);
            vec3 cYellow  = vec3(1.00, 0.92, 0.20);
            vec3 cWhite   = vec3(1.00, 0.98, 0.90);

            float heat = clamp(age * 0.4 + density * 1.5, 0.0, 1.0);
            if (heat < 0.33) {
                color = mix(cCrimson, cOrange, heat / 0.33);
            } else if (heat < 0.70) {
                color = mix(cOrange, cYellow, (heat - 0.33) / 0.37);
            } else {
                color = mix(cYellow, cWhite, (heat - 0.70) / 0.30);
            }
        }
    }

    // Grid lines for visible cell sizes (>= 6px)
    if (u_showGrid > 0.5) {
        vec2 cellPixels = u_screenSize / u_resolution;
        if (cellPixels.x >= 6.0 && cellPixels.y >= 6.0) {
            vec2 cellFrac = fract(gridUV * u_resolution);
            vec2 border = step(cellFrac, 1.0 / cellPixels);
            if (border.x > 0.0 || border.y > 0.0) {
                color = mix(color, vec3(58.0 / 255.0, 52.0 / 255.0, 40.0 / 255.0), 0.45);
            }
        }
    }

    fragColor = vec4(color, 1.0);
}
`;

export class WebGLEngine {
    private gl: WebGL2RenderingContext;
    private simProgram!: WebGLProgram;
    private displayProgram!: WebGLProgram;

    private textures: [WebGLTexture, WebGLTexture];
    private fbos: [WebGLFramebuffer, WebGLFramebuffer];
    private currentIdx = 0;

    public rows: number;
    public cols: number;
    public colorMode: number = 0; // 0: Classic, 1: Age Heatmap, 2: Cyberpunk, 3: Thermal
    private vao: WebGLVertexArrayObject;

    private simResLoc!: WebGLUniformLocation;
    private simGridLoc!: WebGLUniformLocation;
    private dispGridLoc!: WebGLUniformLocation;
    private dispResLoc!: WebGLUniformLocation;
    private dispScreenLoc!: WebGLUniformLocation;
    private dispShowGridLoc!: WebGLUniformLocation;
    private dispColorModeLoc!: WebGLUniformLocation;

    constructor(canvas: HTMLCanvasElement, rows: number, cols: number) {
        const gl = canvas.getContext('webgl2', {
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
        });

        if (!gl) {
            throw new Error('WebGL 2.0 is not supported by your browser or graphics hardware.');
        }

        this.gl = gl;
        this.rows = rows;
        this.cols = cols;

        this.initShaders();

        this.vao = gl.createVertexArray()!;
        this.textures = [this.createTexture(), this.createTexture()];
        this.fbos = [this.createFBO(this.textures[0]), this.createFBO(this.textures[1])];

        this.resize(rows, cols);
    }

    public resize(rows: number, cols: number): void {
        this.rows = rows;
        this.cols = cols;
        const gl = this.gl;

        const emptyData = new Uint8Array(cols * rows * 4);
        for (let i = 0; i < 2; i++) {
            gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA8,
                cols,
                rows,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                emptyData
            );
        }
        this.currentIdx = 0;
    }

    public setColorMode(mode: number): void {
        this.colorMode = mode;
    }

    public step(): void {
        const gl = this.gl;
        const nextIdx = 1 - this.currentIdx;

        gl.useProgram(this.simProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[nextIdx]);
        gl.viewport(0, 0, this.cols, this.rows);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIdx]);
        gl.uniform1i(this.simGridLoc, 0);
        gl.uniform2f(this.simResLoc, this.cols, this.rows);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        this.currentIdx = nextIdx;
    }

    public render(canvasWidth: number, canvasHeight: number, showGrid = true): void {
        const gl = this.gl;

        gl.useProgram(this.displayProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvasWidth, canvasHeight);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIdx]);
        gl.uniform1i(this.dispGridLoc, 0);
        gl.uniform2f(this.dispResLoc, this.cols, this.rows);
        gl.uniform2f(this.dispScreenLoc, canvasWidth, canvasHeight);
        gl.uniform1f(this.dispShowGridLoc, showGrid ? 1.0 : 0.0);
        gl.uniform1i(this.dispColorModeLoc, this.colorMode);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    public setCell(row: number, col: number, alive: boolean): void {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        const gl = this.gl;
        const val = alive ? 255 : 0;
        const pixel = new Uint8Array([val, 0, 0, val]);

        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIdx]);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            col,
            row,
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel
        );
    }

    public randomize(density: number): void {
        const total = this.cols * this.rows;
        const data = new Uint8Array(total * 4);
        for (let i = 0; i < total; i++) {
            const alive = Math.random() < density ? 255 : 0;
            const idx = i * 4;
            data[idx] = alive;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = alive;
        }

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIdx]);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            this.cols,
            this.rows,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );
    }

    public clear(): void {
        const total = this.cols * this.rows;
        const data = new Uint8Array(total * 4);
        const gl = this.gl;

        for (let i = 0; i < 2; i++) {
            gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                0,
                this.cols,
                this.rows,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                data
            );
        }
    }

    public loadGrid(cells: boolean[][]): void {
        const rows = cells.length;
        const cols = cells[0].length;
        if (rows !== this.rows || cols !== this.cols) {
            this.resize(rows, cols);
        }

        const data = new Uint8Array(cols * rows * 4);
        for (let r = 0; r < rows; r++) {
            const row = cells[r];
            for (let c = 0; c < cols; c++) {
                const alive = row && row[c] ? 255 : 0;
                const idx = (r * cols + c) * 4;
                data[idx] = alive;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = alive;
            }
        }

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIdx]);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            cols,
            rows,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );
    }

    public extractGrid(): { cells: boolean[][]; liveCells: number } {
        const gl = this.gl;
        const pixels = new Uint8Array(this.cols * this.rows * 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[this.currentIdx]);
        gl.readPixels(0, 0, this.cols, this.rows, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        const cells: boolean[][] = [];
        let liveCells = 0;

        for (let r = 0; r < this.rows; r++) {
            const row: boolean[] = [];
            for (let c = 0; c < this.cols; c++) {
                const idx = (r * this.cols + c) * 4;
                const isAlive = pixels[idx] > 127;
                row.push(isAlive);
                if (isAlive) liveCells++;
            }
            cells.push(row);
        }

        return { cells, liveCells };
    }

    /**
     * Injects live high-density stress presets directly into GPU VRAM.
     */
    public loadStressPreset(preset: 'glider-megacity' | 'gun-matrix' | 'supernova-soup' | 'pulsar-galaxy'): void {
        const total = this.cols * this.rows;
        const data = new Uint8Array(total * 4);

        const setPixel = (r: number, c: number) => {
            const row = ((r % this.rows) + this.rows) % this.rows;
            const col = ((c % this.cols) + this.cols) % this.cols;
            const idx = (row * this.cols + col) * 4;
            data[idx] = 255;
            data[idx + 3] = 255;
        };

        if (preset === 'supernova-soup') {
            for (let i = 0; i < total; i++) {
                if (Math.random() < 0.50) {
                    const idx = i * 4;
                    data[idx] = 255;
                    data[idx + 3] = 255;
                }
            }
        } else if (preset === 'glider-megacity') {
            // Replicate thousands of gliders diagonally spaced
            const spacing = 16;
            for (let r = 0; r < this.rows - spacing; r += spacing) {
                for (let c = 0; c < this.cols - spacing; c += spacing) {
                    setPixel(r, c + 1);
                    setPixel(r + 1, c + 2);
                    setPixel(r + 2, c);
                    setPixel(r + 2, c + 1);
                    setPixel(r + 2, c + 2);
                }
            }
        } else if (preset === 'gun-matrix') {
            // Gosper Glider Gun pattern offsets
            const gunOffsets: [number, number][] = [
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

            const stepRow = 60;
            const stepCol = 80;
            for (let r = 5; r < this.rows - 20; r += stepRow) {
                for (let c = 5; c < this.cols - 40; c += stepCol) {
                    for (const [dr, dc] of gunOffsets) {
                        setPixel(r + dr, c + dc);
                    }
                }
            }
        } else if (preset === 'pulsar-galaxy') {
            // Pulsar oscillator offsets (13x13)
            const pulsarOffsets: [number, number][] = [
                [1,3],[1,4],[1,5],[1,9],[1,10],[1,11],
                [3,1],[3,6],[3,8],[3,13],
                [4,1],[4,6],[4,8],[4,13],
                [5,1],[5,6],[5,8],[5,13],
                [6,3],[6,4],[6,5],[6,9],[6,10],[6,11],
                [8,3],[8,4],[8,5],[8,9],[8,10],[8,11],
                [9,1],[9,6],[9,8],[9,13],
                [10,1],[10,6],[10,8],[10,13],
                [11,1],[11,6],[11,8],[11,13],
                [13,3],[13,4],[13,5],[13,9],[13,10],[13,11]
            ];

            const spacing = 24;
            for (let r = 2; r < this.rows - spacing; r += spacing) {
                for (let c = 2; c < this.cols - spacing; c += spacing) {
                    for (const [dr, dc] of pulsarOffsets) {
                        setPixel(r + dr, c + dc);
                    }
                }
            }
        }

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIdx]);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            this.cols,
            this.rows,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );
    }

    private initShaders(): void {
        const gl = this.gl;

        const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
        const simFs = this.compileShader(gl.FRAGMENT_SHADER, SIMULATION_SHADER_SRC);
        const dispFs = this.compileShader(gl.FRAGMENT_SHADER, DISPLAY_SHADER_SRC);

        this.simProgram = this.createProgram(vs, simFs);
        this.displayProgram = this.createProgram(vs, dispFs);

        this.simResLoc = gl.getUniformLocation(this.simProgram, 'u_resolution')!;
        this.simGridLoc = gl.getUniformLocation(this.simProgram, 'u_grid')!;

        this.dispGridLoc = gl.getUniformLocation(this.displayProgram, 'u_grid')!;
        this.dispResLoc = gl.getUniformLocation(this.displayProgram, 'u_resolution')!;
        this.dispScreenLoc = gl.getUniformLocation(this.displayProgram, 'u_screenSize')!;
        this.dispShowGridLoc = gl.getUniformLocation(this.displayProgram, 'u_showGrid')!;
        this.dispColorModeLoc = gl.getUniformLocation(this.displayProgram, 'u_colorMode')!;
    }

    private createTexture(): WebGLTexture {
        const gl = this.gl;
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return tex;
    }

    private createFBO(texture: WebGLTexture): WebGLFramebuffer {
        const gl = this.gl;
        const fbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
        );
        return fbo;
    }

    private compileShader(type: number, src: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const err = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile error: ' + err);
        }
        return shader;
    }

    private createProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
        const gl = this.gl;
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            const err = gl.getProgramInfoLog(prog);
            gl.deleteProgram(prog);
            throw new Error('Program link error: ' + err);
        }
        return prog;
    }
}
