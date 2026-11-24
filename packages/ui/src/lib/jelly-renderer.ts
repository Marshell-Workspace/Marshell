"use client";

import { capturePopupRaster } from "@workspace/ui/lib/genie-motion";

const MARGIN = 80;
const VERTEX = `attribute vec2 position; varying vec2 uv;
void main(){ uv=position*0.5+0.5; gl_Position=vec4(position,0.0,1.0); }`;
const FRAGMENT = `precision highp float;
uniform sampler2D picture; uniform vec2 size; uniform vec2 grab; uniform vec2 bend;
varying vec2 uv;
void main(){
  vec2 point=vec2(uv.x,1.0-uv.y)*(size+${MARGIN * 2}.0)-${MARGIN}.0;
  vec2 distance=(point/size-grab)*vec2(0.8,1.0);
  float weight=1.0-exp(-3.0*dot(distance,distance));
  vec2 source=(point+bend*weight)/size;
  if(source.x<0.0||source.y<0.0||source.x>1.0||source.y>1.0){gl_FragColor=vec4(0.0);}
  else{gl_FragColor=texture2D(picture,vec2(source.x,1.0-source.y));}
}`;

export interface JellyRenderer {
  dispose: () => void;
  paint: (x: number, y: number, bendX: number, bendY: number) => boolean;
  rest: () => void;
}

/** One texture upload per grab, one GPU draw per frame, no live-DOM filter repaint. */
export async function createJellyRenderer(
  surface: HTMLElement,
  rect: DOMRect,
  grabX: number,
  grabY: number,
  offsetX: number,
  offsetY: number
): Promise<JellyRenderer | null> {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
  });
  if (!gl) {
    return null;
  }
  const program = gl.createProgram();
  const texture = gl.createTexture();
  const buffer = gl.createBuffer();
  const shaders: WebGLShader[] = [];
  const opacity = surface.style.opacity;
  let painted = false;
  const dispose = () => {
    canvas.remove();
    if (painted) {
      surface.style.opacity = opacity;
    }
    for (const shader of shaders) {
      gl.deleteShader(shader);
    }
    gl.deleteProgram(program);
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
  try {
    if (!(program && texture && buffer)) {
      dispose();
      return null;
    }
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) {
        dispose();
        return null;
      }
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        dispose();
        return null;
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      dispose();
      return null;
    }
    const raster = await capturePopupRaster(surface, rect, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster);
    raster.width = 0;
    raster.height = 0;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const width = rect.width + MARGIN * 2;
    const height = rect.height + MARGIN * 2;
    const resolution = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(1_500_000 / (width * height))
    );
    canvas.width = Math.ceil(width * resolution);
    canvas.height = Math.ceil(height * resolution);
    canvas.style.cssText = `position:fixed;left:${rect.left - offsetX - MARGIN}px;top:${rect.top - offsetY - MARGIN}px;width:${width}px;height:${height}px;pointer-events:none;visibility:hidden;will-change:transform;z-index:${getComputedStyle(surface).zIndex};`;
    canvas.dataset.jellyGpu = "";
    canvas.inert = true;
    canvas.setAttribute("aria-hidden", "true");
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(
      gl.getUniformLocation(program, "size"),
      rect.width,
      rect.height
    );
    gl.uniform2f(gl.getUniformLocation(program, "grab"), grabX, grabY);
    gl.uniform1i(gl.getUniformLocation(program, "picture"), 0);
    const bend = gl.getUniformLocation(program, "bend");
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      canvas.style.visibility = "hidden";
      surface.style.opacity = opacity;
    });
    document.body.append(canvas);
    return {
      dispose,
      rest: () => {
        canvas.style.visibility = "hidden";
        surface.style.opacity = opacity;
      },
      paint: (x, y, bendX, bendY) => {
        if (gl.isContextLost()) {
          canvas.style.visibility = "hidden";
          surface.style.opacity = opacity;
          return false;
        }
        gl.uniform2f(bend, bendX, bendY);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        canvas.style.transform = `translate3d(${x}px,${y}px,0)`;
        canvas.style.visibility = "visible";
        surface.style.opacity = "0";
        painted = true;
        return true;
      },
    };
  } catch {
    dispose();
    return null;
  }
}
