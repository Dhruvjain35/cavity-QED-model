// Live single-excitation cavity-QED view — this IS the simulation, painted in 3D. It reads the same
// arrowhead eigen-modes (dynState) and clock (simT) the 2D plots use, reconstructs ψ(t)=Σ_k c_k e^{−iE_k t}φ_k
// every frame, and renders it inside an OPEN Fabry–Pérot cavity. Everything that moves is driven by a real
// SimSampler quantity (P_photon, P_bright, P_dark, |ψ_i(t)|², E_k) — no invented physics, strictly unitary,
// one excitation conserved (P_photon+P_bright+P_dark ≡ 1). The legibility upgrades are: a docked live
// energy-partition readout (the vacuum-Rabi exchange, numerically), a hard anti-phase swing between the
// field discs and the emitter glow, static standing-wave annotation, and brighter per-emitter glow (the
// live Canvas has NO bloom, so glow must carry itself).
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { antinodes, beamRadius, DBRMirror, HALF, LightRig, STAGE_OFFSET, STAGE_SCALE, W0 } from "./cavityKit";
import { clusterLayout } from "./ensemble";

type Dyn = { eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; bright: Float64Array; modeAmp: Float64Array; hist: unknown } | null;
type Ens = { m: number; centers: [number, number, number][]; dipoles: [number, number, number][]; factors: Float64Array };
type Live = { pPhoton: number; pBright: number; pDark: number; molGlow: Float64Array };

const MOL_R = 5.5;
const C_BRIGHT = new THREE.Color("#ff2a2a"), C_DARK = new THREE.Color("#9e77ed");
const DIP_OFF = new THREE.Color("#3a4046"), DIP_ON = new THREE.Color("#cfe8ff");
// the cavity is shown in profile but tilted enough that the TEM₀₀ field discs read as ellipses (not pure
// edge-on slivers) so the standing wave is actually visible; small polar clamp keeps it from tumbling.
const LIVE_TILT: [number, number, number] = [0.30, 1.36, 0];

// Map the shared ensemble into the cavity frame and precompute the emissive gain so the brightest emitter
// reaches ≈2.0 emissive at P_bright=1 (each emitter only carries b_i²·P_bright of the excitation, so without
// an N-aware gain the molecules stay dim — that was the "I can't see it" bug).
function buildFilm(ens: Ens) {
  let fmax = 1e-6, s2 = 0, mx2 = 0;
  for (let i = 0; i < ens.m; i++) { const f = ens.factors[i]!; fmax = Math.max(fmax, Math.abs(f)); s2 += f * f; mx2 = Math.max(mx2, f * f); }
  const peakB2 = s2 > 1e-9 ? mx2 / s2 : 1;          // largest bright weight b_i² = (g_i/‖g‖)²
  const gain = 2.0 / Math.max(0.02, peakB2);        // |ψ_i|²·gain → ≈2.0 at the bright peak
  const layout = clusterLayout(ens.m, ens.m);
  const mols = layout.map((p, i) => {
    const d = ens.dipoles[i]!;
    return {
      pos: new THREE.Vector3(p[0], p[1], p[2]),
      dir: new THREE.Vector3(d[1], d[2], d[0]).normalize(),
      coupling: Math.abs(ens.factors[i]!) / fmax,    // |g_i|/max → 1 bright, → 0 decoupled/dark
    };
  });
  return { mols, gain };
}
type Film = ReturnType<typeof buildFilm>;

