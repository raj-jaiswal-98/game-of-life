var be=Object.defineProperty;var Pe=(g,v,S)=>v in g?be(g,v,{enumerable:!0,configurable:!0,writable:!0,value:S}):g[v]=S;var h=(g,v,S)=>Pe(g,typeof v!="symbol"?v+"":v,S);(function(){"use strict";async function g(o,e={}){const t=await fetch(o,{headers:{"Content-Type":"application/json"},...e});if(!t.ok){const n=await t.text();throw new Error(n||t.statusText)}return t.json()}const v=`#version 300 es
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
`;class ue{constructor(e,t,n){h(this,"gl");h(this,"simProgram");h(this,"displayProgram");h(this,"textures");h(this,"fbos");h(this,"currentIdx",0);h(this,"rows");h(this,"cols");h(this,"colorMode",0);h(this,"vao");h(this,"simResLoc");h(this,"simGridLoc");h(this,"dispGridLoc");h(this,"dispResLoc");h(this,"dispScreenLoc");h(this,"dispShowGridLoc");h(this,"dispColorModeLoc");const r=e.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!r)throw new Error("WebGL 2.0 is not supported by your browser or graphics hardware.");this.gl=r,this.rows=t,this.cols=n,this.initShaders(),this.vao=r.createVertexArray(),this.textures=[this.createTexture(),this.createTexture()],this.fbos=[this.createFBO(this.textures[0]),this.createFBO(this.textures[1])],this.resize(t,n)}resize(e,t){this.rows=e,this.cols=t;const n=this.gl,r=new Uint8Array(t*e*4);for(let i=0;i<2;i++)n.bindTexture(n.TEXTURE_2D,this.textures[i]),n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,t,e,0,n.RGBA,n.UNSIGNED_BYTE,r);this.currentIdx=0}setColorMode(e){this.colorMode=e}step(){const e=this.gl,t=1-this.currentIdx;e.useProgram(this.simProgram),e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[t]),e.viewport(0,0,this.cols,this.rows),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.textures[this.currentIdx]),e.uniform1i(this.simGridLoc,0),e.uniform2f(this.simResLoc,this.cols,this.rows),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),this.currentIdx=t}render(e,t,n=!0){const r=this.gl;r.useProgram(this.displayProgram),r.bindFramebuffer(r.FRAMEBUFFER,null),r.viewport(0,0,e,t),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.textures[this.currentIdx]),r.uniform1i(this.dispGridLoc,0),r.uniform2f(this.dispResLoc,this.cols,this.rows),r.uniform2f(this.dispScreenLoc,e,t),r.uniform1f(this.dispShowGridLoc,n?1:0),r.uniform1i(this.dispColorModeLoc,this.colorMode),r.bindVertexArray(this.vao),r.drawArrays(r.TRIANGLES,0,3)}setCell(e,t,n){if(e<0||e>=this.rows||t<0||t>=this.cols)return;const r=this.gl,i=n?255:0,a=new Uint8Array([i,0,0,i]);r.bindTexture(r.TEXTURE_2D,this.textures[this.currentIdx]),r.texSubImage2D(r.TEXTURE_2D,0,t,e,1,1,r.RGBA,r.UNSIGNED_BYTE,a)}randomize(e){const t=this.cols*this.rows,n=new Uint8Array(t*4);for(let i=0;i<t;i++){const a=Math.random()<e?255:0,c=i*4;n[c]=a,n[c+1]=0,n[c+2]=0,n[c+3]=a}const r=this.gl;r.bindTexture(r.TEXTURE_2D,this.textures[this.currentIdx]),r.texSubImage2D(r.TEXTURE_2D,0,0,0,this.cols,this.rows,r.RGBA,r.UNSIGNED_BYTE,n)}clear(){const e=this.cols*this.rows,t=new Uint8Array(e*4),n=this.gl;for(let r=0;r<2;r++)n.bindTexture(n.TEXTURE_2D,this.textures[r]),n.texSubImage2D(n.TEXTURE_2D,0,0,0,this.cols,this.rows,n.RGBA,n.UNSIGNED_BYTE,t)}loadGrid(e){const t=e.length,n=e[0].length;(t!==this.rows||n!==this.cols)&&this.resize(t,n);const r=new Uint8Array(n*t*4);for(let a=0;a<t;a++){const c=e[a];for(let d=0;d<n;d++){const m=c&&c[d]?255:0,p=(a*n+d)*4;r[p]=m,r[p+1]=0,r[p+2]=0,r[p+3]=m}}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,n,t,i.RGBA,i.UNSIGNED_BYTE,r)}extractGrid(){const e=this.gl,t=new Uint8Array(this.cols*this.rows*4);e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[this.currentIdx]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.UNSIGNED_BYTE,t);const n=[];let r=0;for(let i=0;i<this.rows;i++){const a=[];for(let c=0;c<this.cols;c++){const d=(i*this.cols+c)*4,m=t[d]>127;a.push(m),m&&r++}n.push(a)}return{cells:n,liveCells:r}}loadStressPreset(e){const t=this.cols*this.rows,n=new Uint8Array(t*4),r=(a,c)=>{const d=(a%this.rows+this.rows)%this.rows,m=(c%this.cols+this.cols)%this.cols,p=(d*this.cols+m)*4;n[p]=255,n[p+3]=255};if(e==="supernova-soup"){for(let a=0;a<t;a++)if(Math.random()<.5){const c=a*4;n[c]=255,n[c+3]=255}}else if(e==="glider-megacity")for(let c=0;c<this.rows-16;c+=16)for(let d=0;d<this.cols-16;d+=16)r(c,d+1),r(c+1,d+2),r(c+2,d),r(c+2,d+1),r(c+2,d+2);else if(e==="gun-matrix"){const a=[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]],c=60,d=80;for(let m=5;m<this.rows-20;m+=c)for(let p=5;p<this.cols-40;p+=d)for(const[Q,Se]of a)r(m+Q,p+Se)}else if(e==="pulsar-galaxy"){const a=[[1,3],[1,4],[1,5],[1,9],[1,10],[1,11],[3,1],[3,6],[3,8],[3,13],[4,1],[4,6],[4,8],[4,13],[5,1],[5,6],[5,8],[5,13],[6,3],[6,4],[6,5],[6,9],[6,10],[6,11],[8,3],[8,4],[8,5],[8,9],[8,10],[8,11],[9,1],[9,6],[9,8],[9,13],[10,1],[10,6],[10,8],[10,13],[11,1],[11,6],[11,8],[11,13],[13,3],[13,4],[13,5],[13,9],[13,10],[13,11]],c=24;for(let d=2;d<this.rows-c;d+=c)for(let m=2;m<this.cols-c;m+=c)for(const[p,Q]of a)r(d+p,m+Q)}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,this.cols,this.rows,i.RGBA,i.UNSIGNED_BYTE,n)}initShaders(){const e=this.gl,t=this.compileShader(e.VERTEX_SHADER,v),n=this.compileShader(e.FRAGMENT_SHADER,S),r=this.compileShader(e.FRAGMENT_SHADER,de);this.simProgram=this.createProgram(t,n),this.displayProgram=this.createProgram(t,r),this.simResLoc=e.getUniformLocation(this.simProgram,"u_resolution"),this.simGridLoc=e.getUniformLocation(this.simProgram,"u_grid"),this.dispGridLoc=e.getUniformLocation(this.displayProgram,"u_grid"),this.dispResLoc=e.getUniformLocation(this.displayProgram,"u_resolution"),this.dispScreenLoc=e.getUniformLocation(this.displayProgram,"u_screenSize"),this.dispShowGridLoc=e.getUniformLocation(this.displayProgram,"u_showGrid"),this.dispColorModeLoc=e.getUniformLocation(this.displayProgram,"u_colorMode")}createTexture(){const e=this.gl,t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),t}createFBO(e){const t=this.gl,n=t.createFramebuffer();return t.bindFramebuffer(t.FRAMEBUFFER,n),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,e,0),n}compileShader(e,t){const n=this.gl,r=n.createShader(e);if(n.shaderSource(r,t),n.compileShader(r),!n.getShaderParameter(r,n.COMPILE_STATUS)){const i=n.getShaderInfoLog(r);throw n.deleteShader(r),new Error("Shader compile error: "+i)}return r}createProgram(e,t){const n=this.gl,r=n.createProgram();if(n.attachShader(r,e),n.attachShader(r,t),n.linkProgram(r),!n.getProgramParameter(r,n.LINK_STATUS)){const i=n.getProgramInfoLog(r);throw n.deleteProgram(r),new Error("Program link error: "+i)}return r}}const U=document.getElementById("boardFrame"),u=document.getElementById("board"),T=document.getElementById("generation"),E=document.getElementById("live"),X=document.getElementById("size"),I=document.getElementById("hint"),P=document.getElementById("play"),ge=document.getElementById("step"),me=document.getElementById("clear"),he=document.getElementById("random"),_=document.getElementById("speed"),B=document.getElementById("speedValue"),$=document.getElementById("density"),fe=document.getElementById("densityValue"),z=document.getElementById("patternList"),Z=document.getElementById("cancelPattern"),G=document.getElementById("engineSelect"),ee=document.getElementById("colorModeSelect"),H=document.getElementById("gridSizeSelect"),V=document.getElementById("engineBadge"),b=document.getElementById("activeEngineText"),pe=document.getElementById("fps"),xe=document.getElementById("gps"),te=document.getElementById("frameTime"),R=document.getElementById("runBenchmark"),M=document.getElementById("benchmarkResult"),Y=document.getElementById("fullscreenBtn"),ne=document.getElementById("substepsSelect");let f="client-gpu",s={rows:42,cols:72,generation:0,liveCells:0,cells:[]},w=!1,N=!1,D=!0,L=null;const q=new Map;let l=null,A=null,F=null,J=0,k=0,oe=performance.now(),W=performance.now();function ve(o,e){try{l?l.resize(o,e):l=new ue(u,o,e)}catch(t){console.warn("WebGL2 not available, falling back to server simulation:",t),f="server-parallel",G.value="server-parallel",O()}}function O(){f==="client-gpu"?(V.textContent="GPU WebGL2",b.textContent="GPU Shader",b.style.color="var(--phosphor)"):f==="server-parallel"?(V.textContent="CPU Multi-thread",b.textContent="Java Parallel",b.style.color="var(--amber)"):(V.textContent="CPU Single-thread",b.textContent="Java Sequential",b.style.color="var(--muted)")}function C(o){s=o,T.textContent=String(s.generation),E.textContent=String(s.liveCells),X.textContent=`${s.rows} × ${s.cols}`,l&&((l.rows!==s.rows||l.cols!==s.cols)&&l.resize(s.rows,s.cols),s.cells&&s.cells.length>0&&l.loadGrid(s.cells),l.render(u.width,u.height))}function x(){l&&(l.render(u.width,u.height),J++)}function re(){const o=performance.now(),e=o-oe;if(e>=1e3){const t=Math.round(J*1e3/e),n=Math.round(k*1e3/e);pe.textContent=String(t),xe.textContent=String(n),J=0,k=0,oe=o}}function se(o){const e=u.getBoundingClientRect(),t=Math.max(0,Math.min(.9999,(o.clientX-e.left)/e.width)),n=Math.max(0,Math.min(.9999,(o.clientY-e.top)/e.height)),r=Math.floor(t*s.cols);return{row:Math.floor(n*s.rows),col:r}}async function ie(o,e,t){f==="client-gpu"&&l?(l.setCell(o,e,t),s.cells&&s.cells[o]&&(s.cells[o][e]=t),l.render(u.width,u.height)):C(await g("/api/game/paint",{method:"POST",body:JSON.stringify({row:o,col:e,alive:t})}))}const Ee={glider:[[0,1],[1,2],[2,0],[2,1],[2,2]],lwss:[[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],blinker:[[0,0],[0,1],[0,2]],toad:[[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],beacon:[[0,0],[0,1],[1,0],[1,1],[2,2],[2,3],[3,2],[3,3]],pulsar:[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]],pentadecathlon:[[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]],block:[[0,0],[0,1],[1,0],[1,1]],beehive:[[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],gosper:[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]]};async function ye(o,e){const t=L,n=q.get(t),r=n&&n.cells&&n.cells.length>0?n.cells.map(i=>[i.row,i.col]):Ee[t.toLowerCase()]||[];if(f==="client-gpu"&&l){if(r.length>0)for(const[a,c]of r){const d=((o+a)%s.rows+s.rows)%s.rows,m=((e+c)%s.cols+s.cols)%s.cols;l.setCell(d,m,!0),s.cells&&s.cells[d]&&(s.cells[d][m]=!0)}x();const i=l.extractGrid();s.liveCells=i.liveCells,E.textContent=String(s.liveCells)}else{const a=await g("/api/game/pattern",{method:"POST",body:JSON.stringify({id:t,row:o,col:e})});C(a)}}function j(){if(!l)return;const o=performance.now();l.step();const e=performance.now();te.textContent=(e-o).toFixed(1),s.generation++,k++}function Te(){if(j(),T.textContent=String(s.generation),x(),s.generation%60===0&&l){const o=l.extractGrid();E.textContent=String(o.liveCells)}}async function le(){const o=performance.now(),e=await g("/api/game/step",{method:"POST"}),t=performance.now();te.textContent=(t-o).toFixed(1),k++,C(e)}function ce(){if(!w||f!=="client-gpu")return;const o=Number(_.value),e=ne?Number(ne.value):1;if(o===0){for(let t=0;t<e;t++)j();T.textContent=String(s.generation),x()}else{const t=performance.now();if(t-W>=o){for(let n=0;n<e;n++)j();T.textContent=String(s.generation),x(),W=t}else x()}if(s.generation%60===0&&l){const t=l.extractGrid();E.textContent=String(t.liveCells)}re(),A=requestAnimationFrame(ce)}function K(){if(!w)if(w=!0,P.textContent="Pause",P.classList.add("running"),W=performance.now(),f==="client-gpu")A=requestAnimationFrame(ce);else{const o=async()=>{if(w)try{await le(),re(),F=setTimeout(o,Number(_.value))}catch(e){y();const t=e instanceof Error?e.message:String(e);I.textContent=`Play stopped: ${t}. Press Play to resume.`}};o()}}function y(){if(w=!1,P.textContent="Play",P.classList.remove("running"),A!==null&&(cancelAnimationFrame(A),A=null),F!==null&&(clearTimeout(F),F=null),f==="client-gpu"&&l){const o=l.extractGrid();s.cells=o.cells,s.liveCells=o.liveCells,E.textContent=String(s.liveCells)}}function we(){const o=U.classList.toggle("fullscreen");Y.textContent=o?"✕ Exit Fullscreen":"⛶ Fullscreen",o&&document.fullscreenEnabled&&!document.fullscreenElement?U.requestFullscreen().catch(()=>{}):!o&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),l&&l.render(u.width,u.height)}Y.addEventListener("click",we),document.addEventListener("fullscreenchange",()=>{!document.fullscreenElement&&U.classList.contains("fullscreen")&&(U.classList.remove("fullscreen"),Y.textContent="⛶ Fullscreen")});function ae(o){L=o,Z.hidden=!o,I.textContent=o?`Stamping “${o}”. Click the board to place it.`:"Click or drag to paint cells. Choose a pattern, then click the board to stamp it.",[...z.querySelectorAll(".pattern")].forEach(e=>{e.classList.toggle("active",e.dataset.id===o)})}P.addEventListener("click",()=>{w?y():K()}),ge.addEventListener("click",async()=>{y(),f==="client-gpu"?Te():await le()}),me.addEventListener("click",async()=>{y(),f==="client-gpu"&&l&&(l.clear(),s.generation=0,s.liveCells=0,T.textContent="0",E.textContent="0",x()),C(await g("/api/game/clear",{method:"POST"}))}),he.addEventListener("click",async()=>{y();const o=Number($.value);if(f==="client-gpu"&&l){l.randomize(o),s.generation=0,T.textContent="0";const e=l.extractGrid();s.cells=e.cells,s.liveCells=e.liveCells,E.textContent=String(s.liveCells),x()}else C(await g("/api/game/random",{method:"POST",body:JSON.stringify({density:o})}))}),_.addEventListener("input",()=>{const o=Number(_.value);if(o===0)B.textContent="⚡ Uncapped (Hardware Native Hz)";else{const e=Math.round(1e3/o);B.textContent=`${o} ms (${e} tps)`}}),$.addEventListener("input",()=>{fe.textContent=`${Math.round(Number($.value)*100)}%`}),Z.addEventListener("click",()=>ae(null)),ee.addEventListener("change",()=>{const o=Number(ee.value);l&&(l.setColorMode(o),x())}),G.addEventListener("change",async()=>{const o=w;y(),f=G.value,O(),f==="server-parallel"?await g("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"PARALLEL"})}):f==="server-single"&&await g("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"SEQUENTIAL"})}),C(await g("/api/game")),o&&K()}),H.addEventListener("change",async()=>{y();const[o,e]=H.value.split("x").map(Number);s.rows=o,s.cols=e,s.generation=0,X.textContent=`${o} × ${e}`,o===e?(u.width=1024,u.height=1024):(u.width=1152,u.height=672),l&&(l.resize(o,e),l.clear());try{await g("/api/game/reset",{method:"POST",body:JSON.stringify({rows:o,cols:e})})}catch(t){console.warn("Backend resize sync:",t)}T.textContent="0",E.textContent="0",x()}),document.querySelectorAll(".stress-btn").forEach(o=>{o.addEventListener("click",async()=>{var i;const e=o.dataset.preset;y(),f="client-gpu",G.value="client-gpu",O();let t="1024x1024";(e==="gun-matrix"||e==="pulsar-galaxy")&&(t="512x512"),H.value=t;const[n,r]=t.split("x").map(Number);if(s.rows=n,s.cols=r,s.generation=0,X.textContent=`${n} × ${r}`,u.width=1024,u.height=1024,l){l.resize(n,r),l.loadStressPreset(e);const a=l.extractGrid();s.liveCells=a.liveCells,E.textContent=String(s.liveCells),x()}try{await g("/api/game/reset",{method:"POST",body:JSON.stringify({rows:n,cols:r})})}catch{}I.textContent=`🚀 Stress preset "${(i=o.textContent)==null?void 0:i.trim()}" loaded! Running at full GPU speed.`,K()})}),R.addEventListener("click",async()=>{R.disabled=!0,R.textContent="Running...",M.hidden=!1,M.innerHTML="<em>Warming up JIT & running 200 generations across all CPU cores...</em>";try{const o=await g("/api/game/benchmark",{method:"POST",body:JSON.stringify({generations:200,rows:128,cols:128})});M.innerHTML=`
      <div>Grid: <strong>${o.rows} × ${o.cols}</strong> (${o.totalCells.toLocaleString()} cells) · CPU Cores: <strong>${o.availableProcessors}</strong></div>
      <div>Sequential: <strong>${o.sequentialDurationMs}ms</strong> (${o.sequentialGps} gen/s)</div>
      <div>Parallel: <strong>${o.parallelDurationMs}ms</strong> (${o.parallelGps} gen/s)</div>
      <div style="margin-top:4px; color:var(--phosphor);">Speedup Factor: <strong>${o.speedupFactor}×</strong> faster</div>
    `}catch(o){M.textContent="Benchmark failed: "+(o instanceof Error?o.message:String(o))}finally{R.disabled=!1,R.textContent="Run Test"}}),u.addEventListener("pointerdown",async o=>{const{row:e,col:t}=se(o);if(L){await ye(e,t);return}N=!0,u.setPointerCapture(o.pointerId),D=!(s.cells&&s.cells[e]&&s.cells[e][t]),await ie(e,t,D)}),u.addEventListener("pointermove",async o=>{if(!N||L)return;const{row:e,col:t}=se(o);s.cells&&s.cells[e]&&s.cells[e][t]===D||await ie(e,t,D)}),u.addEventListener("pointerup",()=>{N=!1}),u.addEventListener("pointercancel",()=>{N=!1});async function Ce(){O();const o=await g("/api/game/patterns");z.innerHTML="",q.clear(),o.forEach(n=>{q.set(n.id,n);const r=document.createElement("button");r.type="button",r.className="pattern",r.dataset.id=n.id,r.innerHTML=`${n.name}<small>${n.description}</small>`,r.addEventListener("click",()=>{ae(L===n.id?null:n.id)}),z.appendChild(r)});const e=await g("/api/game");ve(e.rows,e.cols),C(e);const t=Number(_.value);t===0?B.textContent="⚡ Uncapped (Hardware Native Hz)":B.textContent=`${t} ms (${Math.round(1e3/t)} tps)`;try{const n=await g("/api/game/hardware");n.gpuAvailable?console.log(`⚡ Backend Container GPU: ${n.deviceName}`):console.log(`⚙️ Backend Container CPU: ${n.deviceName}`)}catch{}}Ce().catch(o=>{const e=o instanceof Error?o.message:String(o);I.textContent=`Could not reach the Game of Life API: ${e}`})})();
