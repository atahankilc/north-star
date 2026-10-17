// Full-screen living field behind every view (D-026, D-028). Forms come in overlapping
// "generations": each is born, drifts with the flow, grows denser (brighter → heavier glyphs in the
// ASCII pass), then fades while the next one rises elsewhere. Only the shared scene clock drives it,
// so every copy of the backdrop renders the same frame.
//
// The first seconds after the app starts are a welcome (D-072): the sky slowly fills with stars while a red-orange
// glow spreads from the lower left like a sunrise, one star finally blazes brighter than the rest, then the stars go out
// and the sky melts into the usual flow.
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Vector2, type ShaderMaterial } from 'three'
import { useTheme } from '../state/theme'
import { palettes } from '../styles/tokens'
import { introTime, sceneTime } from './sceneClock'

const vertexShader = /* glsl */ `
varying vec2 vUv;
uniform vec2 uUvScale;
void main() {
  vUv = uv * uUvScale;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`

const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uAspect;
uniform vec3 uAccentA;
uniform vec3 uAccentB;
uniform vec3 uAccentC;
uniform vec3 uEmber;        // welcome: red-orange of the sky above the horizon
uniform vec3 uDawn;         // welcome: warmer orange right at the horizon
uniform float uLight;       // light theme (D-069): the ASCII pass prints brightness as ink
uniform float uIntro;       // seconds into the welcome; INTRO or more = plain flow

const float PI = 3.14159265;
const float LIFE = 9.0;        // seconds between births; each generation lives two of these
const float INTRO = 10.0;      // INTRO_SECONDS in sceneClock.ts

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = ROT * p * 2.03; a *= 0.5; }
  return v;
}

// One generation's strands, given the shared fluid warp. The seed moves it to fresh noise and
// gives it its own drift direction; age (0 → 2) shifts it along that direction as it lives.
float generation(vec2 p, vec2 r, float seed, float age) {
  vec2 dir = normalize(vec2(hash(vec2(seed, 1.3)) - 0.5, hash(vec2(seed, 7.9)) - 0.5) + 1e-3);
  vec2 off = vec2(seed * 17.31, seed * 9.17) + dir * age * 0.35;
  vec2 w = ROT * p + (r - 0.5) * 1.8 + off;
  float strands = fbm(vec2(w.x * 0.7 + age * 0.4, w.y * 8.0));
  float body = smoothstep(0.4, 0.7, fbm(w * vec2(0.6, 1.8) + 2.0 * r));
  float shape = smoothstep(0.38, 0.78, strands) * body;

  // Born → denser → fades: the envelope gates presence, the swell pushes brightness (glyph weight).
  float env = smoothstep(0.0, 0.55, age) * (1.0 - smoothstep(1.25, 2.0, age));
  float swell = 0.55 + 0.75 * sin(PI * clamp(age / 2.0, 0.0, 1.0));
  return shape * env * swell;
}

vec3 flow(vec2 p) {
  float t = uTime * 0.09;

  // Shared fluid: a warp that is itself warped, both evolving, so everything folds and curls.
  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, t)), fbm(p * 1.2 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 1.1 + 3.0 * q + vec2(1.7 + t * 0.6, 9.2)),
                fbm(p * 1.1 + 3.0 * q + vec2(8.3, 2.8 - t * 0.5)));

  // Two overlapping generations: the older one fading out, the younger one rising.
  float gen = uTime / LIFE;
  float g = floor(gen);
  float ph = fract(gen);
  float older = generation(p, r, g, ph + 1.0);
  float younger = generation(p, r, g + 1.0, ph);
  float lum = clamp(max(older, younger), 0.0, 1.0);

  // Accents: sparse streaks inside the bright parts, carried by the same flow.
  float pick = fbm(r * 2.0 + 11.0);
  vec3 accent = pick < 0.47 ? uAccentA : (pick < 0.53 ? uAccentB : uAccentC);
  float accentMask = smoothstep(0.6, 0.68, fbm(r * 3.0 + q - t)) * step(0.25, lum);

  vec3 col = mix(vec3(lum), accent * (0.4 + lum), accentMask);
  return col;
}

// --- Welcome (D-072). Times in seconds of the intro clock. -----------------------------------------------------

// As if the sun were just under the horizon, off to the lower left: pale gold at the bottom edge, then orange, then red,
// spreading wide along the bottom but staying low, in slow horizontal streaks of cloud. Rises and brightens over the intro.
// The ASCII target is 8-bit, so a pure red caps at a faint glyph; the gold core is what carries the brightness.
vec3 dawn(vec2 p, float y, float t) {
  float rise = smoothstep(0.4, 6.0, t);
  vec2 sun = vec2(-0.22 * uAspect.x, 0.0);
  float d = length(vec2((p.x - sun.x) * 0.2, y));           // squashed: it spreads sideways more than it climbs
  float streaks = 0.7 + 0.3 * fbm(vec2(p.x * 1.3 + t * 0.03, y * 20.0));
  float glow = exp(-d / (0.04 + 0.1 * rise)) * rise * streaks;
  glow *= 0.7 + 0.6 * hash(floor(gl_FragCoord.xy) + 91.0);   // per-cell dither, so the faint edge frays instead of cutting off
  vec3 hue = mix(uEmber, uDawn, exp(-d / 0.06));
  hue = mix(hue, vec3(1.0, 0.82, 0.42), exp(-d / 0.022));
  return hue * min(glow * (uLight > 0.5 ? 2.2 : 1.5), 1.0); // printed on paper it needs more ink to read as strongly
}

