// Live single-excitation cavity-QED view — this IS the simulation. It reads the same arrowhead
// eigen-modes (dynState) and clock (simT) the 2D plots use, reconstructs ψ(t)=Σ_k c_k e^{−iE_k t}φ_k
// every frame, and paints it spatially: N real ball-and-stick molecules (naphthalene chromophores) as
// a film inside a Fabry–Pérot cavity, each glowing with its live excitation pᵢ(t); a cobalt photon
// mode (standing-wave tubes) bright ∝ √⟨a†a⟩; two polished mirrors facing each other. Lit under a
// baked studio environment with restrained bloom — built to read as a real optical experiment.
import { ContactShadows, Environment, Grid, Lightformer, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Dyn = { eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; bright: Float64Array; hist: unknown } | null;

const HALF = 4.3; // cavity half-length along x (mirror at ±HALF)
const GROUND = new THREE.Color("#828c9b"), WARM = new THREE.Color("#f7a516"), HOT = new THREE.Color("#fff4d4");
const COB_LO = new THREE.Color("#162a4a"), COB_HI = new THREE.Color("#6fa8ff");

// naphthalene carbon skeleton (two fused hexagons, bond-length units) + bonds — a real chromophore
const CARB = [
  [0, 0.5], [-0.866, 1], [-1.732, 0.5], [-1.732, -0.5], [-0.866, -1], [0, -0.5],
  [1.732, 0.5], [0.866, 1], [0.866, -1], [1.732, -0.5],
] as const;
const BONDS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 7], [7, 6], [6, 9], [9, 8], [8, 5]];

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

// field amplitude √⟨a†a⟩ — or, when an eigenstate is pinned for inspection, that state's photon weight.
function fieldAmp(ds: NonNullable<Dyn>, inspK: number | null, t: number): number {
  if (inspK != null && inspK >= 0 && inspK < ds.n) return Math.min(1, Math.abs(ds.vecs[inspK]!));
  return photonAmp(ds, t);
}

// per-molecule excitation: live |ψᵢ(t)|², or the inspected eigenstate's molecular weights |vᵢₖ|²
// (normalised to the brightest molecule, so a localized dark state visibly lights only a few).
function molValues(ds: NonNullable<Dyn>, inspK: number | null, t: number, m: number): Float64Array {
  const out = new Float64Array(m);
  if (inspK != null && inspK >= 0 && inspK < ds.n) {
    let mx = 1e-9;
    for (let i = 0; i < m; i++) { const v = ds.vecs[(i + 1) * ds.n + inspK]!; out[i] = v * v; if (out[i]! > mx) mx = out[i]!; }
    for (let i = 0; i < m; i++) out[i] = out[i]! / mx;
    return out;
  }
  const pops = popsAt(ds, t);
  for (let i = 0; i < m; i++) out[i] = pops[i + 1]!;
  return out;
}

// excitation → glow colour: neutral carbon grey, mid amber, near-white hot. sqrt lifts small pops.
function heat(p: number, target: THREE.Color): THREE.Color {
  const v = Math.min(1, Math.sqrt(Math.max(0, p)));
  return v < 0.5 ? target.copy(GROUND).lerp(WARM, v / 0.5) : target.copy(WARM).lerp(HOT, (v - 0.5) / 0.5);
}

type Ens = { m: number; centers: [number, number, number][]; dipoles: [number, number, number][]; factors: Float64Array };

// Build the ball-and-stick geometry from the SHARED ensemble: each molecule sits at its real position
// and is oriented so its long molecular axis lies along its transition dipole μ̂_i — so a dipole that
// the engine sees as decoupled (μ̂ ⟂ field) is literally drawn turned sideways to the cavity mode.
function buildFilm(ens: Ens) {
  const S = 0.18, xaxis = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
  const atoms: { p: THREE.Vector3; mol: number }[] = [];
  const bonds: { p: THREE.Vector3; q: THREE.Quaternion; len: number; mol: number }[] = [];
  const mols: { center: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  for (let mi = 0; mi < ens.m; mi++) {
    const center = new THREE.Vector3(...ens.centers[mi]!);
    const dir = new THREE.Vector3(...ens.dipoles[mi]!).normalize();
    const rot = new THREE.Quaternion().setFromUnitVectors(xaxis, dir); // long axis → μ̂_i
    const w = CARB.map(([x, y]) => new THREE.Vector3(x * S, y * S, 0).applyQuaternion(rot).add(center));
    w.forEach((p) => atoms.push({ p, mol: mi }));
    BONDS.forEach(([a, b]) => {
      const pa = w[a]!, pb = w[b]!, d = new THREE.Vector3().subVectors(pb, pa), len = d.length();
      bonds.push({ p: new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()), len, mol: mi });
    });
    mols.push({ center, dir });
  }
  return { atoms, bonds, mols };
}
const DIP = new THREE.Color("#4fcabe"), DIP_HOT = new THREE.Color("#eafff6");

