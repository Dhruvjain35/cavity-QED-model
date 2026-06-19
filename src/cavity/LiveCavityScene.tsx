// Live single-excitation cavity-QED view (CATEGORY 2 rebuild) — this IS the simulation, painted in 3D.
// It reads the same arrowhead eigen-modes (dynState) and clock (simT) the 2D plots use, reconstructs
// ψ(t)=Σ_k c_k e^{−iE_k t}φ_k every frame, and renders it inside an OPEN Fabry–Pérot cavity: two flat
// DBR mirror stacks, a TEM₀₀ standing-wave field as flat cyan discs pinned at the antinodes, and N
// molecular emitters that glow red in proportion to their participation in the bright (superradiant)
// mode — bright molecules pulse with P_bright(t), dark/subradiant molecules stay dim. No cylinders.
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { antinodes, beamRadius, CavityPost, DBRMirror, LightRig, STAGE_OFFSET, STAGE_SCALE, STAGE_TILT, W0 } from "./cavityKit";
import { clusterLayout } from "./ensemble";

type Dyn = { eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; bright: Float64Array; modeAmp: Float64Array; hist: unknown } | null;
type Ens = { m: number; centers: [number, number, number][]; dipoles: [number, number, number][]; factors: Float64Array };
type Live = { pPhoton: number; pBright: number; pDark: number; molGlow: Float64Array };

const MOL_R = 5.5;      // molecule glow-sphere base radius — small enough that individuals stay distinct
const DIP_OFF = new THREE.Color("#3a4046"), DIP_ON = new THREE.Color("#cfe8ff");

// Map the shared ensemble into the rebuilt cavity frame: the cavity axis is local z, so the molecular
// film (ensemble transverse plane y–z) lands in the world x–y plane, the small axial jitter along z.
function buildFilm(ens: Ens) {
  let fmax = 1e-6; for (let i = 0; i < ens.m; i++) fmax = Math.max(fmax, Math.abs(ens.factors[i]!));
  const layout = clusterLayout(ens.m, ens.m); // deterministic spread, min 3D separation 12 (no merged blob)
  const mols = layout.map((p, i) => {
    const d = ens.dipoles[i]!;
    return {
      pos: new THREE.Vector3(p[0], p[1], p[2]),
      dir: new THREE.Vector3(d[1], d[2], d[0]).normalize(), // μ̂ remapped into the cavity frame
      coupling: Math.abs(ens.factors[i]!) / fmax,           // |g_i|/max — drives the dipole-arrow colour
    };
  });
  return { mols };
}
type Film = ReturnType<typeof buildFilm>;

// Sample the live state once per frame and publish P_photon / P_bright / P_dark + the per-molecule glow
// into refs (no React re-render). When an eigenstate is pinned (inspectRef) it freezes onto that state's
// photon weight + molecular weights instead of the live trajectory.
function SimSampler({ stateRef, tRef, inspectRef, liveRef, fieldAmpRef, m }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; liveRef: MutableRefObject<Live>; fieldAmpRef: MutableRefObject<number>; m: number }) {
  useFrame(() => {
    const ds = stateRef.current; if (!ds || ds.n !== m + 1) return;
    const n = ds.n, t = tRef.current, inspK = inspectRef.current, { eigs, vecs, c, bright } = ds, mg = liveRef.current.molGlow;
    if (inspK != null && inspK >= 0 && inspK < n) {
      const pPhot = vecs[inspK]! * vecs[inspK]!; // row-0 photon weight of eigenvector k
      let mx = 1e-9; for (let i = 0; i < m; i++) { const v = vecs[(i + 1) * n + inspK]!; mg[i] = v * v; if (mg[i]! > mx) mx = mg[i]!; }
      for (let i = 0; i < m; i++) mg[i] = (mg[i]! / mx) * 4.0;
      liveRef.current.pPhoton = pPhot; liveRef.current.pBright = 0; liveRef.current.pDark = 0; fieldAmpRef.current = pPhot; return;
    }
    let re0 = 0, im0 = 0; for (let k = 0; k < n; k++) { const a = vecs[k]! * c[k]!, ph = eigs[k]! * t; re0 += a * Math.cos(ph); im0 -= a * Math.sin(ph); }
    const pPhot = re0 * re0 + im0 * im0;
    let brRe = 0, brIm = 0, pMatter = 0;
    for (let i = 1; i < n; i++) {
      let re = 0, im = 0; const row = i * n;
      for (let k = 0; k < n; k++) { const a = vecs[row + k]! * c[k]!, ph = eigs[k]! * t; re += a * Math.cos(ph); im -= a * Math.sin(ph); }
      const exc = re * re + im * im; const b = bright[i - 1]!; // |ψ_i(t)|² = live per-molecule excitation
      pMatter += exc; brRe += b * re; brIm += b * im;
      mg[i - 1] = Math.abs(b) < 0.1 ? 0 : exc; // glow ∝ this molecule's own excitation; decoupled (|b|<0.1) stays dark
    }
    const pBright = brRe * brRe + brIm * brIm, pDark = Math.max(0, pMatter - pBright);
    liveRef.current.pPhoton = pPhot; liveRef.current.pBright = pBright; liveRef.current.pDark = pDark; fieldAmpRef.current = pPhot;
  });
  return null;
}

