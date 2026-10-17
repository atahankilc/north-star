// Post-processing pass that re-renders the scene as glyphs (docs/DESIGN.md §5).
// Each screen cell samples the scene once, maps luminance to a glyph ramp and keeps the
// scene's colour, so accent-coloured objects come through as coloured glyphs.
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { CanvasTexture, LinearFilter, Uniform } from 'three'
import { fonts } from '../styles/tokens'

const fragmentShader = /* glsl */ `
uniform sampler2D uGlyphs;
uniform float uCount;
uniform float uCell;
uniform float uSaturation;
uniform float uGain;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;
  vec2 cell = floor(px / uCell);
  vec2 cellUv = (cell + 0.5) * uCell / resolution;
  vec3 c = texture2D(inputBuffer, cellUv).rgb;

  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float idx = floor(clamp(l * uGain, 0.0, 0.999) * uCount);
  vec2 local = fract(px / uCell);
  float mask = texture2D(uGlyphs, vec2((idx + local.x) / uCount, local.y)).r;

  vec3 tint = mix(vec3(l), c, uSaturation) * uGain;
  outputColor = vec4(tint * mask, 1.0);
}
`

export const GLYPH_RAMP = ' .·:-=+*#%@'

export type AsciiOptions = {
  cellSize?: number
  saturation?: number
  gain?: number
  ramp?: string
}

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

export class AsciiEffect extends Effect {
  private atlas: CanvasTexture

  constructor({ cellSize = 9, saturation = 1, gain = 1.4, ramp = GLYPH_RAMP }: AsciiOptions = {}) {
    const canvas = document.createElement('canvas')
    drawAtlas(canvas, ramp)
    const atlas = new CanvasTexture(canvas)
    atlas.minFilter = LinearFilter
    atlas.magFilter = LinearFilter

    super('AsciiEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uGlyphs', new Uniform(atlas)],
        ['uCount', new Uniform(ramp.length)],
        ['uCell', new Uniform(cellSize)],
        ['uSaturation', new Uniform(saturation)],
        ['uGain', new Uniform(gain)],
      ]),
    })
    this.atlas = atlas

    // Redraw once Geist Mono has loaded; the first draw may use the fallback font.
    document.fonts?.load(`48px "${fonts.mono}"`).then(() => {
      drawAtlas(canvas, ramp)
      atlas.needsUpdate = true
    })
  }

  set cellSize(px: number) {
    this.uniforms.get('uCell')!.value = px
  }

  dispose() {
    this.atlas.dispose()
    super.dispose()
  }
}
