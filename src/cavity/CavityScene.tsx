// Polariton-cavity hero — grounded in the Chem Rev TOC render (acs.chemrev.2c00855): glossy teal
// mirrors with cyan rims, a glowing magenta→peach hourglass cavity mode (emissive + bloom), a
// ball-and-stick naphthalene molecule with a transition-dipole arrow at the waist, magenta key
// light, purple gradient backdrop, and the |Ψ⟩ / Ĥ equations overlaid. Real-time React-Three-Fiber.
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo } from "react";
import * as THREE from "three";

// naphthalene (two fused hexagons), carbon coords in bond-length units; H added on outer carbons
const C = [
  [0, 0.5], [-0.866, 1], [-1.732, 0.5], [-1.732, -0.5], [-0.866, -1], [0, -0.5],
  [1.732, 0.5], [0.866, 1], [0.866, -1], [1.732, -0.5],
] as const;
const BONDS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 7], [7, 6], [6, 9], [9, 8], [8, 5]];
const OUTER = [1, 2, 3, 4, 6, 7, 8, 9]; // carbons that carry an H

function Bond({ a, b, r, color }: { a: THREE.Vector3; b: THREE.Vector3; r: number; color: string }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const pos = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { pos, quat, len };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 12]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

function Naphthalene() {
  const S = 0.34; // scale to ~1.1 units across
  const carbons = useMemo(() => C.map(([x, y]) => new THREE.Vector3(x * S, y * S, 0)), []);
  const hydrogens = useMemo(
    () => OUTER.map((i) => { const c = carbons[i]!.clone(); return c.clone().add(c.clone().normalize().multiplyScalar(0.55)); }),
    [carbons],
  );
  return (
    <group rotation={[0.5, 0.4, 0.2]}>
      {carbons.map((c, i) => (
        <mesh key={`c${i}`} position={c} castShadow>
          <sphereGeometry args={[0.16, 24, 18]} />
          <meshStandardMaterial color="#8d8d92" roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
      {hydrogens.map((h, i) => (
        <mesh key={`h${i}`} position={h} castShadow>
          <sphereGeometry args={[0.095, 18, 14]} />
          <meshStandardMaterial color="#eef0f3" roughness={0.55} metalness={0} />
        </mesh>
      ))}
      {BONDS.map(([a, b], i) => <Bond key={`b${i}`} a={carbons[a]!} b={carbons[b]!} r={0.05} color="#9a9aa0" />)}
      {OUTER.map((ci, i) => <Bond key={`hb${i}`} a={carbons[ci]!} b={hydrogens[i]!} r={0.035} color="#c8cace" />)}
      {/* transition-dipole arrow */}
      <group position={[0.2, 0.9, 0]}>
        <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.035, 0.035, 0.7, 10]} /><meshStandardMaterial color="#f4f4f6" emissive="#888" emissiveIntensity={0.2} roughness={0.5} /></mesh>
        <mesh position={[0, 0.78, 0]}><coneGeometry args={[0.1, 0.22, 12]} /><meshStandardMaterial color="#f4f4f6" roughness={0.5} /></mesh>
      </group>
    </group>
  );
}

/** Glowing magenta→peach hourglass cavity mode (TEM00 envelope), emissive so bloom makes it glow. */
function Mode({ g }: { g: number }) {
  const geom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 44; i++) { const s = -3 + (6 * i) / 44; pts.push(new THREE.Vector2(0.3 + 1.12 * (s / 3) ** 2, s)); }
    return new THREE.LatheGeometry(pts, 56);
  }, []);
  return (
    <mesh geometry={geom} rotation={[0, 0, Math.PI / 2]}>
      <meshStandardMaterial color="#3a0a2a" emissive="#ff3da0" emissiveIntensity={1.1 + 0.55 * Math.min(Math.max(g, 0), 5)} roughness={0.4} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/** Glossy teal mirror: bright cyan rim torus + a slightly domed inner face lit magenta from the mode. */
function Mirror({ side }: { side: 1 | -1 }) {
  const x = side * 3;
  return (
    <group position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow><torusGeometry args={[1.62, 0.13, 18, 90]} /><meshStandardMaterial color="#18c4d6" roughness={0.18} metalness={0.4} /></mesh>
      <mesh scale={[1, 1, 0.32]} position={[0, 0, side * 0.18]}>
        <sphereGeometry args={[1.6, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cfe7ee" roughness={0.22} metalness={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -side * 0.55]}><cylinderGeometry args={[1.62, 1.62, 0.5, 56]} /><meshStandardMaterial color="#2b6f80" roughness={0.4} metalness={0.2} /></mesh>
    </group>
  );
}

export function CavityScene({ g }: { g: number }) {
  return (
    <div className="cav-stage">
      <div className="cav-eq cav-eq-top">|Ψ⟩ = Σ<sub>n</sub>Σ<sub>I</sub> C<sub>I,n</sub>|Φ<sub>I</sub><sup>e</sup>⟩ ⊗ |n<sup>p</sup>⟩</div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [9, 4.5, 13], fov: 32 }}>
        <PerspectiveCamera makeDefault fov={32} position={[9, 4.5, 13]} />
        <ambientLight intensity={0.35} />
        <directionalLight castShadow intensity={1.1} position={[6, 9, 7]} shadow-mapSize={[2048, 2048]} />
        <pointLight position={[0, 0, 0]} intensity={9} distance={9} color="#ff4da6" />
        <Mirror side={-1} />
        <Mirror side={1} />
        <Mode g={g} />
        <Naphthalene />
        <EffectComposer>
          <Bloom intensity={1.15} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
        </EffectComposer>
        <OrbitControls makeDefault autoRotate={false} enablePan={false} minDistance={6} maxDistance={40} target={[0, 0, 0]} />
      </Canvas>
      <div className="cav-eq cav-eq-bot">Ĥ = Ĥ<sub>el</sub> + ω<sub>cav</sub> b̂†b̂ − √(ω<sub>cav</sub>/2) [λ·(μ̂−⟨μ̂⟩)](b̂†+b̂) + ½[λ·(μ̂−⟨μ̂⟩)]²</div>
    </div>
  );
}