type Film = ReturnType<typeof buildFilm>;

function Molecules({ stateRef, tRef, inspectRef, m, film }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; m: number; film: Film }) {
  const atomRef = useRef<THREE.InstancedMesh>(null), bondRef = useRef<THREE.InstancedMesh>(null);
  const ca = useMemo(() => new THREE.Color(), []), cb = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const aM = atomRef.current, bM = bondRef.current; if (!aM || !bM) return;
    const d = new THREE.Object3D();
    film.atoms.forEach((a, i) => { d.position.copy(a.p); d.scale.setScalar(1); d.rotation.set(0, 0, 0); d.updateMatrix(); aM.setMatrixAt(i, d.matrix); aM.setColorAt(i, GROUND); });
    film.bonds.forEach((b, i) => { d.position.copy(b.p); d.quaternion.copy(b.q); d.scale.set(1, b.len, 1); d.updateMatrix(); bM.setMatrixAt(i, d.matrix); bM.setColorAt(i, GROUND); });
    aM.instanceMatrix.needsUpdate = bM.instanceMatrix.needsUpdate = true;
    if (aM.instanceColor) aM.instanceColor.needsUpdate = true;
    if (bM.instanceColor) bM.instanceColor.needsUpdate = true;
  }, [film]);
  useFrame(() => {
    const aM = atomRef.current, bM = bondRef.current, ds = stateRef.current;
    if (!aM || !bM || !ds || ds.n !== m + 1) return;
    const w = molValues(ds, inspectRef.current, tRef.current, m);
    film.atoms.forEach((a, i) => aM.setColorAt(i, heat(w[a.mol]!, ca)));
    film.bonds.forEach((b, i) => bM.setColorAt(i, heat(w[b.mol]!, cb).multiplyScalar(0.72)));
    if (aM.instanceColor) aM.instanceColor.needsUpdate = true;
    if (bM.instanceColor) bM.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={atomRef} args={[undefined, undefined, film.atoms.length]} castShadow receiveShadow>
        <sphereGeometry args={[0.082, 16, 12]} />
        <meshStandardMaterial roughness={0.42} metalness={0.12} envMapIntensity={0.7} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bondRef} args={[undefined, undefined, film.bonds.length]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
        <meshStandardMaterial roughness={0.5} metalness={0.1} envMapIntensity={0.6} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Transition-dipole moments μ̂ᵢ as glowing cyan arrows — the SAME vectors that set each molecule's
// coupling g_i = g_0(μ̂_i·ε̂)f(r_i) in the Hamiltonian. At η=1 (crystal) all arrows point along the
// field polarization ŷ (max coupling); as η→0 (amorphous) they tip toward random 3D orientations and
// those molecules decouple — you watch the bright ensemble shed members into the dark manifold.
function Dipoles({ stateRef, tRef, inspectRef, m, film }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; m: number; film: Film }) {
  const shaftRef = useRef<THREE.InstancedMesh>(null), headRef = useRef<THREE.InstancedMesh>(null);
  const cc = useMemo(() => new THREE.Color(), []);
  const tf = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0), L = 0.82;
    return film.mols.map((mol) => ({ dir: mol.dir, q: new THREE.Quaternion().setFromUnitVectors(up, mol.dir), center: mol.center, shaft: L * 0.72, tip: L * 0.72 + 0.085 }));
  }, [film]);
  useLayoutEffect(() => {
    const sM = shaftRef.current, hM = headRef.current; if (!sM || !hM) return;
    const d = new THREE.Object3D();
    tf.forEach((t, i) => {
      d.position.copy(t.center).addScaledVector(t.dir, t.shaft / 2); d.quaternion.copy(t.q); d.scale.set(1, t.shaft, 1); d.updateMatrix(); sM.setMatrixAt(i, d.matrix); sM.setColorAt(i, DIP);
      d.position.copy(t.center).addScaledVector(t.dir, t.tip); d.quaternion.copy(t.q); d.scale.set(1, 1, 1); d.updateMatrix(); hM.setMatrixAt(i, d.matrix); hM.setColorAt(i, DIP);
    });
    sM.instanceMatrix.needsUpdate = hM.instanceMatrix.needsUpdate = true;
    if (sM.instanceColor) sM.instanceColor.needsUpdate = true;
    if (hM.instanceColor) hM.instanceColor.needsUpdate = true;
  }, [tf]);
  useFrame(() => {
    const sM = shaftRef.current, hM = headRef.current, ds = stateRef.current; if (!sM || !hM || !ds || ds.n !== m + 1) return;
    const w = molValues(ds, inspectRef.current, tRef.current, m);
    for (let i = 0; i < m; i++) { cc.copy(DIP).lerp(DIP_HOT, Math.min(1, Math.sqrt(w[i]!))); sM.setColorAt(i, cc); hM.setColorAt(i, cc); }
    if (sM.instanceColor) sM.instanceColor.needsUpdate = true;
    if (hM.instanceColor) hM.instanceColor.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={shaftRef} args={[undefined, undefined, m]}>
        <cylinderGeometry args={[0.019, 0.019, 1, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, m]}>
        <coneGeometry args={[0.058, 0.17, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// Cavity photon mode: two crossed standing-wave tubes sin(qπ(x+H)/2H). Built once; each frame the
// emissive cobalt brightness AND the transverse amplitude scale with √⟨a†a⟩ — full sine when the
// photon is in the field, flat on the axis as it empties into the molecules.
function PhotonMode({ stateRef, tRef, inspectRef, waist }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; waist: number }) {
  const geom = useMemo(() => {
    const SEG = 150, Q = 5, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SEG; i++) { const x = -HALF + (2 * HALF * i) / SEG; pts.push(new THREE.Vector3(x, Math.sin((Q * Math.PI * (x + HALF)) / (2 * HALF)), 0)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEG, 0.034, 8, false);
  }, []);
  const gY = useRef<THREE.Mesh>(null), gZ = useRef<THREE.Mesh>(null);
  const mY = useRef<THREE.MeshStandardMaterial>(null), mZ = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null), haloIn = useRef<THREE.MeshBasicMaterial>(null);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const ds = stateRef.current; if (!ds) return;
    // amplitude AND brightness are the real field √⟨a†a⟩ — when the photon empties into the matter
    // (or a dark state is inspected) the standing wave collapses to a flat line on the cavity axis.
    const amp = fieldAmp(ds, inspectRef.current, tRef.current); col.copy(COB_LO).lerp(COB_HI, amp);
    for (const mr of [mY, mZ]) { const mt = mr.current; if (mt) { mt.color.copy(col); mt.emissive.copy(col); mt.emissiveIntensity = 0.04 + 1.7 * amp; } }
    if (gY.current) gY.current.scale.y = 0.012 + 0.99 * amp;
    if (gZ.current) gZ.current.scale.y = 0.012 + 0.99 * amp;
    if (halo.current) halo.current.opacity = 0.015 + 0.05 * amp;
    if (haloIn.current) haloIn.current.opacity = 0.03 + 0.1 * amp;
  });
  return (
    <group>
      {/* TEM00 Gaussian mode volume — nested translucent shells (1/e radius = waist) brightening with the field */}
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[waist, waist, 2 * HALF, 40, 1, true]} /><meshBasicMaterial ref={halo} color="#3b82f6" transparent opacity={0.02} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[waist * 0.55, waist * 0.55, 2 * HALF, 36, 1, true]} /><meshBasicMaterial ref={haloIn} color="#5b9bff" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
      <mesh ref={gY} geometry={geom}><meshStandardMaterial ref={mY} emissive="#3b82f6" emissiveIntensity={0.6} roughness={0.4} toneMapped={false} /></mesh>
      <mesh ref={gZ} geometry={geom} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial ref={mZ} emissive="#3b82f6" emissiveIntensity={0.6} roughness={0.4} toneMapped={false} /></mesh>
    </group>
  );
}

