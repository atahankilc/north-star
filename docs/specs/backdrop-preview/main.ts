// Preview only (not built, not imported by the app): the landing's backdrop in three looks, moving, on the app's real
// ASCII pass (a copy of src/three/AsciiEffect.ts with one change, see AsciiEffectPreview.ts). `today` is AmbientField's flow as it is (without the welcome); the two
// coloured looks fill the whole field with the accents as one ribbon of colour.
import { Color, Mesh, NoBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer } from 'three'
import '../../../src/styles/global.css'
import { AsciiEffect } from './AsciiEffectPreview'
import { palettes } from '../../../src/styles/tokens'

const vertexShader = /* glsl */ `
varying vec2 vUv;
uniform vec2 uUvScale;
void main() { vUv = uv * uUvScale; gl_Position = vec4(position.xy, 0.999, 1.0); }
`
const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uAspect;
uniform vec3 uAccentA; uniform vec3 uAccentB; uniform vec3 uAccentC;
uniform vec3 uStops[6];
uniform float uLook;    // 0 today · 1 coloured · 2 coloured, calmer · 3 today's waves in colour
uniform float uInk;     // how much heavier the glyphs print in this theme, so light and dark read equally strong
const float PI = 3.14159265;
const float LIFE = 9.0;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = ROT * p * 2.03; a *= 0.5; } return v; }
float generation(vec2 p, vec2 r, float seed, float age) {
  vec2 dir = normalize(vec2(hash(vec2(seed, 1.3)) - 0.5, hash(vec2(seed, 7.9)) - 0.5) + 1e-3);
  vec2 off = vec2(seed * 17.31, seed * 9.17) + dir * age * 0.35;
  vec2 w = ROT * p + (r - 0.5) * 1.8 + off;
  float strands = fbm(vec2(w.x * 0.7 + age * 0.4, w.y * 8.0));
  float body = smoothstep(0.4, 0.7, fbm(w * vec2(0.6, 1.8) + 2.0 * r));
  float shape = smoothstep(0.38, 0.78, strands) * body;
  float env = smoothstep(0.0, 0.55, age) * (1.0 - smoothstep(1.25, 2.0, age));
  float swell = 0.55 + 0.75 * sin(PI * clamp(age / 2.0, 0.0, 1.0));
  return shape * env * swell;
}
vec3 ribbon(float x) {
  x = fract(x) * 5.0; float k = floor(x), f = x - k;
  vec3 a = k < 0.5 ? uStops[0] : k < 1.5 ? uStops[1] : k < 2.5 ? uStops[2] : k < 3.5 ? uStops[3] : uStops[4];
  vec3 b = k < 0.5 ? uStops[1] : k < 1.5 ? uStops[2] : k < 2.5 ? uStops[3] : k < 3.5 ? uStops[4] : uStops[5];
  return mix(a, b, f);
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  float t = uTime * 0.09;
  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, t)), fbm(p * 1.2 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 1.1 + 3.0 * q + vec2(1.7 + t * 0.6, 9.2)), fbm(p * 1.1 + 3.0 * q + vec2(8.3, 2.8 - t * 0.5)));
  vec3 col; float weight = 1.0;
  if (uLook < 0.5 || uLook > 2.5) {
    float gen = uTime / LIFE, g = floor(gen), ph = fract(gen);
    float lum = clamp(max(generation(p, r, g, ph + 1.0), generation(p, r, g + 1.0, ph)), 0.0, 1.0);
    float pick = fbm(r * 2.0 + 11.0);
    vec3 accent = pick < 0.47 ? uAccentA : (pick < 0.53 ? uAccentB : uAccentC);
    float accentMask = smoothstep(0.6, 0.68, fbm(r * 3.0 + q - t)) * step(0.25, lum);
    col = mix(vec3(lum), accent * (0.4 + lum), accentMask);
    if (uLook > 2.5) {
      // today's sea, the same waves born and fading, but every wave in colour: the hue follows the flow's folds
      vec3 hue = ribbon(0.18 + q.x * 1.1 + r.y * 0.9 + lum * 0.35 - t * 0.25);
      // now and then a wave stays white, as today's are (black ink in light): about a third of them
      float white = smoothstep(0.55, 0.63, fbm(p * 0.9 + r * 2.0 + vec2(7.0, 3.0) + t * 0.3));
      hue = mix(hue, vec3(1.0), white);
      col = hue * (0.6 + 0.4 * lum); weight = lum * mix(1.0, 0.8, white);
    }
  } else {
    // The same fluid, everywhere: soft ribbons with bright crests, coloured by where the flow has folded.
    float f = fbm(p * 1.3 + 2.4 * r) / 0.9375;
    float band = 0.5 + 0.5 * sin(f * 21.0 + r.x * 6.0 - t * 4.0);
    float body = smoothstep(0.34, 0.62, f * 0.7 + 0.9 * abs(r.x - r.y) + 0.2);
    float lum = 0.16 + 0.84 * body * (0.5 + 0.5 * band * band);
    vec3 hue = ribbon(0.18 + q.x * 1.1 + r.y * 0.9 + f * 0.5 - t * 0.25);
    if (uLook > 1.5) { lum *= 0.55; hue = mix(vec3(dot(hue, vec3(0.2126, 0.7152, 0.0722))), hue, 0.7); }
    // colour and weight apart: the hue stays bright, the glyph's weight follows the flow
    col = hue * (0.6 + 0.4 * lum); weight = lum;
  }
  float top = smoothstep(1.0, 0.86, vUv.y); // the top band stays calm, as in the app
  col *= top; weight *= top;
  // the name's corner and the sign-in stay readable on a full field
  if (uLook > 0.5 && uLook < 2.5) weight *= 1.0 - 0.6 * (1.0 - smoothstep(0.1, 0.34, vUv.y));
  if (uLook > 0.5) weight = clamp(weight * uInk, 0.0, 1.0);
  gl_FragColor = vec4(col, weight);
}
`

const LOOKS = [
  { id: 'today', name: '1 · today', says: 'the flow as it is now: grey, a few accent streaks' },
  { id: 'colour', name: '2 · coloured', says: 'the whole field in cyan, blue, magenta, a little yellow' },
  { id: 'calm', name: '3 · coloured, calmer', says: 'the same colours at half strength, a little greyer' },
  { id: 'waves', name: "4 · today's sea, coloured", says: 'waves that come and go as today, most in colour, some white' },
] as const
const THEMES = [
  { id: 'dark', name: 'dark', says: 'the default theme' },
  { id: 'light', name: 'light', says: 'glyphs printed as ink on paper' },
] as const

const INK_LIGHT = 1.55
const INK_DARK = 1.4
const params = new URLSearchParams(location.search)
let look = Math.max(0, LOOKS.findIndex((l) => l.id === params.get('look')))
let theme: 'dark' | 'light' = params.get('theme') === 'light' ? 'light' : 'dark'

const canvas = document.getElementById('gl') as HTMLCanvasElement
const gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' })
gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
const effect = new AsciiEffect({ cellSize: 9 })
const scene = new Scene()
const camera = new OrthographicCamera()
const bright = palettes.dark // the ASCII pass darkens the hue itself when it prints, so the bright accents in both themes
const stops = [bright.cyan, bright.blue, bright.magenta, bright.magenta, bright.yellow, bright.cyan].map((c) => new Color(c))
const material = new ShaderMaterial({
  vertexShader,
  fragmentShader,
  depthTest: false,
  depthWrite: false,
  blending: NoBlending, // alpha carries the glyph's weight, not transparency
  uniforms: {
    uTime: { value: 0 },
    uUvScale: { value: new Vector2(1, 1) },
    uAspect: { value: new Vector2(1, 1) },
    uAccentA: { value: new Color() },
    uAccentB: { value: new Color() },
    uAccentC: { value: new Color() },
    uStops: { value: stops },
    uLook: { value: 0 },
    uInk: { value: 1 },
  },
})
const mesh = new Mesh(new PlaneGeometry(2, 2), material)
mesh.frustumCulled = false
scene.add(mesh)

function apply() {
  document.documentElement.dataset.theme = theme
  const p = palettes[theme]
  effect.setTheme(theme === 'light', p.bg, p.night, p.dusk)
  material.uniforms.uAccentA.value.set(p.magenta)
  material.uniforms.uAccentB.value.set(p.yellow)
  material.uniforms.uAccentC.value.set(p.cyan)
  material.uniforms.uLook.value = look
  // Light prints ink on paper, dark lights glyphs on black: the same weight reads much paler printed, so light gets more.
  material.uniforms.uInk.value = theme === 'light' ? INK_LIGHT : INK_DARK
  effect.setWeightFromAlpha(look > 0)
  history.replaceState(null, '', `?look=${LOOKS[look].id}&theme=${theme}`)
  const host = document.getElementById('opts')!
  host.replaceChildren()
  const btn = (name: string, says: string, on: boolean, pick: () => void, key: string) => {
    const b = document.createElement('button')
    b.setAttribute('aria-pressed', String(on))
    b.dataset.opt = key
    b.innerHTML = `<b>${name}</b>${says}`
    b.onclick = () => { pick(); apply() }
    host.append(b)
  }
  LOOKS.forEach((l, i) => btn(l.name, l.says, i === look, () => (look = i), l.id))
  const sep = document.createElement('div')
  sep.className = 'sep'
  host.append(sep)
  THEMES.forEach((t) => btn(t.name, t.says, t.id === theme, () => (theme = t.id), t.id))
}
addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '4') { look = Number(e.key) - 1; apply() }
  if (e.key === 'l' || e.key === 'd') { theme = e.key === 'l' ? 'light' : 'dark'; apply() }
})

function size() {
  gl.setSize(innerWidth, innerHeight, false)
}
addEventListener('resize', size)
size()
apply()

const start = performance.now()
let last = 0
function frame(now: number) {
  requestAnimationFrame(frame)
  if (now - last < 33) return // 30 fps, as the app (D-063)
  last = now
  effect.resize(gl)
  material.uniforms.uTime.value = 40 + (now - start) / 1000
  material.uniforms.uUvScale.value.copy(effect.uvScale)
  material.uniforms.uAspect.value.set(innerWidth / innerHeight, 1)
  effect.render(gl, scene, camera)
}
requestAnimationFrame(frame)
;(window as unknown as { __look: () => number }).__look = () => material.uniforms.uLook.value
