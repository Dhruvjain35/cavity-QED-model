// Polariton FORMATION, the avoided crossing, made interactive and CONTROLLED. The cavity photon and the
// (bright) molecular excitation are two coupled modes: H = [[ω_c, G], [G, ω_a]] with G = g√N. Turning up the
// coupling makes the two bare levels REPEL and split into the lower/upper polaritons (LP/UP); each branch is
// a light–matter blend whose composition (Hopfield |⟨a|±⟩|²) is drawn in colour. At zero detuning each
// polariton is exactly 50/50, the hybrid. Same 2×2 bright-mode physics the validated (N+1)×(N+1) arrowhead
// reduces to. State (g via onG, detuning via onDelta, branch via onSelect) is lifted to the app so the
// coupling/detuning dials drive the REAL simulation and the 3D hybrid stays in lockstep.
import { useEffect, useMemo, useRef } from "react";

const CY = "#00ffff", RD = "#ff3a3a", INKC = "#ffffff", DIMC = "#8b949e", AXISC = "#5a626c", GRID = "#1b2026", PANELC = "#0a0d12", AMBER = "#ffcc00";
const F = "'IBM Plex Sans',system-ui,sans-serif";
const dpr = () => Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
const GMAX = 0.5, DX = 0.45, EY = 0.82; // FIXED axes so dragging coupling visibly GROWS the gap (no rescale)

function mix(t: number) { // photon fraction 0 (matter, red) → 1 (photon, cyan)
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(0xff * (1 - u) + 0x00 * u), g = Math.round(0x3a * (1 - u) + 0xff * u), b = Math.round(0x3a * (1 - u) + 0xff * u);
  return `rgb(${r},${g},${b})`;
}
function polariton(delta: number, G: number) {
  const Gs = Math.max(G, 1e-6); // floor keeps the G→0 limit well-defined (pure photon/matter off resonance, 50/50 at degeneracy)
  const wc = 1 + delta, wa = 1, half = (wc + wa) / 2, rad = 0.5 * Math.sqrt(delta * delta + 4 * Gs * Gs);
  const eUP = half + rad, eLP = half - rad;
  const pf = (lam: number) => { const d = lam - wc; return (Gs * Gs) / (Gs * Gs + d * d); };
  return { eUP, eLP, pfUP: pf(eUP), pfLP: pf(eLP) };
}

