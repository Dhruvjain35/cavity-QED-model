// Shared building blocks for the rebuilt cavity views (CATEGORY 2). Both the live DYNAMICS scene and the
// CAVITY schematic are open Fabry–Pérot resonators: two flat distributed-Bragg-reflector (DBR) mirror
// stacks facing each other across empty space, a TEM₀₀ standing-wave field rendered as flat discs pinned
// at the field antinodes (radius following the Gaussian beam w(z)), an exact light rig and a surgical
// post chain. No cylinders, no chrome, no HDRI, everything reads as a real optics-bench resonator.
import { MutableRefObject, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ── cavity geometry (world units) ──────────────────────────────────────────────────────────────────
export const HALF = 100;            // cavity half-length along the (local) z axis; mirrors at z = ±HALF
export const LENGTH = 2 * HALF;     // full cavity length L
export const W0 = 18;               // TEM₀₀ field waist (1/e radius) at the cavity centre z = 0
export const ZR = HALF * 0.6;       // Rayleigh range, beam radius w(z)=w0·√(1+(z/zR)²)
export const MIRROR_R = 90;         // DBR disc radius (aperture)
export const N_ANTINODES = 5;       // standing-wave order q, number of field antinodes between mirrors

// presentation transform: the cavity axis is local z; spin it nearly 90° about y so it runs left↔right
// (a PROFILE / side view), the camera at [0,55,340] then sees both DBR stacks edge-on as dark rings,
// the Gaussian field discs as a stack of vertical bars whose heights trace the beam waist (hourglass),
// and the molecules in the open gap. A small offset from 90° keeps the discs as thin ellipses, not lines.
export const STAGE_TILT: [number, number, number] = [0.18, 1.52, 0];
export const STAGE_SCALE = 1.0;
export const STAGE_OFFSET: [number, number, number] = [0, 0, 0];

/** Gaussian beam radius w(z) = w0·√(1 + (|z|/zR)²). Even in z by construction (the square already makes
 *  it sign-independent, Math.abs is explicit so the symmetry can't be misread): w(−z) ≡ w(+z). */
export const beamRadius = (z: number) => W0 * Math.sqrt(1 + (Math.abs(z) / ZR) ** 2);

/** Antinode z-positions of the q-th standing wave: z_j = −HALF + (2j+1)·HALF/q, j = 0…q−1. */
export function antinodes(): number[] {
  const out: number[] = [];
  for (let j = 0; j < N_ANTINODES; j++) out.push(-HALF + ((2 * j + 1) * HALF) / N_ANTINODES);
  return out;
}

// ── DBR mirror: a THIN flat Bragg stack, N_PAIRS very-thin dielectric disc layers (1.5 units each)
// stacked face-to-face along the optical axis with zero gap, total ≈6 units against a ~200-unit cavity
// gap. A real DBR reads as a thin layered disc, not a fat ribbed drum: keeping the layers thin means the
// camera sees the flat face with subtle two-tone banding, never a tall ribbed sidewall. Slight metalness
// gives a faint specular sheen from the LightRig (no emissive). Flat faces ⟂ the cavity (z) axis.
const N_PAIRS = 4, LAYER_T = 1.7, DBR_R = 95;
// Real DBRs are highly reflective dielectric stacks, render them as polished steel-blue layers (high
// metalness, low roughness) with a faint emissive floor so they never sink to pure black against the dark
// stage, and a bright cavity-facing aperture rim so each mirror is unmistakably outlined.
const MAT_A = { color: "#46598c", roughness: 0.26, metalness: 0.78 } as const; // "high index" layer
const MAT_B = { color: "#6f86bd", roughness: 0.22, metalness: 0.7 } as const;  // "low index" layer
const MIRROR_EMISSIVE = "#14233f";

export function DBRMirror({ side }: { side: 1 | -1 }) {
  return (
    <group>
      {Array.from({ length: N_PAIRS }, (_, d) => {
        const z = side * (HALF + LAYER_T / 2 + d * LAYER_T); // innermost face at z = ±HALF, stacked outward, zero gap
        const m = d % 2 === 0 ? MAT_A : MAT_B;
        return (
          <mesh key={d} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[DBR_R, DBR_R, LAYER_T, 96]} />
            <meshStandardMaterial color={m.color} roughness={m.roughness} metalness={m.metalness} emissive={MIRROR_EMISSIVE} emissiveIntensity={0.7} />
          </mesh>
        );
      })}
      {/* bright aperture rim on the cavity-facing face, outlines the mirror clearly in the profile view */}
      <mesh position={[0, 0, side * (HALF - 0.4)]}>
        <ringGeometry args={[DBR_R * 0.9, DBR_R, 96]} />
        <meshBasicMaterial color="#a9ccff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── TEM₀₀ field: per antinode TWO concentric cyan discs, a fainter outer disc at the Gaussian radius
// w(z)·2.2 (opacity ×0.4) and a brighter inner disc at 40% of that radius (opacity ×1.0). Stacking them
// fakes the e^{−2r²/w²} intensity fall-off (bright core → transparent rim) without a custom shader, so
// the discs read as glowing mode cross-sections, not uniform poker chips. Opacity = 0.15 + 0.7·P_photon.
export function FieldStack({ ampRef, opacityBase = 0.15, visible = true }: { ampRef: MutableRefObject<number>; opacityBase?: number; visible?: boolean }) {
  const discs = useMemo(() => antinodes().map((z) => { const r = beamRadius(z) * 2.2; return { z, rOuter: r, rInner: r * 0.4 }; }), []);
  const outerMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const innerMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    const amp = Math.max(0, Math.min(1, ampRef.current));
    const op = Math.min(0.95, opacityBase + 0.7 * amp);
    for (let i = 0; i < discs.length; i++) { const o = outerMats.current[i], inn = innerMats.current[i]; if (o) o.opacity = op * 0.4; if (inn) inn.opacity = op; }
  });
  if (!visible) return null;
  return (
    <group>
      {discs.map((d, i) => (
        <group key={i} position={[0, 0, d.z]}>
          <mesh>
            <circleGeometry args={[d.rOuter, 56]} />
            <meshBasicMaterial ref={(el) => { outerMats.current[i] = el; }} color="#00ffff" transparent opacity={opacityBase * 0.4} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh>
            <circleGeometry args={[d.rInner, 48]} />
            <meshBasicMaterial ref={(el) => { innerMats.current[i] = el; }} color="#00ffff" transparent opacity={opacityBase} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── exact light rig (CATEGORY 2.E), no Environment / HDRI / shadows ──────────────────────────────────
export function LightRig() {
  return (
    <>
      <ambientLight intensity={0.26} />
      <directionalLight intensity={1.5} position={[3, 5, 3]} color="#ffffff" />
      <directionalLight intensity={0.5} position={[-2, -1, -3]} color="#7fa0ff" />
      <directionalLight intensity={0.7} position={[0, 2, 6]} color="#cdddff" />{/* fill aimed at the mirror faces so they catch light */}
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#00ffff" distance={200} decay={2} />
    </>
  );
}

// ── surgical post chain (CATEGORY 2.F) ────────────────────────────────────────────────────────────────
export function CavityPost({ bloomIntensity = 0.6 }: { bloomIntensity?: number }) {
  const ca = useMemo(() => new THREE.Vector2(0.0004, 0.0004), []);
  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.92} luminanceSmoothing={0.4} intensity={bloomIntensity} radius={0.5} mipmapBlur />
      <ChromaticAberration offset={ca} radialModulation={false} modulationOffset={0} />
      <Vignette eskil={false} offset={0.3} darkness={0.45} />
    </EffectComposer>
  );
}
