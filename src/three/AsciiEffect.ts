// Pass that re-renders the scene as glyphs (docs/DESIGN.md §5).
// Each screen cell shows the scene's luminance as a glyph from a ramp and keeps the scene's colour,
// so accent-coloured objects come through as coloured glyphs.
//
// The scene is rendered into a target with one texel per cell, never at full resolution: the glyphs only ever
// read one sample per cell, so the expensive field shader runs about 300× fewer times (D-063). Only this cheap
// glyph lookup runs per screen pixel.
//
// It can also mask itself cell by cell (the loading curtain, D-025): cells are "covered" or
// transparent, each at its own random moment (D-035).
import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type WebGLRenderer,
} from 'three'
import { fonts } from '../styles/tokens'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const fragmentShader = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uScene;   // one texel per cell
uniform vec2 uGrid;         // cells across, down
uniform vec2 uResolution;   // drawing buffer, px
uniform sampler2D uGlyphs;
uniform float uCount;
uniform float uCell;
uniform float uSaturation;
uniform float uGain;
uniform float uDim;
uniform float uMaskMode;   // 0 off · 1 covering · 2 revealing · 3 fully covered
uniform float uProgress;   // 0 → 1 along the sweep

float hash12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 px = vUv * uResolution;
  vec2 cell = floor(px / uCell);
  vec3 c = texture2D(uScene, (cell + 0.5) / uGrid).rgb;

  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float idx = floor(clamp(l * uGain, 0.0, 0.999) * uCount);
  vec2 local = fract(px / uCell);
  float glyph = texture2D(uGlyphs, vec2((idx + local.x) / uCount, local.y)).r;

  vec3 col = mix(vec3(l), c, uSaturation) * uGain * uDim * glyph;
  float alpha = 1.0;

  if (uMaskMode > 0.5) {
    // Each cell flips at its own random moment, so the page builds "pixel by pixel" in no particular order.
    float d = hash12(cell);
    float covered = uMaskMode < 1.5 ? step(d, uProgress)
                  : uMaskMode < 2.5 ? step(uProgress, d)
                  : 1.0;

    alpha = covered;
    col *= covered; // premultiplied
  }

  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`

export const GLYPH_RAMP = ' .·:-=+*#%@'

export type AsciiOptions = {
  cellSize?: number
  saturation?: number
  gain?: number
  ramp?: string
}

export type MaskMode = 'off' | 'covering' | 'revealing' | 'covered'
const MASK_MODES: Record<MaskMode, number> = { off: 0, covering: 1, revealing: 2, covered: 3 }

function drawAtlas(canvas: HTMLCanvasElement, ramp: string) {
  const size = 64
  canvas.width = size * ramp.length
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.font = `500 ${size * 0.8}px "${fonts.mono}", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < ramp.length; i++) {
    ctx.fillText(ramp[i], i * size + size / 2, size / 2 + size * 0.04)
  }
}

export class AsciiEffect {
  // How much of the screen-sized UV range the cell grid covers (it overhangs by up to one cell). The scene reads it,
  // so each texel samples exactly the point at its cell's centre.
  readonly uvScale = new Vector2(1, 1)
  private atlas: CanvasTexture
  private target: WebGLRenderTarget
  private material: ShaderMaterial
  private quad: Scene
  private camera = new OrthographicCamera()
  private buffer = new Vector2()

  constructor({ cellSize = 9, saturation = 1, gain = 1.4, ramp = GLYPH_RAMP }: AsciiOptions = {}) {
    const canvas = document.createElement('canvas')
    drawAtlas(canvas, ramp)
    const atlas = new CanvasTexture(canvas)
    atlas.minFilter = LinearFilter
    atlas.magFilter = LinearFilter
    this.atlas = atlas

    this.target = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false })
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: this.target.texture },
        uGrid: { value: new Vector2(1, 1) },
        uResolution: { value: new Vector2(1, 1) },
        uGlyphs: { value: atlas },
        uCount: { value: ramp.length },
        uCell: { value: cellSize },
        uSaturation: { value: saturation },
        uGain: { value: gain },
        uDim: { value: 1 },
        uMaskMode: { value: 0 },
        uProgress: { value: 0 },
      },
    })
    const mesh = new Mesh(new PlaneGeometry(2, 2), this.material)
    mesh.frustumCulled = false
    this.quad = new Scene().add(mesh as Object3D)

    // Redraw once Geist Mono has loaded; the first draw may use the fallback font.
    document.fonts?.load(`48px "${fonts.mono}"`).then(() => {
      drawAtlas(canvas, ramp)
      atlas.needsUpdate = true
    })
  }

  setDim(value: number) {
    this.material.uniforms.uDim.value = value
  }

  setMask(mode: MaskMode, progress = 0) {
    this.material.uniforms.uMaskMode.value = MASK_MODES[mode]
    this.material.uniforms.uProgress.value = progress
  }

  // Sizes the cell grid to the drawing buffer. Call before the scene updates its uniforms for the frame.
  resize(gl: WebGLRenderer) {
    const u = this.material.uniforms
    const cell = u.uCell.value as number
    gl.getDrawingBufferSize(this.buffer)
    const cols = Math.max(1, Math.ceil(this.buffer.x / cell))
    const rows = Math.max(1, Math.ceil(this.buffer.y / cell))
    if (this.target.width !== cols || this.target.height !== rows) this.target.setSize(cols, rows)
    u.uGrid.value.set(cols, rows)
    u.uResolution.value.copy(this.buffer)
    this.uvScale.set((cols * cell) / this.buffer.x, (rows * cell) / this.buffer.y)
  }

  render(gl: WebGLRenderer, scene: Scene, camera: Camera) {
    gl.setRenderTarget(this.target)
    gl.clear()
    gl.render(scene, camera)
    gl.setRenderTarget(null)
    gl.render(this.quad, this.camera)
  }

  dispose() {
    this.atlas.dispose()
    this.target.dispose()
    this.material.dispose()
  }
}
