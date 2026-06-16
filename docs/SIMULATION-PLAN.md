# Polariton Simulation — Engineering & Build Plan

> Audience: the developer (us) building an *accurate*, *beautiful*, interactive polariton cavity-QED
> simulation that a Notre Dame PhD (Shravan) could show at the DL4Sci summer school (LBNL, Jul 20–24 2026).
> Every view here renders a quantity from `PHYSICS-SPEC.md`. Built physics-first: **the tested engine
> is the oracle; the UI is its face.** Read `PHYSICS-SPEC.md` first.

---

## 1. Architecture — physics engine first, pixels second

```
sim/
├── docs/                  PHYSICS-SPEC.md · SIMULATION-PLAN.md · HISTORY-TREE.md · RESEARCH-EVIDENCE.json
├── engine/                pure TypeScript, ZERO rendering deps — the "oracle made visible"
│   ├── constants.ts       physical constants, unit conversions (eV↔cm⁻¹↔J), defaults
│   ├── microcavity.ts     System A: dispersion, eigensolve, Hopfield
│   ├── collective.ts      System B: JC/TC energies, √N, bright/dark counts
│   ├── htc.ts             System C: polariton energies, effective couplings, Marcus rate, N_max, QY
│   ├── marcus.ts          shared Marcus/FGR kernel + parabola geometry
│   └── index.ts
├── engine/__tests__/      golden-value unit tests (Vitest) — MUST pass before any UI work
├── views/                 one component per figure in the spec
└── data/                  history-tree.json (from HISTORY-TREE.md)
```

**Rule:** `engine/` never imports a UI library. It is independently testable, reusable for the future
GP-surrogate + BO work, and extensible to multimode. If a number can't be produced by `engine/`, it
does not appear on screen.

---

## 2. Engine API (function signatures the code must implement)

```ts
// ---- marcus.ts (shared kernel) ----
/** Marcus/FGR rate K(V,E_a). PHYSICS-SPEC C.9 / Eq.35. Returns s^-1 (relative units ok). */
export function marcusRate(p: { V: number; E_fi: number; E_r: number; kT: number }): number
//   E_a = E_fi + E_r;  K = sqrt(pi/(E_r*kT)) * |V|^2/(2*hbar) * exp(-E_a^2/(4*kT*E_r))

/** Diabatic parabolas for the Marcus plot. PHYSICS-SPEC C.3 / Eq.4. */
export function diabats(q: number[], p: { E_D:number; E_A:number; omega_v:number; lambda_v:number }):
  { VD: number[]; VA: number[] }
export function activationBarrier(dG: number, lambda: number): number   // (dG+lambda)^2/(4 lambda)

// ---- microcavity.ts (System A) ----
export function cavityDispersion(kPar: number[], p:{ Ecav0:number; mcav:number }): number[]  // A.1 parabolic
export function polaritonBranches(kPar:number[], p:{ Ecav0:number; Eexc:number; mcav:number; V:number }):
  { ELP:number[]; EUP:number[] }                       // A.4 eigenvalues of the 2x2
export function hopfield(delta:number, V:number): { X2:number; C2:number }   // A.6 (X2+C2=1)
export function angleToK(E:number, thetaDeg:number): number                  // A.7

// ---- collective.ts (System B) ----
export function collectiveCoupling(g:number, N:number): number              // g*sqrt(N)  (B.5)
export function rabiSplitting(g:number, N:number): number                   // 2*g*sqrt(N)
export function darkStateCount(N:number): number                            // N-1 (B.6)

// ---- htc.ts (System C) ----
export function polaritonEnergies(p:{ Delta:number; N:number; T:number }):  // C.7 Eq.26
  { OmegaPlus:number; OmegaMinus:number }
export function mixingAngle(p:{ Delta:number; N:number; T:number }): number // C.8 Theta
export function effectiveCouplings(p:{ H_AD:number; hbar_wc:number; t_AD:number }):
  { T00:number; T01:number; T10:number; T11:number }    // C.6 (g_AD=0 limit)
/** ET rate vs molecule number — produces the turnover curve. PHYSICS-SPEC C.9. */
export function etRateVsN(Ns:number[], p: HTCParams): { N:number; kTotal:number; channels:Record<string,number> }[]
/** Barrier-less turnover. PHYSICS-SPEC §6 — use the DIMENSIONALLY CORRECT form. */
export function nMax(p:{ hbar_wc:number; E_AD:number; T:number }): number
//   return 1 + (hbar_wc * E_AD) / (T*T)   // == 1 + (hbar_wc)^2/T^2 at resonance. DO NOT ship 1 + hbar_wc/T^2.
```

