var mo=Object.defineProperty;var go=(C,W,ne)=>W in C?mo(C,W,{enumerable:!0,configurable:!0,writable:!0,value:ne}):C[W]=ne;var v=(C,W,ne)=>go(C,typeof W!="symbol"?W+"":W,ne);(function(){"use strict";async function C(t,e={}){const o=await fetch(t,{headers:{"Content-Type":"application/json"},...e});if(!o.ok){const n=await o.text();throw new Error(n||o.statusText)}return o.json()}const W=`#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    v_uv = vec2(x * 0.5 + 0.5, y * 0.5 + 0.5);
    gl_Position = vec4(x, y, 0.0, 1.0);
}
`,ne=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_grid;
uniform vec2 u_resolution; // (cols, rows)
uniform int u_wallEnabled; // 0: Torus, 1: Absorbing 2-cell wall, 2: Elastic bouncing 2-cell wall
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    ivec2 coord = ivec2(gl_FragCoord.xy);

    if (u_wallEnabled >= 1) {
        if (coord.x < 2 || coord.x >= int(u_resolution.x) - 2 ||
            coord.y < 2 || coord.y >= int(u_resolution.y) - 2) {
            fragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }
    }

    int count = 0;
    if (u_wallEnabled >= 1) {
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
`,$t=`#version 300 es
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
uniform vec2 u_hoverCell;    // (col, row), or (-1.0, -1.0) when inactive
uniform float u_hoverRadius; // brush radius (1.0, 3.0, 5.0)
uniform int u_hoverMode;     // 0: none, 1: draw/inspect, 2: erase, 3: stamp
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
    if (alive <= 0.5 && trail > 0.01 && !(u_wallEnabled >= 1 && isWallCell)) {
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

    if (alive > 0.5 && !(u_wallEnabled >= 1 && isWallCell)) {
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
            vec3 cLive = vec3(1.00, 0.18, 0.55); // Hot Pink
            vec3 cEdge = vec3(0.10, 0.95, 0.90); // Neon Turquoise
            float edgeDist = abs(density - 0.375);
            color = mix(cLive, cEdge, clamp(edgeDist * 2.5, 0.0, 1.0));

        } else if (u_colorMode == 3) {
            // 3: Thermal Glow
            vec3 cDeep = vec3(0.85, 0.12, 0.08); // Crimson
            vec3 cMid  = vec3(1.00, 0.55, 0.05); // Solar Orange
            vec3 cPeak = vec3(1.00, 0.98, 0.90); // Plasma White
            if (density < 0.375) {
                color = mix(cDeep, cMid, density / 0.375);
            } else {
                color = mix(cMid, cPeak, (density - 0.375) / 0.625);
            }
        }
    }

    // Render 2-cell buffer wall styling
    if (u_wallEnabled >= 1 && isWallCell) {
        vec2 px = floor(v_uv * u_screenSize);
        float stripe = step(0.5, fract((px.x + px.y) / 14.0));
        bool isInnerEdge = (cellCoord.x == 1.0 || cellCoord.x == u_resolution.x - 2.0 ||
                            cellCoord.y == 1.0 || cellCoord.y == u_resolution.y - 2.0);

        if (u_wallEnabled == 2) {
            // Mode 2: Elastic Trampoline Wall (Electric cyan & cyber blue)
            vec3 wallColor1 = vec3(10.0 / 255.0, 24.0 / 255.0, 38.0 / 255.0);
            vec3 wallColor2 = vec3(20.0 / 255.0, 60.0 / 255.0, 95.0 / 255.0);
            color = mix(wallColor1, wallColor2, stripe * 0.45);
            if (isInnerEdge) {
                color = mix(color, vec3(0.15, 0.95, 1.00), 0.75); // Radiant cyan border
            }
        } else {
            // Mode 1: Absorbing Hazard Wall (Amber hazard & slate)
            vec3 wallColor1 = vec3(22.0 / 255.0, 20.0 / 255.0, 18.0 / 255.0);
            vec3 wallColor2 = vec3(44.0 / 255.0, 36.0 / 255.0, 22.0 / 255.0);
            color = mix(wallColor1, wallColor2, stripe * 0.5);
            if (isInnerEdge) {
                color = mix(color, vec3(224.0 / 255.0, 164.0 / 255.0, 90.0 / 255.0), 0.45);
            }
        }
    }

    // Ghost Pattern Preview Overlay (clipped to grid bounds - no wrapping duplicate)
    if (u_ghostCount > 0) {
        for (int i = 0; i < 64; i++) {
            if (i >= u_ghostCount) break;
            vec2 offset = u_ghostOffsets[i];
            vec2 targetCell = u_ghostOrigin + offset;
            if (targetCell.x >= 0.0 && targetCell.x < u_resolution.x &&
                targetCell.y >= 0.0 && targetCell.y < u_resolution.y) {
                if (abs(cellCoord.x - floor(targetCell.x)) < 0.5 && abs(cellCoord.y - floor(targetCell.y)) < 0.5) {
                    vec3 ghostGlow = vec3(0.15, 0.95, 1.00); // Electric Cyan ghost glow
                    color = mix(color, ghostGlow, 0.75);
                }
            }
        }
    }

    // Interactive Hover & Cursor Highlight
    if (u_hoverCell.x >= 0.0 && u_hoverCell.y >= 0.0) {
        bool isExactHover = (abs(cellCoord.x - u_hoverCell.x) < 0.5 && abs(cellCoord.y - u_hoverCell.y) < 0.5);
        float halfR = floor(u_hoverRadius / 2.0);
        bool inBrush = (abs(cellCoord.x - u_hoverCell.x) <= halfR + 0.1 && abs(cellCoord.y - u_hoverCell.y) <= halfR + 0.1);

        if (inBrush) {
            vec2 cellFrac = fract(gridUV * u_resolution);
            vec3 highlightColor = vec3(0.15, 0.95, 1.00); // Cyan for draw/inspect
            if (u_hoverMode == 2) {
                highlightColor = vec3(1.00, 0.28, 0.38); // Coral/Red for erase
            } else if (u_hoverMode == 3) {
                highlightColor = vec3(0.98, 0.85, 0.30); // Golden Amber anchor for stamp
            }

            if (isExactHover) {
                // Crisp border reticle around current hovered cell
                float b = 0.09;
                bool isBorder = (cellFrac.x < b || cellFrac.x > 1.0 - b || cellFrac.y < b || cellFrac.y > 1.0 - b);
                if (isBorder) {
                    color = mix(color, highlightColor, 0.85);
                } else {
                    color = mix(color, highlightColor, 0.28);
                }
            } else {
                // Outer brush footprint
                float b = 0.06;
                bool isBorder = (cellFrac.x < b || cellFrac.x > 1.0 - b || cellFrac.y < b || cellFrac.y > 1.0 - b);
                if (isBorder) {
                    color = mix(color, highlightColor, 0.40);
                } else {
                    color = mix(color, highlightColor, 0.12);
                }
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
`;class Nt{constructor(e,o,n){v(this,"gl");v(this,"simProgram");v(this,"displayProgram");v(this,"textures");v(this,"fbos");v(this,"currentIdx",0);v(this,"rows");v(this,"cols");v(this,"colorMode",0);v(this,"wallMode",2);v(this,"panX",0);v(this,"panY",0);v(this,"zoom",1);v(this,"ghostCount",0);v(this,"ghostOrigin",[0,0]);v(this,"ghostOffsets",new Float32Array(128));v(this,"hoverCell",[-1,-1]);v(this,"hoverRadius",1);v(this,"hoverMode",0);v(this,"vao");v(this,"simResLoc");v(this,"simGridLoc");v(this,"simWallLoc");v(this,"dispGridLoc");v(this,"dispResLoc");v(this,"dispScreenLoc");v(this,"dispShowGridLoc");v(this,"dispColorModeLoc");v(this,"dispWallLoc");v(this,"dispGhostCountLoc");v(this,"dispGhostOriginLoc");v(this,"dispGhostOffsetsLoc");v(this,"dispHoverCellLoc");v(this,"dispHoverRadiusLoc");v(this,"dispHoverModeLoc");v(this,"dispPanLoc");v(this,"dispZoomLoc");const s=e.getContext("webgl2",{antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1});if(!s)throw new Error("WebGL 2.0 is not supported by your browser or graphics hardware.");this.gl=s,this.rows=o,this.cols=n,this.initShaders(),this.vao=s.createVertexArray(),this.textures=[this.createTexture(),this.createTexture()],this.fbos=[this.createFBO(this.textures[0]),this.createFBO(this.textures[1])],this.resize(o,n,!1)}resize(e,o,n=!1){let s=null;if(n&&this.cols>0&&this.rows>0)try{s=this.extractGrid().cells}catch{s=null}this.rows=e,this.cols=o;const i=this.gl,a=new Uint8Array(o*e*4);for(let r=0;r<2;r++)i.bindTexture(i.TEXTURE_2D,this.textures[r]),i.texImage2D(i.TEXTURE_2D,0,i.RGBA8,o,e,0,i.RGBA,i.UNSIGNED_BYTE,a);if(this.currentIdx=0,s&&s.length>0){const r=[],c=Math.min(s.length,e),h=Math.min(s[0].length,o);for(let u=0;u<e;u++){const f=[];for(let x=0;x<o;x++)this.wallMode===1&&(u<2||u>=e-2||x<2||x>=o-2)?f.push(!1):u<c&&x<h?f.push(s[u][x]):f.push(!1);r.push(f)}this.loadGrid(r)}}setColorMode(e){this.colorMode=e}setWallMode(e){if(this.wallMode=typeof e=="boolean"?e?1:0:e,this.wallMode===1)for(let o=0;o<this.rows;o++)for(let n=0;n<this.cols;n++)(o<2||o>=this.rows-2||n<2||n>=this.cols-2)&&this.setCell(o,n,!1)}setGhostPattern(e,o,n){const s=Math.min(n.length,64);this.ghostCount=s,this.ghostOrigin=[e,o],this.ghostOffsets.fill(0);for(let i=0;i<s;i++){const[a,r]=n[i];this.ghostOffsets[i*2]=r,this.ghostOffsets[i*2+1]=a}}clearGhostPattern(){this.ghostCount=0}setHoverCell(e,o,n=1,s="draw"){this.hoverCell=[e,o],this.hoverRadius=n,this.hoverMode=s==="erase"?2:s==="stamp"?3:1}clearHoverCell(){this.hoverCell=[-1,-1],this.hoverRadius=1,this.hoverMode=0}step(){const e=this.gl,o=1-this.currentIdx;e.useProgram(this.simProgram),e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[o]),e.viewport(0,0,this.cols,this.rows),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.textures[this.currentIdx]),e.uniform1i(this.simGridLoc,0),e.uniform2f(this.simResLoc,this.cols,this.rows),e.uniform1i(this.simWallLoc,this.wallMode),e.bindVertexArray(this.vao),e.drawArrays(e.TRIANGLES,0,3),this.currentIdx=o,this.wallMode===2&&this.checkAndApplyElasticBounce()}checkAndApplyElasticBounce(){const e=this.gl,o=new Uint8Array(this.cols*this.rows*4);e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[this.currentIdx]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.UNSIGNED_BYTE,o);let n=!1;for(let i=0;i<this.rows;i++){for(let a=0;a<this.cols;a++)if((i<2||i>=this.rows-2||a<2||a>=this.cols-2)&&o[(i*this.cols+a)*4]>127){n=!0;break}if(n)break}if(!n)return;const s=[];for(let i=0;i<this.rows;i++){const a=[];for(let r=0;r<this.cols;r++)a.push(o[(i*this.cols+r)*4]>127);s.push(a)}this.applyElasticBounceCPU(s,this.rows,this.cols),this.loadGrid(s)}applyElasticBounceCPU(e,o,n){const s=Array.from({length:o},()=>new Array(n).fill(!1)),i=[];for(let a=0;a<o;a++)for(let r=0;r<n;r++)if(e[a][r]&&!s[a][r]){const c=[],h=[[a,r]];for(s[a][r]=!0,c.push([a,r]);h.length>0;){const[u,f]=h.shift();for(let x=-1;x<=1;x++)for(let p=-1;p<=1;p++){if(x===0&&p===0)continue;const m=u+x,g=f+p;m>=0&&m<o&&g>=0&&g<n&&e[m][g]&&!s[m][g]&&(s[m][g]=!0,h.push([m,g]),c.push([m,g]))}}i.push(c)}for(const a of i){let r=1/0,c=-1/0,h=1/0,u=-1/0;for(const[g,L]of a)r=Math.min(r,g),c=Math.max(c,g),h=Math.min(h,L),u=Math.max(u,L);const f=r<2,x=c>=o-2,p=h<2,m=u>=n-2;if(f||x||p||m){for(const[T,M]of a)e[T][M]=!1;const g=c-r,L=u-h;for(const[T,M]of a){let k=T,ee=M;x?k=o-2-1-g+(c-T)-1:f&&(k=3+(c-T)),m?ee=n-2-1-L+(u-M)-1:p&&(ee=3+(u-M));const Le=Math.max(2,Math.min(o-3,k)),_=Math.max(2,Math.min(n-3,ee));e[Le][_]=!0}}}}setPanZoom(e,o,n){this.panX=e,this.panY=o,this.zoom=Math.max(.5,Math.min(n,32))}render(e,o,n=!0){const s=this.gl;s.useProgram(this.displayProgram),s.bindFramebuffer(s.FRAMEBUFFER,null),s.viewport(0,0,e,o),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.uniform1i(this.dispGridLoc,0),s.uniform2f(this.dispResLoc,this.cols,this.rows),s.uniform2f(this.dispScreenLoc,e,o),s.uniform1f(this.dispShowGridLoc,n?1:0),s.uniform1i(this.dispColorModeLoc,this.colorMode),s.uniform1i(this.dispWallLoc,this.wallMode),s.uniform1i(this.dispGhostCountLoc,this.ghostCount),s.uniform2f(this.dispGhostOriginLoc,this.ghostOrigin[0],this.ghostOrigin[1]),s.uniform2fv(this.dispGhostOffsetsLoc,this.ghostOffsets),s.uniform2f(this.dispHoverCellLoc,this.hoverCell[0],this.hoverCell[1]),s.uniform1f(this.dispHoverRadiusLoc,this.hoverRadius),s.uniform1i(this.dispHoverModeLoc,this.hoverMode),s.uniform2f(this.dispPanLoc,this.panX,this.panY),s.uniform1f(this.dispZoomLoc,this.zoom),s.bindVertexArray(this.vao),s.drawArrays(s.TRIANGLES,0,3)}setCell(e,o,n){if(e<0||e>=this.rows||o<0||o>=this.cols||this.wallMode===1&&n&&(e<2||e>=this.rows-2||o<2||o>=this.cols-2))return;const s=this.gl,i=n?255:0,a=new Uint8Array([i,0,0,i]);s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.texSubImage2D(s.TEXTURE_2D,0,o,e,1,1,s.RGBA,s.UNSIGNED_BYTE,a)}randomize(e){const o=this.cols*this.rows,n=new Uint8Array(o*4);for(let i=0;i<this.rows;i++)for(let a=0;a<this.cols;a++){const r=i*this.cols+a;let c=0;(!this.wallMode||i>=2&&i<this.rows-2&&a>=2&&a<this.cols-2)&&(c=Math.random()<e?255:0);const h=r*4;n[h]=c,n[h+1]=0,n[h+2]=0,n[h+3]=c}const s=this.gl;s.bindTexture(s.TEXTURE_2D,this.textures[this.currentIdx]),s.texSubImage2D(s.TEXTURE_2D,0,0,0,this.cols,this.rows,s.RGBA,s.UNSIGNED_BYTE,n)}clear(){const e=this.cols*this.rows,o=new Uint8Array(e*4),n=this.gl;for(let s=0;s<2;s++)n.bindTexture(n.TEXTURE_2D,this.textures[s]),n.texSubImage2D(n.TEXTURE_2D,0,0,0,this.cols,this.rows,n.RGBA,n.UNSIGNED_BYTE,o)}loadGrid(e){const o=e.length,n=e[0].length;(o!==this.rows||n!==this.cols)&&this.resize(o,n,!1);const s=new Uint8Array(n*o*4);for(let a=0;a<o;a++){const r=e[a];for(let c=0;c<n;c++){let h=r&&r[c]?255:0;this.wallMode&&(a<2||a>=o-2||c<2||c>=n-2)&&(h=0);const u=(a*n+c)*4;s[u]=h,s[u+1]=0,s[u+2]=0,s[u+3]=h}}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,n,o,i.RGBA,i.UNSIGNED_BYTE,s)}extractGrid(){const e=this.gl,o=new Uint8Array(this.cols*this.rows*4);e.bindFramebuffer(e.FRAMEBUFFER,this.fbos[this.currentIdx]),e.readPixels(0,0,this.cols,this.rows,e.RGBA,e.UNSIGNED_BYTE,o);const n=[];let s=0;for(let i=0;i<this.rows;i++){const a=[];for(let r=0;r<this.cols;r++){const c=(i*this.cols+r)*4,h=o[c]>127;a.push(h),h&&s++}n.push(a)}return{cells:n,liveCells:s}}loadStressPreset(e){const o=this.cols*this.rows,n=new Uint8Array(o*4),s=(a,r)=>{const c=(a%this.rows+this.rows)%this.rows,h=(r%this.cols+this.cols)%this.cols;if(this.wallMode&&(c<2||c>=this.rows-2||h<2||h>=this.cols-2))return;const u=(c*this.cols+h)*4;n[u]=255,n[u+3]=255};if(e==="supernova-soup"){for(let a=0;a<this.rows;a++)for(let r=0;r<this.cols;r++)if(!(this.wallMode&&(a<2||a>=this.rows-2||r<2||r>=this.cols-2))&&Math.random()<.5){const c=(a*this.cols+r)*4;n[c]=255,n[c+3]=255}}else if(e==="glider-megacity")for(let r=0;r<this.rows-16;r+=16)for(let c=0;c<this.cols-16;c+=16)s(r,c+1),s(r+1,c+2),s(r+2,c),s(r+2,c+1),s(r+2,c+2);else if(e==="gun-matrix"){const c=[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]];for(let h=4;h<this.rows-38;h+=38)for(let u=4;u<this.cols-42;u+=42)for(const[f,x]of c)s(h+f,u+x)}else if(e==="pulsar-galaxy"){const r=[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]];for(let c=4;c<this.rows-20;c+=20)for(let h=4;h<this.cols-20;h+=20)for(const[u,f]of r)s(c+u,h+f)}const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.textures[this.currentIdx]),i.texSubImage2D(i.TEXTURE_2D,0,0,0,this.cols,this.rows,i.RGBA,i.UNSIGNED_BYTE,n)}initShaders(){const e=this.gl,o=this.compileShader(e.VERTEX_SHADER,W),n=this.compileShader(e.FRAGMENT_SHADER,ne),s=this.compileShader(e.FRAGMENT_SHADER,$t);this.simProgram=this.createProgram(o,n),this.displayProgram=this.createProgram(o,s),this.simResLoc=e.getUniformLocation(this.simProgram,"u_resolution"),this.simGridLoc=e.getUniformLocation(this.simProgram,"u_grid"),this.simWallLoc=e.getUniformLocation(this.simProgram,"u_wallEnabled"),this.dispGridLoc=e.getUniformLocation(this.displayProgram,"u_grid"),this.dispResLoc=e.getUniformLocation(this.displayProgram,"u_resolution"),this.dispScreenLoc=e.getUniformLocation(this.displayProgram,"u_screenSize"),this.dispShowGridLoc=e.getUniformLocation(this.displayProgram,"u_showGrid"),this.dispColorModeLoc=e.getUniformLocation(this.displayProgram,"u_colorMode"),this.dispWallLoc=e.getUniformLocation(this.displayProgram,"u_wallEnabled"),this.dispGhostCountLoc=e.getUniformLocation(this.displayProgram,"u_ghostCount"),this.dispGhostOriginLoc=e.getUniformLocation(this.displayProgram,"u_ghostOrigin"),this.dispGhostOffsetsLoc=e.getUniformLocation(this.displayProgram,"u_ghostOffsets"),this.dispHoverCellLoc=e.getUniformLocation(this.displayProgram,"u_hoverCell"),this.dispHoverRadiusLoc=e.getUniformLocation(this.displayProgram,"u_hoverRadius"),this.dispHoverModeLoc=e.getUniformLocation(this.displayProgram,"u_hoverMode"),this.dispPanLoc=e.getUniformLocation(this.displayProgram,"u_pan"),this.dispZoomLoc=e.getUniformLocation(this.displayProgram,"u_zoom")}createTexture(){const e=this.gl,o=e.createTexture();return e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),o}createFBO(e){const o=this.gl,n=o.createFramebuffer();return o.bindFramebuffer(o.FRAMEBUFFER,n),o.framebufferTexture2D(o.FRAMEBUFFER,o.COLOR_ATTACHMENT0,o.TEXTURE_2D,e,0),n}compileShader(e,o){const n=this.gl,s=n.createShader(e);if(n.shaderSource(s,o),n.compileShader(s),!n.getShaderParameter(s,n.COMPILE_STATUS)){const i=n.getShaderInfoLog(s);throw n.deleteShader(s),new Error("Shader compile error: "+i)}return s}createProgram(e,o){const n=this.gl,s=n.createProgram();if(n.attachShader(s,e),n.attachShader(s,o),n.linkProgram(s),!n.getProgramParameter(s,n.LINK_STATUS)){const i=n.getProgramInfoLog(s);throw n.deleteProgram(s),new Error("Program link error: "+i)}return s}}const y=document.getElementById("board"),Dt=document.getElementById("viewport"),he=document.getElementById("cellInspector"),Ft=document.getElementById("inspectorCoords"),vt=document.getElementById("inspectorState"),We=document.getElementById("quickEngine"),se=document.getElementById("quickGen"),U=document.getElementById("quickLive"),Ve=document.getElementById("quickSize"),Ot=document.getElementById("zoomLevel"),Ht=document.getElementById("zoomInBtn"),zt=document.getElementById("zoomOutBtn"),Xt=document.getElementById("resetZoomBtn"),Wt=document.getElementById("shortcutsBtn"),fe=document.getElementById("fullscreenBtn"),Vt=document.getElementById("fps"),qt=document.getElementById("gps"),xt=document.getElementById("frameTime"),qe=document.getElementById("engineBadge"),I=document.getElementById("hint"),me=document.getElementById("play"),Yt=document.getElementById("step"),Zt=document.getElementById("undo"),yt=document.getElementById("clear"),Ct=document.getElementById("random"),Ye=document.getElementById("toolDraw"),Ze=document.getElementById("toolErase"),Je=document.getElementById("toolPan"),Ke=document.getElementById("toolStamp"),je=document.getElementById("brush1"),Qe=document.getElementById("brush3"),et=document.getElementById("brush5"),le=document.getElementById("generation"),$=document.getElementById("live"),tt=document.getElementById("size"),ie=document.getElementById("activeEngineText"),Te=document.getElementById("engineSelect"),N=document.getElementById("boundaryModeSelect"),O=document.getElementById("colorModeSelect"),R=document.getElementById("gridSizeSelect"),ge=document.getElementById("screenRatioBadge"),Et=document.getElementById("substepsSelect"),pe=document.getElementById("speed"),Be=document.getElementById("speedValue"),ot=document.getElementById("density"),Jt=document.getElementById("densityValue"),re=document.getElementById("patternSearch"),nt=document.getElementById("openImportModalBtn"),wt=document.getElementById("patternGrid"),bt=document.getElementById("patternTools"),Kt=document.getElementById("activePatternLabel"),jt=document.getElementById("rotatePatternBtn"),Qt=document.getElementById("flipHBtn"),eo=document.getElementById("flipVBtn"),to=document.getElementById("centerPatternBtn"),oo=document.getElementById("cancelPattern"),V=document.getElementById("importPatternModal"),st=document.getElementById("closeImportModal"),lt=document.getElementById("cancelImportBtn"),Pe=document.getElementById("importName"),no=document.getElementById("importCategory"),ae=document.getElementById("importData"),ve=document.getElementById("importPreviewCanvas"),it=document.getElementById("importMetaInfo"),Ie=document.getElementById("importError"),ce=document.getElementById("submitImportBtn"),Re=document.getElementById("sparklineCanvas"),de=document.getElementById("popTrendBadge"),so=document.getElementById("popMin"),lo=document.getElementById("popAvg"),io=document.getElementById("popMax"),xe=document.getElementById("runBenchmark"),_e=document.getElementById("benchmarkResult"),H=document.getElementById("shortcutsModal"),ro=document.getElementById("closeShortcutsModal");let b="client-gpu",l={rows:42,cols:72,generation:0,liveCells:0,cells:[],boundaryMode:2},q=!1,ke=!1,Ae=!0,D="draw",ye=1,S=1,B=0,P=0,Ce=!1,rt={x:0,y:0},at={x:0,y:0},Ge=!1;const Ee=[];let E=null,z=0,Y=!1,Z=!1,ct="all",F=null;const K=new Map,A=[];let d=null,we=null,Ue=null,dt=0,$e=0,St=performance.now(),ut=performance.now();const ht={glider:[[0,1],[1,2],[2,0],[2,1],[2,2]],lwss:[[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]],blinker:[[0,0],[0,1],[0,2]],toad:[[0,1],[0,2],[0,3],[1,0],[1,1],[1,2]],beacon:[[0,0],[0,1],[1,0],[1,1],[2,2],[2,3],[3,2],[3,3]],pulsar:[[0,2],[0,3],[0,4],[0,8],[0,9],[0,10],[2,0],[2,5],[2,7],[2,12],[3,0],[3,5],[3,7],[3,12],[4,0],[4,5],[4,7],[4,12],[5,2],[5,3],[5,4],[5,8],[5,9],[5,10],[7,2],[7,3],[7,4],[7,8],[7,9],[7,10],[8,0],[8,5],[8,7],[8,12],[9,0],[9,5],[9,7],[9,12],[10,0],[10,5],[10,7],[10,12],[12,2],[12,3],[12,4],[12,8],[12,9],[12,10]],pentadecathlon:[[0,1],[1,1],[2,0],[2,2],[3,1],[4,1],[5,1],[6,1],[7,0],[7,2],[8,1],[9,1]],block:[[0,0],[0,1],[1,0],[1,1]],beehive:[[0,1],[0,2],[1,0],[1,3],[2,1],[2,2]],gosper:[[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]]},Mt={glider:"spaceships",lwss:"spaceships",gosper:"guns",blinker:"oscillators",toad:"oscillators",beacon:"oscillators",pulsar:"oscillators",pentadecathlon:"oscillators",block:"still",beehive:"still"};function ao(t,e){try{d?d.resize(t,e,!1):d=new Nt(y,t,e),d.setPanZoom(B,P,S)}catch(o){console.warn("WebGL2 not available, falling back to server simulation:",o),b="server-parallel",Te.value="server-parallel",Ne()}}function Ne(){b==="client-gpu"?(qe.textContent="GPU WebGL2",We.textContent="GPU WebGL2",ie.textContent="GPU Shader",ie.style.color="var(--phosphor)"):b==="server-parallel"?(qe.textContent="CPU Multi-thread",We.textContent="Java Parallel",ie.textContent="Java Parallel",ie.style.color="var(--amber)"):(qe.textContent="CPU Single-thread",We.textContent="Java Sequential",ie.textContent="Java Sequential",ie.style.color="var(--muted)")}function j(t){if(l=t,le.textContent=String(l.generation),$.textContent=String(l.liveCells),tt.textContent=`${l.rows} × ${l.cols}`,se.textContent=String(l.generation),U.textContent=String(l.liveCells),Ve.textContent=`${l.rows} × ${l.cols}`,!l.cells||l.cells.length!==l.rows||l.cells[0]&&l.cells[0].length!==l.cols){const o=[];for(let n=0;n<l.rows;n++){const s=[];for(let i=0;i<l.cols;i++)s.push(!!(l.cells&&l.cells[n]&&l.cells[n][i]));o.push(s)}l.cells=o}l.boundaryMode!==void 0&&N?N.value=String(l.boundaryMode):l.wallMode!==void 0&&N&&(N.value=l.wallMode?"1":"0");const e=`${l.rows}x${l.cols}`;if(![...R.options].some(o=>o.value===e)){const o=document.createElement("option");o.value=e,o.textContent=`Active Grid (${l.rows} × ${l.cols})`,R.insertBefore(o,R.firstChild)}R.value=e,Me(l.rows,l.cols),d&&((d.rows!==l.rows||d.cols!==l.cols)&&d.resize(l.rows,l.cols,!1),l.boundaryMode!==void 0?d.wallMode=l.boundaryMode:l.wallMode!==void 0&&(d.wallMode=l.wallMode?1:0),l.cells&&l.cells.length>0&&d.loadGrid(l.cells),d.setPanZoom(B,P,S),d.render(y.width,y.height)),He(l.liveCells)}function w(){d&&(d.setPanZoom(B,P,S),d.render(y.width,y.height),dt++)}function De(){if(!l.cells||l.cells.length===0)return;const t=l.cells.map(e=>[...e]);Ee.push(t),Ee.length>25&&Ee.shift()}async function Lt(){if(Ee.length===0){I.textContent="Nothing to undo.";return}const t=Ee.pop();l.cells=t;let e=0;for(const o of t)for(const n of o)n&&e++;if(l.liveCells=e,$.textContent=String(e),U.textContent=String(e),b==="client-gpu"&&d)d.loadGrid(t),w();else try{await C("/api/game/grid",{method:"POST",body:JSON.stringify({rows:l.rows,cols:l.cols,generation:l.generation,cells:t})})}catch(o){console.warn("Undo sync to server:",o)}I.textContent="Undid last canvas action."}function Fe(){Ot.textContent=`${Math.round(S*100)}%`}function Tt(){S=1,B=0,P=0,Fe(),d&&(d.setPanZoom(B,P,S),w()),I.textContent="Zoom reset to 100% fit."}function Oe(t){S=Math.max(1,Math.min(S*t,32)),Fe(),d&&(d.setPanZoom(B,P,S),w())}Ht.addEventListener("click",()=>Oe(1.25)),zt.addEventListener("click",()=>Oe(1/1.25)),Xt.addEventListener("click",Tt),y.addEventListener("wheel",t=>{t.preventDefault();const e=y.getBoundingClientRect(),o=Math.max(0,Math.min(1,(t.clientX-e.left)/e.width)),n=Math.max(0,Math.min(1,(t.clientY-e.top)/e.height)),s=(o-.5)/S+.5+B,i=(n-.5)/S+.5+P,a=t.deltaY<0?1.18:1/1.18,r=Math.max(1,Math.min(S*a,32));B=s-.5-(o-.5)/r,P=i-.5-(n-.5)/r,S=r;const c=.5;B=Math.max(-c,Math.min(c,B)),P=Math.max(-c,Math.min(c,P)),Fe(),d&&(d.setPanZoom(B,P,S),w())},{passive:!1});function Bt(t){const e=y.getBoundingClientRect(),o=(t.clientX-e.left)/e.width,n=(t.clientY-e.top)/e.height,s=(o-.5)/S+.5+B,i=(n-.5)/S+.5+P;if(s<0||s>=1||i<0||i>=1)return{row:-1,col:-1,inBounds:!1};const a=Math.floor(s*l.cols);return{row:Math.floor(i*l.rows),col:a,inBounds:!0}}function J(t){D=t,[Ye,Ze,Je,Ke].forEach(e=>e.classList.remove("active")),t==="draw"&&Ye.classList.add("active"),t==="erase"&&Ze.classList.add("active"),t==="pan"&&Je.classList.add("active"),t==="stamp"&&Ke.classList.add("active"),t==="pan"?y.style.cursor="grab":t==="stamp"?y.style.cursor="copy":y.style.cursor="crosshair",t!=="stamp"&&E&&ue(null),F&&d&&(d.setHoverCell(F.col,F.row,ye,D),w())}Ye.addEventListener("click",()=>J("draw")),Ze.addEventListener("click",()=>J("erase")),Je.addEventListener("click",()=>J("pan")),Ke.addEventListener("click",()=>{if(J("stamp"),Rt("patterns"),!E&&K.size>0){const t=K.keys().next().value;t&&ue(t)}});function ft(t){ye=t,[je,Qe,et].forEach(e=>e.classList.remove("active")),t===1&&je.classList.add("active"),t===3&&Qe.classList.add("active"),t===5&&et.classList.add("active"),F&&d&&(d.setHoverCell(F.col,F.row,ye,D),w())}je.addEventListener("click",()=>ft(1)),Qe.addEventListener("click",()=>ft(3)),et.addEventListener("click",()=>ft(5));async function Pt(t,e,o){const n=Math.floor(ye/2),s=[];for(let i=-n;i<=n;i++)for(let a=-n;a<=n;a++){const r=t+i,c=e+a;r>=0&&r<l.rows&&c>=0&&c<l.cols&&s.push([r,c])}if(b==="client-gpu"&&d){for(const[a,r]of s)(!d.wallMode||a>=2&&a<l.rows-2&&r>=2&&r<l.cols-2)&&(d.setCell(a,r,o),l.cells&&l.cells[a]&&(l.cells[a][r]=o));d.render(y.width,y.height);const i=d.extractGrid();l.liveCells=i.liveCells,$.textContent=String(l.liveCells),U.textContent=String(l.liveCells)}else{for(const[a,r]of s)l.cells&&l.cells[a]&&(l.cells[a][r]=o),await C("/api/game/paint",{method:"POST",body:JSON.stringify({row:a,col:r,alive:o})});const i=await C("/api/game");j(i)}}function mt(t,e,o,n){const s=K.get(t),i=s&&s.cells&&s.cells.length>0?s.cells.map(u=>[u.row,u.col]):ht[t.toLowerCase()]||[];if(i.length===0)return[];let a=i.map(([u,f])=>[u,f]);const r=Math.floor((e%360+360)%360/90);for(let u=0;u<r;u++)a=a.map(([f,x])=>[x,-f]);o&&(a=a.map(([u,f])=>[u,-f])),n&&(a=a.map(([u,f])=>[-u,f]));const c=Math.min(...a.map(u=>u[0])),h=Math.min(...a.map(u=>u[1]));return a.map(([u,f])=>[u-c,f-h])}async function It(t,e){if(!E)return;De();const n=mt(E,z,Y,Z);if(n.length!==0)if(b==="client-gpu"&&d){for(const[i,a]of n){const r=t+i,c=e+a;r<0||r>=l.rows||c<0||c>=l.cols||(!d.wallMode||r>=2&&r<l.rows-2&&c>=2&&c<l.cols-2)&&(d.setCell(r,c,!0),l.cells&&l.cells[r]&&(l.cells[r][c]=!0))}w();const s=d.extractGrid();l.liveCells=s.liveCells,$.textContent=String(l.liveCells),U.textContent=String(l.liveCells)}else{for(const[i,a]of n){const r=t+i,c=e+a;r<0||r>=l.rows||c<0||c>=l.cols||l.cells&&l.cells[r]&&(l.cells[r][c]=!0)}const s=await C("/api/game/grid",{method:"POST",body:JSON.stringify({rows:l.rows,cols:l.cols,generation:l.generation,cells:l.cells})});j(s)}}function co(t){const e=document.createElement("canvas");e.width=60,e.height=48;const o=e.getContext("2d");if(!o||t.length===0)return e;const n=Math.max(...t.map(c=>c[0]))+1,s=Math.max(...t.map(c=>c[1]))+1,i=Math.min(Math.floor(40/Math.max(n,s)),7),a=Math.floor((60-s*i)/2),r=Math.floor((48-n*i)/2);o.fillStyle="#d9e36a";for(const[c,h]of t)o.fillRect(a+h*i,r+c*i,i-1,i-1);return e}function be(){wt.innerHTML="";const t=((re==null?void 0:re.value)||"").toLowerCase().trim();K.forEach(e=>{const o=Mt[e.id.toLowerCase()]||"other";if(ct!=="all"&&o!==ct||t&&!e.name.toLowerCase().includes(t)&&!e.description.toLowerCase().includes(t))return;const n=document.createElement("div");n.className=`pattern-card ${E===e.id?"active":""}`,n.dataset.id=e.id;const s=e.cells&&e.cells.length>0?e.cells.map(c=>[c.row,c.col]):ht[e.id.toLowerCase()]||[],i=document.createElement("div");i.className="pattern-card-preview",i.appendChild(co(s));const a=document.createElement("div");a.className="pattern-card-title",a.textContent=e.name;const r=document.createElement("div");r.className="pattern-card-cat",r.textContent=o,n.appendChild(i),n.appendChild(a),n.appendChild(r),n.addEventListener("click",()=>{ue(E===e.id?null:e.id)}),wt.appendChild(n)})}function ue(t){if(E=t,z=0,Y=!1,Z=!1,t){J("stamp"),bt.hidden=!1;const e=K.get(t);Kt.textContent=e?e.name:t}else bt.hidden=!0,d&&(d.clearGhostPattern(),w());te(),be()}function te(){if(E){const t=z>0?` [${z}°]`:"",e=Y?" [FlipH]":"",o=Z?" [FlipV]":"";I.textContent=`Stamping “${E}”${t}${e}${o} · Move over board to preview, click to place. (R: Rotate, H/V: Flip, Esc: Cancel)`}else I.textContent="Click or drag to paint cells. Hold Space or use Pan tool to navigate canvas."}jt.addEventListener("click",()=>{E&&(z=(z+90)%360,te(),oe())}),Qt.addEventListener("click",()=>{E&&(Y=!Y,te(),oe())}),eo.addEventListener("click",()=>{E&&(Z=!Z,te(),oe())}),to.addEventListener("click",async()=>{if(!E)return;const t=mt(E,z,Y,Z);if(t.length===0)return;const e=Math.max(...t.map(i=>i[0])),o=Math.max(...t.map(i=>i[1])),n=Math.max(0,Math.floor((l.rows-e)/2)),s=Math.max(0,Math.floor((l.cols-o)/2));await It(n,s),I.textContent=`Stamped “${E}” at grid center!`}),oo.addEventListener("click",()=>ue(null));function oe(){if(!E||!d||!F)return;const t=mt(E,z,Y,Z);d.setGhostPattern(F.col,F.row,t),w()}document.querySelectorAll(".cat-pill").forEach(t=>{t.addEventListener("click",()=>{document.querySelectorAll(".cat-pill").forEach(e=>e.classList.remove("active")),t.classList.add("active"),ct=t.dataset.cat||"all",be()})}),re==null||re.addEventListener("input",()=>be());function Rt(t){document.querySelectorAll(".tab-btn").forEach(n=>n.classList.remove("active")),document.querySelectorAll(".tab-pane").forEach(n=>n.classList.remove("active"));const e=document.querySelector(`.tab-btn[data-tab="${t}"]`),o=document.getElementById(`tab-${t}`);e&&e.classList.add("active"),o&&o.classList.add("active")}document.querySelectorAll(".tab-btn").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.tab;e&&Rt(e)})});function He(t){A.push(t),A.length>100&&A.shift(),uo()}function uo(){if(!Re)return;const t=Re.getContext("2d");if(!t)return;const e=Re.width,o=Re.height;if(t.clearRect(0,0,e,o),A.length<2)return;const n=Math.min(...A),s=Math.max(...A),i=Math.round(A.reduce((f,x)=>f+x,0)/A.length);so.textContent=String(n),lo.textContent=String(i),io.textContent=String(s);const a=A.slice(-10),r=a[a.length-1]-a[0];r>5?(de.textContent="Growing",de.style.color="var(--phosphor)"):r<-5?(de.textContent="Declining",de.style.color="var(--danger)"):(de.textContent="Stable",de.style.color="var(--cyan)");const c=s===n?1:s-n,h=e/(A.length-1),u=t.createLinearGradient(0,0,0,o);u.addColorStop(0,"rgba(34, 211, 238, 0.35)"),u.addColorStop(1,"rgba(34, 211, 238, 0.0)"),t.beginPath();for(let f=0;f<A.length;f++){const x=f*h,p=o-(A[f]-n)/c*(o-16)-8;f===0?t.moveTo(x,p):t.lineTo(x,p)}t.lineTo(e,o),t.lineTo(0,o),t.closePath(),t.fillStyle=u,t.fill(),t.beginPath();for(let f=0;f<A.length;f++){const x=f*h,p=o-(A[f]-n)/c*(o-16)-8;f===0?t.moveTo(x,p):t.lineTo(x,p)}t.strokeStyle="#22d3ee",t.lineWidth=2,t.stroke()}function gt(){if(!d)return;const t=performance.now();d.step();const e=performance.now();xt.textContent=(e-t).toFixed(1),l.generation++,$e++}function _t(){if(gt(),le.textContent=String(l.generation),se.textContent=String(l.generation),w(),l.generation%30===0&&d){const t=d.extractGrid();l.liveCells=t.liveCells,$.textContent=String(t.liveCells),U.textContent=String(t.liveCells),He(t.liveCells)}}async function pt(){const t=performance.now(),e=await C("/api/game/step",{method:"POST"}),o=performance.now();xt.textContent=(o-t).toFixed(1),$e++,j(e)}function kt(){if(!q||b!=="client-gpu")return;const t=Number(pe.value),e=Et?Number(Et.value):1;if(t===0){for(let o=0;o<e;o++)gt();le.textContent=String(l.generation),se.textContent=String(l.generation),w()}else{const o=performance.now();if(o-ut>=t){for(let n=0;n<e;n++)gt();le.textContent=String(l.generation),se.textContent=String(l.generation),w(),ut=o}else w()}if(l.generation%30===0&&d){const o=d.extractGrid();l.liveCells=o.liveCells,$.textContent=String(o.liveCells),U.textContent=String(o.liveCells),He(o.liveCells)}At(),we=requestAnimationFrame(kt)}function Se(){if(!q)if(q=!0,me.textContent="⏸ Pause",me.classList.add("running"),ut=performance.now(),b==="client-gpu")we=requestAnimationFrame(kt);else{const t=async()=>{if(q)try{await pt(),At(),Ue=setTimeout(t,Number(pe.value))}catch(e){X();const o=e instanceof Error?e.message:String(e);I.textContent=`Play stopped: ${o}. Press Play to resume.`}};t()}}function X(){if(q=!1,me.textContent="▶ Play",me.classList.remove("running"),we!==null&&(cancelAnimationFrame(we),we=null),Ue!==null&&(clearTimeout(Ue),Ue=null),b==="client-gpu"&&d){const t=d.extractGrid();l.cells=t.cells,l.liveCells=t.liveCells,$.textContent=String(l.liveCells),U.textContent=String(l.liveCells),He(t.liveCells)}}function At(){const t=performance.now(),e=t-St;if(e>=1e3){const o=Math.round(dt*1e3/e),n=Math.round($e*1e3/e);Vt.textContent=String(o),qt.textContent=String(n),dt=0,$e=0,St=t}}y.addEventListener("pointerdown",async t=>{if(t.button===1||Ge||D==="pan"){Ce=!0,rt={x:t.clientX,y:t.clientY},at={x:B,y:P},y.setPointerCapture(t.pointerId),y.style.cursor="grabbing";return}const{row:e,col:o,inBounds:n}=Bt(t);if(n){if(D==="stamp"&&E){await It(e,o);return}De(),ke=!0,y.setPointerCapture(t.pointerId),D==="erase"?Ae=!1:Ae=!(l.cells&&l.cells[e]&&l.cells[e][o]),await Pt(e,o,Ae)}}),y.addEventListener("pointermove",async t=>{if(Ce){const s=y.getBoundingClientRect(),i=(t.clientX-rt.x)/s.width/S,a=(t.clientY-rt.y)/s.height/S;B=at.x-i,P=at.y-a;const r=.5;B=Math.max(-r,Math.min(r,B)),P=Math.max(-r,Math.min(r,P)),d&&(d.setPanZoom(B,P,S),w());return}const{row:e,col:o,inBounds:n}=Bt(t);if(n){F={row:e,col:o},he.hidden=!1,he.style.left=`${t.clientX}px`,he.style.top=`${t.clientY}px`;const s=l.cells&&l.cells[e]&&l.cells[e][o];Ft.textContent=`X: ${o}, Y: ${e}`,vt.textContent=s?"● Alive":"○ Dead",vt.style.color=s?"var(--phosphor)":"var(--muted)",d&&d.setHoverCell(o,e,ye,D)}else he.hidden=!0,F=null,d&&d.clearHoverCell();if(D==="stamp"&&E&&n){oe();return}ke&&n?await Pt(e,o,Ae):w()}),y.addEventListener("pointerup",t=>{Ce&&(Ce=!1,y.releasePointerCapture(t.pointerId),y.style.cursor=D==="pan"?"grab":"crosshair"),ke=!1}),y.addEventListener("pointercancel",()=>{Ce=!1,ke=!1}),y.addEventListener("pointerleave",()=>{he.hidden=!0,F=null,d&&(d.clearHoverCell(),E&&d.clearGhostPattern(),w())}),me.addEventListener("click",()=>{q?X():Se()}),Yt.addEventListener("click",async()=>{X(),b==="client-gpu"?_t():await pt()}),Zt.addEventListener("click",Lt),yt.addEventListener("click",async()=>{De(),X(),b==="client-gpu"&&d&&(d.clear(),l.generation=0,l.liveCells=0,le.textContent="0",$.textContent="0",se.textContent="0",U.textContent="0",w()),j(await C("/api/game/clear",{method:"POST"})),I.textContent="Grid cleared."}),Ct.addEventListener("click",async()=>{De(),X();const t=Number(ot.value);if(b==="client-gpu"&&d){d.randomize(t),l.generation=0,le.textContent="0",se.textContent="0";const e=d.extractGrid();l.cells=e.cells,l.liveCells=e.liveCells,$.textContent=String(l.liveCells),U.textContent=String(l.liveCells),w()}else j(await C("/api/game/random",{method:"POST",body:JSON.stringify({density:t})}));I.textContent=`Spawned random soup at ${Math.round(t*100)}% density.`}),pe.addEventListener("input",()=>{const t=Number(pe.value);if(t===0)Be.textContent="⚡ Uncapped (Hardware Native Hz)";else{const e=Math.round(1e3/t);Be.textContent=`${t} ms (${e} tps)`}}),ot.addEventListener("input",()=>{Jt.textContent=`${Math.round(Number(ot.value)*100)}%`}),N==null||N.addEventListener("change",async()=>{const t=Number(N.value);if(d){d.setWallMode(t),w();const e=d.extractGrid();l.cells=e.cells,l.liveCells=e.liveCells,$.textContent=String(l.liveCells),U.textContent=String(l.liveCells)}try{const e=await C("/api/game/wall",{method:"POST",body:JSON.stringify({mode:t})});b!=="client-gpu"&&j(e)}catch(e){console.warn("Boundary mode backend sync:",e)}t===2?I.textContent="⚡ Elastic Wall active: Patterns bounce elastically off the 2-cell buffer layer with velocity reversal.":t===1?I.textContent="🧱 Absorbing Wall active: Cells entering the 2-cell buffer layer are zeroed.":I.textContent="🔄 Toroidal Wrap active: Cells wrap around opposite boundaries seamlessly."});function ho(t){const e=t.trim();if(!e)throw new Error("Pattern code is empty.");if(e.startsWith("["))try{const p=JSON.parse(e);if(Array.isArray(p)&&p.length>0){const m=[];for(const g of p)Array.isArray(g)&&g.length>=2?m.push([Number(g[0]),Number(g[1])]):g&&typeof g=="object"&&"row"in g&&"col"in g&&m.push([Number(g.row),Number(g.col)]);if(m.length>0){const g=Math.min(...m.map(T=>T[0])),L=Math.min(...m.map(T=>T[1]));return{cells:m.map(([T,M])=>[T-g,M-L])}}}}catch{}const o=e.split(/\r?\n/);if(!(e.includes("$")||e.includes("!")||/x\s*=\s*\d+/.test(e))&&o.some(p=>!p.startsWith("!")&&/^[.O*oX ]+$/.test(p.trim()))){let p;const m=[];let g=0;for(const L of o){const T=L.trim();if(T.startsWith("!")){!p&&T.length>1&&(p=T.slice(1).trim());continue}for(let M=0;M<L.length;M++){const k=L[M];(k==="O"||k==="o"||k==="*"||k==="X")&&m.push([g,M])}g++}if(m.length>0){const L=Math.min(...m.map(M=>M[0])),T=Math.min(...m.map(M=>M[1]));return{name:p,cells:m.map(([M,k])=>[M-L,k-T])}}}let i,a="";for(const p of o){const m=p.trim();if(m.startsWith("#")){m.startsWith("#N")&&!i&&(i=m.slice(2).trim());continue}m.startsWith("x")&&m.includes("=")||(a+=m)}const r=[];let c=0,h=0,u="";for(let p=0;p<a.length;p++){const m=a[p];if(m>="0"&&m<="9")u+=m;else if(m==="b"){const g=u?parseInt(u,10):1;h+=g,u=""}else if(m==="o"||m==="A"){const g=u?parseInt(u,10):1;for(let L=0;L<g;L++)r.push([c,h+L]);h+=g,u=""}else if(m==="$"){const g=u?parseInt(u,10):1;c+=g,h=0,u=""}else if(m==="!")break}if(r.length===0)throw new Error("No live cells found in pattern data.");const f=Math.min(...r.map(p=>p[0])),x=Math.min(...r.map(p=>p[1]));return{name:i,cells:r.map(([p,m])=>[p-f,m-x])}}let Q=null;function Gt(){const t=ve.getContext("2d");if(!t)return;t.fillStyle="#0d0c0a",t.fillRect(0,0,ve.width,ve.height);const e=ae.value.trim();if(!e){it.textContent="Enter pattern code above to preview",Ie.hidden=!0,ce.disabled=!0,Q=null;return}try{const o=ho(e);Q=o.cells,Ie.hidden=!0,ce.disabled=!1,o.name&&!Pe.value.trim()&&(Pe.value=o.name);const n=Math.max(...o.cells.map(c=>c[0]))+1,s=Math.max(...o.cells.map(c=>c[1]))+1;it.textContent=`Size: ${s} × ${n} (${o.cells.length} live cells)`;const i=Math.min(Math.floor(56/Math.max(n,s)),6),a=Math.floor((ve.width-s*i)/2),r=Math.floor((ve.height-n*i)/2);t.fillStyle="#d9e36a";for(const[c,h]of o.cells)t.fillRect(a+h*i,r+c*i,i-1,i-1)}catch(o){Q=null,ce.disabled=!0,Ie.hidden=!1,Ie.textContent=o instanceof Error?o.message:String(o),it.textContent="Invalid format"}}nt==null||nt.addEventListener("click",()=>{V.showModal(),ae.focus(),Gt()}),st==null||st.addEventListener("click",()=>V.close()),lt==null||lt.addEventListener("click",()=>V.close()),V==null||V.addEventListener("click",t=>{t.target===V&&V.close()}),ae==null||ae.addEventListener("input",Gt),ce==null||ce.addEventListener("click",()=>{if(!Q||Q.length===0)return;const t=Pe.value.trim()||"Custom Pattern",e="custom_"+Date.now().toString(36),o=no.value||"custom";ht[e]=Q,Mt[e]=o,K.set(e,{id:e,name:t,description:`User-imported pattern (${o})`,cells:Q.map(([n,s])=>({row:n,col:s}))}),V.close(),Pe.value="",ae.value="",Q=null,be(),ue(e),I.textContent=`Pattern "${t}" added to catalog! Click or drag on canvas to stamp.`}),O.addEventListener("change",()=>{const t=Number(O.value);d&&(d.setColorMode(t),w())}),Te.addEventListener("change",async()=>{const t=q;X();const e=Te.value;if(b==="client-gpu"&&(e==="server-parallel"||e==="server-single")&&d){const n=d.extractGrid();l.cells=n.cells,l.liveCells=n.liveCells;try{await C("/api/game/grid",{method:"POST",body:JSON.stringify({rows:l.rows,cols:l.cols,generation:l.generation,cells:n.cells})})}catch(s){console.warn("Grid upload to server:",s)}}b=e,Ne(),b==="server-parallel"?await C("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"PARALLEL"})}):b==="server-single"&&await C("/api/game/engine",{method:"POST",body:JSON.stringify({mode:"SEQUENTIAL"})});const o=await C("/api/game");j(o),t&&Se()});function Ut(){const t=y.parentElement,e=t&&t.clientWidth>0?t.clientWidth:window.innerWidth-380,o=t&&t.clientHeight>0?t.clientHeight:window.innerHeight-120,n=Math.max(.4,Math.min(4,e/Math.max(1,o)));let s=`${n.toFixed(2)}:1 Screen`;return Math.abs(n-16/9)<.08?s="16:9 Screen Fit":Math.abs(n-16/10)<.08?s="16:10 Screen Fit":Math.abs(n-21/9)<.12?s="21:9 Ultrawide":Math.abs(n-32/9)<.15?s="32:9 Superwide":Math.abs(n-4/3)<.08?s="4:3 Screen Fit":Math.abs(n-3/2)<.08?s="3:2 Screen Fit":Math.abs(n-1)<.08&&(s="1:1 Square"),{ratio:n,label:s}}function Me(t,e){const o=y.parentElement,n=o&&o.clientWidth>0?o.clientWidth:1152,s=o&&o.clientHeight>0?o.clientHeight:672,i=e/t,a=n/s;let r,c;Math.abs(i-a)<.06?(r=n,c=s):i>a?(r=n,c=n/i):(c=s,r=s*i);const h=Math.min(window.devicePixelRatio||1,2),f=Math.max(h,1024/Math.max(r,c));y.width=Math.round(r*f),y.height=Math.round(c*f)}let ze=0;function Xe(t=!1){const{ratio:e,label:o}=Ut();if(ge&&(ge.textContent=o),!t&&ze>0&&Math.abs(e-ze)/ze<.025)return;ze=e;const n=`${l.rows}x${l.cols}`,s=_=>{let G=Math.round(_*e);return G%2!==0&&(G+=1),Math.max(10,G)},i=42,a=s(i),r=64,c=s(r),h=120,u=s(h),f=240,x=s(f),p=480,m=s(p);let g=Math.round(Math.sqrt(1e6/e));g%2!==0&&(g+=1);const L=s(g),T=[{value:`${i}x${a}`,label:`🌱 Compact (${i} × ${a}) · Fast`},{value:`${r}x${c}`,label:`🎬 Studio HD (${r} × ${c}) · Recommended`},{value:`${h}x${u}`,label:`✨ HD Arena (${h} × ${u})`},{value:`${f}x${x}`,label:`⚡ 2K Megagrid (${f} × ${x})`},{value:`${p}x${m}`,label:`🔥 4K GPU Grid (${p} × ${m})`},{value:`${g}x${L}`,label:`🚀 1 Million Cells (${g} × ${L})`}],M=[{value:"42x72",label:"42 × 72 (Legacy Studio)"},{value:"60x100",label:"60 × 100 (Legacy Widescreen)"},{value:"128x128",label:"128 × 128 (Square HD)"},{value:"256x256",label:"256 × 256 (Square 2K)"},{value:"512x512",label:"512 × 512 (Square 4K)"},{value:"1024x1024",label:"1024 × 1024 (Square 1M)"}];R.innerHTML="";const k=document.createElement("optgroup");k.id="dynamicRatioGroup",k.label=`📐 Screen Matched (${o})`;let ee=!1;T.forEach(_=>{const G=document.createElement("option");G.value=_.value,G.textContent=_.label,_.value===n&&(G.selected=!0,ee=!0),k.appendChild(G)}),R.appendChild(k);const Le=document.createElement("optgroup");if(Le.label="🔲 Fixed & Square Presets",M.forEach(_=>{const G=document.createElement("option");G.value=_.value,G.textContent=_.label,_.value===n&&!ee&&(G.selected=!0,ee=!0),Le.appendChild(G)}),R.appendChild(Le),!ee){const _=document.createElement("option");_.value=n,_.textContent=`Active Grid (${l.rows} × ${l.cols})`,_.selected=!0,R.insertBefore(_,R.firstChild)}R.value=n}ge==null||ge.addEventListener("click",()=>{Xe(!0);const{ratio:t,label:e}=Ut(),o=64;let n=Math.round(o*t);n%2!==0&&(n+=1);const s=`${o}x${n}`;R.value!==s&&(R.value=s,R.dispatchEvent(new Event("change"))),I.textContent=`📐 Auto-fit grid applied for ${e}: ${o} × ${n}.`}),R.addEventListener("change",async()=>{const t=q;X();const[e,o]=R.value.split("x").map(Number);let n=[];b==="client-gpu"&&d?n=d.extractGrid().cells:l.cells&&l.cells.length>0&&(n=l.cells);const s=[],i=Math.min(n.length,e),a=n.length>0?Math.min(n[0].length,o):0;let r=0;const c=d?d.wallMode:!1;for(let h=0;h<e;h++){const u=[];for(let f=0;f<o;f++){let x=h<i&&f<a?n[h][f]:!1;c&&(h<2||h>=e-2||f<2||f>=o-2)&&(x=!1),u.push(x),x&&r++}s.push(u)}l.rows=e,l.cols=o,l.cells=s,l.liveCells=r,tt.textContent=`${e} × ${o}`,Ve.textContent=`${e} × ${o}`,$.textContent=String(r),U.textContent=String(r),Me(e,o),d&&(d.resize(e,o,!1),d.loadGrid(s),d.setPanZoom(B,P,S),w());try{await C("/api/game/resize",{method:"POST",body:JSON.stringify({rows:e,cols:o,preserveCells:!0})}),await C("/api/game/grid",{method:"POST",body:JSON.stringify({rows:e,cols:o,generation:l.generation,cells:s})})}catch(h){console.warn("Backend resize sync:",h)}t&&Se()}),document.querySelectorAll(".stress-btn").forEach(t=>{t.addEventListener("click",async()=>{var i,a;const e=t.dataset.preset;X(),b="client-gpu",Te.value="client-gpu",Ne();let o="1024x1024";(e==="gun-matrix"||e==="pulsar-galaxy")&&(o="512x512"),R.value=o;const[n,s]=o.split("x").map(Number);if(l.rows=n,l.cols=s,l.generation=0,tt.textContent=`${n} × ${s}`,Ve.textContent=`${n} × ${s}`,y.width=1024,y.height=1024,d){d.resize(n,s,!1),d.loadStressPreset(e);const r=d.extractGrid();l.cells=r.cells,l.liveCells=r.liveCells,$.textContent=String(l.liveCells),U.textContent=String(l.liveCells),w()}try{await C("/api/game/reset",{method:"POST",body:JSON.stringify({rows:n,cols:s,preserveCells:!1})})}catch{}I.textContent=`🚀 Stress preset "${(a=(i=t.querySelector("strong"))==null?void 0:i.textContent)==null?void 0:a.trim()}" running at full GPU speed!`,Se()})}),xe.addEventListener("click",async()=>{xe.disabled=!0,xe.textContent="Running...",_e.hidden=!1,_e.innerHTML="<em>Warming up JIT & benchmarking all CPU cores...</em>";try{const t=await C("/api/game/benchmark",{method:"POST",body:JSON.stringify({generations:200,rows:128,cols:128})});_e.innerHTML=`
      <div>Grid: <strong>${t.rows} × ${t.cols}</strong> (${t.totalCells.toLocaleString()} cells) · Cores: <strong>${t.availableProcessors}</strong></div>
      <div>Sequential: <strong>${t.sequentialDurationMs}ms</strong> (${t.sequentialGps} gen/s)</div>
      <div>Parallel: <strong>${t.parallelDurationMs}ms</strong> (${t.parallelGps} gen/s)</div>
      <div style="margin-top:4px; color:var(--phosphor);">Speedup Factor: <strong>${t.speedupFactor}×</strong> faster</div>
    `}catch(t){_e.textContent="Benchmark failed: "+(t instanceof Error?t.message:String(t))}finally{xe.disabled=!1,xe.textContent="Run Test"}}),fe.addEventListener("click",()=>{document.fullscreenElement?(document.exitFullscreen().catch(()=>{}),fe.textContent="⛶ Fullscreen"):(Dt.requestFullscreen().catch(()=>{}),fe.textContent="✕ Exit")}),document.addEventListener("fullscreenchange",()=>{document.fullscreenElement||(fe.textContent="⛶ Fullscreen")}),Wt.addEventListener("click",()=>H.showModal()),ro.addEventListener("click",()=>H.close()),H.addEventListener("click",t=>{t.target===H&&H.close()}),window.addEventListener("keydown",t=>{if(document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement){t.key==="Escape"&&document.activeElement.blur();return}if(t.code==="Space")t.preventDefault(),q?X():Se();else if(t.key==="ArrowRight"||t.key==="s"||t.key==="S")t.preventDefault(),X(),b==="client-gpu"?_t():pt();else if((t.ctrlKey||t.metaKey)&&(t.key==="z"||t.key==="Z"))t.preventDefault(),Lt();else if(t.key==="c"||t.key==="C")yt.click();else if(t.key==="w"||t.key==="W"){if(N){const e=Number(N.value)||0;N.value=String((e+1)%3),N.dispatchEvent(new Event("change"))}}else t.key==="r"||t.key==="R"?E?(z=(z+90)%360,te(),oe()):Ct.click():t.key==="h"||t.key==="H"?E&&(Y=!Y,te(),oe()):t.key==="v"||t.key==="V"?E&&(Z=!Z,te(),oe()):t.key==="d"||t.key==="D"?J("draw"):t.key==="e"||t.key==="E"?J("erase"):t.key==="p"||t.key==="P"?J("pan"):t.key==="t"||t.key==="T"?J("stamp"):t.key==="1"?(O.value="0",O.dispatchEvent(new Event("change"))):t.key==="2"?(O.value="1",O.dispatchEvent(new Event("change"))):t.key==="3"?(O.value="2",O.dispatchEvent(new Event("change"))):t.key==="4"?(O.value="3",O.dispatchEvent(new Event("change"))):t.key==="+"||t.key==="="?Oe(1.25):t.key==="-"||t.key==="_"?Oe(1/1.25):t.key==="0"?Tt():t.key==="f"||t.key==="F"?fe.click():t.key==="?"?H.open?H.close():H.showModal():t.key==="Escape"&&(H.open?H.close():E&&ue(null))}),window.addEventListener("keydown",t=>{t.code==="Space"&&!Ge&&!(document.activeElement instanceof HTMLInputElement)&&(Ge=!0,D!=="pan"&&(y.style.cursor="grab"))}),window.addEventListener("keyup",t=>{t.code==="Space"&&(Ge=!1,D!=="pan"&&(y.style.cursor=D==="stamp"?"copy":"crosshair"))});async function fo(){Ne(),Fe();const t=await C("/api/game/patterns");K.clear(),t.forEach(n=>{K.set(n.id,n)}),be();const e=await C("/api/game");Xe(!0),ao(e.rows,e.cols),Me(e.rows,e.cols),j(e),window.ResizeObserver&&y.parentElement?new ResizeObserver(()=>{Xe(!1),Me(l.rows,l.cols),d&&w()}).observe(y.parentElement):window.addEventListener("resize",()=>{Xe(!1),Me(l.rows,l.cols),d&&w()});const o=Number(pe.value);o===0?Be.textContent="⚡ Uncapped (Hardware Native Hz)":Be.textContent=`${o} ms (${Math.round(1e3/o)} tps)`;try{const n=await C("/api/game/hardware");n.gpuAvailable?console.log(`⚡ Backend Container GPU: ${n.deviceName}`):console.log(`⚙️ Backend Container CPU: ${n.deviceName}`)}catch{}}fo().catch(t=>{const e=t instanceof Error?t.message:String(t);I.textContent=`Could not reach the Game of Life API: ${e}`})})();
