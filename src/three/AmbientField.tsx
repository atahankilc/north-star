// Full-screen living field behind every view (D-026, D-028). Forms come in overlapping
// "generations": each is born, drifts with the flow, grows denser (heavier glyphs in the
// ASCII pass), then fades while the next one rises elsewhere. Only the shared scene clock drives it,
// so every copy of the backdrop renders the same frame.
//
// The waves are in colour (D-386): a wave's hue follows the folds of the flow along one ribbon of the accents (cyan →
// blue → magenta → yellow → cyan), and now and then a wave stays white. The colour goes out in rgb, the glyph's weight
// in alpha, so a dark hue (blue, magenta) prints as heavy a glyph as a bright one. It starts as the flow: no welcome.
import { FIELD_GLSL } from '@atem-lab/kit/field.js'
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
uniform vec3 uTint;
uniform float uTintMix;

// The field itself (the strands, their generations, the colour ribbon, flow(p)) is the kit's one source, shared
// with atem-lab.com (@atem-lab/kit field.js); uTint stays white, uTintMix 0: the app never leans the field.
${FIELD_GLSL}

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
      uTint: { value: new Color() },
      uTintMix: { value: 0 },
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