// A Fabry–Pérot mirror facing inward along the cavity axis: polished metal substrate (reflects the
// studio env AND the cobalt field), a dark machined bezel, and a faint cobalt field tint on the inner
// face that rises with the photon population. Correct orientation — the reflective face looks at its twin.
function Mirror({ side, stateRef, tRef, inspectRef }: { side: 1 | -1; stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null> }) {
  const tint = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const ds = stateRef.current, t = tint.current; if (!ds || !t) return;
    t.emissiveIntensity = 0.03 + 0.45 * fieldAmp(ds, inspectRef.current, tRef.current);
  });
  return (
    <group position={[side * (HALF + 0.18), 0, 0]}>
      <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.95, 1.95, 0.2, 80]} />
        <meshStandardMaterial color="#cdd6e1" metalness={1} roughness={0.045} envMapIntensity={1.35} />
      </mesh>
      <mesh position={[-side * 0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.68, 1.68, 0.012, 64]} />
        <meshStandardMaterial ref={tint} color="#16233e" metalness={0.5} roughness={0.3} emissive="#3b82f6" emissiveIntensity={0.03} transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.96, 0.085, 18, 84]} />
        <meshStandardMaterial color="#39424f" metalness={0.85} roughness={0.32} envMapIntensity={0.9} />
      </mesh>
    </group>
  );
}