export function PolaritonFormation({ g, n, delta, onDelta, onG, selected, onSelect }: {
  g: number; n: number; delta: number; onDelta: (d: number) => void; onG: (G: number) => void;
  selected: "LP" | "UP" | null; onSelect: (b: "LP" | "UP" | null) => void;
}) {
  const G = useMemo(() => g * Math.sqrt(Math.max(1, n)), [g, n]);
  const cv = useRef<HTMLCanvasElement>(null);
  const CW = 600, CH = 430, ML = 52, MR = 36, MT = 18, MB = 36, PW = CW - ML - MR, PH = CH - MT - MB;
  const xOf = (d: number) => ML + ((d + DX) / (2 * DX)) * PW;
  const yOf = (e: number) => MT + (1 - (e - (1 - EY)) / (2 * EY)) * PH;
  const dAt = (px: number) => Math.max(-DX, Math.min(DX, ((px - ML) / PW) * 2 * DX - DX));
  const here = polariton(delta, G);

  useEffect(() => {
    const c = cv.current; if (!c) return;
    const d = dpr(); if (c.width !== Math.round(CW * d)) { c.width = Math.round(CW * d); c.height = Math.round(CH * d); }
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = PANELC; ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = GRID; ctx.lineWidth = 0.5; ctx.font = `500 8.5px ${F}`; ctx.fillStyle = DIMC; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = -2; i <= 2; i++) { const x = xOf(i * DX / 2); ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + PH); ctx.stroke(); ctx.fillText((i * DX / 2).toFixed(2), x, MT + PH + 5); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) { const e = (1 - EY) + (i / 4) * 2 * EY, y = yOf(e); ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + PW, y); ctx.stroke(); ctx.fillText(e.toFixed(2), ML - 6, y); }
    ctx.strokeStyle = AXISC; ctx.lineWidth = 0.75; ctx.strokeRect(ML, MT, PW, PH);
    // bare modes (uncoupled): photon (cyan, sloped) + molecule (red, flat)
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1.1;
    ctx.strokeStyle = "rgba(0,255,255,0.4)"; ctx.beginPath(); ctx.moveTo(xOf(-DX), yOf(1 - DX)); ctx.lineTo(xOf(DX), yOf(1 + DX)); ctx.stroke();
    ctx.strokeStyle = "rgba(255,58,58,0.4)"; ctx.beginPath(); ctx.moveTo(xOf(-DX), yOf(1)); ctx.lineTo(xOf(DX), yOf(1)); ctx.stroke();
    ctx.setLineDash([]);
    // polariton branches coloured by photon fraction
    const SEG = 200; ctx.lineWidth = 3;
    for (const which of ["UP", "LP"] as const) {
      for (let i = 0; i < SEG; i++) {
        const d0 = -DX + (i / SEG) * 2 * DX, d1 = -DX + ((i + 1) / SEG) * 2 * DX, p0 = polariton(d0, G), p1 = polariton(d1, G);
        const e0 = which === "UP" ? p0.eUP : p0.eLP, e1 = which === "UP" ? p1.eUP : p1.eLP, pf0 = which === "UP" ? p0.pfUP : p0.pfLP;
        ctx.strokeStyle = mix(pf0); ctx.beginPath(); ctx.moveTo(xOf(d0), yOf(e0)); ctx.lineTo(xOf(d1), yOf(e1)); ctx.stroke();
      }
    }
    // Ω_R gap at resonance
    const r0 = polariton(0, G), xg = xOf(0);
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(xg, yOf(r0.eUP)); ctx.lineTo(xg, yOf(r0.eLP)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = INKC; ctx.font = `600 9px ${F}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`Ω_R = 2g√N = ${(2 * G).toFixed(3)}`, xg, yOf(r0.eUP) - 4);
    // operating point
    ctx.strokeStyle = "rgba(255,204,0,0.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xOf(delta), MT); ctx.lineTo(xOf(delta), MT + PH); ctx.stroke();
    for (const [name, e, pf] of [["UP", here.eUP, here.pfUP], ["LP", here.eLP, here.pfLP]] as const) {
      const x = xOf(delta), y = yOf(e), sel = selected === name;
      ctx.beginPath(); ctx.arc(x, y, sel ? 7 : 5, 0, 2 * Math.PI); ctx.fillStyle = mix(pf); ctx.fill();
      if (sel) { ctx.strokeStyle = AMBER; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x, y, 10, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.fillStyle = INKC; ctx.font = `700 10px ${F}`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(name, x + 13, y);
    }
    ctx.fillStyle = DIMC; ctx.font = `600 9px ${F}`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("detuning  Δ = ω_c − ω_a  (units of ω_a)", ML + PW / 2, CH - 3);
    ctx.save(); ctx.translate(12, MT + PH / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; ctx.fillText("energy  E / ω_a", 0, 0); ctx.restore();
  }, [G, delta, selected, CW, CH, ML, MR, MT, MB, PW, PH]);

  const onPt = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); onDelta(dAt((e.clientX - r.left) * (CW / r.width))); };
  const Comp = ({ name, pf }: { name: "LP" | "UP"; pf: number }) => (
    <button className={"pf-comp" + (selected === name ? " on" : "")} onClick={() => onSelect(selected === name ? null : name)}>
      <span className="pf-comp-name">{name}</span>
      <span className="pf-bar"><span className="pf-seg pf-ph" style={{ width: `${(pf * 100).toFixed(0)}%` }} /><span className="pf-seg pf-mt" style={{ width: `${((1 - pf) * 100).toFixed(0)}%` }} /></span>
      <span className="pf-comp-val"><b style={{ color: CY }}>{(pf * 100).toFixed(0)}%</b> light · <b style={{ color: RD }}>{((1 - pf) * 100).toFixed(0)}%</b> matter</span>
    </button>
  );

  return (
    <div className="pf-root">
      <div className="pf-plotwrap"><canvas ref={cv} className="pf-canvas" onPointerDown={onPt} onPointerMove={(e) => { if (e.buttons) onPt(e); }} /></div>
      <div className="pf-ctrls">
        <div className="pf-row"><span>coupling <i>g√N</i></span><input type="range" min={0} max={GMAX} step={GMAX / 200} value={Math.min(GMAX, G)} onChange={(e) => onG(Number(e.target.value))} /><b style={{ color: G > 0.02 ? CY : DIMC }}>{G.toFixed(3)}</b></div>
        <div className="pf-row"><span>detuning <i>Δ</i></span><input type="range" min={-DX} max={DX} step={DX / 100} value={Math.max(-DX, Math.min(DX, delta))} onChange={(e) => onDelta(Number(e.target.value))} /><b>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}</b></div>
        <div className="pf-hint">{G < 0.012 ? "g√N ≈ 0 → no polaritons: the bare photon and molecule just cross." : "the bare modes repel into LP/UP, that splitting Ω_R is the polariton. Click a branch to freeze it in 3D →"}</div>
        {G >= 0.1 ? <div className="pf-warn">⚠ ultrastrong (η = g√N/ω_c = {G.toFixed(2)} ≥ 0.1): this RWA picture is qualitative here, the full quantum Rabi model (counter-rotating terms) would shift the numbers.</div> : null}
        <div className="pf-comps">
          <Comp name="UP" pf={here.pfUP} />
          <Comp name="LP" pf={here.pfLP} />
        </div>
      </div>
    </div>
  );
}