// Sample the live state once per frame → P_photon/P_bright/P_dark + per-molecule glow into refs (no React
// re-render). Inspect mode (inspectRef) freezes onto a chosen eigenstate, decomposed the SAME way so the
// partition still sums to 1.
function SimSampler({ stateRef, tRef, inspectRef, liveRef, fieldAmpRef, m }: { stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number>; inspectRef: MutableRefObject<number | null>; liveRef: MutableRefObject<Live>; fieldAmpRef: MutableRefObject<number>; m: number }) {
  useFrame(() => {
    const ds = stateRef.current; if (!ds || ds.n !== m + 1) return;
    const n = ds.n, t = tRef.current, inspK = inspectRef.current, { eigs, vecs, c, bright } = ds, mg = liveRef.current.molGlow;
    if (inspK != null && inspK >= 0 && inspK < n) {
      const pPhot = vecs[inspK]! * vecs[inspK]!; // row-0 photon weight of eigenvector k
      let br = 0, matter = 0;
      for (let i = 0; i < m; i++) { const v = vecs[(i + 1) * n + inspK]!; mg[i] = v * v; matter += v * v; br += bright[i]! * v; }
      const pBright = br * br, pDark = Math.max(0, matter - pBright);
      liveRef.current.pPhoton = pPhot; liveRef.current.pBright = pBright; liveRef.current.pDark = pDark; fieldAmpRef.current = pPhot; return;
    }
    let re0 = 0, im0 = 0; for (let k = 0; k < n; k++) { const a = vecs[k]! * c[k]!, ph = eigs[k]! * t; re0 += a * Math.cos(ph); im0 -= a * Math.sin(ph); }
    const pPhot = re0 * re0 + im0 * im0;
    let brRe = 0, brIm = 0, pMatter = 0;
    for (let i = 1; i < n; i++) {
      let re = 0, im = 0; const row = i * n;
      for (let k = 0; k < n; k++) { const a = vecs[row + k]! * c[k]!, ph = eigs[k]! * t; re += a * Math.cos(ph); im -= a * Math.sin(ph); }
      const exc = re * re + im * im; const b = bright[i - 1]!; // |ψ_i(t)|² = live per-molecule excitation
      pMatter += exc; brRe += b * re; brIm += b * im;
      mg[i - 1] = Math.abs(b) < 0.1 ? 0 : exc; // glow ∝ this molecule's own excitation; decoupled stays dark
    }
    const pBright = brRe * brRe + brIm * brIm, pDark = Math.max(0, pMatter - pBright);
    liveRef.current.pPhoton = pPhot; liveRef.current.pBright = pBright; liveRef.current.pDark = pDark; fieldAmpRef.current = pPhot;
  });
  return null;
}

