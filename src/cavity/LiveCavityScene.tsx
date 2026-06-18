// Live single-excitation cavity-QED view (CATEGORY 2 rebuild) — this IS the simulation, painted in 3D.
// It reads the same arrowhead eigen-modes (dynState) and clock (simT) the 2D plots use, reconstructs
// ψ(t)=Σ_k c_k e^{−iE_k t}φ_k every frame, and renders it inside an OPEN Fabry–Pérot cavity viewed FROM
// THE SIDE (the standard published cavity-QED orientation): the optical axis runs along world Z, two
// dielectric DBR mirror faces at z=±160, a TEM₀₀ Gaussian standing-wave mode as flat cyan antinode discs
// whose radii trace the exact beam waist w(z), and N molecular emitters glowing with their bright-mode
// participation. Geometry/material/lighting are taken directly from the cited references (see below); the
// physics sampling (SimSampler/Molecules/Dipoles) is unchanged.
//
// References implemented verbatim:
//   • Gaussian beam   — en.wikipedia.org/wiki/Gaussian_beam  →  w(z)=w₀·√(1+(z/z_R)²), w₀=18, z_R=90.
//   • Mirror material — pmndrs/drei MeshTransmissionMaterial  →  transmission .05, thickness 8, rough .9, ior 2.5.
//   • Lighting        — three.js webgl_materials_physical_transmission  →  IBL from an HDR env + ACES tonemap,
//                       no discrete lights (the example has none — it is image-based lighting only).
import { Suspense } from "react";
import { Environment, MeshTransmissionMaterial, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { MutableRefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clusterLayout } from "./ensemble";

type Dyn = { eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; bright: Float64Array; modeAmp: Float64Array; hist: unknown } | null;
type Ens = { m: number; centers: [number, number, number][]; dipoles: [number, number, number][]; factors: Float64Array };
type Live = { pPhoton: number; pBright: number; pDark: number; molGlow: Float64Array };

// ── cavity geometry (world units), straight from the Gaussian-beam reference ────────────────────────────
const W0 = 18;                 // TEM₀₀ waist w₀ at the cavity centre z=0
const ZR = 90;                 // Rayleigh range z_R = π·w₀²/λ (given directly)
const DISC_SCALE = 2.5;        // visual radius = w(z)·2.5 (mode 1/e disc → on-screen disc)
const ANTINODES = [-150, -100, -50, 0, 50, 100, 150]; // 7 field-mode antinode planes along the optical axis
const MIRROR_Z = 160;          // DBR mirror faces at z = ±160
const MIRROR_R = 100;          // mirror aperture — must contain the beam at z=160 (w(160)·2.5 ≈ 91.8) + margin
// HDR environment the transmission example uses (pinned r150 — the dev branch dropped the .hdr). IBL only.
const ENV_HDR = "https://raw.githubusercontent.com/mrdoob/three.js/r150/examples/textures/equirectangular/royal_esplanade_1k.hdr";

/** Gaussian beam radius w(z)=w₀·√(1+(z/z_R)²), then scaled to the on-screen disc radius (×2.5).
 *  Even in z (the square makes it sign-independent). z=0→45.00, z=±50→51.48, z=±100→67.27, z=±150→87.46. */
const gaussianRadius = (z: number) => W0 * Math.sqrt(1 + (z / ZR) ** 2) * DISC_SCALE;

const MOL_R = 5.5;      // molecule glow-sphere base radius — small enough that individuals stay distinct
const DIP_OFF = new THREE.Color("#3a4046"), DIP_ON = new THREE.Color("#cfe8ff");

// Map the shared ensemble into the side-view cavity frame: optical axis = world Z, polarization ε̂=ŷ = world
// Y (vertical, perpendicular to the +X camera so it reads), the remaining transverse direction = world X
// (depth). dir = (d_z, d_y, d_x): ensemble axis(x)→Z, ε̂(y)→Y. clusterLayout's tight 3rd coord lands on Z,
// so the molecular film is thin along the optical axis and spread across the X–Y mode cross-section.
function buildFilm(ens: Ens) {
  let fmax = 1e-6; for (let i = 0; i < ens.m; i++) fmax = Math.max(fmax, Math.abs(ens.factors[i]!));
  const layout = clusterLayout(ens.m, ens.m); // deterministic spread, min 3D separation 12 (no merged blob)
  const mols = layout.map((p, i) => {
    const d = ens.dipoles[i]!;
    return {
      pos: new THREE.Vector3(p[0], p[1], p[2]),            // (X depth, Y vertical, Z optical-axis film)
      dir: new THREE.Vector3(d[2], d[1], d[0]).normalize(), // μ̂ into the side-view frame (ε̂→Y, axis→Z)
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
      pMatter += re * re + im * im; const b = bright[i - 1]!; brRe += b * re; brIm += b * im;
    }
    const pBright = brRe * brRe + brIm * brIm, pDark = Math.max(0, pMatter - pBright);
    for (let i = 0; i < m; i++) { const bw = Math.abs(bright[i]!); mg[i] = bw < 0.08 ? 0 : Math.min(bw * pBright * 6.0, 1.0); } // dark molecules (bright-weight < 0.08) never glow
    liveRef.current.pPhoton = pPhot; liveRef.current.pBright = pBright; liveRef.current.pDark = pDark; fieldAmpRef.current = pPhot;
  });
  return null;
}

// ── TEM₀₀ field mode: 7 antinode discs, radius = w(z)·2.5 from the Gaussian-beam formula. Flat cyan discs
// perpendicular to the optical axis (normal ∥ Z); viewed from the side their heights trace the hourglass
// waist. MeshBasicMaterial (unlit) #00ffff, opacity = 0.15 + 0.65·P_photon driven per frame. ───────────────
function FieldDiscs({ ampRef, opacityBase = 0.15, visible = true }: { ampRef: MutableRefObject<number>; opacityBase?: number; visible?: boolean }) {
  const discs = useMemo(() => ANTINODES.map((z) => ({ z, r: gaussianRadius(z) })), []);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    const amp = Math.max(0, Math.min(1, ampRef.current));
    const op = Math.min(0.95, opacityBase + 0.65 * amp); // 0.15 + 0.65·P_photon
    for (let i = 0; i < discs.length; i++) { const mt = mats.current[i]; if (mt) mt.opacity = op; }
  });
  if (!visible) return null;
  return (
    <group>
      {discs.map((d, i) => (
        // thin disc (flat cylinder, axis ∥ Z): a zero-thickness circle is exactly edge-on to the side
        // camera and would vanish — the small axial thickness makes each antinode read as a vertical bar of
        // height 2·w(z)·2.5, and the 7 bars together trace the Gaussian hourglass.
        <mesh key={i} position={[0, 0, d.z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[d.r, d.r, 3, 64]} />
          <meshBasicMaterial ref={(el) => { mats.current[i] = el; }} color="#00ffff" transparent opacity={opacityBase} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── DBR mirror faces: two discs at z=±160 with drei MeshTransmissionMaterial — a physically-correct
// dielectric (transmission .05 mostly reflective, thickness 8, roughness .9, ior 2.5 = the DBR n_H). Needs
// the HDR environment (below) to reflect/refract. Viewed from the side they read as thin dark ellipses. ──
function Mirrors() {
  return (
    <group>
      {[-MIRROR_Z, MIRROR_Z].map((z, i) => (
        // flat cylinder (axis ∥ Z) so the dielectric face has axial depth and reads from the side — a
        // zero-thickness circle would be exactly edge-on and invisible. thickness 8 matches the material.
        <mesh key={i} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[MIRROR_R, MIRROR_R, 8, 96]} />
          <MeshTransmissionMaterial transmission={0.05} thickness={8} roughness={0.9} ior={2.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// Molecules as faceted emitters: base #3d1a52 (dim), emissive #ff2222 with per-frame intensity =
// bright_weight·P_bright (set straight on each material, no re-render). toneMapped off so the bright ones
// stay saturated; dark ones sit unlit and dim. depthTest off + high renderOrder so they read on top.
function Molecules({ liveRef, film, scale }: { liveRef: MutableRefObject<Live>; film: Film; scale: number }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => { const mg = liveRef.current.molGlow; for (let i = 0; i < film.mols.length; i++) { const mt = mats.current[i]; if (mt) mt.emissiveIntensity = Math.min(1, mg[i] || 0); } });
  return (
    <group>
      {film.mols.map((mol, i) => (
        <mesh key={i} position={mol.pos} scale={scale} renderOrder={10}>
          <icosahedronGeometry args={[MOL_R, 1]} />
          <meshStandardMaterial ref={(el) => { mats.current[i] = el; }} color="#3d1a52" emissive="#ff2222" emissiveIntensity={0} roughness={0.4} metalness={0.1} toneMapped={false} transparent depthTest={false} depthWrite={false} />
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

// Cavity field polarization ε̂(θ): in the side-view frame ε̂ lives in the transverse Y–X plane — at θ=0 it
// is ŷ (vertical, ∥ the oriented dipoles), rotating toward x̂ (depth) as θ→90°, where g_i=g_0(μ̂·ε̂)→0 and
// the Rabi splitting collapses. An amber double-arrow through the centre.
function PolarizationAxis({ theta }: { theta: number }) {
  const L = W0 * 1.6, dir = new THREE.Vector3(Math.sin(theta), Math.cos(theta), 0); // θ=0 → ŷ (ε̂=ŷ)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <group quaternion={q}>
      <mesh><cylinderGeometry args={[0.7, 0.7, 2 * L, 12]} /><meshBasicMaterial color="#ffcc00" toneMapped={false} /></mesh>
      <mesh position={[0, L, 0]}><coneGeometry args={[2.2, 6, 14]} /><meshBasicMaterial color="#ffe066" toneMapped={false} /></mesh>
      <mesh position={[0, -L, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[2.2, 6, 14]} /><meshBasicMaterial color="#ffe066" toneMapped={false} /></mesh>
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
      {/* SIDE VIEW: optical axis = world Z (runs left↔right on screen); camera on +X, elevated +Y, looking
          at the origin — both mirror faces read as thin ellipses (z=∓160), the Gaussian hourglass narrows
          to the centre waist. ACES tonemap + HDR IBL exactly as the three.js transmission example. */}
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} orthographic camera={{ position: [180, 90, 0], zoom: 1.4, near: 1, far: 4000 }}>
        <color attach="background" args={["#05070e"]} />
        <OrthographicCamera makeDefault position={[180, 90, 0]} zoom={1.4} near={1} far={4000} />
        <Suspense fallback={null}>
          <Environment files={ENV_HDR} /> {/* IBL only — background stays the dark cavity-figure colour */}
        </Suspense>
        <SimSampler stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} liveRef={liveRef} fieldAmpRef={fieldAmpRef} m={m} />
        <Mirrors />
        <FieldDiscs ampRef={fieldAmpRef} opacityBase={controls.fieldOpacity} visible={controls.showFieldDiscs} />
        <Molecules liveRef={liveRef} film={film} scale={controls.moleculeScale} />
        {controls.showDipoleArrows ? <Dipoles film={film} scale={controls.moleculeScale} /> : null}
        <PolarizationAxis theta={polTheta} />
        <OrbitControls makeDefault enablePan={false} autoRotate={false} enableDamping dampingFactor={0.05} minZoom={0.6} maxZoom={4} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
