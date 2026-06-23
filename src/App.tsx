import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import type { SceneControls } from "./cavity/LiveCavityScene";
import "katex/dist/katex.min.css";
import { loadWasm, Quantum, solveSpectrum, arrowheadModesGi, arrowheadMatrixGi, cavityPowerSpectrumGi, couplingSweepGi, htcSpectrum, htcSpectrumMulti, htcMatrixView, htcFranckCondon, wignerRawOfRho, cavityLayers, cavityField, cavityReflectance, type SimParams } from "./quantum/engine";

const HTC_EXPLICIT_CAP = 3; // N ≤ this → exact (N+1)·nv^N diagonalization; above → asymptotic 1/N decoupling
import { buildEnsemble, brightWeights } from "./cavity/ensemble";

const MODE_WAIST = 2.4; // TEM00 Gaussian mode waist w (length units of the molecular layout)

// Inline LaTeX via KaTeX — proper math symbols across the lab UI (no plain-text physics variables).
function Tex({ t }: { t: string }) {
  const html = useMemo(() => katex.renderToString(t, { throwOnError: false, displayMode: false }), [t]);
  return <span className="tex" dangerouslySetInnerHTML={{ __html: html }} />;
}
// Governing-equation strip under a panel title — the exact math the panel computes, in Computer-Modern
// (KaTeX). `where` is an optional compact symbol key. Renders as a thin instrument-style band.
function PanelEqn({ t, where }: { t: string; where?: string }) {
  const html = useMemo(() => katex.renderToString(t, { throwOnError: false, displayMode: true }), [t]);
  return (
    <div className="panel-eqn">
      <span className="pe-tag">computes</span>
      <span className="pe-tex" dangerouslySetInnerHTML={{ __html: html }} />
      {where ? <span className="pe-where">{where}</span> : null}
    </div>
  );
}

// PERF: returns `value` only after it has stopped changing for `delay` ms. The heavy per-tab recomputes key
// off the debounced inputs, so dragging a slider does NO synchronous physics on the main thread — the
// expensive solve runs once, after the drag settles.
function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

// three.js is heavy and only used by the cavity regime — load it on demand
const LiveCavityScene = lazy(() => import("./cavity/LiveCavityScene").then((m) => ({ default: m.LiveCavityScene })));

// ── Regime 1 (single emitter) ──
const N_GRID = 100, X_RANGE = 5, DT_FRAME = 0.18, T_LOOP = 45, SERIES_MAX = 600, INV_PI = 1 / Math.PI;
const BASE: SimParams = { nFock: 16, wc: 1.0, wa: 1.0, g: 0.2, kappa: 0.05, gamma: 0.02, gammaPhi: 0.0 };
const DFULL = 32; // 2·N_FOCK — full joint density matrix
// ── Regime 2 (collective) ──
const WA = 1.0, N_DELTA = 121, N_FOCK = 16, NB = 80;

// ── figure layouts (logical px) ──
const W_ML = 42, W_MR = 66, W_MT = 14, W_MB = 34, W_S = 236, NHG = 72; // W_MR holds the colorbar + its tick labels
const W_CW = W_ML + W_S + W_MR, W_CH = W_MT + W_S + W_MB, W_TICKS = [-4, -2, 0, 2, 4];
const S_ML = 44, S_MR = 14, S_MT = 12, S_PW = 808, S_PH = 176, S_MB = 26;
const S_CW = S_ML + S_PW + S_MR, S_CH = S_MT + S_PH + S_MB;
const DC_ML = 46, DC_MR = 14, DC_MT = 14, DC_PW = 806, DC_PH = 200, DC_MB = 28;
const DC_CW = DC_ML + DC_PW + DC_MR, DC_CH = DC_MT + DC_PH + DC_MB;
const BL_ML = 46, BL_MR = 16, BL_MT = 16, BL_MB = 30, BL_S = 380; // 4.A Bloch-projection square (fills its panel)
const BL_CW = BL_ML + BL_S + BL_MR, BL_CH = BL_MT + BL_S + BL_MB;
const DI_ML = 54, DI_MR = 16, DI_MT = 18, DI_MB = 34, DI_PW = 520, DI_PH = 184; // 4.C disorder broadening
const DI_CW = DI_ML + DI_PW + DI_MR, DI_CH = DI_MT + DI_PH + DI_MB;
const HB_ML = 16, HB_MR = 16, HB_MT = 30, HB_PW = 836, HB_PH = 210, HB_MB = 26;
const HB_CW = HB_ML + HB_PW + HB_MR, HB_CH = HB_MT + HB_PH + HB_MB;
const VB_ML = 14, VB_MR = 14, VB_MT = 28, VB_PW = 1040, VB_PH = 230, VB_MB = 30;
const VB_CW = VB_ML + VB_PW + VB_MR, VB_CH = VB_MT + VB_PH + VB_MB;
const P_ML = 56, P_MR = 16, P_MT = 16, P_MB = 40, P_W = 794, P_H = 424;
const P_CW = P_ML + P_W + P_MR, P_CH = P_MT + P_H + P_MB;
const B_ML = 24, B_MR = 8, B_MT = 8, B_MB = 20, B_S = 176;
const B_CW = B_ML + B_S + B_MR, B_CH = B_MT + B_S + B_MB;
const R_ML = 16, R_MR = 8, R_MT = 8, R_MB = 16, R_S = 256;
const R_CW = R_ML + R_S + R_MR, R_CH = R_MT + R_S + R_MB;
const CV_ML = 60, CV_MR = 60, CV_MT = 18, CV_MB = 42, CV_W = 1200, CV_H = 470;
const CV_CW = CV_ML + CV_W + CV_MR, CV_CH = CV_MT + CV_H + CV_MB;
const N0 = 1.0, NS = 1.52; // air / glass substrate
const RB_ML = 48, RB_MR = 16, RB_MT = 16, RB_MB = 30, RB_PW = 540, RB_PH = 250;
const RB_CW = RB_ML + RB_PW + RB_MR, RB_CH = RB_MT + RB_PH + RB_MB;
const DT_DYN = 0.22;
const PP_ML = 50, PP_MR = 14, PP_MT = 16, PP_MB = 28, PP_PW = 466, PP_PH = 176;
const PP_CW = PP_ML + PP_PW + PP_MR, PP_CH = PP_MT + PP_PH + PP_MB;
const HP_ML = 78, HP_MR = 16, HP_MT = 18, HP_MB = 30, HP_PW = 540, HP_PH = 320; // dressed-states scatter (fills its quadrant)
const HP_CW = HP_ML + HP_PW + HP_MR, HP_CH = HP_MT + HP_PH + HP_MB;
const FF_ML = 52, FF_MR = 14, FF_MT = 14, FF_MB = 28, FF_PW = 390, FF_PH = 300; // transmission spectrum (square-ish, fills its quadrant)
const FF_CW = FF_ML + FF_PW + FF_MR, FF_CH = FF_MT + FF_PH + FF_MB;
// 1.A · power-spectrum FFT length + sample step. The synthesized photon amplitude has fully decayed
// (e^{−Γt}) long before t = N·dt, so the extra samples zero-pad the transform: bin spacing
// Δω = 2π/(N·dt) drops to ≈ Γ/4, making each Lorentzian line ~4 bins wide. Below this the doublet was
// only ~1 bin wide → picket-fence undersampling sampled the two peaks at unequal fractions of their true
// height (the LP/UP asymmetry). N=8192 gives a measured LP/UP ratio ≥ 0.994 across the whole Γ range
// (verified vs the WASM in scratch/diag_fft.cjs); larger N re-introduces window-limited error at small Γ.
const FFT_N = 8192, FFT_DT = 0.14;
const SW_ML = 60, SW_MR = 18, SW_MT = 18, SW_MB = 32, SW_PW = 560, SW_PH = 408;
const SW_CW = SW_ML + SW_PW + SW_MR, SW_CH = SW_MT + SW_PH + SW_MB;
const SWEEP_GMAX = 0.2, SWEEP_STEPS = 90;
const HT_ML = 58, HT_MR = 18, HT_MT = 18, HT_MB = 32, HT_PW = 720, HT_PH = 372;
const HT_CW = HT_ML + HT_PW + HT_MR, HT_CH = HT_MT + HT_PH + HT_MB;
const HTC_GRID = 760; // absorption-spectrum sampling points
const MX_S = 196; // live Hamiltonian heatmap size (px)

// industrial spectroscopic palette: cyan photons · red excitons · amber phonons · purple dark · green calib.
const PANEL = "#0c0f12", INK = "#ffffff", DIM = "#8b949e", AXIS = "#484f58";
const CYAN = "#00ffff", RED = "#ff3333", AMBER = "#ffcc00", PURPLE = "#9e77ed", GREEN = "#00ff66";
const COBALT = CYAN, CRIMSON = RED, EMERALD = GREEN, SLATE = "#484f58"; // legacy aliases → new palette
const GRIDLINE = "#1b2026", DASH = "#1f242c", CROSS = "rgba(120,130,145,0.4)";

const minus = (s: string) => s.replace("-", "−");
const fmt = (v: number, d: number) => minus(v.toFixed(d));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lin = (a: number, b: number, s: number) => Math.round(a + (b - a) * s);

// dark diverging Wigner ramp (single source of truth for BOTH the field map and its colorbar):
// t=0 → crimson (−W, non-classical), t=0.5 → deep slate, t=1 → cobalt (+W). t is the normalised
// position in [−wmax,+wmax], i.e. t=(W+wmax)/2wmax.
function wignerRGB(t: number): [number, number, number] {
  t = clamp(t, 0, 1);
  if (t < 0.5) { const s = t / 0.5; return [lin(255, 16, s), lin(45, 23, s), lin(85, 38, s)]; }
  const s = (t - 0.5) / 0.5; return [lin(16, 56, s), lin(23, 122, s), lin(38, 246, s)];
}
// dark sequential Husimi ramp (Q ≥ 0): t=0 → panel slate, t=1 → pale cyan. t = Q/qmax.
function husimiRGB(t: number): [number, number, number] {
  t = clamp(t, 0, 1);
  if (t < 0.5) { const s = t / 0.5; return [lin(11, 34, s), lin(16, 211, s), lin(28, 238, s)]; }
  const s = (t - 0.5) / 0.5; return [lin(34, 224, s), lin(211, 247, s), lin(238, 255, s)];
}
function darkWigner(w: Float64Array, n: number, wmax: number): ImageData {
  const px = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < w.length; i++) {
    const [r, g, b] = wignerRGB((w[i]! + wmax) / (2 * wmax));
    const o = i * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  return new ImageData(px, n, n);
}
function husimiImage(q: Float64Array, n: number, qmax: number): ImageData {
  const px = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < q.length; i++) {
    const [r, g, b] = husimiRGB(q[i]! / qmax);
    const o = i * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  return new ImageData(px, n, n);
}

type SweepCol = { x: number; eigs: Float64Array; photon: Float64Array };
type Regime = "single" | "collective" | "cavity" | "dynamics" | "vibronic";
type Pt = { t: number; n: number; pe: number; pur: number; s: number };

// Curated example gallery — each preset loads a configured experiment and jumps to its tab, so a cold
// user has a one-click entry into each phenomenon (the 'where do I start' onboarding).
type Preset = {
  group: string; title: string; blurb: string; regime: Regime;
  params?: { g: number; kappa: number; gamma: number };
  sp?: { m: number; g: number; sigma: number };
  cav?: { lambda: number; nHi: number; nLo: number; pairs: number; nCav: number; g: number };
  cavN?: number;
  htc?: { wv: number; S: number; g: number; N: number; gamma: number };
  dyn?: { m: number; g: number; sigma: number };
};
const PRESETS: Preset[] = [
  { group: "Single emitter · open Jaynes–Cummings", title: "Vacuum-Rabi oscillation", blurb: "One quantum sloshing photon ↔ atom at the rate 2g — the textbook strong-coupling oscillation, lightly damped. Watch Panel C and the Wigner map.", regime: "single", params: { g: 0.3, kappa: 0.01, gamma: 0.01 } },
  { group: "Single emitter · open Jaynes–Cummings", title: "Weak / Purcell regime", blurb: "Cavity loss beats the coupling (2g < κ): no oscillation — the excitation just leaks away. Contrast with the strong-coupling preset.", regime: "single", params: { g: 0.05, kappa: 0.4, gamma: 0.05 } },
  { group: "Single emitter · open Jaynes–Cummings", title: "Decoherence in action", blurb: "Turn κ,γ up: watch the purity collapse and the Wigner function lose its non-classical negativity (red core fades).", regime: "single", params: { g: 0.3, kappa: 0.14, gamma: 0.14 } },
  { group: "Collective · Tavis–Cummings", title: "Polariton avoided crossing", blurb: "Tune the cavity through the emitters: the two bright polaritons (LP/UP) repel and never cross, split by 2g√N.", regime: "collective", sp: { m: 20, g: 0.1, sigma: 0 } },
  { group: "Collective · Tavis–Cummings", title: "Dark-state reservoir", blurb: "40 emitters → only 2 bright polaritons carry photon weight; the other 39 are dark/subradiant and invisible to light.", regime: "collective", sp: { m: 40, g: 0.08, sigma: 0 } },
  { group: "Collective · Tavis–Cummings", title: "Disorder washes out polaritons", blurb: "Add static energy disorder (σ ≳ Ω_R): the bright doublet broadens and the dark band spreads — strong coupling degrades.", regime: "collective", sp: { m: 20, g: 0.06, sigma: 0.12 } },
  { group: "Cavity hardware · DBR Fabry–Pérot", title: "Mirror stack → coupling g", blurb: "See how the DBR design sets the standing-wave field, the mode volume V_m, and therefore the single-emitter coupling g.", regime: "cavity", cav: { lambda: 550, nHi: 2.5, nLo: 1.46, pairs: 4, nCav: 1.6, g: 1.6 }, cavN: 1 },
  { group: "Cavity hardware · DBR Fabry–Pérot", title: "Collective crossover N*", blurb: "One molecule is too weak to beat the cavity loss; strong coupling (2g√N > κ) is reached only collectively, above N*.", regime: "cavity", cav: { lambda: 550, nHi: 2.5, nLo: 1.46, pairs: 4, nCav: 1.6, g: 1.6 }, cavN: 10000 },
  { group: "Live dynamics · real-time", title: "Vacuum-Rabi sloshing (3D)", blurb: "Watch one excitation slosh photon ↔ molecules in real time in 3D, alongside the clean transmission doublet.", regime: "dynamics", dyn: { m: 12, g: 0.06, sigma: 0.03 } },
  { group: "Live dynamics · real-time", title: "Collective enhancement", blurb: "More molecules → a larger Rabi splitting Ω_R = 2g√N and faster sloshing. Compare the populations period.", regime: "dynamics", dyn: { m: 30, g: 0.05, sigma: 0.03 } },
  { group: "Vibronic · Holstein–Tavis–Cummings", title: "Franck–Condon comb → polaritons", blurb: "A molecule's vibrational fingerprint (grey comb) collapses into LP/UP polaritons inside the cavity (cyan).", regime: "vibronic", htc: { wv: 0.15, S: 1.0, g: 0.05, N: 3, gamma: 0.012 } },
  { group: "Vibronic · Holstein–Tavis–Cummings", title: "Motional narrowing", blurb: "Under molecular disorder, the cavity polariton stays sharp far longer than a bare line — it averages over the ensemble.", regime: "vibronic", htc: { wv: 0.15, S: 1.0, g: 0.08, N: 3, gamma: 0.012 } },
];
const PRESET_GROUPS = [...new Set(PRESETS.map((p) => p.group))];

