// Fabry–Pérot cavity-QED schematic for the optics regime (CATEGORY 2 rebuild) — same open-resonator
// language as the live view: two flat DBR mirror stacks, a TEM₀₀ standing-wave field rendered as flat
// cyan discs at the antinodes (brightness rising with the light–matter coupling g), and a single
// molecular emitter at the central antinode. Structural, not a live state. No cylinders, no chrome.
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { MutableRefObject, useRef } from "react";
import { CavityPost, DBRMirror, FieldStack, LightRig, STAGE_OFFSET, STAGE_SCALE, STAGE_TILT, W0 } from "./cavityKit";

// A single emitter at the cavity centre: dim maroon base, emissive red rising with the coupling g so the
// light–matter interaction strength is legible at a glance. Amber transition-dipole arrow alongside.
function Emitter({ g }: { g: number }) {
  const glow = Math.min(5, 0.5 + 3.4 * Math.min(1, Math.max(0, g) / 5));
  return (
    <group>
      <mesh renderOrder={10}>
        <icosahedronGeometry args={[13, 1]} />
        <meshStandardMaterial color="#3d1a52" emissive="#ff2222" emissiveIntensity={glow} roughness={0.4} metalness={0.1} toneMapped={false} transparent depthTest={false} depthWrite={false} />
      </mesh>
      <group position={[0, 0, 0]}>
        <mesh position={[0, 9, 0]}><cylinderGeometry args={[0.8, 0.8, 18, 12]} /><meshBasicMaterial color="#ffcc00" toneMapped={false} /></mesh>
        <mesh position={[0, 19, 0]}><coneGeometry args={[2.4, 6, 14]} /><meshBasicMaterial color="#ffe066" toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

// Decorative looping breath for the optics schematic: the optical cavity is steady-state (no time
// dynamics), so this is a slow, real-time sine envelope that makes the resonant mode pulse — purely
// cosmetic, NOT the TC P_photon(t). Slow (~0.14 Hz of phase) so it never approaches ω_c / aliasing.
function FieldBreath({ ampRef, g }: { ampRef: MutableRefObject<number>; g: number }) {
  useFrame((state) => {
    const base = Math.min(1, Math.max(0, g) / 5);                 // field strength ∝ coupling
    ampRef.current = base * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 0.9)));
  });
  return null;
}

export function CavityScene({ g }: { g: number }) {
  const fieldAmpRef = useRef(0);
  fieldAmpRef.current = Math.min(1, Math.max(0, g) / 5); // initial field strength ∝ coupling (FieldBreath animates it)
  return (
    <div className="cav-stage">
      <div className="cav-tag cav-tag-l">DBR mirror</div>
      <div className="cav-tag cav-tag-r">DBR mirror</div>
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> TEM₀₀ field · ∝ g</div>
      <div className="cav-tag cav-tag-mol">molecular emitter</div>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 40, 300], fov: 54 }}>
        <color attach="background" args={["#05070e"]} />
        <PerspectiveCamera makeDefault fov={54} position={[0, 40, 300]} />
        <LightRig />
        <FieldBreath ampRef={fieldAmpRef} g={g} />
        <group rotation={STAGE_TILT} scale={STAGE_SCALE} position={STAGE_OFFSET}>
          <DBRMirror side={-1} />
          <DBRMirror side={1} />
          <FieldStack ampRef={fieldAmpRef} opacityBase={0.15} />
          <Emitter g={g} />
          {/* polarization reference axis through the centre */}
          <mesh rotation={[0, 0, 0]} position={[0, 0, 0]} scale={[1, W0 * 1.1, 1]}>
            <cylinderGeometry args={[0.6, 0.6, 1, 10]} />
            <meshBasicMaterial color="#ffcc00" transparent opacity={0.5} toneMapped={false} />
          </mesh>
        </group>
        <CavityPost bloomIntensity={0.8} />
        <OrbitControls makeDefault enablePan={false} autoRotate={false} enableDamping dampingFactor={0.05} minDistance={150} maxDistance={600} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
