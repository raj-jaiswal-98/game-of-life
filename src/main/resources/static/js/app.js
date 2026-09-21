var Se=Object.defineProperty;var be=(g,v,S)=>v in g?Se(g,v,{enumerable:!0,configurable:!0,writable:!0,value:S}):g[v]=S;var m=(g,v,S)=>be(g,typeof v!="symbol"?v+"":v,S);(function(){"use strict";async function g(o,e={}){const t=await fetch(o,{headers:{"Content-Type":"application/json"},...e});if(!t.ok){const r=await t.text();throw new Error(r||t.statusText)}return t.json()}const v=`#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    v_uv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
`,S=`#version 300 es
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
`,de=`#version 300 es
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
`;class ue{constructor(e,t,r){m(this,"gl");m(this,"simProgram");m(this,"displayProgram");m(this,"textures");m(this,"fbos");m(this,"currentIdx",0);m(this,"rows");m(this,"cols");m(this,"colorMode",0);m(this,"vao");m(this,"simResLoc");m(this,"simGridLoc");m(this,"dispGridLoc");m(this,"dispResLoc");m(this,"dispScreenLoc");m(this,"dispShowGridLoc");m(this,"dispColorModeLoc");const n=e.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!n)throw new Error("WebGL 2.0 is not supported by your browser or graphics hardware.");this.gl=n,this.rows=t,this.cols=r,this.initShaders(),this.vao=n.createVertexArray(),this.textures=[this.createTexture(),this.createTexture()],this.fbos=[this.createFBO(this.textures[0]),this.createFBO(this.textures[1])],this.resize(t,r)}resize(e,t){this.rows=e,this.cols=t;const r=this.gl,n=new Uint8Array(t*e*4);for(let l=0;l<2;l++)r.bindTexture(r.TEXTURE_2D,this.textures[l]),r.texImage2D(r.TEXTURE_2D,0,r.RGBA8,t,e,0,r.RGBA,r.UNSIGNED_BYTE,n);this.currentIdx=0}setColorMode(e){this.colorMode=e}step(){const e=this.gl,t=1-this.currentIdx;e.useProgram(this.simProgram),e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[t]),e.viewport(0,0,this.cols,this.rows),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.textures[this.currentIdx]),e.uniform1i(this.simGridLoc,0),e.uniform2f(this.simResLoc,this.cols,this.rows),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),this.currentIdx=t}render(e,t,r=!0){const n=this.gl;n.useProgram(this.displayProgram),n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,e,t),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.textures[this.currentIdx]),n.uniform1i(this.dispGridLoc,0),n.uniform2f(this.dispResLoc,this.cols,this.rows),n.uniform2f(this.dispScreenLoc,e,t),n.uniform1f(this.dispShowGridLoc,r?1:0),n.uniform1i(this.dispColorModeLoc,this.colorMode),n.bindVertexArray(this.vao),n.drawArrays(n.TRIANGLES,0,3)}setCell(e,t,r){if(e<0||e>=this.rows||t<0||t>=this.cols)return;const n=this.gl,l=r?255:0,a=new Uint8Array([l,0,0,l]);n.bindTexture(n.TEXTURE_2D,this.textures[this.currentIdx]),n.texSubImage2D(n.TEXTURE_2D,0,t,e,1,1,n.RGBA,n.UNSIGNED_BYTE,a)}randomize(e){const t=this.cols*this.rows,r=new Uint8Array(t*4);for(let l=0;l<t;l++){const a=Math.random()<e?255:0,c=l*4;r[c]=a,r[c+1]=0,r[c+2]=0,r[c+3]=a}const n=this.gl;n.bindTexture(n.TEXTURE_2D,this.textures[this.currentIdx]),n.texSubImage2D(n.TEXTURE_2D,0,0,0,this.cols,this.rows,n.RGBA,n.UNSIGNED_BYTE,r)}clear(){const e=this.cols*this.rows,t=new Uint8Array(e*4),r=this.gl;for(let n=0;n<2;n++)r.bindTexture(r.TEXTURE_2D,this.textures[n]),r.texSubImage2D(r.TEXTURE_2D,0,0,0,this.cols,this.rows,r.RGBA,r.UNSIGNED_BYTE,t)}loadGrid(e){const t=e.length,r=e[0].length;(t!==this.rows||r!==this.cols)&&this.resize(t,r);const n=new Uint8Array(r*t*4);for(let a=0;a<t;a++){const c=e[a];for(let d=0;d<r;d++){const f=c&&c[d]?255:0,p=(a*r+d)*4;n[p]=f,n[p+1]=0,n[p+2]=0,n[p+3]=f}}const l=this.gl;l.bindTexture(l.TEXTURE_2D,this.textures[this.currentIdx]),l.texSubImage2D(l.TEXTURE_2D,0,0,0,r,t,l.RGBA,l.UNSIGNED_BYTE,n)}extractGrid(){const e=this.gl,t=new Uint8Array(this.cols*this.rows*4);e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[this.currentIdx]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.UNSIGNED_BYTE,t);const r=[];let n=0;for(let l=0;l<this.rows;l++){const a=[];for(let c=0;c<this.cols;c++){const d=(l*this.cols+c)*4,f=t[d]>127;a.push(f),f&&n++}r.push(a)}return{cells:r,liveCells:n}}loadStressPreset(e){const t=this.cols*this.rows,r=new Uint8Array(t*4),n=(a,c)=>{const d=(a%this.rows+this.rows)%this.rows,f=(c%this.cols+this.cols)%this.cols,p=(d*this.cols+f)*4;r[p]=255,r[p+3]=255};if(e==="supernova-soup"){for(let a=0;a<t;a++)if(Math.random()<.5){const c=a*4;r[c]=255,r[c+3]=255}}else if(e==="glider-megacity")for(let c=0;c<this.rows-16;c+=16)for(let d=0;d<this.cols-16;d+=16)n(c,d+1),n(c+1,d+2),n(c+2,d),n(c+2,d+1),n(c+2,d+2);else if(e==="gun-matrix"){const a=[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]],c=60,d=80;for(let f=5;f<this.rows-20;f+=c)for(let p=5;p<this.cols-40;p+=d)for(const[Q,Ce]of a)n(f+Q,p+Ce)}else if(e==="pulsar-galaxy"){const a=[[1,3],[1,4],[1,5],[1,9],[1,10],[1,11],[3,1],[3,6],[3,8],[3,13],[4,1],[4,6],[4,8],[4,13],[5,1],[5,6],[5,8],[5,13],[6,3],[6,4],[6,5],[6,9],[6,10],[6,11],[8,3],[8,4],[8,5],[8,9],[8,10],[8,11],[9,1],[9,6],[9,8],[9,13],[10,1],[10,6],[10,8],[10,13],[11,1],[11,6],[11,8],[11,13],[13,3],[13,4],[13,5],[13,9],[13,10],[13,11]],c=24;for(let d=2;d<this.rows-c;d+=c)for(let f=2;f<this.cols-c;f+=c)for(const[p,Q]of a)n(d+p,f+Q)}const l=this.gl;l.bindTexture(l.TEXTURE_2D,this.textures[this.currentIdx]),l.texSubImage2D(l.TEXTURE_2D,0,0,0,this.cols,this.rows,l.RGBA,l.UNSIGNED_BYTE,r)}initShaders(){const e=this.gl,t=this.compileShader(e.VERTEX_SHADER,v),r=this.compileShader(e.FRAGMENT_SHADER,S),n=this.compileShader(e.FRAGMENT_SHADER,de);this.simProgram=this.createProgram(t,r),this.displayProgram=this.createProgram(t,n),this.simResLoc=e.getUniformLocation(this.simProgram,"u_resolution"),this.simGridLoc=e.getUniformLocation(this.simProgram,"u_grid"),this.dispGridLoc=e.getUniformLocation(this.displayProgram,"u_grid"),this.dispResLoc=e.getUniformLocation(this.displayProgram,"u_resolution"),this.dispScreenLoc=e.getUniformLocation(this.displayProgram,"u_screenSize"),this.dispShowGridLoc=e.getUniformLocation(this.displayProgram,"u_showGrid"),this.dispColorModeLoc=e.getUniformLocation(this.displayProgram,"u_colorMode")}createTexture(){const e=this.gl,t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),t}createFBO(e){const t=this.gl,r=t.createFramebuffer();return t.bindFramebuffer(t.FRAMEBUFFER,r),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,e,0),r}compileShader(e,t){const r=this.gl,n=r.createShader(e);if(r.shaderSource(n,t),r.compileShader(n),!r.getShaderParameter(n,r.COMPILE_STATUS)){const l=r.getShaderInfoLog(n);throw r.deleteShader(n),new Error("Shader compile error: "+l)}return n}createProgram(e,t){const r=this.gl,n=r.createProgram();if(r.attachShader(n,e),r.attachShader(n,t),r.linkProgram(n),!r.getProgramParameter(n,r.LINK_STATUS)){const l=r.getProgramInfoLog(n);throw r.deleteProgram(n),new Error("Program link error: "+l)}return n}}const I=document.getElementById("boardFrame"),u=document.getElementById("board"),T=document.getElementById("generation"),E=document.getElementById("live"),X=document.getElementById("size"),U=document.getElementById("hint"),_=document.getElementById("play"),ge=document.getElementById("step"),me=document.getElementById("clear"),he=document.getElementById("random"),R=document.getElementById("speed"),B=document.getElementById("speedValue"),$=document.getElementById("density"),fe=document.getElementById("densityValue"),z=document.getElementById("patternList"),Z=document.getElementById("cancelPattern"),G=document.getElementById("engineSelect"),ee=document.getElementById("colorModeSelect"),H=document.getElementById("gridSizeSelect"),V=document.getElementById("engineBadge"),b=document.getElementById("activeEngineText"),pe=document.getElementById("fps"),xe=document.getElementById("gps"),te=document.getElementById("frameTime"),L=document.getElementById("runBenchmark"),M=document.getElementById("benchmarkResult"),Y=document.getElementById("fullscreenBtn"),ne=document.getElementById("substepsSelect");let h="client-gpu",s={rows:42,cols:72,generation:0,liveCells:0,cells:[]},w=!1,D=!1,N=!0,P=null;const q=new Map;let i=null,A=null,F=null,J=0,k=0,oe=performance.now(),W=performance.now();function ve(o,e){try{i?i.resize(o,e):i=new ue(u,o,e)}catch(t){console.warn("WebGL2 not available, falling back to server simulation:",t),h="server-parallel",G.value="server-parallel",O()}}function O(){h==="client-gpu"?(V.textContent="GPU WebGL2",b.textContent="GPU Shader",b.style.color="var(--phosphor)"):h==="server-parallel"?(V.textContent="CPU Multi-thread",b.textContent="Java Parallel",b.style.color="var(--amber)"):(V.textContent="CPU Single-thread",b.textContent="Java Sequential",b.style.color="var(--muted)")}function C(o){s=o,T.textContent=String(s.generation),E.textContent=String(s.liveCells),X.textContent=`${s.rows} × ${s.cols}`,i&&((i.rows!==s.rows||i.cols!==s.cols)&&i.resize(s.rows,s.cols),s.cells&&s.cells.length>0&&i.loadGrid(s.cells),i.render(u.width,u.height))}function x(){i&&(i.render(u.width,u.height),J++)}function re(){const o=performance.now(),e=o-oe;if(e>=1e3){const t=Math.round(J*1e3/e),r=Math.round(k*1e3/e);pe.textContent=String(t),xe.textContent=String(r),J=0,k=0,oe=o}}function se(o){const e=u.getBoundingClientRect(),t=Math.max(0,Math.min(.9999,(o.clientX-e.left)/e.width)),r=Math.max(0,Math.min(.9999,(o.clientY-e.top)/e.height)),n=Math.floor(t*s.cols);return{row:Math.floor(r*s.rows),col:n}}async function ie(o,e,t){h==="client-gpu"&&i?(i.setCell(o,e,t),s.cells&&s.cells[o]&&(s.cells[o][e]=t),i.render(u.width,u.height)):C(await g("/api/game/paint",{method:"POST",body:JSON.stringify({row:o,col:e,alive:t})}))}async function Ee(o,e){const t=q.get(P);if(h==="client-gpu"&&i){if(t&&t.cells&&t.cells.length>0)for(const n of t.cells){const l=((o+n.row)%s.rows+s.rows)%s.rows,a=((e+n.col)%s.cols+s.cols)%s.cols;i.setCell(l,a,!0),s.cells&&s.cells[l]&&(s.cells[l][a]=!0)}x();const r=i.extractGrid();s.liveCells=r.liveCells,E.textContent=String(s.liveCells)}else{const n=await g("/api/game/pattern",{method:"POST",body:JSON.stringify({id:P,row:o,col:e})});C(n)}}function j(){if(!i)return;const o=performance.now();i.step();const e=performance.now();te.textContent=(e-o).toFixed(1),s.generation++,k++}function ye(){if(j(),T.textContent=String(s.generation),x(),s.generation%60===0&&i){const o=i.extractGrid();E.textContent=String(o.liveCells)}}async function le(){const o=performance.now(),e=await g("/api/game/step",{method:"POST"}),t=performance.now();te.textContent=(t-o).toFixed(1),k++,C(e)}function ce(){if(!w||h!=="client-gpu")return;const o=Number(R.value),e=ne?Number(ne.value):1;if(o===0){for(let t=0;t<e;t++)j();T.textContent=String(s.generation),x()}else{const t=performance.now();if(t-W>=o){for(let r=0;r<e;r++)j();T.textContent=String(s.generation),x(),W=t}else x()}if(s.generation%60===0&&i){const t=i.extractGrid();E.textContent=String(t.liveCells)}re(),A=requestAnimationFrame(ce)}function K(){if(!w)if(w=!0,_.textContent="Pause",_.classList.add("running"),W=performance.now(),h==="client-gpu")A=requestAnimationFrame(ce);else{const o=async()=>{if(w)try{await le(),re(),F=setTimeout(o,Number(R.value))}catch(e){y();const t=e instanceof Error?e.message:String(e);U.textContent=`Play stopped: ${t}. Press Play to resume.`}};o()}}function y(){if(w=!1,_.textContent="Play",_.classList.remove("running"),A!==null&&(cancelAnimationFrame(A),A=null),F!==null&&(clearTimeout(F),F=null),h==="client-gpu"&&i){const o=i.extractGrid();s.cells=o.cells,s.liveCells=o.liveCells,E.textContent=String(s.liveCells)}}function Te(){const o=I.classList.toggle("fullscreen");Y.textContent=o?"✕ Exit Fullscreen":"⛶ Fullscreen",o&&document.fullscreenEnabled&&!document.fullscreenElement?I.requestFullscreen().catch(()=>{}):!o&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),i&&i.render(u.width,u.height)}Y.addEventListener("click",Te),document.addEventListener("fullscreenchange",()=>{!document.fullscreenElement&&I.classList.contains("fullscreen")&&(I.classList.remove("fullscreen"),Y.textContent="⛶ Fullscreen")});function ae(o){P=o,Z.hidden=!o,U.textContent=o?`Stamping “${o}”. Click the board to place it.`:"Click or drag to paint cells. Choose a pattern, then click the board to stamp it.",[...z.querySelectorAll(".pattern")].forEach(e=>{e.classList.toggle("active",e.dataset.id===o)})}_.addEventListener("click",()=>{w?y():K()}),ge.addEventListener("click",async()=>{y(),h==="client-gpu"?ye():await le()}),me.addEventListener("click",async()=>{y(),h==="client-gpu"&&i&&(i.clear(),s.generation=0,s.liveCells=0,T.textContent="0",E.textContent="0",x()),C(await g("/api/game/clear",{method:"POST"}))}),he.addEventListener("click",async()=>{y();const o=Number($.value);if(h==="client-gpu"&&i){i.randomize(o),s.generation=0,T.textContent="0";const e=i.extractGrid();s.cells=e.cells,s.liveCells=e.liveCells,E.textContent=String(s.liveCells),x()}else C(await g("/api/game/random",{method:"POST",body:JSON.stringify({density:o})}))}),R.addEventListener("input",()=>{const o=Number(R.value);if(o===0)B.textContent="⚡ Uncapped (Hardware Native Hz)";else{const e=Math.round(1e3/o);B.textContent=`${o} ms (${e} tps)`}}),$.addEventListener("input",()=>{fe.textContent=`${Math.round(Number($.value)*100)}%`}),Z.addEventListener("click",()=>ae(null)),ee.addEventListener("change",()=>{const o=Number(ee.value);i&&(i.setColorMode(o),x())}),G.addEventListener("change",async()=>{const o=w;y(),h=G.value,O(),h==="server-parallel"?await g("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"PARALLEL"})}):h==="server-single"&&await g("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"SEQUENTIAL"})}),C(await g("/api/game")),o&&K()}),H.addEventListener("change",async()=>{y();const[o,e]=H.value.split("x").map(Number);s.rows=o,s.cols=e,s.generation=0,X.textContent=`${o} × ${e}`,o===e?(u.width=1024,u.height=1024):(u.width=1152,u.height=672),i&&(i.resize(o,e),i.clear());try{await g("/api/game/reset",{method:"POST",body:JSON.stringify({rows:o,cols:e})})}catch(t){console.warn("Backend resize sync:",t)}T.textContent="0",E.textContent="0",x()}),document.querySelectorAll(".stress-btn").forEach(o=>{o.addEventListener("click",async()=>{var l;const e=o.dataset.preset;y(),h="client-gpu",G.value="client-gpu",O();let t="1024x1024";(e==="gun-matrix"||e==="pulsar-galaxy")&&(t="512x512"),H.value=t;const[r,n]=t.split("x").map(Number);if(s.rows=r,s.cols=n,s.generation=0,X.textContent=`${r} × ${n}`,u.width=1024,u.height=1024,i){i.resize(r,n),i.loadStressPreset(e);const a=i.extractGrid();s.liveCells=a.liveCells,E.textContent=String(s.liveCells),x()}try{await g("/api/game/reset",{method:"POST",body:JSON.stringify({rows:r,cols:n})})}catch{}U.textContent=`🚀 Stress preset "${(l=o.textContent)==null?void 0:l.trim()}" loaded! Running at full GPU speed.`,K()})}),L.addEventListener("click",async()=>{L.disabled=!0,L.textContent="Running...",M.hidden=!1,M.innerHTML="<em>Warming up JIT & running 200 generations across all CPU cores...</em>";try{const o=await g("/api/game/benchmark",{method:"POST",body:JSON.stringify({generations:200,rows:128,cols:128})});M.innerHTML=`
      <div>Grid: <strong>${o.rows} × ${o.cols}</strong> (${o.totalCells.toLocaleString()} cells) · CPU Cores: <strong>${o.availableProcessors}</strong></div>
      <div>Sequential: <strong>${o.sequentialDurationMs}ms</strong> (${o.sequentialGps} gen/s)</div>
      <div>Parallel: <strong>${o.parallelDurationMs}ms</strong> (${o.parallelGps} gen/s)</div>
      <div style="margin-top:4px; color:var(--phosphor);">Speedup Factor: <strong>${o.speedupFactor}×</strong> faster</div>
    `}catch(o){M.textContent="Benchmark failed: "+(o instanceof Error?o.message:String(o))}finally{L.disabled=!1,L.textContent="Run Test"}}),u.addEventListener("pointerdown",async o=>{const{row:e,col:t}=se(o);if(P){await Ee(e,t);return}D=!0,u.setPointerCapture(o.pointerId),N=!(s.cells&&s.cells[e]&&s.cells[e][t]),await ie(e,t,N)}),u.addEventListener("pointermove",async o=>{if(!D||P)return;const{row:e,col:t}=se(o);s.cells&&s.cells[e]&&s.cells[e][t]===N||await ie(e,t,N)}),u.addEventListener("pointerup",()=>{D=!1}),u.addEventListener("pointercancel",()=>{D=!1});async function we(){O();const o=await g("/api/game/patterns");z.innerHTML="",q.clear(),o.forEach(r=>{q.set(r.id,r);const n=document.createElement("button");n.type="button",n.className="pattern",n.dataset.id=r.id,n.innerHTML=`${r.name}<small>${r.description}</small>`,n.addEventListener("click",()=>{ae(P===r.id?null:r.id)}),z.appendChild(n)});const e=await g("/api/game");ve(e.rows,e.cols),C(e);const t=Number(R.value);t===0?B.textContent="⚡ Uncapped (Hardware Native Hz)":B.textContent=`${t} ms (${Math.round(1e3/t)} tps)`}we().catch(o=>{const e=o instanceof Error?o.message:String(o);U.textContent=`Could not reach the Game of Life API: ${e}`})})();
