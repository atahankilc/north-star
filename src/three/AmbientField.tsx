// Full-screen living field behind every view (D-026, D-028). Forms come in overlapping
// "generations": each is born, drifts with the flow, grows denser (brighter → heavier glyphs in the
// ASCII pass), then fades while the next one rises elsewhere. Only the shared scene clock drives it,
// so every copy of the backdrop renders the same frame.
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Vector2, type ShaderMaterial } from 'three'
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
uniform vec3 uAccentA;
uniform vec3 uAccentB;
uniform vec3 uAccentC;

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

void main() {
  vec2 p = (vUv - 0.5) * uAspect;
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
  float lum = max(older, younger);

  // Keep the HUD band (top) and headline band (bottom) calm.
  lum *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  lum = clamp(lum, 0.0, 1.0);

  // Accents: sparse streaks inside the bright parts, carried by the same flow.
  float pick = fbm(r * 2.0 + 11.0);
  vec3 accent = pick < 0.47 ? uAccentA : (pick < 0.53 ? uAccentB : uAccentC);
  float accentMask = smoothstep(0.6, 0.68, fbm(r * 3.0 + q - t)) * step(0.25, lum);

  vec3 col = mix(vec3(lum), accent * (0.4 + lum), accentMask);
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
    }),
    [],
  )
  const accents = useMemo(() => {
    const p = palettes[theme]
    return [new Color(p.magenta), new Color(p.yellow), new Color(p.cyan)]
  }, [theme])

  // Write through the material: R3F copies the uniforms prop, so the memo object isn't the live one.
  useFrame(() => {
    const u = material.current?.uniforms
    if (!u) return
    u.uTime.value = sceneTime()
    u.uAccentA.value.copy(accents[0])
    u.uAccentB.value.copy(accents[1])
    u.uAccentC.value.copy(accents[2])
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
