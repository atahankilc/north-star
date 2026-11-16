// Full-screen living field behind every view (D-026, D-028). Forms come in overlapping
// "generations": each is born, drifts with the flow, grows denser (heavier glyphs in the
// ASCII pass), then fades while the next one rises elsewhere. Only the shared scene clock drives it,
// so every copy of the backdrop renders the same frame.
//
// The waves are in colour (D-386): a wave's hue follows the folds of the flow along one ribbon of the accents (cyan →
// blue → magenta → yellow → cyan), and now and then a wave stays white. The colour goes out in rgb, the glyph's weight
// in alpha, so a dark hue (blue, magenta) prints as heavy a glyph as a bright one. It starts as the flow: no welcome.
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, NoBlending, Vector2, type ShaderMaterial } from 'three'
import { useTheme } from '../state/theme'
import { palettes } from '../styles/tokens'
import { sceneTime } from './sceneClock'

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
uniform vec3 uStops[6];     // the accents as one ribbon of colour, the last the first again
uniform float uInk;         // how much heavier the glyphs print in this theme (INK below)

const float PI = 3.14159265;
const float LIFE = 9.0;        // seconds between births; each generation lives two of these

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

vec3 ribbon(float x) {
  x = fract(x) * 5.0;
  float k = floor(x), f = x - k;
  vec3 a = k < 0.5 ? uStops[0] : k < 1.5 ? uStops[1] : k < 2.5 ? uStops[2] : k < 3.5 ? uStops[3] : uStops[4];
  vec3 b = k < 0.5 ? uStops[1] : k < 1.5 ? uStops[2] : k < 2.5 ? uStops[3] : k < 3.5 ? uStops[4] : uStops[5];
  return mix(a, b, f);
}

// rgb: the wave's colour; a: its weight (how heavy a glyph it prints).
vec4 flow(vec2 p) {
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

  // Every wave in colour: the hue follows the flow's folds, and drifts slowly along the ribbon.
  vec3 hue = ribbon(0.18 + q.x * 1.1 + r.y * 0.9 + lum * 0.35 - t * 0.25);
  // Now and then a wave stays white (black ink in light): about one generation in three, never the first two, plus
  // a few small patches that move with the flow.
  float whiteOlder = step(hash(vec2(g, 3.7)), 0.3) * step(2.0, g);
  float whiteYounger = step(hash(vec2(g + 1.0, 3.7)), 0.3) * step(2.0, g + 1.0);
  float white = (whiteOlder * older + whiteYounger * younger) / (older + younger + 1e-4);
  white = max(white, smoothstep(0.7, 0.78, fbm(p * 1.6 + r * 2.0 + vec2(7.0, 3.0) + t * 0.3)));
  hue = mix(hue, vec3(1.0), white);

  return vec4(hue * (0.6 + 0.4 * lum), lum * mix(1.0, 0.8, white));
}

void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  vec4 wave = flow(p);

  // Keep the top band calm. The field runs all the way down: the landing's headline has its own scrim.
  float calm = smoothstep(1.0, 0.86, vUv.y);

  gl_FragColor = vec4(wave.rgb * calm, clamp(wave.a * calm * uInk, 0.0, 1.0));
}
`

// How much heavier the glyphs print, per theme (D-386). Light prints ink on paper, where a small glyph leaves most of
// the cell empty, so the same weight reads paler than a glyph lit on black: it gets more.
const INK = { dark: 1.4, light: 1.55 } // tokens-ok: brightness factors, not sizes or colours

// The ribbon's colours: the dark theme's bright accents in both themes. The ASCII pass darkens a hue itself when it
// prints it as ink, so light's darker accents would come out muddy.
const RIBBON = [palettes.dark.cyan, palettes.dark.blue, palettes.dark.magenta, palettes.dark.magenta, palettes.dark.yellow, palettes.dark.cyan]

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
      uStops: { value: RIBBON.map((c) => new Color(c)) },
      uInk: { value: 1 },
    }),
    [],
  )
  // Write through the material: R3F copies the uniforms prop, so the memo object isn't the live one.
  useFrame(() => {
    const u = material.current?.uniforms
    if (!u) return
    u.uTime.value = sceneTime()
    u.uInk.value = INK[theme]
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
        // Alpha carries the glyph's weight to the ASCII pass, not transparency.
        blending={NoBlending}
      />
    </mesh>
  )
}
