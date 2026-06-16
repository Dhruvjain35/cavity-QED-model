import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { loadWasm, Quantum, solveSpectrum, arrowheadModesGi, arrowheadMatrixGi, cavityPowerSpectrumGi, couplingSweepGi, htcSpectrum, htcFranckCondon, wignerRawOfRho, cavityLayers, cavityField, cavityReflectance, type SimParams } from "./quantum/engine";
import { buildEnsemble, brightWeights } from "./cavity/ensemble";

const MODE_WAIST = 2.4; // TEM00 Gaussian mode waist w (length units of the molecular layout)

// Inline LaTeX via KaTeX — proper math symbols across the lab UI (no plain-text physics variables).
function Tex({ t }: { t: string }) {
  const html = useMemo(() => katex.renderToString(t, { throwOnError: false, displayMode: false }), [t]);
  return <span className="tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

// three.js is heavy and only used by the cavity regime — load it on demand
const CavityScene = lazy(() => import("./cavity/CavityScene").then((m) => ({ default: m.CavityScene })));
const LiveCavityScene = lazy(() => import("./cavity/LiveCavityScene").then((m) => ({ default: m.LiveCavityScene })));

// ── Regime 1 (single emitter) ──
const N_GRID = 100, X_RANGE = 5, DT_FRAME = 0.18, T_LOOP = 80, SERIES_MAX = 600, INV_PI = 1 / Math.PI;
const BASE: SimParams = { nFock: 16, wc: 1.0, wa: 1.0, g: 0.2, kappa: 0.05, gamma: 0.02, gammaPhi: 0.0 };
const DFULL = 32; // 2·N_FOCK — full joint density matrix
// ── Regime 2 (collective) ──
const WA = 1.0, N_DELTA = 121, N_FOCK = 16, NB = 80;

// ── figure layouts (logical px) ──
const W_ML = 42, W_MR = 12, W_MT = 14, W_MB = 34, W_S = 236, NHG = 72;
const W_CW = W_ML + W_S + W_MR, W_CH = W_MT + W_S + W_MB, W_TICKS = [-4, -2, 0, 2, 4];
const S_ML = 38, S_MR = 10, S_MT = 10, S_PW = 512, S_PH = 118, S_MB = 22;
const S_CW = S_ML + S_PW + S_MR, S_CH = S_MT + S_PH + S_MB;
const P_ML = 54, P_MR = 14, P_MT = 14, P_MB = 38, P_W = 500, P_H = 288;
const P_CW = P_ML + P_W + P_MR, P_CH = P_MT + P_H + P_MB;
const B_ML = 24, B_MR = 8, B_MT = 8, B_MB = 20, B_S = 176;
const B_CW = B_ML + B_S + B_MR, B_CH = B_MT + B_S + B_MB;
const R_ML = 16, R_MR = 8, R_MT = 8, R_MB = 16, R_S = 256;
const R_CW = R_ML + R_S + R_MR, R_CH = R_MT + R_S + R_MB;
const CV_ML = 54, CV_MR = 14, CV_MT = 16, CV_MB = 40, CV_W = 516, CV_H = 300;
const CV_CW = CV_ML + CV_W + CV_MR, CV_CH = CV_MT + CV_H + CV_MB;
const N0 = 1.0, NS = 1.52; // air / glass substrate
const RB_ML = 36, RB_MR = 10, RB_MT = 12, RB_MB = 24, RB_PW = 268, RB_PH = 108;
const RB_CW = RB_ML + RB_PW + RB_MR, RB_CH = RB_MT + RB_PH + RB_MB;
const DT_DYN = 0.22, HEAT_COLS = 200;
const PP_ML = 50, PP_MR = 14, PP_MT = 16, PP_MB = 28, PP_PW = 466, PP_PH = 176;
const PP_CW = PP_ML + PP_PW + PP_MR, PP_CH = PP_MT + PP_PH + PP_MB;
const HP_ML = 78, HP_MR = 16, HP_MT = 18, HP_MB = 30, HP_PW = 426, HP_PH = 232;
const HP_CW = HP_ML + HP_PW + HP_MR, HP_CH = HP_MT + HP_PH + HP_MB;
const FF_ML = 52, FF_MR = 14, FF_MT = 14, FF_MB = 28, FF_PW = 464, FF_PH = 132;
const FF_CW = FF_ML + FF_PW + FF_MR, FF_CH = FF_MT + FF_PH + FF_MB;
const FFT_N = 1024, FFT_DT = 0.12; // power-spectrum FFT length + sample step
const SW_ML = 60, SW_MR = 18, SW_MT = 18, SW_MB = 32, SW_PW = 560, SW_PH = 408;
const SW_CW = SW_ML + SW_PW + SW_MR, SW_CH = SW_MT + SW_PH + SW_MB;
const SWEEP_GMAX = 0.2, SWEEP_STEPS = 90;
const HT_ML = 58, HT_MR = 18, HT_MT = 18, HT_MB = 32, HT_PW = 720, HT_PH = 372;
const HT_CW = HT_ML + HT_PW + HT_MR, HT_CH = HT_MT + HT_PH + HT_MB;
const HTC_GRID = 760; // absorption-spectrum sampling points

const PANEL = "#0b101c", INK = "#e2e8f0", DIM = "#94a3b8", AXIS = "#475569";
const COBALT = "#3b82f6", CRIMSON = "#ef4444", EMERALD = "#10b981", AMBER = "#f59e0b", SLATE = "#475569";
const GRIDLINE = "rgba(148,163,184,0.12)", CROSS = "rgba(148,163,184,0.45)";

const minus = (s: string) => s.replace("-", "−");
const fmt = (v: number, d: number) => minus(v.toFixed(d));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lin = (a: number, b: number, s: number) => Math.round(a + (b - a) * s);

// dark diverging Wigner colormap: 0 → deep slate #101726, +W → cobalt, −W (non-classical) → crimson
function darkWigner(w: Float64Array, n: number, wmax: number): ImageData {
  const px = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < w.length; i++) {
    const t = clamp((w[i]! + wmax) / (2 * wmax), 0, 1);
    let r: number, g: number, b: number;
    if (t < 0.5) { const s = t / 0.5; r = lin(255, 16, s); g = lin(45, 23, s); b = lin(85, 38, s); }
    else { const s = (t - 0.5) / 0.5; r = lin(16, 56, s); g = lin(23, 122, s); b = lin(38, 246, s); }
    const o = i * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  return new ImageData(px, n, n);
}

// dark sequential Husimi Q map (Q ≥ 0): 0 → panel slate, rising → cyan → pale
function husimiImage(q: Float64Array, n: number, qmax: number): ImageData {
  const px = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < q.length; i++) {
    const t = clamp(q[i]! / qmax, 0, 1);
    let r: number, g: number, b: number;
    if (t < 0.5) { const s = t / 0.5; r = lin(11, 34, s); g = lin(16, 211, s); b = lin(28, 238, s); }
    else { const s = (t - 0.5) / 0.5; r = lin(34, 224, s); g = lin(211, 247, s); b = lin(238, 255, s); }
    const o = i * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }
  return new ImageData(px, n, n);
}

