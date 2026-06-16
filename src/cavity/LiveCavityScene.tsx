// Live single-excitation cavity-QED view — this is the SIMULATION, not a render. It reads the same
// arrowhead eigen-modes (dynState) and clock (simT) the 2D plots use, reconstructs ψ(t) =
// Σ_k c_k e^{−iE_k t} φ_k every frame, and paints it spatially: N molecular emitters whose colour is
// their live excitation pᵢ(t) (cold slate → hot amber/white), a cobalt cavity photon mode drawn as a
// real standing wave whose brightness tracks √⟨a†a⟩(t), and Fabry–Pérot mirrors that glow with the
// field. Lit under a baked studio environment (real reflections), restrained bloom — instrument-grade.
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Dyn = { eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; hist: unknown } | null;

const HALF = 4.2; // cavity half-length along x (mirror at ±HALF)
const COLD = new THREE.Color("#36506f"), WARM = new THREE.Color("#f59e0b"), HOT = new THREE.Color("#fff3d2");
const COB_LO = new THREE.Color("#16233e"), COB_HI = new THREE.Color("#6aa6ff");

// |ψ_i(t)|² for every basis state (i=0 photon, i≥1 molecule i) — recomputed here so the 3D is a pure
// function of the shared refs, always in lock-step with the 2D plots (no prop threading).
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
const photonAmp = (ds: NonNullable<Dyn>, t: number) => Math.min(1, Math.sqrt(Math.max(0, popsAt(ds, t)[0]!)));

// excitation → heat colour: cold slate, mid amber, near-white hot. sqrt lifts small populations.
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
    const jx = (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.4;
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
    <instancedMesh ref={meshRef} args={[undefined, undefined, m]} castShadow receiveShadow>
      <sphereGeometry args={[0.3, 32, 24]} />
      <meshStandardMaterial roughness={0.42} metalness={0.1} envMapIntensity={0.7} toneMapped={false} />
    </instancedMesh>
  );
}

// Cavity photon mode: two crossed standing waves sin(qπ(x+H)/2H) whose brightness = √⟨a†a⟩ — bright
// cobalt when the photon is full, dark as it empties into the matter. No opaque tube (that read as a toy).
function PhotonMode({ stateRef, tRef }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const SEG = 130, Q = 5;
  const make = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ toneMapped: false, transparent: true }));
  };
  const lineY = useMemo(make, []), lineZ = useMemo(make, []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const ds = stateRef.current; if (!ds) return;
    const amp = photonAmp(ds, tRef.current), shimmer = Math.cos(clock.elapsedTime * 5);
    const c = col.copy(COB_LO).lerp(COB_HI, amp);
    for (const [ln, axis] of [[lineY, 1], [lineZ, 2]] as [THREE.Line, number][]) {
      const arr = (ln.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i <= SEG; i++) {
        const x = -HALF + (2 * HALF * i) / SEG;
        const d = 1.0 * amp * Math.sin((Q * Math.PI * (x + HALF)) / (2 * HALF)) * shimmer;
        arr[i * 3] = x; arr[i * 3 + 1] = axis === 1 ? d : 0; arr[i * 3 + 2] = axis === 2 ? d : 0;
      }
      (ln.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (ln.material as THREE.LineBasicMaterial).color.copy(c);
      (ln.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.65 * amp;
    }
  });
  return <group><primitive object={lineY} /><primitive object={lineZ} /></group>;
}

// A Fabry–Pérot mirror: polished metal (reflects the studio env) with a gold beveled mount; the inner
// face glows cobalt as the photon population rises.
function Mirror({ side, stateRef, tRef }: { side: 1 | -1; stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const ds = stateRef.current, mat = matRef.current; if (!ds || !mat) return;
    mat.emissiveIntensity = 0.08 + 0.9 * photonAmp(ds, tRef.current);
  });
  return (
    <group position={[side * (HALF + 0.25), 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.9, 1.9, 0.34, 64]} />
        <meshStandardMaterial ref={matRef} color="#aeb9c9" metalness={0.92} roughness={0.06} envMapIntensity={1} emissive="#3b82f6" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, side * 0.12, 0]}>
        <torusGeometry args={[1.9, 0.12, 18, 72]} />
        <meshStandardMaterial color="#caa36e" metalness={0.95} roughness={0.18} envMapIntensity={1} />
      </mesh>
    </group>
  );
}

// cobalt point light at cavity centre, brightening with the photon population — the field lights the room.
function FieldLight({ stateRef, tRef }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const ds = stateRef.current, l = ref.current; if (!ds || !l) return;
    l.intensity = 6 * photonAmp(ds, tRef.current);
  });
  return <pointLight ref={ref} position={[0, 0, 0]} distance={12} color="#6aa6ff" />;
}

// Baked neutral studio environment (no external HDRI) — gives the metal mirrors real specular streaks
// and the spheres real form. Low, cool, lab-grade; deliberately not a game-engine preset.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={["#05080f"]} />
      <Lightformer intensity={1.3} form="rect" position={[0, 6, -3]} scale={[10, 5, 1]} color="#e3ecff" />
      <Lightformer intensity={0.7} form="rect" position={[-7, 1, 3]} scale={[3, 7, 1]} color="#9fb0cc" />
      <Lightformer intensity={0.7} form="rect" position={[7, 1, 3]} scale={[3, 7, 1]} color="#9fb0cc" />
      <Lightformer intensity={0.4} form="rect" position={[0, -4, 5]} scale={[10, 3, 1]} color="#6f7d97" />
    </Environment>
  );
}

export function LiveCavityScene({ stateRef, tRef, m }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; m: number }) {
  return (
    <div className="cav-stage">
      <div className="cav-tag cav-tag-l">mirror</div>
      <div className="cav-tag cav-tag-r">mirror</div>
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> photon mode</div>
      <div className="cav-tag cav-tag-mol">{m} molecular emitters</div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [7.8, 4.6, 9.8], fov: 33 }}>
        <PerspectiveCamera makeDefault fov={33} position={[7.8, 4.6, 9.8]} />
        <Studio />
        <ambientLight intensity={0.28} />
        <directionalLight castShadow intensity={0.55} position={[5, 8, 6]} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
        <FieldLight stateRef={stateRef} tRef={tRef} />
        <Mirror side={-1} stateRef={stateRef} tRef={tRef} />
        <Mirror side={1} stateRef={stateRef} tRef={tRef} />
        <PhotonMode stateRef={stateRef} tRef={tRef} />
        <Emitters stateRef={stateRef} tRef={tRef} m={m} />
        <ContactShadows position={[0, -3.1, 0]} scale={26} blur={2.6} far={6} opacity={0.4} resolution={1024} color="#02040a" />
        <Grid position={[0, -3.1, 0]} args={[28, 28]} cellSize={0.9} cellThickness={0.4} cellColor="#0f1825" sectionSize={4.5} sectionThickness={0.7} sectionColor="#223247" fadeDistance={34} fadeStrength={1.6} infiniteGrid />
        <EffectComposer>
          <Bloom intensity={0.14} luminanceThreshold={0.8} luminanceSmoothing={0.3} mipmapBlur radius={0.3} />
        </EffectComposer>
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={26} target={[0, 0.3, 0]} />
      </Canvas>
    </div>
  );
}
