// Live single-excitation cavity-QED view — this is the SIMULATION, not a render. It reads the same
// arrowhead eigen-modes (dynState) and clock (simT) the 2D heat map uses, reconstructs ψ(t) =
// Σ_k c_k e^{−iE_k t} φ_k every frame, and paints the result spatially: N molecular emitters as a
// grid of nodes whose colour is their live excitation pᵢ(t) (cold slate → hot amber/white), a cobalt
// cavity photon mode whose brightness tracks ⟨a†a⟩(t), and two Fabry–Pérot mirrors that glow with the
// field. Energy you can watch slosh between light (cobalt) and matter (amber) at the rate g√M.
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Dyn = { eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; hist: unknown } | null;

const HALF = 4.2; // cavity half-length along x (mirror at ±HALF)
const COLD = new THREE.Color("#23344d"), WARM = new THREE.Color("#f59e0b"), HOT = new THREE.Color("#fff0c4");
const COB_LO = new THREE.Color("#13203a"), COB_HI = new THREE.Color("#5b9bff");

// |ψ_i(t)|² for every basis state (i=0 photon, i≥1 molecule i) — the App's popsAt, recomputed here so
// the 3D stays a pure function of the shared refs (no prop threading, always in lock-step with 2D).
function popsAt(ds: NonNullable<Dyn>, t: number): Float64Array {
  const { eigs, vecs, n, c } = ds;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let re = 0, im = 0; const row = i * n;
    for (let k = 0; k < n; k++) {
      const amp = vecs[row + k]! * c[k]!, ph = eigs[k]! * t;
      re += amp * Math.cos(ph); im -= amp * Math.sin(ph);
    }
    out[i] = re * re + im * im;
  }
  return out;
}

// excitation → heat colour: 0 cold slate, mid amber, 1 near-white. sqrt to lift small populations.
function heat(p: number, target: THREE.Color): THREE.Color {
  const v = Math.min(1, Math.sqrt(Math.max(0, p)));
  return v < 0.5 ? target.copy(COLD).lerp(WARM, v / 0.5) : target.copy(WARM).lerp(HOT, (v - 0.5) / 0.5);
}

// Square-ish grid of emitter positions on the cavity mid-plane (x≈0 antinode), centred, with a faint
// deterministic stagger so it reads as a real ensemble, not a CAD lattice.
function emitterLayout(m: number): THREE.Vector3[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(m))), rows = Math.ceil(m / cols), s = 0.92;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < m; i++) {
    const r = Math.floor(i / cols), col = i % cols;
    const y = (r - (rows - 1) / 2) * s, z = (col - (cols - 1) / 2) * s;
    const jx = (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.5; // hash jitter along the axis
    pts.push(new THREE.Vector3(jx, y, z));
  }
  return pts;
}

function Emitters({ stateRef, tRef, m }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; m: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pos = useMemo(() => emitterLayout(m), [m]);
  const scratch = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const mesh = meshRef.current; if (!mesh) return;
    const dummy = new THREE.Object3D();
    pos.forEach((p, i) => { dummy.position.copy(p); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, COLD); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pos]);
  useFrame(() => {
    const mesh = meshRef.current, ds = stateRef.current; if (!mesh || !ds || ds.n !== m + 1) return;
    const pops = popsAt(ds, tRef.current);
    for (let i = 0; i < m; i++) mesh.setColorAt(i, heat(pops[i + 1]!, scratch));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, m]} castShadow>
      <sphereGeometry args={[0.34, 22, 16]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// Cavity photon mode: a true standing wave sin(qπ(x+H)/2H) drawn as a glowing cobalt line whose
// brightness = √⟨a†a⟩, plus a faint mode-volume tube. Goes dark as the photon empties into the matter.
function PhotonMode({ stateRef, tRef }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const SEG = 120, Q = 5;
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    const mat = new THREE.LineBasicMaterial({ toneMapped: false });
    return new THREE.Line(g, mat);
  }, []);
  const tubeRef = useRef<THREE.Mesh>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const ds = stateRef.current; if (!ds) return;
    const amp = Math.min(1, Math.sqrt(Math.max(0, popsAt(ds, tRef.current)[0]!)));
    const arr = (line.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const shimmer = Math.cos(clock.elapsedTime * 6);
    for (let i = 0; i <= SEG; i++) {
      const x = -HALF + (2 * HALF * i) / SEG;
      const y = 1.05 * amp * Math.sin((Q * Math.PI * (x + HALF)) / (2 * HALF)) * shimmer;
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = 0;
    }
    (line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).color.copy(col.copy(COB_LO).lerp(COB_HI, amp));
    const tube = tubeRef.current;
    if (tube) (tube.material as THREE.MeshBasicMaterial).opacity = 0.05 + 0.22 * amp;
  });
  return (
    <group>
      <primitive object={line} />
      <mesh ref={tubeRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.35, 1.35, 2 * HALF, 40, 1, true]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// A Fabry–Pérot mirror that glows cobalt on its inner face as the photon population rises.
function Mirror({ side, stateRef, tRef }: { side: 1 | -1; stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const ds = stateRef.current, mat = matRef.current; if (!ds || !mat) return;
    const amp = Math.min(1, Math.sqrt(Math.max(0, popsAt(ds, tRef.current)[0]!)));
    mat.emissiveIntensity = 0.15 + 1.5 * amp;
  });
  return (
    <group position={[side * (HALF + 0.25), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.9, 1.9, 0.34, 64]} />
        <meshStandardMaterial ref={matRef} color="#3a4a63" metalness={0.55} roughness={0.32} emissive="#3b82f6" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, side * 0.18, 0]}>
        <torusGeometry args={[1.9, 0.05, 12, 80]} />
        <meshStandardMaterial color="#7f9bc4" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

// cobalt point light at cavity centre, brightening with the photon population — the cavity lights the room.
function FieldLight({ stateRef, tRef }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const ds = stateRef.current, l = ref.current; if (!ds || !l) return;
    const amp = Math.min(1, Math.sqrt(Math.max(0, popsAt(ds, tRef.current)[0]!)));
    l.intensity = 2 + 16 * amp;
  });
  return <pointLight ref={ref} position={[0, 0, 0]} distance={11} color="#5b9bff" />;
}

export function LiveCavityScene({ stateRef, tRef, m }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; m: number }) {
  return (
    <div className="cav-stage">
      <div className="cav-tag cav-tag-l">mirror</div>
      <div className="cav-tag cav-tag-r">mirror</div>
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> photon mode</div>
      <div className="cav-tag cav-tag-mol">{m} molecular emitters</div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [7.5, 4.4, 9.5], fov: 34 }}>
        <PerspectiveCamera makeDefault fov={34} position={[7.5, 4.4, 9.5]} />
        <ambientLight intensity={0.55} />
        <directionalLight castShadow intensity={0.9} position={[5, 8, 6]} shadow-mapSize={[1024, 1024]} />
        <FieldLight stateRef={stateRef} tRef={tRef} />
        <Mirror side={-1} stateRef={stateRef} tRef={tRef} />
        <Mirror side={1} stateRef={stateRef} tRef={tRef} />
        <PhotonMode stateRef={stateRef} tRef={tRef} />
        <Emitters stateRef={stateRef} tRef={tRef} m={m} />
        <Grid position={[0, -3.1, 0]} args={[26, 26]} cellSize={0.9} cellThickness={0.5} cellColor="#1c2942" sectionSize={4.5} sectionThickness={0.9} sectionColor="#2b3d5e" fadeDistance={30} fadeStrength={1.4} infiniteGrid />
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur radius={0.55} />
        </EffectComposer>
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={26} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
