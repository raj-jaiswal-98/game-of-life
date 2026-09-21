var Ot=Object.defineProperty;var Nt=(p,k,X)=>k in p?Ot(p,k,{enumerable:!0,configurable:!0,writable:!0,value:X}):p[k]=X;var h=(p,k,X)=>Nt(p,typeof k!="symbol"?k+"":k,X);(function(){"use strict";async function p(t,e={}){const n=await fetch(t,{headers:{"Content-Type":"application/json"},...e});if(!n.ok){const o=await n.text();throw new Error(o||n.statusText)}return n.json()}const k=`#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    v_uv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
`,X=`#version 300 es
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
`,at=`#version 300 es
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
uniform vec2 u_pan;
uniform float u_zoom;
out vec4 fragColor;

void main() {
    // Zoom & pan viewport transform
    vec2 centeredUV = v_uv - 0.5;
    vec2 zoomedUV = centeredUV / u_zoom + 0.5 + u_pan;

    if (zoomedUV.x < 0.0 || zoomedUV.x > 1.0 || zoomedUV.y < 0.0 || zoomedUV.y > 1.0) {
        // Void canvas outside active grid
        fragColor = vec4(11.0 / 255.0, 10.0 / 255.0, 8.0 / 255.0, 1.0);
        return;
    }

    vec2 gridUV = vec2(zoomedUV.x, 1.0 - zoomedUV.y);
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
`;class dt{constructor(e,n,o){h(this,"gl");h(this,"simProgram");h(this,"displayProgram");h(this,"textures");h(this,"fbos");h(this,"currentIdx",0);h(this,"rows");h(this,"cols");h(this,"colorMode",0);h(this,"wallMode",!1);h(this,"panX",0);h(this,"panY",0);h(this,"zoom",1);h(this,"ghostCount",0);h(this,"ghostOrigin",[0,0]);h(this,"ghostOffsets",new Float32Array(128));h(this,"vao");h(this,"simResLoc");h(this,"simGridLoc");h(this,"simWallLoc");h(this,"dispGridLoc");h(this,"dispResLoc");h(this,"dispScreenLoc");h(this,"dispShowGridLoc");h(this,"dispColorModeLoc");h(this,"dispWallLoc");h(this,"dispGhostCountLoc");h(this,"dispGhostOriginLoc");h(this,"dispGhostOffsetsLoc");h(this,"dispPanLoc");h(this,"dispZoomLoc");const s=e.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!s)throw new Error("WebGL 2.0 is not supported by your browser or graphics hardware.");this.gl=s,this.rows=n,this.cols=o,this.initShaders(),this.vao=s.createVertexArray(),this.textures=[this.createTexture(),this.createTexture()],this.fbos=[this.createFBO(this.textures[0]),this.createFBO(this.textures[1])],this.resize(n,o,!1)}resize(e,n,o=!1){let s=null;if(o&&this.cols>0&&this.rows>0)try{s=this.extractGrid().cells}catch{s=null}this.rows=e,this.cols=n;const i=this.gl,c=new Uint8Array(n*e*4);for(let r=0;r<2;r++)i.bindTexture(i.TEXTURE_2D,this.textures[r]),i.texImage2D(i.TEXTURE_2D,0,i.RGBA8,n,e,0,i.RGBA,i.UNSIGNED_BYTE,c);if(this.currentIdx=0,s&&s.length>0){const r=[],d=Math.min(s.length,e),f=Math.min(s[0].length,n);for(let u=0;u<e;u++){const m=[];for(let x=0;x<n;x++)this.wallMode&&(u<2||u>=e-2||x<2||x>=n-2)?m.push(!1):u<d&&x<f?m.push(s[u][x]):m.push(!1);r.push(m)}this.loadGrid(r)}}setColorMode(e){this.colorMode=e}setWallMode(e){if(this.wallMode=e,this.wallMode)for(let n=0;n<this.rows;n++)for(let o=0;o<this.cols;o++)(n<2||n>=this.rows-2||o<2||o>=this.cols-2)&&this.setCell(n,o,!1)}setGhostPattern(e,n,o){const s=Math.min(o.length,64);this.ghostCount=s,this.ghostOrigin=[e,n],this.ghostOffsets.fill(0);for(let i=0;i<s;i++){const[c,r]=o[i];this.ghostOffsets[i*2]=r,this.ghostOffsets[i*2+1]=c}}clearGhostPattern(){this.ghostCount=0}step(){const e=this.gl,n=1-this.currentIdx;e.useProgram(this.simProgram),e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[n]),e.viewport(0,0,this.cols,this.rows),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.textures[this.currentIdx]),e.uniform1i(this.simGridLoc,0),e.uniform2f(this.simResLoc,this.cols,this.rows),e.uniform1i(this.simWallLoc,this.wallMode?1:0),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),this.currentIdx=n}setPanZoom(e,n,o){this.panX=e,this.panY=n,this.zoom=Math.max(.5,Math.min(o,32))}render(e,n,o=!0){const s=this.gl;s.useProgram(this.displayProgram),s.bindFramebuffer(s.FRAMEBUFFER,null),s.viewport(0,0,e,n),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.uniform1i(this.dispGridLoc,0),s.uniform2f(this.dispResLoc,this.cols,this.rows),s.uniform2f(this.dispScreenLoc,e,n),s.uniform1f(this.dispShowGridLoc,o?1:0),s.uniform1i(this.dispColorModeLoc,this.colorMode),s.uniform1i(this.dispWallLoc,this.wallMode?1:0),s.uniform1i(this.dispGhostCountLoc,this.ghostCount),s.uniform2f(this.dispGhostOriginLoc,this.ghostOrigin[0],this.ghostOrigin[1]),s.uniform2fv(this.dispGhostOffsetsLoc,this.ghostOffsets),s.uniform2f(this.dispPanLoc,this.panX,this.panY),s.uniform1f(this.dispZoomLoc,this.zoom),s.bindVertexArray(this.vao),s.drawArrays(s.TRIANGLES,0,3)}setCell(e,n,o){if(e<0||e>=this.rows||n<0||n>=this.cols||this.wallMode&&o&&(e<2||e>=this.rows-2||n<2||n>=this.cols-2))return;const s=this.gl,i=o?255:0,c=new Uint8Array([i,0,0,i]);s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.texSubImage2D(s.TEXTURE_2D,0,n,e,1,1,s.RGBA,s.UNSIGNED_BYTE,c)}randomize(e){const n=this.cols*this.rows,o=new Uint8Array(n*4);for(let i=0;i<this.rows;i++)for(let c=0;c<this.cols;c++){const r=i*this.cols+c;let d=0;(!this.wallMode||i>=2&&i<this.rows-2&&c>=2&&c<this.cols-2)&&(d=Math.random()<e?255:0);const f=r*4;o[f]=d,o[f+1]=0,o[f+2]=0,o[f+3]=d}const s=this.gl;s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.texSubImage2D(s.TEXTURE_2D,0,0,0,this.cols,this.rows,s.RGBA,s.UNSIGNED_BYTE,o)}clear(){const e=this.cols*this.rows,n=new Uint8Array(e*4),o=this.gl;for(let s=0;s<2;s++)o.bindTexture(o.TEXTURE_2D,this.textures[s]),o.texSubImage2D(o.TEXTURE_2D,0,0,0,this.cols,this.rows,o.RGBA,o.UNSIGNED_BYTE,n)}loadGrid(e){const n=e.length,o=e[0].length;(n!==this.rows||o!==this.cols)&&this.resize(n,o,!1);const s=new Uint8Array(o*n*4);for(let c=0;c<n;c++){const r=e[c];for(let d=0;d<o;d++){let f=r&&r[d]?255:0;this.wallMode&&(c<2||c>=n-2||d<2||d>=o-2)&&(f=0);const u=(c*o+d)*4;s[u]=f,s[u+1]=0,s[u+2]=0,s[u+3]=f}}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,o,n,i.RGBA,i.UNSIGNED_BYTE,s)}extractGrid(){const e=this.gl,n=new Uint8Array(this.cols*this.rows*4);e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[this.currentIdx]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.UNSIGNED_BYTE,n);const o=[];let s=0;for(let i=0;i<this.rows;i++){const c=[];for(let r=0;r<this.cols;r++){const d=(i*this.cols+r)*4,f=n[d]>127;c.push(f),f&&s++}o.push(c)}return{cells:o,liveCells:s}}loadStressPreset(e){const n=this.cols*this.rows,o=new Uint8Array(n*4),s=(c,r)=>{const d=(c%this.rows+this.rows)%this.rows,f=(r%this.cols+this.cols)%this.cols;if(this.wallMode&&(d<2||d>=this.rows-2||f<2||f>=this.cols-2))return;const u=(d*this.cols+f)*4;o[u]=255,o[u+3]=255};if(e==="supernova-soup"){for(let c=0;c<this.rows;c++)for(let r=0;r<this.cols;r++)if(!(this.wallMode&&(c<2||c>=this.rows-2||r<2||r>=this.cols-2))&&Math.random()<.5){const d=(c*this.cols+r)*4;o[d]=255,o[d+3]=255}}else if(e==="glider-megacity")for(let r=0;r<this.rows-16;r+=16)for(let d=0;d<this.cols-16;d+=16)s(r,d+1),s(r+1,d+2),s(r+2,d),s(r+2,d+1),s(r+2,d+2);else if(e==="gun-matrix"){const d=[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]];for(let f=4;f<this.rows-38;f+=38)for(let u=4;u<this.cols-42;u+=42)for(const[m,x]of d)s(f+m,u+x)}else if(e==="pulsar-galaxy"){const r=[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]];for(let d=4;d<this.rows-20;d+=20)for(let f=4;f<this.cols-20;f+=20)for(const[u,m]of r)s(d+u,f+m)}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,this.cols,this.rows,i.RGBA,i.UNSIGNED_BYTE,o)}initShaders(){const e=this.gl,n=this.compileShader(e.VERTEX_SHADER,k),o=this.compileShader(e.FRAGMENT_SHADER,X),s=this.compileShader(e.FRAGMENT_SHADER,at);this.simProgram=this.createProgram(n,o),this.displayProgram=this.createProgram(n,s),this.simResLoc=e.getUniformLocation(this.simProgram,"u_resolution"),this.simGridLoc=e.getUniformLocation(this.simProgram,"u_grid"),this.simWallLoc=e.getUniformLocation(this.simProgram,"u_wallEnabled"),this.dispGridLoc=e.getUniformLocation(this.displayProgram,"u_grid"),this.dispResLoc=e.getUniformLocation(this.displayProgram,"u_resolution"),this.dispScreenLoc=e.getUniformLocation(this.displayProgram,"u_screenSize"),this.dispShowGridLoc=e.getUniformLocation(this.displayProgram,"u_showGrid"),this.dispColorModeLoc=e.getUniformLocation(this.displayProgram,"u_colorMode"),this.dispWallLoc=e.getUniformLocation(this.displayProgram,"u_wallEnabled"),this.dispGhostCountLoc=e.getUniformLocation(this.displayProgram,"u_ghostCount"),this.dispGhostOriginLoc=e.getUniformLocation(this.displayProgram,"u_ghostOrigin"),this.dispGhostOffsetsLoc=e.getUniformLocation(this.displayProgram,"u_ghostOffsets"),this.dispPanLoc=e.getUniformLocation(this.displayProgram,"u_pan"),this.dispZoomLoc=e.getUniformLocation(this.displayProgram,"u_zoom")}createTexture(){const e=this.gl,n=e.createTexture();return e.bindTexture(e.TEXTURE_2D,n),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),n}createFBO(e){const n=this.gl,o=n.createFramebuffer();return n.bindFramebuffer(n.FRAMEBUFFER,o),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,e,0),o}compileShader(e,n){const o=this.gl,s=o.createShader(e);if(o.shaderSource(s,n),o.compileShader(s),!o.getShaderParameter(s,o.COMPILE_STATUS)){const i=o.getShaderInfoLog(s);throw o.deleteShader(s),new Error("Shader compile error: "+i)}return s}createProgram(e,n){const o=this.gl,s=o.createProgram();if(o.attachShader(s,e),o.attachShader(s,n),o.linkProgram(s),!o.getProgramParameter(s,o.LINK_STATUS)){const i=o.getProgramInfoLog(s);throw o.deleteProgram(s),new Error("Program link error: "+i)}return s}}const g=document.getElementById("board"),ut=document.getElementById("viewport"),J=document.getElementById("cellInspector"),ft=document.getElementById("inspectorCoords"),Ve=document.getElementById("inspectorState"),Se=document.getElementById("quickEngine"),V=document.getElementById("quickGen"),T=document.getElementById("quickLive"),Le=document.getElementById("quickSize"),mt=document.getElementById("zoomLevel"),gt=document.getElementById("zoomInBtn"),ht=document.getElementById("zoomOutBtn"),pt=document.getElementById("resetZoomBtn"),vt=document.getElementById("shortcutsBtn"),K=document.getElementById("fullscreenBtn"),xt=document.getElementById("fps"),yt=document.getElementById("gps"),He=document.getElementById("frameTime"),Te=document.getElementById("engineBadge"),b=document.getElementById("hint"),j=document.getElementById("play"),Et=document.getElementById("step"),Ct=document.getElementById("undo"),Ye=document.getElementById("clear"),We=document.getElementById("random"),be=document.getElementById("toolDraw"),Pe=document.getElementById("toolErase"),Be=document.getElementById("toolPan"),Me=document.getElementById("toolStamp"),_e=document.getElementById("brush1"),Ie=document.getElementById("brush3"),ke=document.getElementById("brush5"),H=document.getElementById("generation"),P=document.getElementById("live"),Re=document.getElementById("size"),Y=document.getElementById("activeEngineText"),ce=document.getElementById("engineSelect"),R=document.getElementById("wallToggle"),B=document.getElementById("colorModeSelect"),Q=document.getElementById("gridSizeSelect"),qe=document.getElementById("substepsSelect"),ee=document.getElementById("speed"),ae=document.getElementById("speedValue"),Ge=document.getElementById("density"),wt=document.getElementById("densityValue"),W=document.getElementById("patternSearch"),Ze=document.getElementById("patternGrid"),Je=document.getElementById("patternTools"),St=document.getElementById("activePatternLabel"),Lt=document.getElementById("rotatePatternBtn"),Tt=document.getElementById("flipHBtn"),bt=document.getElementById("flipVBtn"),Pt=document.getElementById("centerPatternBtn"),Bt=document.getElementById("cancelPattern"),de=document.getElementById("sparklineCanvas"),q=document.getElementById("popTrendBadge"),Mt=document.getElementById("popMin"),_t=document.getElementById("popAvg"),It=document.getElementById("popMax"),te=document.getElementById("runBenchmark"),ue=document.getElementById("benchmarkResult"),M=document.getElementById("shortcutsModal"),kt=document.getElementById("closeShortcutsModal");let y="client-gpu",l={rows:42,cols:72,generation:0,liveCells:0,cells:[]},G=!1,fe=!1,me=!0,U="draw",Ke=1,E=1,w=0,S=0,ne=!1,Ue={x:0,y:0},Ae={x:0,y:0},ge=!1;const oe=[];let v=null,_=0,A=!1,D=!1,De="all",Z=null;const F=new Map,L=[];let a=null,se=null,he=null,Oe=0,pe=0,je=performance.now(),Ne=performance.now();const Qe={glider:[[0,1],[1,2],[2,0],[2,1],[2,2]],lwss:[[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],blinker:[[0,0],[0,1],[0,2]],toad:[[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],beacon:[[0,0],[0,1],[1,0],[1,1],[2,2],[2,3],[3,2],[3,3]],pulsar:[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]],pentadecathlon:[[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]],block:[[0,0],[0,1],[1,0],[1,1]],beehive:[[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],gosper:[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]]},Rt={glider:"spaceships",lwss:"spaceships",gosper:"guns",blinker:"oscillators",toad:"oscillators",beacon:"oscillators",pulsar:"oscillators",pentadecathlon:"oscillators",block:"still",beehive:"still"};function Gt(t,e){try{a?a.resize(t,e,!1):a=new dt(g,t,e),a.setPanZoom(w,S,E)}catch(n){console.warn("WebGL2 not available, falling back to server simulation:",n),y="server-parallel",ce.value="server-parallel",ve()}}function ve(){y==="client-gpu"?(Te.textContent="GPU WebGL2",Se.textContent="GPU WebGL2",Y.textContent="GPU Shader",Y.style.color="var(--phosphor)"):y==="server-parallel"?(Te.textContent="CPU Multi-thread",Se.textContent="Java Parallel",Y.textContent="Java Parallel",Y.style.color="var(--amber)"):(Te.textContent="CPU Single-thread",Se.textContent="Java Sequential",Y.textContent="Java Sequential",Y.style.color="var(--muted)")}function N(t){if(l=t,H.textContent=String(l.generation),P.textContent=String(l.liveCells),Re.textContent=`${l.rows} × ${l.cols}`,V.textContent=String(l.generation),T.textContent=String(l.liveCells),Le.textContent=`${l.rows} × ${l.cols}`,!l.cells||l.cells.length!==l.rows||l.cells[0]&&l.cells[0].length!==l.cols){const n=[];for(let o=0;o<l.rows;o++){const s=[];for(let i=0;i<l.cols;i++)s.push(!!(l.cells&&l.cells[o]&&l.cells[o][i]));n.push(s)}l.cells=n}l.wallMode!==void 0&&R&&(R.checked=l.wallMode);const e=`${l.rows}x${l.cols}`;[...Q.options].some(n=>n.value===e)&&(Q.value=e),a&&((a.rows!==l.rows||a.cols!==l.cols)&&a.resize(l.rows,l.cols,!1),l.wallMode!==void 0&&(a.wallMode=l.wallMode),l.cells&&l.cells.length>0&&a.loadGrid(l.cells),a.setPanZoom(w,S,E),a.render(g.width,g.height)),we(l.liveCells)}function C(){a&&(a.setPanZoom(w,S,E),a.render(g.width,g.height),Oe++)}function xe(){if(!l.cells||l.cells.length===0)return;const t=l.cells.map(e=>[...e]);oe.push(t),oe.length>25&&oe.shift()}async function et(){if(oe.length===0){b.textContent="Nothing to undo.";return}const t=oe.pop();l.cells=t;let e=0;for(const n of t)for(const o of n)o&&e++;if(l.liveCells=e,P.textContent=String(e),T.textContent=String(e),y==="client-gpu"&&a)a.loadGrid(t),C();else try{await p("/api/game/grid",{method:"POST",body:JSON.stringify({rows:l.rows,cols:l.cols,generation:l.generation,cells:t})})}catch(n){console.warn("Undo sync to server:",n)}b.textContent="Undid last canvas action."}function ye(){mt.textContent=`${Math.round(E*100)}%`}function tt(){E=1,w=0,S=0,ye(),a&&(a.setPanZoom(w,S,E),C()),b.textContent="Zoom reset to 100% fit."}function Ee(t){E=Math.max(1,Math.min(E*t,32)),ye(),a&&(a.setPanZoom(w,S,E),C())}gt.addEventListener("click",()=>Ee(1.25)),ht.addEventListener("click",()=>Ee(1/1.25)),pt.addEventListener("click",tt),g.addEventListener("wheel",t=>{t.preventDefault();const e=g.getBoundingClientRect(),n=Math.max(0,Math.min(1,(t.clientX-e.left)/e.width)),o=Math.max(0,Math.min(1,(t.clientY-e.top)/e.height)),s=(n-.5)/E+.5+w,i=(o-.5)/E+.5+S,c=t.deltaY<0?1.18:1/1.18,r=Math.max(1,Math.min(E*c,32));w=s-.5-(n-.5)/r,S=i-.5-(o-.5)/r,E=r;const d=.5;w=Math.max(-d,Math.min(d,w)),S=Math.max(-d,Math.min(d,S)),ye(),a&&(a.setPanZoom(w,S,E),C())},{passive:!1});function nt(t){const e=g.getBoundingClientRect(),n=(t.clientX-e.left)/e.width,o=(t.clientY-e.top)/e.height,s=(n-.5)/E+.5+w,i=(o-.5)/E+.5+S;if(s<0||s>=1||i<0||i>=1)return{row:-1,col:-1,inBounds:!1};const c=Math.floor(s*l.cols);return{row:Math.floor(i*l.rows),col:c,inBounds:!0}}function O(t){U=t,[be,Pe,Be,Me].forEach(e=>e.classList.remove("active")),t==="draw"&&be.classList.add("active"),t==="erase"&&Pe.classList.add("active"),t==="pan"&&Be.classList.add("active"),t==="stamp"&&Me.classList.add("active"),t==="pan"?g.style.cursor="grab":t==="stamp"?g.style.cursor="copy":g.style.cursor="crosshair",t!=="stamp"&&v&&le(null)}be.addEventListener("click",()=>O("draw")),Pe.addEventListener("click",()=>O("erase")),Be.addEventListener("click",()=>O("pan")),Me.addEventListener("click",()=>{if(O("stamp"),lt("patterns"),!v&&F.size>0){const t=F.keys().next().value;t&&le(t)}});function Fe(t){Ke=t,[_e,Ie,ke].forEach(e=>e.classList.remove("active")),t===1&&_e.classList.add("active"),t===3&&Ie.classList.add("active"),t===5&&ke.classList.add("active")}_e.addEventListener("click",()=>Fe(1)),Ie.addEventListener("click",()=>Fe(3)),ke.addEventListener("click",()=>Fe(5));async function ot(t,e,n){const o=Math.floor(Ke/2),s=[];for(let i=-o;i<=o;i++)for(let c=-o;c<=o;c++){const r=t+i,d=e+c;r>=0&&r<l.rows&&d>=0&&d<l.cols&&s.push([r,d])}if(y==="client-gpu"&&a){for(const[c,r]of s)(!a.wallMode||c>=2&&c<l.rows-2&&r>=2&&r<l.cols-2)&&(a.setCell(c,r,n),l.cells&&l.cells[c]&&(l.cells[c][r]=n));a.render(g.width,g.height);const i=a.extractGrid();l.liveCells=i.liveCells,P.textContent=String(l.liveCells),T.textContent=String(l.liveCells)}else{for(const[c,r]of s)l.cells&&l.cells[c]&&(l.cells[c][r]=n),await p("/api/game/paint",{method:"POST",body:JSON.stringify({row:c,col:r,alive:n})});const i=await p("/api/game");N(i)}}function ze(t,e,n,o){const s=F.get(t),i=s&&s.cells&&s.cells.length>0?s.cells.map(u=>[u.row,u.col]):Qe[t.toLowerCase()]||[];if(i.length===0)return[];let c=i.map(([u,m])=>[u,m]);const r=Math.floor((e%360+360)%360/90);for(let u=0;u<r;u++)c=c.map(([m,x])=>[x,-m]);n&&(c=c.map(([u,m])=>[u,-m])),o&&(c=c.map(([u,m])=>[-u,m]));const d=Math.min(...c.map(u=>u[0])),f=Math.min(...c.map(u=>u[1]));return c.map(([u,m])=>[u-d,m-f])}async function st(t,e){if(!v)return;xe();const o=ze(v,_,A,D);if(o.length!==0)if(y==="client-gpu"&&a){for(const[i,c]of o){const r=((t+i)%l.rows+l.rows)%l.rows,d=((e+c)%l.cols+l.cols)%l.cols;(!a.wallMode||r>=2&&r<l.rows-2&&d>=2&&d<l.cols-2)&&(a.setCell(r,d,!0),l.cells&&l.cells[r]&&(l.cells[r][d]=!0))}C();const s=a.extractGrid();l.liveCells=s.liveCells,P.textContent=String(l.liveCells),T.textContent=String(l.liveCells)}else{for(const[i,c]of o){const r=((t+i)%l.rows+l.rows)%l.rows,d=((e+c)%l.cols+l.cols)%l.cols;l.cells&&l.cells[r]&&(l.cells[r][d]=!0)}const s=await p("/api/game/grid",{method:"POST",body:JSON.stringify({rows:l.rows,cols:l.cols,generation:l.generation,cells:l.cells})});N(s)}}function Ut(t){const e=document.createElement("canvas");e.width=60,e.height=48;const n=e.getContext("2d");if(!n||t.length===0)return e;const o=Math.max(...t.map(d=>d[0]))+1,s=Math.max(...t.map(d=>d[1]))+1,i=Math.min(Math.floor(40/Math.max(o,s)),7),c=Math.floor((60-s*i)/2),r=Math.floor((48-o*i)/2);n.fillStyle="#d9e36a";for(const[d,f]of t)n.fillRect(c+f*i,r+d*i,i-1,i-1);return e}function Ce(){Ze.innerHTML="";const t=((W==null?void 0:W.value)||"").toLowerCase().trim();F.forEach(e=>{const n=Rt[e.id.toLowerCase()]||"other";if(De!=="all"&&n!==De||t&&!e.name.toLowerCase().includes(t)&&!e.description.toLowerCase().includes(t))return;const o=document.createElement("div");o.className=`pattern-card ${v===e.id?"active":""}`,o.dataset.id=e.id;const s=e.cells&&e.cells.length>0?e.cells.map(d=>[d.row,d.col]):Qe[e.id.toLowerCase()]||[],i=document.createElement("div");i.className="pattern-card-preview",i.appendChild(Ut(s));const c=document.createElement("div");c.className="pattern-card-title",c.textContent=e.name;const r=document.createElement("div");r.className="pattern-card-cat",r.textContent=n,o.appendChild(i),o.appendChild(c),o.appendChild(r),o.addEventListener("click",()=>{le(v===e.id?null:e.id)}),Ze.appendChild(o)})}function le(t){if(v=t,_=0,A=!1,D=!1,t){O("stamp"),Je.hidden=!1;const e=F.get(t);St.textContent=e?e.name:t}else Je.hidden=!0,a&&(a.clearGhostPattern(),C());z(),Ce()}function z(){if(v){const t=_>0?` [${_}°]`:"",e=A?" [FlipH]":"",n=D?" [FlipV]":"";b.textContent=`Stamping “${v}”${t}${e}${n} · Move over board to preview, click to place. (R: Rotate, H/V: Flip, Esc: Cancel)`}else b.textContent="Click or drag to paint cells. Hold Space or use Pan tool to navigate canvas."}Lt.addEventListener("click",()=>{v&&(_=(_+90)%360,z(),$())}),Tt.addEventListener("click",()=>{v&&(A=!A,z(),$())}),bt.addEventListener("click",()=>{v&&(D=!D,z(),$())}),Pt.addEventListener("click",async()=>{if(!v)return;const t=ze(v,_,A,D);if(t.length===0)return;const e=Math.max(...t.map(i=>i[0])),n=Math.max(...t.map(i=>i[1])),o=Math.max(0,Math.floor((l.rows-e)/2)),s=Math.max(0,Math.floor((l.cols-n)/2));await st(o,s),b.textContent=`Stamped “${v}” at grid center!`}),Bt.addEventListener("click",()=>le(null));function $(){if(!v||!a||!Z)return;const t=ze(v,_,A,D);a.setGhostPattern(Z.col,Z.row,t),C()}document.querySelectorAll(".cat-pill").forEach(t=>{t.addEventListener("click",()=>{document.querySelectorAll(".cat-pill").forEach(e=>e.classList.remove("active")),t.classList.add("active"),De=t.dataset.cat||"all",Ce()})}),W==null||W.addEventListener("input",()=>Ce());function lt(t){document.querySelectorAll(".tab-btn").forEach(o=>o.classList.remove("active")),document.querySelectorAll(".tab-pane").forEach(o=>o.classList.remove("active"));const e=document.querySelector(`.tab-btn[data-tab="${t}"]`),n=document.getElementById(`tab-${t}`);e&&e.classList.add("active"),n&&n.classList.add("active")}document.querySelectorAll(".tab-btn").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.tab;e&&lt(e)})});function we(t){L.push(t),L.length>100&&L.shift(),At()}function At(){if(!de)return;const t=de.getContext("2d");if(!t)return;const e=de.width,n=de.height;if(t.clearRect(0,0,e,n),L.length<2)return;const o=Math.min(...L),s=Math.max(...L),i=Math.round(L.reduce((m,x)=>m+x,0)/L.length);Mt.textContent=String(o),_t.textContent=String(i),It.textContent=String(s);const c=L.slice(-10),r=c[c.length-1]-c[0];r>5?(q.textContent="Growing",q.style.color="var(--phosphor)"):r<-5?(q.textContent="Declining",q.style.color="var(--danger)"):(q.textContent="Stable",q.style.color="var(--cyan)");const d=s===o?1:s-o,f=e/(L.length-1),u=t.createLinearGradient(0,0,0,n);u.addColorStop(0,"rgba(34, 211, 238, 0.35)"),u.addColorStop(1,"rgba(34, 211, 238, 0.0)"),t.beginPath();for(let m=0;m<L.length;m++){const x=m*f,re=n-(L[m]-o)/d*(n-16)-8;m===0?t.moveTo(x,re):t.lineTo(x,re)}t.lineTo(e,n),t.lineTo(0,n),t.closePath(),t.fillStyle=u,t.fill(),t.beginPath();for(let m=0;m<L.length;m++){const x=m*f,re=n-(L[m]-o)/d*(n-16)-8;m===0?t.moveTo(x,re):t.lineTo(x,re)}t.strokeStyle="#22d3ee",t.lineWidth=2,t.stroke()}function $e(){if(!a)return;const t=performance.now();a.step();const e=performance.now();He.textContent=(e-t).toFixed(1),l.generation++,pe++}function it(){if($e(),H.textContent=String(l.generation),V.textContent=String(l.generation),C(),l.generation%30===0&&a){const t=a.extractGrid();l.liveCells=t.liveCells,P.textContent=String(t.liveCells),T.textContent=String(t.liveCells),we(t.liveCells)}}async function Xe(){const t=performance.now(),e=await p("/api/game/step",{method:"POST"}),n=performance.now();He.textContent=(n-t).toFixed(1),pe++,N(e)}function rt(){if(!G||y!=="client-gpu")return;const t=Number(ee.value),e=qe?Number(qe.value):1;if(t===0){for(let n=0;n<e;n++)$e();H.textContent=String(l.generation),V.textContent=String(l.generation),C()}else{const n=performance.now();if(n-Ne>=t){for(let o=0;o<e;o++)$e();H.textContent=String(l.generation),V.textContent=String(l.generation),C(),Ne=n}else C()}if(l.generation%30===0&&a){const n=a.extractGrid();l.liveCells=n.liveCells,P.textContent=String(n.liveCells),T.textContent=String(n.liveCells),we(n.liveCells)}ct(),se=requestAnimationFrame(rt)}function ie(){if(!G)if(G=!0,j.textContent="⏸ Pause",j.classList.add("running"),Ne=performance.now(),y==="client-gpu")se=requestAnimationFrame(rt);else{const t=async()=>{if(G)try{await Xe(),ct(),he=setTimeout(t,Number(ee.value))}catch(e){I();const n=e instanceof Error?e.message:String(e);b.textContent=`Play stopped: ${n}. Press Play to resume.`}};t()}}function I(){if(G=!1,j.textContent="▶ Play",j.classList.remove("running"),se!==null&&(cancelAnimationFrame(se),se=null),he!==null&&(clearTimeout(he),he=null),y==="client-gpu"&&a){const t=a.extractGrid();l.cells=t.cells,l.liveCells=t.liveCells,P.textContent=String(l.liveCells),T.textContent=String(l.liveCells),we(t.liveCells)}}function ct(){const t=performance.now(),e=t-je;if(e>=1e3){const n=Math.round(Oe*1e3/e),o=Math.round(pe*1e3/e);xt.textContent=String(n),yt.textContent=String(o),Oe=0,pe=0,je=t}}g.addEventListener("pointerdown",async t=>{if(t.button===1||ge||U==="pan"){ne=!0,Ue={x:t.clientX,y:t.clientY},Ae={x:w,y:S},g.setPointerCapture(t.pointerId),g.style.cursor="grabbing";return}const{row:e,col:n,inBounds:o}=nt(t);if(o){if(U==="stamp"&&v){await st(e,n);return}xe(),fe=!0,g.setPointerCapture(t.pointerId),U==="erase"?me=!1:me=!(l.cells&&l.cells[e]&&l.cells[e][n]),await ot(e,n,me)}}),g.addEventListener("pointermove",async t=>{if(ne){const s=g.getBoundingClientRect(),i=(t.clientX-Ue.x)/s.width/E,c=(t.clientY-Ue.y)/s.height/E;w=Ae.x-i,S=Ae.y-c;const r=.5;w=Math.max(-r,Math.min(r,w)),S=Math.max(-r,Math.min(r,S)),a&&(a.setPanZoom(w,S,E),C());return}const{row:e,col:n,inBounds:o}=nt(t);if(o){Z={row:e,col:n},J.hidden=!1,J.style.left=`${t.clientX}px`,J.style.top=`${t.clientY}px`;const s=l.cells&&l.cells[e]&&l.cells[e][n];ft.textContent=`X: ${n}, Y: ${e}`,Ve.textContent=s?"● Alive":"○ Dead",Ve.style.color=s?"var(--phosphor)":"var(--muted)"}else J.hidden=!0,Z=null;if(U==="stamp"&&v&&o){$();return}!fe||!o||await ot(e,n,me)}),g.addEventListener("pointerup",t=>{ne&&(ne=!1,g.releasePointerCapture(t.pointerId),g.style.cursor=U==="pan"?"grab":"crosshair"),fe=!1}),g.addEventListener("pointercancel",()=>{ne=!1,fe=!1}),g.addEventListener("pointerleave",()=>{J.hidden=!0,Z=null,v&&a&&(a.clearGhostPattern(),C())}),j.addEventListener("click",()=>{G?I():ie()}),Et.addEventListener("click",async()=>{I(),y==="client-gpu"?it():await Xe()}),Ct.addEventListener("click",et),Ye.addEventListener("click",async()=>{xe(),I(),y==="client-gpu"&&a&&(a.clear(),l.generation=0,l.liveCells=0,H.textContent="0",P.textContent="0",V.textContent="0",T.textContent="0",C()),N(await p("/api/game/clear",{method:"POST"})),b.textContent="Grid cleared."}),We.addEventListener("click",async()=>{xe(),I();const t=Number(Ge.value);if(y==="client-gpu"&&a){a.randomize(t),l.generation=0,H.textContent="0",V.textContent="0";const e=a.extractGrid();l.cells=e.cells,l.liveCells=e.liveCells,P.textContent=String(l.liveCells),T.textContent=String(l.liveCells),C()}else N(await p("/api/game/random",{method:"POST",body:JSON.stringify({density:t})}));b.textContent=`Spawned random soup at ${Math.round(t*100)}% density.`}),ee.addEventListener("input",()=>{const t=Number(ee.value);if(t===0)ae.textContent="⚡ Uncapped (Hardware Native Hz)";else{const e=Math.round(1e3/t);ae.textContent=`${t} ms (${e} tps)`}}),Ge.addEventListener("input",()=>{wt.textContent=`${Math.round(Number(Ge.value)*100)}%`}),R==null||R.addEventListener("change",async()=>{const t=R.checked;if(a){a.setWallMode(t),C();const e=a.extractGrid();l.cells=e.cells,l.liveCells=e.liveCells,P.textContent=String(l.liveCells),T.textContent=String(l.liveCells)}try{const e=await p("/api/game/wall",{method:"POST",body:JSON.stringify({enabled:t})});y!=="client-gpu"&&N(e)}catch(e){console.warn("Wall mode backend sync:",e)}b.textContent=t?"🧱 2-Cell Wall Barrier active: Boundary acts as an absorbing collision wall.":"🔄 Toroidal Wrap active: Cells wrap around boundaries seamlessly."}),B.addEventListener("change",()=>{const t=Number(B.value);a&&(a.setColorMode(t),C())}),ce.addEventListener("change",async()=>{const t=G;I();const e=ce.value;if(y==="client-gpu"&&(e==="server-parallel"||e==="server-single")&&a){const o=a.extractGrid();l.cells=o.cells,l.liveCells=o.liveCells;try{await p("/api/game/grid",{method:"POST",body:JSON.stringify({rows:l.rows,cols:l.cols,generation:l.generation,cells:o.cells})})}catch(s){console.warn("Grid upload to server:",s)}}y=e,ve(),y==="server-parallel"?await p("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"PARALLEL"})}):y==="server-single"&&await p("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"SEQUENTIAL"})});const n=await p("/api/game");N(n),t&&ie()}),Q.addEventListener("change",async()=>{const t=G;I();const[e,n]=Q.value.split("x").map(Number);let o=[];y==="client-gpu"&&a?o=a.extractGrid().cells:l.cells&&l.cells.length>0&&(o=l.cells);const s=[],i=Math.min(o.length,e),c=o.length>0?Math.min(o[0].length,n):0;let r=0;const d=a?a.wallMode:!1;for(let f=0;f<e;f++){const u=[];for(let m=0;m<n;m++){let x=f<i&&m<c?o[f][m]:!1;d&&(f<2||f>=e-2||m<2||m>=n-2)&&(x=!1),u.push(x),x&&r++}s.push(u)}l.rows=e,l.cols=n,l.cells=s,l.liveCells=r,Re.textContent=`${e} × ${n}`,Le.textContent=`${e} × ${n}`,P.textContent=String(r),T.textContent=String(r),e===n?(g.width=1024,g.height=1024):(g.width=1152,g.height=672),a&&(a.resize(e,n,!1),a.loadGrid(s),a.setPanZoom(w,S,E),C());try{await p("/api/game/resize",{method:"POST",body:JSON.stringify({rows:e,cols:n,preserveCells:!0})}),await p("/api/game/grid",{method:"POST",body:JSON.stringify({rows:e,cols:n,generation:l.generation,cells:s})})}catch(f){console.warn("Backend resize sync:",f)}t&&ie()}),document.querySelectorAll(".stress-btn").forEach(t=>{t.addEventListener("click",async()=>{var i,c;const e=t.dataset.preset;I(),y="client-gpu",ce.value="client-gpu",ve();let n="1024x1024";(e==="gun-matrix"||e==="pulsar-galaxy")&&(n="512x512"),Q.value=n;const[o,s]=n.split("x").map(Number);if(l.rows=o,l.cols=s,l.generation=0,Re.textContent=`${o} × ${s}`,Le.textContent=`${o} × ${s}`,g.width=1024,g.height=1024,a){a.resize(o,s,!1),a.loadStressPreset(e);const r=a.extractGrid();l.cells=r.cells,l.liveCells=r.liveCells,P.textContent=String(l.liveCells),T.textContent=String(l.liveCells),C()}try{await p("/api/game/reset",{method:"POST",body:JSON.stringify({rows:o,cols:s,preserveCells:!1})})}catch{}b.textContent=`🚀 Stress preset "${(c=(i=t.querySelector("strong"))==null?void 0:i.textContent)==null?void 0:c.trim()}" running at full GPU speed!`,ie()})}),te.addEventListener("click",async()=>{te.disabled=!0,te.textContent="Running...",ue.hidden=!1,ue.innerHTML="<em>Warming up JIT & benchmarking all CPU cores...</em>";try{const t=await p("/api/game/benchmark",{method:"POST",body:JSON.stringify({generations:200,rows:128,cols:128})});ue.innerHTML=`
      <div>Grid: <strong>${t.rows} × ${t.cols}</strong> (${t.totalCells.toLocaleString()} cells) · Cores: <strong>${t.availableProcessors}</strong></div>
      <div>Sequential: <strong>${t.sequentialDurationMs}ms</strong> (${t.sequentialGps} gen/s)</div>
      <div>Parallel: <strong>${t.parallelDurationMs}ms</strong> (${t.parallelGps} gen/s)</div>
      <div style="margin-top:4px; color:var(--phosphor);">Speedup Factor: <strong>${t.speedupFactor}×</strong> faster</div>
    `}catch(t){ue.textContent="Benchmark failed: "+(t instanceof Error?t.message:String(t))}finally{te.disabled=!1,te.textContent="Run Test"}}),K.addEventListener("click",()=>{document.fullscreenElement?(document.exitFullscreen().catch(()=>{}),K.textContent="⛶ Fullscreen"):(ut.requestFullscreen().catch(()=>{}),K.textContent="✕ Exit")}),document.addEventListener("fullscreenchange",()=>{document.fullscreenElement||(K.textContent="⛶ Fullscreen")}),vt.addEventListener("click",()=>M.showModal()),kt.addEventListener("click",()=>M.close()),M.addEventListener("click",t=>{t.target===M&&M.close()}),window.addEventListener("keydown",t=>{if(document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement){t.key==="Escape"&&document.activeElement.blur();return}t.code==="Space"?(t.preventDefault(),G?I():ie()):t.key==="ArrowRight"||t.key==="s"||t.key==="S"?(t.preventDefault(),I(),y==="client-gpu"?it():Xe()):(t.ctrlKey||t.metaKey)&&(t.key==="z"||t.key==="Z")?(t.preventDefault(),et()):t.key==="c"||t.key==="C"?Ye.click():t.key==="w"||t.key==="W"?(R.checked=!R.checked,R.dispatchEvent(new Event("change"))):t.key==="r"||t.key==="R"?v?(_=(_+90)%360,z(),$()):We.click():t.key==="h"||t.key==="H"?v&&(A=!A,z(),$()):t.key==="v"||t.key==="V"?v&&(D=!D,z(),$()):t.key==="d"||t.key==="D"?O("draw"):t.key==="e"||t.key==="E"?O("erase"):t.key==="p"||t.key==="P"?O("pan"):t.key==="t"||t.key==="T"?O("stamp"):t.key==="1"?(B.value="0",B.dispatchEvent(new Event("change"))):t.key==="2"?(B.value="1",B.dispatchEvent(new Event("change"))):t.key==="3"?(B.value="2",B.dispatchEvent(new Event("change"))):t.key==="4"?(B.value="3",B.dispatchEvent(new Event("change"))):t.key==="+"||t.key==="="?Ee(1.25):t.key==="-"||t.key==="_"?Ee(1/1.25):t.key==="0"?tt():t.key==="f"||t.key==="F"?K.click():t.key==="?"?M.open?M.close():M.showModal():t.key==="Escape"&&(M.open?M.close():v&&le(null))}),window.addEventListener("keydown",t=>{t.code==="Space"&&!ge&&!(document.activeElement instanceof HTMLInputElement)&&(ge=!0,U!=="pan"&&(g.style.cursor="grab"))}),window.addEventListener("keyup",t=>{t.code==="Space"&&(ge=!1,U!=="pan"&&(g.style.cursor=U==="stamp"?"copy":"crosshair"))});async function Dt(){ve(),ye();const t=await p("/api/game/patterns");F.clear(),t.forEach(o=>{F.set(o.id,o)}),Ce();const e=await p("/api/game");Gt(e.rows,e.cols),N(e);const n=Number(ee.value);n===0?ae.textContent="⚡ Uncapped (Hardware Native Hz)":ae.textContent=`${n} ms (${Math.round(1e3/n)} tps)`;try{const o=await p("/api/game/hardware");o.gpuAvailable?console.log(`⚡ Backend Container GPU: ${o.deviceName}`):console.log(`⚙️ Backend Container CPU: ${o.deviceName}`)}catch{}}Dt().catch(t=>{const e=t instanceof Error?t.message:String(t);b.textContent=`Could not reach the Game of Life API: ${e}`})})();