// Molecules as faceted emitters: base #3a1a2a (dim), emissive #ff3333 with per-frame intensity =
// bright_weight·P_bright·4.0 (set straight on each material, no re-render). toneMapped off so the bright
// ones cross the bloom threshold and glow; dark ones sit unlit and dim.
// naphthalene carbon skeleton: two fused hexagons (10 carbons, bond-length units; long axis = x) + the 11
// C–C bonds. Restored from commit 035e650 (the ball-and-stick render before the sphere simplification).
const CARB = [
  [0, 0.5], [-0.866, 1], [-1.732, 0.5], [-1.732, -0.5], [-0.866, -1], [0, -0.5],
  [1.732, 0.5], [0.866, 1], [0.866, -1], [1.732, -0.5],
] as const;
const NAPH_BONDS: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 7], [7, 6], [6, 9], [9, 8], [8, 5]];
const NAPH_S = 2.4, ATOM_R = 1.35, BOND_R = 0.42; // bond-length→world scale, atom & bond radii

// One merged ball-and-stick naphthalene geometry (spheres at carbons + cylinders along bonds), built once
// and shared by every molecule mesh. SphereGeometry (indexed) matches CylinderGeometry so mergeGeometries
// can combine them. Local long axis = +x → each molecule rotates +x onto its ensemble dipole μ̂_i.
function naphthaleneGeometry(): THREE.BufferGeometry {
  const pts = CARB.map(([x, y]) => new THREE.Vector3(x * NAPH_S, y * NAPH_S, 0));
  const parts: THREE.BufferGeometry[] = [];
  for (const p of pts) { const s = new THREE.SphereGeometry(ATOM_R, 12, 8); s.translate(p.x, p.y, p.z); parts.push(s); }
  const up = new THREE.Vector3(0, 1, 0);
  for (const [a, b] of NAPH_BONDS) {
    const pa = pts[a]!, pb = pts[b]!, dir = new THREE.Vector3().subVectors(pb, pa), len = dir.length();
    const cyl = new THREE.CylinderGeometry(BOND_R, BOND_R, len, 8);
    cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
    const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5);
    cyl.translate(mid.x, mid.y, mid.z); parts.push(cyl);
  }
  return mergeGeometries(parts)!;
}

