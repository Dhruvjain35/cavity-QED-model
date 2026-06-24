// Polariton FORMATION — the avoided crossing, made interactive. The cavity photon and the (bright)
// molecular excitation are two coupled modes: H = [[ω_c, G], [G, ω_a]] with G = g√N. Turning up the
// coupling makes the two bare levels REPEL and split into the lower/upper polaritons (LP/UP); each
// branch is a light–matter blend whose composition (Hopfield |⟨a|±⟩|²) is drawn in colour. At zero
// detuning each polariton is exactly 50/50 — the hybrid. This is the same 2×2 bright-mode physics the
// validated (N+1)×(N+1) arrowhead reduces to, so it agrees with the rest of the simulator.
import { useEffect, useMemo, useRef, useState } from "react";

const CY = "#00ffff", RD = "#ff3a3a", INKC = "#ffffff", DIMC = "#8b949e", AXISC = "#5a626c", GRID = "#1b2026", PANELC = "#0a0d12", AMBER = "#ffcc00";
const F = "'IBM Plex Sans',system-ui,sans-serif";
const dpr = () => Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);

// photon fraction 0 (matter, red) → 1 (photon, cyan)
function mix(t: number) {
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(0xff * (1 - u) + 0x00 * u), g = Math.round(0x3a * (1 - u) + 0xff * u), b = Math.round(0x3a * (1 - u) + 0xff * u);
  return `rgb(${r},${g},${b})`;
}

// Two polariton branches of H=[[ω_c,G],[G,ω_a]] with ω_a=1, ω_c=1+Δ; photon fraction of each (Hopfield).
function polariton(delta: number, G: number) {
  // a tiny floor on G keeps the G→0 limit well-defined: branches still trace the crossing bare modes
  // (pure photon / pure matter off resonance), and the otherwise-0/0 composition at exact degeneracy
  // resolves to the honest 50/50 — never a misleading "100% light for both".
  const Gs = Math.max(G, 1e-6);
  const wc = 1 + delta, wa = 1, half = (wc + wa) / 2, rad = 0.5 * Math.sqrt(delta * delta + 4 * Gs * Gs);
  const eUP = half + rad, eLP = half - rad;
  const pf = (lam: number) => { const d = lam - wc; return (Gs * Gs) / (Gs * Gs + d * d); };
  return { eUP, eLP, pfUP: pf(eUP), pfLP: pf(eLP) };
}