function FieldLight({ stateRef, tRef, inspectRef }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null> }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => { const ds = stateRef.current, l = ref.current; if (ds && l) l.intensity = 7 * fieldAmp(ds, inspectRef.current, tRef.current); });
  return <pointLight ref={ref} position={[0, 0, 0]} distance={13} color="#6fa8ff" />;
}

// Baked neutral studio environment (no external HDRI) — gives the polished mirrors real specular form
// and the molecules real shading. Cool, low, lab-grade; deliberately not a game-engine preset.
function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={["#04070d"]} />
      <Lightformer intensity={1.4} form="rect" position={[0, 6, -3]} scale={[10, 5, 1]} color="#e6eeff" />
      <Lightformer intensity={0.75} form="rect" position={[-7, 1, 3]} scale={[3, 7, 1]} color="#9fb0cc" />
      <Lightformer intensity={0.75} form="rect" position={[7, 1, 3]} scale={[3, 7, 1]} color="#9fb0cc" />
      <Lightformer intensity={0.4} form="ring" position={[0, 0, 6]} scale={6} color="#8294b0" />
    </Environment>
  );
}

export function LiveCavityScene({ stateRef, tRef, inspectRef, m, ensemble, waist }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; m: number; ensemble: Ens; waist: number }) {
  const film = useMemo(() => buildFilm(ensemble), [ensemble]);
  return (
    <div className="cav-stage">
      <div className="cav-tag cav-tag-l">mirror</div>
      <div className="cav-tag cav-tag-r">mirror</div>
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> TEM₀₀ mode</div>
      <div className="cav-tag cav-tag-mol">{m} naphthalene emitters · μ̂ → g<sub>i</sub></div>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [9.2, 4.3, 10.4], fov: 33 }}>
        <PerspectiveCamera makeDefault fov={33} position={[9.2, 4.3, 10.4]} />
        <Studio />
        <ambientLight intensity={0.26} />
        <directionalLight castShadow intensity={0.5} position={[5, 8, 6]} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
        <FieldLight stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} />
        <Mirror side={-1} stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} />
        <Mirror side={1} stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} />
        <PhotonMode stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} waist={waist} />
        <Molecules stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} m={m} film={film} />
        <Dipoles stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} m={m} film={film} />
        <ContactShadows position={[0, -2.7, 0]} scale={26} blur={2.8} far={6} opacity={0.42} resolution={1024} color="#02040a" />
        <Grid position={[0, -2.7, 0]} args={[28, 28]} cellSize={0.9} cellThickness={0.4} cellColor="#0f1825" sectionSize={4.5} sectionThickness={0.7} sectionColor="#223247" fadeDistance={34} fadeStrength={1.6} infiniteGrid />
        <EffectComposer>
          <Bloom intensity={0.22} luminanceThreshold={0.74} luminanceSmoothing={0.3} mipmapBlur radius={0.4} />
        </EffectComposer>
        <OrbitControls makeDefault enablePan={false} minDistance={6} maxDistance={28} target={[0, 0.3, 0]} />
      </Canvas>
    </div>
  );
}