---

## 3. Golden unit tests (write these FIRST, in `engine/__tests__/`)

```ts
// THE non-negotiable test — guards the central result and the units correction.
test('N_max absorption channel = 1636', () => {
  expect(nMax({ hbar_wc: 1.0, E_AD: 1.0, T: 0.024731 })).toBeCloseTo(1636, 0)
})
test('N_max emission channel = 10785', () => {
  expect(nMax({ hbar_wc: 1.0, E_AD: 1.0, T: 0.009630 })).toBeCloseTo(10785, 0)
})
test('N_max is dimensionless-correct: doubling hbar_wc AND E_AD off resonance still scales right', () => {
  // guards against regressing to the printed 1 + hbar_wc/T^2 form
  const r = nMax({ hbar_wc: 2.0, E_AD: 0.5, T: 0.024731 })   // hbar_wc*E_AD = 1.0
  expect(r).toBeCloseTo(1636, 0)
})
test('anticrossing: LP/UP gap = 2V at resonance, never cross', () => {
  const { ELP, EUP } = polaritonBranches([0], { Ecav0:1.5, Eexc:1.5, mcav:3.6e-5, V:0.005 })
  expect(EUP[0]-ELP[0]).toBeCloseTo(0.010, 6)         // 2V = 10 meV
})
test('Hopfield 50/50 at resonance', () => {
  const { X2, C2 } = hopfield(0, 0.005); expect(X2).toBeCloseTo(0.5); expect(C2).toBeCloseTo(0.5)
})
test('Rabi splitting scales as sqrt(N-1)', () => {
  const { OmegaPlus, OmegaMinus } = polaritonEnergies({ Delta:0, N:101, T:0.0247 })
  expect(OmegaPlus-OmegaMinus).toBeCloseTo(2*Math.sqrt(100)*0.0247, 4)
})
test('Marcus rate maximal at E_a=0 (barrier-less)', () => {
  const peak = marcusRate({ V:0.02, E_fi:-1.0, E_r:1.0, kT:0.025 })   // E_a=0
  const off  = marcusRate({ V:0.02, E_fi:-0.5, E_r:1.0, kT:0.025 })
  expect(peak).toBeGreaterThan(off)
})
test('ET rate vs N shows a turnover (peak then decay)', () => {
  const curve = etRateVsN(logspace(1, 5, 60), DEFAULT_HTC)
  const peakIdx = argmax(curve.map(c=>c.kTotal))
  expect(peakIdx).toBeGreaterThan(0); expect(peakIdx).toBeLessThan(curve.length-1)
})
```
All green → only then build views. Anchors: `E_r=1`, `ω_v=80.6 cm⁻¹`, `H_AD=245 cm⁻¹`, `kT=0.025`, `|E_AD|=1`.

---

## 4. The views (each tied to a real figure)

| View | Renders | Spec ref | Money? |
|---|---|---|---|
| **V1 — Polariton dispersion** | E vs k‖: bare cavity + exciton (dashed) and LP/UP (solid) anticrossing live as `2V`, `δ`, `m_cav` sliders move | A.1–A.6 | iconic |
| **V2 — Hopfield bars / anticrossing-vs-δ** | |X|²/|C|² stacked bars + branch energies sweeping detuning | A.6 | yes |
| **V3 — Marcus surfaces** | V_D(q), V_A(q) parabolas + barrier; product surface splits into LP/UP/dark as N→N_max; **slides to barrier-less** | C.3, C.9 | ⭐ **THE money shot** |
| **V4 — ET rate vs N turnover** | log-x rate curve rising → peak at N_max → decay; vertical marker at N_max with the live value | C.9, §6, Fig.2 | ⭐ core result |
| **V5 — Energy-level / Jablonski** | bright polaritons P± + the N−1 dark-state band; √N splitting grows with N | B.5–B.6 | yes |
| **V6 — Bloch sphere** | two-level state \|ψ⟩=cos(θ/2)\|0⟩+e^{iφ}sin(θ/2)\|1⟩; light-matter mixing as rotation | viz/B | nice |
| **V7 — Quantum yield** | QY_b, QY_c vs N (Dicke-linear then suppressed) | C.10 | optional |
| **V8 — History tree** | interactive 1950s→now evolution graph from `history-tree.json` | HISTORY-TREE.md | context |
| **V9 (stretch) — Polariton graph/condensate** | Lagoudakis XY/Kuramoto condensate lattice (bonus, System from that paper) | evidence | stretch |