// Molecules as oriented ball-and-stick naphthalene chromophores: each shares the merged geometry, sits at
// its ensemble position, is rotated so its long axis lies along its transition dipole μ̂_i (NOT random),
// and glows with its own live excitation (emissiveIntensity = min(1.4, |ψ_i|²·6) from molGlow). Dim purple
// base #2a1838 so decoupled/ground molecules stay visibly dark; toneMapped off so peaks halo via bloom.
function Molecules({ liveRef, film, scale }: { liveRef: MutableRefObject<Live>; film: Film; scale: number }) {
  const geo = useMemo(() => naphthaleneGeometry(), []);
  const quats = useMemo(() => film.mols.map((mol) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), mol.dir)), [film]);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => { const mg = liveRef.current.molGlow; for (let i = 0; i < film.mols.length; i++) { const mt = mats.current[i]; if (mt) mt.emissiveIntensity = Math.min(1.4, (mg[i] || 0) * 6.0); } });
  return (
    <group>
      {film.mols.map((mol, i) => (
        <mesh key={i} geometry={geo} position={mol.pos} quaternion={quats[i]!} scale={scale} renderOrder={10}>
          <meshStandardMaterial ref={(el) => { mats.current[i] = el; }} color="#2a1838" emissive="#ff2a2a" emissiveIntensity={0} roughness={0.4} metalness={0.1} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Transition-dipole arrows μ̂_i — the SAME vectors that set g_i = g_0(μ̂·ε̂)f(r): coupled (∥ ε̂, in the
// mode) → bright, decoupled (⟂ ε̂ or at the mode edge) → dark gray. Static per ensemble.
function Dipoles({ film, scale }: { film: Film; scale: number }) {
  const shaftRef = useRef<THREE.InstancedMesh>(null), headRef = useRef<THREE.InstancedMesh>(null);
  const tf = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0), L = MOL_R * 2.8 * scale;
    return film.mols.map((mol) => ({ q: new THREE.Quaternion().setFromUnitVectors(up, mol.dir), dir: mol.dir, center: mol.pos, coupling: mol.coupling, shaft: L * 0.7, tip: L * 0.7 + MOL_R * scale * 0.55 }));
  }, [film, scale]);
  useLayoutEffect(() => {
    const sM = shaftRef.current, hM = headRef.current; if (!sM || !hM) return;
    const d = new THREE.Object3D(), cc = new THREE.Color();
    tf.forEach((t, i) => {
      cc.copy(DIP_OFF).lerp(DIP_ON, t.coupling);
      d.position.copy(t.center).addScaledVector(t.dir, t.shaft / 2); d.quaternion.copy(t.q); d.scale.set(1, t.shaft, 1); d.updateMatrix(); sM.setMatrixAt(i, d.matrix); sM.setColorAt(i, cc);
      d.position.copy(t.center).addScaledVector(t.dir, t.tip); d.quaternion.copy(t.q); d.scale.set(1, 1, 1); d.updateMatrix(); hM.setMatrixAt(i, d.matrix); hM.setColorAt(i, cc);
    });
    sM.instanceMatrix.needsUpdate = hM.instanceMatrix.needsUpdate = true;
    if (sM.instanceColor) sM.instanceColor.needsUpdate = true; if (hM.instanceColor) hM.instanceColor.needsUpdate = true;
  }, [tf]);
  const n = film.mols.length;
  return (
    <group>
      <instancedMesh ref={shaftRef} args={[undefined, undefined, n]} renderOrder={9}>
        <cylinderGeometry args={[0.55, 0.55, 1, 8]} />
        <meshBasicMaterial toneMapped={false} transparent depthTest={false} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, n]} renderOrder={9}>
        <coneGeometry args={[1.3, 3.4, 10]} />
        <meshBasicMaterial toneMapped={false} transparent depthTest={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// Cavity field polarization ε̂(θ) = (cosθ, sinθ, 0) in the cavity frame — an amber double-arrow through
// the centre. Rotating it off the dipoles collapses g_i = g_0(μ̂·ε̂); at θ=90° the Rabi splitting vanishes.
function PolarizationAxis({ theta }: { theta: number }) {
  const L = W0 * 1.15, dir = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <group quaternion={q}>
      <mesh><cylinderGeometry args={[0.7, 0.7, 2 * L, 12]} /><meshBasicMaterial color="#ffcc00" toneMapped={false} /></mesh>
      <mesh position={[0, L, 0]}><coneGeometry args={[2.2, 6, 14]} /><meshBasicMaterial color="#ffe066" toneMapped={false} /></mesh>
      <mesh position={[0, -L, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[2.2, 6, 14]} /><meshBasicMaterial color="#ffe066" toneMapped={false} /></mesh>
    </group>
  );
}

// ── TEM₀₀ field discs: same antinode positions + radii as cavityKit's FieldStack (kept identical), but the
// flat two-ring "poker chip" material is replaced by a Gaussian-intensity shader — bright core fading
// smoothly to a transparent edge (the true exp(−2r²/w²) mode), additively blended so the 5 antinodes read
// as one continuous glowing mode rather than separate objects. UVs of circleGeometry give ρ=0 at centre,
// ρ=1 at the rim; intensity = exp(−12.5 ρ²) (12.5 = 2·2.5², the disc-radius = 2.5·w normalization).
const FIELD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FIELD_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uOpacity;
uniform vec3  uColor;
void main() {
  float rho = length(vUv - 0.5) * 2.0;          // 0 at center, 1 at geometry edge
  float intensity = exp(-12.5 * rho * rho);     // TEM00: 12.5 = 2*(2.5)^2
  if (intensity < 0.004) discard;               // no hard circular edge
  gl_FragColor = vec4(uColor, intensity * uOpacity);
}`;
const makeFieldMaterial = () => new THREE.ShaderMaterial({
  vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
  uniforms: { uOpacity: { value: 0.15 }, uColor: { value: new THREE.Color(0x00ffff) } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
});

function FieldDiscsShader({ ampRef, visible = true }: { ampRef: MutableRefObject<number>; visible?: boolean }) {
  const discs = useMemo(() => antinodes().map((z) => ({ z, r: beamRadius(z) * 2.2 })), []); // identical to FieldStack
  const mats = useMemo(() => discs.map(() => makeFieldMaterial()), [discs]);                // one material per disc
  useFrame(() => {
    const amp = Math.max(0, Math.min(1, ampRef.current));
    const op = Math.min(0.9, 0.12 + 0.78 * amp); // live P_photon(t) drives brightness — it ALREADY oscillates at Ω_R, so NO extra cos(Ω_R·t) factor (that would double-count)
    for (const mt of mats) mt.uniforms.uOpacity!.value = op;
  });
  if (!visible) return null;
  return (
    <group>
      {discs.map((d, i) => (
        <mesh key={i} position={[0, 0, d.z]}>
          <circleGeometry args={[d.r, 64]} />
          <primitive object={mats[i]!} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

export interface SceneControls { fieldOpacity: number; moleculeScale: number; bloomIntensity: number; showFieldDiscs: boolean; showDipoleArrows: boolean }
const DEFAULT_CTRL: SceneControls = { fieldOpacity: 0.15, moleculeScale: 1.0, bloomIntensity: 0.6, showFieldDiscs: true, showDipoleArrows: true };

export function LiveCavityScene({ stateRef, tRef, inspectRef, m, ensemble, polTheta, controls = DEFAULT_CTRL }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; m: number; ensemble: Ens; waist?: number; polTheta: number; controls?: SceneControls }) {
  const film = useMemo(() => buildFilm(ensemble), [ensemble]);
  const liveRef = useRef<Live>({ pPhoton: 0, pBright: 0, pDark: 0, molGlow: new Float64Array(64) });
  const fieldAmpRef = useRef(0);
  return (
    <div className="cav-stage">
      <div className="cav-tag cav-tag-l">DBR mirror</div>
      <div className="cav-tag cav-tag-r">DBR mirror</div>
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> TEM₀₀ field · <span style={{ color: "#ffcc00" }}>ε̂</span> polariz.</div>
      <div className="cav-tag cav-tag-mol">{m} emitters · bright glow ∝ P<sub>bright</sub></div>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 55, 340], fov: 52 }}>
        <color attach="background" args={["#05070e"]} />
        <PerspectiveCamera makeDefault fov={52} position={[0, 55, 340]} />
        <LightRig />
        <SimSampler stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} liveRef={liveRef} fieldAmpRef={fieldAmpRef} m={m} />
        <group rotation={STAGE_TILT} scale={STAGE_SCALE} position={STAGE_OFFSET}>
          <DBRMirror side={-1} />
          <DBRMirror side={1} />
          <FieldDiscsShader ampRef={fieldAmpRef} visible={controls.showFieldDiscs} />
          <Molecules liveRef={liveRef} film={film} scale={controls.moleculeScale} />
          {controls.showDipoleArrows ? <Dipoles film={film} scale={controls.moleculeScale} /> : null}
          <PolarizationAxis theta={polTheta} />
        </group>
        <CavityPost bloomIntensity={controls.bloomIntensity} />
        <OrbitControls makeDefault enablePan={false} autoRotate={false} enableDamping dampingFactor={0.05} minDistance={150} maxDistance={600} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
