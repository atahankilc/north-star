// Full-screen flowing noise ribbons, the "atmosphere" behind every view.
// Mostly grey, with rare accent streaks (docs/DESIGN.md §1, references/).
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, ShaderMaterial, Vector2 } from 'three'
import { colors } from '../styles/tokens'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`

const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uAspect;
uniform vec2 uPointer;
uniform vec3 uAccentA;
uniform vec3 uAccentB;
uniform vec3 uAccentC;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  float t = uTime * 0.04;

  // Pointer gently bends the field.
  vec2 d = p - uPointer * uAspect * 0.5;
  p += normalize(d + 1e-4) * 0.08 * exp(-dot(d, d) * 6.0);

  // Domain-warp, then stretch the noise along a diagonal so it reads as hair-like
  // strands sweeping across the screen, like the Enosta reference.
  vec2 q = vec2(fbm(p * 1.1 + t), fbm(p * 1.1 - t + 4.7));
  vec2 w = mat2(0.8, -0.6, 0.6, 0.8) * p + (q - 0.5) * 1.4;
  float strands = fbm(vec2(w.x * 0.7 + t * 1.5, w.y * 9.0));
  float body = smoothstep(0.35, 0.65, fbm(w * vec2(0.6, 1.8) + 3.0 - t));
  float ribbon = smoothstep(0.4, 0.8, strands) * body;
  // Keep the nav band (top) and headline band (bottom) calm.
  ribbon *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  float lum = pow(ribbon, 1.2);

  // Accents: sparse streaks living inside the bright strands only.
  float pick = fbm(p * 0.6 + vec2(-t * 0.5, t * 0.3) + 11.0);
  vec3 accent = pick < 0.47 ? uAccentA : (pick < 0.53 ? uAccentB : uAccentC);
  float accentMask = smoothstep(0.58, 0.66, fbm(vec2(w.x * 1.5 - t, w.y * 5.0) + 7.0)) * step(0.2, ribbon);

  vec3 col = mix(vec3(lum), accent * (0.4 + lum), accentMask);
  gl_FragColor = vec4(col, 1.0);
}
`

export function AmbientField({ animate = true }: { animate?: boolean }) {
  const ref = useRef<ShaderMaterial>(null)
  const size = useThree((s) => s.size)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: new Vector2(1, 1) },
      uPointer: { value: new Vector2(0, 0) },
      uAccentA: { value: new Color(colors.magenta) },
      uAccentB: { value: new Color(colors.yellow) },
      uAccentC: { value: new Color(colors.cyan) },
    }),
    [],
  )

  useFrame((state, delta) => {
    const u = uniforms
    if (animate) u.uTime.value += delta
    u.uAspect.value.set(size.width / size.height, 1)
    // Ease the pointer so the bend trails the cursor.
    u.uPointer.value.lerp(state.pointer, Math.min(1, delta * 2))
  })

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={ref}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