**Primary narrative path:** V1 (recognizable polaritons) → V5 (why N matters: √N + dark states) → V3 (Marcus surfaces reshaping) → V4 (the turnover, N_max) → V8 (history) → roadmap card (multimode + GP/BO).

---

## 5. Sliders (the real set — from PHYSICS-SPEC §7)

System C: `N` (log), `ℏω_c`, `E_AD`, `Δ` (derived/linked), `|T₀₁|`, `|T₁₀|`, `H_AD`, `E_r`, `ω_v`, `k_BT`.
System A: `2V`, `δ`, `m_cav`, `n`.
Plus the **geometry panel** (read-only mappings, honest): `L_z → ℏω_c`, `mode volume V → g`, `θ → k‖`,
`mirror reflectivity → κ (roadmap, inactive)`. Each slider shows its symbol, units, and the equation it feeds.

---

## 6. Tech approach & what makes each view credible (not AI-slop)

- **Stack:** TypeScript engine (framework-agnostic). UI: React + a charting layer; use **WebGL/Canvas** for
  V1/V3/V4 heavy line redraws, **Three.js** only for V6 (Bloch) and V9 (condensate lattice). Decide React-vanilla
  vs Next.js when we pick hosting — engine is independent of that choice.
- **Credibility cues physicists check:** correct **axis labels with units** (eV, meV, cm⁻¹, k‖ in µm⁻¹ with a
  twin angle axis per A.7); **anticrossing that truly never crosses**; **2V gap exactly equal to the slider**;
  Hopfield bars summing to 1; the Marcus parabolas having **equal curvature** and the barrier at the true vertex
  `(ΔG°+λ)²/4λ`; rate axis **log-scaled**; N axis **log-scaled** over 1–10⁵.
- **Aesthetic (deliberate, not default):** dark scientific palette, LP/UP in a fixed consistent color pair,
  photon-fraction encoded as a continuous color gradient along the branches (literally the Hopfield coefficient),
  smooth 60fps slider response (engine is cheap — closed forms, no heavy solves). Per Dhruv's standard: a chosen,
  non-default typeface; Awwwards-level layout. No stocky gradients, no purple-blob hero.
- **Validation overlay:** a toggle that overplots the paper's Fig. 2 / Fig. 4 reference points so a viewer can
  see the engine lands on them. This is the single most trust-building feature.

---

## 7. DO-NOT list (anti-slop guardrails)

1. **No `1 + ℏω_c/|T₀₁|²`.** Ship the dimensionally-correct `1 + ℏω_c·E_AD/|T₀₁|²`. There is a regression test for this.
2. **No standalone "mirror thickness" slider that changes nothing.** Thickness acts through ω_c and mode volume — show *that*, with the mapping visible.
3. **No invented parameters / no 50 sliders.** ~14 real knobs total. Slider count is not the differentiator; correctness is.
4. **No fabricated citations or numbers** in any tooltip/label. Every shown number traces to PHYSICS-SPEC.
5. **No hiding limitations.** §9 of the spec appears in a visible "model assumptions" panel.
6. **No flashy-but-wrong animation** (e.g. branches that cross, parabolas of unequal curvature, rate curves with no turnover). Wrong-but-pretty is worse than nothing for this audience.
7. **No cannibalizing the engine.** If a visual needs a number the engine can't yet produce, extend the engine + add a test — don't hardcode.

---

## 8. Build order

1. `engine/constants.ts` + `marcus.ts` + `htc.ts` → make the N_max + turnover tests pass. *(the spine)*
2. `microcavity.ts` + `collective.ts` → remaining engine tests green.
3. V4 (turnover) + V3 (Marcus surfaces) → the two money shots, on the validated engine.
4. V1 + V2 + V5 → the recognizable polariton suite.
5. V8 history tree, V6 Bloch, then stretch (V7, V9).
6. Polish pass: typography, color = Hopfield gradient, validation overlay, assumptions panel.

> Gate: **no view is built until its underlying engine function has a passing golden test.**
