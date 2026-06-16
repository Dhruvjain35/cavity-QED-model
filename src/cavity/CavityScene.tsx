// Fabry–Pérot cavity-QED schematic for the optics regime — clean instrument look, consistent with the
// live dynamics view. Two mirrors, a cobalt standing-wave cavity mode whose brightness tracks the
// light–matter coupling g, and a single molecular emitter at the antinode, on a fading grid floor.
// Structural (not a live state); g drives the field strength so the coupling is legible at a glance.
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo } from "react";
import * as THREE from "three";

const HALF = 4.2;

// naphthalene (two fused hexagons), carbon coords in bond-length units; H on the outer carbons
const C = [
  [0, 0.5], [-0.866, 1], [-1.732, 0.5], [-1.732, -0.5], [-0.866, -1], [0, -0.5],
  [1.732, 0.5], [0.866, 1], [0.866, -1], [1.732, -0.5],
] as const;
const BONDS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 7], [7, 6], [6, 9], [9, 8], [8, 5]];
const OUTER = [1, 2, 3, 4, 6, 7, 8, 9];

function Bond({ a, b, r, color }: { a: THREE.Vector3; b: THREE.Vector3; r: number; color: string }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const l = dir.length();
    const p = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { pos: p, quat: q, len: l };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 12]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
    </mesh>
  );
}

function Naphthalene() {
  const S = 0.32;
  const carbons = useMemo(() => C.map(([x, y]) => new THREE.Vector3(x * S, y * S, 0)), []);
  const hydrogens = useMemo(
    () => OUTER.map((i) => { const c = carbons[i]!.clone(); return c.clone().add(c.clone().normalize().multiplyScalar(0.55)); }),
    [carbons],
  );
  return (
    <group rotation={[0.5, 0.4, 0.2]}>
      {carbons.map((c, i) => (
        <mesh key={`c${i}`} position={c} castShadow>
          <sphereGeometry args={[0.15, 24, 18]} />
          <meshStandardMaterial color="#c3ccda" roughness={0.45} metalness={0.1} />
        </mesh>
      ))}
      {hydrogens.map((h, i) => (
        <mesh key={`h${i}`} position={h} castShadow>
          <sphereGeometry args={[0.09, 18, 14]} />
          <meshStandardMaterial color="#e7ecf3" roughness={0.55} metalness={0} />
        </mesh>
      ))}
      {BONDS.map(([a, b], i) => <Bond key={`b${i}`} a={carbons[a]!} b={carbons[b]!} r={0.048} color="#8593aa" />)}
      {OUTER.map((ci, i) => <Bond key={`hb${i}`} a={carbons[ci]!} b={hydrogens[i]!} r={0.033} color="#aab4c5" />)}
      {/* transition-dipole arrow */}
      <group position={[0.2, 0.9, 0]}>
        <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.033, 0.033, 0.7, 10]} /><meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 0.78, 0]}><coneGeometry args={[0.1, 0.22, 12]} /><meshStandardMaterial color="#f8b84a" emissive="#f59e0b" emissiveIntensity={0.4} roughness={0.5} /></mesh>
      </group>
    </group>
  );
}

/** Cobalt cavity standing wave: a sin(qπx) line + faint mode tube, brightness rising with g. */
function Mode({ g }: { g: number }) {
  const amp = Math.min(1, 0.25 + 1.7 * Math.max(0, g));
  const line = useMemo(() => {
    const SEG = 120, Q = 5, geom = new THREE.BufferGeometry();
    const arr = new Float32Array((SEG + 1) * 3);
    for (let i = 0; i <= SEG; i++) {
      const x = -HALF + (2 * HALF * i) / SEG;
      arr[i * 3] = x; arr[i * 3 + 1] = Math.sin((Q * Math.PI * (x + HALF)) / (2 * HALF)); arr[i * 3 + 2] = 0;
    }
    geom.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geom;
  }, []);
  const color = useMemo(() => new THREE.Color("#13203a").lerp(new THREE.Color("#5b9bff"), amp), [amp]);
  return (
    <group>
      <primitive object={new THREE.Line(line, new THREE.LineBasicMaterial({ color, toneMapped: false }))} scale={[1, amp, 1]} />
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.3, 1.3, 2 * HALF, 40, 1, true]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.05 + 0.16 * amp} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Mirror({ side, g }: { side: 1 | -1; g: number }) {
  const amp = Math.min(1, 0.25 + 1.7 * Math.max(0, g));
  return (
    <group position={[side * (HALF + 0.25), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.9, 1.9, 0.34, 64]} />
        <meshStandardMaterial color="#3a4a63" metalness={0.55} roughness={0.32} emissive="#3b82f6" emissiveIntensity={0.15 + 1.2 * amp} />
      </mesh>
      <mesh position={[0, side * 0.18, 0]}>
        <torusGeometry args={[1.9, 0.05, 12, 80]} />
        <meshStandardMaterial color="#7f9bc4" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function CavityScene({ g }: { g: number }) {
  return (
    <div className="cav-stage">
      <div className="cav-tag cav-tag-l">mirror</div>
      <div className="cav-tag cav-tag-r">mirror</div>
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> cavity mode · field ∝ g</div>
      <div className="cav-tag cav-tag-mol">molecular emitter</div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [7.5, 4.4, 9.5], fov: 34 }}>
        <PerspectiveCamera makeDefault fov={34} position={[7.5, 4.4, 9.5]} />
        <ambientLight intensity={0.55} />
        <directionalLight castShadow intensity={0.9} position={[5, 8, 6]} shadow-mapSize={[1024, 1024]} />
        <pointLight position={[0, 0, 0]} intensity={2 + 12 * Math.min(1, Math.max(0, g) * 1.7)} distance={11} color="#5b9bff" />
        <Mirror side={-1} g={g} />
        <Mirror side={1} g={g} />
        <Mode g={g} />
        <Naphthalene />
        <Grid position={[0, -3.1, 0]} args={[26, 26]} cellSize={0.9} cellThickness={0.5} cellColor="#1c2942" sectionSize={4.5} sectionThickness={0.9} sectionColor="#2b3d5e" fadeDistance={30} fadeStrength={1.4} infiniteGrid />
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur radius={0.55} />
        </EffectComposer>
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={26} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
