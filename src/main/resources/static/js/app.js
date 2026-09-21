var Ae=Object.defineProperty;var Be=(f,T,R)=>T in f?Ae(f,T,{enumerable:!0,configurable:!0,writable:!0,value:R}):f[T]=R;var g=(f,T,R)=>Be(f,typeof T!="symbol"?T+"":T,R);(function(){"use strict";async function f(l,e={}){const t=await fetch(l,{headers:{"Content-Type":"application/json"},...e});if(!t.ok){const o=await t.text();throw new Error(o||t.statusText)}return t.json()}const T=`#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    v_uv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
`,R=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_grid;
uniform vec2 u_resolution; // (cols, rows)
uniform int u_wallEnabled; // 1: 2-width wall collision buffer, 0: torus
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    ivec2 coord = ivec2(gl_FragCoord.xy);

    if (u_wallEnabled == 1) {
        if (coord.x < 2 || coord.x >= int(u_resolution.x) - 2 ||
            coord.y < 2 || coord.y >= int(u_resolution.y) - 2) {
            fragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
    }

    int count = 0;
    if (u_wallEnabled == 1) {
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) continue;
                int nx = coord.x + dx;
                int ny = coord.y + dy;
                if (nx >= 2 && nx < int(u_resolution.x) - 2 &&
                    ny >= 2 && ny < int(u_resolution.y) - 2) {
                    vec2 sampleCoord = (vec2(float(nx), float(ny)) + 0.5) * texel;
                    if (texture(u_grid, sampleCoord).r > 0.5) {
                        count++;
                    }
                }
            }
        }
    } else {
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
`,ye=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_grid;
uniform vec2 u_resolution; // grid (cols, rows)
uniform vec2 u_screenSize; // canvas (width, height)
uniform float u_showGrid;
uniform int u_colorMode;    // 0: Classic, 1: Age Heatmap, 2: Cyberpunk, 3: Thermal Glow
uniform int u_wallEnabled;
uniform int u_ghostCount;
uniform vec2 u_ghostOrigin;
uniform vec2 u_ghostOffsets[64];
out vec4 fragColor;

void main() {
    vec2 gridUV = vec2(v_uv.x, 1.0 - v_uv.y);
    vec2 cellCoord = floor(gridUV * u_resolution);
    bool isWallCell = (cellCoord.x < 2.0 || cellCoord.x >= u_resolution.x - 2.0 ||
                       cellCoord.y < 2.0 || cellCoord.y >= u_resolution.y - 2.0);

    vec4 cellData = texture(u_grid, gridUV);
    float alive = cellData.r;
    float age = cellData.g;
    float density = cellData.b;
    float trail = cellData.a;

    vec3 bgColor = vec3(13.0 / 255.0, 12.0 / 255.0, 10.0 / 255.0); // #0d0c0a
    vec3 color = bgColor;

    // Subtle fading phosphor trail for dead cells
    if (alive <= 0.5 && trail > 0.01 && !(u_wallEnabled == 1 && isWallCell)) {
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

    if (alive > 0.5 && !(u_wallEnabled == 1 && isWallCell)) {
        if (u_colorMode == 0) {
            // 0: Classic Phosphor & Amber
            vec3 liveColor = vec3(217.0 / 255.0, 227.0 / 255.0, 106.0 / 255.0); // #d9e36a
            vec3 highlight = vec3(224.0 / 255.0, 164.0 / 255.0, 90.0 / 255.0);  // #e0a45a
            vec2 cellPos = fract(gridUV * u_resolution);
            color = (cellPos.y < 0.15) ? mix(liveColor, highlight, 0.45) : liveColor;

        } else if (u_colorMode == 1) {
            // 1: Age Segmentation Heatmap
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
            // 2: Cyberpunk Neon
            vec3 cHotPink = vec3(1.00, 0.02, 0.55);
            vec3 cTurq    = vec3(0.00, 0.96, 0.92);
            vec3 cViolet  = vec3(0.70, 0.15, 1.00);
            color = mix(cTurq, cHotPink, age);
            if (density > 0.35) {
                color = mix(color, cViolet, 0.5);
            }

        } else if (u_colorMode == 3) {
            // 3: Thermal Energy Glow
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

    // Render 2-cell buffer wall styling
    if (u_wallEnabled == 1 && isWallCell) {
        vec2 px = floor(v_uv * u_screenSize);
        float stripe = step(0.5, fract((px.x + px.y) / 14.0));
        vec3 wallColor1 = vec3(22.0 / 255.0, 20.0 / 255.0, 18.0 / 255.0); // Dark steel slate
        vec3 wallColor2 = vec3(44.0 / 255.0, 36.0 / 255.0, 22.0 / 255.0); // Subtle amber hazard tint
        color = mix(wallColor1, wallColor2, stripe * 0.5);

        // Highlight inner edge of the 2-cell wall
        bool isInnerEdge = (cellCoord.x == 1.0 || cellCoord.x == u_resolution.x - 2.0 ||
                            cellCoord.y == 1.0 || cellCoord.y == u_resolution.y - 2.0);
        if (isInnerEdge) {
            color = mix(color, vec3(224.0 / 255.0, 164.0 / 255.0, 90.0 / 255.0), 0.45);
        }
    }

    // Ghost Pattern Preview Overlay
    if (u_ghostCount > 0) {
        for (int i = 0; i < 64; i++) {
            if (i >= u_ghostCount) break;
            vec2 offset = u_ghostOffsets[i];
            vec2 targetCell = mod(mod(u_ghostOrigin + offset, u_resolution) + u_resolution, u_resolution);
            if (abs(cellCoord.x - floor(targetCell.x)) < 0.5 && abs(cellCoord.y - floor(targetCell.y)) < 0.5) {
                vec3 ghostGlow = vec3(0.15, 0.95, 1.00); // Electric Cyan ghost glow
                color = mix(color, ghostGlow, 0.75);
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
`;class Ce{constructor(e,t,o){g(this,"gl");g(this,"simProgram");g(this,"displayProgram");g(this,"textures");g(this,"fbos");g(this,"currentIdx",0);g(this,"rows");g(this,"cols");g(this,"colorMode",0);g(this,"wallMode",!1);g(this,"ghostCount",0);g(this,"ghostOrigin",[0,0]);g(this,"ghostOffsets",new Float32Array(128));g(this,"vao");g(this,"simResLoc");g(this,"simGridLoc");g(this,"simWallLoc");g(this,"dispGridLoc");g(this,"dispResLoc");g(this,"dispScreenLoc");g(this,"dispShowGridLoc");g(this,"dispColorModeLoc");g(this,"dispWallLoc");g(this,"dispGhostCountLoc");g(this,"dispGhostOriginLoc");g(this,"dispGhostOffsetsLoc");const s=e.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!s)throw new Error("WebGL 2.0 is not supported by your browser or graphics hardware.");this.gl=s,this.rows=t,this.cols=o,this.initShaders(),this.vao=s.createVertexArray(),this.textures=[this.createTexture(),this.createTexture()],this.fbos=[this.createFBO(this.textures[0]),this.createFBO(this.textures[1])],this.resize(t,o,!1)}resize(e,t,o=!1){let s=null;if(o&&this.cols>0&&this.rows>0)try{s=this.extractGrid().cells}catch{s=null}this.rows=e,this.cols=t;const i=this.gl,d=new Uint8Array(t*e*4);for(let a=0;a<2;a++)i.bindTexture(i.TEXTURE_2D,this.textures[a]),i.texImage2D(i.TEXTURE_2D,0,i.RGBA8,t,e,0,i.RGBA,i.UNSIGNED_BYTE,d);if(this.currentIdx=0,s&&s.length>0){const a=[],c=Math.min(s.length,e),u=Math.min(s[0].length,t);for(let h=0;h<e;h++){const w=[];for(let y=0;y<t;y++)this.wallMode&&(h<2||h>=e-2||y<2||y>=t-2)?w.push(!1):h<c&&y<u?w.push(s[h][y]):w.push(!1);a.push(w)}this.loadGrid(a)}}setColorMode(e){this.colorMode=e}setWallMode(e){if(this.wallMode=e,this.wallMode)for(let t=0;t<this.rows;t++)for(let o=0;o<this.cols;o++)(t<2||t>=this.rows-2||o<2||o>=this.cols-2)&&this.setCell(t,o,!1)}setGhostPattern(e,t,o){const s=Math.min(o.length,64);this.ghostCount=s,this.ghostOrigin=[e,t],this.ghostOffsets.fill(0);for(let i=0;i<s;i++){const[d,a]=o[i];this.ghostOffsets[i*2]=a,this.ghostOffsets[i*2+1]=d}}clearGhostPattern(){this.ghostCount=0}step(){const e=this.gl,t=1-this.currentIdx;e.useProgram(this.simProgram),e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[t]),e.viewport(0,0,this.cols,this.rows),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.textures[this.currentIdx]),e.uniform1i(this.simGridLoc,0),e.uniform2f(this.simResLoc,this.cols,this.rows),e.uniform1i(this.simWallLoc,this.wallMode?1:0),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),this.currentIdx=t}render(e,t,o=!0){const s=this.gl;s.useProgram(this.displayProgram),s.bindFramebuffer(s.FRAMEBUFFER,null),s.viewport(0,0,e,t),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.uniform1i(this.dispGridLoc,0),s.uniform2f(this.dispResLoc,this.cols,this.rows),s.uniform2f(this.dispScreenLoc,e,t),s.uniform1f(this.dispShowGridLoc,o?1:0),s.uniform1i(this.dispColorModeLoc,this.colorMode),s.uniform1i(this.dispWallLoc,this.wallMode?1:0),s.uniform1i(this.dispGhostCountLoc,this.ghostCount),s.uniform2f(this.dispGhostOriginLoc,this.ghostOrigin[0],this.ghostOrigin[1]),s.uniform2fv(this.dispGhostOffsetsLoc,this.ghostOffsets),s.bindVertexArray(this.vao),s.drawArrays(s.TRIANGLES,0,3)}setCell(e,t,o){if(e<0||e>=this.rows||t<0||t>=this.cols||this.wallMode&&o&&(e<2||e>=this.rows-2||t<2||t>=this.cols-2))return;const s=this.gl,i=o?255:0,d=new Uint8Array([i,0,0,i]);s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.texSubImage2D(s.TEXTURE_2D,0,t,e,1,1,s.RGBA,s.UNSIGNED_BYTE,d)}randomize(e){const t=this.cols*this.rows,o=new Uint8Array(t*4);for(let i=0;i<this.rows;i++)for(let d=0;d<this.cols;d++){const a=i*this.cols+d;let c=0;(!this.wallMode||i>=2&&i<this.rows-2&&d>=2&&d<this.cols-2)&&(c=Math.random()<e?255:0);const u=a*4;o[u]=c,o[u+1]=0,o[u+2]=0,o[u+3]=c}const s=this.gl;s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.texSubImage2D(s.TEXTURE_2D,0,0,0,this.cols,this.rows,s.RGBA,s.UNSIGNED_BYTE,o)}clear(){const e=this.cols*this.rows,t=new Uint8Array(e*4),o=this.gl;for(let s=0;s<2;s++)o.bindTexture(o.TEXTURE_2D,this.textures[s]),o.texSubImage2D(o.TEXTURE_2D,0,0,0,this.cols,this.rows,o.RGBA,o.UNSIGNED_BYTE,t)}loadGrid(e){const t=e.length,o=e[0].length;(t!==this.rows||o!==this.cols)&&this.resize(t,o,!1);const s=new Uint8Array(o*t*4);for(let d=0;d<t;d++){const a=e[d];for(let c=0;c<o;c++){let u=a&&a[c]?255:0;this.wallMode&&(d<2||d>=t-2||c<2||c>=o-2)&&(u=0);const h=(d*o+c)*4;s[h]=u,s[h+1]=0,s[h+2]=0,s[h+3]=u}}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,o,t,i.RGBA,i.UNSIGNED_BYTE,s)}extractGrid(){const e=this.gl,t=new Uint8Array(this.cols*this.rows*4);e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[this.currentIdx]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.UNSIGNED_BYTE,t);const o=[];let s=0;for(let i=0;i<this.rows;i++){const d=[];for(let a=0;a<this.cols;a++){const c=(i*this.cols+a)*4,u=t[c]>127;d.push(u),u&&s++}o.push(d)}return{cells:o,liveCells:s}}loadStressPreset(e){const t=this.cols*this.rows,o=new Uint8Array(t*4),s=(d,a)=>{const c=(d%this.rows+this.rows)%this.rows,u=(a%this.cols+this.cols)%this.cols;if(this.wallMode&&(c<2||c>=this.rows-2||u<2||u>=this.cols-2))return;const h=(c*this.cols+u)*4;o[h]=255,o[h+3]=255};if(e==="supernova-soup"){for(let d=0;d<this.rows;d++)for(let a=0;a<this.cols;a++)if(!(this.wallMode&&(d<2||d>=this.rows-2||a<2||a>=this.cols-2))&&Math.random()<.5){const c=(d*this.cols+a)*4;o[c]=255,o[c+3]=255}}else if(e==="glider-megacity")for(let a=0;a<this.rows-16;a+=16)for(let c=0;c<this.cols-16;c+=16)s(a,c+1),s(a+1,c+2),s(a+2,c),s(a+2,c+1),s(a+2,c+2);else if(e==="gun-matrix"){const c=[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]];for(let u=4;u<this.rows-38;u+=38)for(let h=4;h<this.cols-42;h+=42)for(const[w,y]of c)s(u+w,h+y)}else if(e==="pulsar-galaxy"){const a=[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]];for(let c=4;c<this.rows-20;c+=20)for(let u=4;u<this.cols-20;u+=20)for(const[h,w]of a)s(c+h,u+w)}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,this.cols,this.rows,i.RGBA,i.UNSIGNED_BYTE,o)}initShaders(){const e=this.gl,t=this.compileShader(e.VERTEX_SHADER,T),o=this.compileShader(e.FRAGMENT_SHADER,R),s=this.compileShader(e.FRAGMENT_SHADER,ye);this.simProgram=this.createProgram(t,o),this.displayProgram=this.createProgram(t,s),this.simResLoc=e.getUniformLocation(this.simProgram,"u_resolution"),this.simGridLoc=e.getUniformLocation(this.simProgram,"u_grid"),this.simWallLoc=e.getUniformLocation(this.simProgram,"u_wallEnabled"),this.dispGridLoc=e.getUniformLocation(this.displayProgram,"u_grid"),this.dispResLoc=e.getUniformLocation(this.displayProgram,"u_resolution"),this.dispScreenLoc=e.getUniformLocation(this.displayProgram,"u_screenSize"),this.dispShowGridLoc=e.getUniformLocation(this.displayProgram,"u_showGrid"),this.dispColorModeLoc=e.getUniformLocation(this.displayProgram,"u_colorMode"),this.dispWallLoc=e.getUniformLocation(this.displayProgram,"u_wallEnabled"),this.dispGhostCountLoc=e.getUniformLocation(this.displayProgram,"u_ghostCount"),this.dispGhostOriginLoc=e.getUniformLocation(this.displayProgram,"u_ghostOrigin"),this.dispGhostOffsetsLoc=e.getUniformLocation(this.displayProgram,"u_ghostOffsets")}createTexture(){const e=this.gl,t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),t}createFBO(e){const t=this.gl,o=t.createFramebuffer();return t.bindFramebuffer(t.FRAMEBUFFER,o),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,e,0),o}compileShader(e,t){const o=this.gl,s=o.createShader(e);if(o.shaderSource(s,t),o.compileShader(s),!o.getShaderParameter(s,o.COMPILE_STATUS)){const i=o.getShaderInfoLog(s);throw o.deleteShader(s),new Error("Shader compile error: "+i)}return s}createProgram(e,t){const o=this.gl,s=o.createProgram();if(o.attachShader(s,e),o.attachShader(s,t),o.linkProgram(s),!o.getProgramParameter(s,o.LINK_STATUS)){const i=o.getProgramInfoLog(s);throw o.deleteProgram(s),new Error("Program link error: "+i)}return s}}const k=document.getElementById("boardFrame"),m=document.getElementById("board"),M=document.getElementById("generation"),C=document.getElementById("live"),j=document.getElementById("size"),P=document.getElementById("hint"),U=document.getElementById("play"),Te=document.getElementById("step"),Se=document.getElementById("clear"),be=document.getElementById("random"),A=document.getElementById("speed"),$=document.getElementById("speedValue"),K=document.getElementById("density"),_e=document.getElementById("densityValue"),Q=document.getElementById("patternList"),B=document.getElementById("cancelPattern"),ae=document.getElementById("patternBadge"),de=document.getElementById("patternTools"),Z=document.getElementById("rotatePatternBtn"),ee=document.getElementById("centerPatternBtn"),G=document.getElementById("wallToggle"),X=document.getElementById("engineSelect"),ue=document.getElementById("colorModeSelect"),N=document.getElementById("gridSizeSelect"),te=document.getElementById("engineBadge"),I=document.getElementById("activeEngineText"),Le=document.getElementById("fps"),Pe=document.getElementById("gps"),ge=document.getElementById("frameTime"),O=document.getElementById("runBenchmark"),z=document.getElementById("benchmarkResult"),oe=document.getElementById("fullscreenBtn"),he=document.getElementById("substepsSelect");let p="client-gpu",n={rows:42,cols:72,generation:0,liveCells:0,cells:[]},S=!1,W=!1,H=!0,x=null,E=0,b=null;const se=new Map;let r=null,D=null,V=null,ne=0,Y=0,fe=performance.now(),le=performance.now();function Re(l,e){try{r?r.resize(l,e,!1):r=new Ce(m,l,e)}catch(t){console.warn("WebGL2 not available, falling back to server simulation:",t),p="server-parallel",X.value="server-parallel",J()}}function J(){p==="client-gpu"?(te.textContent="GPU WebGL2",I.textContent="GPU Shader",I.style.color="var(--phosphor)"):p==="server-parallel"?(te.textContent="CPU Multi-thread",I.textContent="Java Parallel",I.style.color="var(--amber)"):(te.textContent="CPU Single-thread",I.textContent="Java Sequential",I.style.color="var(--muted)")}function _(l){if(n=l,M.textContent=String(n.generation),C.textContent=String(n.liveCells),j.textContent=`${n.rows} × ${n.cols}`,!n.cells||n.cells.length!==n.rows||n.cells[0]&&n.cells[0].length!==n.cols){const t=[];for(let o=0;o<n.rows;o++){const s=[];for(let i=0;i<n.cols;i++)s.push(!!(n.cells&&n.cells[o]&&n.cells[o][i]));t.push(s)}n.cells=t}n.wallMode!==void 0&&G&&(G.checked=n.wallMode);const e=`${n.rows}x${n.cols}`;[...N.options].some(t=>t.value===e)&&(N.value=e),r&&((r.rows!==n.rows||r.cols!==n.cols)&&r.resize(n.rows,n.cols,!1),n.wallMode!==void 0&&(r.wallMode=n.wallMode),n.cells&&n.cells.length>0&&r.loadGrid(n.cells),r.render(m.width,m.height))}function v(){r&&(r.render(m.width,m.height),ne++)}function me(){const l=performance.now(),e=l-fe;if(e>=1e3){const t=Math.round(ne*1e3/e),o=Math.round(Y*1e3/e);Le.textContent=String(t),Pe.textContent=String(o),ne=0,Y=0,fe=l}}function pe(l){const e=m.getBoundingClientRect(),t=Math.max(0,Math.min(.9999,(l.clientX-e.left)/e.width)),o=Math.max(0,Math.min(.9999,(l.clientY-e.top)/e.height)),s=Math.floor(t*n.cols);return{row:Math.floor(o*n.rows),col:s}}async function xe(l,e,t){p==="client-gpu"&&r?(r.setCell(l,e,t),n.cells&&n.cells[l]&&(n.cells[l][e]=t),r.render(m.width,m.height)):_(await f("/api/game/paint",{method:"POST",body:JSON.stringify({row:l,col:e,alive:t})}))}const Me={glider:[[0,1],[1,2],[2,0],[2,1],[2,2]],lwss:[[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],blinker:[[0,0],[0,1],[0,2]],toad:[[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],beacon:[[0,0],[0,1],[1,0],[1,1],[2,2],[2,3],[3,2],[3,3]],pulsar:[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]],pentadecathlon:[[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]],block:[[0,0],[0,1],[1,0],[1,1]],beehive:[[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],gosper:[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]]};function F(l,e){const t=se.get(l),o=t&&t.cells&&t.cells.length>0?t.cells.map(c=>[c.row,c.col]):Me[l.toLowerCase()]||[];if(o.length===0)return[];let s=o.map(([c,u])=>[c,u]);const i=Math.floor((e%360+360)%360/90);for(let c=0;c<i;c++)s=s.map(([u,h])=>[h,-u]);const d=Math.min(...s.map(c=>c[0])),a=Math.min(...s.map(c=>c[1]));return s.map(([c,u])=>[c-d,u-a])}async function ve(l,e){if(!x)return;const o=F(x,E);if(o.length!==0)if(p==="client-gpu"&&r){for(const[i,d]of o){const a=((l+i)%n.rows+n.rows)%n.rows,c=((e+d)%n.cols+n.cols)%n.cols;(!r.wallMode||a>=2&&a<n.rows-2&&c>=2&&c<n.cols-2)&&(r.setCell(a,c,!0),n.cells&&n.cells[a]&&(n.cells[a][c]=!0))}v();const s=r.extractGrid();n.liveCells=s.liveCells,C.textContent=String(n.liveCells)}else{for(const[i,d]of o){const a=((l+i)%n.rows+n.rows)%n.rows,c=((e+d)%n.cols+n.cols)%n.cols;n.cells&&n.cells[a]&&(n.cells[a][c]=!0)}const s=await f("/api/game/grid",{method:"POST",body:JSON.stringify({rows:n.rows,cols:n.cols,generation:n.generation,cells:n.cells})});_(s)}}function ie(){if(!r)return;const l=performance.now();r.step();const e=performance.now();ge.textContent=(e-l).toFixed(1),n.generation++,Y++}function Ge(){if(ie(),M.textContent=String(n.generation),v(),n.generation%60===0&&r){const l=r.extractGrid();C.textContent=String(l.liveCells)}}async function we(){const l=performance.now(),e=await f("/api/game/step",{method:"POST"}),t=performance.now();ge.textContent=(t-l).toFixed(1),Y++,_(e)}function Ee(){if(!S||p!=="client-gpu")return;const l=Number(A.value),e=he?Number(he.value):1;if(l===0){for(let t=0;t<e;t++)ie();M.textContent=String(n.generation),v()}else{const t=performance.now();if(t-le>=l){for(let o=0;o<e;o++)ie();M.textContent=String(n.generation),v(),le=t}else v()}if(n.generation%60===0&&r){const t=r.extractGrid();C.textContent=String(t.liveCells)}me(),D=requestAnimationFrame(Ee)}function q(){if(!S)if(S=!0,U.textContent="Pause",U.classList.add("running"),le=performance.now(),p==="client-gpu")D=requestAnimationFrame(Ee);else{const l=async()=>{if(S)try{await we(),me(),V=setTimeout(l,Number(A.value))}catch(e){L();const t=e instanceof Error?e.message:String(e);P.textContent=`Play stopped: ${t}. Press Play to resume.`}};l()}}function L(){if(S=!1,U.textContent="Play",U.classList.remove("running"),D!==null&&(cancelAnimationFrame(D),D=null),V!==null&&(clearTimeout(V),V=null),p==="client-gpu"&&r){const l=r.extractGrid();n.cells=l.cells,n.liveCells=l.liveCells,C.textContent=String(n.liveCells)}}function Ie(){const l=k.classList.toggle("fullscreen");oe.textContent=l?"✕ Exit Fullscreen":"⛶ Fullscreen",l&&document.fullscreenEnabled&&!document.fullscreenElement?k.requestFullscreen().catch(()=>{}):!l&&document.fullscreenElement&&document.exitFullscreen().catch(()=>{}),r&&r.render(m.width,m.height)}oe.addEventListener("click",Ie),document.addEventListener("fullscreenchange",()=>{!document.fullscreenElement&&k.classList.contains("fullscreen")&&(k.classList.remove("fullscreen"),oe.textContent="⛶ Fullscreen")});function re(){if(x){const l=E>0?` (Rotated ${E}°) `:" ";P.textContent=`Stamping “${x}”${l}· Move mouse for preview, click to stamp. Press "R" to rotate.`}else P.textContent="Click or drag to paint cells. Choose a pattern, then click the board to stamp it."}function ce(l){x=l,E=0,ae&&(ae.hidden=!l),de&&(de.hidden=!l),B&&(B.hidden=!l),re(),[...Q.querySelectorAll(".pattern")].forEach(e=>{e.classList.toggle("active",e.dataset.id===l)}),!l&&r&&(r.clearGhostPattern(),v())}U.addEventListener("click",()=>{S?L():q()}),Te.addEventListener("click",async()=>{L(),p==="client-gpu"?Ge():await we()}),Se.addEventListener("click",async()=>{L(),p==="client-gpu"&&r&&(r.clear(),n.generation=0,n.liveCells=0,M.textContent="0",C.textContent="0",v()),_(await f("/api/game/clear",{method:"POST"}))}),be.addEventListener("click",async()=>{L();const l=Number(K.value);if(p==="client-gpu"&&r){r.randomize(l),n.generation=0,M.textContent="0";const e=r.extractGrid();n.cells=e.cells,n.liveCells=e.liveCells,C.textContent=String(n.liveCells),v()}else _(await f("/api/game/random",{method:"POST",body:JSON.stringify({density:l})}))}),A.addEventListener("input",()=>{const l=Number(A.value);if(l===0)$.textContent="⚡ Uncapped (Hardware Native Hz)";else{const e=Math.round(1e3/l);$.textContent=`${l} ms (${e} tps)`}}),K.addEventListener("input",()=>{_e.textContent=`${Math.round(Number(K.value)*100)}%`}),B==null||B.addEventListener("click",()=>ce(null)),Z==null||Z.addEventListener("click",()=>{x&&(E=(E+90)%360,re(),b&&r&&(r.setGhostPattern(b.col,b.row,F(x,E)),v()))}),ee==null||ee.addEventListener("click",async()=>{if(!x)return;const l=F(x,E);if(l.length===0)return;const e=Math.max(...l.map(i=>i[0])),t=Math.max(...l.map(i=>i[1])),o=Math.max(0,Math.floor((n.rows-e)/2)),s=Math.max(0,Math.floor((n.cols-t)/2));await ve(o,s),P.textContent=`Stamped “${x}” at grid center!`}),window.addEventListener("keydown",l=>{(l.key==="r"||l.key==="R")&&x?(E=(E+90)%360,re(),b&&r&&(r.setGhostPattern(b.col,b.row,F(x,E)),v())):l.key==="Escape"&&x&&ce(null)}),G==null||G.addEventListener("change",async()=>{const l=G.checked;if(r){r.setWallMode(l),v();const e=r.extractGrid();n.cells=e.cells,n.liveCells=e.liveCells,C.textContent=String(n.liveCells)}try{const e=await f("/api/game/wall",{method:"POST",body:JSON.stringify({enabled:l})});p!=="client-gpu"&&_(e)}catch(e){console.warn("Wall mode backend sync:",e)}P.textContent=l?"🧱 2-Cell Wall Barrier active: Boundary acts as an absorbing collision wall (stops wrap-around).":"🔄 Toroidal Wrap active: Cells wrap around grid boundaries seamlessly."}),ue.addEventListener("change",()=>{const l=Number(ue.value);r&&(r.setColorMode(l),v())}),X.addEventListener("change",async()=>{const l=S;L();const e=X.value;if(p==="client-gpu"&&(e==="server-parallel"||e==="server-single")&&r){const o=r.extractGrid();n.cells=o.cells,n.liveCells=o.liveCells;try{await f("/api/game/grid",{method:"POST",body:JSON.stringify({rows:n.rows,cols:n.cols,generation:n.generation,cells:o.cells})})}catch(s){console.warn("Grid upload to server:",s)}}p=e,J(),p==="server-parallel"?await f("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"PARALLEL"})}):p==="server-single"&&await f("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"SEQUENTIAL"})});const t=await f("/api/game");_(t),l&&q()}),N.addEventListener("change",async()=>{const l=S;L();const[e,t]=N.value.split("x").map(Number);let o=[];p==="client-gpu"&&r?o=r.extractGrid().cells:n.cells&&n.cells.length>0&&(o=n.cells);const s=[],i=Math.min(o.length,e),d=o.length>0?Math.min(o[0].length,t):0;let a=0;const c=r?r.wallMode:!1;for(let u=0;u<e;u++){const h=[];for(let w=0;w<t;w++){let y=u<i&&w<d?o[u][w]:!1;c&&(u<2||u>=e-2||w<2||w>=t-2)&&(y=!1),h.push(y),y&&a++}s.push(h)}n.rows=e,n.cols=t,n.cells=s,n.liveCells=a,j.textContent=`${e} × ${t}`,C.textContent=String(a),e===t?(m.width=1024,m.height=1024):(m.width=1152,m.height=672),r&&(r.resize(e,t,!1),r.loadGrid(s),v());try{await f("/api/game/resize",{method:"POST",body:JSON.stringify({rows:e,cols:t,preserveCells:!0})}),await f("/api/game/grid",{method:"POST",body:JSON.stringify({rows:e,cols:t,generation:n.generation,cells:s})})}catch(u){console.warn("Backend resize sync:",u)}l&&q()}),document.querySelectorAll(".stress-btn").forEach(l=>{l.addEventListener("click",async()=>{var i;const e=l.dataset.preset;L(),p="client-gpu",X.value="client-gpu",J();let t="1024x1024";(e==="gun-matrix"||e==="pulsar-galaxy")&&(t="512x512"),N.value=t;const[o,s]=t.split("x").map(Number);if(n.rows=o,n.cols=s,n.generation=0,j.textContent=`${o} × ${s}`,m.width=1024,m.height=1024,r){r.resize(o,s,!1),r.loadStressPreset(e);const d=r.extractGrid();n.cells=d.cells,n.liveCells=d.liveCells,C.textContent=String(n.liveCells),v()}try{await f("/api/game/reset",{method:"POST",body:JSON.stringify({rows:o,cols:s,preserveCells:!1})})}catch{}P.textContent=`🚀 Stress preset "${(i=l.textContent)==null?void 0:i.trim()}" loaded! Running at full GPU speed.`,q()})}),O.addEventListener("click",async()=>{O.disabled=!0,O.textContent="Running...",z.hidden=!1,z.innerHTML="<em>Warming up JIT & running 200 generations across all CPU cores...</em>";try{const l=await f("/api/game/benchmark",{method:"POST",body:JSON.stringify({generations:200,rows:128,cols:128})});z.innerHTML=`
      <div>Grid: <strong>${l.rows} × ${l.cols}</strong> (${l.totalCells.toLocaleString()} cells) · CPU Cores: <strong>${l.availableProcessors}</strong></div>
      <div>Sequential: <strong>${l.sequentialDurationMs}ms</strong> (${l.sequentialGps} gen/s)</div>
      <div>Parallel: <strong>${l.parallelDurationMs}ms</strong> (${l.parallelGps} gen/s)</div>
      <div style="margin-top:4px; color:var(--phosphor);">Speedup Factor: <strong>${l.speedupFactor}×</strong> faster</div>
    `}catch(l){z.textContent="Benchmark failed: "+(l instanceof Error?l.message:String(l))}finally{O.disabled=!1,O.textContent="Run Test"}}),m.addEventListener("pointerdown",async l=>{const{row:e,col:t}=pe(l);if(x){await ve(e,t);return}W=!0,m.setPointerCapture(l.pointerId),H=!(n.cells&&n.cells[e]&&n.cells[e][t]),await xe(e,t,H)}),m.addEventListener("pointermove",async l=>{const{row:e,col:t}=pe(l);if(b={row:e,col:t},x){const o=F(x,E);r&&(r.setGhostPattern(t,e,o),v());return}W&&(n.cells&&n.cells[e]&&n.cells[e][t]===H||await xe(e,t,H))}),m.addEventListener("pointerleave",()=>{b=null,x&&r&&(r.clearGhostPattern(),v())}),m.addEventListener("pointerup",()=>{W=!1}),m.addEventListener("pointercancel",()=>{W=!1});async function Ue(){J();const l=await f("/api/game/patterns");Q.innerHTML="",se.clear(),l.forEach(o=>{se.set(o.id,o);const s=document.createElement("button");s.type="button",s.className="pattern",s.dataset.id=o.id,s.innerHTML=`${o.name}<small>${o.description}</small>`,s.addEventListener("click",()=>{ce(x===o.id?null:o.id)}),Q.appendChild(s)});const e=await f("/api/game");Re(e.rows,e.cols),_(e);const t=Number(A.value);t===0?$.textContent="⚡ Uncapped (Hardware Native Hz)":$.textContent=`${t} ms (${Math.round(1e3/t)} tps)`;try{const o=await f("/api/game/hardware");o.gpuAvailable?console.log(`⚡ Backend Container GPU: ${o.deviceName}`):console.log(`⚙️ Backend Container CPU: ${o.deviceName}`)}catch{}}Ue().catch(l=>{const e=l instanceof Error?l.message:String(l);P.textContent=`Could not reach the Game of Life API: ${e}`})})();