// Emitters: a glyph whose emissive (red for bright/coupled → purple for decoupled, lerped by |g_i|) tracks
// |ψ_i(t)|²·gain, plus an additive halo that grows/brightens with the same excitation so it reads without
// bloom. NO motion/vibration/rotation (a 2-level Tavis–Cummings emitter has no nuclear coordinate); the only
// dynamic channel is excitation glow. Decoupled emitters (|b_i|<0.1, glow gated to 0) sit dim purple.
function Molecules({ liveRef, film, scale }: { liveRef: MutableRefObject<Live>; film: Film; scale: number }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const halos = useRef<(THREE.Mesh | null)[]>([]);
  const gain = film.gain;
  useFrame(() => {
    const mg = liveRef.current.molGlow;
    for (let i = 0; i < film.mols.length; i++) {
      const g = Math.min(1.2, (mg[i] || 0) * gain);
      const mt = mats.current[i]; if (mt) mt.emissiveIntensity = Math.min(2.2, g * 1.9);
      const h = halos.current[i]; if (h) { h.scale.setScalar(1 + 1.3 * g); (h.material as THREE.MeshBasicMaterial).opacity = Math.min(0.5, 0.05 + 0.45 * g); }
    }
  });
  return (
    <group>
      {film.mols.map((mol, i) => {
        const emis = C_DARK.clone().lerp(C_BRIGHT, mol.coupling); // decoupled purple → bright red
        return (
          <group key={i} position={mol.pos} scale={scale}>
            <mesh renderOrder={10}>
              <icosahedronGeometry args={[MOL_R, 1]} />
              <meshStandardMaterial ref={(el) => { mats.current[i] = el; }} color="#241326" emissive={emis} emissiveIntensity={0} roughness={0.45} metalness={0.1} toneMapped={false} transparent depthTest={false} depthWrite={false} />
            </mesh>
            <mesh ref={(el) => { halos.current[i] = el; }} renderOrder={9}>
              <sphereGeometry args={[MOL_R * 1.7, 16, 16]} />
              <meshBasicMaterial color={emis} transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Transition-dipole arrows μ̂_i — the SAME vectors that set g_i = g_0(μ̂·ε̂)f(r): coupled (∥ ε̂) → bright,
// decoupled (⟂ ε̂ or at the mode edge) → dim gray. Static per ensemble.
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
      <instancedMesh ref={shaftRef} args={[undefined, undefined, n]} renderOrder={8}>
        <cylinderGeometry args={[0.55, 0.55, 1, 8]} />
        <meshBasicMaterial toneMapped={false} transparent depthTest={false} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, n]} renderOrder={8}>
        <coneGeometry args={[1.3, 3.4, 10]} />
        <meshBasicMaterial toneMapped={false} transparent depthTest={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// Cavity field polarization ε̂(θ) — amber double-arrow through the centre (cavity-frame remap of the lab-frame
// ε̂=(0,cosθ,sinθ) defined in ensemble.ts; here it is drawn as (cosθ,sinθ,0)). Rotating it off the dipoles
// collapses g_i = g_0(μ̂·ε̂); at θ=90° the Rabi splitting vanishes.
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

// Static standing-wave annotation: faint cyan ring outlines at the 4 NODE planes (midpoints between the 5
// antinode discs) where |E|=0 — so the q=5 longitudinal mode structure is legible and obviously stationary
// (nodes don't move, radii don't breathe). Purely geometric, no dynamics.
function NodalRings() {
  const nodes = useMemo(() => { const a = antinodes(); const out: number[] = []; for (let i = 0; i < a.length - 1; i++) out.push((a[i]! + a[i + 1]!) / 2); return out; }, []);
  return (
    <group>
      {nodes.map((z, i) => (
        <mesh key={i} position={[0, 0, z]}>
          <ringGeometry args={[beamRadius(z) * 1.9, beamRadius(z) * 2.08, 56]} />
          <meshBasicMaterial color="#2dd4ff" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── TEM₀₀ field discs: Gaussian-intensity shader, additively blended; OPACITY = P_photon(t) (the single
// delocalized photon lives in ALL 5 antinodes at once — never a flying ball). Radius FIXED (mode volume does
// not breathe). The opacity curve is widened (0.05 + 0.92·amp^0.85) so the field visibly seesaws against the
// emitter glow over each Rabi period.
const FIELD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FIELD_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uOpacity;
uniform vec3  uColor;
void main() {
  float rho = length(vUv - 0.5) * 2.0;
  float intensity = exp(-7.0 * rho * rho);   // fuller bright core so the lit antinodes read as solid light
  if (intensity < 0.004) discard;
  gl_FragColor = vec4(uColor, intensity * uOpacity);
}`;
const makeFieldMaterial = () => new THREE.ShaderMaterial({
  vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
  uniforms: { uOpacity: { value: 0.12 }, uColor: { value: new THREE.Color(0x00ffff) } },
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
});

// Soft axial mode-glow filling the inter-mirror volume: a stretched ellipsoid whose OPACITY (not size)
// tracks P_photon, so the cavity visibly "fills with light" as the excitation enters the field and goes dark
// as it drains into the molecules — the energy sloshing made visceral while staying honest (intensity only,
// mode volume fixed, the single delocalized photon occupies the whole standing wave at once).
function ModeGlow({ ampRef, visible = true }: { ampRef: MutableRefObject<number>; visible?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { const m = ref.current; if (m) (m.material as THREE.MeshBasicMaterial).opacity = 0.015 + 0.13 * Math.min(1, Math.max(0, ampRef.current)); });
  if (!visible) return null;
  return (
    <mesh ref={ref} scale={[W0 * 1.7, W0 * 1.7, HALF * 0.92]}>
      <sphereGeometry args={[1, 28, 20]} />
      <meshBasicMaterial color="#15e8ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

function FieldDiscsShader({ ampRef, visible = true }: { ampRef: MutableRefObject<number>; visible?: boolean }) {
  const discs = useMemo(() => antinodes().map((z) => ({ z, r: beamRadius(z) * 2.2 })), []);
  const mats = useMemo(() => discs.map(() => makeFieldMaterial()), [discs]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const amp = Math.max(0, Math.min(1, ampRef.current));
    const op = Math.min(0.97, 0.05 + 0.92 * Math.pow(amp, 0.85)); // widened anti-phase swing; radius fixed
    for (let i = 0; i < mats.length; i++) mats[i]!.uniforms.uOpacity!.value = op;
  });
  if (!visible) return null;
  return (
    <group>
      {discs.map((d, i) => (
        <mesh key={i} ref={(el) => { meshes.current[i] = el; }} position={[0, 0, d.z]}>
          <circleGeometry args={[d.r, 64]} />
          <primitive object={mats[i]!} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ── docked LIVE READOUT (plain DOM, own rAF loop, zero React re-renders) — the missing on-scene quantitative
// view of the vacuum-Rabi exchange. Reads liveRef (P_photon/P_bright/P_dark, conserved to 1) + stateRef (Ω_R
// from the eigen-energy split) + tRef (clock) every frame and writes widths/text directly. Never renormalizes
// (drift would be a real bug, so the printed Σ must read 1.00).
function CavReadout({ liveRef, stateRef, tRef }: { liveRef: MutableRefObject<Live>; stateRef: MutableRefObject<Dyn>; tRef: MutableRefObject<number> }) {
  const el = useRef<Record<string, HTMLElement | null>>({});
  const spark = useRef<HTMLCanvasElement>(null);
  const prevP = useRef(0);
  useEffect(() => {
    const ring = { t: new Float32Array(320), p: new Float32Array(320), b: new Float32Array(320), n: 0, head: 0 };
    const set = (k: string, v: string) => { const e = el.current[k]; if (e && e.textContent !== v) e.textContent = v; };
    const width = (k: string, frac: number) => { const e = el.current[k]; if (e) e.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + "%"; };
    let raf = 0;
    const loop = () => {
      const live = liveRef.current, ds = stateRef.current, t = tRef.current;
      const pP = live.pPhoton, pB = live.pBright, pD = live.pDark, sum = pP + pB + pD;
      width("barP", pP); width("barB", pB); width("barD", pD);
      set("vP", pP.toFixed(2)); set("vB", pB.toFixed(2)); set("vD", pD.toFixed(2)); set("vSum", sum.toFixed(2));
      const OmR = ds && ds.n > 1 ? ds.eigs[ds.n - 1]! - ds.eigs[0]! : 0;
      const T = OmR > 1e-6 ? (2 * Math.PI) / OmR : 0;
      set("omR", OmR > 0 ? OmR.toFixed(3) : "—");
      set("per", T > 0 ? T.toFixed(1) : "—");
      set("phi", T > 0 ? ((((t % T) + T) % T) / T).toFixed(2) : "—");
      const dP = pP - prevP.current; prevP.current = pP;
      set("flow", Math.abs(dP) < 2e-4 ? "— balanced" : dP < 0 ? "▸ into matter" : "▸ into field");
      ring.t[ring.head] = t; ring.p[ring.head] = pP; ring.b[ring.head] = pB; ring.head = (ring.head + 1) % 320; ring.n = Math.min(320, ring.n + 1);
      drawSpark(spark.current, ring, T);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [liveRef, stateRef, tRef]);
  const R = (k: string) => (n: HTMLElement | null) => { el.current[k] = n; };
  return (
    <div className="cav-readout">
      <div className="cr-title">VACUUM-RABI EXCHANGE</div>
      <div className="cr-nums">
        <span>Ω<sub>R</sub> <b ref={R("omR")}>—</b></span>
        <span>T <b ref={R("per")}>—</b></span>
        <span>φ <b ref={R("phi")}>—</b></span>
        <span className="cr-flow" ref={R("flow")}>—</span>
      </div>
      <div className="cr-bar">
        <div className="cr-seg cr-p" ref={R("barP")} />
        <div className="cr-seg cr-b" ref={R("barB")} />
        <div className="cr-seg cr-d" ref={R("barD")} />
      </div>
      <div className="cr-legend">
        <span><i className="sw-p" />photon <b ref={R("vP")}>0.00</b></span>
        <span><i className="sw-b" />bright <b ref={R("vB")}>0.00</b></span>
        <span><i className="sw-d" />dark <b ref={R("vD")}>0.00</b></span>
        <span>Σ <b ref={R("vSum")}>1.00</b></span>
      </div>
      <canvas className="cr-spark" ref={spark} width={196} height={46} />
    </div>
  );
}

function drawSpark(cv: HTMLCanvasElement | null, ring: { t: Float32Array; p: Float32Array; b: Float32Array; n: number; head: number }, T: number) {
  if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
  const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#080b11"; ctx.fillRect(0, 0, W, H);
  const n = ring.n; if (n < 2) return;
  const at = (j: number) => (ring.head - n + j + 320) % 320;
  const t0 = ring.t[at(0)]!, t1 = ring.t[at(n - 1)]!, span = Math.max(1e-6, t1 - t0);
  const x = (t: number) => ((t - t0) / span) * (W - 1), y = (v: number) => (H - 2) - v * (H - 4);
  if (T > 0) { ctx.strokeStyle = "#1b2026"; ctx.lineWidth = 0.5; for (let tc = Math.ceil(t0 / T) * T; tc < t1; tc += T) { const xx = x(tc); ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, H); ctx.stroke(); } }
  const line = (arr: Float32Array, color: string) => { ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath(); for (let j = 0; j < n; j++) { const xx = x(ring.t[at(j)]!), yy = y(arr[at(j)]!); j === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); };
  line(ring.p, "#00ffff"); line(ring.b, "#ff3333");
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();
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
      <div className="cav-tag cav-tag-mode">ω<sub>c</sub> TEM₀₀ field · <span style={{ color: "#ffcc00" }}>ε̂</span> polariz. · cyan = photon</div>
      <CavReadout liveRef={liveRef} stateRef={stateRef} tRef={tRef} />
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 60, 330], fov: 50 }}>
        <color attach="background" args={["#05070e"]} />
        <PerspectiveCamera makeDefault fov={50} position={[0, 60, 330]} />
        <LightRig />
        <SimSampler stateRef={stateRef} tRef={tRef} inspectRef={inspectRef} liveRef={liveRef} fieldAmpRef={fieldAmpRef} m={m} />
        <group rotation={LIVE_TILT} scale={STAGE_SCALE} position={STAGE_OFFSET}>
          <DBRMirror side={-1} />
          <DBRMirror side={1} />
          <ModeGlow ampRef={fieldAmpRef} visible={controls.showFieldDiscs} />
          <NodalRings />
          <FieldDiscsShader ampRef={fieldAmpRef} visible={controls.showFieldDiscs} />
          <Molecules liveRef={liveRef} film={film} scale={controls.moleculeScale} />
          {controls.showDipoleArrows ? <Dipoles film={film} scale={controls.moleculeScale} /> : null}
          <PolarizationAxis theta={polTheta} />
        </group>
        <OrbitControls makeDefault enablePan={false} autoRotate={false} enableDamping dampingFactor={0.05} minDistance={150} maxDistance={600} minPolarAngle={Math.PI / 2 - 0.55} maxPolarAngle={Math.PI / 2 + 0.55} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