export function App() {
  const [regime, setRegime] = useState<Regime>("single");
  const [params, setParams] = useState({ g: 0.3, kappa: 0.02, gamma: 0.02 }); // 2.2 · Ω_R=2g≫κ → visible Rabi oscillations on load
  const [tol, setTol] = useState({ atol: 1e-6, rtol: 1e-6 });
  const [sp, setSp] = useState({ m: 20, g: 0.1, sigma: 0.0, seed: 1 });
  const [cav, setCav] = useState({ lambda: 550, nHi: 2.5, nLo: 1.46, pairs: 4, nCav: 1.6, g: 1.6 });
  const [cavN, setCavN] = useState(1); // CAVITY: emitter ensemble size N for the 2g√N-vs-κ collective-coupling demo
  const [htc, setHtc] = useState({ wv: 0.15, S: 1.0, g: 0.05, N: 3, gamma: 0.012 }); // HTC: ω_v, Huang-Rhys S, cavity g, collective N, broadening γ (units of ω_c). N=3 (the explicit-diagonalization cap) so the disorder panel opens in the collective regime where motional narrowing actually dominates (Ω_R=0.17 ⇒ crossover σ=Ω_R sits mid-plot), not the N=1 sliver where σ²/2Ω_R blows up.
  const [dyn, setDyn] = useState({ m: 12, g: 0.06, sigma: 0.03, seed: 1, init: 0, order: 1.0, gamma: 0.022, theta: 0 }); // CANONICAL DEFAULT — σ=0.03 locks the clean strong-coupling regime; τ resets to 0; populations show 0–6 Rabi cycles
  const [inspect, setInspect] = useState<number | null>(null); // clicked dressed eigenstate (UI badge)
  const [dynSweep, setDynSweep] = useState(false); // coupling-sweep dispersion mode (replaces the 3D)
  const [wcEv, setWcEv] = useState(2.0); // physical cavity-photon energy ℏω_c in eV (display scale only)
  // PERF: the heavy per-tab recomputes (ODE integration, arrowhead diagonalization, TMM sweeps) key off the
  // DEFERRED parameter values, so dragging a slider stays smooth (React reruns the expensive effect once the
  // drag settles, at low priority) instead of firing a full synchronous recompute on every input tick.
  const dParams = useDebounced(params, 180), dSp = useDebounced(sp, 180), dCav = useDebounced(cav, 180);
  const dCavN = useDebounced(cavN, 180), dDyn = useDebounced(dyn, 180), dHtc = useDebounced(htc, 180);
  const singleDirty = useRef(true), singleFrame = useRef(0); // PERF: gate/throttle the SINGLE phase-space redraws
  const redrawCurrent = useRef<() => void>(() => { }); // latest-closure redraw of the active regime (for resize)
  const [regLog, setRegLog] = useState<string[]>([]); // in-browser regression console output
  const [polAnim, setPolAnim] = useState(false); // polarization-sweep animation active
  const polRaf = useRef(0);
  // the shared molecular ensemble (positions, dipoles, coupling factors) — feeds BOTH the WASM
  // arrowhead and the 3D view, so orientation/position physics and visuals never diverge.
  const ensemble = useMemo(() => buildEnsemble(dyn.m, dyn.seed, dyn.order, MODE_WAIST, dyn.theta * Math.PI / 180), [dyn.m, dyn.seed, dyn.order, dyn.theta]);
  // live 3D-scene controls — a plain, reliably-clickable instrument panel (replaced Leva, whose embedded
  // panel sat under the WebGL canvas and would not expand on click). State here → controls prop → render.
  const [scene3d, setScene3d] = useState<SceneControls>({ autoRotate: false, fieldGlow: 1.0, moleculeScale: 1.0, moleculeGlow: 1.0, showFieldDiscs: true, showDipoleArrows: true });
  const setScene = (patch: Partial<SceneControls>) => setScene3d((s) => ({ ...s, ...patch }));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1); // DYNAMICS transport playback rate (×)
  const [fixedScale, setFixedScale] = useState(true);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false); // 3.F · COPY LINK flash
  const [about, setAbout] = useState(false);   // 3.G · about overlay
  const [gallery, setGallery] = useState(false); // examples / preset gallery overlay
  const [scenePanelOpen, setScenePanelOpen] = useState(false); // 3D-scene controls start collapsed

  const wigCanvas = useRef<HTMLCanvasElement>(null), husimiCanvas = useRef<HTMLCanvasElement>(null), seriesCanvas = useRef<HTMLCanvasElement>(null), decohereCanvas = useRef<HTMLCanvasElement>(null);
  const blochCanvas = useRef<HTMLCanvasElement>(null); // 4.A Bloch trajectory
  const blochCurve = useRef<{ n: number; T: number; data: Float32Array } | null>(null); // analytic spiral over ~6 Rabi cycles
  const popSeries = useRef<{ n: number; T: number; Trabi: number; data: Float32Array } | null>(null); // analytic photon/excited/purity/entropy over [0,T_LOOP]
  const hopBarsCanvas = useRef<HTMLCanvasElement>(null);
  const rhoCanvas = useRef<HTMLCanvasElement>(null), specCanvas = useRef<HTMLCanvasElement>(null);
  const bridgeCanvas = useRef<HTMLCanvasElement>(null);
  const cavCanvas = useRef<HTMLCanvasElement>(null);
  const stopCanvas = useRef<HTMLCanvasElement>(null);   // R(λ) stopband
  const collCanvas = useRef<HTMLCanvasElement>(null);   // 2g√N vs κ collective coupling
  const disorderCanvas = useRef<HTMLCanvasElement>(null); // 4.C
  const popCanvas = useRef<HTMLCanvasElement>(null);
  const hopCanvas = useRef<HTMLCanvasElement>(null);
  const dynState = useRef<{ eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; bright: Float64Array; modeAmp: Float64Array; hist: Float64Array[] } | null>(null);
  const simT = useRef(0);
  const speedRef = useRef(1), scrubbing = useRef(false); // transport: playback rate + scrub-drag latch
  const scrubRef = useRef<HTMLInputElement>(null), tpTimeRef = useRef<HTMLSpanElement>(null);
  const popCurve = useRef<{ T: number; split: number; n: number; data: Float32Array } | null>(null); // FIX 3 · analytic population trajectory over 6 Rabi cycles
  const hopMarks = useRef<{ x: number; y: number; k: number }[]>([]);
  const inspectRef = useRef<number | null>(null); // dressed eigenstate frozen onto the 3D (null = live)
  const fftCanvas = useRef<HTMLCanvasElement>(null), sweepCanvas = useRef<HTMLCanvasElement>(null);
  const fftData = useRef<{ omega: Float64Array; power: Float64Array } | null>(null);
  const sweepData = useRef<{ gs: Float64Array; eigs: Float64Array[] } | null>(null);
  const matCanvas = useRef<HTMLCanvasElement>(null);
  const matData = useRef<{ h: Float64Array; n: number } | null>(null);
  const htcCanvas = useRef<HTMLCanvasElement>(null), vibCompareCanvas = useRef<HTMLCanvasElement>(null);
  const htcData = useRef<{ live: { eigs: Float64Array; photon: Float64Array; absorption: Float64Array }; fc: { pos: Float64Array; weight: Float64Array }; nVib: number; method: string } | null>(null);
  const offscreen = useRef<HTMLCanvasElement | null>(null), husimiOff = useRef<HTMLCanvasElement | null>(null), bridgeOff = useRef<HTMLCanvasElement | null>(null);
  const quantum = useRef<Quantum | null>(null);
  const raf = useRef<number>(0), dpr = useRef(1);
  const regimeRef = useRef(regime), playingRef = useRef(playing), scaleRef = useRef(fixedScale), tolRef = useRef(tol);
  const sweepRef = useRef(dynSweep), dynGRef = useRef(dyn.g), wcRef = useRef(wcEv);
  // dimensionless (units of ω_c) → physical: energies/couplings to meV, dimensionless time to fs (ℏ = 0.6582 eV·fs)
  const toMeV = (dimless: number) => dimless * wcRef.current * 1000;
  const toFs = (dimlessT: number) => dimlessT * 0.6582 / wcRef.current;
  const series = useRef<Pt[]>([]), sweep = useRef<SweepCol[]>([]);
  const sel = useRef<{ j: number; k: number } | null>(null);
  const specMap = useRef({ emin: 0, emax: 1, R: 6 });
  const read = useRef<Record<string, HTMLSpanElement | null>>({});

  regimeRef.current = regime; playingRef.current = playing; scaleRef.current = fixedScale; tolRef.current = tol; speedRef.current = simSpeed;
  sweepRef.current = dynSweep; dynGRef.current = dyn.g; wcRef.current = wcEv;
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  useEffect(() => {
    let alive = true;
    loadWasm().then(() => {
      if (!alive) return;
      quantum.current?.dispose();
      quantum.current = new Quantum({ ...BASE, ...params });
      series.current = []; setReady(true); singleDirty.current = true; // PERF: force one redraw after a param change (even when paused)
      // FIX 3 · analytic Bloch spiral: integrate a fresh copy of the open system over [0,T] (T ≫ 1/(κ+γ))
      // and sample (2 Im ρ_01, ρ_00−ρ_11) at 600 points — the radius shrinks with decoherence → visible spiral.
      const merged = { ...BASE, ...params };
      const tmp = new Quantum(merged); tmp.reset();
      const NB = 220, TB = 60, dtb = TB / NB, bd = new Float32Array(NB * 2);
      for (let i = 0; i < NB; i++) { const b = tmp.emitterBloch(); bd[i * 2] = b[1]!; bd[i * 2 + 1] = b[2]!; tmp.advance(dtb, 1e-4, 1e-4); } // PERF: display curve — looser tol, fewer points
      tmp.dispose();
      blochCurve.current = { n: NB, T: TB, data: bd };
      // FIX 4 · analytic population window over [0,T_LOOP=45]: integrate a fresh copy and sample photon
      // ⟨a†a⟩ / excited ⟨P_e⟩ / purity / entropy at 300 points. The panel then shows ~3 damped vacuum-Rabi
      // cycles (Ω_R=2g) IMMEDIATELY — robust to the slow headless RAF (the live loop only reaches t≈8 by
      // screenshot time). A live cursor (wrapped mod T) marks where the running system currently sits.
      const tp = new Quantum(merged); tp.reset();
      const NP = 160, TP = T_LOOP, dtp = TP / NP, pd = new Float32Array(NP * 4);
      for (let i = 0; i < NP; i++) { pd[i * 4] = tp.photon; pd[i * 4 + 1] = tp.excited; pd[i * 4 + 2] = tp.purity; pd[i * 4 + 3] = tp.entropy; tp.advance(dtp, 1e-4, 1e-4); } // PERF: display curve — looser tol, fewer points
      tp.dispose();
      popSeries.current = { n: NP, T: TP, Trabi: Math.PI / Math.max(1e-6, merged.g), data: pd };
    });
    return () => { alive = false; };
  }, [dParams]);

  useEffect(() => { if (regime === "single") singleDirty.current = true; }, [regime]); // PERF: redraw on tab switch even if paused

  // Keep a fresh-closure redraw of the active regime so a window/layout resize re-renders the stretched
  // plots at the new displayed resolution (sized() reads getBoundingClientRect, so a redraw = crisp re-fit).
  redrawCurrent.current = () => {
    if (!ready) return;
    const r = regimeRef.current;
    if (r === "collective") renderSpectrum();
    else if (r === "cavity") { drawCavity(); drawStopband(); drawCollective(); }
    else if (r === "vibronic") { drawHtc(); drawMatrix(); drawVibronicCompare(); drawDisorder(); }
    else singleDirty.current = true; // single + dynamics run a RAF loop that redraws on the next frame
  };
  useEffect(() => {
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => redrawCurrent.current()); };
    window.addEventListener("resize", onResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    const center = document.querySelector(".center"); if (ro && center) ro.observe(center);
    // redraw once the web fonts (IBM Plex) finish loading so canvas axis labels aren't stuck on a fallback
    document.fonts?.ready?.then(() => redrawCurrent.current()).catch(() => { });
    return () => { window.removeEventListener("resize", onResize); ro?.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (regime !== "collective") return;
    loadWasm().then(() => {
      const R = Math.max(6, 2.6 * Math.sqrt(sp.m));
      const cols: SweepCol[] = [];
      for (let j = 0; j < N_DELTA; j++) {
        const x = -R + (2 * R * j) / (N_DELTA - 1);
        const { eigs, photon } = solveSpectrum(WA + x * sp.g, WA, sp.g, sp.m, sp.sigma, sp.seed);
        cols.push({ x, eigs, photon });
      }
      sweep.current = cols; specMap.current.R = R;
      const v = sel.current;
      if (!v || v.j >= cols.length || v.k >= cols[v.j]!.eigs.length) sel.current = argmaxPhoton(cols);
      renderSpectrum();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, dSp]);

  useEffect(() => {
    if (regime !== "cavity") return;
    loadWasm().then(() => { drawCavity(); drawStopband(); drawCollective(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, dCav, dCavN]);

  useEffect(() => {
    if (regime !== "dynamics") return;
    loadWasm().then(() => {
      const gi = Float64Array.from(ensemble.factors, (f) => f * dyn.g); // g_i = g_0·(μ̂_i·ε̂)·f(r_i)
      const { eigs, vecs, n } = arrowheadModesGi(WA, WA, dyn.sigma, dyn.seed, gi);
      const c = new Float64Array(n);
      for (let k = 0; k < n; k++) c[k] = vecs[dyn.init * n + k]!; // ⟨φ_k|ψ0⟩ for the chosen initial site
      const bright = brightWeights(ensemble.factors); // per-molecule b_i = g_i/‖g‖ — drives the live glow
      console.log(`%c[brightWeights]%c N=${ensemble.m} η=${dyn.order} θ=${dyn.theta}°  →  ${Array.from(bright).map((x) => x.toFixed(3)).join(", ")}`, "color:#00ffff;font-weight:600", "color:#8b949e");
      dynState.current = { eigs, vecs, n, c, bright, modeAmp: ensemble.modeAmp, hist: [] };
      // FIX 3 · precompute photon/bright/dark populations over 6 vacuum-Rabi cycles (analytic, from the
      // eigenmodes) so the panel shows the full oscillation + dephasing envelope at once, not frame-by-frame.
      const split = Math.max(1e-6, eigs[n - 1]! - eigs[0]!), NP = 320, T_POP = 6 * 2 * Math.PI / split, pdata = new Float32Array(NP * 3);
      for (let i = 0; i < NP; i++) { const d = decompAt(T_POP * i / (NP - 1)); pdata[i * 3] = d.ph; pdata[i * 3 + 1] = d.br; pdata[i * 3 + 2] = d.dk; }
      popCurve.current = { T: T_POP, split, n: NP, data: pdata };
      simT.current = 0;
      inspectRef.current = null; setInspect(null); // a new ensemble invalidates the inspected state
      matData.current = arrowheadMatrixGi(WA, WA, dyn.sigma, dyn.seed, gi);
      fftData.current = cavityPowerSpectrumGi(WA, WA, dyn.sigma, dyn.seed, gi, FFT_N, FFT_DT, dyn.gamma);
      logDoublet(fftData.current, eigs, n, gi); // 1.A · console check: peaks at ω_c±‖g‖, equal height
      if (dynSweep) sweepData.current = couplingSweepGi(WA, WA, dyn.sigma, dyn.seed, ensemble.factors, 0, SWEEP_GMAX, SWEEP_STEPS); // 90 diagonalizations — only when displayed
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, dDyn, dynSweep]);

  useEffect(() => {
    if (regime !== "vibronic") return;
    loadWasm().then(() => {
      const S = htc.S, lambda = Math.sqrt(S), N = htc.N;
      let live: { eigs: Float64Array; photon: Float64Array; absorption: Float64Array }, nVib: number, method: string;
      if (N <= HTC_EXPLICIT_CAP) {
        // EXACT N-body: build the full (N+1)·nv^N vibrational basis and diagonalize (no 1/N shortcut)
        nVib = N === 1 ? Math.min(40, Math.max(10, Math.round(8 + 4 * S))) : N === 2 ? 12 : 6;
        live = htcSpectrumMulti(WA, WA, htc.wv, lambda, htc.g, N, nVib);
        method = `exact ${N}-body · dim ${(N + 1) * nVib ** N}`;
      } else {
        // asymptotic polaron decoupling for large N: bright polariton sees λ→λ/√N, g→g√N (Chem Rev §6.4)
        nVib = Math.min(48, Math.max(10, Math.round(8 + 4 * S)));
        live = htcSpectrum(WA, WA, htc.wv, lambda / Math.sqrt(N), htc.g * Math.sqrt(N), nVib);
        method = `asymptotic 1/N (N>${HTC_EXPLICIT_CAP})`;
      }
      const fc = htcFranckCondon(WA, htc.wv, lambda, 12);
      htcData.current = { live, fc, nVib, method };
      // matrix inspector: the EXACT HTC matrix being solved (the Holstein/FC blocks light up with S)
      matData.current = N <= HTC_EXPLICIT_CAP
        ? htcMatrixView(WA, WA, htc.wv, lambda, htc.g, N, nVib, 64)
        : htcMatrixView(WA, WA, htc.wv, lambda / Math.sqrt(N), htc.g * Math.sqrt(N), 1, nVib, 64);
      drawHtc(); drawMatrix(); drawVibronicCompare(); drawDisorder(); updateHtcReadouts();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, dHtc, wcEv]);

  useEffect(() => {
    dpr.current = Math.min(window.devicePixelRatio || 1, 2);
    offscreen.current = mkCanvas(N_GRID); husimiOff.current = mkCanvas(NHG); bridgeOff.current = mkCanvas(NB);
    const loop = () => {
      const q = quantum.current;
      if (q && regimeRef.current === "single") {
        let adv = false;
        if (playingRef.current) {
          q.advance(DT_FRAME, tolRef.current.atol, tolRef.current.rtol);
          series.current.push({ t: q.time, n: q.photon, pe: q.excited, pur: q.purity, s: q.entropy });
          if (series.current.length > SERIES_MAX) series.current.shift();
          if (q.time > T_LOOP) { q.reset(); series.current = []; }
          adv = true;
        }
        // PERF: only redraw when the state advanced (playing) or a param just changed (dirty) — never burn CPU
        // on a paused tab; throttle the 100×100 Wigner/Husimi grids to every other frame during playback.
        if (adv || singleDirty.current) {
          drawSeries(); drawRho(q); drawDecohere(); drawBloch(); updateReadouts(q);
          if (singleDirty.current || singleFrame.current % 2 === 0) { drawWigner(q); drawHusimi(q); }
          singleFrame.current++; singleDirty.current = false;
        }
      } else if (regimeRef.current === "dynamics" && dynState.current) {
        if (playingRef.current && !scrubbing.current) simT.current += DT_DYN * speedRef.current;
        const d = decompAt(simT.current);
        // transport sync (DOM, no React re-render): scrub slider tracks simT over the 6-cycle window; τ readout
        const pc = popCurve.current, T = pc ? pc.T : 1, sc = scrubRef.current;
        if (sc) { sc.max = String(T); if (!scrubbing.current) sc.value = String(((simT.current % T) + T) % T); }
        if (tpTimeRef.current) tpTimeRef.current.textContent = `τ ${(pc ? pc.split * simT.current / (2 * Math.PI) : 0).toFixed(2)} cyc`;
        drawPopTraces(); drawDressed(); drawPowerSpectrum(); drawMatrix(); updateSimReadouts(d);
        if (sweepRef.current) drawSweep();
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3.F · shareable URL hash — restore all knobs from the hash on load, re-encode them on any change.
  useEffect(() => {
    const h = window.location.hash.slice(1); if (!h) return;
    try {
      const s = JSON.parse(atob(h));
      if (s.regime) setRegime(s.regime);
      if (s.params) setParams(s.params); if (s.sp) setSp(s.sp); if (s.cav) setCav(s.cav);
      if (s.htc) setHtc(s.htc); if (s.dyn) setDyn(s.dyn); if (typeof s.wcEv === "number") setWcEv(s.wcEv);
    } catch { /* malformed hash — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { window.location.replace("#" + btoa(JSON.stringify({ regime, params, sp, cav, htc, dyn, wcEv }))); } catch { /* noop */ }
  }, [regime, params, sp, cav, htc, dyn, wcEv]);
  function copyLink() {
    setCopied(true); setTimeout(() => setCopied(false), 1500); // flash regardless — clipboard is best-effort
    navigator.clipboard?.writeText(window.location.href).catch(() => { });
  }
  function applyPreset(p: Preset) {
    setRegime(p.regime);
    if (p.params) setParams(p.params);
    if (p.sp) setSp((s) => ({ ...s, ...p.sp }));
    if (p.cav) setCav(p.cav);
    if (p.cavN != null) setCavN(p.cavN);
    if (p.htc) setHtc(p.htc);
    if (p.dyn) setDyn((s) => ({ ...s, ...p.dyn }));
    if (p.regime === "single") singleDirty.current = true;
    setGallery(false);
  }

  // Each plot is drawn at a FIXED logical size w×h; the backing store is w×h×dpr (so it is crisp at 1:1 on a
  // retina display) and the canvas is shown at exactly w×h CSS px (inline). Panes are laid out around these
  // sizes — canvases are NEVER CSS-upscaled to "fill" (that both blurs and balloons the fonts).
  function sized(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
    const bw = Math.round(w * dpr.current), bh = Math.round(h * dpr.current);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; cv.style.width = w + "px"; cv.style.height = h + "px"; }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0);
    ctx.lineJoin = "round"; ctx.lineCap = "round"; // smooth curve joints
    return ctx;
  }

  // vertical colorbar reusing the EXACT field ramp, so colour → value is readable (the ±1/π Fock floor
  // for W; the auto-scaled peak for Q). `ticks` give the value label at fractional height f∈[0,1].
  function colorbar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ramp: (t: number) => [number, number, number], ticks: { f: number; label: string }[], caption: string) {
    for (let py = 0; py < h; py++) { const [r, g, b] = ramp(1 - py / (h - 1)); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(x, y + py, w, 1); }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = DIM; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const tk of ticks) { const py = y + (1 - tk.f) * h; seg(ctx, x + w, py, x + w + 3, py); ctx.fillText(tk.label, x + w + 5, py); }
    ctx.fillStyle = INK; ctx.font = "600 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(caption, x + w / 2, y - 3);
  }

  function drawWigner(q: Quantum) {
    const cv = wigCanvas.current, off = offscreen.current;
    if (!cv || !off) return;
    const ctx = sized(cv, W_CW, W_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, W_CW, W_CH);
    const w = q.wignerRaw(N_GRID);
    const wmax = scaleRef.current ? INV_PI : w.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
    off.getContext("2d")!.putImageData(darkWigner(w, N_GRID, wmax), 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.save(); ctx.translate(W_ML, W_MT + W_S); ctx.scale(W_S / N_GRID, -W_S / N_GRID); ctx.drawImage(off, 0, 0); ctx.restore();
    colorbar(ctx, W_ML + W_S + 16, W_MT, 11, W_S, wignerRGB,
      scaleRef.current ? [{ f: 1, label: "+1/π" }, { f: 0.5, label: "0" }, { f: 0, label: "−1/π" }]
        : [{ f: 1, label: "+" + wmax.toFixed(2) }, { f: 0.5, label: "0" }, { f: 0, label: minus("-" + wmax.toFixed(2)) }], "W");
    const xPx = (x: number) => W_ML + ((x + X_RANGE) / (2 * X_RANGE)) * W_S;
    const pPx = (p: number) => W_MT + ((X_RANGE - p) / (2 * X_RANGE)) * W_S;
    ctx.lineWidth = 0.5; ctx.strokeStyle = GRIDLINE;
    for (const t of W_TICKS) { if (t === 0) continue; seg(ctx, xPx(t), W_MT, xPx(t), W_MT + W_S); seg(ctx, W_ML, pPx(t), W_ML + W_S, pPx(t)); }
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; ctx.strokeStyle = CROSS;
    seg(ctx, xPx(0), W_MT, xPx(0), W_MT + W_S); seg(ctx, W_ML, pPx(0), W_ML + W_S, pPx(0)); ctx.restore();
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(W_ML, W_MT, W_S, W_S);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of W_TICKS) { seg(ctx, xPx(t), W_MT + W_S, xPx(t), W_MT + W_S + 3); ctx.fillText(minus(`${t}`), xPx(t), W_MT + W_S + 6); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of W_TICKS) { seg(ctx, W_ML, pPx(t), W_ML - 3, pPx(t)); ctx.fillText(minus(`${t}`), W_ML - 6, pPx(t)); }
    ctx.fillStyle = INK; ctx.font = "600 14px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("x", W_ML + W_S / 2, W_CH - 6);
    ctx.save(); ctx.translate(12, W_MT + W_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("p", 0, 0); ctx.restore();
  }

  function drawHusimi(q: Quantum) {
    const cv = husimiCanvas.current, off = husimiOff.current;
    if (!cv || !off) return;
    const ctx = sized(cv, W_CW, W_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, W_CW, W_CH);
    const qg = q.husimiRaw(NHG), qmax = qg.reduce((m, v) => Math.max(m, v), 1e-9);
    off.getContext("2d")!.putImageData(husimiImage(qg, NHG, qmax), 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.save(); ctx.translate(W_ML, W_MT + W_S); ctx.scale(W_S / NHG, -W_S / NHG); ctx.drawImage(off, 0, 0); ctx.restore();
    colorbar(ctx, W_ML + W_S + 16, W_MT, 11, W_S, husimiRGB,
      [{ f: 1, label: qmax.toFixed(2) }, { f: 0.5, label: (qmax / 2).toFixed(2) }, { f: 0, label: "0" }], "Q");
    const xPx = (x: number) => W_ML + ((x + X_RANGE) / (2 * X_RANGE)) * W_S;
    const pPx = (p: number) => W_MT + ((X_RANGE - p) / (2 * X_RANGE)) * W_S;
    ctx.lineWidth = 0.5; ctx.strokeStyle = GRIDLINE;
    for (const t of W_TICKS) { if (t === 0) continue; seg(ctx, xPx(t), W_MT, xPx(t), W_MT + W_S); seg(ctx, W_ML, pPx(t), W_ML + W_S, pPx(t)); }
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; ctx.strokeStyle = CROSS;
    seg(ctx, xPx(0), W_MT, xPx(0), W_MT + W_S); seg(ctx, W_ML, pPx(0), W_ML + W_S, pPx(0)); ctx.restore();
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(W_ML, W_MT, W_S, W_S);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of W_TICKS) { seg(ctx, xPx(t), W_MT + W_S, xPx(t), W_MT + W_S + 3); ctx.fillText(minus(`${t}`), xPx(t), W_MT + W_S + 6); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of W_TICKS) { seg(ctx, W_ML, pPx(t), W_ML - 3, pPx(t)); ctx.fillText(minus(`${t}`), W_ML - 6, pPx(t)); }
    ctx.fillStyle = INK; ctx.font = "600 14px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("x", W_ML + W_S / 2, W_CH - 6);
    ctx.save(); ctx.translate(12, W_MT + W_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("p", 0, 0); ctx.restore();
  }

  function drawSeries() {
    const cv = seriesCanvas.current; if (!cv) return;
    const ctx = sized(cv, S_CW, S_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, S_CW, S_CH);
    const ps = popSeries.current, T = ps ? ps.T : T_LOOP;
    const yOf = (v: number) => S_MT + (1 - v) * S_PH, xOf = (t: number) => S_ML + (t / T) * S_PW;
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillStyle = DIM;
    for (const v of [0, 0.5, 1]) {
      ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5;
      seg(ctx, S_ML, yOf(v), S_ML + S_PW, yOf(v)); seg(ctx, S_ML - 3, yOf(v), S_ML, yOf(v));
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), S_ML - 6, yOf(v));
    }
    if (ps) {
      // faint vacuum-Rabi period gridlines (Ω_R = 2g → period π/g) so the cycles are countable
      ctx.strokeStyle = DASH; ctx.setLineDash([1, 3]); ctx.lineWidth = 0.6;
      for (let tc = ps.Trabi; tc < T; tc += ps.Trabi) seg(ctx, xOf(tc), S_MT, xOf(tc), S_MT + S_PH);
      ctx.setLineDash([]);
      const trace = (off: number, color: string) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let i = 0; i < ps.n; i++) { const x = xOf((i / (ps.n - 1)) * T), y = yOf(Math.min(1, ps.data[i * 4 + off]!)); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      };
      trace(0, COBALT); trace(1, CRIMSON); trace(2, EMERALD); // ⟨a†a⟩, ⟨P_e⟩, purity
      const q = quantum.current; // live cursor — where the running open system currently sits in the window
      if (q) { const tc = ((q.time % T) + T) % T; ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; seg(ctx, xOf(tc), S_MT, xOf(tc), S_MT + S_PH); }
      ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const t of [0, T / 3, (2 * T) / 3, T]) ctx.fillText(t.toFixed(0), xOf(t), S_MT + S_PH + 5);
    }
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(S_ML, S_MT, S_PW, S_PH);
    ctx.fillStyle = INK; ctx.font = "600 12px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("time  t   (units of ω_c⁻¹, dimensionless)", S_ML + S_PW / 2, S_CH - 4);
    ctx.save(); ctx.translate(12, S_MT + S_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillText("population / probability  (dimensionless)", 0, 0); ctx.restore();
  }

  // FIX 4 (SINGLE) · decoherence panel: purity Tr(ρ²) and von Neumann entropy S(t) together — the
  // anticorrelated open-system signature as κ,γ mix the joint state (pure → mixed over time).
  function drawDecohere() {
    const cv = decohereCanvas.current; if (!cv) return;
    const ctx = sized(cv, DC_CW, DC_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, DC_CW, DC_CH);
    const ps = popSeries.current, T = ps ? ps.T : T_LOOP;
    const yOf = (v: number) => DC_MT + (1 - v) * DC_PH, xOf = (t: number) => DC_ML + (t / T) * DC_PW;
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif";
    for (const v of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, DC_ML, yOf(v), DC_ML + DC_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), DC_ML - 6, yOf(v)); }
    if (ps) {
      let smax = 0.1; for (let i = 0; i < ps.n; i++) if (ps.data[i * 4 + 3]! > smax) smax = ps.data[i * 4 + 3]!;
      ctx.strokeStyle = DASH; ctx.setLineDash([1, 3]); ctx.lineWidth = 0.6; // vacuum-Rabi period gridlines
      for (let tc = ps.Trabi; tc < T; tc += ps.Trabi) seg(ctx, xOf(tc), DC_MT, xOf(tc), DC_MT + DC_PH);
      ctx.setLineDash([]);
      const trace = (off: number, norm: number, color: string) => { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath(); for (let i = 0; i < ps.n; i++) { const x = xOf((i / (ps.n - 1)) * T), y = yOf(Math.max(0, Math.min(1, ps.data[i * 4 + off]! / norm))); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); };
      trace(2, 1, GREEN);      // purity Tr(ρ²) ∈ (0,1]
      trace(3, smax, AMBER);   // entropy S(t), normalized to its window max
      const q = quantum.current; if (q) { const tc = ((q.time % T) + T) % T; ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; seg(ctx, xOf(tc), DC_MT, xOf(tc), DC_MT + DC_PH); }
      ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top"; for (const t of [0, T / 3, (2 * T) / 3, T]) ctx.fillText(t.toFixed(0), xOf(t), DC_MT + DC_PH + 5);
      ctx.fillStyle = AMBER; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(`S (nats, ÷${smax.toFixed(2)} max=ln2)   ·   purity ∈ [0,1]`, DC_ML + 5, DC_MT + 4);
    }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(DC_ML, DC_MT, DC_PW, DC_PH);
    ctx.fillStyle = INK; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("time  t  (ω_c⁻¹)", DC_ML + DC_PW / 2, DC_CH - 5);
  }

  // 4.A (SINGLE) · Bloch-vector projection of the single-excitation effective qubit {|0,e⟩,|1,g⟩}.
  // Horizontal = 2 Im ρ_01 (the vacuum-Rabi coherence — for this coupling phase the oscillation lives in
  // the imaginary part; Re ρ_01 ≡ 0), vertical = ρ_00 − ρ_11 (inversion). The parametric trace of the
  // last 200 samples spirals inward toward the centre as κ,γ damp the coherence — decoherence, geometrically.
  function drawBloch() {
    const cv = blochCanvas.current; if (!cv) return;
    const ctx = sized(cv, BL_CW, BL_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, BL_CW, BL_CH);
    const cx = BL_ML + BL_S / 2, cy = BL_MT + BL_S / 2, R = (BL_S / 2) / 1.12;
    const xPx = (v: number) => cx + v * R, yPx = (v: number) => cy - v * R;
    ctx.strokeStyle = "#21262d"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke(); // unit circle
    ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = "#21262d"; ctx.lineWidth = 0.6; seg(ctx, xPx(-1.12), cy, xPx(1.12), cy); seg(ctx, cx, yPx(-1.12), cx, yPx(1.12));
    ctx.fillStyle = DIM; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of [-1, 1]) ctx.fillText(minus(`${t}`), xPx(t), cy + 4);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of [-1, 1]) ctx.fillText(minus(`${t}`), cx - 5, yPx(t));
    const bc = blochCurve.current; // analytic spiral: oldest at opacity 0.08, newest at 1.0
    if (bc && bc.n >= 2) {
      for (let i = 1; i < bc.n; i++) {
        ctx.strokeStyle = `rgba(0,255,255,${(0.08 + 0.92 * (i / (bc.n - 1))).toFixed(3)})`; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(xPx(bc.data[(i - 1) * 2]!), yPx(bc.data[(i - 1) * 2 + 1]!)); ctx.lineTo(xPx(bc.data[i * 2]!), yPx(bc.data[i * 2 + 1]!)); ctx.stroke();
      }
    }
    const q = quantum.current; // live cursor — where the running open system currently sits on the spiral
    if (q) { const b = q.emitterBloch(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(xPx(b[1]!), yPx(b[2]!), 3.5, 0, 2 * Math.PI); ctx.fill(); }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(BL_ML, BL_MT, BL_S, BL_S);
    ctx.fillStyle = INK; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("2 Im ρ₀₁  (coherence)", BL_ML + BL_S / 2, BL_CH - 6);
    ctx.save(); ctx.translate(12, BL_MT + BL_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("ρ₀₀ − ρ₁₁  (inversion)", 0, 0); ctx.restore();
  }

  // |ρ| of the joint cavity⊗emitter state. The single-excitation JC dynamics live in the low-Fock
  // manifold (|0,g⟩,|0,e⟩,|1,g⟩,…), so the full 32×32 is ~0 outside the top-left corner — we crop to
  // that populated block (cavity-first index 2n+atom) and render it as an explicit grid. Intensity is on
  // a FAITHFUL global |ρ| scale — normalized to the largest |ρ_ij| in-frame (a population), so the
  // diagonal reads brightest and the off-diagonal vacuum-Rabi coherence is the dimmer pair that pulses
  // cyan↔red and fades as κ,γ damp it. (A faithful magnitude scale, not a per-element auto-stretch.)
  const RHO_BLOCK = 8;
  function drawRho(q: Quantum) {
    const cv = rhoCanvas.current; if (!cv) return;
    const ctx = sized(cv, R_CW, R_CH);
    ctx.fillStyle = "#050708"; ctx.fillRect(0, 0, R_CW, R_CH);
    // Diverging colour map over the COMPLEX joint ρ. Intensity = |ρ_ij| (so populations AND the purely-
    // imaginary vacuum-Rabi coherence ρ[|0,e⟩,|1,g⟩] both show — a literal Re ρ map would render that
    // coherence black). Colour = SIGN of the dominant (real-or-imaginary) component: + → cyan, − → red.
    // In this JC manifold every element is purely real (populations, diagonal) or purely imaginary
    // (the coherence), so the coherence appears as an antisymmetric cyan/red conjugate pair off-diagonal,
    // flipping cyan↔red as the excitation sloshes atom↔cavity. No gray, no white at any value.
    const re = q.rhoReal(), im = q.rhoImag(), B = RHO_BLOCK, cell = R_S / B;
    let maxAbs = 1e-6;
    for (let i = 0; i < B; i++) for (let j = 0; j < B; j++) { const m = Math.hypot(re[i * DFULL + j]!, im[i * DFULL + j]!); if (m > maxAbs) maxAbs = m; }
    for (let i = 0; i < B; i++) for (let j = 0; j < B; j++) {
      const r = re[i * DFULL + j]!, m = im[i * DFULL + j]!, mag = Math.hypot(r, m);
      const v = Math.min(1, mag / maxAbs);                  // normalised to the largest |ρ_ij| this frame
      const signed = Math.abs(r) >= Math.abs(m) ? r : m;    // the non-zero (dominant) component carries the sign
      ctx.fillStyle = signed >= 0 ? lerpHex("#050708", "#00ffff", v) : lerpHex("#050708", "#ff3333", v);
      ctx.fillRect(R_ML + j * cell, R_MT + i * cell, cell, cell);
    }
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; // explicit 1px matrix grid
    for (let k = 0; k <= B; k++) { const p = k * cell; seg(ctx, R_ML + p, R_MT, R_ML + p, R_MT + R_S); seg(ctx, R_ML, R_MT + p, R_ML + R_S, R_MT + p); }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(R_ML, R_MT, R_S, R_S);
    ctx.fillStyle = DIM; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("0", R_ML + cell / 2, R_MT + R_S + 4); ctx.fillText(String(B - 1), R_ML + R_S - cell / 2, R_MT + R_S + 4);
    ctx.fillStyle = INK; ctx.font = "600 10px 'IBM Plex Sans',system-ui,sans-serif";
    ctx.fillText("|j⟩  (Fock n⊗{g,e})", R_ML + R_S / 2, R_CH - 4);
    ctx.save(); ctx.translate(9, R_MT + R_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("⟨i|", 0, 0); ctx.restore();
  }

  function updateReadouts(q: Quantum) {
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    const { g, kappa, gamma } = params;
    set("t", q.time.toFixed(2)); set("n", q.photon.toFixed(4)); set("pe", q.excited.toFixed(4));
    set("pur", q.purity.toFixed(4)); set("ent", q.entropy.toFixed(4)); set("coop", (g * g / (kappa * gamma)).toFixed(1));
    set("tr", q.trace.toFixed(6)); set("eig", q.minEig.toExponential(1));
  }

  function renderSpectrum() { drawSpectrum(); drawBridge(); drawHopfieldBars(); updateSpecReadouts(); }

  // FIX 4 (COLLECTIVE) · Hopfield composition of the selected eigenstate (photon cyan / matter red) +
  // the photon-weight distribution across all N+1 eigenstates: two tall bright polaritons, M−1
  // suppressed dark states — the superradiant/subradiant split made visually unmistakable.
  function drawHopfieldBars() {
    const cv = hopBarsCanvas.current, v = sel.current; if (!cv || !v || !sweep.current[v.j]) return;
    const ctx = sized(cv, HB_CW, HB_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, HB_CW, HB_CH);
    const col = sweep.current[v.j]!, phot = col.photon, n = phot.length, pk = Math.min(v.k, n - 1), pf = phot[pk]!, mf = Math.max(0, 1 - pf);
    // LEFT — selected eigenstate composition (two horizontal bars)
    const lx = HB_ML + 6, lw = HB_PW * 0.30, by = HB_MT + 12, bh = 28, gap = 18;
    ctx.fillStyle = INK; ctx.font = "600 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`SELECTED |ψ_k⟩  k=${pk}`, lx, by - 6);
    const hbar = (y: number, frac: number, c2: string, lab: string) => {
      ctx.fillStyle = "#0c0f12"; ctx.fillRect(lx, y, lw, bh);
      ctx.fillStyle = c2; ctx.fillRect(lx, y, lw * Math.max(0, Math.min(1, frac)), bh);
      ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(lx, y, lw, bh);
      ctx.fillStyle = "#fff"; ctx.font = "600 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(lab, lx + 5, y + bh / 2);
      ctx.textAlign = "right"; ctx.fillText(frac.toFixed(3), lx + lw - 5, y + bh / 2);
    };
    hbar(by, pf, CYAN, "photon  |⟨a|ψ⟩|²");
    hbar(by + bh + gap, mf, RED, "matter  |⟨σ|ψ⟩|²");
    // RIGHT — photon-weight distribution across all eigenstates
    const rx = HB_ML + HB_PW * 0.40, rw = HB_PW * 0.60, ry = HB_MT, rh = HB_PH, bw = rw / n;
    ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = "600 9.5px 'IBM Plex Sans',system-ui,sans-serif";
    ctx.fillText("PHOTON WEIGHT |⟨a|ψ_k⟩|² PER EIGENSTATE  ·  2 bright polaritons + N−1 dark", rx, ry - 6);
    const yb = (p: number) => ry + rh - p * rh;
    for (const p of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, rx, yb(p), rx + rw, yb(p)); ctx.fillStyle = DIM; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(p.toFixed(1), rx - 4, yb(p)); }
    for (let k = 0; k < n; k++) {
      const p = phot[k]!, x = rx + k * bw, dark = p < 0.05, bwid = Math.max(1, bw - 2);
      ctx.fillStyle = dark ? PURPLE : CYAN; // photon-bright polaritons cyan, dark/subradiant states purple (no amber)
      const by2 = dark ? ry + rh - 3 : yb(p), bh2 = dark ? 3 : p * rh;
      ctx.fillRect(x + 1, by2, bwid, bh2);
      if (k === pk) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, by2 - 1, bwid + 1, bh2 + 1); } // selected eigenstate → white outline
    }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = DIM; ctx.font = "600 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("eigenstate index k", rx + rw / 2, ry + rh + 5);
  }

  function drawSpectrum() {
    const cv = specCanvas.current; if (!cv || sweep.current.length === 0) return;
    const ctx = sized(cv, P_CW, P_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, P_CW, P_CH);
    const R = specMap.current.R;
    let emin = Infinity, emax = -Infinity;
    for (const s of sweep.current) for (const e of s.eigs) { if (e < emin) emin = e; if (e > emax) emax = e; }
    const pad = (emax - emin) * 0.06 || 0.1; emin -= pad; emax += pad;
    specMap.current.emin = emin; specMap.current.emax = emax;
    const xOf = (x: number) => P_ML + ((x + R) / (2 * R)) * P_W;
    const yOf = (e: number) => P_MT + ((emax - e) / (emax - emin)) * P_H;
    const xticks = niceTicks(-R, R, 5), yticks = niceTicks(emin, emax, 5);
    ctx.lineWidth = 0.5; ctx.strokeStyle = GRIDLINE;
    for (const t of xticks) seg(ctx, xOf(t), P_MT, xOf(t), P_MT + P_H);
    for (const e of yticks) seg(ctx, P_ML, yOf(e), P_ML + P_W, yOf(e));
    ctx.save(); ctx.setLineDash([4, 3]); ctx.lineWidth = 0.9; ctx.strokeStyle = "rgba(148,163,184,0.4)";
    seg(ctx, xOf(-R), yOf(WA - R * sp.g), xOf(R), yOf(WA + R * sp.g));
    seg(ctx, P_ML, yOf(WA), P_ML + P_W, yOf(WA)); ctx.restore();
    // dispersion fan: bright polariton branches coloured by Hopfield photon fraction (matter-red →
    // photon-cyan); the M−1 dark states rendered as thin purple horizontal lines pinned at ω_a.
    for (const s of sweep.current) {
      const x = xOf(s.x);
      for (let k = 0; k < s.eigs.length; k++) {
        const pf = s.photon[k]!; if (pf < 0.02) continue; // dark states drawn as flat lines below
        const y = yOf(s.eigs[k]!), t = Math.min(pf / 0.5, 1);
        ctx.fillStyle = lerpHex(RED, CYAN, t); ctx.beginPath(); ctx.arc(x, y, 1.3 + 1.8 * t, 0, 2 * Math.PI); ctx.fill();
      }
    }
    // 1.B · the N−1 dark / subradiant states sit at the (disordered) bare molecular energies, flat across
    // the full detuning axis (they never couple to the photon). σ=0 → one degenerate line at ω_a; σ>0 →
    // a band, each drawn individually. Sampled from the resonant column where photon weight cleanly = 0.
    const midCol = sweep.current[Math.floor(sweep.current.length / 2)]!;
    ctx.strokeStyle = PURPLE; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.8;
    let ndark = 0;
    for (let k = 0; k < midCol.eigs.length; k++) { if (midCol.photon[k]! >= 0.02) continue; seg(ctx, xOf(-R), yOf(midCol.eigs[k]!), xOf(R), yOf(midCol.eigs[k]!)); ndark++; }
    ctx.globalAlpha = 1;
    // label the two bright polariton branches LP / UP at the right edge, and the uncoupled asymptotes
    {
      const rc = sweep.current[sweep.current.length - 1]!;
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < rc.eigs.length; k++) { if (rc.photon[k]! < 0.02) continue; const e = rc.eigs[k]!; if (e < lo) lo = e; if (e > hi) hi = e; }
      ctx.font = "700 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillStyle = CYAN; ctx.fillText("UP", xOf(R) - 5, yOf(hi) - 9);
      ctx.fillStyle = "#ff7a5c"; ctx.fillText("LP", xOf(R) - 5, yOf(lo) + 9);
      ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillStyle = "rgba(148,163,184,0.75)"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText("bare cavity ω_c", xOf(R * 0.55) + 2, yOf(WA + R * 0.55 * sp.g) - 2);
    }
    if (ndark > 0) {
      const txt = `${ndark} dark / subradiant reservoir`, yLab = yOf(WA) - 3;
      ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = PANEL; ctx.fillRect(P_ML + P_W - 4 - tw - 3, yLab - 10, tw + 6, 12);
      ctx.fillStyle = PURPLE; ctx.fillText(txt, P_ML + P_W - 4, yLab);
    }
    const v = sel.current;
    if (v && sweep.current[v.j]) {
      const col = sweep.current[v.j]!, k = Math.min(v.k, col.eigs.length - 1);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(xOf(col.x), yOf(col.eigs[k]!), 5.5, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(P_ML, P_MT, P_W, P_H);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of xticks) { seg(ctx, xOf(t), P_MT + P_H, xOf(t), P_MT + P_H + 3); ctx.fillText(minus(`${Math.round(t)}`), xOf(t), P_MT + P_H + 6); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const e of yticks) { seg(ctx, P_ML, yOf(e), P_ML - 3, yOf(e)); ctx.fillText(fmt(e, 2), P_ML - 6, yOf(e)); }
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "13px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillText("cavity–emitter detuning  (ω_c − ω_a) / g   (dimensionless)", P_ML + P_W / 2, P_CH - 7);
    ctx.save(); ctx.translate(15, P_MT + P_H / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.textAlign = "center";
    ctx.font = "600 13px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillText("energy  E / ω_a   (dimensionless)", 0, 0); ctx.restore();
    // approximations footnote
    ctx.fillStyle = DIM; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("single-excitation Tavis–Cummings · RWA · ideal degenerate dark states", P_ML + 2, P_CH - 7);
  }

  function drawBridge() {
    const cv = bridgeCanvas.current, off = bridgeOff.current, v = sel.current;
    if (!cv || !off || !v || !sweep.current[v.j]) return;
    const col = sweep.current[v.j]!, k = Math.min(v.k, col.eigs.length - 1), c2 = col.photon[k]!;
    const re = new Float64Array(N_FOCK * N_FOCK), im = new Float64Array(N_FOCK * N_FOCK);
    re[0] = 1 - c2; re[N_FOCK + 1] = c2;
    off.getContext("2d")!.putImageData(darkWigner(wignerRawOfRho(re, im, N_FOCK, NB), NB, INV_PI), 0, 0);
    const ctx = sized(cv, B_CW, B_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, B_CW, B_CH);
    ctx.imageSmoothingEnabled = true;
    ctx.save(); ctx.translate(B_ML, B_MT + B_S); ctx.scale(B_S / NB, -B_S / NB); ctx.drawImage(off, 0, 0); ctx.restore();
    const cx = B_ML + B_S / 2, cy = B_MT + B_S / 2;
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 0.6; ctx.strokeStyle = CROSS;
    seg(ctx, cx, B_MT, cx, B_MT + B_S); seg(ctx, B_ML, cy, B_ML + B_S, cy); ctx.restore();
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(B_ML, B_MT, B_S, B_S);
    ctx.fillStyle = INK; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("x", B_ML + B_S / 2, B_CH - 6);
    ctx.save(); ctx.translate(10, B_MT + B_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("p", 0, 0); ctx.restore();
    const set = (key: string, t: string) => { const el = read.current[key]; if (el) el.textContent = t; };
    set("selKind", c2 > 0.5 ? "polariton (photonic)" : c2 < 0.05 ? "dark state" : "polariton");
    set("selE", col.eigs[k]!.toFixed(4)); set("selC", c2.toFixed(3)); set("selX", (1 - c2).toFixed(3));
    set("selW0", ((1 / Math.PI) * (1 - 2 * c2)).toFixed(4));
  }

  function updateSpecReadouts() {
    const set = (k: string, t: string) => { const el = read.current[k]; if (el) el.textContent = t; };
    const cols = sweep.current; if (cols.length === 0) return;
    const mid = cols[Math.floor(cols.length / 2)]!;
    set("rabi", (mid.eigs[mid.eigs.length - 1]! - mid.eigs[0]!).toFixed(4));
    const theory = 2 * sp.g * Math.sqrt(sp.m);
    set("rabiT", theory.toFixed(4));
    set("ndark", `${Array.from(mid.photon).filter((p) => p < 0.02).length}`); // DARK_PF=0.02 — same threshold the dispersion fan + on-plot count use (lines ~654/665)
    set("ratio", (sp.sigma / (theory || 1e-9)).toFixed(3));
  }

  function onSpecClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = specCanvas.current; if (!cv || sweep.current.length === 0) return;
    const rect = cv.getBoundingClientRect();
    // displayed CSS px → logical plot coords (canvas may be CSS-scaled below its native size)
    const lx = (e.clientX - rect.left) * (P_CW / rect.width), ly = (e.clientY - rect.top) * (P_CH / rect.height);
    // pick the nearest dot in PIXEL space using the exact xOf/yOf the drawing uses — guaranteed to match
    // what's on screen (no column-index/N_DELTA round-trip drift).
    const { emin, emax, R } = specMap.current;
    const xOf = (x: number) => P_ML + ((x + R) / (2 * R)) * P_W;
    const yOf = (en: number) => P_MT + ((emax - en) / (emax - emin)) * P_H;
    let bestJ = 0, bestK = 0, bestD = Infinity;
    for (let j = 0; j < sweep.current.length; j++) {
      const col = sweep.current[j]!; const x = xOf(col.x);
      for (let k = 0; k < col.eigs.length; k++) { const dx = x - lx, dy = yOf(col.eigs[k]!) - ly, d = dx * dx + dy * dy; if (d < bestD) { bestD = d; bestJ = j; bestK = k; } }
    }
    sel.current = { j: bestJ, k: bestK }; renderSpectrum();
  }

  // The full hardware → coupling chain, SI, from the cavity geometry. Every number is derived (no fit); the
  // only two INPUTS flagged as assumptions are w₀=λ/2n_c (transverse area — absent from the 1D TMM) and the
  // µ=5 D reference dipole used for g. Verified: L_DBR=301.6, L_eff=775.2 nm, F=36.3, Q=164, τ=47.8 fs,
  // κ=13.78 meV, stopband 33.8 %/186 nm, V_m=0.886(λ/n)³, g=0.08 meV ⇒ single-emitter WEAK (2g≪κ).
  function cavPhys() {
    const c = 299792458, hbar = 1.054571817e-34, eps0 = 8.8541878128e-12, eVj = 1.602176634e-19, Deb = 3.33564e-30;
    const lam = cav.lambda * 1e-9, nH = cav.nHi, nL = cav.nLo, ncv = cav.nCav, NP = cav.pairs;
    const Lcav = lam / (2 * ncv);                                  // half-wave spacer
    const wc = 2 * Math.PI * c / lam, EcEv = hbar * wc / eVj;       // cavity angular freq, photon energy (eV)
    const Ldbr = (lam / 2) * (nH * nL) / (2 * ncv * (nH - nL));     // DBR phase-penetration depth (vacuum-k₀ convention)
    const Leff = Lcav + 2 * Ldbr;
    const a = ncv * Math.pow(nL, 2 * NP), b = Math.pow(nH, 2 * NP); // mirror reflectivity from the cavity side (back = air)
    const Rm = Math.pow((a - b) / (a + b), 2);
    const FSR = c / (2 * ncv * Leff), F = Math.PI * Math.sqrt(Rm) / (1 - Rm), FWHM = FSR / F;
    const nu0 = c / lam, Q = nu0 / FWHM, tau = Q / wc, kappa = wc / Q, kappaMeV = hbar * kappa / eVj * 1e3;
    const dff = (4 / Math.PI) * Math.asin((nH - nL) / (nH + nL));   // stopband fractional width (contrast-limited)
    const w0 = lam / (2 * ncv), Aperp = Math.PI * w0 * w0 / 2, Vm = Aperp * Leff; // w₀ ASSUMED (diffraction limit)
    const Evac = Math.sqrt(hbar * wc / (2 * eps0 * Vm)), mu = 5 * Deb; // µ ASSUMED (5 Debye chromophore)
    const g = mu * Evac / hbar, gMeV = hbar * g / eVj * 1e3, Nstar = Math.pow(kappaMeV / (2 * gMeV), 2);
    return { LcavNm: Lcav * 1e9, LdbrNm: Ldbr * 1e9, LeffNm: Leff * 1e9, EcEv, Rm, FSRthz: FSR / 1e12, F,
      FWHMthz: FWHM / 1e12, Q, tauFs: tau * 1e15, kappaMeV, dffPct: dff * 100, dLamNm: dff * cav.lambda,
      VmRel: Vm / Math.pow(lam / ncv, 3), EvacMV: Evac / 1e6, gMeV, Nstar };
  }

  function drawCavity() {
    const cvEl = cavCanvas.current; if (!cvEl) return;
    const ctx = sized(cvEl, CV_CW, CV_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, CV_CW, CV_CH);
    const layers = cavityLayers(cav.lambda, cav.nHi, cav.nLo, cav.pairs, cav.nCav);
    let total = 0;
    const bands = layers.map((l) => { const b = { z0: total, d: l.d, n: l.n }; total += l.d; return b; });
    const { z, intensity } = cavityField(cav.lambda, cav.nHi, cav.nLo, cav.pairs, cav.nCav, N0, NS, 30);
    let imax = 1e-9, iAt = 0; for (let k = 0; k < intensity.length; k++) if (intensity[k]! > imax) { imax = intensity[k]!; iAt = k; }
    const ph = cavPhys();
    const xOf = (zz: number) => CV_ML + (zz / total) * CV_W;
    const yOf = (ii: number) => CV_MT + (1 - ii / imax) * CV_H;
    // ── n(z) refractive-index staircase: high-index layers dark-blue, low-index slate, spacer amber; the
    //    two fills make the λ/4 pairs countable. Right-hand axis is the true index scale. ──────────────────
    const cs = bands[cav.pairs * 2]!; // λ/2 cavity spacer
    for (const bnd of bands) {
      const isHi = Math.abs(bnd.n - cav.nHi) < 1e-6, isCav = Math.abs(bnd.n - cav.nCav) < 1e-6;
      ctx.fillStyle = isCav ? "rgba(245,158,11,0.10)" : isHi ? "rgba(56,84,150,0.34)" : "rgba(40,52,74,0.30)";
      ctx.fillRect(xOf(bnd.z0), CV_MT, Math.max(0.5, xOf(bnd.z0 + bnd.d) - xOf(bnd.z0)), CV_H);
    }
    const nmin = Math.min(cav.nLo, cav.nCav) - 0.15, nmax = cav.nHi + 0.15;
    const ynOf = (n: number) => CV_MT + (1 - (n - nmin) / (nmax - nmin)) * CV_H;
    ctx.strokeStyle = "rgba(140,160,190,0.55)"; ctx.lineWidth = 1; ctx.beginPath(); // literal n(z) step line
    let started = false;
    for (const bnd of bands) { const x0 = xOf(bnd.z0), x1 = xOf(bnd.z0 + bnd.d), yn = ynOf(bnd.n); if (!started) { ctx.moveTo(x0, yn); started = true; } else ctx.lineTo(x0, yn); ctx.lineTo(x1, yn); }
    ctx.stroke();
    ctx.fillStyle = "rgba(140,160,190,0.8)"; ctx.font = "500 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (const n of [cav.nLo, cav.nCav, cav.nHi]) { const yn = ynOf(n); seg(ctx, CV_ML + CV_W, yn, CV_ML + CV_W + 3, yn); ctx.fillText(n.toFixed(2), CV_ML + CV_W + 5, yn); }
    // ── |E(z)|² standing wave (left axis), antinode pinned in the spacer, exponential tails INTO the mirrors ──
    const fieldPath = () => { ctx.beginPath(); for (let k = 0; k < z.length; k++) { const x = xOf(z[k]!), y = yOf(intensity[k]!); k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } };
    fieldPath(); ctx.lineTo(xOf(total), CV_MT + CV_H); ctx.lineTo(CV_ML, CV_MT + CV_H); ctx.closePath();
    ctx.fillStyle = "rgba(245,158,11,0.16)"; ctx.fill();
    fieldPath(); ctx.strokeStyle = AMBER; ctx.lineWidth = 1.6; ctx.stroke();
    // ── emitter pinned to argmax(|E|²) with a guide line — the single most load-bearing teaching point ─────
    const zAnti = z[iAt]!, xAnti = xOf(zAnti);
    ctx.strokeStyle = "rgba(226,232,240,0.5)"; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; seg(ctx, xAnti, CV_MT, xAnti, CV_MT + CV_H); ctx.setLineDash([]);
    ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(xAnti, yOf(imax), 3.2, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("emitter @ antinode ⇒ g max", xAnti, CV_MT + 10);
    // ── penetration L_DBR over each mirror tail + L_eff bracket across the field region ─────────────────────
    const innerHalf = (ph.LcavNm) / 2, zL = cs.z0 + cs.d / 2 - innerHalf - ph.LdbrNm, zR = cs.z0 + cs.d / 2 + innerHalf + ph.LdbrNm;
    ctx.strokeStyle = CYAN; ctx.fillStyle = CYAN; ctx.lineWidth = 1; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const yb = CV_MT + CV_H - 8;
    seg(ctx, xOf(Math.max(0, zL)), yb, xOf(cs.z0), yb); ctx.fillText(`L_DBR ${ph.LdbrNm.toFixed(0)}nm`, xOf((Math.max(0, zL) + cs.z0) / 2), yb + 2);
    ctx.strokeStyle = "rgba(0,229,255,0.5)"; ctx.setLineDash([3, 2]);
    seg(ctx, xOf(Math.max(0, zL)), CV_MT + 14, xOf(Math.min(total, zR)), CV_MT + 14); ctx.setLineDash([]);
    ctx.fillStyle = CYAN; ctx.textBaseline = "top"; ctx.fillText(`L_eff = ${ph.LeffNm.toFixed(0)} nm`, (xOf(Math.max(0, zL)) + xOf(Math.min(total, zR))) / 2, CV_MT + 16);
    // axes
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(CV_ML, CV_MT, CV_W, CV_H);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of niceTicks(0, total, 6)) { const x = xOf(t); seg(ctx, x, CV_MT + CV_H, x, CV_MT + CV_H + 3); ctx.fillText(`${Math.round(t)}`, x, CV_MT + CV_H + 6); }
    ctx.fillStyle = AMBER; ctx.font = "600 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText(`peak |E|²/inc = ${imax.toFixed(2)}×`, CV_ML + CV_W - 4, CV_MT + 3); // field enhancement
    ctx.fillStyle = INK; ctx.font = "600 13px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
    ctx.fillText("z  (nm)", CV_ML + CV_W / 2, CV_CH - 7);
    ctx.save(); ctx.translate(14, CV_MT + CV_H / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillStyle = AMBER; ctx.fillText("|E(z)|²  (E₀⁺=1)", 0, 0); ctx.restore();
    ctx.save(); ctx.translate(CV_CW - 2, CV_MT + CV_H / 2); ctx.rotate(Math.PI / 2); ctx.fillStyle = "rgba(140,160,190,0.8)"; ctx.textBaseline = "top"; ctx.fillText("refractive index n", 0, 0); ctx.restore();
    // ── readout stack ──
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    set("cavLam", cav.lambda.toFixed(0)); set("cavWc", ph.EcEv.toFixed(3)); set("cavGap", ph.LcavNm.toFixed(0)); set("cavTotal", total.toFixed(0));
    set("cavLdbr", ph.LdbrNm.toFixed(1)); set("cavLeff", ph.LeffNm.toFixed(1));
    set("cavR", ph.Rm.toFixed(3)); set("cavFSR", ph.FSRthz.toFixed(1)); set("cavF", ph.F.toFixed(1)); set("cavFWHM", ph.FWHMthz.toFixed(2));
    set("cavQ", ph.Q.toFixed(0)); set("cavTau", ph.tauFs.toFixed(1)); set("cavKappa", ph.kappaMeV.toFixed(2));
    set("cavStop", `${ph.dffPct.toFixed(1)} %`); set("cavVm", ph.VmRel.toFixed(2)); set("cavGd", ph.gMeV.toFixed(3));
  }

  // Characteristic-matrix reflectance R(λ) of a FIXED layer stack at normal incidence (admittance η=n).
  // Needed because the WASM cavity_reflectance rebuilds the stack at the probe λ (always on-resonance), so
  // it can't sweep; this evaluates the stack designed at λ₀ across λ. Same TMM math validated for L_DBR.
  function tmmReflectance(layers: { n: number; d: number }[], lam: number, n0: number, ns: number): number {
    let a = 1, b = 0, c = 0, d = 0, e = 0, f = 0, g = 1, h = 0; // M = [[a+bi, c+di],[e+fi, g+hi]] = I
    for (const L of layers) {
      const dl = 2 * Math.PI * L.n * L.d / lam, co = Math.cos(dl), si = Math.sin(dl);
      const F0r = co, F1i = si / L.n, F2i = L.n * si, F3r = co;            // film [[co, i si/n],[i n si, co]]
      const n00r = a * F0r - d * F2i, n00i = b * F0r + c * F2i, n01r = c * F3r - b * F1i, n01i = a * F1i + d * F3r;
      const n10r = e * F0r - h * F2i, n10i = f * F0r + g * F2i, n11r = g * F3r - f * F1i, n11i = e * F1i + h * F3r;
      a = n00r; b = n00i; c = n01r; d = n01i; e = n10r; f = n10i; g = n11r; h = n11i;
    }
    const numr = e + g * ns, numi = f + h * ns, denr = a + c * ns, deni = b + d * ns, dd = denr * denr + deni * deni;
    const Yr = (numr * denr + numi * deni) / dd, Yi = (numi * denr - numr * deni) / dd;
    const rnr = n0 - Yr, rni = -Yi, rdr = n0 + Yr, rdi = Yi, rd = rdr * rdr + rdi * rdi;
    const rr = (rnr * rdr + rni * rdi) / rd, ri = (rni * rdr - rnr * rdi) / rd;
    return rr * rr + ri * ri;
  }

  // R(λ) of the full DBR cavity (TMM): a flat-topped high-R STOPBAND plateau (photonic bandgap) with the
  // sharp cavity-resonance transmission DIP at λ₀. Teaches that adding pairs DEEPENS, while index contrast
  // WIDENS — Δf/f₀ = (4/π)·arcsin((n_H−n_L)/(n_H+n_L)) is set by contrast, not pair count.
  function drawStopband() {
    const cv = stopCanvas.current; if (!cv) return;
    const ctx = sized(cv, RB_CW, RB_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, RB_CW, RB_CH);
    const lam0 = cav.lambda, lmin = 0.6 * lam0, lmax = 1.4 * lam0, M = 260;
    const xOf = (l: number) => RB_ML + ((l - lmin) / (lmax - lmin)) * RB_PW;
    const yOf = (R: number) => RB_MT + (1 - R) * RB_PH;
    const flat = cavityLayers(cav.lambda, cav.nHi, cav.nLo, cav.pairs, cav.nCav); // FIXED stack designed at λ₀
    const Rs: number[] = []; for (let s = 0; s <= M; s++) { const l = lmin + (lmax - lmin) * s / M; Rs.push(tmmReflectance(flat, l, N0, NS)); }
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif";
    for (const v of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, RB_ML, yOf(v), RB_ML + RB_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), RB_ML - 5, yOf(v)); }
    ctx.fillStyle = "rgba(56,84,150,0.18)"; for (let s = 0; s < M; s++) { if (Rs[s]! > 0.5) { const l = lmin + (lmax - lmin) * s / M; ctx.fillRect(xOf(l), RB_MT, Math.max(0.6, RB_PW / M + 0.6), RB_PH); } } // stopband shading
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.7; ctx.beginPath();
    for (let s = 0; s <= M; s++) { const l = lmin + (lmax - lmin) * s / M; const x = xOf(l), y = yOf(Rs[s]!); s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = AMBER; ctx.lineWidth = 1; seg(ctx, xOf(lam0), RB_MT, xOf(lam0), RB_MT + RB_PH); ctx.restore();
    const ph = cavPhys();
    ctx.fillStyle = AMBER; ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("resonance dip λ₀", xOf(lam0), RB_MT + 2);
    ctx.fillStyle = "rgba(120,150,210,0.95)"; ctx.textBaseline = "bottom"; ctx.fillText(`stopband Δf/f₀ = ${ph.dffPct.toFixed(0)}% (${ph.dLamNm.toFixed(0)}nm) · contrast-set`, RB_ML + RB_PW / 2, RB_MT + RB_PH - 3);
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(RB_ML, RB_MT, RB_PW, RB_PH);
    ctx.fillStyle = DIM; ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const l of [lmin, lam0, lmax]) { const x = xOf(l); seg(ctx, x, RB_MT + RB_PH, x, RB_MT + RB_PH + 3); ctx.fillText(`${Math.round(l)}`, x, RB_MT + RB_PH + 6); }
    ctx.fillStyle = INK; ctx.font = "600 12px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textBaseline = "alphabetic"; ctx.fillText("wavelength λ (nm)", RB_ML + RB_PW / 2, RB_CH - 6);
    ctx.save(); ctx.translate(11, RB_MT + RB_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("Reflectance R", 0, 0); ctx.restore();
  }

  // The single most important lesson of the tab: with a realistic dipole (µ=5 D) the SINGLE-emitter coupling
  // 2g sits far below κ — weak/Purcell. Strong coupling is reached only COLLECTIVELY when 2g√N crosses κ
  // (N* = (κ/2g)²); real polariton-chemistry ensembles (N~10⁶–10¹⁰) live deep above it. Log–log: 2g√N is a
  // slope-½ line, κ is horizontal, they cross at N*. The N slider moves the marker live.
  function drawCollective() {
    const cv = collCanvas.current; if (!cv) return;
    const ctx = sized(cv, RB_CW, RB_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, RB_CW, RB_CH);
    const ph = cavPhys(), g2 = 2 * ph.gMeV, kap = ph.kappaMeV;
    const Nx = 8; // log10(Nmax) = 8
    const ymin = Math.log10(Math.max(1e-3, g2 * 0.6)), ymax = Math.log10(g2 * Math.pow(10, Nx / 2) * 1.4);
    const xOf = (logN: number) => RB_ML + (logN / Nx) * RB_PW;
    const yOf = (logE: number) => RB_MT + (1 - (logE - ymin) / (ymax - ymin)) * RB_PH;
    const Nstar = ph.Nstar, logNstar = Math.log10(Math.max(1, Nstar));
    // strong-coupling region shading (N > N*)
    ctx.fillStyle = "rgba(0,229,255,0.07)"; ctx.fillRect(xOf(Math.min(Nx, logNstar)), RB_MT, RB_PW - (xOf(Math.min(Nx, logNstar)) - RB_ML), RB_PH);
    ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const e of [1, 10, 100, 1000]) { const le = Math.log10(e); if (le < ymin || le > ymax) continue; ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, RB_ML, yOf(le), RB_ML + RB_PW, yOf(le)); ctx.fillText(`${e}`, RB_ML - 4, yOf(le)); }
    // κ horizontal line
    ctx.strokeStyle = "#ff7080"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4; seg(ctx, RB_ML, yOf(Math.log10(kap)), RB_ML + RB_PW, yOf(Math.log10(kap))); ctx.setLineDash([]);
    ctx.fillStyle = "#ff7080"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(`κ = ${kap.toFixed(1)} meV`, RB_ML + 4, yOf(Math.log10(kap)) - 1);
    // 2g√N line (slope ½ in log-log)
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let s = 0; s <= 120; s++) { const logN = Nx * s / 120, E = g2 * Math.pow(10, logN / 2); ctx.lineTo(xOf(logN), yOf(Math.log10(E))); } ctx.stroke();
    // crossover marker
    if (logNstar >= 0 && logNstar <= Nx) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(xOf(logNstar), yOf(Math.log10(kap)), 2.6, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = DIM; ctx.font = "600 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`N* ≈ ${Nstar < 1e4 ? Math.round(Nstar) : Nstar.toExponential(0)}`, xOf(logNstar), yOf(Math.log10(kap)) + 4); }
    // current N marker + regime
    const logNcur = Math.log10(Math.max(1, cavN)), Ecur = g2 * Math.sqrt(Math.max(1, cavN)), strong = Ecur > kap;
    ctx.strokeStyle = AMBER; ctx.setLineDash([1, 2]); ctx.lineWidth = 1; seg(ctx, xOf(Math.min(Nx, logNcur)), RB_MT, xOf(Math.min(Nx, logNcur)), RB_MT + RB_PH); ctx.setLineDash([]);
    ctx.fillStyle = strong ? CYAN : "#ff9b50"; ctx.beginPath(); ctx.arc(xOf(Math.min(Nx, logNcur)), yOf(Math.log10(Math.max(Math.pow(10, ymin), Ecur))), 3, 0, 2 * Math.PI); ctx.fill();
    ctx.font = "600 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(`N=${cavN < 1e4 ? cavN : cavN.toExponential(0)} · 2g√N=${Ecur < 1 ? Ecur.toFixed(2) : Ecur.toFixed(0)} meV · ${strong ? "STRONG" : "weak"}`, RB_ML + RB_PW / 2, RB_MT + 2);
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(RB_ML, RB_MT, RB_PW, RB_PH);
    ctx.fillStyle = DIM; ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const p of [0, 2, 4, 6, 8]) { const x = xOf(p); seg(ctx, x, RB_MT + RB_PH, x, RB_MT + RB_PH + 3); ctx.fillText(`10${p === 0 ? "⁰" : p === 2 ? "²" : p === 4 ? "⁴" : p === 6 ? "⁶" : "⁸"}`, x, RB_MT + RB_PH + 6); }
    ctx.fillStyle = INK; ctx.font = "600 12px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textBaseline = "alphabetic"; ctx.fillText("emitter number N", RB_ML + RB_PW / 2, RB_CH - 6);
    ctx.save(); ctx.translate(11, RB_MT + RB_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("Ω_R = 2g√N (meV)", 0, 0); ctx.restore();
  }

  // ── live single-excitation dynamics: photon ⊕ N molecules in the dressed (polariton) basis ──
  // ψ(t) = Σ_k c_k e^{−iE_k t} φ_k — complex site amplitudes ψ_i(t) (i=0 photon, i≥1 molecule i).
  function ampsAt(t: number): { re: Float64Array; im: Float64Array } {
    const ds = dynState.current!;
    const { eigs, vecs, n, c } = ds;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0, m = 0; const row = i * n;
      for (let k = 0; k < n; k++) {
        const amp = vecs[row + k]! * c[k]!, ph = eigs[k]! * t;
        r += amp * Math.cos(ph); m -= amp * Math.sin(ph);
      }
      re[i] = r; im[i] = m;
    }
    return { re, im };
  }

  // Project the matter part onto the symmetric BRIGHT mode |B⟩=Σ_i|i⟩/√M (the only one the photon
  // couples to); the orthogonal remainder is the DARK manifold. Identical molecules ⇒ dark ≡ 0;
  // disorder leaks population bright→dark (verified vs WASM, norm conserved). Uniform g ⇒ b_i=1/√M.
  function decompAt(t: number): { ph: number; br: number; dk: number } {
    const ds = dynState.current!, n = ds.n, b = ds.bright; // b = g_i/‖g‖ (the true bright direction)
    const { re, im } = ampsAt(t);
    const ph = re[0]! * re[0]! + im[0]! * im[0]!;
    let reB = 0, imB = 0, pm = 0;
    for (let i = 1; i < n; i++) { const w = b[i - 1]!; reB += w * re[i]!; imB += w * im[i]!; pm += re[i]! * re[i]! + im[i]! * im[i]!; }
    const br = reB * reB + imB * imB;
    return { ph, br, dk: Math.max(0, pm - br) };
  }

  const DARKC = PURPLE; // dark-manifold (subradiant) colour

  // P3 · dressed-state spectrum: each eigenstate is a marker at (photon fraction |v₀ₖ|², energy E_k).
  // The two polaritons sit at the energy extremes near 50% photon; the M−1 dark states stack in a
  // vertical line at photon≈0, pinned at ω_a. Marker size ∝ initial occupation |c_k|². Click a marker
  // to freeze the 3D onto that eigenstate's molecular weights |vᵢₖ|² (→ dark states localize on a few
  // molecules; polaritons glow collectively). Recomputed live from the WASM eigen-decomposition.
  function drawDressed() {
    const cvEl = hopCanvas.current, ds = dynState.current; if (!cvEl || !ds) return;
    const ctx = sized(cvEl, HP_CW, HP_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, HP_CW, HP_CH);
    const { eigs, vecs, n, c } = ds;
    const emin = eigs[0]!, emax = eigs[n - 1]!, pad = (emax - emin) * 0.14 + 1e-4, elo = emin - pad, ehi = emax + pad;
    const xOf = (f: number) => HP_ML + f * HP_PW, yOf = (e: number) => HP_MT + (1 - (e - elo) / (ehi - elo)) * HP_PH;
    ctx.font = "500 8.5px 'IBM Plex Sans',system-ui,sans-serif";
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, xOf(f), HP_MT, xOf(f), HP_MT + HP_PH);
      ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(f.toFixed(2), xOf(f), HP_MT + HP_PH + 5);
    }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let t = 0; t <= 4; t++) { const e = elo + (ehi - elo) * t / 4, y = yOf(e); ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, HP_ML, y, HP_ML + HP_PW, y); ctx.fillStyle = DIM; ctx.fillText(fmt(e, 3), HP_ML - 7, y); }
    // dark-state reservoir band: the eigenstates with negligible photon weight (the excitonic
    // reservoir) clustered near ω_a. Shade and bracket it so the N-body structure is unmistakable.
    const md = ds.modeAmp, dark: number[] = [];
    for (let k = 0; k < n; k++) if (vecs[k]! * vecs[k]! < 0.02) dark.push(k);
    // E/ω_c = 1.0 calibration line (the uncoupled / bare-exciton energy) — dotted, full width
    const yA = yOf(WA);
    ctx.strokeStyle = "rgba(139,148,158,0.45)"; ctx.setLineDash([1, 3]); ctx.lineWidth = 0.75; seg(ctx, HP_ML, yA, HP_ML + HP_PW, yA); ctx.setLineDash([]);
    ctx.fillStyle = DIM; ctx.font = "9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText("E/ω_c=1", HP_ML + HP_PW - 3, yA - 2);
    if (dark.length) {
      let dlo = Infinity, dhi = -Infinity; for (const k of dark) { dlo = Math.min(dlo, eigs[k]!); dhi = Math.max(dhi, eigs[k]!); }
      const yb = yOf(dhi), yt = yOf(dlo), bw = xOf(0.05) - HP_ML, yc = (yb + yt) / 2;
      ctx.fillStyle = "rgba(158,119,237,0.12)"; ctx.fillRect(HP_ML, yb - 3, bw, (yt - yb) + 6);
      ctx.strokeStyle = "rgba(158,119,237,0.5)"; ctx.lineWidth = 0.75; ctx.strokeRect(HP_ML, yb - 3, bw, (yt - yb) + 6);
      // label parked in the empty right region with a leader line — never on the data
      const lx = xOf(0.6);
      ctx.strokeStyle = "rgba(158,119,237,0.4)"; ctx.lineWidth = 0.6; seg(ctx, HP_ML + bw, yc, lx - 4, yc);
      ctx.fillStyle = DARKC; ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`${dark.length} DARK / SUBRADIANT`, lx, yc - 5);
      ctx.fillStyle = DIM; ctx.font = "500 8px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillText("reservoir · zero photon wt.", lx, yc + 5);
    }
    // marker radius ∝ spatial mode-weight Σ|v_ik|²f(r_i) (Upgrade I): states on center molecules read
    // large, edge-localized states small — so shrinking the waist visibly shrinks edge dark states.
    const marks: { x: number; y: number; k: number }[] = [], inspK = inspectRef.current;
    for (let k = 0; k < n; k++) {
      const phot = vecs[k]! * vecs[k]!, occ = c[k]! * c[k]!;
      let mw = 0, mt = 0; for (let i = 1; i < n; i++) { const w = vecs[i * n + k]! * vecs[i * n + k]!; mw += w * md[i - 1]!; mt += w; }
      const modeW = mt > 1e-9 ? mw / mt : 1; // mean mode amplitude of the molecules in this state
      const x = xOf(phot), y = yOf(eigs[k]!), rad = 2.4 + 4.6 * modeW + 2.2 * Math.sqrt(Math.min(1, occ));
      marks.push({ x, y, k });
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI);
      ctx.fillStyle = lerpHex(DARKC, COBALT, Math.min(1, phot * 2)); ctx.globalAlpha = 0.55 + 0.45 * Math.sqrt(Math.min(1, occ)); ctx.fill(); ctx.globalAlpha = 1;
      if (k === inspK) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, rad + 3.5, 0, 2 * Math.PI); ctx.stroke(); }
    }
    hopMarks.current = marks;
    ctx.fillStyle = INK; ctx.font = "600 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("LP", xOf(vecs[0]! * vecs[0]!), yOf(eigs[0]!) - 9);
    ctx.fillText("UP", xOf(vecs[n - 1]! * vecs[n - 1]!), yOf(eigs[n - 1]!) - 9);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(HP_ML, HP_MT, HP_PW, HP_PH);
    ctx.fillStyle = DIM; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("photon fraction  |⟨a|ψ_k⟩|²", HP_ML + HP_PW / 2, HP_MT + HP_PH + 16);
    ctx.save(); ctx.translate(15, HP_MT + HP_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("energy  E_k / ω_c", 0, 0); ctx.restore();
  }

  // Upgrade III · live Hamiltonian inspector: pixel-grid heatmap of the exact (N+1)×(N+1) arrowhead the
  // WASM loop is diagonalizing. The diagonal carries the (disordered) site energies; the photon row/col
  // (the "arrow") carries the couplings g_i — cobalt for +, crimson for − (anti-aligned dipoles). √-scaled
  // so the small couplings are visible against the ~ω_c diagonal. It is the same array the Ĥ.npy exports.
  function drawMatrix() {
    const cvEl = matCanvas.current, m = matData.current; if (!cvEl || !m) return;
    const ctx = sized(cvEl, MX_S, MX_S);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, MX_S, MX_S);
    const ml = 18, mt = 14, mr = 6, mb = 16, n = m.n, h = m.h, cell = (MX_S - ml - mr) / n, gridOn = cell > 4.5;
    let maxAbs = 1e-9; for (let i = 0; i < h.length; i++) maxAbs = Math.max(maxAbs, Math.abs(h[i]!));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const val = h[i * n + j]!, v = Math.sqrt(Math.min(1, Math.abs(val) / maxAbs));
      ctx.fillStyle = val >= 0 ? lerpHex("#0c0f12", "#00ffff", v) : lerpHex("#0c0f12", "#ff3333", v);
      ctx.fillRect(ml + j * cell, mt + i * cell, cell + 0.7, cell + 0.7);
    }
    if (gridOn) { // razor-thin black dividers → explicit matrix grid, not a blurry image
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
      for (let k = 0; k <= n; k++) { const x = ml + k * cell, y = mt + k * cell; seg(ctx, x, mt, x, mt + n * cell); seg(ctx, ml, y, ml + n * cell, y); }
    }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(ml, mt, n * cell, n * cell);
    ctx.fillStyle = DIM; ctx.font = "600 8px 'IBM Plex Sans',system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(`|j⟩  0…${n - 1}`, ml + n * cell / 2, mt + n * cell + 3);
    ctx.save(); ctx.translate(ml - 5, mt + n * cell / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "bottom"; ctx.fillText(`⟨i|  0…${n - 1}`, 0, 0); ctx.restore();
    ctx.fillStyle = CYAN; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = "600 7.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.fillText("⟨0|=photon", ml, mt - 2);
  }

  function onHopClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = hopCanvas.current; if (!cv) return;
    const r = cv.getBoundingClientRect();
    const px = (e.clientX - r.left) * (HP_CW / r.width), py = (e.clientY - r.top) * (HP_CH / r.height);
    let best = -1, bd = 1e9;
    for (const m of hopMarks.current) { const d = (m.x - px) ** 2 + (m.y - py) ** 2; if (d < bd) { bd = d; best = m.k; } }
    const nk = best >= 0 && bd < 420 ? (best === inspectRef.current ? null : best) : null;
    inspectRef.current = nk; setInspect(nk);
  }

  // #9 · cavity transmission/PL power spectrum S(ω) (FFT of the photon amplitude, computed in Rust):
  // the vacuum-Rabi doublet at the polariton energies; raise σ and the peaks broaden and wash out.
  function drawPowerSpectrum() {
    const cvEl = fftCanvas.current, fd = fftData.current, ds = dynState.current; if (!cvEl || !fd || !ds) return;
    const ctx = sized(cvEl, FF_CW, FF_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, FF_CW, FF_CH);
    // X-axis SYMMETRIC about the bare cavity resonance ω/ω_c = 1 so the Rabi doublet reads symmetric
    const lo = ds.eigs[0]!, hi = ds.eigs[ds.n - 1]!, hw = Math.max(0.5, (hi - lo) * 0.7 + 0.08), wlo = WA - hw, whi = WA + hw;
    const xOf = (w: number) => FF_ML + (w - wlo) / (whi - wlo) * FF_PW, yOf = (p: number) => FF_MT + (1 - p) * FF_PH;
    ctx.font = "500 8.5px 'IBM Plex Sans',system-ui,sans-serif";
    for (const p of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, FF_ML, yOf(p), FF_ML + FF_PW, yOf(p)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(p.toFixed(1), FF_ML - 6, yOf(p)); }
    // uniform ω ticks every 0.5 with a fine dashed vertical grid for lineshape tracking
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let w = Math.ceil(wlo / 0.5) * 0.5; w <= whi + 1e-6; w += 0.5) {
      const x = xOf(w); ctx.strokeStyle = DASH; ctx.setLineDash([1, 3]); ctx.lineWidth = 0.6; seg(ctx, x, FF_MT, x, FF_MT + FF_PH); ctx.setLineDash([]);
      ctx.fillStyle = DIM; ctx.fillText(w.toFixed(1), x, FF_MT + FF_PH + 5);
    }
    // ω/ω_c = 1 resonance marker
    ctx.strokeStyle = "rgba(139,148,158,0.5)"; ctx.setLineDash([1, 3]); ctx.lineWidth = 0.75; seg(ctx, xOf(WA), FF_MT, xOf(WA), FF_MT + FF_PH); ctx.setLineDash([]);
    const om = fd.omega, pw = fd.power;
    const path = (close: boolean) => { ctx.beginPath(); let st = false; for (let i = 0; i < om.length; i++) { const w = om[i]!; if (w < wlo) continue; if (w > whi) break; const x = xOf(w), y = yOf(Math.min(1, pw[i]!)); if (!st) { if (close) { ctx.moveTo(x, yOf(0)); ctx.lineTo(x, y); } else ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y); } if (close && st) { ctx.lineTo(xOf(Math.min(whi, om[om.length - 1]!)), yOf(0)); ctx.closePath(); } };
    path(true); ctx.fillStyle = "rgba(0,255,255,0.12)"; ctx.fill();
    path(false); ctx.strokeStyle = CYAN; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(FF_ML, FF_MT, FF_PW, FF_PH);
    ctx.fillStyle = DIM; ctx.font = "10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("ω/ω_c", FF_ML + FF_PW / 2, FF_CH - 11);
    ctx.save(); ctx.translate(13, FF_MT + FF_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("S(ω)", 0, 0); ctx.restore();
  }

  // #12 · coupling-sweep dispersion fan (Rust loop over g): the two bright polaritons split as 2g√M
  // while the M−1 dark states stay pinned at ω_a. Amber line marks the live coupling.
  function drawSweep() {
    const cvEl = sweepCanvas.current, sw = sweepData.current; if (!cvEl || !sw) return;
    const ctx = sized(cvEl, SW_CW, SW_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, SW_CW, SW_CH);
    const steps = sw.gs.length, K = sw.eigs[0]!.length;
    let emin = Infinity, emax = -Infinity;
    for (const e of sw.eigs) for (let i = 0; i < K; i++) { emin = Math.min(emin, e[i]!); emax = Math.max(emax, e[i]!); }
    const pad = (emax - emin) * 0.08 + 1e-3; emin -= pad; emax += pad;
    const xOf = (g: number) => SW_ML + (g / SWEEP_GMAX) * SW_PW, yOf = (e: number) => SW_MT + (1 - (e - emin) / (emax - emin)) * SW_PH;
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif";
    for (let t = 0; t <= 4; t++) { const g = SWEEP_GMAX * t / 4; ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, xOf(g), SW_MT, xOf(g), SW_MT + SW_PH); ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(g.toFixed(2), xOf(g), SW_MT + SW_PH + 6); }
    for (let t = 0; t <= 4; t++) { const e = emin + (emax - emin) * t / 4; ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, SW_ML, yOf(e), SW_ML + SW_PW, yOf(e)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmt(e, 2), SW_ML - 7, yOf(e)); }
    for (let i = 0; i < K; i++) {
      const bright = i === 0 || i === K - 1;
      ctx.strokeStyle = bright ? COBALT : "rgba(176,140,240,0.45)"; ctx.lineWidth = bright ? 1.9 : 0.9; ctx.beginPath();
      for (let s = 0; s < steps; s++) { const x = xOf(sw.gs[s]!), y = yOf(sw.eigs[s]![i]!); s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const gx = xOf(Math.min(SWEEP_GMAX, dynGRef.current));
    ctx.strokeStyle = "rgba(245,158,11,0.85)"; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); seg(ctx, gx, SW_MT, gx, SW_MT + SW_PH); ctx.setLineDash([]);
    ctx.fillStyle = AMBER; ctx.font = "600 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("g = " + fmt(dynGRef.current, 3), gx, SW_MT - 3);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(SW_ML, SW_MT, SW_PW, SW_PH);
    ctx.fillStyle = INK; ctx.font = "600 12px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("coupling  g_0 / ω_c", SW_ML + SW_PW / 2, SW_MT + SW_PH + 18);
    ctx.save(); ctx.translate(16, SW_MT + SW_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("energy  E / ω_c", 0, 0); ctx.restore();
    ctx.font = "600 10px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = COBALT; ctx.fillText("UP", SW_ML + SW_PW + 5, yOf(sw.eigs[steps - 1]![K - 1]!));
    ctx.fillText("LP", SW_ML + SW_PW + 5, yOf(sw.eigs[steps - 1]![0]!));
    ctx.fillStyle = DARKC; ctx.fillText("dark", SW_ML + SW_PW + 5, yOf(sw.eigs[steps - 1]![Math.floor(K / 2)]!));
  }

  // Feature A · single-molecule HTC absorption: bare-molecule Franck–Condon progression (grey) vs the
  // in-cavity / collective spectrum (cobalt). At N=1, g>0 the 0-0 line splits into vibronic polaritons;
  // as N grows the bright sidebands collapse toward 0-0 (polaron decoupling, λ→λ/√N).
  function drawHtc() {
    const cvEl = htcCanvas.current, hd = htcData.current; if (!cvEl || !hd) return;
    const ctx = sized(cvEl, HT_CW, HT_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, HT_CW, HT_CH);
    const N = htc.N, gamma = htc.gamma, split = 2 * htc.g * Math.sqrt(N);
    const wlo = WA - htc.S * htc.wv - split * 0.7 - 0.12, whi = WA + 7 * htc.wv + 0.12;
    const xOf = (w: number) => HT_ML + (w - wlo) / (whi - wlo) * HT_PW, yOf = (a: number) => HT_MT + (1 - a) * HT_PH;
    const curve = (pos: Float64Array, wt: Float64Array) => {
      const ys = new Float64Array(HTC_GRID);
      for (let i = 0; i < HTC_GRID; i++) {
        const w = wlo + (whi - wlo) * i / (HTC_GRID - 1); let s = 0;
        for (let k = 0; k < pos.length; k++) { const wk = wt[k]!; if (wk < 1e-9) continue; const d = w - pos[k]!; s += wk * gamma * gamma / (d * d + gamma * gamma); }
        ys[i] = s;
      }
      return ys;
    };
    const bare = curve(hd.fc.pos, hd.fc.weight), live = curve(hd.live.eigs, hd.live.absorption);
    let norm = 1e-9; for (let i = 0; i < HTC_GRID; i++) { if (bare[i]! > norm) norm = bare[i]!; if (live[i]! > norm) norm = live[i]!; }
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif";
    for (const a of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, HT_ML, yOf(a), HT_ML + HT_PW, yOf(a)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(a.toFixed(1), HT_ML - 6, yOf(a)); }
    for (let t = 0; t <= 6; t++) { const w = wlo + (whi - wlo) * t / 6; ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, xOf(w), HT_MT, xOf(w), HT_MT + HT_PH); ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(fmt(w, 2), xOf(w), HT_MT + HT_PH + 5); }
    const drawArea = (ys: Float64Array, line: string, fill: string) => {
      ctx.beginPath(); for (let i = 0; i < HTC_GRID; i++) { const w = wlo + (whi - wlo) * i / (HTC_GRID - 1); const x = xOf(w), y = yOf(ys[i]! / norm); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.lineTo(xOf(whi), yOf(0)); ctx.lineTo(xOf(wlo), yOf(0)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.beginPath(); for (let i = 0; i < HTC_GRID; i++) { const w = wlo + (whi - wlo) * i / (HTC_GRID - 1); const x = xOf(w), y = yOf(ys[i]! / norm); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.strokeStyle = line; ctx.lineWidth = 1.7; ctx.stroke();
    };
    drawArea(bare, "rgba(148,163,184,0.5)", "rgba(148,163,184,0.07)"); // bare molecule (Franck–Condon)
    drawArea(live, COBALT, "rgba(59,130,246,0.15)"); // in-cavity / collective
    // bare 0-0 origin marker (polaron-shifted)
    const x00 = xOf(WA - htc.S * htc.wv); ctx.strokeStyle = "rgba(245,158,11,0.5)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; seg(ctx, x00, HT_MT, x00, HT_MT + HT_PH); ctx.setLineDash([]);
    ctx.fillStyle = AMBER; ctx.font = "600 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("0–0", x00 + 3, HT_MT + 2);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(HT_ML, HT_MT, HT_PW, HT_PH);
    ctx.fillStyle = INK; ctx.font = "600 12px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("frequency  ω / ω_c", HT_ML + HT_PW / 2, HT_MT + HT_PH + 18);
    ctx.save(); ctx.translate(15, HT_MT + HT_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("absorption  A(ω)", 0, 0); ctx.restore();
  }

  // FIX 4 (VIBRONIC) · left: discrete bare Franck-Condon progression (gray sticks, e^{−S}Sⁿ/n!) vs the
  // in-cavity absorption sticks (cyan polariton lines). right: the polaron-renormalized collective
  // coupling Ω_R^eff(N)=2g√N·e^{−S/2} vs the bare 2g√N — how the vibronic-dressed Rabi splitting grows.
  function drawVibronicCompare() {
    const cv = vibCompareCanvas.current, hd = htcData.current; if (!cv || !hd) return;
    const ctx = sized(cv, VB_CW, VB_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, VB_CW, VB_CH);
    const F = "'IBM Plex Sans',system-ui,sans-serif", S = htc.S, wv = htc.wv;
    // 1.D · LEFT — bare Franck–Condon progression (amber vertical bars, e^{−S}Sⁿ/n!) with the in-cavity
    // polariton absorption as a continuous Lorentzian-broadened cyan curve overlaid for direct comparison.
    const lx = VB_ML + 30, lw = VB_PW * 0.44, ly = VB_MT, lh = VB_PH;
    const wlo = WA - S * wv - 0.12, whi = WA + 7 * wv + 0.12, xL = (w: number) => lx + (w - wlo) / (whi - wlo) * lw, yL = (a: number) => ly + (1 - clamp(a, 0, 1)) * lh;
    ctx.fillStyle = INK; ctx.font = "600 9.5px " + F; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("FRANCK–CONDON PROGRESSION vs IN-CAVITY ABSORPTION", lx, ly - 5);
    for (const a of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, lx, yL(a), lx + lw, yL(a)); ctx.fillStyle = DIM; ctx.font = "500 8px " + F; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(a.toFixed(1), lx - 4, yL(a)); }
    // bare FC sticks → amber vertical bars, 60% opacity, 3px wide
    let fcmax = 1e-9; for (const w of hd.fc.weight) if (w > fcmax) fcmax = w;
    ctx.strokeStyle = AMBER; ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.lineCap = "butt";
    for (let i = 0; i < hd.fc.pos.length; i++) { const p = hd.fc.pos[i]!; if (p < wlo || p > whi) continue; const a = hd.fc.weight[i]! / fcmax; if (a < 0.004) continue; seg(ctx, xL(p), yL(0), xL(p), yL(a)); }
    ctx.globalAlpha = 1;
    // in-cavity polariton absorption → continuous cyan curve (sum of Lorentzians, HWHM γ)
    const GRID = 400, inCav = new Float64Array(GRID), gam = htc.gamma;
    for (let i = 0; i < GRID; i++) { const w = wlo + (whi - wlo) * i / (GRID - 1); let s = 0; for (let k = 0; k < hd.live.eigs.length; k++) { const aw = hd.live.absorption[k]!; if (aw < 1e-9) continue; const d = w - hd.live.eigs[k]!; s += aw * gam * gam / (d * d + gam * gam); } inCav[i] = s; }
    let cmax = 1e-9; for (let i = 0; i < GRID; i++) if (inCav[i]! > cmax) cmax = inCav[i]!;
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i < GRID; i++) { const x = lx + lw * i / (GRID - 1), y = yL(inCav[i]! / cmax); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(lx, ly, lw, lh);
    ctx.fillStyle = DIM; ctx.font = "600 9px " + F; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("frequency  ω/ω_c", lx + lw / 2, ly + lh + 6);
    // legend (top-right, inside panel)
    ctx.font = "600 8px " + F; const lg0 = "bare FC  |⟨n|0⟩|² = e⁻ˢSⁿ/n!", lg1 = "in-cavity polariton absorption";
    const legW = Math.max(ctx.measureText(lg0).width, ctx.measureText(lg1).width) + 24, legX = lx + lw - legW - 5, legY = ly + 5;
    ctx.fillStyle = "rgba(12,15,18,0.88)"; ctx.fillRect(legX, legY, legW, 26); ctx.strokeStyle = AXIS; ctx.lineWidth = 0.5; ctx.strokeRect(legX, legY, legW, 26);
    ctx.globalAlpha = 0.6; ctx.fillStyle = AMBER; ctx.fillRect(legX + 6, legY + 5, 9, 6); ctx.globalAlpha = 1;
    ctx.fillStyle = DIM; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(lg0, legX + 20, legY + 8);
    ctx.strokeStyle = CYAN; ctx.lineWidth = 2; seg(ctx, legX + 6, legY + 18, legX + 15, legY + 18);
    ctx.fillStyle = DIM; ctx.fillText(lg1, legX + 20, legY + 18);
    // RIGHT — Ω_R^eff(N)
    const rx = VB_ML + VB_PW * 0.56 + 30, rw = VB_PW * 0.42, ry = VB_MT, rh = VB_PH;
    const Nmax = Math.max(24, htc.N), e2 = Math.exp(-S / 2), om = (N: number) => 2 * htc.g * Math.sqrt(N) * e2, ymax = 2 * htc.g * Math.sqrt(Nmax) * 1.08 + 1e-6;
    const xR = (N: number) => rx + (N - 1) / (Nmax - 1) * rw, yR = (o: number) => ry + (1 - o / ymax) * rh;
    ctx.fillStyle = INK; ctx.font = "600 9.5px " + F; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("POLARON-RENORMALIZED COLLECTIVE COUPLING  Ω_R^eff = 2g√N·e^(−S/2)", rx, ry - 5);
    for (let t = 0; t <= 4; t++) { const o = ymax * t / 4; ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, rx, yR(o), rx + rw, yR(o)); ctx.fillStyle = DIM; ctx.font = "500 8px " + F; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(o.toFixed(2), rx - 4, yR(o)); }
    ctx.strokeStyle = "rgba(139,148,158,0.5)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath();
    for (let N = 1; N <= Nmax; N++) { const x = xR(N), y = yR(Math.min(2 * htc.g * Math.sqrt(N), ymax)); N === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1.9; ctx.beginPath();
    for (let N = 1; N <= Nmax; N++) { const x = xR(N), y = yR(om(N)); N === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    const cn = Math.min(Nmax, htc.N); ctx.fillStyle = CYAN; ctx.beginPath(); ctx.arc(xR(cn), yR(om(cn)), 4, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = DIM; ctx.font = "600 9px " + F; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("ensemble size N", rx + rw / 2, ry + rh + 6);
    ctx.font = "600 8.5px " + F; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = AMBER; ctx.fillText("Ω_R^eff", rx + 5, ry + 4); ctx.fillStyle = "#8b949e"; ctx.fillText("2g√N (bare)", rx + 58, ry + 4);
  }

  // 4.C (VIBRONIC) · disorder averaging — inhomogeneous broadening of the polariton linewidth. Under
  // strong collective coupling the lower polariton's width grows only as Γ_LP = κ/2 + γ/2 + σ²/(2Ω_R)
  // (motional / exchange narrowing — the bright mode averages over the disordered ensemble), far slower
  // than a bare molecule's γ + σ. The crossover at σ = Ω_R separates the narrowed strong-coupling regime
  // from the disorder-dominated regime where the polariton smears out. (Ω_R = 2g√N, κ ≈ γ here.)
  function drawDisorder() {
    const cv = disorderCanvas.current; if (!cv) return;
    const ctx = sized(cv, DI_CW, DI_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, DI_CW, DI_CH);
    const smax = 0.5, OmR = 2 * htc.g * Math.sqrt(htc.N), kap = htc.gamma, gam = htc.gamma;
    const GammaLP = (s: number) => kap / 2 + gam / 2 + s * s / (2 * Math.max(1e-6, OmR));
    const bareW = (s: number) => gam + s;
    let ymax = 1e-6; for (let i = 0; i <= 100; i++) { const s = smax * i / 100; ymax = Math.max(ymax, GammaLP(s), bareW(s)); } ymax *= 1.08;
    const xOf = (s: number) => DI_ML + (s / smax) * DI_PW, yOf = (v: number) => DI_MT + (1 - v / ymax) * DI_PH;
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif";
    for (let t = 0; t <= 4; t++) { const v = ymax * t / 4; ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, DI_ML, yOf(v), DI_ML + DI_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(2), DI_ML - 5, yOf(v)); }
    // crossover divider at σ = Ω_R
    if (OmR > 0 && OmR < smax) {
      const xd = xOf(OmR); ctx.strokeStyle = AMBER; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; seg(ctx, xd, DI_MT, xd, DI_MT + DI_PH); ctx.setLineDash([]);
      ctx.fillStyle = AMBER; ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("σ = Ω_R", xd, DI_MT + 2);
    }
    const plot = (fn: (s: number) => number, stroke: string, dash: boolean) => {
      ctx.strokeStyle = stroke; ctx.lineWidth = dash ? 1.3 : 2; ctx.setLineDash(dash ? [4, 3] : []); ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const s = smax * i / 200, x = xOf(s), y = yOf(fn(s)); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    plot(bareW, "rgba(148,163,184,0.7)", true); // bare γ + σ
    plot(GammaLP, CYAN, false);                  // motional-narrowed polariton
    // regime labels
    ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textBaseline = "bottom";
    ctx.fillStyle = CYAN; ctx.textAlign = "left"; ctx.fillText("strong coupling · motional narrowing", DI_ML + 6, DI_MT + DI_PH - 6);
    ctx.fillStyle = "#8b949e"; ctx.textAlign = "right"; ctx.fillText("disorder-dominated", DI_ML + DI_PW - 6, DI_MT + 16);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(DI_ML, DI_MT, DI_PW, DI_PH);
    ctx.fillStyle = DIM; ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let s = 0; s <= 0.5001; s += 0.1) { seg(ctx, xOf(s), DI_MT + DI_PH, xOf(s), DI_MT + DI_PH + 3); ctx.fillText(s.toFixed(1), xOf(s), DI_MT + DI_PH + 6); }
    ctx.fillStyle = INK; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textBaseline = "alphabetic"; ctx.fillText("inhomogeneous disorder  σ / ω_c", DI_ML + DI_PW / 2, DI_CH - 6);
    ctx.save(); ctx.translate(13, DI_MT + DI_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("Γ_LP / ω_c  (polariton linewidth, dimensionless)", 0, 0); ctx.restore();
    ctx.font = "600 8.5px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = CYAN; ctx.fillText("Γ_LP = γ + σ²/2Ω_R   (κ≈γ here)", DI_ML + 6, DI_MT + 4);
    ctx.fillStyle = "#8b949e"; ctx.fillText("bare  γ + σ", DI_ML + 6, DI_MT + 16);
  }

  function updateHtcReadouts() {
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    const Er = htc.S * htc.wv;
    set("htS", htc.S.toFixed(3)); set("htEr", Math.round(toMeV(Er)).toString());
    set("htSbright", (htc.S / htc.N).toFixed(3)); set("htRabi", Math.round(toMeV(2 * htc.g * Math.sqrt(htc.N))).toString());
    set("htRabiEff", Math.round(toMeV(2 * htc.g * Math.sqrt(htc.N) * Math.exp(-htc.S / 2))).toString()); // polaron-renormalized splitting actually drawn in the 0-0 doublet
    set("htNvib", String(htcData.current?.nVib ?? 0));
  }

  // P1 · the headline: photon ↔ bright vacuum-Rabi oscillation (Ω_R = 2g√M) with the dark band that
  // stays flat at σ=0 and grows as disorder leaks population out of the bright mode. hist = [ph,br,dk].
  function drawPopTraces() {
    const cvEl = popCanvas.current, pc = popCurve.current; if (!cvEl || !pc) return;
    const ctx = sized(cvEl, PP_CW, PP_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, PP_CW, PP_CH);
    const yOf = (v: number) => PP_MT + (1 - v) * PP_PH, xOf = (t: number) => PP_ML + (t / pc.T) * PP_PW;
    ctx.font = "500 9px 'IBM Plex Sans',system-ui,sans-serif";
    for (const v of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, PP_ML, yOf(v), PP_ML + PP_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), PP_ML - 6, yOf(v)); }
    // one dashed gridline + tick per vacuum-Rabi cycle (0…6)
    const cycT = 2 * Math.PI / pc.split;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let k = 0; k <= 6; k++) { const t = k * cycT; if (t > pc.T + 1e-6) break; const x = xOf(t); ctx.strokeStyle = DASH; ctx.setLineDash([1, 3]); ctx.lineWidth = 0.6; seg(ctx, x, PP_MT, x, PP_MT + PP_PH); ctx.setLineDash([]); ctx.fillStyle = DIM; ctx.fillText(String(k), x, PP_MT + PP_PH + 5); }
    const trace = (idx: number, color: string, fill: boolean) => {
      const path = () => { ctx.beginPath(); for (let i = 0; i < pc.n; i++) { const x = xOf(pc.T * i / (pc.n - 1)), y = yOf(Math.min(1, pc.data[i * 3 + idx]!)); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } };
      if (fill) { path(); ctx.lineTo(PP_ML + PP_PW, yOf(0)); ctx.lineTo(PP_ML, yOf(0)); ctx.closePath(); ctx.fillStyle = color + "22"; ctx.fill(); }
      path(); ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
    };
    trace(2, DARKC, true);   // dark / subradiant manifold (dephasing leakage at σ>0)
    trace(0, COBALT, false); // photon
    trace(1, RED, false);    // bright / superradiant matter
    const tnow = ((simT.current % pc.T) + pc.T) % pc.T; // live cursor, wraps every 6 cycles
    ctx.strokeStyle = "rgba(255,204,0,0.7)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); seg(ctx, xOf(tnow), PP_MT, xOf(tnow), PP_MT + PP_PH); ctx.setLineDash([]);
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(PP_ML, PP_MT, PP_PW, PP_PH);
    ctx.fillStyle = INK; ctx.font = "600 11px 'IBM Plex Sans',system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("time   t Ω_R / 2π   (Rabi cycles)", PP_ML + PP_PW / 2, PP_CH - 8);
    ctx.save(); ctx.translate(13, PP_MT + PP_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("population  P  (dimensionless, Σ=1)", 0, 0); ctx.restore();
  }

  function updateSimReadouts(d: { ph: number; br: number; dk: number }) {
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    const ds = dynState.current; if (!ds) return;
    const split = ds.eigs[ds.n - 1]! - ds.eigs[0]!; // LP→UP polariton splitting Ω_R (≈ 2g√M on resonance)
    const cycles = split * simT.current / (2 * Math.PI); // dimensionless time in vacuum-Rabi periods
    set("simTau", cycles.toFixed(2)); set("simTfs", toFs(simT.current).toFixed(1));
    set("simPh", d.ph.toFixed(4)); set("simBr", d.br.toFixed(4)); set("simDk", d.dk.toFixed(4));
    set("simRabi", fmt(split, 4)); set("simRabiMeV", Math.round(toMeV(split)).toString());
    set("simNorm", (d.ph + d.br + d.dk).toFixed(6));
  }

  function exportCSV() {
    if (regime === "single") download("phase_timeseries.csv", "text/csv", csv([["t", "photon", "excited", "purity"], ...series.current.map((p) => [p.t, p.n, p.pe, p.pur])]));
    else { const rows: (string | number)[][] = [["detuning_over_g", "energy", "photon_fraction"]]; for (const s of sweep.current) for (let k = 0; k < s.eigs.length; k++) rows.push([s.x, s.eigs[k]!, s.photon[k]!]); download("spectrum_sweep.csv", "text/csv", csv(rows)); }
  }
  function exportJSON() {
    const q = quantum.current;
    if (regime === "single" && q) download("state.json", "application/json", JSON.stringify({ time: q.time, photon: q.photon, excited: q.excited, purity: q.purity, entropy: q.entropy, trace: q.trace, min_eig: q.minEig, dim: DFULL, rho_abs: Array.from(q.rhoAbs()) }));
    else download("spectrum.json", "application/json", JSON.stringify({ detuning_over_g: sweep.current.map((s) => s.x), eigs: sweep.current.map((s) => Array.from(s.eigs)), photon_fraction: sweep.current.map((s) => Array.from(s.photon)) }));
  }
  function exportPNG() {
    const cv = regime === "single" ? wigCanvas.current : regime === "cavity" ? cavCanvas.current : regime === "dynamics" ? popCanvas.current : specCanvas.current;
    if (!cv) return;
    const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = `${regime}.png`; a.click();
  }

  // Upgrade IV · live regression suite: recompute known closed-form results across the WASM boundary
  // and report the variance vs the analytic reference. Validation as code, run on demand in-browser.
  function runRegression() {
    setRegLog(["running…"]);
    loadWasm().then(() => {
      const lines: string[] = []; let pass = 0, tot = 0;
      const check = (name: string, val: number, ref: number, tol: number) => {
        const err = Math.abs(val - ref), ok = err < tol; tot++; if (ok) pass++;
        lines.push(`${String(tot).padStart(2, "0")} ${name}  Δ=${err.toExponential(1)}  ${ok ? "PASS" : "FAIL"}`);
      };
      const M = 8, g = 0.05, gi = new Float64Array(M).fill(g); // identical resonant aligned emitters
      const md = arrowheadModesGi(WA, WA, 0, 1, gi);
      check("Rabi split Ω_R=2g√N", md.eigs[md.n - 1]! - md.eigs[0]!, 2 * g * Math.sqrt(M), 1e-9);
      let nd = 0; for (let k = 0; k < md.n; k++) if (Math.abs(md.eigs[k]! - WA) < 1e-9 && md.vecs[k]! ** 2 < 1e-9) nd++;
      check("dark states = N−1", nd, M - 1, 0.5);
      const S = 1, wv = 0.2, h0 = htcSpectrum(WA, WA, wv, Math.sqrt(S), 0, 28);
      let bi = 0, asum = 0; for (let i = 0; i < h0.eigs.length; i++) { asum += h0.absorption[i]!; if (h0.absorption[i]! > h0.absorption[bi]!) bi = i; }
      check("HTC 0–0 = ω_x−Sω_v", h0.eigs[bi]!, WA - S * wv, 1e-3);
      check("HTC Σ Aₖ = 1 (sum rule)", asum, 1, 1e-6);
      const hm = htcSpectrumMulti(WA, WA, wv, 0, g, 3, 6);
      check("HTC collective LP = ω_c−g√N", hm.eigs[0]!, WA - g * Math.sqrt(3), 1e-9);
      setRegLog([`${pass}/${tot} PASSED · live WASM vs analytic`, ...lines]);
    });
  }

  // Feature · live polarization sweep: ramp the transverse polarization angle θ_E from 0°→90° over 3 s,
  // re-diagonalizing per frame. The user watches the polariton markers slide into the dark reservoir
  // and the transmission doublet collapse to a single resonance as ε̂ rotates ⟂ the dipoles.
  function animatePol() {
    cancelAnimationFrame(polRaf.current);
    if (polAnim) { setPolAnim(false); return; }
    setPolAnim(true);
    const t0 = performance.now(), dur = 3000;
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / dur);
      setDyn((s) => ({ ...s, theta: Math.round(u * 90) }));
      if (u < 1) polRaf.current = requestAnimationFrame(step); else setPolAnim(false);
    };
    setDyn((s) => ({ ...s, theta: 0 }));
    polRaf.current = requestAnimationFrame(step);
  }

  function exportHamiltonian() {
    const gi = Float64Array.from(ensemble.factors, (f) => f * dyn.g);
    const { h, n } = arrowheadMatrixGi(WA, WA, dyn.sigma, dyn.seed, gi);
    downloadNpy(`H_cavityQED_N${dyn.m}.npy`, h, [n, n]); // np.load(...) → (N+1)×(N+1) Hamiltonian in units of ω_c
  }

  const Hud = (
    <div className="pane hud">
      <div className="pane-head">Validation · max |error| vs QuTiP / NumPy golden (dimensionless)</div>
      <table className="metrics"><tbody>
        <Row label={<>operators</>} v="≤1e−16" tip="max abs error of the tensor operators vs QuTiP golden (dimensionless)" /><Row label={<>mesolve ⟨·⟩</>} v="≤7e−9" tip="max abs error of the Lindblad expectation values vs QuTiP mesolve" />
        <Row label={<>Wigner</>} v="≤2e−16" tip="max abs error of the Wigner function vs QuTiP golden" /><Row label={<>arrowhead</>} v="≤1e−10" tip="max abs error of the Tavis–Cummings eigenspectrum vs numpy.linalg.eigh" />
      </tbody></table>
      <div className="btn-row">
        <button onClick={runRegression} title="recompute closed-form results across the WASM boundary">RUN REGRESSION</button>
      </div>
      {regLog.length ? <div className="reg-console">{regLog.map((l, i) => <div key={i} className={l.includes("FAIL") ? "reg-fail" : l.includes("PASS") ? "reg-pass" : "reg-head"}>{l}</div>)}</div> : null}
      <div className="btn-row">
        <button onClick={exportCSV}>CSV</button><button onClick={exportJSON}>JSON</button><button onClick={exportPNG}>PNG</button>
        {regime === "dynamics" ? <button onClick={exportHamiltonian} title="exact (N+1)×(N+1) Hamiltonian → np.load()">Ĥ.npy</button> : null}
      </div>
    </div>
  );

  return (
    <div className="ws-root">
      <div className="topbar">
        <span className="brand">POLARITON CAVITY-QED LAB</span>
        <span className="topbar-right">
          <span className="status"><span className="live">●</span> {ready ? "WASM CORE LIVE" : "LOADING…"} · QuTiP-GOLDEN CORE + ANALYTIC-VALIDATED OPTICS/VIBRONICS</span>
          <button className="examples-btn" onClick={() => setGallery(true)} title="load a configured example experiment to get started">▸ EXAMPLES</button>
          <button className="copy-link" onClick={copyLink} title="copy a shareable link to this exact configuration">{copied ? "COPIED" : "COPY LINK"}</button>
          <button className="about-btn" onClick={() => setAbout(true)} title="about">?</button>
        </span>
      </div>
      {gallery ? (
        <div className="gallery-overlay" onClick={(e) => { if (e.target === e.currentTarget) setGallery(false); }}>
          <div className="gallery-panel">
            <button className="about-x" onClick={() => setGallery(false)} aria-label="close">×</button>
            <div className="gallery-head">Examples — pick a phenomenon to load</div>
            <div className="gallery-sub">Each one loads a configured experiment and jumps to the right tab. New here? Start with <b>Vacuum-Rabi oscillation</b>, then read the equation and the “What / Watch” line on each panel.</div>
            {PRESET_GROUPS.map((g) => (
              <div className="gallery-group" key={g}>
                <div className="gg-head">{g}</div>
                {PRESETS.filter((p) => p.group === g).map((p) => (
                  <button className="gg-item" key={p.title} onClick={() => applyPreset(p)}>
                    <span className="gg-title">{p.title}</span>
                    <span className="gg-blurb">{p.blurb}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {about ? (
        <div className="about-overlay">
          <button className="about-x" onClick={() => setAbout(false)} aria-label="close">×</button>
          <div className="about-title">POLARITON CAVITY-QED LAB</div>
          <p>A research-grade cavity-QED instrument. Physics engine: Rust→WebAssembly. Model: single-excitation Tavis–Cummings (collective spectrum) + open Jaynes–Cummings (single-emitter Lindblad dynamics) + Holstein–Tavis–Cummings vibronic coupling, with a transfer-matrix optical cavity.</p>
          <div className="about-val">
            <div className="about-val-head">VALIDATION SCOPE — every module states its arbiter, nothing is asserted from memory</div>
            <div className="about-val-row"><span>JC Lindblad · TC arrowhead spectrum · Wigner · partial trace</span><span className="ok">QuTiP 5.3 / NumPy golden (≤ 1e-9)</span></div>
            <div className="about-val-row"><span>DBR transfer-matrix optics · HTC vibronics · FFT transmission</span><span className="an">closed-form analytic benchmark</span></div>
            <div className="about-val-note">Full receipts: <a className="about-link" href="https://github.com/Dhruvjain35/cavity-QED-model/blob/main/docs/VALIDATION.md" target="_blank" rel="noopener">docs/VALIDATION.md</a> · 22 cargo tests (11 QuTiP/NumPy-golden + 11 analytic) + the Node WASM-boundary recheck.</div>
          </div>
          <p>Model references: Sharma &amp; Chen, <i>J. Chem. Phys.</i> <b>161</b>, 104102 (2024); Mandal et al., <i>Chem. Rev.</i> <b>123</b>, 9786 (2023, HTC).</p>
          <p>Developed in collaboration with Shravan Kumar Sharma (PhD candidate, Hsing-Ta Chen group, Dept. of Chemistry, University of Notre Dame) — polariton chemistry + machine learning.</p>
          <p>Dhruv Jain — independent researcher. <a className="about-link" href="https://github.com/Dhruvjain35/cavity-QED-model" target="_blank" rel="noopener">github.com/Dhruvjain35/cavity-QED-model</a></p>
        </div>
      ) : null}

      <div className="workstation">
        {/* LEFT — configuration tree */}
        <aside className="rail">
          <div className="rail-head">CONFIGURATION</div>
          <div className="regime-toggle">
            <button className={regime === "single" ? "on" : ""} onClick={() => setRegime("single")}>SINGLE EMITTER</button>
            <button className={regime === "collective" ? "on" : ""} onClick={() => setRegime("collective")}>COLLECTIVE</button>
            <button className={regime === "cavity" ? "on" : ""} onClick={() => setRegime("cavity")}>CAVITY FIELD</button>
            <button className={regime === "dynamics" ? "on" : ""} onClick={() => setRegime("dynamics")}>DYNAMICS</button>
            <button className={regime === "vibronic" ? "on" : ""} onClick={() => setRegime("vibronic")}>VIBRONIC</button>
          </div>
          {regime === "single" ? (
            <>
              <Group title="CAVITY + EMITTER" k="cav" c={collapsed} t={toggle}>
                <Field sym="g" label="coupling" value={params.g} min={0.02} max={0.6} step={0.01} unit="ω_c" onChange={(g) => setParams((p) => ({ ...p, g }))} />
                <Field sym="κ" label="cavity loss" value={params.kappa} min={0} max={0.5} step={0.005} unit="ω_c" onChange={(kappa) => setParams((p) => ({ ...p, kappa }))} />
                <Field sym="γ" label="emitter decay" value={params.gamma} min={0} max={0.3} step={0.005} unit="ω_c" onChange={(gamma) => setParams((p) => ({ ...p, gamma }))} />
              </Group>
              <Group title="NUMERICAL ENGINE BOUNDS" k="num" c={collapsed} t={toggle}>
                <NumField sym="atol" value={tol.atol} tip="ODE solver absolute tolerance (dimensionless); lower = more accurate, slower. Range 1e-12–1e-2." onChange={(atol) => setTol((s) => ({ ...s, atol: clamp(atol, 1e-12, 1e-2) }))} />
                <NumField sym="rtol" value={tol.rtol} tip="ODE solver relative tolerance (dimensionless); lower = more accurate, slower. Range 1e-12–1e-2." onChange={(rtol) => setTol((s) => ({ ...s, rtol: clamp(rtol, 1e-12, 1e-2) }))} />
                <div className="btn-row">
                  <button onClick={() => setPlaying((p) => !p)}>{playing ? "PAUSE" : "PLAY"}</button>
                  <button onClick={() => { quantum.current?.reset(); series.current = []; }}>RE-EXCITE</button>
                  <button className={fixedScale ? "on" : ""} title="Wigner colour scale: fix to the ±1/π vacuum floor (compare negativity), or AUTO-scale to the current peak" onClick={() => setFixedScale((s) => !s)}>W-SCALE: {fixedScale ? "1/π" : "AUTO"}</button>
                </div>
              </Group>
            </>
          ) : regime === "collective" ? (
            <Group title="EMITTER ENSEMBLE" k="ens" c={collapsed} t={toggle}>
              <Field sym="N" label="emitters" value={sp.m} min={1} max={80} step={1} unit="" int tip="number of identical two-level emitters sharing the cavity mode" onChange={(m) => setSp((s) => ({ ...s, m: Math.round(m) }))} />
              <Field sym="g" label="coupling" value={sp.g} min={0.01} max={0.15} step={0.005} unit="ω_a" tip="single-emitter light–matter coupling, in units of ω_a (dimensionless). Collective splitting = 2g√N." onChange={(g) => setSp((s) => ({ ...s, g }))} />
              <Field sym="σ" label="disorder" value={sp.sigma} min={0} max={0.2} step={0.005} unit="ω_a" tip="static Gaussian spread of emitter energies, in units of ω_a (dimensionless). σ/Ω_R>1 smears out the polaritons." onChange={(sigma) => setSp((s) => ({ ...s, sigma }))} />
              <div className="btn-row"><button disabled={sp.sigma === 0} title={sp.sigma === 0 ? "set disorder σ>0 to randomize the ensemble" : "draw a new random disorder realization"} onClick={() => setSp((s) => ({ ...s, seed: s.seed + 1 }))}>RE-ROLL σ</button></div>
            </Group>
          ) : regime === "cavity" ? (
            <Group title="CAVITY HARDWARE" k="cavh" c={collapsed} t={toggle}>
              <Field sym="λ" label="design wavelength" value={cav.lambda} min={400} max={800} step={5} unit="nm" tip="cavity resonance / Bragg design wavelength λ₀" onChange={(lambda) => setCav((s) => ({ ...s, lambda }))} />
              <Field sym="n_H" label="DBR high index" value={cav.nHi} min={1.6} max={3.0} step={0.05} unit="" tip="refractive index of the high-index mirror layers (dimensionless)" onChange={(nHi) => setCav((s) => ({ ...s, nHi }))} />
              <Field sym="n_L" label="DBR low index" value={cav.nLo} min={1.3} max={2.0} step={0.02} unit="" tip="refractive index of the low-index mirror layers (dimensionless)" onChange={(nLo) => setCav((s) => ({ ...s, nLo }))} />
              <Field sym="N_pairs" texSym="N_{\mathrm{pairs}}" label="mirror pairs" value={cav.pairs} min={2} max={16} step={1} unit="" int tip="number of high/low index layer pairs per DBR mirror — more pairs ⇒ higher reflectance R" onChange={(pairs) => setCav((s) => ({ ...s, pairs: Math.round(pairs) }))} />
              <Field sym="n_c" label="cavity index" value={cav.nCav} min={1.3} max={2.5} step={0.05} unit="" tip="refractive index of the cavity spacer (dimensionless)" onChange={(nCav) => setCav((s) => ({ ...s, nCav }))} />
              <div className="knob" title="number of emitters N for the collective 2g√N-vs-κ demo (log scale, 1 to 10⁸)">
                <div className="knob-top">
                  <span className="knob-name">emitter number <i>N</i> <span className="knob-sub">(log scale)</span></span>
                  <span className="knob-entry"><span className="knob-readout">{cavN < 1e4 ? cavN.toLocaleString() : cavN.toExponential(0)}</span></span>
                </div>
                <input type="range" min={0} max={8} step={0.2} value={Math.log10(Math.max(1, cavN))} onChange={(e) => setCavN(Math.round(Math.pow(10, Number(e.target.value))))} />
              </div>
            </Group>
          ) : regime === "dynamics" ? (
            <Group title="MOLECULAR ENSEMBLE" k="dyn" c={collapsed} t={toggle}>
              <Field sym="N" texSym="(N)" label="ensemble size" value={dyn.m} min={2} max={40} step={1} unit="" int tip="number of two-level emitters N sharing the cavity (count). Ω_R = 2g√N grows with N." onChange={(m) => setDyn((s) => ({ ...s, m: Math.round(m) }))} />
              <Field sym="g" texSym="(g_0/\omega_c)" label="bare Rabi coupling" value={dyn.g} min={0.01} max={0.2} step={0.005} unit="" tip="single-emitter light–matter coupling g₀ in units of ω_c (dimensionless). Collective splitting Ω_R = 2g₀√N." onChange={(g) => setDyn((s) => ({ ...s, g }))} />
              <Field sym="σ" texSym="(\sigma_\omega/\omega_c)" label="inhomogeneous linewidth" value={dyn.sigma} min={0} max={0.25} step={0.005} unit="" tip="static spread of emitter energies in units of ω_c (dimensionless); locked at 0.03 by default for a clean doublet" onChange={(sigma) => setDyn((s) => ({ ...s, sigma }))} />
              <Field sym="ω" texSym="(\hbar\omega_c)" label="cavity resonance energy" value={wcEv} min={0.5} max={4} step={0.05} unit="eV" tip="cavity photon energy ħω_c — sets the absolute meV scale for the readouts" onChange={setWcEv} />
              <Field sym="η" texSym="(\eta)" label="orientational order" value={dyn.order} min={0} max={1} step={0.02} unit="" tip="alignment of the molecular transition dipoles (dimensionless, 0=random, 1=fully aligned); lower order = weaker collective coupling" onChange={(order) => setDyn((s) => ({ ...s, order }))} />
              <Field sym="Γ" texSym="\Gamma_{\mathrm{spec}}/\omega_c" label="spectral linewidth (transmission only)" value={dyn.gamma} min={0.003} max={0.06} step={0.002} unit="" tip="peak width Γ in the transmission spectrum (dimensionless). NOTE: spectral-only — the live 3D/populations stay lossless." onChange={(gamma) => setDyn((s) => ({ ...s, gamma }))} />
              <Field sym="θ" texSym="(\theta_E)" label="polarization angle" value={dyn.theta} min={0} max={90} step={1} unit="°" tip="angle of the cavity field polarization vs the dipoles (degrees); at 90° the coupling vanishes" onChange={(theta) => setDyn((s) => ({ ...s, theta }))} />
              <div className="btn-row">
                <button className={polAnim ? "on" : ""} onClick={animatePol}>{polAnim ? "■ SWEEPING θ…" : "▶ ANIMATE θ SWEEP 0→90°"}</button>
              </div>
              <div className="btn-row">
                <button className={dyn.order >= 0.999 ? "on" : ""} onClick={() => setDyn((s) => ({ ...s, order: 1 }))}>CRYSTAL</button>
                <button className={dyn.order <= 0.15 ? "on" : ""} onClick={() => setDyn((s) => ({ ...s, order: 0.1 }))}>AMORPHOUS</button>
              </div>
              <div className="knob-top" style={{ marginBottom: 6 }}><span className="knob-name">initial excitation</span></div>
              <div className="btn-row">
                <button className={dyn.init === 0 ? "on" : ""} onClick={() => setDyn((s) => ({ ...s, init: 0 }))}>PHOTON</button>
                <button className={dyn.init === 1 ? "on" : ""} onClick={() => setDyn((s) => ({ ...s, init: 1 }))}>MOLECULE</button>
              </div>
              <div className="btn-row">
                <button onClick={() => setPlaying((p) => !p)}>{playing ? "PAUSE" : "PLAY"}</button>
                <button onClick={() => { simT.current = 0; if (dynState.current) dynState.current.hist = []; }}>RESET</button>
                <button onClick={() => setDyn((s) => ({ ...s, seed: s.seed + 1 }))}>RE-ROLL σ</button>
              </div>
              <div className="btn-row">
                <button className={dynSweep ? "on" : ""} onClick={() => setDynSweep((v) => !v)}>{dynSweep ? "● SWEEP g vs Ω_R" : "SWEEP g vs Ω_R"}</button>
              </div>
            </Group>
          ) : (
            <Group title="VIBRONIC · HOLSTEIN-TC" k="htc" c={collapsed} t={toggle}>
              <Field sym="ω" texSym="\omega_v/\omega_c" label="vibrational mode" value={htc.wv} min={0.04} max={0.4} step={0.005} unit="" tip="vibrational (phonon) frequency ω_v in units of ω_c (dimensionless); sets the spacing of the Franck–Condon replicas" onChange={(wv) => setHtc((s) => ({ ...s, wv }))} />
              <Field sym="S" texSym="S=\lambda^2" label="Huang-Rhys factor" value={htc.S} min={0} max={3} step={0.05} unit="" tip="exciton–phonon coupling strength S=λ² (dimensionless); higher S = more/brighter vibrational sidebands and a larger Stokes shift" onChange={(S) => setHtc((s) => ({ ...s, S }))} />
              <Field sym="g" texSym="g/\omega_c" label="cavity coupling" value={htc.g} min={0} max={0.25} step={0.005} unit="" tip="single-molecule light–matter coupling g in units of ω_c (dimensionless); collective splitting = 2g√N" onChange={(g) => setHtc((s) => ({ ...s, g }))} />
              <Field sym="N" texSym="N" label="ensemble size" value={htc.N} min={1} max={400} step={1} unit="" int tip="number of molecules N (count). Exact diagonalization for N≤3; asymptotic large-N approximation above." onChange={(N) => setHtc((s) => ({ ...s, N: Math.round(N) }))} />
              <Field sym="γ" texSym="\gamma/\omega_c" label="linewidth (HWHM)" value={htc.gamma} min={0.004} max={0.04} step={0.002} unit="" tip="bare emitter linewidth (half width at half max) in units of ω_c (dimensionless)" onChange={(gamma) => setHtc((s) => ({ ...s, gamma }))} />
              <div className="btn-row">
                <button className={htc.N <= 1 ? "on" : ""} onClick={() => setHtc((s) => ({ ...s, N: 1 }))}>N = 1</button>
                <button className={htc.N >= 100 ? "on" : ""} title="jump to N=200 to demonstrate polaron decoupling (λ→λ/√N); switches from exact to the large-N asymptotic solver" onClick={() => setHtc((s) => ({ ...s, N: 200 }))}>N = 200 · large-N</button>
              </div>
            </Group>
          )}
        </aside>

        {/* CENTER */}
        <main className="center">
          <div className="tab-sub">
            {regime === "single" ? <><b>Single emitter in a lossy cavity (open Jaynes–Cummings).</b> <span className="ts-watch">Watch:</span> one quantum oscillating photon↔atom at the vacuum-Rabi rate 2g (Panel C) and decohering (Panels E/F). <span className="ts-watch">Drag:</span> g sets the oscillation speed, κ/γ set the decay.</>
              : regime === "collective" ? <><b>N emitters sharing one cavity mode (Tavis–Cummings).</b> <span className="ts-watch">Watch:</span> the avoided crossing — 2 bright polaritons split by 2g√N, the N−1 dark states pinned at ω_a. <span className="ts-watch">Drag:</span> N/g set the splitting; σ adds emitter disorder. Click any eigenstate to see its photon content.</>
              : regime === "cavity" ? <><b>The optical hardware behind the coupling (DBR Fabry–Pérot cavity).</b> <span className="ts-watch">Watch:</span> the standing-wave field |E(z)|² and how the mirror stack sets the mode volume → the single-emitter coupling g. <span className="ts-watch">Drag:</span> wavelength, mirror pairs, and indices to retune the cavity.</>
              : regime === "dynamics" ? <><b>Live many-emitter dynamics (Tavis–Cummings, real-time).</b> <span className="ts-watch">Watch:</span> one excitation sloshing photon↔molecules in 3D + the doublet in transmission. <span className="ts-watch">Drag:</span> N/g set Ω_R=2g√N; the dynamics are closed (unitary, lossless) — Γ only broadens the spectrum.</>
              : <><b>Vibronic coupling — molecules with vibrations in a cavity (Holstein–Tavis–Cummings).</b> <span className="ts-watch">Watch:</span> the Franck–Condon vibrational comb (bare) reshaped into polaritons in-cavity. <span className="ts-watch">Drag:</span> Huang–Rhys S, vibrational mode ω_v, coupling g, ensemble N.</>}
          </div>
          {regime === "single" ? (
            <>
              <div className="pane">
                <div className="pane-head">Panel C · observables ⟨a†a⟩ <i style={{ color: COBALT }}>—</i> ⟨P_e⟩ <i style={{ color: CRIMSON }}>—</i> purity <i style={{ color: EMERALD }}>—</i></div>
                <PanelEqn t={"\\begin{aligned}\\dot{\\rho} &= -i[\\hat H,\\rho] + \\kappa\\,\\mathcal{D}[\\hat a]\\rho + \\gamma\\,\\mathcal{D}[\\hat\\sigma]\\rho \\\\ \\hat H &= \\omega_c \\hat a^\\dagger \\hat a + \\Omega\\,\\hat\\sigma^\\dagger\\hat\\sigma + g(\\hat a^\\dagger\\hat\\sigma + \\hat a\\hat\\sigma^\\dagger)\\end{aligned}"} />
                <div className="pane-sub"><b>What:</b> one quantum sloshes photon↔atom — the cyan/red anti-phase wiggle is the vacuum-Rabi oscillation at frequency 2g; the envelope decays as κ,γ leak it out. ⟨a†a⟩=mean photon number, ⟨P_e⟩=excited-state prob, all dimensionless ∈[0,1] here.</div>
                <PlotWrap cw={S_CW} ch={S_CH} area={{ ml: S_ML, mt: S_MT, pw: S_PW, ph: S_PH }} inv={(px, py) => { const T = popSeries.current?.T ?? T_LOOP; return [(((px - S_ML) / S_PW) * T).toFixed(1), (1 - (py - S_MT) / S_PH).toFixed(2)]; }}>
                  <canvas ref={seriesCanvas} className="cv" />
                </PlotWrap>
              </div>
              <div className="pane">
                <div className="pane-head">Panel B · phase space — Wigner <em>W</em> (signed · red = negativity) | Husimi <em>Q</em> (≥ 0)</div>
                <PanelEqn t={"W(x,p)=\\tfrac{1}{\\pi}\\!\\int\\!\\langle x{-}y|\\hat\\rho|x{+}y\\rangle\\, e^{2ipy}\\,dy,\\qquad Q(\\alpha)=\\tfrac{1}{\\pi}\\langle\\alpha|\\hat\\rho|\\alpha\\rangle"} where="α=(x+ip)/√2" />
                <div className="pane-sub"><b>What:</b> quasi-probability portrait of the cavity field in the x–p plane. <b>W</b> can go negative (red) — a non-classical signature; <b>Q</b> is a Gaussian-smoothed W that is always ≥0. Both are dimensionless densities.</div>
                <div className="phase-row">
                  <canvas ref={wigCanvas} className="cv" />
                  <canvas ref={husimiCanvas} className="cv" />
                </div>
              </div>
              <div className="pane">
                <div className="pane-head">Panel E · decoherence — purity Tr(ρ²) <i style={{ color: GREEN, fontStyle: "normal" }}>—</i> von Neumann entropy S(t) <i style={{ color: AMBER, fontStyle: "normal" }}>—</i> (open-system mixing under κ,γ)</div>
                <PanelEqn t={"\\mathcal{P}=\\operatorname{Tr}(\\hat\\rho^2)\\in(0,1],\\qquad S=-\\operatorname{Tr}(\\hat\\rho\\ln\\hat\\rho)"} where="S in nats" />
                <div className="pane-sub"><b>What:</b> the state starts pure (purity→1, entropy→0) and mixes into the environment over time. <b>Green</b>=purity Tr ρ²∈[0,1] (left axis); <b>amber</b>=entropy S in nats (scaled to its peak ≈ln2). Falling purity = decoherence.</div>
                <PlotWrap cw={DC_CW} ch={DC_CH} area={{ ml: DC_ML, mt: DC_MT, pw: DC_PW, ph: DC_PH }} inv={(px, py) => { const T = popSeries.current?.T ?? T_LOOP; return [(((px - DC_ML) / DC_PW) * T).toFixed(1), (1 - (py - DC_MT) / DC_PH).toFixed(2)]; }}>
                  <canvas ref={decohereCanvas} className="cv" />
                </PlotWrap>
              </div>
              <div className="pane">
                <div className="pane-head">Panel F · quantum trajectory — Bloch vector projection · single-excitation qubit {"{|0,e⟩,|1,g⟩}"} · spirals inward under κ,γ</div>
                <PanelEqn t={"\\vec{r}=\\big(\\,2\\,\\operatorname{Im}\\rho_{01},\\ \\ \\rho_{00}-\\rho_{11}\\,\\big)"} where="x = coherence, y = inversion" />
                <div className="pane-sub"><b>What:</b> the {"{|0,e⟩,|1,g⟩}"} qubit drawn as a Bloch vector. Rabi oscillation = rotation around the circle; the inward spiral toward the centre = decoherence, shown geometrically (a pure state sits on the rim, a fully mixed one at the centre).</div>
                <div className="bloch-wrap" style={{ textAlign: "center" }}>
                  <PlotWrap cw={BL_CW} ch={BL_CH} area={{ ml: BL_ML, mt: BL_MT, pw: BL_S, ph: BL_S }} inv={(px, py) => { const R = (BL_S / 2) / 1.12, cx = BL_ML + BL_S / 2, cy = BL_MT + BL_S / 2; return [((px - cx) / R).toFixed(3), ((cy - py) / R).toFixed(3)]; }}>
                    <canvas ref={blochCanvas} className="cv" />
                  </PlotWrap>
                </div>
              </div>
            </>
          ) : regime === "collective" ? (
            <>
              <div className="pane">
                <div className="pane-head">Panel D · polariton spectrum (N = {sp.m}) · click an eigenstate · dot colour = photon fraction <i style={{ color: RED, fontStyle: "normal" }}>matter ▸</i> <i style={{ color: CYAN, fontStyle: "normal" }}>▸ photon</i> · <i style={{ color: PURPLE, fontStyle: "normal" }}>━ N−1 dark</i></div>
                <PanelEqn t={"\\hat H\\,\\phi_k = E_k\\,\\phi_k,\\qquad \\hat H=\\begin{pmatrix}\\omega_c & g_1 & \\cdots & g_N\\\\ g_1 & \\omega_1 & & \\\\ \\vdots & & \\ddots & \\\\ g_N & & & \\omega_N\\end{pmatrix}"} where="arrowhead → O(N) · Ω_R = 2g√N" />
                <div className="pane-sub"><b>What:</b> each curve is a polariton energy as the cavity is detuned through the emitters; the two bright bands that repel are the <b>LP/UP</b> polaritons (split by 2g√N), the flat purple line is the <b>N−1 dark states</b> that don't couple to light. <b>Change → watch:</b> raise N → the LP/UP gap Ω_R grows as 2g√N; raise σ → polaritons broaden, the dark band spreads. <b>Approx:</b> single-excitation Tavis–Cummings · RWA · dark states ideal/degenerate.</div>
                <PlotWrap cw={P_CW} ch={P_CH} area={{ ml: P_ML, mt: P_MT, pw: P_W, ph: P_H }} inv={(px, py) => { const { emin, emax, R } = specMap.current; return [fmt(((px - P_ML) / P_W) * 2 * R - R, 2), fmt(emax - ((py - P_MT) / P_H) * (emax - emin), 3)]; }}>
                  <canvas ref={specCanvas} className="cv click" onClick={onSpecClick} />
                </PlotWrap>
              </div>
              <div className="pane">
                <div className="pane-head">Panel D · Wigner of selected eigenstate</div>
                <PanelEqn t={"W(0,0)=\\tfrac{1}{\\pi}\\big(1-2|C|^2\\big)"} where="|C|² = photon fraction; W<0 ⇒ non-classical" />
                <div className="pane-sub"><b>What:</b> phase-space portrait of the polariton you clicked. A red dip at the centre = negative Wigner value = non-classical light; a purely positive blob = classical-like. x,p are dimensionless field quadratures.</div>
                <div className="bridge">
                  <canvas ref={bridgeCanvas} className="cv" />
                  <table className="metrics"><tbody>
                    <Row label={<>state</>} k="selKind" r={read} tip="classification of the clicked eigenstate (lower/upper polariton or dark)" />
                    <Row label={<><i>E</i></>} k="selE" r={read} unit="ω_a" tip="eigen-energy of the selected state, in units of the emitter frequency ω_a (dimensionless)" />
                    <Row label={<>|<i>C</i>|²</>} k="selC" r={read} tip="photon (cavity) fraction of the state — dimensionless, 0–1; |C|²+|X|²=1" />
                    <Row label={<>|<i>X</i>|²</>} k="selX" r={read} tip="matter (exciton) fraction of the state — dimensionless, 0–1; |C|²+|X|²=1" />
                    <Row label={<><i>W</i>(0,0)</>} k="selW0" r={read} unit="" tip="Wigner value at the phase-space origin; negative = non-classical (vacuum floor is +1/π≈0.318)" />
                  </tbody></table>
                </div>
              </div>
              <div className="pane">
                <div className="pane-head">Panel G · Hopfield composition + photon-weight distribution · left bars: photon <i style={{ color: CYAN, fontStyle: "normal" }}>▪</i> / matter <i style={{ color: RED, fontStyle: "normal" }}>▪</i> · right histogram: bright polariton <i style={{ color: CYAN, fontStyle: "normal" }}>▪</i> / dark <i style={{ color: PURPLE, fontStyle: "normal" }}>▪</i></div>
                <PanelEqn t={"|\\psi_k\\rangle = C_k\\,|1,\\!\\{g\\}\\rangle + \\textstyle\\sum_i X_{k,i}\\,|0,e_i\\rangle,\\quad |C_k|^2+\\sum_i|X_{k,i}|^2=1"} where="photon weight |C|² = |⟨a|ψ⟩|²" />
                <div className="pane-sub"><b>What:</b> <b>left</b> — is the clicked state more photon or matter (the two add to 1)? <b>right</b> — of all N+1 eigenstates, only 2 carry photon weight (the bright polaritons); the rest are dark and invisible to light.</div>
                <canvas ref={hopBarsCanvas} className="cv" />
              </div>
            </>
          ) : regime === "cavity" ? (
            <>
              <div className="pane grow">
                <div className="pane-head">Panel E · |E(z)|² standing-wave mode over the real DBR stack · refractive-index n(z) staircase (right axis) · emitter pinned to argmax|E|² · L_DBR / L_eff penetration</div>
                <PanelEqn t={"g=\\frac{\\mu}{\\hbar}\\sqrt{\\frac{\\hbar\\omega_c}{2\\varepsilon_0 V_m}},\\qquad V_m=\\tfrac{\\pi}{2}\\,w_0^2\\,L_{\\mathrm{eff}},\\quad L_{\\mathrm{eff}}=L_{\\mathrm{cav}}+2L_{\\mathrm{DBR}}"} where="smaller mode volume V_m ⇒ larger g" />
                <div className="pane-sub"><b>What:</b> the optical field piles up into a standing wave between the mirrors and peaks at the centre antinode (dashed line). Put the molecule there — that maximizes the single-emitter coupling g. The mirror stack's index contrast sets the reflectance, mode volume, and thus g.</div>
                <canvas ref={cavCanvas} className="cv" />
                <div className="legend">
                  <span className="leg"><i className="lsw" style={{ background: "rgba(56,84,150,0.85)" }} />high-index n_H</span>
                  <span className="leg"><i className="lsw" style={{ background: "rgba(40,52,74,0.85)" }} />low-index n_L</span>
                  <span className="leg"><i className="lsw" style={{ background: "rgba(245,158,11,0.28)" }} />λ/2 spacer n_c</span>
                  <span className="leg leg-field">|E(z)|² field</span>
                  <span className="leg leg-mol">emitter @ antinode</span>
                </div>
              </div>
              <div className="cav-row">
                <div className="pane">
                  <div className="pane-head">Panel R · cavity reflectance R(λ) · stopband / photonic bandgap <i style={{ color: CYAN, fontStyle: "normal" }}>━</i> · resonance dip at λ₀ <i style={{ color: AMBER, fontStyle: "normal" }}>┆</i> · width set by index contrast, not pairs · <span style={{ color: "#6e7681", fontWeight: 400 }}>lossless mirrors, normal incidence (TMM)</span></div>
                  <PanelEqn t={"R=|r|^2,\\qquad F=\\frac{\\pi\\sqrt{R}}{1-R},\\qquad Q=\\frac{\\omega_c}{\\kappa}"} where="r from transfer-matrix; F = finesse" />
                  <canvas ref={stopCanvas} className="cv" />
                </div>
                <div className="pane">
                  <div className="pane-head">Panel N · collective coupling Ω<sub>R</sub>=2g√N <i style={{ color: CYAN, fontStyle: "normal" }}>━</i> vs cavity loss κ <i style={{ color: "#ff7080", fontStyle: "normal" }}>┄</i> · markers: <i style={{ color: "#fff", fontStyle: "normal" }}>● N* crossover</i> <i style={{ color: "#ff9b50", fontStyle: "normal" }}>● current N (weak)</i> <i style={{ color: CYAN, fontStyle: "normal" }}>● current N (strong)</i></div>
                  <PanelEqn t={"\\Omega_R=2g\\sqrt{N},\\qquad N^*=\\left(\\frac{\\kappa}{2g}\\right)^2"} where="strong coupling when 2g√N > κ" />
                  <div className="pane-sub"><b>What:</b> one molecule (N=1) is too weakly coupled to beat the cavity loss κ — Purcell/weak regime. Strong coupling (2g√N {">"} κ) is reached only collectively, above the crossover N* where the cyan line crosses κ.</div>
                  <canvas ref={collCanvas} className="cv" />
                </div>
              </div>
            </>
          ) : regime === "vibronic" ? (
            <>
              <div className="pane">
                <div className="pane-head">Holstein-TC absorption · bare molecule <i style={{ color: "#8b949e", fontStyle: "normal" }}>━</i> in-cavity / collective <i style={{ color: CYAN, fontStyle: "normal" }}>━</i> · solver: <i style={{ color: htc.N <= HTC_EXPLICIT_CAP ? GREEN : AMBER, fontStyle: "normal" }} title={htc.N <= HTC_EXPLICIT_CAP ? "exact diagonalization of the full N-molecule vibronic Hamiltonian" : "N>3: asymptotic large-N polaron decoupling (λ→λ/√N) — an approximation, exact only as N→∞"}>{htc.N <= HTC_EXPLICIT_CAP ? `exact ${htc.N}-body diagonalization` : "asymptotic 1/N (approx)"}</i></div>
                <PanelEqn t={"\\hat H=\\omega_c a^\\dagger a+\\omega_x\\sigma^\\dagger\\sigma+\\omega_v b^\\dagger b+\\lambda\\omega_v\\,\\sigma^\\dagger\\sigma(b{+}b^\\dagger)+g(a^\\dagger\\sigma+a\\sigma^\\dagger)"} where="Holstein–Tavis–Cummings · S=λ²" />
                <div className="pane-sub"><b>What:</b> a molecule's vibrational fingerprint outside vs inside the cavity. <b>Grey</b> = molecule alone (the Franck–Condon comb of vibronic replicas 0–0, 0–1, …); <b>cyan</b> = same molecule in the cavity — collective coupling collapses the comb into LP/UP polariton peaks. <b>Approx:</b> single-excitation · RWA · no κ (ideal absorption).</div>
                <PlotWrap cw={HT_CW} ch={HT_CH} area={{ ml: HT_ML, mt: HT_MT, pw: HT_PW, ph: HT_PH }} inv={(px, py) => { const N = htc.N, split = 2 * htc.g * Math.sqrt(N), wlo = WA - htc.S * htc.wv - split * 0.7 - 0.12, whi = WA + 7 * htc.wv + 0.12; return [(wlo + ((px - HT_ML) / HT_PW) * (whi - wlo)).toFixed(3), (1 - (py - HT_MT) / HT_PH).toFixed(2)]; }}>
                  <canvas ref={htcCanvas} className="cv" />
                </PlotWrap>
              </div>
              <div className="pane">
                <div className="pane-head">Panel V · vibronic progression (discrete) + polaron-renormalized collective coupling Ω_R^eff(N)</div>
                <PanelEqn t={"I_n=e^{-S}\\frac{S^n}{n!},\\qquad \\Omega_R^{\\mathrm{eff}}=2g\\sqrt{N}\\;e^{-S/2}"} where="Franck–Condon comb · polaron-dressed Rabi" />
                <div className="pane-sub"><b>What:</b> <b>left</b> — how the cavity reshapes the vibrational fingerprint; <b>right</b> — how the light–matter coupling Ω_R^eff = 2g√N·e^(−S/2) grows with ensemble size N (the e^(−S/2) is the polaron/vibronic dressing).</div>
                <canvas ref={vibCompareCanvas} className="cv" />
              </div>
              <div className="pane">
                <div className="pane-head">Panel W · disorder averaging — inhomogeneous broadening · Γ_LP motional-narrowed <i style={{ color: CYAN, fontStyle: "normal" }}>━</i> vs bare γ+σ <i style={{ color: "#8b949e", fontStyle: "normal" }}>┄</i></div>
                <PanelEqn t={"\\Gamma_{\\mathrm{LP}}=\\gamma+\\frac{\\sigma^2}{2\\,\\Omega_R}\\ \\ \\ll\\ \\ \\gamma+\\sigma"} where="motional narrowing for σ < Ω_R" />
                <div className="pane-sub"><b>What:</b> adding molecular energy disorder σ broadens a bare line one-for-one (grey), but the cavity polariton (cyan) stays sharp far longer because it averages over the disordered ensemble — "motional/exchange narrowing". They cross at σ=Ω_R.</div>
                <PlotWrap cw={DI_CW} ch={DI_CH} area={{ ml: DI_ML, mt: DI_MT, pw: DI_PW, ph: DI_PH }} inv={(px, py) => { const OmR = 2 * htc.g * Math.sqrt(htc.N), g2 = (s: number) => htc.gamma + s * s / (2 * Math.max(1e-6, OmR)), b2 = (s: number) => htc.gamma + s; let ym = 1e-6; for (let i = 0; i <= 100; i++) { const s = 0.5 * i / 100; ym = Math.max(ym, g2(s), b2(s)); } ym *= 1.08; return [(((px - DI_ML) / DI_PW) * 0.5).toFixed(3), ((1 - (py - DI_MT) / DI_PH) * ym).toFixed(3)]; }}>
                  <canvas ref={disorderCanvas} className="cv" />
                </PlotWrap>
              </div>
            </>
          ) : dynSweep ? (
            <div className="pane grow">
              <div className="pane-head">Coupling sweep · polariton dispersion E(g) · {SWEEP_STEPS} diagonalizations · bright split as 2g√N, dark flat at ω_a · amber = live g</div>
              <canvas ref={sweepCanvas} className="cv" />
            </div>
          ) : (
            <div className="dyn-bento">
              <div className="pane bento-3d">
                <div className="pane-head">Live cavity · {dyn.m} two-level emitters + 1 photon · ψ(t)=Σ<sub>k</sub> c<sub>k</sub> e<sup>−iE<sub>k</sub>t</sup>φ<sub>k</sub>{inspect != null ? <> · <i style={{ color: "#fff", fontStyle: "normal" }}>inspecting eigenstate #{inspect}</i></> : <> · cavity field E(z) <i style={{ color: CYAN, fontStyle: "normal" }}>cyan standing wave</i> · emitters <i style={{ color: "#4a6a93", fontStyle: "normal" }}>ground</i>→<i style={{ color: RED, fontStyle: "normal" }}>excited</i> by |ψ<sub>i</sub>(t)|²</>}</div>
                <PanelEqn t={"|\\psi(t)\\rangle=\\textstyle\\sum_k c_k\\,e^{-iE_k t}\\,|\\phi_k\\rangle,\\qquad \\hat H|\\phi_k\\rangle=E_k|\\phi_k\\rangle"} where="closed unitary single-excitation Tavis–Cummings" />
                <div className="pane-sub"><b>What:</b> one quantum oscillating between light and matter in real time — the cyan <b>standing-wave field</b> grows when the photon holds the energy and collapses flat when it drains into the <b>emitters</b>, which turn red as they get excited. That oscillation is the polariton. <b>Approx:</b> single-excitation subspace (1 photon total) · RWA · ideal mirrors (κ=0 — the live evolution is lossless).</div>
                <div className="live3d"><Suspense fallback={<div className="cv-loading">loading 3D…</div>}><LiveCavityScene stateRef={dynState} tRef={simT} m={dyn.m} inspectRef={inspectRef} ensemble={ensemble} waist={MODE_WAIST} polTheta={dyn.theta * Math.PI / 180} controls={scene3d} /></Suspense>
                  <ScenePanel open={scenePanelOpen} onToggle={() => setScenePanelOpen((o) => !o)} v={scene3d} set={setScene} />
                </div>
                <div className="transport">
                  <button className="tp-btn" title={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚" : "▶"}</button>
                  <button className="tp-btn" title="Step +0.1 ω_c⁻¹ (while paused)" onClick={() => { simT.current += 0.1; }}>▶❘</button>
                  <button className="tp-btn" title="Reset to t = 0" onClick={() => { simT.current = 0; if (dynState.current) dynState.current.hist = []; }}>⟲</button>
                  <input ref={scrubRef} className="tp-scrub" type="range" min={0} max={1} step={0.001} defaultValue={0} aria-label="scrub time"
                    onPointerDown={() => { scrubbing.current = true; }} onPointerUp={() => { scrubbing.current = false; }} onPointerCancel={() => { scrubbing.current = false; }}
                    onChange={(e) => { simT.current = Number(e.target.value); }} />
                  <span ref={tpTimeRef} className="tp-time">τ 0.00 cyc</span>
                  <select className="tp-speed" aria-label="playback speed" value={simSpeed} onChange={(e) => setSimSpeed(Number(e.target.value))}>
                    {[0.25, 0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
                  </select>
                </div>
              </div>
              <div className="pane">
                <div className="pane-head">Populations — photon <i style={{ color: CYAN, fontStyle: "normal" }}>━</i> bright/superradiant <i style={{ color: RED, fontStyle: "normal" }}>━</i> dark/subradiant <i style={{ color: PURPLE, fontStyle: "normal" }}>━</i> · <i style={{ color: "#8b949e", fontStyle: "normal" }}>closed unitary evolution (κ=γ=0 here); Γ enters the transmission spectrum only</i></div>
                <PanelEqn t={"P_{\\mathrm{photon}}=|\\langle 0|\\psi(t)\\rangle|^2,\\ \\ P_{\\mathrm{bright}}=|\\langle B|\\psi(t)\\rangle|^2,\\qquad \\textstyle\\sum_k P_k = 1"} where="|B⟩ = symmetric bright mode" />
                <div className="pane-sub"><b>What:</b> where the single excitation lives vs time — it sloshes photon↔bright at the vacuum-Rabi frequency Ω_R; the dark fraction stays flat (it doesn't couple to light). Undamped because the live model is lossless.</div>
                <PlotWrap fit cw={PP_CW} ch={PP_CH} area={{ ml: PP_ML, mt: PP_MT, pw: PP_PW, ph: PP_PH }} inv={(px, py) => [(((px - PP_ML) / PP_PW) * 6).toFixed(2), (1 - (py - PP_MT) / PP_PH).toFixed(2)]}>
                  <canvas ref={popCanvas} className="cv" />
                </PlotWrap>
              </div>
              <div className="pane">
                <div className="pane-head">Dressed states · E<sub>k</sub> vs photon fraction · {inspect != null ? <span style={{ color: "#fff" }}>▸ #{inspect} on 3D · click to release</span> : <span>click a state to project onto molecules</span>}</div>
                <PanelEqn t={"\\hat H|\\phi_k\\rangle=E_k|\\phi_k\\rangle,\\qquad \\text{photon fraction}=|\\langle 0|\\phi_k\\rangle|^2"} where="2 bright polaritons + N−1 dark" />
                <div className="pane-sub"><b>What:</b> each dot is an eigenstate (polariton). The two at the right edge (photon-like) are the bright LP/UP polaritons; the dense stack pinned at the bare energy is the N−1 dark/invisible states. Click one to highlight it in 3D.</div>
                <PlotWrap fit cw={HP_CW} ch={HP_CH} area={{ ml: HP_ML, mt: HP_MT, pw: HP_PW, ph: HP_PH }} inv={(px, py) => { const ds = dynState.current; if (!ds) return null; const emin = ds.eigs[0]!, emax = ds.eigs[ds.n - 1]!, pad = (emax - emin) * 0.14 + 1e-4, elo = emin - pad, ehi = emax + pad; return [((px - HP_ML) / HP_PW).toFixed(2), fmt(elo + (1 - (py - HP_MT) / HP_PH) * (ehi - elo), 3)]; }}>
                  <canvas ref={hopCanvas} className="cv click" onClick={onHopClick} />
                </PlotWrap>
              </div>
              <div className="pane">
                <div className="pane-head">Transmission S(ω) · |FFT of the photon return amplitude ⟨0|ψ(t)⟩, e<sup>−Γt</sup>-windowed|² · Lorentzian vacuum-Rabi doublet weighted by photon fraction</div>
                <PanelEqn t={"S(\\omega)=\\big|\\,\\mathrm{FFT}\\big[\\langle 0|\\psi(t)\\rangle\\,e^{-\\Gamma t}\\big]\\,\\big|^2"} where="peaks at the polariton energies E_k" />
                <div className="pane-sub"><b>What:</b> what a transmission/PL spectrometer would measure — two polariton peaks (LP and UP); their separation is the Rabi splitting Ω_R. The width Γ is set by the spectral-linewidth slider (this is the only place loss enters).</div>
                <PlotWrap fit cw={FF_CW} ch={FF_CH} area={{ ml: FF_ML, mt: FF_MT, pw: FF_PW, ph: FF_PH }} inv={(px, py) => { const ds = dynState.current; if (!ds) return null; const lo = ds.eigs[0]!, hi = ds.eigs[ds.n - 1]!, hw = Math.max(0.5, (hi - lo) * 0.7 + 0.08), wlo = WA - hw, whi = WA + hw; return [(wlo + ((px - FF_ML) / FF_PW) * (whi - wlo)).toFixed(3), (1 - (py - FF_MT) / FF_PH).toFixed(2)]; }}>
                  <canvas ref={fftCanvas} className="cv" />
                </PlotWrap>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT — diagnostic dock */}
        <aside className="dock">
          {regime === "single" ? (
            <>
              <div className="pane">
                <div className="pane-head">Panel A · joint density matrix ρ · |ρ_ij| brightness · sign <i style={{ color: "#00ffff", fontStyle: "normal" }}>+ ▪</i> <i style={{ color: "#ff3333", fontStyle: "normal" }}>− ▪</i> · coherence = cyan/red pair</div>
                <PanelEqn t={"\\rho_{ij}=\\langle i|\\hat\\rho|j\\rangle,\\quad |i\\rangle\\in\\{|n,g\\rangle,\\,|n,e\\rangle\\}"} where="cavity Fock n ⊗ atom {g,e}" />
                <div className="pane-sub"><b>What:</b> each cell is one matrix element of the joint atom⊗cavity state. <b>Diagonal</b>=populations; the off-diagonal <b>cyan/red pair</b> at (|0,e⟩,|1,g⟩) is the vacuum-Rabi coherence, flipping sign as the quantum sloshes. <b>Approx:</b> single-excitation subspace — the full 32×32 ρ is cropped to its populated 8×8 block.</div>
                <canvas ref={rhoCanvas} className="cv" />
              </div>
              <RegimeBadge gEff={params.g} wc={1} loss={Math.max(params.kappa, params.gamma)} lossSym="κ,γ" />
              <div className="pane">
                <div className="pane-head">Live observables · open Jaynes–Cummings (RWA)</div>
                <div className="pane-sub">one two-level emitter + one lossy cavity mode; rotating-wave approximation, single-excitation dynamics.</div>
                <table className="metrics"><tbody>
                  <Row label={<>time <i>t</i></>} k="t" r={read} unit="ω_c⁻¹" tip="elapsed time, in units of inverse cavity frequency (1/ω_c) — dimensionless" />
                  <Row label={<>photon ⟨<i>a</i>†<i>a</i>⟩</>} k="n" r={read} tip="mean intracavity photon number ⟨a†a⟩ (dimensionless; ≤1 in this single-excitation manifold)" />
                  <Row label={<>excited ⟨<i>P</i>ₑ⟩</>} k="pe" r={read} tip="emitter excited-state probability ⟨P_e⟩ ∈ [0,1] (dimensionless)" />
                  <Row label={<>purity Tr<i>ρ</i>²</>} k="pur" r={read} tip="state purity Tr(ρ²) ∈ [0,1]: 1 = pure, <1 = mixed (decohered)" />
                  <Row label={<>entropy <i>S</i></>} k="ent" r={read} unit="nats" tip="von Neumann entropy S = −Tr(ρ ln ρ), in nats; rises as the state decoheres (max ln2≈0.69)" />
                  <Row label={<>cooperativity <i>C</i></>} k="coop" r={read} tip="single-atom cooperativity C = g²/κγ (dimensionless); C≫1 ⇒ strong light–matter coupling" />
                  <Row label={<>Tr <i>ρ</i> <span className="rb-chk">✓1</span></>} k="tr" r={read} tip="trace of ρ — must stay 1 (probability conservation); numerical-health check" />
                  <Row label={<>min eig(<i>ρ</i>) <span className="rb-chk">✓≈0</span></>} k="eig" r={read} tip="smallest eigenvalue of ρ — ≈0 confirms a physically valid (positive-semidefinite) density matrix" />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : regime === "collective" ? (
            <>
              <RegimeBadge gEff={sp.g * Math.sqrt(sp.m)} wc={1} loss={Math.max(sp.sigma, 1e-9)} lossSym="σ" splitSym="2g√N" />
              <div className="pane">
                <div className="pane-head">Spectrum at resonance · measured vs theory</div>
                <div className="pane-sub">Ω_R (measured LP–UP gap) should equal 2g√N (theory) — they match here. All energies in units of ω_a (dimensionless).</div>
                <table className="metrics"><tbody>
                  <Row label={<>Ω<sub>R</sub></>} k="rabi" r={read} unit="ω_a" tip="vacuum-Rabi (LP–UP) splitting MEASURED from the spectrum, in units of ω_a" />
                  <Row label={<>2<i>g</i>√<i>N</i></>} k="rabiT" r={read} unit="ω_a" tip="collective Rabi splitting, THEORY (2g√N); should equal Ω_R — a self-consistency check" />
                  <Row label={<>dark states</>} k="ndark" r={read} tip="number of subradiant 'dark' states (= N−1) that do not couple to the cavity photon" />
                  <Row label={<><i>σ</i>/Ω<sub>R</sub></>} k="ratio" r={read} tip="disorder ÷ Rabi splitting (dimensionless); >1 ⇒ disorder smears out the polaritons" />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : regime === "cavity" ? (
            <>
              <div className="pane">
                <div className="pane-head">Hardware → coupling chain · every value derived from the geometry</div>
                <div className="pane-sub">drag the hardware sliders → watch each row update; the chain ends at the single-emitter coupling g and the collective crossover N*.</div>
                <table className="metrics"><tbody>
                  <Row label={<>resonance <i>λ</i></>} k="cavLam" r={read} unit="nm" tip="cavity resonance wavelength" />
                  <Row label={<>photon <Tex t="\hbar\omega_c" /></>} k="cavWc" r={read} unit="eV" tip="cavity photon energy ħω_c = hc/λ" />
                  <Row label={<>spacer <Tex t="L_\mathrm{cav}" /></>} k="cavGap" r={read} unit="nm" tip="physical λ/2 spacer thickness between the mirrors" />
                  <Row label={<>stack length</>} k="cavTotal" r={read} unit="nm" tip="total length of the full DBR+spacer+DBR stack" />
                  <Row label={<>penetration <Tex t="L_\mathrm{DBR}" /></>} k="cavLdbr" r={read} unit="nm" tip="field penetration depth into each Bragg mirror (vacuum-k₀ phase-penetration approximation)" />
                  <Row label={<>effective <Tex t="L_\mathrm{eff}" /></>} k="cavLeff" r={read} unit="nm" tip="effective cavity length L_eff = L_cav + 2·L_DBR (sets the mode volume)" />
                  <Row label={<>mirror <i>R</i></>} k="cavR" r={read} tip="mirror power reflectance R (dimensionless, 0–1); higher R ⇒ higher finesse, longer photon lifetime" />
                  <Row label={<>FSR</>} k="cavFSR" r={read} unit="THz" tip="free spectral range — frequency spacing between longitudinal cavity modes" />
                  <Row label={<>finesse <i>F</i></>} k="cavF" r={read} tip="cavity finesse F = π√R/(1−R) (dimensionless) = FSR/linewidth" />
                  <Row label={<>FWHM</>} k="cavFWHM" r={read} unit="THz" tip="cavity resonance linewidth (full width at half maximum)" />
                  <Row label={<>quality <i>Q</i></>} k="cavQ" r={read} tip="quality factor Q = ω_c/κ (dimensionless); photons live ~Q oscillations" />
                  <Row label={<>photon <i>τ</i></>} k="cavTau" r={read} unit="fs" tip="cavity photon lifetime τ = Q/ω_c" />
                  <Row label={<>cavity loss <i>κ</i></>} k="cavKappa" r={read} unit="meV" tip="cavity photon-loss rate κ = ω_c/Q (mirror leakage). Shown here for the 2g√N-vs-κ comparison; the live single-emitter dynamics run lossless." />
                  <Row label={<>stopband Δf/f₀</>} k="cavStop" r={read} tip="DBR photonic-bandgap width as a fraction of f₀ (dimensionless, shown in %); set by index contrast, not mirror-pair count" />
                  <Row label={<><Tex t="V_m" /></>} k="cavVm" r={read} unit="(λ/n)³" tip="cavity mode volume — ASSUMES a diffraction-limited mode waist w₀=λ/2n; g and N* scale with 1/√V_m" />
                  <Row label={<>coupling <i>g</i></>} k="cavGd" r={read} unit="meV" tip="single-emitter vacuum-Rabi coupling g = µ·E_vac/ħ — ASSUMES a µ=5 D transition dipole; g and N* scale with µ" />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : regime === "dynamics" ? (
            <>
              <RegimeBadge gEff={dyn.g * Math.sqrt(dyn.m)} wc={1} loss={Math.max(dyn.sigma, 1e-9)} lossSym="σ" splitSym="2g√N" />
              <div className="pane">
                <div className="pane-head">Live observables · closed unitary Tavis–Cummings</div>
                <div className="pane-sub">one excitation shared among 1 photon + N emitters; populations conserve Σ P_k = 1.</div>
                <table className="metrics"><tbody>
                  <Row label={<Tex t="\tau = \Omega_R t/2\pi" />} k="simTau" r={read} unit="cyc" tip="elapsed time in vacuum-Rabi cycles (τ = Ω_R·t/2π); the master clock" />
                  <Row label={<Tex t="t" />} k="simTfs" r={read} unit="fs" tip="elapsed physical time in femtoseconds" />
                  <Row label={<Tex t="P_{\mathrm{photon}}" />} k="simPh" r={read} tip="probability the excitation is in the cavity photon (dimensionless, 0–1)" />
                  <Row label={<Tex t="P_{\mathrm{bright}}" />} k="simBr" r={read} tip="probability in the bright/superradiant collective state that couples to light (dimensionless)" />
                  <Row label={<Tex t="P_{\mathrm{dark}}" />} k="simDk" r={read} tip="probability in the dark/subradiant manifold (N−1 states invisible to the photon)" />
                  <Row label={<>Ω<sub>R</sub> <span className="rb-chk" style={{ color: "var(--dim)" }}>norm.</span></>} k="simRabi" r={read} unit="ω_c" tip="vacuum-Rabi splitting (LP→UP gap = 2g√N on resonance), in units of ω_c (dimensionless)" />
                  <Row label={<>Ω<sub>R</sub> <span className="rb-chk" style={{ color: "var(--dim)" }}>phys.</span></>} k="simRabiMeV" r={read} unit="meV" tip="the same vacuum-Rabi splitting in physical energy units (meV)" />
                  <Row label={<Tex t="\textstyle\sum_k P_k" />} k="simNorm" r={read} tip="total probability — must stay 1 (closed unitary evolution, no loss)" />
                </tbody></table>
              </div>
              <div className="pane">
                <div className="pane-head">⟨i|Ĥ|j⟩ arrowhead Hamiltonian · live</div>
                <div className="pane-sub">diagonal = site energies ω<sub>i</sub> (photon + each emitter); the arrow row/column = couplings g<sub>i</sub>. Colour: <b style={{ color: CYAN }}>cyan +</b> / <b style={{ color: RED }}>red −</b>, brightness ∝ √|H<sub>ij</sub>|.</div>
                <canvas ref={matCanvas} className="cv" style={{ margin: "0 auto" }} />
              </div>
              {Hud}
            </>
          ) : (
            <>
              <RegimeBadge gEff={htc.g * Math.sqrt(htc.N)} wc={1} loss={htc.gamma} lossSym="γ" splitSym="2g√N" />
              <div className="pane">
                <div className="pane-head">Vibronic observables · Holstein–Tavis–Cummings</div>
                <div className="pane-sub">molecules with a vibration, coupled to one cavity mode. Ω_R is the same 2g√N as the COLLECTIVE/DYNAMICS tabs (in meV here).</div>
                <table className="metrics"><tbody>
                  <Row label={<Tex t="S\;(\text{Huang-Rhys})" />} k="htS" r={read} tip="Huang–Rhys factor S = λ² — the exciton–phonon (vibronic) coupling strength (dimensionless); larger S = more vibrational replicas" />
                  <Row label={<Tex t="E_r = S\omega_v" />} k="htEr" r={read} unit="meV" tip="reorganization energy E_r = S·ω_v (= Stokes shift / 2) — energy released as the molecule relaxes its geometry after excitation" />
                  <Row label={<Tex t="S_{\mathrm{bright}} = S/N" />} k="htSbright" r={read} tip="per-molecule vibronic coupling after collective dilution by the ensemble (dimensionless); shrinks as 1/N" />
                  <Row label={<Tex t="\Omega_R^{\mathrm{bare}} = 2g\sqrt{N}" />} k="htRabi" r={read} unit="meV" tip="collective vacuum-Rabi splitting 2g√N (same as the COLLECTIVE/DYNAMICS Ω_R), BEFORE the e^{-S/2} vibronic dressing" />
                  <Row label={<Tex t="\Omega_R^{\mathrm{eff}} = 2g\sqrt{N}\,e^{-S/2}" />} k="htRabiEff" r={read} unit="meV" tip="vibronically-dressed Rabi splitting — the actual cyan polariton-doublet width you see in the spectrum" />
                  <Row label={<Tex t="n_{\mathrm{vib}}" />} k="htNvib" r={read} unit="levels" tip="number of vibrational Fock levels kept per molecule (basis truncation / convergence parameter, not a physical quantum number)" />
                </tbody></table>
              </div>
              <div className="pane">
                <div className="pane-head">⟨i|Ĥ<sub>HTC</sub>|j⟩ · photon ⊕ vibronic blocks · Holstein/FC off-diagonals brighten with S</div>
                <canvas ref={matCanvas} className="cv" style={{ margin: "0 auto" }} />
              </div>
              {Hud}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// 3.C · hover crosshair + live physics-coordinate readout for any plot canvas. Wraps the plot, paints a
// 1px vertical guide + the [x,y] value (mapped back through the plot's own axes) on a non-interactive
// overlay so the underlying canvas keeps its click handlers. inv() returns null when off the data.
// custom 3D-scene control panel — plain DOM (native checkbox/range), docked over the viewport top-right,
// z-indexed above the WebGL canvas so every control is actually clickable. Replaces the embedded Leva panel.
function ScenePanel({ open, onToggle, v, set }: { open: boolean; onToggle: () => void; v: SceneControls; set: (p: Partial<SceneControls>) => void }) {
  const Slider = ({ label, k, min, max }: { label: string; k: "fieldGlow" | "moleculeScale" | "moleculeGlow"; min: number; max: number }) => (
    <label className="sc-row"><span>{label}</span>
      <span className="sc-slide"><input type="range" min={min} max={max} step={0.01} value={v[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<SceneControls>)} /><b>{v[k].toFixed(2)}</b></span>
    </label>
  );
  return (
    <div className={"scene-ctrl" + (open ? " open" : "")}>
      <button className="sc-head" onClick={onToggle} title="show/hide 3D scene controls" aria-expanded={open}>
        <span className="sc-caret">{open ? "▾" : "▸"}</span>3D SCENE
      </button>
      {open ? (
        <div className="sc-body">
          <div className="sc-note">view only · the physics (N, g, σ, polarization, order) is in the left rail</div>
          <label className="sc-row sc-check"><input type="checkbox" checked={v.autoRotate} onChange={(e) => set({ autoRotate: e.target.checked })} /> auto-rotate</label>
          <label className="sc-row sc-check"><input type="checkbox" checked={v.showFieldDiscs} onChange={(e) => set({ showFieldDiscs: e.target.checked })} /> cavity field</label>
          <label className="sc-row sc-check"><input type="checkbox" checked={v.showDipoleArrows} onChange={(e) => set({ showDipoleArrows: e.target.checked })} /> dipole arrows</label>
          <Slider label="field glow" k="fieldGlow" min={0.2} max={2.5} />
          <Slider label="molecule size" k="moleculeScale" min={0.5} max={2.0} />
          <Slider label="molecule glow" k="moleculeGlow" min={0.2} max={2.5} />
        </div>
      ) : null}
    </div>
  );
}

function PlotWrap({ cw, ch, area, inv, fit, children }: { cw: number; ch: number; area: { ml: number; mt: number; pw: number; ph: number }; inv: (px: number, py: number) => [string, string] | null; fit?: boolean; children: React.ReactNode }) {
  const ov = useRef<HTMLCanvasElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const cv = ov.current; if (!cv) return;
    // measure the PLOT canvas itself (the overlay's previous sibling), not the wrapper — in fit mode the
    // wrapper centres a scaled-down canvas, so the wrapper box is larger than the plot. Mapping mouse→data
    // by the canvas rect (cw/r.width, ch/r.height) stays correct at any display scale.
    const main = (cv.previousElementSibling as HTMLElement | null) ?? e.currentTarget;
    const r = main.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(cw * d)) { cv.width = Math.round(cw * d); cv.height = Math.round(ch * d); }
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, cw, ch);
    const x = (e.clientX - r.left) * (cw / r.width), y = (e.clientY - r.top) * (ch / r.height);
    if (x < area.ml || x > area.ml + area.pw || y < area.mt || y > area.mt + area.ph) return;
    ctx.strokeStyle = "#ffffff44"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, area.mt); ctx.lineTo(Math.round(x) + 0.5, area.mt + area.ph); ctx.stroke();
    const v = inv(x, y); if (!v) return;
    ctx.fillStyle = "#00ffff"; ctx.font = "10px 'IBM Plex Sans',system-ui,sans-serif";
    const right = x > area.ml + area.pw * 0.62; ctx.textAlign = right ? "right" : "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`[${v[0]}, ${v[1]}]`, x + (right ? -5 : 5), Math.max(area.mt + 11, y - 5));
  };
  const clear = () => { const cv = ov.current; if (!cv) return; const ctx = cv.getContext("2d"); if (ctx) ctx.clearRect(0, 0, cv.width, cv.height); };
  return (<div className={fit ? "plotwrap pw-fit" : "plotwrap"} onMouseMove={onMove} onMouseLeave={clear}>{children}<canvas ref={ov} className="plot-ov" /></div>);
}
function mkCanvas(n: number): HTMLCanvasElement { const c = document.createElement("canvas"); c.width = n; c.height = n; return c; }
function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
// 1.A diagnostic — confirm the transmission doublet is symmetric: the two tallest peaks in the photon
// power spectrum should sit at ω_c ± ‖g‖ (= the LP/UP eigen-energies) with equal height (LP/UP ≈ 1).
function logDoublet(fd: { omega: Float64Array; power: Float64Array }, eigs: Float64Array, n: number, gi: Float64Array) {
  let g2 = 0; for (let i = 0; i < gi.length; i++) g2 += gi[i]! * gi[i]!; const gn = Math.sqrt(g2);
  const { omega, power } = fd, pk: { w: number; p: number }[] = [];
  for (let i = 1; i < power.length - 1; i++) { const w = omega[i]!; if (w < 0.5 || w > 1.5) continue; if (power[i]! > power[i - 1]! && power[i]! >= power[i + 1]! && power[i]! > 0.1) pk.push({ w, p: power[i]! }); }
  pk.sort((a, b) => b.p - a.p);
  const top = pk.slice(0, 2).sort((a, b) => a.w - b.w);
  const ratio = top.length === 2 ? Math.min(top[0]!.p, top[1]!.p) / Math.max(top[0]!.p, top[1]!.p) : NaN;
  console.log(
    `%c[transmission 1.A]%c Ω_R = 2‖g‖ = ${(eigs[n - 1]! - eigs[0]!).toFixed(4)}  ·  predicted peaks ω_c ± ‖g‖ = ${fmt(1 - gn, 4)}, ${(1 + gn).toFixed(4)}  ·  measured ${top.map((t) => `${t.w.toFixed(4)} (h=${t.p.toFixed(3)})`).join("  ")}  ·  LP/UP height ratio = ${ratio.toFixed(3)}`,
    "color:#00ffff;font-weight:600", "color:#8b949e",
  );
}
function argmaxPhoton(cols: SweepCol[]): { j: number; k: number } {
  let bj = 0, bk = 0, bp = -1;
  cols.forEach((c, j) => { for (let k = 0; k < c.photon.length; k++) if (c.photon[k]! > bp) { bp = c.photon[k]!; bj = j; bk = k; } });
  return { j: bj, k: bk };
}
function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo; if (span <= 0) return [lo];
  const raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}
function lerpHex(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((x, i) => Math.round(x + (pb[i]! - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function csv(rows: (string | number)[][]): string { return rows.map((r) => r.join(",")).join("\n"); }
function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
// Serialize a Float64Array as a real NumPy .npy (v1.0, '<f8', C-order) — np.load() reads it directly.
function downloadNpy(name: string, data: Float64Array, shape: number[]) {
  const header = `{'descr': '<f8', 'fortran_order': False, 'shape': (${shape.join(", ")}${shape.length === 1 ? "," : ""}), }`;
  const base = 10 + header.length + 1; // magic(6)+ver(2)+len(2) + header + '\n'
  const pad = (64 - (base % 64)) % 64;
  const headBytes = new TextEncoder().encode(header + " ".repeat(pad) + "\n");
  const buf = new ArrayBuffer(10 + headBytes.length + data.length * 8), dv = new DataView(buf);
  [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0].forEach((b, i) => dv.setUint8(i, b)); // \x93NUMPY v1.0
  dv.setUint16(8, headBytes.length, true);
  new Uint8Array(buf, 10, headBytes.length).set(headBytes);
  for (let i = 0; i < data.length; i++) dv.setFloat64(10 + headBytes.length + i * 8, data[i]!, true);
  const url = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function Row({ label, k, r, unit, v, tip }: { label: React.ReactNode; k?: string; r?: React.MutableRefObject<Record<string, HTMLSpanElement | null>>; unit?: string; v?: string; tip?: string }) {
  return (<tr title={tip}><td className="k">{tip ? <span className="has-tip">{label}</span> : label}</td><td className="v">{k && r ? <span ref={(el) => { r.current[k] = el; }}>—</span> : v}{unit ? <span className="u"> {unit}</span> : null}</td></tr>);
}
// Live coupling-regime classifier. gEff = effective light-matter coupling (g for one emitter, g√N collective);
// loss = the linewidth (max κ,γ) used for the strong-coupling onset 2gEff>loss; η=gEff/ω_c sets ultrastrong.
function regimeClass(gEff: number, wc: number, loss: number) {
  const eta = gEff / wc;
  if (2 * gEff <= loss) return { label: "WEAK", cls: "wk", note: "2g ≤ κ — Purcell regime, no resolvable splitting" };
  if (eta >= 0.1) return { label: "ULTRASTRONG", cls: "us", note: "η = g/ω_c ≥ 0.1 — RWA corrections become significant" };
  return { label: "STRONG", cls: "st", note: "2g > κ, η < 0.1 — resolvable vacuum-Rabi doublet, RWA valid" };
}
function RegimeBadge({ gEff, wc, loss, lossSym = "κ", splitSym = "2g" }: { gEff: number; wc: number; loss: number; lossSym?: string; splitSym?: string }) {
  const r = regimeClass(gEff, wc, loss);
  const r2 = 2 * gEff / Math.max(1e-12, loss);
  return (
    <div className={"regime-badge rb-" + r.cls} title={"coupling regime from η=g/ω_c and " + splitSym + "/" + lossSym + ". " + r.note}>
      <div className="rb-top"><span className="rb-dot" /><span className="rb-label">{r.label} COUPLING</span></div>
      <div className="rb-ratios"><span>η = {splitSym === "2g" ? "g" : "g√N"}/ω_c = {(gEff / wc).toFixed(2)}</span><span>{splitSym}/{lossSym} = {r2 > 999 ? "≫1" : r2.toFixed(loss < 0.1 ? 0 : 1)}</span></div>
      <div className="rb-note">{r.note}</div>
    </div>
  );
}
function Group({ title, k, c, t, children }: { title: string; k: string; c: Record<string, boolean>; t: (k: string) => void; children: React.ReactNode }) {
  const open = !c[k];
  return (
    <div className="tree-group">
      <button className="tree-head" onClick={() => t(k)}><span className="tree-caret">{open ? "−" : "+"}</span>{title}</button>
      {open ? <div className="tree-body">{children}</div> : null}
    </div>
  );
}
function Field(props: { sym: string; texSym?: string; label: string; value: number; min: number; max: number; step: number; unit: string; int?: boolean; tip?: string; onChange: (v: number) => void }) {
  const show = props.int ? `${Math.round(props.value)}` : `${props.value}`;
  const title = (props.tip ? props.tip + " · " : "") + `range ${props.min}–${props.max}${props.unit ? " " + props.unit : ""}`;
  return (
    <div className="knob" title={title}>
      <div className="knob-top">
        <span className="knob-name">{props.label} {props.texSym ? <span className="knob-sym"><Tex t={props.texSym} /></span> : <i>{props.sym}</i>}</span>
        <span className="knob-entry">
          <input className="knob-input" type="number" min={props.min} max={props.max} step={props.step} value={show}
            onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && e.target.value !== "") props.onChange(clamp(v, props.min, props.max)); }} />
          {props.unit ? <span className="u">{props.unit}</span> : null}
        </span>
      </div>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  );
}
function NumField(props: { sym: string; value: number; tip?: string; onChange: (v: number) => void }) {
  return (
    <div className="knob num-only" title={props.tip}>
      <span className={"knob-name" + (props.tip ? " has-tip" : "")}><i>{props.sym}</i></span>
      <input className="knob-input wide" type="number" step={1e-7} value={props.value}
        onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && e.target.value !== "") props.onChange(v); }} />
    </div>
  );
}