export function PolaritonFormation({ g, n, selected, onSelect }: { g: number; n: number; selected: "LP" | "UP" | null; onSelect: (b: "LP" | "UP" | null) => void }) {
  const G0 = useMemo(() => g * Math.sqrt(Math.max(1, n)), [g, n]);
  const [G, setG] = useState(G0);
  const [delta, setDelta] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { setG(G0); }, [G0]);

  // geometry (logical px)
  const CW = 600, CH = 388, ML = 52, MR = 132, MT = 18, MB = 38, PW = CW - ML - MR, PH = CH - MT - MB;
  const DX = Math.max(0.34, 3.2 * G0 + 1e-6);             // detuning half-range (stable in G0)
  const EY = DX / 2 + Math.max(G0, 0.02) * 1.7 + 0.05;    // energy half-range
  const xOf = (d: number) => ML + ((d + DX) / (2 * DX)) * PW;
  const yOf = (e: number) => MT + (1 - (e - (1 - EY)) / (2 * EY)) * PH;
  const dAt = (px: number) => Math.max(-DX, Math.min(DX, ((px - ML) / PW) * 2 * DX - DX));

  const here = polariton(delta, G);

  useEffect(() => {
    const c = cv.current; if (!c) return;
    const d = dpr(); if (c.width !== Math.round(CW * d)) { c.width = Math.round(CW * d); c.height = Math.round(CH * d); }
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = PANELC; ctx.fillRect(0, 0, CW, CH);
    // grid + frame
    ctx.strokeStyle = GRID; ctx.lineWidth = 0.5;
    ctx.font = `500 8.5px ${F}`; ctx.fillStyle = DIMC;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = -2; i <= 2; i++) { const x = xOf(i * DX / 2); ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke(); ctx.fillText((i * DX / 2).toFixed(2), x, MT + PH + 5); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) { const e = (1 - EY) + (i / 4) * 2 * EY, y = yOf(e); ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke(); ctx.fillText(e.toFixed(2), ML - 6, y); }
    ctx.strokeStyle = AXISC; ctx.lineWidth = 0.75; ctx.strokeRect(ML, MT, PW, PH);

    // bare modes (uncoupled) — dashed: photon (cyan, sloped) and molecule (red, flat)
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1.1;
    ctx.strokeStyle = "rgba(0,255,255,0.45)"; ctx.beginPath(); ctx.moveTo(xOf(-DX), yOf(1 - DX)); ctx.lineTo(xOf(DX), yOf(1 + DX)); ctx.stroke();
    ctx.strokeStyle = "rgba(255,58,58,0.45)"; ctx.beginPath(); ctx.moveTo(xOf(-DX), yOf(1)); ctx.lineTo(xOf(DX), yOf(1)); ctx.stroke();
    ctx.setLineDash([]);

    // polariton branches, coloured by photon fraction (Hopfield)
    const SEG = 200; ctx.lineWidth = 3;
    for (const which of ["UP", "LP"] as const) {
      for (let i = 0; i < SEG; i++) {
        const d0 = -DX + (i / SEG) * 2 * DX, d1 = -DX + ((i + 1) / SEG) * 2 * DX;
        const p0 = polariton(d0, G), p1 = polariton(d1, G);
        const e0 = which === "UP" ? p0.eUP : p0.eLP, e1 = which === "UP" ? p1.eUP : p1.eLP;
        const pf0 = which === "UP" ? p0.pfUP : p0.pfLP;
        ctx.strokeStyle = mix(pf0); ctx.beginPath(); ctx.moveTo(xOf(d0), yOf(e0)); ctx.lineTo(xOf(d1), yOf(e1)); ctx.stroke();
      }
    }

    // Ω_R gap bracket at resonance (Δ=0)
    const r0 = polariton(0, G), xg = xOf(0);
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(xg, yOf(r0.eUP)); ctx.lineTo(xg, yOf(r0.eLP)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = INKC; ctx.font = `600 9px ${F}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(`Ω_R = 2g√N = ${(2 * G).toFixed(3)}`, xg, yOf(r0.eUP) - 4);

    // draggable operating point
    ctx.strokeStyle = "rgba(255,204,0,0.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xOf(delta), MT); ctx.lineTo(xOf(delta), MT + PH); ctx.stroke();
    const dotUP = { x: xOf(delta), y: yOf(here.eUP) }, dotLP = { x: xOf(delta), y: yOf(here.eLP) };
    for (const [name, dot, pf] of [["UP", dotUP, here.pfUP], ["LP", dotLP, here.pfLP]] as const) {
      const sel = selected === name;
      ctx.beginPath(); ctx.arc(dot.x, dot.y, sel ? 7 : 5, 0, 2 * Math.PI); ctx.fillStyle = mix(pf); ctx.fill();
      if (sel) { ctx.strokeStyle = AMBER; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(dot.x, dot.y, 10, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.fillStyle = INKC; ctx.font = `700 10px ${F}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(name, dot.x + 13, dot.y);
    }
    // axis titles
    ctx.fillStyle = DIMC; ctx.font = `600 9px ${F}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("cavity − molecule detuning  Δ = ω_c − ω_a  (units of ω_a)", ML + PW / 2, CH - 4);
    ctx.save(); ctx.translate(13, MT + PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("energy  E / ω_a", 0, 0); ctx.restore();
  }, [G, delta, selected, G0, CW, CH, ML, MR, MT, MB, PW, PH, DX, EY]);

  const onPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setDelta(dAt((e.clientX - r.left) * (CW / r.width)));
  };
  const Comp = ({ name, pf }: { name: "LP" | "UP"; pf: number }) => (
    <button className={"pf-comp" + (selected === name ? " on" : "")} onClick={() => onSelect(selected === name ? null : name)}>
      <span className="pf-comp-name">{name}</span>
      <span className="pf-bar"><span className="pf-seg pf-ph" style={{ width: `${(pf * 100).toFixed(0)}%` }} /><span className="pf-seg pf-mt" style={{ width: `${((1 - pf) * 100).toFixed(0)}%` }} /></span>
      <span className="pf-comp-val"><b style={{ color: CY }}>{(pf * 100).toFixed(0)}%</b> light · <b style={{ color: RD }}>{((1 - pf) * 100).toFixed(0)}%</b> matter</span>
    </button>
  );

  return (
    <div className="pf-root">
      <div className="pf-plotwrap">
        <canvas ref={cv} className="pf-canvas" style={{ width: CW, height: CH, maxWidth: "100%" }} onPointerDown={onPt} onPointerMove={(e) => { if (e.buttons) onPt(e); }} />
      </div>
      <div className="pf-side">
        <div className="pf-row"><span>coupling <i>g√N</i></span>
          <input type="range" min={0} max={Math.max(0.001, 2 * G0)} step={Math.max(0.001, 2 * G0) / 200} value={G} onChange={(e) => setG(Number(e.target.value))} />
          <b style={{ color: G > 0.02 ? CY : DIMC }}>{G.toFixed(3)}</b>
        </div>
        <div className="pf-hint">{G < 0.012 ? "no coupling → no polaritons: the bare photon and molecule just cross." : "the bare modes repel into LP/UP — that splitting (Ω_R) is the polariton."}</div>
        <div className="pf-comps">
          <div className="pf-comps-head">at Δ = {delta.toFixed(2)} — drag the plot to detune · click a branch to freeze it in 3D</div>
          <Comp name="UP" pf={here.pfUP} />
          <Comp name="LP" pf={here.pfLP} />
        </div>
        <div className="pf-note">Each polariton is a blend of <b style={{ color: CY }}>light</b> and <b style={{ color: RD }}>matter</b>. At Δ=0 both are exactly <b>50/50</b> — the maximal hybrid. Detune and the blend swaps: one becomes photon-like, the other molecule-like.</div>
      </div>
    </div>
  );
}
