# Polariton Cavity-QED Simulator — Product Specification (What the Software Must Be)

> Companion to `PHYSICS-SPEC.md` (the physics source of truth) and `VERIFICATION-REPORT.md`
> (the per-equation correctness ledger). This document defines the **software**: the computed
> capabilities, the credibility checklist, the two cavity systems, and the explicit non-goals
> that keep this an *instrument* rather than a decorative render.
>
> **The product thesis:** a research-grade cavity-QED / polariton simulator is a tool in which
> *every pixel on screen is a computed number with units, traceable to a named equation, and the
> user changes physical parameters — not visual sliders — to drive it.* That single property is what
> separates genuine teaching/research software (QuTiP, COMSOL, the Berloff–Lagoudakis polariton-graph
> simulator, Falstad, nanoHUB) from a vibecoded school project. The bar is: a physicist nods, and a
> science-fair judge sees a real instrument, not a glowing cartoon.

---

## 0. What "research-grade" means here (the one-line test)

For **every** visual element, two questions must both answer *yes*:

1. **Can I read a number off this?** (real axis, real units, a value an expert could quote.)
2. **Does it follow a convention an expert has seen in a paper?** (dashed-bare / solid-coupled
   dispersion; light line on an SPP plot; diverging colormap for a signed field; the N−1 dark-state
   manifold pinned at the bare energy; a labeled colorbar.)