vec3 welcome(vec2 p, float y, float t, float cell) {
  vec2 id = floor(gl_FragCoord.xy); // one texel per ASCII cell

  // Stars fill the sky slowly, few at first and then faster; each goes out at its own moment near the end.
  // The glow near the horizon washes the faint ones out.
  float h = hash(id), hOn = hash(id + 17.0), hOff = hash(id + 41.0), hLum = hash(id + 73.0);
  float on = smoothstep(0.0, 0.35, t - (0.2 + 4.2 * pow(hOn, 0.75)));
  float off = 1.0 - smoothstep(0.0, 0.5, t - (5.4 + hOff * 2.6));
  float twinkle = 0.72 + 0.28 * sin(t * (1.5 + hOff * 3.0) + hOn * 40.0);
  float sky = smoothstep(0.08, 0.3, y);
  float stars = step(0.966, h) * (0.2 + 0.75 * hLum * hLum * hLum) * on * off * twinkle * sky;

  vec3 col = vec3(stars);

  // Last, one star far brighter than the rest: cross rays, short diagonal ones, a halo.
  vec2 polaris = vec2(min(0.22 * uAspect.x, 0.5 * uAspect.x - 0.12), 0.17);
  float bloom = smoothstep(4.2, 5.0, t);
  float flash = bloom * exp(-max(t - 5.0, 0.0) * 1.2);
  vec2 d = p - polaris, ad = abs(d);
  vec2 dr = abs(mat2(0.7071, -0.7071, 0.7071, 0.7071) * d);
  float reach = 0.03 + 0.2 * bloom + 0.12 * flash;
  float rays = exp(-ad.x / (cell * 0.7)) * exp(-ad.y / reach) + exp(-ad.y / (cell * 0.7)) * exp(-ad.x / (reach * 0.8));
  float diag = exp(-dr.x / (cell * 0.6)) * exp(-dr.y / (reach * 0.3)) + exp(-dr.y / (cell * 0.6)) * exp(-dr.x / (reach * 0.3));
  float core = 1.0 - smoothstep(0.8, 2.2, length(d) / cell);
  float halo = exp(-length(d) / (0.025 + 0.03 * flash));
  float north = (core + 0.8 * rays + 0.45 * diag + 0.3 * halo) * bloom * (0.92 + 0.08 * sin(t * 4.0));
  north *= 1.0 - smoothstep(7.0, 9.0, t);
  return col + min(north, 1.0) * mix(vec3(1.0), uAccentC, 0.35 * (1.0 - core));
}

void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  vec3 col = flow(p);

  // Keep the HUD band (top) and headline band (bottom) calm.
  float calm = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  col *= calm;

  if (uIntro < INTRO) {
    // The night sky melts slowly into the flow, which has been running underneath all along. The dawn starts at the
    // very bottom edge, so it skips the bottom calm band (the headline keeps its own scrim).
    float cell = abs(dFdy(p.y));
    vec3 sky = welcome(p, vUv.y, uIntro, cell) * calm + dawn(p, vUv.y, uIntro) * smoothstep(1.0, 0.86, vUv.y);
    col = mix(sky, col, smoothstep(6.2, 9.8, uIntro));
  }

  gl_FragColor = vec4(col, 1.0);
}
`

// Rendered at one texel per ASCII cell (D-063); `uvScale` maps those texels back to screen UVs.
export function AmbientField({ uvScale }: { uvScale: Vector2 }) {
  const size = useThree((s) => s.size)
  const material = useRef<ShaderMaterial>(null)
  const theme = useTheme((s) => s.theme)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uUvScale: { value: new Vector2(1, 1) },
      uAspect: { value: new Vector2(1, 1) },
      uAccentA: { value: new Color() },
      uAccentB: { value: new Color() },
      uAccentC: { value: new Color() },
      uEmber: { value: new Color() },
      uDawn: { value: new Color() },
      uLight: { value: 0 },
      uIntro: { value: 0 },
    }),
    [],
  )
  const accents = useMemo(() => {
    const p = palettes[theme]
    return [new Color(p.magenta), new Color(p.yellow), new Color(p.cyan), new Color(p.ember), new Color(p.dawn)]
  }, [theme])

  // Write through the material: R3F copies the uniforms prop, so the memo object isn't the live one.
  useFrame(() => {
    const u = material.current?.uniforms
    if (!u) return
    u.uTime.value = sceneTime()
    u.uIntro.value = introTime()
    u.uLight.value = theme === 'light' ? 1 : 0
    u.uAccentA.value.copy(accents[0])
    u.uAccentB.value.copy(accents[1])
    u.uAccentC.value.copy(accents[2])
    u.uEmber.value.copy(accents[3])
    u.uDawn.value.copy(accents[4])
    u.uUvScale.value.copy(uvScale)
    u.uAspect.value.set(size.width / size.height, 1)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