type SweepCol = { x: number; eigs: Float64Array; photon: Float64Array };
type Regime = "single" | "collective" | "cavity" | "dynamics" | "vibronic";
type Pt = { t: number; n: number; pe: number; pur: number };

export function App() {
  const [regime, setRegime] = useState<Regime>("single");
  const [params, setParams] = useState({ g: 0.2, kappa: 0.05, gamma: 0.02 });
  const [tol, setTol] = useState({ atol: 1e-6, rtol: 1e-6 });
  const [sp, setSp] = useState({ m: 20, g: 0.05, sigma: 0.0, seed: 1 });
  const [cav, setCav] = useState({ lambda: 550, nHi: 2.5, nLo: 1.46, pairs: 4, nCav: 1.6, g: 1.6 });
  const [htc, setHtc] = useState({ wv: 0.15, S: 1.0, g: 0.05, N: 1, gamma: 0.012 }); // HTC: ω_v, Huang-Rhys S, cavity g, collective N, broadening γ (units of ω_c)
  const [dyn, setDyn] = useState({ m: 12, g: 0.06, sigma: 0.04, seed: 1, init: 0, order: 0.7 });
  const [inspect, setInspect] = useState<number | null>(null); // clicked dressed eigenstate (UI badge)
  const [dynSweep, setDynSweep] = useState(false); // coupling-sweep dispersion mode (replaces the 3D)
  const [wcEv, setWcEv] = useState(2.0); // physical cavity-photon energy ℏω_c in eV (display scale only)
  // the shared molecular ensemble (positions, dipoles, coupling factors) — feeds BOTH the WASM
  // arrowhead and the 3D view, so orientation/position physics and visuals never diverge.
  const ensemble = useMemo(() => buildEnsemble(dyn.m, dyn.seed, dyn.order, MODE_WAIST), [dyn.m, dyn.seed, dyn.order]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(true);
  const [fixedScale, setFixedScale] = useState(true);
  const [ready, setReady] = useState(false);

  const wigCanvas = useRef<HTMLCanvasElement>(null), husimiCanvas = useRef<HTMLCanvasElement>(null), seriesCanvas = useRef<HTMLCanvasElement>(null);
  const rhoCanvas = useRef<HTMLCanvasElement>(null), specCanvas = useRef<HTMLCanvasElement>(null);
  const bridgeCanvas = useRef<HTMLCanvasElement>(null);
  const cavCanvas = useRef<HTMLCanvasElement>(null);
  const rabiCanvas = useRef<HTMLCanvasElement>(null);
  const popCanvas = useRef<HTMLCanvasElement>(null);
  const hopCanvas = useRef<HTMLCanvasElement>(null);
  const dynState = useRef<{ eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; bright: Float64Array; hist: Float64Array[] } | null>(null);
  const simT = useRef(0);
  const hopMarks = useRef<{ x: number; y: number; k: number }[]>([]);
  const inspectRef = useRef<number | null>(null); // dressed eigenstate frozen onto the 3D (null = live)
  const fftCanvas = useRef<HTMLCanvasElement>(null), sweepCanvas = useRef<HTMLCanvasElement>(null);
  const fftData = useRef<{ omega: Float64Array; power: Float64Array } | null>(null);
  const sweepData = useRef<{ gs: Float64Array; eigs: Float64Array[] } | null>(null);
  const htcCanvas = useRef<HTMLCanvasElement>(null);
  const htcData = useRef<{ live: { eigs: Float64Array; photon: Float64Array; absorption: Float64Array }; fc: { pos: Float64Array; weight: Float64Array }; nVib: number } | null>(null);
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

  regimeRef.current = regime; playingRef.current = playing; scaleRef.current = fixedScale; tolRef.current = tol;
  sweepRef.current = dynSweep; dynGRef.current = dyn.g; wcRef.current = wcEv;
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  useEffect(() => {
    let alive = true;
    loadWasm().then(() => {
      if (!alive) return;
      quantum.current?.dispose();
      quantum.current = new Quantum({ ...BASE, ...params });
      series.current = []; setReady(true);
    });
    return () => { alive = false; };
  }, [params]);

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
  }, [regime, sp]);

  useEffect(() => {
    if (regime !== "cavity") return;
    loadWasm().then(() => { drawCavity(); drawRabi(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, cav]);

  useEffect(() => {
    if (regime !== "dynamics") return;
    loadWasm().then(() => {
      const gi = Float64Array.from(ensemble.factors, (f) => f * dyn.g); // g_i = g_0·(μ̂_i·ε̂)·f(r_i)
      const { eigs, vecs, n } = arrowheadModesGi(WA, WA, dyn.sigma, dyn.seed, gi);
      const c = new Float64Array(n);
      for (let k = 0; k < n; k++) c[k] = vecs[dyn.init * n + k]!; // ⟨φ_k|ψ0⟩ for the chosen initial site
      dynState.current = { eigs, vecs, n, c, bright: brightWeights(ensemble.factors), hist: [] };
      simT.current = 0;
      inspectRef.current = null; setInspect(null); // a new ensemble invalidates the inspected state
      fftData.current = cavityPowerSpectrumGi(WA, WA, dyn.sigma, dyn.seed, gi, FFT_N, FFT_DT);
      sweepData.current = couplingSweepGi(WA, WA, dyn.sigma, dyn.seed, ensemble.factors, 0, SWEEP_GMAX, SWEEP_STEPS);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, dyn]);

  useEffect(() => {
    if (regime !== "vibronic") return;
    loadWasm().then(() => {
      const S = htc.S, lambda = Math.sqrt(S), N = htc.N;
      const nVib = Math.min(48, Math.max(10, Math.round(8 + 4 * S)));
      // collective polaron decoupling: the bright polariton sees λ→λ/√N, g→g√N (Chem Rev §6.4)
      const live = htcSpectrum(WA, WA, htc.wv, lambda / Math.sqrt(N), htc.g * Math.sqrt(N), nVib);
      const fc = htcFranckCondon(WA, htc.wv, lambda, 12);
      htcData.current = { live, fc, nVib };
      drawHtc(); updateHtcReadouts();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, htc, wcEv]);

  useEffect(() => {
    dpr.current = Math.min(window.devicePixelRatio || 1, 2);
    offscreen.current = mkCanvas(N_GRID); husimiOff.current = mkCanvas(NHG); bridgeOff.current = mkCanvas(NB);
    const loop = () => {
      const q = quantum.current;
      if (q && regimeRef.current === "single") {
        if (playingRef.current) {
          q.advance(DT_FRAME, tolRef.current.atol, tolRef.current.rtol);
          series.current.push({ t: q.time, n: q.photon, pe: q.excited, pur: q.purity });
          if (series.current.length > SERIES_MAX) series.current.shift();
          if (q.time > T_LOOP) { q.reset(); series.current = []; }
        }
        drawWigner(q); drawHusimi(q); drawSeries(); drawRho(q); updateReadouts(q);
      } else if (regimeRef.current === "dynamics" && dynState.current) {
        const ds = dynState.current;
        if (playingRef.current) simT.current += DT_DYN;
        const d = decompAt(simT.current);
        if (playingRef.current) { ds.hist.push(Float64Array.of(d.ph, d.br, d.dk)); if (ds.hist.length > HEAT_COLS) ds.hist.shift(); }
        drawPopTraces(); drawDressed(); drawPowerSpectrum(); updateSimReadouts(d);
        if (sweepRef.current) drawSweep();
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sized(cv: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
    const bw = Math.round(w * dpr.current);
    if (cv.width !== bw) { cv.width = bw; cv.height = Math.round(h * dpr.current); cv.style.width = w + "px"; cv.style.height = h + "px"; }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0);
    return ctx;
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
    const xPx = (x: number) => W_ML + ((x + X_RANGE) / (2 * X_RANGE)) * W_S;
    const pPx = (p: number) => W_MT + ((X_RANGE - p) / (2 * X_RANGE)) * W_S;
    ctx.lineWidth = 0.5; ctx.strokeStyle = GRIDLINE;
    for (const t of W_TICKS) { if (t === 0) continue; seg(ctx, xPx(t), W_MT, xPx(t), W_MT + W_S); seg(ctx, W_ML, pPx(t), W_ML + W_S, pPx(t)); }
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; ctx.strokeStyle = CROSS;
    seg(ctx, xPx(0), W_MT, xPx(0), W_MT + W_S); seg(ctx, W_ML, pPx(0), W_ML + W_S, pPx(0)); ctx.restore();
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(W_ML, W_MT, W_S, W_S);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of W_TICKS) { seg(ctx, xPx(t), W_MT + W_S, xPx(t), W_MT + W_S + 3); ctx.fillText(minus(`${t}`), xPx(t), W_MT + W_S + 6); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of W_TICKS) { seg(ctx, W_ML, pPx(t), W_ML - 3, pPx(t)); ctx.fillText(minus(`${t}`), W_ML - 6, pPx(t)); }
    ctx.fillStyle = INK; ctx.font = "italic 14px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
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
    const xPx = (x: number) => W_ML + ((x + X_RANGE) / (2 * X_RANGE)) * W_S;
    const pPx = (p: number) => W_MT + ((X_RANGE - p) / (2 * X_RANGE)) * W_S;
    ctx.lineWidth = 0.5; ctx.strokeStyle = GRIDLINE;
    for (const t of W_TICKS) { if (t === 0) continue; seg(ctx, xPx(t), W_MT, xPx(t), W_MT + W_S); seg(ctx, W_ML, pPx(t), W_ML + W_S, pPx(t)); }
    ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; ctx.strokeStyle = CROSS;
    seg(ctx, xPx(0), W_MT, xPx(0), W_MT + W_S); seg(ctx, W_ML, pPx(0), W_ML + W_S, pPx(0)); ctx.restore();
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(W_ML, W_MT, W_S, W_S);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of W_TICKS) { seg(ctx, xPx(t), W_MT + W_S, xPx(t), W_MT + W_S + 3); ctx.fillText(minus(`${t}`), xPx(t), W_MT + W_S + 6); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of W_TICKS) { seg(ctx, W_ML, pPx(t), W_ML - 3, pPx(t)); ctx.fillText(minus(`${t}`), W_ML - 6, pPx(t)); }
    ctx.fillStyle = INK; ctx.font = "italic 14px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("x", W_ML + W_S / 2, W_CH - 6);
    ctx.save(); ctx.translate(12, W_MT + W_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("p", 0, 0); ctx.restore();
  }

  function drawSeries() {
    const cv = seriesCanvas.current; if (!cv) return;
    const ctx = sized(cv, S_CW, S_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, S_CW, S_CH);
    const yOf = (v: number) => S_MT + (1 - v) * S_PH;
    ctx.font = "500 9px 'B612 Mono', monospace"; ctx.fillStyle = DIM;
    for (const v of [0, 0.5, 1]) {
      ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5;
      seg(ctx, S_ML, yOf(v), S_ML + S_PW, yOf(v)); seg(ctx, S_ML - 3, yOf(v), S_ML, yOf(v));
      ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), S_ML - 6, yOf(v));
    }
    const pts = series.current;
    if (pts.length >= 2) {
      const t0 = pts[0]!.t, t1 = pts[pts.length - 1]!.t, span = Math.max(t1 - t0, 1e-6);
      const xOf = (t: number) => S_ML + ((t - t0) / span) * S_PW;
      const trace = (key: "n" | "pe" | "pur", color: string) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath();
        pts.forEach((p, i) => { const x = xOf(p.t), y = yOf(Math.min(p[key], 1)); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
      };
      trace("n", COBALT); trace("pe", CRIMSON); trace("pur", EMERALD);
      ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(t0.toFixed(0), S_ML, S_MT + S_PH + 5); ctx.fillText(t1.toFixed(0), S_ML + S_PW, S_MT + S_PH + 5);
    }
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(S_ML, S_MT, S_PW, S_PH);
    ctx.fillStyle = INK; ctx.font = "italic 12px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("t", S_ML + S_PW / 2, S_CH - 4);
  }

  function drawRho(q: Quantum) {
    const cv = rhoCanvas.current; if (!cv) return;
    const ctx = sized(cv, R_CW, R_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, R_CW, R_CH);
    const a = q.rhoAbs(), cell = R_S / DFULL;
    let max = 1e-6; for (const v of a) if (v > max) max = v;
    for (let i = 0; i < DFULL; i++) for (let j = 0; j < DFULL; j++) {
      const v = Math.sqrt(a[i * DFULL + j]! / max);
      ctx.fillStyle = `rgb(${lin(11, 96, v)},${lin(16, 165, v)},${lin(28, 250, v)})`; // panel → cobalt
      ctx.fillRect(R_ML + j * cell, R_MT + i * cell, cell + 0.6, cell + 0.6);
    }
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(R_ML, R_MT, R_S, R_S);
    ctx.fillStyle = DIM; ctx.font = "500 9px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("0", R_ML + cell / 2, R_MT + R_S + 4); ctx.fillText("31", R_ML + R_S - cell / 2, R_MT + R_S + 4);
    ctx.fillStyle = INK; ctx.font = "italic 11px 'B612', sans-serif";
    ctx.fillText("j", R_ML + R_S / 2, R_CH - 4);
    ctx.save(); ctx.translate(9, R_MT + R_S / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("i", 0, 0); ctx.restore();
  }

  function updateReadouts(q: Quantum) {
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    const { g, kappa, gamma } = params;
    set("t", q.time.toFixed(2)); set("n", q.photon.toFixed(4)); set("pe", q.excited.toFixed(4));
    set("pur", q.purity.toFixed(4)); set("ent", q.entropy.toFixed(4)); set("coop", (g * g / (kappa * gamma)).toFixed(1));
    set("tr", q.trace.toFixed(6)); set("eig", q.minEig.toExponential(1));
  }

  function renderSpectrum() { drawSpectrum(); drawBridge(); updateSpecReadouts(); }

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
    for (const s of sweep.current) {
      const x = xOf(s.x);
      for (let k = 0; k < s.eigs.length; k++) {
        const t = Math.min(s.photon[k]! / 0.5, 1);
        ctx.fillStyle = lerpHex(SLATE, COBALT, t);
        ctx.beginPath(); ctx.arc(x, yOf(s.eigs[k]!), 1.1 + 1.5 * t, 0, 2 * Math.PI); ctx.fill();
      }
    }
    const v = sel.current;
    if (v && sweep.current[v.j]) {
      const col = sweep.current[v.j]!, k = Math.min(v.k, col.eigs.length - 1);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(xOf(col.x), yOf(col.eigs[k]!), 5.5, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(P_ML, P_MT, P_W, P_H);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of xticks) { seg(ctx, xOf(t), P_MT + P_H, xOf(t), P_MT + P_H + 3); ctx.fillText(minus(`${Math.round(t)}`), xOf(t), P_MT + P_H + 6); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const e of yticks) { seg(ctx, P_ML, yOf(e), P_ML - 3, yOf(e)); ctx.fillText(fmt(e, 2), P_ML - 6, yOf(e)); }
    ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "13px 'B612', sans-serif"; ctx.fillText("detuning  (ω_c − ω_a) / g", P_ML + P_W / 2, P_CH - 7);
    ctx.save(); ctx.translate(13, P_MT + P_H / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top";
    ctx.font = "italic 14px 'B612', sans-serif"; ctx.fillText("E  (ω_a)", 0, 0); ctx.restore();
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
    ctx.fillStyle = INK; ctx.font = "italic 11px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
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
    set("ndark", `${Array.from(mid.photon).filter((p) => p < 0.01).length}`);
    set("ratio", (sp.sigma / (theory || 1e-9)).toFixed(3));
  }

  function onSpecClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cv = specCanvas.current; if (!cv || sweep.current.length === 0) return;
    const rect = cv.getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left - P_ML) / P_W, 0, 1), py = e.clientY - rect.top;
    const j = Math.round(frac * (N_DELTA - 1)), col = sweep.current[j]; if (!col) return;
    const { emin, emax } = specMap.current;
    const yOf = (en: number) => P_MT + ((emax - en) / (emax - emin)) * P_H;
    let bestK = 0, bestD = Infinity;
    for (let k = 0; k < col.eigs.length; k++) { const d = Math.abs(yOf(col.eigs[k]!) - py); if (d < bestD) { bestD = d; bestK = k; } }
    sel.current = { j, k: bestK }; renderSpectrum();
  }

  function drawCavity() {
    const cvEl = cavCanvas.current; if (!cvEl) return;
    const ctx = sized(cvEl, CV_CW, CV_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, CV_CW, CV_CH);
    const layers = cavityLayers(cav.lambda, cav.nHi, cav.nLo, cav.pairs, cav.nCav);
    let total = 0;
    const bands = layers.map((l) => { const b = { z0: total, d: l.d, n: l.n }; total += l.d; return b; });
    const { z, intensity } = cavityField(cav.lambda, cav.nHi, cav.nLo, cav.pairs, cav.nCav, N0, NS, 30);
    let imax = 1e-9; for (const v of intensity) if (v > imax) imax = v;
    const xOf = (zz: number) => CV_ML + (zz / total) * CV_W;
    const yOf = (ii: number) => CV_MT + (1 - ii / imax) * CV_H;
    const nmin = Math.min(cav.nLo, cav.nCav), nmax = cav.nHi;
    for (const b of bands) {
      const t = clamp((b.n - nmin) / (nmax - nmin + 1e-9), 0, 1);
      ctx.fillStyle = `rgba(${lin(16, 70, t)},${lin(26, 110, t)},${lin(46, 170, t)},0.6)`;
      ctx.fillRect(xOf(b.z0), CV_MT, Math.max(0.4, xOf(b.z0 + b.d) - xOf(b.z0)), CV_H);
    }
    const cs = bands[cav.pairs * 2]!; // the λ/2 cavity spacer
    ctx.fillStyle = "rgba(245,158,11,0.10)"; ctx.fillRect(xOf(cs.z0), CV_MT, xOf(cs.z0 + cs.d) - xOf(cs.z0), CV_H);
    const fieldPath = () => { ctx.beginPath(); for (let k = 0; k < z.length; k++) { const x = xOf(z[k]!), y = yOf(intensity[k]!); k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } };
    fieldPath(); ctx.lineTo(xOf(total), CV_MT + CV_H); ctx.lineTo(CV_ML, CV_MT + CV_H); ctx.closePath();
    ctx.fillStyle = "rgba(245,158,11,0.18)"; ctx.fill();
    fieldPath(); ctx.strokeStyle = AMBER; ctx.lineWidth = 1.6; ctx.stroke();
    const gapMid = cs.z0 + cs.d / 2;
    for (const dz of [-cs.d * 0.16, 0, cs.d * 0.16]) {
      const zz = gapMid + dz;
      let best = 0, bd = Infinity; for (let k = 0; k < z.length; k++) { const dd = Math.abs(z[k]! - zz); if (dd < bd) { bd = dd; best = k; } }
      ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(xOf(zz), yOf(intensity[best]!), 2.4, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(CV_ML, CV_MT, CV_W, CV_H);
    ctx.fillStyle = DIM; ctx.font = "500 10px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of niceTicks(0, total, 6)) { const x = xOf(t); seg(ctx, x, CV_MT + CV_H, x, CV_MT + CV_H + 3); ctx.fillText(`${Math.round(t)}`, x, CV_MT + CV_H + 6); }
    ctx.fillStyle = INK; ctx.font = "italic 13px 'B612', sans-serif"; ctx.textBaseline = "alphabetic";
    ctx.fillText("z  (nm)", CV_ML + CV_W / 2, CV_CH - 7);
    ctx.save(); ctx.translate(14, CV_MT + CV_H / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("|E|²", 0, 0); ctx.restore();
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    const R = cavityReflectance(cav.lambda, cav.nHi, cav.nLo, cav.pairs, cav.nCav, N0, NS);
    set("cavLam", cav.lambda.toFixed(0)); set("cavGap", cs.d.toFixed(0)); set("cavTotal", total.toFixed(0));
    set("cavR", R.toFixed(4)); set("cavF", ((Math.PI * Math.sqrt(R)) / (1 - R)).toFixed(0));
    set("cav2g", (2 * cav.g).toFixed(2));
  }

  function drawRabi() {
    const cv = rabiCanvas.current; if (!cv) return;
    const ctx = sized(cv, RB_CW, RB_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, RB_CW, RB_CH);
    const g = cav.g, w = 0.7, dmin = -6, dmax = 6;
    const lor = (u: number) => 1 / (1 + (u / w) ** 2);
    const coupled = (d: number) => lor(d - g) + lor(d + g);
    let maxc = 1e-9; for (let s = 0; s <= 240; s++) { const d = dmin + (dmax - dmin) * s / 240; maxc = Math.max(maxc, coupled(d)); }
    const xOf = (d: number) => RB_ML + ((d - dmin) / (dmax - dmin)) * RB_PW;
    const yOf = (T: number) => RB_MT + (1 - T) * RB_PH;
    ctx.font = "500 9px 'B612 Mono', monospace";
    for (const v of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, RB_ML, yOf(v), RB_ML + RB_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), RB_ML - 5, yOf(v)); }
    ctx.save(); ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,112,128,0.5)";
    seg(ctx, xOf(-g), RB_MT, xOf(-g), RB_MT + RB_PH); seg(ctx, xOf(g), RB_MT, xOf(g), RB_MT + RB_PH); ctx.restore();
    ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = COBALT; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let s = 0; s <= 240; s++) { const d = dmin + (dmax - dmin) * s / 240; const x = xOf(d), y = yOf(lor(d)); s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); ctx.restore();
    ctx.strokeStyle = "#ff7080"; ctx.lineWidth = 1.7; ctx.beginPath();
    for (let s = 0; s <= 240; s++) { const d = dmin + (dmax - dmin) * s / 240; const x = xOf(d), y = yOf(coupled(d) / maxc); s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    ctx.fillStyle = INK; ctx.font = "italic 11px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("2g", (xOf(-g) + xOf(g)) / 2, RB_MT + 3);
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(RB_ML, RB_MT, RB_PW, RB_PH);
    ctx.fillStyle = DIM; ctx.font = "500 9px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of [-4, -2, 0, 2, 4]) { const x = xOf(t); seg(ctx, x, RB_MT + RB_PH, x, RB_MT + RB_PH + 3); ctx.fillText(minus(`${t}`), x, RB_MT + RB_PH + 6); }
    ctx.fillStyle = INK; ctx.font = "italic 12px 'B612', sans-serif"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Δ / κ", RB_ML + RB_PW / 2, RB_CH - 6);
    ctx.save(); ctx.translate(11, RB_MT + RB_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("T", 0, 0); ctx.restore();
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

  const DARKC = "#b08cf0"; // dark-manifold colour (distinct from photon-cobalt / bright-amber)

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
    ctx.font = "500 8.5px 'B612 Mono', monospace";
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, xOf(f), HP_MT, xOf(f), HP_MT + HP_PH);
      ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(f.toFixed(2), xOf(f), HP_MT + HP_PH + 5);
    }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let t = 0; t <= 4; t++) { const e = elo + (ehi - elo) * t / 4, y = yOf(e); ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, HP_ML, y, HP_ML + HP_PW, y); ctx.fillStyle = DIM; ctx.fillText(fmt(e, 3), HP_ML - 7, y); }
    const yA = yOf(WA); // bare emitter line
    ctx.strokeStyle = "rgba(148,163,184,0.4)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 0.75; seg(ctx, HP_ML, yA, HP_ML + HP_PW, yA); ctx.setLineDash([]);
    ctx.fillStyle = DIM; ctx.font = "italic 9px 'B612', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText("ω_a", HP_ML + 3, yA - 2);
    const marks: { x: number; y: number; k: number }[] = [], inspK = inspectRef.current;
    for (let k = 0; k < n; k++) {
      const phot = vecs[k]! * vecs[k]!, occ = c[k]! * c[k]!, x = xOf(phot), y = yOf(eigs[k]!), rad = 2.6 + 5.5 * Math.sqrt(Math.min(1, occ));
      marks.push({ x, y, k });
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI);
      ctx.fillStyle = lerpHex(DARKC, COBALT, Math.min(1, phot * 2)); ctx.globalAlpha = 0.45 + 0.55 * Math.sqrt(Math.min(1, occ)); ctx.fill(); ctx.globalAlpha = 1;
      if (k === inspK) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, rad + 3.5, 0, 2 * Math.PI); ctx.stroke(); }
    }
    hopMarks.current = marks;
    ctx.fillStyle = INK; ctx.font = "600 9px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("LP", xOf(vecs[0]! * vecs[0]!), yOf(eigs[0]!) - 8);
    ctx.fillText("UP", xOf(vecs[n - 1]! * vecs[n - 1]!), yOf(eigs[n - 1]!) - 8);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(HP_ML, HP_MT, HP_PW, HP_PH);
    ctx.fillStyle = DIM; ctx.font = "italic 11px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("photon fraction  |⟨a|ψ_k⟩|²", HP_ML + HP_PW / 2, HP_MT + HP_PH + 16);
    ctx.save(); ctx.translate(15, HP_MT + HP_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("energy  E_k / ω_c", 0, 0); ctx.restore();
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
    const lo = ds.eigs[0]!, hi = ds.eigs[ds.n - 1]!, span = hi - lo, wlo = lo - span * 0.6 - 0.03, whi = hi + span * 0.6 + 0.03;
    const xOf = (w: number) => FF_ML + (w - wlo) / (whi - wlo) * FF_PW, yOf = (p: number) => FF_MT + (1 - p) * FF_PH;
    ctx.font = "500 8.5px 'B612 Mono', monospace";
    for (const p of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, FF_ML, yOf(p), FF_ML + FF_PW, yOf(p)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(p.toFixed(1), FF_ML - 6, yOf(p)); }
    for (const e of [lo, hi]) { const x = xOf(e); ctx.strokeStyle = "rgba(245,158,11,0.45)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 0.75; seg(ctx, x, FF_MT, x, FF_MT + FF_PH); ctx.setLineDash([]); }
    const om = fd.omega, pw = fd.power;
    const path = (close: boolean) => { ctx.beginPath(); let st = false; for (let i = 0; i < om.length; i++) { const w = om[i]!; if (w < wlo) continue; if (w > whi) break; const x = xOf(w), y = yOf(pw[i]!); if (!st) { if (close) { ctx.moveTo(x, yOf(0)); ctx.lineTo(x, y); } else ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y); } if (close && st) { ctx.lineTo(xOf(whi), yOf(0)); ctx.closePath(); } };
    path(true); ctx.fillStyle = "rgba(59,130,246,0.16)"; ctx.fill();
    path(false); ctx.strokeStyle = COBALT; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = DIM; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const w of [wlo, (wlo + whi) / 2, whi]) ctx.fillText(fmt(w, 2), xOf(w), FF_MT + FF_PH + 5);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(FF_ML, FF_MT, FF_PW, FF_PH);
    ctx.fillStyle = DIM; ctx.font = "italic 11px 'B612', sans-serif"; ctx.fillText("frequency  ω / ω_c", FF_ML + FF_PW / 2, FF_CH - 7);
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
    ctx.font = "500 9px 'B612 Mono', monospace";
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
    ctx.fillStyle = AMBER; ctx.font = "600 9px 'B612 Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("g = " + fmt(dynGRef.current, 3), gx, SW_MT - 3);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(SW_ML, SW_MT, SW_PW, SW_PH);
    ctx.fillStyle = INK; ctx.font = "italic 12px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("coupling  g_0 / ω_c", SW_ML + SW_PW / 2, SW_MT + SW_PH + 18);
    ctx.save(); ctx.translate(16, SW_MT + SW_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("energy  E / ω_c", 0, 0); ctx.restore();
    ctx.font = "600 10px 'B612 Mono', monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
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
    ctx.font = "500 9px 'B612 Mono', monospace";
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
    ctx.fillStyle = AMBER; ctx.font = "italic 9px 'B612', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("0–0", x00 + 3, HT_MT + 2);
    ctx.strokeStyle = AXIS; ctx.lineWidth = 0.75; ctx.strokeRect(HT_ML, HT_MT, HT_PW, HT_PH);
    ctx.fillStyle = INK; ctx.font = "italic 12px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("frequency  ω / ω_c", HT_ML + HT_PW / 2, HT_MT + HT_PH + 18);
    ctx.save(); ctx.translate(15, HT_MT + HT_PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("absorption  A(ω)", 0, 0); ctx.restore();
  }

  function updateHtcReadouts() {
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    const Er = htc.S * htc.wv;
    set("htS", htc.S.toFixed(3)); set("htEr", Math.round(toMeV(Er)).toString());
    set("htSbright", (htc.S / htc.N).toFixed(3)); set("htRabi", Math.round(toMeV(2 * htc.g * Math.sqrt(htc.N))).toString());
    set("htNvib", String(htcData.current?.nVib ?? 0));
  }

  // P1 · the headline: photon ↔ bright vacuum-Rabi oscillation (Ω_R = 2g√M) with the dark band that
  // stays flat at σ=0 and grows as disorder leaks population out of the bright mode. hist = [ph,br,dk].
  function drawPopTraces() {
    const cvEl = popCanvas.current, ds = dynState.current; if (!cvEl || !ds) return;
    const ctx = sized(cvEl, PP_CW, PP_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, PP_CW, PP_CH);
    const yOf = (v: number) => PP_MT + (1 - v) * PP_PH;
    ctx.font = "500 9px 'B612 Mono', monospace";
    for (const v of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, PP_ML, yOf(v), PP_ML + PP_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), PP_ML - 6, yOf(v)); }
    const H = ds.hist, cw = PP_PW / HEAT_COLS;
    const trace = (idx: number, color: string, fill: boolean) => {
      ctx.beginPath();
      H.forEach((p, col) => { const x = PP_ML + col * cw, y = yOf(Math.min(1, p[idx]!)); col === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      if (fill && H.length) { ctx.lineTo(PP_ML + (H.length - 1) * cw, yOf(0)); ctx.lineTo(PP_ML, yOf(0)); ctx.closePath(); ctx.fillStyle = color + "22"; ctx.fill(); ctx.beginPath(); H.forEach((p, col) => { const x = PP_ML + col * cw, y = yOf(Math.min(1, p[idx]!)); col === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); }
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
    };
    trace(2, DARKC, true);  // dark manifold (filled — the leakage you watch grow)
    trace(0, COBALT, false); // photon
    trace(1, AMBER, false);  // bright collective mode
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(PP_ML, PP_MT, PP_PW, PP_PH);
    ctx.fillStyle = INK; ctx.font = "italic 11px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("time   t Ω_R / 2π   (Rabi cycles)", PP_ML + PP_PW / 2, PP_CH - 8);
    ctx.save(); ctx.translate(13, PP_MT + PP_PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("population", 0, 0); ctx.restore();
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

  function exportHamiltonian() {
    const gi = Float64Array.from(ensemble.factors, (f) => f * dyn.g);
    const { h, n } = arrowheadMatrixGi(WA, WA, dyn.sigma, dyn.seed, gi);
    downloadNpy(`H_cavityQED_N${dyn.m}.npy`, h, [n, n]); // np.load(...) → (N+1)×(N+1) Hamiltonian in units of ω_c
  }

  const Hud = (
    <div className="pane hud">
      <div className="pane-head">Validation · QuTiP / numpy golden</div>
      <table className="metrics"><tbody>
        <Row label={<>operators</>} v="1e−16" /><Row label={<>mesolve ⟨·⟩</>} v="7e−9" />
        <Row label={<>Wigner</>} v="2e−16" /><Row label={<>arrowhead</>} v="1e−10" />
      </tbody></table>
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
        <span className="status"><span className="live">●</span> {ready ? "WASM CORE LIVE" : "LOADING…"} · VALIDATED vs QuTiP 5.3 / NUMPY</span>
      </div>

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
                <NumField sym="atol" value={tol.atol} onChange={(atol) => setTol((s) => ({ ...s, atol: clamp(atol, 1e-12, 1e-2) }))} />
                <NumField sym="rtol" value={tol.rtol} onChange={(rtol) => setTol((s) => ({ ...s, rtol: clamp(rtol, 1e-12, 1e-2) }))} />
                <div className="btn-row">
                  <button onClick={() => setPlaying((p) => !p)}>{playing ? "PAUSE" : "PLAY"}</button>
                  <button onClick={() => { quantum.current?.reset(); series.current = []; }}>RE-EXCITE</button>
                  <button className={fixedScale ? "on" : ""} onClick={() => setFixedScale((s) => !s)}>{fixedScale ? "1/π" : "AUTO"}</button>
                </div>
              </Group>
            </>
          ) : regime === "collective" ? (
            <Group title="EMITTER ENSEMBLE" k="ens" c={collapsed} t={toggle}>
              <Field sym="M" label="emitters" value={sp.m} min={1} max={80} step={1} unit="" int onChange={(m) => setSp((s) => ({ ...s, m: Math.round(m) }))} />
              <Field sym="g" label="coupling" value={sp.g} min={0.01} max={0.15} step={0.005} unit="ω_a" onChange={(g) => setSp((s) => ({ ...s, g }))} />
              <Field sym="σ" label="disorder" value={sp.sigma} min={0} max={0.2} step={0.005} unit="ω_a" onChange={(sigma) => setSp((s) => ({ ...s, sigma }))} />
              <div className="btn-row"><button onClick={() => setSp((s) => ({ ...s, seed: s.seed + 1 }))}>RE-ROLL σ</button></div>
            </Group>
          ) : regime === "cavity" ? (
            <Group title="CAVITY HARDWARE" k="cavh" c={collapsed} t={toggle}>
              <Field sym="λ" label="design wavelength" value={cav.lambda} min={400} max={800} step={5} unit="nm" onChange={(lambda) => setCav((s) => ({ ...s, lambda }))} />
              <Field sym="n_H" label="DBR high index" value={cav.nHi} min={1.6} max={3.0} step={0.05} unit="" onChange={(nHi) => setCav((s) => ({ ...s, nHi }))} />
              <Field sym="n_L" label="DBR low index" value={cav.nLo} min={1.3} max={2.0} step={0.02} unit="" onChange={(nLo) => setCav((s) => ({ ...s, nLo }))} />
              <Field sym="N" label="mirror pairs" value={cav.pairs} min={2} max={16} step={1} unit="" int onChange={(pairs) => setCav((s) => ({ ...s, pairs: Math.round(pairs) }))} />
              <Field sym="n_c" label="cavity index" value={cav.nCav} min={1.3} max={2.5} step={0.05} unit="" onChange={(nCav) => setCav((s) => ({ ...s, nCav }))} />
              <Field sym="g" label="atom–cavity coupling" value={cav.g} min={0} max={5} step={0.1} unit="κ" onChange={(g) => setCav((s) => ({ ...s, g }))} />
            </Group>
          ) : regime === "dynamics" ? (
            <Group title="MOLECULAR ENSEMBLE" k="dyn" c={collapsed} t={toggle}>
              <Field sym="N" texSym="N" label="Ensemble size" value={dyn.m} min={2} max={40} step={1} unit="" int onChange={(m) => setDyn((s) => ({ ...s, m: Math.round(m) }))} />
              <Field sym="g" texSym="g_0/\omega_c" label="Bare coupling" value={dyn.g} min={0.01} max={0.2} step={0.005} unit="" onChange={(g) => setDyn((s) => ({ ...s, g }))} />
              <Field sym="σ" texSym="\sigma_\omega/\omega_c" label="Inhomog. linewidth" value={dyn.sigma} min={0} max={0.25} step={0.005} unit="" onChange={(sigma) => setDyn((s) => ({ ...s, sigma }))} />
              <Field sym="ω" texSym="\hbar\omega_c" label="Cavity energy" value={wcEv} min={0.5} max={4} step={0.05} unit="eV" onChange={setWcEv} />
              <Field sym="η" texSym="\eta" label="Orientational order" value={dyn.order} min={0} max={1} step={0.02} unit="" onChange={(order) => setDyn((s) => ({ ...s, order }))} />
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
              <Field sym="ω" texSym="\omega_v/\omega_c" label="Vibrational mode" value={htc.wv} min={0.04} max={0.4} step={0.005} unit="" onChange={(wv) => setHtc((s) => ({ ...s, wv }))} />
              <Field sym="S" texSym="S=\lambda^2" label="Huang-Rhys factor" value={htc.S} min={0} max={3} step={0.05} unit="" onChange={(S) => setHtc((s) => ({ ...s, S }))} />
              <Field sym="g" texSym="g/\omega_c" label="Cavity coupling" value={htc.g} min={0} max={0.25} step={0.005} unit="" onChange={(g) => setHtc((s) => ({ ...s, g }))} />
              <Field sym="N" texSym="N" label="Ensemble size" value={htc.N} min={1} max={400} step={1} unit="" int onChange={(N) => setHtc((s) => ({ ...s, N: Math.round(N) }))} />
              <Field sym="γ" texSym="\gamma/\omega_c" label="Linewidth (FWHM)" value={htc.gamma} min={0.004} max={0.04} step={0.002} unit="" onChange={(gamma) => setHtc((s) => ({ ...s, gamma }))} />
              <div className="btn-row">
                <button className={htc.N <= 1 ? "on" : ""} onClick={() => setHtc((s) => ({ ...s, N: 1 }))}>N = 1</button>
                <button className={htc.N >= 100 ? "on" : ""} onClick={() => setHtc((s) => ({ ...s, N: 200 }))}>N = 200 · decouple</button>
              </div>
            </Group>
          )}
        </aside>

        {/* CENTER */}
        <main className="center">
          {regime === "single" ? (
            <>
              <div className="pane">
                <div className="pane-head">Panel C · observables ⟨a†a⟩ <i style={{ color: COBALT }}>—</i> ⟨P_e⟩ <i style={{ color: CRIMSON }}>—</i> purity <i style={{ color: EMERALD }}>—</i></div>
                <canvas ref={seriesCanvas} className="cv" />
              </div>
              <div className="pane grow">
                <div className="pane-head">Panel B · phase space — Wigner <em>W</em> (signed · red = negativity) | Husimi <em>Q</em> (≥ 0)</div>
                <div className="phase-row">
                  <canvas ref={wigCanvas} className="cv" />
                  <canvas ref={husimiCanvas} className="cv" />
                </div>
              </div>
            </>
          ) : regime === "collective" ? (
            <>
              <div className="pane grow">
                <div className="pane-head">Panel D · polariton spectrum (M = {sp.m}) · click an eigenstate</div>
                <canvas ref={specCanvas} className="cv click" onClick={onSpecClick} />
              </div>
              <div className="pane">
                <div className="pane-head">Panel D · Wigner of selected eigenstate</div>
                <div className="bridge">
                  <canvas ref={bridgeCanvas} className="cv" />
                  <table className="metrics"><tbody>
                    <Row label={<>state</>} k="selKind" r={read} />
                    <Row label={<><i>E</i></>} k="selE" r={read} unit="ω_a" />
                    <Row label={<>|<i>C</i>|²</>} k="selC" r={read} />
                    <Row label={<>|<i>X</i>|²</>} k="selX" r={read} />
                    <Row label={<><i>W</i>(0,0)</>} k="selW0" r={read} unit="1/π" />
                  </tbody></table>
                </div>
              </div>
            </>
          ) : regime === "cavity" ? (
            <>
              <div className="pane grow">
                <div className="pane-head">Panel F · Fabry–Pérot cavity-QED schematic · drag to orbit · field brightens with g</div>
                <div className="cavity3d"><Suspense fallback={<div className="cv-loading">loading 3D…</div>}><CavityScene g={cav.g} /></Suspense></div>
              </div>
              <div className="pane">
                <div className="pane-head">Panel E · |E(z)|² standing wave over the DBR stack (true nm scale)</div>
                <canvas ref={cavCanvas} className="cv" />
                <div className="legend">
                  <span className="leg leg-band">mirror layers</span>
                  <span className="leg leg-field">|E(z)|² mode</span>
                  <span className="leg leg-mol">emitters in gap</span>
                </div>
              </div>
            </>
          ) : regime === "vibronic" ? (
            <div className="pane grow">
              <div className="pane-head">Holstein-TC absorption · bare molecule <i style={{ color: "#94a3b8", fontStyle: "normal" }}>━</i> in-cavity / collective <i style={{ color: COBALT, fontStyle: "normal" }}>━</i> · vibronic sidebands at nω<sub>v</sub>; N→∞ collapses the bright sidebands (polaron decoupling)</div>
              <canvas ref={htcCanvas} className="cv" />
            </div>
          ) : dynSweep ? (
            <div className="pane grow">
              <div className="pane-head">Coupling sweep · polariton dispersion E(g) · {SWEEP_STEPS} diagonalizations · bright split as 2g√M, dark flat at ω_a · amber = live g</div>
              <canvas ref={sweepCanvas} className="cv" />
            </div>
          ) : (
            <div className="dyn-bento">
              <div className="pane bento-3d">
                <div className="pane-head">Live cavity · {dyn.m} naphthalene emitters + 1 photon{inspect != null ? <> · <i style={{ color: "#fff", fontStyle: "normal" }}>inspecting eigenstate #{inspect}</i></> : <> · matter amber · field cobalt · dipoles <i style={{ color: "#4fcabe", fontStyle: "normal" }}>μ</i></>}</div>
                <div className="live3d"><Suspense fallback={<div className="cv-loading">loading 3D…</div>}><LiveCavityScene stateRef={dynState} tRef={simT} m={dyn.m} inspectRef={inspectRef} ensemble={ensemble} waist={MODE_WAIST} /></Suspense></div>
              </div>
              <div className="pane">
                <div className="pane-head">Populations — photon <i style={{ color: COBALT, fontStyle: "normal" }}>━</i> bright <i style={{ color: AMBER, fontStyle: "normal" }}>━</i> dark <i style={{ color: DARKC, fontStyle: "normal" }}>━</i></div>
                <canvas ref={popCanvas} className="cv" />
              </div>
              <div className="pane">
                <div className="pane-head">Dressed states · E<sub>k</sub> vs photon fraction · {inspect != null ? <span style={{ color: "#fff" }}>▸ #{inspect} on 3D · click to release</span> : <span>click a state to project onto molecules</span>}</div>
                <canvas ref={hopCanvas} className="cv click" onClick={onHopClick} />
              </div>
              <div className="pane">
                <div className="pane-head">Transmission S(ω) · FFT of the photon field · vacuum-Rabi doublet</div>
                <canvas ref={fftCanvas} className="cv" />
              </div>
            </div>
          )}
        </main>

        {/* RIGHT — diagnostic dock */}
        <aside className="dock">
          {regime === "single" ? (
            <>
              <div className="pane">
                <div className="pane-head">Panel A · |ρ| joint density matrix · coherences pulse + decay</div>
                <canvas ref={rhoCanvas} className="cv" />
              </div>
              <div className="pane">
                <div className="pane-head">Observables</div>
                <table className="metrics"><tbody>
                  <Row label={<>time <i>t</i></>} k="t" r={read} unit="ω_c⁻¹" />
                  <Row label={<>⟨<i>a</i>†<i>a</i>⟩</>} k="n" r={read} />
                  <Row label={<>⟨<i>P</i>ₑ⟩</>} k="pe" r={read} />
                  <Row label={<>purity Tr<i>ρ</i>²</>} k="pur" r={read} />
                  <Row label={<>entropy <i>S</i></>} k="ent" r={read} />
                  <Row label={<><i>g</i>²/<i>κγ</i></>} k="coop" r={read} />
                  <Row label={<>Tr <i>ρ</i></>} k="tr" r={read} />
                  <Row label={<>min eig</>} k="eig" r={read} />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : regime === "collective" ? (
            <>
              <div className="pane">
                <div className="pane-head">Spectrum at resonance</div>
                <table className="metrics"><tbody>
                  <Row label={<>Ω<sub>R</sub></>} k="rabi" r={read} unit="ω_a" />
                  <Row label={<>2<i>g</i>√<i>M</i></>} k="rabiT" r={read} unit="ω_a" />
                  <Row label={<>dark states</>} k="ndark" r={read} />
                  <Row label={<><i>σ</i>/Ω<sub>R</sub></>} k="ratio" r={read} />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : regime === "cavity" ? (
            <>
              <div className="pane">
                <div className="pane-head">Vacuum-Rabi spectrum · peaks split by 2g</div>
                <canvas ref={rabiCanvas} className="cv" />
                <div className="legend"><span className="leg leg-pol">2 polaritons (coupled)</span><span className="leg leg-dash">bare cavity</span></div>
              </div>
              <div className="pane">
                <div className="pane-head">Cavity</div>
                <table className="metrics"><tbody>
                  <Row label={<>resonance <i>λ</i></>} k="cavLam" r={read} unit="nm" />
                  <Row label={<>cavity gap</>} k="cavGap" r={read} unit="nm" />
                  <Row label={<>stack length</>} k="cavTotal" r={read} unit="nm" />
                  <Row label={<>reflectance <i>R</i></>} k="cavR" r={read} />
                  <Row label={<>finesse <i>F</i></>} k="cavF" r={read} />
                  <Row label={<>Rabi split 2<i>g</i></>} k="cav2g" r={read} unit="κ" />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : regime === "dynamics" ? (
            <>
              <div className="pane">
                <div className="pane-head">Live observables</div>
                <table className="metrics"><tbody>
                  <Row label={<Tex t="\tau = \Omega_R t/2\pi" />} k="simTau" r={read} unit="cyc" />
                  <Row label={<Tex t="t" />} k="simTfs" r={read} unit="fs" />
                  <Row label={<Tex t="P_{\mathrm{photon}}" />} k="simPh" r={read} />
                  <Row label={<Tex t="P_{\mathrm{bright}}" />} k="simBr" r={read} />
                  <Row label={<Tex t="P_{\mathrm{dark}}" />} k="simDk" r={read} />
                  <Row label={<Tex t="\Omega_R" />} k="simRabi" r={read} unit="ω_c" />
                  <Row label={<Tex t="\Omega_R" />} k="simRabiMeV" r={read} unit="meV" />
                  <Row label={<Tex t="\textstyle\sum_k P_k" />} k="simNorm" r={read} />
                </tbody></table>
              </div>
              {Hud}
            </>
          ) : (
            <>
              <div className="pane">
                <div className="pane-head">Vibronic observables</div>
                <table className="metrics"><tbody>
                  <Row label={<Tex t="S\;(\text{Huang-Rhys})" />} k="htS" r={read} />
                  <Row label={<Tex t="E_r = S\omega_v" />} k="htEr" r={read} unit="meV" />
                  <Row label={<Tex t="S_{\mathrm{bright}} = S/N" />} k="htSbright" r={read} />
                  <Row label={<Tex t="\Omega_R = 2g\sqrt{N}" />} k="htRabi" r={read} unit="meV" />
                  <Row label={<Tex t="n_{\mathrm{vib}}" />} k="htNvib" r={read} />
                </tbody></table>
              </div>
              {Hud}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function mkCanvas(n: number): HTMLCanvasElement { const c = document.createElement("canvas"); c.width = n; c.height = n; return c; }
function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
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
function Row({ label, k, r, unit, v }: { label: React.ReactNode; k?: string; r?: React.MutableRefObject<Record<string, HTMLSpanElement | null>>; unit?: string; v?: string }) {
  return (<tr><td className="k">{label}</td><td className="v">{k && r ? <span ref={(el) => { r.current[k] = el; }}>—</span> : v}{unit ? <span className="u"> {unit}</span> : null}</td></tr>);
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
function Field(props: { sym: string; texSym?: string; label: string; value: number; min: number; max: number; step: number; unit: string; int?: boolean; onChange: (v: number) => void }) {
  const show = props.int ? `${Math.round(props.value)}` : `${props.value}`;
  return (
    <div className="knob">
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
function NumField(props: { sym: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="knob num-only">
      <span className="knob-name"><i>{props.sym}</i></span>
      <input className="knob-input wide" type="number" step={1e-7} value={props.value}
        onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && e.target.value !== "") props.onChange(v); }} />
    </div>
  );
}
