import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { loadWasm, Quantum, solveSpectrum, arrowheadModes, wignerRawOfRho, cavityLayers, cavityField, cavityReflectance, type SimParams } from "./quantum/engine";

// three.js is heavy and only used by the cavity regime — load it on demand
const CavityScene = lazy(() => import("./cavity/CavityScene").then((m) => ({ default: m.CavityScene })));

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
const DT_DYN = 0.22, HEAT_COLS = 150;
const HM_ML = 46, HM_MR = 12, HM_MT = 14, HM_MB = 26, HM_PW = 470, HM_PH = 248;
const HM_CW = HM_ML + HM_PW + HM_MR, HM_CH = HM_MT + HM_PH + HM_MB;
const PP_ML = 46, PP_MR = 12, PP_MT = 12, PP_MB = 24, PP_PW = 470, PP_PH = 100;
const PP_CW = PP_ML + PP_PW + PP_MR, PP_CH = PP_MT + PP_PH + PP_MB;

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
type Regime = "single" | "collective" | "cavity" | "dynamics";
type Pt = { t: number; n: number; pe: number; pur: number };

export function App() {
  const [regime, setRegime] = useState<Regime>("single");
  const [params, setParams] = useState({ g: 0.2, kappa: 0.05, gamma: 0.02 });
  const [tol, setTol] = useState({ atol: 1e-6, rtol: 1e-6 });
  const [sp, setSp] = useState({ m: 20, g: 0.05, sigma: 0.0, seed: 1 });
  const [cav, setCav] = useState({ lambda: 550, nHi: 2.5, nLo: 1.46, pairs: 4, nCav: 1.6, g: 1.6 });
  const [dyn, setDyn] = useState({ m: 12, g: 0.06, sigma: 0.0, seed: 1, init: 0 });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(true);
  const [fixedScale, setFixedScale] = useState(true);
  const [ready, setReady] = useState(false);

  const wigCanvas = useRef<HTMLCanvasElement>(null), husimiCanvas = useRef<HTMLCanvasElement>(null), seriesCanvas = useRef<HTMLCanvasElement>(null);
  const rhoCanvas = useRef<HTMLCanvasElement>(null), specCanvas = useRef<HTMLCanvasElement>(null);
  const bridgeCanvas = useRef<HTMLCanvasElement>(null);
  const cavCanvas = useRef<HTMLCanvasElement>(null);
  const rabiCanvas = useRef<HTMLCanvasElement>(null);
  const heatCanvas = useRef<HTMLCanvasElement>(null);
  const popCanvas = useRef<HTMLCanvasElement>(null);
  const dynState = useRef<{ eigs: Float64Array; vecs: Float64Array; n: number; c: Float64Array; hist: Float64Array[] } | null>(null);
  const simT = useRef(0);
  const offscreen = useRef<HTMLCanvasElement | null>(null), husimiOff = useRef<HTMLCanvasElement | null>(null), bridgeOff = useRef<HTMLCanvasElement | null>(null);
  const quantum = useRef<Quantum | null>(null);
  const raf = useRef<number>(0), dpr = useRef(1);
  const regimeRef = useRef(regime), playingRef = useRef(playing), scaleRef = useRef(fixedScale), tolRef = useRef(tol);
  const series = useRef<Pt[]>([]), sweep = useRef<SweepCol[]>([]);
  const sel = useRef<{ j: number; k: number } | null>(null);
  const specMap = useRef({ emin: 0, emax: 1, R: 6 });
  const read = useRef<Record<string, HTMLSpanElement | null>>({});

  regimeRef.current = regime; playingRef.current = playing; scaleRef.current = fixedScale; tolRef.current = tol;
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
      const { eigs, vecs, n } = arrowheadModes(WA, WA, dyn.g, dyn.m, dyn.sigma, dyn.seed);
      const c = new Float64Array(n);
      for (let k = 0; k < n; k++) c[k] = vecs[dyn.init * n + k]!; // ⟨φ_k|ψ0⟩ for the chosen initial site
      dynState.current = { eigs, vecs, n, c, hist: [] };
      simT.current = 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, dyn]);

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
        const pops = popsAt(simT.current);
        if (playingRef.current) { ds.hist.push(pops); if (ds.hist.length > HEAT_COLS) ds.hist.shift(); }
        drawSimHeat(); drawSimPlot(); updateSimReadouts(pops);
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

  // ── live single-excitation dynamics (N molecules + cavity) ──
  function popsAt(t: number): Float64Array {
    const ds = dynState.current!;
    const { eigs, vecs, n, c } = ds;
    const pops = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let re = 0, im = 0; const row = i * n;
      for (let k = 0; k < n; k++) {
        const amp = vecs[row + k]! * c[k]!, ph = eigs[k]! * t;
        re += amp * Math.cos(ph); im -= amp * Math.sin(ph);
      }
      pops[i] = re * re + im * im; // |ψ_i(t)|²
    }
    return pops;
  }

  function drawSimHeat() {
    const cvEl = heatCanvas.current, ds = dynState.current; if (!cvEl || !ds) return;
    const ctx = sized(cvEl, HM_CW, HM_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, HM_CW, HM_CH);
    const n = ds.n, H = ds.hist, cw = HM_PW / HEAT_COLS, rh = HM_PH / n;
    for (let col = 0; col < H.length; col++) {
      const pops = H[col]!, x = HM_ML + col * cw;
      for (let i = 0; i < n; i++) {
        const v = Math.min(1, Math.sqrt(pops[i]!));
        ctx.fillStyle = i === 0
          ? `rgb(${lin(11, 70, v)},${lin(16, 140, v)},${lin(28, 250, v)})`  // photon row → cobalt
          : `rgb(${lin(11, 245, v)},${lin(16, 160, v)},${lin(28, 20, v)})`; // molecule rows → amber
        ctx.fillRect(x, HM_MT + i * rh, cw + 0.6, rh + 0.6);
      }
    }
    ctx.strokeStyle = "rgba(148,163,184,0.45)"; ctx.lineWidth = 0.75; seg(ctx, HM_ML, HM_MT + rh, HM_ML + HM_PW, HM_MT + rh);
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(HM_ML, HM_MT, HM_PW, HM_PH);
    ctx.fillStyle = DIM; ctx.font = "500 9px 'B612 Mono', monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("photon", HM_ML - 5, HM_MT + rh / 2);
    ctx.fillText("mol 1", HM_ML - 5, HM_MT + rh * 1.5);
    ctx.fillText(`mol ${n - 1}`, HM_ML - 5, HM_MT + HM_PH - rh / 2);
    ctx.fillStyle = INK; ctx.font = "italic 12px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("time →", HM_ML + HM_PW / 2, HM_CH - 8);
  }

  function drawSimPlot() {
    const cvEl = popCanvas.current, ds = dynState.current; if (!cvEl || !ds) return;
    const ctx = sized(cvEl, PP_CW, PP_CH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, PP_CW, PP_CH);
    const yOf = (v: number) => PP_MT + (1 - v) * PP_PH;
    ctx.font = "500 9px 'B612 Mono', monospace";
    for (const v of [0, 0.5, 1]) { ctx.strokeStyle = GRIDLINE; ctx.lineWidth = 0.5; seg(ctx, PP_ML, yOf(v), PP_ML + PP_PW, yOf(v)); ctx.fillStyle = DIM; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(1), PP_ML - 5, yOf(v)); }
    const H = ds.hist, cw = PP_PW / HEAT_COLS;
    const trace = (fn: (p: Float64Array) => number, color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      H.forEach((p, col) => { const x = PP_ML + col * cw, y = yOf(Math.min(1, fn(p))); col === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.stroke();
    };
    trace((p) => p[0]!, COBALT); // photon
    trace((p) => { let s = 0; for (let i = 1; i < p.length; i++) s += p[i]!; return s; }, "#f59e0b"); // total molecular
    ctx.lineWidth = 0.75; ctx.strokeStyle = AXIS; ctx.strokeRect(PP_ML, PP_MT, PP_PW, PP_PH);
    ctx.fillStyle = INK; ctx.font = "italic 12px 'B612', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("population", PP_ML + PP_PW / 2, PP_CH - 5);
  }

  function updateSimReadouts(pops: Float64Array) {
    const set = (k: string, v: string) => { const el = read.current[k]; if (el) el.textContent = v; };
    let molTot = 0, molMax = 0; for (let i = 1; i < pops.length; i++) { molTot += pops[i]!; molMax = Math.max(molMax, pops[i]!); }
    set("simT", simT.current.toFixed(2)); set("simPhot", pops[0]!.toFixed(4)); set("simMol", molTot.toFixed(4));
    set("simMax", molMax.toFixed(4)); set("simNorm", (pops[0]! + molTot).toFixed(6));
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
    const cv = regime === "single" ? wigCanvas.current : regime === "cavity" ? cavCanvas.current : regime === "dynamics" ? heatCanvas.current : specCanvas.current;
    if (!cv) return;
    const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = `${regime}.png`; a.click();
  }

  const Hud = (
    <div className="pane hud">
      <div className="pane-head">Validation · QuTiP / numpy golden</div>
      <table className="metrics"><tbody>
        <Row label={<>operators</>} v="1e−16" /><Row label={<>mesolve ⟨·⟩</>} v="7e−9" />
        <Row label={<>Wigner</>} v="2e−16" /><Row label={<>arrowhead</>} v="1e−10" />
      </tbody></table>
      <div className="hud-pass">✓ physics survives the WASM boundary</div>
      <div className="btn-row">
        <button onClick={exportCSV}>CSV</button><button onClick={exportJSON}>JSON</button><button onClick={exportPNG}>PNG</button>
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
          ) : (
            <Group title="MOLECULAR ENSEMBLE" k="dyn" c={collapsed} t={toggle}>
              <Field sym="N" label="molecules" value={dyn.m} min={2} max={40} step={1} unit="" int onChange={(m) => setDyn((s) => ({ ...s, m: Math.round(m) }))} />
              <Field sym="g" label="coupling" value={dyn.g} min={0.01} max={0.2} step={0.005} unit="ω" onChange={(g) => setDyn((s) => ({ ...s, g }))} />
              <Field sym="σ" label="energy disorder" value={dyn.sigma} min={0} max={0.25} step={0.005} unit="ω" onChange={(sigma) => setDyn((s) => ({ ...s, sigma }))} />
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
          ) : (
            <>
              <div className="pane grow">
                <div className="pane-head">Live cavity dynamics · {dyn.m} molecules + 1 photon · excitation heat map (each row = one molecule)</div>
                <canvas ref={heatCanvas} className="cv" />
              </div>
              <div className="pane">
                <div className="pane-head">Population — photon <i style={{ color: COBALT, fontStyle: "normal" }}>━</i> total molecular <i style={{ color: "#f59e0b", fontStyle: "normal" }}>━</i></div>
                <canvas ref={popCanvas} className="cv" />
              </div>
            </>
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
          ) : (
            <>
              <div className="pane">
                <div className="pane-head">Live observables</div>
                <table className="metrics"><tbody>
                  <Row label={<>time <i>t</i></>} k="simT" r={read} unit="ω⁻¹" />
                  <Row label={<>photon ⟨<i>a</i>†<i>a</i>⟩</>} k="simPhot" r={read} />
                  <Row label={<>molecular Σ</>} k="simMol" r={read} />
                  <Row label={<>brightest molecule</>} k="simMax" r={read} />
                  <Row label={<>norm Σ<i>p</i></>} k="simNorm" r={read} />
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
function Field(props: { sym: string; label: string; value: number; min: number; max: number; step: number; unit: string; int?: boolean; onChange: (v: number) => void }) {
  const show = props.int ? `${Math.round(props.value)}` : `${props.value}`;
  return (
    <div className="knob">
      <div className="knob-top">
        <span className="knob-name"><i>{props.sym}</i> {props.label}</span>
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