If a pixel fails either test, it is decoration and does not ship. This is the same standard the
genuine tools hold themselves to: in QuTiP every plotted curve is an expectation-value array with
units; in COMSOL every field map carries a labeled colorbar and physical axes; in the
Berloff–Lagoudakis simulator the output *is* the global minimum of a real XY Hamiltonian, not a
mood. (Refs: QuTiP visualization guide <https://qutip.org/docs/4.7/guide/guide-visualization.html>;
COMSOL SPP model 119251 <https://www.comsol.com/model/simulation-of-metalair-surface-plasmon-polariton-propagation-and-dispersion-119251>;
Berloff & Lagoudakis, *New J. Phys.* **19**, 125008 (2017), <https://arxiv.org/abs/1709.05498>.)

---

## 1. Computed capabilities (what the software must actually calculate and show)

All of these are driven by the validated engine in `/engine` (`microcavity.ts`, `collective.ts`,
`htc.ts`, `marcus.ts`, `constants.ts`), which is pure TypeScript with a `vitest` golden-value suite.
The software exposes the following computed objects as **first-class views**, not afterthoughts.

### 1.1 Angle-resolved polariton dispersion E(θ)/E(k‖) — the hero figure
The single computed object that says "cavity QED" to a physicist. A twin-axis plot — energy E [eV]
on y, external emission angle θ [deg] on the bottom x, in-plane momentum k‖ [µm⁻¹] on the top x —
carrying four curves:

- **bare cavity parabola** `E_cav(k‖)` from `cavityDispersion(...)` — **dashed** (uncoupled reference);
- **bare exciton line** `E_exc = const` — **dashed**, and **flat** on the plotted range
  (m_cav ≈ 3.6×10⁻⁵ mₑ is ~4 orders lighter than the exciton; a visibly *curved* exciton line is a
  correctness failure);
- **lower / upper polariton (LP/UP)** from `polaritonBranches(...)` — **solid**, anticrossing, with
  minimum gap = 2V = ħΩ_R read straight off the y-axis in meV.

Each LP/UP branch is colored by its Hopfield photon/exciton fraction from `hopfield(...)` — a
diverging red(exciton)↔blue(photon) gradient *along the curve*, so the branch visibly changes
character through the anticrossing. The detuning slider δ = E_cav0 − E_exc slides the dashed
parabola vertically through the flat exciton line, sweeping the published negative/zero/positive-
detuning panel series (Deng–Haug–Yamamoto b/c/d) as one continuous motion. Hover returns exact
(θ, E_LP, E_UP, local gap, photon %). The y-axis is a **true linear eV axis** — the rendered
vertical gap *is* the meV splitting (no arbitrary pixel scale factor).
(Refs: Houdré et al., *Phys. Rev. Lett.* **73**, 2043 (1994), <https://link.aps.org/doi/10.1103/PhysRevLett.73.2043>;
Deng, Haug & Yamamoto, *Rev. Mod. Phys.* **82**, 1489 (2010), <https://link.aps.org/doi/10.1103/RevModPhys.82.1489>.)

### 1.2 Hopfield photon/exciton fraction companion
`|X|²` (matter) and `|C|²` (photon) of the lower polariton vs detuning from `hopfield(δ, V)`: two
complementary curves in [0,1] that **sum to 1** and **cross at exactly 0.5 at δ=0**. Shares the
hero's red/blue colormap and updates live with the detuning slider. The sum-to-1 / cross-at-0.5
invariants are what an expert checks instantly.

### 1.3 Polariton states & the energy-level ladder (Jaynes → Tavis → Dicke)
A flat 2D vector ladder on a light background: bare degenerate `|g,1⟩/|e,0⟩` hybridizing into LP
(below) and UP (above), split by the **collective** Rabi splitting. Splitting scales as **√N**
(`rabiSplitting(g,N)=2g√N`, `collectiveCoupling(g,N)=g√N`; for System C, `polaritonEnergies({Δ,N,T})`
gives the actual LP/UP energies). The **N−1** (System B) / **N−2** (System C) **dark-state manifold**
is drawn as a degenerate gray bundle **pinned at the bare emitter energy, between LP and UP — never
above UP or below LP** (the field's single most load-bearing convention: Feist 2018, "LP, UP and N−1
dark states … maintain the original emitter energy"). The y-axis is a true eV axis; a bracket
annotates `2√(N−1)|T₀₁|`. As N moves, bars separate as √N live. An optional √n anharmonic Jaynes–
Cummings ladder inset covers the single-emitter limit (`jcSplitting(g,δ,n)`).
(Refs: Feist, Galego & García-Vidal, <https://arxiv.org/abs/1802.08681>;
Mandal et al., *Chem. Rev.* **123**, 9786 (2023), <https://pmc.ncbi.nlm.nih.gov/articles/PMC10450711/>.)

### 1.4 Cavity fields / modes — quantitative standing-wave |E(z)|²
The longitudinal standing-wave mode |E(z)|² along the optical axis: sin² antinodes whose **count
equals the real longitudinal mode index M** from k_z = πM/L_z (tied to ω_c, *not* an arbitrary
number), with oscillating-exponential penetration into the mirror stack, overlaid on the DBR
refractive-index step profile. Antinodes sit in the defect layer; decay is **faster into the lossy
mirror** than into the gap (the asymmetry is diagnostic). Rendered as a transfer-matrix-style 2D
plot with a labeled axis, or — if a 3D cross-section is kept — a cut-plane heatmap with a **labeled
colorbar** and a sequential/perceptually-uniform colormap (a FEM-style field map, not additive glow).
**Two-colormap hard rule:** diverging red-white-blue (zero-centered) for the *signed* field
amplitude; sequential (log if many decades) for *unsigned* |E|².
(Refs: COMSOL color-table conventions <https://doc.comsol.com/6.0/doc/com.comsol.help.comsol/comsol_ref_results.33.015.html>;
open Fabry-Pérot Purcell/mode-volume modeling <https://arxiv.org/pdf/2203.07070>.)

### 1.5 The HTC turnover — the money shot (ET rate vs N)
The project's actual research result (Sharma & Chen, *J. Chem. Phys.* **161**, 104102 (2024),
<https://arxiv.org/abs/2406.17101>). A full-size, **co-hero** log-log plot: x = molecule number N
(1…10⁵), y = cavity-modified ET rate / ordinary ET. A single curve that **rises, peaks, then decays
~e⁻ᴺ** (`etRateVsN(...)`), with a dashed vertical at **N_max** (`nMax(...)`, golden 1636 absorption /
10785 emission) and a faint horizontal "baseline = ordinary ET (=1)". A live marker tracks the N
slider so a user can **discover** the non-monotonic turnover by sweeping N — the hallmark of a real
instrument, not a static plot. N_max uses the dimensionally-correct form
`1 + ħω_c·E_AD / T₀₁²` (the engine deliberately *refutes* the paper's dimensionally-broken printed
`1 + ħω_c/T₀₁²`; see `VERIFICATION-REPORT.md`).

### 1.6 SPP dispersion (plasmonic-cavity toggle)
ω-vs-k dispersion at a metal/dielectric interface: k_SPP = k₀·√(ε_d ε_m / (ε_d + ε_m)) with a Drude
metal ε_m(ω) = 1 − ω_p²/ω², the **free-space light line** ω = ck drawn dashed, and the SPP branch
**always to the right of the light line**, bending over and flattening toward the surface-plasmon
asymptote ω_sp = ω_p/√2 at large k. Real units (eV/THz, rad/m), no normalized axes. Branch color
optionally encodes Q = Re(k)/Im(k). Paired SPP near-field map: |E| bound to the interface, decaying
evanescently, faster into the lossy metal. A non-dispersive metal or a straight ever-rising branch
is physically wrong.
(Refs: COMSOL "Modeling Surface Plasmon Polaritons" <https://www.comsol.com/blogs/modeling-surface-plasmon-polaritons-in-comsol>;
SPP dispersion / asymptote theory <https://arxiv.org/pdf/cond-mat/0611257>.)

### 1.7 CQED-CI-style polariton potential energy surfaces (PoPES)
The canonical output of the Foley `qed-ci` scan scripts and the Foley/Feist reviews. LP/UP potential-
energy **surfaces** vs a nuclear/reaction coordinate q: the photon-dressed ground surface
V_c(q) = V_g(q) + ħω_c hybridizing with the bare excited surface V_e(q) to give LP(q)/UP(q), built by
diagonalizing the **same validated 2×2 form** the engine already uses, applied along q instead of k.
Plotted on an **absolute energy axis** (label realistic eV/Hartree values, e.g. the MgH⁺ −199.6
regime if matching `qed-ci`), with **dashed** bare V_g+ω_c (photon-dressed ground) and bare V_e
(molecule), **solid** coupled LP/UP, each painted by continuous photon↔exciton character. A coupling-
strength sweep (λ / V) opens a barrier / deepens the LP minimum — the photochemistry-suppression
story. Optional overlay of the bare **Marcus parabolas** (`diabats(...)`, `activationBarrier(...)`)
and the N−1 / N−2 dark-state band. The **dipole-self-energy** (Pauli-Fierz vs Jaynes-Cummings)
distinction is surfaced as a toggle, never silently dropped — dropping DSE is a known error mode and
turns gauge-invariant PF energies into systematically wrong JC ones.
(Refs: FoleyLab/qed-ci <https://github.com/FoleyLab/qed-ci>; Foley, McTague & DePrince, "Ab initio
methods for polariton chemistry," *Chem. Phys. Rev.* **4**, 041301 (2023),
<https://pubs.aip.org/aip/cpr/article/4/4/041301/2916160/Ab-initio-methods-for-polariton-chemistry>
and <https://arxiv.org/abs/2307.04881>; Galego, García-Vidal & Feist, *PRX* **5**, 041022 (2015),
<https://arxiv.org/abs/1506.03331>.)

### 1.8 Marcus diabatic parabolas (the electron-transfer story, in coordinate space)
Donor/acceptor diabatic parabolas vs reaction coordinate q (`diabats(...)`), the crossing-point
activation energy E_a = (ΔG + λ)²/4λ, and cavity-shifted polariton parabolas whose crossing moves
with N. As N → N_max the polariton–acceptor crossing drops to barrier-less — the *same* event the
rate-vs-N turnover marks, now shown geometrically. JC (symmetric, no DSE) vs Pauli-Fierz (asymmetric,
with DSE) curves available as a toggle. This replaces any "glowing ball sliding on a stick."
(Ref: Mandal & Huo et al., *J. Phys. Chem. B* **124**, 6321 (2020),
<https://pubs.acs.org/doi/10.1021/acs.jpcb.0c03227>.)

---

## 2. The credibility checklist (what makes physicists and judges take it seriously)

A feature is "credible" only if it satisfies these. Each line is a ship-gate.

1. **Quantitative axes + real units, everywhere.** Energy in eV/meV (ESC) or meV/cm⁻¹ (VSC);
   geometry in nm/µm; momentum in µm⁻¹ or rad/m; angle in degrees; N as a real count on a log axis.
   No unitless/normalized/"vibes" curve is ever the centerpiece. The hero's y-axis is a *true* eV
   axis — the SVG `split = clamp(splitMeV*0.055, 2, 64)` pixel-fake is explicitly removed.
2. **Real physical parameter inputs, not abstract 0–1 knobs.** Cavity energy ħω_c (or mirror gap →
   ω_c), detuning δ, coupling g / |T₀₁|, molecule number N, reorganization energy E_r, temperature
   kT, decay rates. Every slider re-drives the verified engine; a slider that changes nothing on
   screen is a tell and does not ship. (Mirrors nanoHUB's Rappture inputs and QuTiP's operator-built
   Hamiltonians.)
3. **Data export.** CSV/JSON of every plotted curve **plus the exact parameter set** that produced
   it, and PNG of each figure. A figure a user cannot regenerate from a pinned parameter set does not
   exist. (QuTiP returns NumPy arrays; nanoHUB/Rappture exposes downloadable result data.)
4. **Validation / benchmark mode.** A visible "verify the engine" action backed by the `vitest`
   golden suite: N_max = 1636 / 10785, √(N−1) Rabi scaling, Hopfield sum-to-1 and cross-at-0.5,
   mixing angle π/4 at resonance, gap = 2V at resonance collapsing to 0 as V→0. This is the analogue
   of an FDTD mesh-convergence study or QuTiP's mesolve↔mcsolve agreement — the thing that makes an
   expert trust the numbers. (Refs: Lumerical convergence testing
   <https://optics.ansys.com/hc/en-us/articles/360034915833-Convergence-testing-process-for-FDTD-simulations>;
   `qed-ci` reference-value pytest with atol≈1e-4 <https://github.com/FoleyLab/qed-ci>.)
5. **Coordinated multi-view.** One parameter change propagates everywhere: 3D/schematic cavity hero +
   synced 2D panels (dispersion, Hopfield, energy ladder, rate-vs-N) all update together — the
   Falstad position/momentum/parity model and the Foley-review "panels c–f" layout.
6. **Reproducibility + honest assumptions in-scene.** The regime (single-mode, lossless, resonance)
   is stated on screen; deviations from the literature are flagged, not hidden (the engine openly
   refutes the paper's broken N_max units and a factor-of-2 Marcus prefactor — keep that ethic
   visible). Pinned defaults: `DEFAULT_MICROCAVITY` (E_cav0=E_exc=1.5 eV, 2V=10 meV, m_cav=3.6×10⁻⁵,
   n=3.5), `DEFAULT_HTC`.
7. **At least one genuine discovery.** The non-monotonic N_max turnover is a real, surprising,
   citable result a user finds by sweeping N. The tool must *let you discover something*, not just
   display a known plot.
8. **Hover-readouts on every plot.** Exact (θ, E), (N, rate), splitting in meV, local photon %. Real
   tools let you query the data.

---

## 3. The two cavity systems

The software ships **two interchangeable cavity architectures** behind a single toggle; switching one
swaps the geometry schematic, the field visualization, *and* the dispersion view.

### System I — Fabry-Pérot microcavity (the textbook planar cavity)
Two parallel mirrors (abstract slabs or a few-stripe λ/4 DBR stack) separated by L; molecules in the
mode volume. Drives §1.1 (E(θ)/E(k‖) anticrossing), §1.3 (energy ladder), §1.4 (standing-wave
|E(z)|² with the DBR index overlay), §1.7 (PoPES), §1.5 (HTC turnover). This is the iconic
"two-branches-anticrossing" polariton picture; Rabi splittings land in literature ranges
(GaAs 4–16 meV, CdTe 10–26 meV, organic J-aggregate 30–100+ meV, perovskite hundreds of meV).
(Ref: Ribeiro & Yuen-Zhou et al., <https://arxiv.org/abs/1802.08681>.)

### System II — Plasmonic / SPP nanocavity
A metal/dielectric nanostructure outline with a polarization arrow. Drives §1.6 (SPP ω-k dispersion
with the dashed light line and the ω_p/√2 asymptote) and a near-field hotspot / |E| map confined to
the interface with faster decay into the lossy metal. Sub-diffraction mode volumes → larger coupling
g ∝ 1/√V. This is the "extreme confinement" complement to the planar cavity.
(Refs: COMSOL SPP model 119251; nanogap near-field maps <https://pmc.ncbi.nlm.nih.gov/articles/PMC4945943/>.)

---

## 4. Explicit non-goals (what this software is NOT)

These are hard exclusions. Each maps to a documented "AI-slop tell" and its research-grade inversion.

- **No decorative bloom hero.** No `UnrealBloom`/`Vignette` as the dominant look, no additive-blended
  over-brightness "to feed bloom." Bloom-everything is the #1 fake-render tell and washes out any
  quantitative reading.
- **No auto-rotating turntable.** The hero does not spin itself. Motion comes from the *physics
  changing* (branches repelling, splitting growing as √N), not a camera on a lazy Susan. Default to a
  still, near-orthographic view; user-driven orbit is opt-in.
- **No neon-on-black / glassmorphism / gradient-text dashboard aesthetic.** Light/near-white
  backgrounds for the quantitative panels; teal/magenta/gold-on-black is the generic "sci-fi quantum"
  default, not measured iridescence.
- **No glossy iridescent clearcoat mirrors as "the cavity."** Real DBRs are matte layered stacks;
  render the stack or a measured stopband, not a polished glass dish.
- **No floating glowing equations over a dark render.** The Hamiltonian / Ω / N_max sit in a clean,
  static, typeset block *beside* the figure, the way journals present them.
- **No demoted physics.** The real plots are never shrunk into a 268-px side rail while a non-
  quantitative render owns the screen. The dispersion anticrossing and the HTC turnover are co-heroes.
- **No faked axes or hardcoded numbers.** Every value comes from the verified engine; no pixel-scaled
  "energy," no invented Rabi splitting, no silently chained mismatched units (the µm⁻¹/m⁻¹ hazard
  between `angleToK` and `cavityDispersion` is unit-guarded).
- **No overclaiming the model.** Single-mode + lossless + resonance is fine — but said so. The tool
  does not imply multi-mode lossy QED it did not compute, real-time surface-hopping dynamics (that is
  FoleyLab/PyCQED, a separate package), or "quantum supremacy."
- **No rainbow/jet colormap on a signed field**, and no diverging colormap on a strictly-positive
  intensity — the two-colormap rule is enforced.

The diagnosis the rebuild fixes, in one line: *the old hero was an aesthetic render and the physics
was a footnote chart; the fix is to swap which object owns the screen.*

---

## 5. Reference tools (the bar we are measured against)

| Tool | What it establishes for us |
|---|---|
| **QuTiP** — <https://qutip.org/> | Every plotted curve is a unit-bearing expectation array; colormaps encode physics (Wigner negativity via `wigner_cmap`). |
| **MEEP / Lumerical / COMSOL** — <https://meep.readthedocs.io/>, <https://www.ansys.com/products/optics/fdtd>, <https://www.comsol.com/> | Field maps with labeled colorbars + real µm axes; mesh-convergence as the trust signal; SPP/dispersion conventions. |
| **FoleyLab/qed-ci** — <https://github.com/FoleyLab/qed-ci> | The ab-initio PoPES "killer figure" (LP/UP vs bond length), Pauli-Fierz vs JC, milli-Hartree regression tests. |
| **Berloff–Lagoudakis polariton-graph simulator** — <https://arxiv.org/abs/1709.05498> | A simulator whose *output is a computed physical answer* (the XY global minimum), not a mood. |
| **Falstad applets** — <https://www.falstad.com/qm1d/> | Coordinated multi-view (position/momentum/parity), phase-as-color, instant direct-manipulation. |
| **nanoHUB Quantum Dot Lab** — <https://nanohub.org/resources/qdot> | Physical parameter inputs via a real GUI; downloadable results; run comparison. |
| **Photizon** — <https://photizon.com/> | Control-left / live-plot-right layout, SI-unit-labeled controls, physically meaningful presets, in-UI sanity checks (Σ orders = 1). |

---

## 6. Six-line summary

1. **The product is an instrument, not a render:** every pixel is a computed, unit-bearing number
   traceable to an equation in `PHYSICS-SPEC.md`, driven by the validated `/engine` oracle.
2. **Computed capabilities:** angle-resolved dispersion E(θ)/E(k‖) with the anticrossing (the hero),
   Hopfield fractions, the √N energy ladder + dark-state manifold, quantitative |E(z)|² standing-wave
   fields, an SPP dispersion, a CQED-CI-style polariton PES, and the HTC ET-rate-vs-N turnover.
3. **Two cavity systems:** a Fabry-Pérot microcavity and a plasmonic/SPP nanocavity, behind one
   toggle that swaps geometry, field map, and dispersion.
4. **Credibility checklist:** quantitative axes + real units, real physical inputs, CSV/JSON/PNG
   export, a `vitest` golden-value validation mode, coordinated multi-view, reproducible pinned
   parameters, and at least one genuine discovery (the N_max turnover).
5. **Explicit non-goals:** no decorative bloom hero, no auto-rotate turntable, no neon-on-black, no
   glossy iridescent mirrors, no floating glowing equations, no demoted physics, no faked axes.
6. **Measured against** QuTiP, MEEP/Lumerical/COMSOL, FoleyLab/qed-ci, the Berloff–Lagoudakis
   simulator, Falstad, nanoHUB, and Photizon — and grounded in Sharma & Chen, *J. Chem. Phys.* **161**,
   104102 (2024).

**Path:** `/Users/dhruvjain/polariton-research/sim/docs/PRODUCT-SPEC.md`
