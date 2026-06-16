# Polariton Cavity-QED Simulation — Visual Specification (Grounded Visual Language)

**Status:** source of truth for the rendering rebuild. Derived from how the field *actually* draws
this — Foley-lab figures (arXiv:2307.04881, JCTC 2024), COMSOL FEM field/dispersion maps, the canonical
angle-resolved dispersion (Houdré PRL 73, 2043 1994; Deng–Haug–Yamamoto RMP 82, 1489 2010), the
panel-a geometry of Ribeiro/Yuen-Zhou arXiv:1802.08681, and the Berloff/Lagoudakis polariton-graph
simulator (NJP 19, 125008 2017). Every view below is a *render of a computed object* from
`engine/*.ts` (PHYSICS-SPEC.md is the equation source of truth); nothing here is decorative.

**Companion docs:** `docs/PHYSICS-SPEC.md` (equations), `docs/VERIFICATION-REPORT.md` (per-equation
ledger). Engine entry: `engine/index.ts`.

---

## 0. The two non-interchangeable visual languages (the prime directive)

The field uses **two distinct grammars** and a research-grade tool must not blend them:

1. **Classical field-map language** (MEEP / Lumerical / COMSOL / Falstad / experimental PL):
   diverging red/white/blue over a grayscale structure, micron axes, transmission/reflectivity spectra,
   false-color intensity maps. → the 3D cavity, the standing-wave |E|², the SPP map belong here.
2. **Quantum-state / quantitative-plot language** (QuTiP / Foley PEC / Hopfield):
   clean flat 2D line plots, energy ladders, anticrossing dispersion, character-colored branches. →
   the dispersion hero, the Hopfield strip, the turnover, the PoPES, the level ladder belong here.

**The one universal rule that signals "real data":**
- **Signed** quantities (real(Eₓ), standing-wave amplitude that swings ±, surface charge) →
  **diverging** colormap, zero-centered, white/neutral at zero (RdBu / bwr).
- **Unsigned** intensities (|E|², |E|⁴ SERS, PL intensity) → **sequential** map (viridis / hot;
  **log** scale if it spans many decades).
- Mismatching these (rainbow on a signed field, diverging on a strict positive) is *the* tell of fake.

---

## 1. Global render conventions (apply to every view)

| Aspect | Specification |
|---|---|
| **Background** | Light / near-white (`#fafafa`–`#ffffff`) for all 2D quantitative plots; the optional 3D schematic may use a restrained neutral, **never** `#0d1014` neon-on-black. |
| **Axes** | Thin axis box, real ticks, **real units in every label** (eV / meV for energy, deg for angle, µm⁻¹ or rad/m for momentum, nm/µm for geometry, s⁻¹ for rate, N dimensionless). No normalized/unitless axes. |
| **Line convention** | **DASHED / thin gray** = uncoupled / bare / diabatic reference modes. **SOLID** = coupled eigenstates (the data). This is universal and load-bearing. |
| **Character colormap** | Diverging **red `#d1495b` (exciton/matter) ↔ blue `#1d6f7e` (photon/light)**, white at 50/50. Reused verbatim across dispersion branches, Hopfield strip, PoPES character. |
| **Reference lines** | Every primary plot carries its mandatory reference: dispersion → dashed bare cavity + bare exciton; SPP → free-space light line; standing wave → DBR index step; turnover → baseline=1 and N_max marker. A plot without its reference line reads as decorative. |
| **No bloom / no gloss / no auto-rotate** | Remove `UnrealBloom`, `Vignette`, `meshPhysicalMaterial` iridescence/clearcoat, emissive rims, additive-blended glow, and the `OrbitControls autoRotate` turntable. Motion comes from physics changing, not the camera. Default 3D to a still near-orthographic view. |
| **Equations** | Typeset in a clean static block beside/under the figure (journal style). **Never** float glowing equations over a dark 3D scene. |
| **Hover + export** | Every plotted curve is hoverable (exact values) and exports CSV/PNG with the parameter set that produced it. |
| **Honesty in-scene** | State regime/assumptions on screen (single-mode, lossless, resonance). Expose a "verify the engine" button surfacing the vitest golden values (N_max = 1636/10785, √(N−1) Rabi, θ=π/4 at resonance). |

**AI-slop tells to invert (forensic):** heavy bloom → flat; iridescent glossy mirrors → matte DBR
slabs; teal/magenta neon on black → light bg + muted meaningful color; auto-rotate → still + physics
motion; floating glowing Hamiltonian → static typeset block; real plots demoted to 268 px SVGs →
promote dispersion + turnover to co-heroes; fake pixel-scaled energy axis (`split*0.055`) → true eV axis.

---

## 2. CENTERPIECE — Live angle-resolved polariton dispersion E(θ) / E(k‖)

**This is the hero.** It is the single computed object that says "cavity QED" to any physicist. It is
promoted from the demoted 268 px SVG to full center stage. Existing diagnosis ("the hero is an aesthetic
render, the physics is a footnote chart") is fixed by literally swapping which object owns the screen.

### 2.1 Axes & units
- **y-axis:** `Energy (eV)`, **linear**, so the rendered vertical gap **is** the true meV splitting.
  Range tied to material preset (default `Eexc = Ecav0 = 1.5 eV`; organic/perovskite class ~2.1–2.5 eV;
  GaAs/CdTe ~1.4–1.7 eV). **Replace the `split = clamp(splitMeV*0.055, 2, 64)` pixel hack** — no scale factor.
- **bottom x-axis:** `Emission angle θ (deg)`, symmetric **−25 … +25°**.
- **top x-axis (twin):** `k‖ (µm⁻¹)`. The two axes are **one** physical thing via
  `k‖ = (E/ħc) sin θ` (PHYSICS-SPEC §A.7). Label both; never two separate plots.

### 2.2 Curves & colors (four curves, fixed convention)
| Curve | Engine source | Style |
|---|---|---|
| Bare cavity parabola E_cav(k‖) | `cavityDispersion(kPar, {Ecav0, mcav})` | **DASHED**, thin gray (or dashed red diagonal per Yuen-Zhou) |
| Bare exciton line E_exc = const | constant `Eexc` | **DASHED**, thin gray, **must be flat** on the plotted range |
| Lower polariton LP | `polaritonBranches(kPar, {...}).ELP` | **SOLID 2 px**, painted by Hopfield photon fraction |
| Upper polariton UP | `polaritonBranches(kPar, {...}).EUP` | **SOLID 2 px**, painted by Hopfield photon fraction |

- **CORRECTNESS GATE:** the exciton line must be **flat** (`mcav ≈ 3.6e-5 m_e` is ~4 orders lighter
  than the exciton). A curved exciton line is a correctness failure.
- **Branch character coloring:** each LP/UP segment colored by `hopfield(δ, V).C2` (photon fraction)
  where `δ = detuning(E_cav(k), Eexc)`, on the diverging red(exciton)↔blue(photon) map. A branch
  **visibly changes color through the anticrossing** — this is physics IN the visual.
- **Rabi readout:** vertical bracket at the gap minimum labeled `2V = N meV` (= E_UP−E_LP at resonance).

### 2.3 Render approach
**Clean 2D Cartesian plot.** Light background, thin axis box, small legend (UP / LP / Cavity (dashed) /
Exciton (dashed)). Hover cursor returns exact `(θ, E_LP, E_UP, local gap, local photon %)`.
Toggle **"show bare modes"**. Toggle **"data mode"**: a false-color PL-style **sequential** intensity
heatmap (dark→bright) behind the curves with dashed bare overlays — mirrors angle-resolved PL papers.

### 2.4 Interactions (drive the engine live)
- **Detuning slider** `δ = Ecav0 − Eexc` (−20…+20 meV): slides the dashed parabola vertically through
  the flat exciton line, continuously sweeping the published negative/zero/positive panel series
  (Deng–Haug–Yamamoto b/c/d) as **one motion** instead of three static panels.
- **Coupling slider** `2V` (~2…120 meV by material class): at V=0 the LP/UP land **exactly** on the
  dashed bare crossing (the cleanest "the splitting IS the coupling" demonstration AND a unit-test
  invariant — validation target 2); increasing V opens the gap.
- **x-axis toggle** angle ⇄ k‖ (teaches the mapping).
- **Material preset** (GaAs ~7 meV, CdTe ~13 meV, organic J-aggregate ~40 meV, perovskite >100 meV)
  loads literature-grounded `Eexc, n, mcav, 2V`.

### 2.5 New engine helper required
`dispersionVsAngle(thetaDeg[], {Ecav0, Eexc, mcav, V, n})` → `{theta, kPar, ELP, EUP, Ecav, Eexc, photonFrac}`.
Build k‖ from θ with `E_C(θ) = E_C(0)/√(1 − (sinθ/n)²)` (PHYSICS-SPEC §A.7), then call
`polaritonBranches`. **Unit guard:** `angleToK` already returns m⁻¹ (×1e9) and `cavityDispersion`
expects m⁻¹ — keep the chain consistent (the documented 1e9 hazard noted in `microcavity.ts`).

### 2.6 What to AVOID
- Glossy/bloom 3D rendering of the dispersion (3D gloss hides the physics, reads as slop).
- Treating angle and k as different physical things or two plots.
- LP/UP crossing or touching at the anticrossing (must be level repulsion).
- A curved bare-exciton line on the plotted range.
- A fake pixel-scaled y-axis (the `*0.055` hack) — the gap must be true eV.
- Inventing Rabi magnitudes outside literature ranges per material class.

---

## 3. Hopfield-fraction companion — |X|² / |C|² vs detuning

### 3.1 Axes & curves
- **x:** `detuning δ (meV)`, swept `linspace(-20, +20, n)`. **y:** fraction `[0,1]`.
- `|X|²` (matter, **red**) and `|C|²` (photon, **blue**) of the lower polariton, complementary,
  sum to 1, **cross at exactly 0.5 at δ=0** (validation target 3).
- Source: `hopfield(delta, V)` → `{X2, C2}`. No new engine code.

### 3.2 Render approach & AVOID
Small **2D strip** directly under/beside the hero, sharing the **same** diverging red/blue colormap so
the legend is unified. Tick the 0.5/0.5 crossing at δ=0. Must update live with the detuning slider and
stay color-locked to the hero. **AVOID:** fractions that fail to sum to 1, or a flat 50/50 across all
detunings (they are 50/50 *only* at δ=0).

---

## 4. MONEY SHOT — HTC electron-transfer rate vs N turnover (co-hero)

This is the project's actual research result (Sharma & Chen 2024). Promoted from a 268 px rail to a
**full-size co-equal** plot beside the dispersion hero.

### 4.1 Axes, curve, units
- **x:** `Molecule number N`, **log** 1…1e5 (`logspace(0, 5, n)`).
- **y:** `ET rate / ordinary ET`, **log**.
- **Curve:** single **gold** turnover curve — rises, peaks at the visible peak, then decays ~e⁻ᴺ.
  Source: `etRateVsN(Ns, HTCParams)` → per-N `{cavityPlus, cavityMinus, baseline, kTotal}`.
- **N_max marker:** **magenta DASHED vertical** at `nMax({hbar_wc, E_AD, T})` (golden **1636** absorption /
  **10785** emission), value labeled.
- **Baseline:** faint horizontal dashed `baseline = ordinary ET (=1)` (N-independent).
- **Live marker:** filled dot at the current N from the slider.

### 4.2 Render approach, interaction, AVOID
Clean **log-log 2D plot**. Hover returns exact `(N, relative rate)`. Dragging the **N slider** moves
the marker so the user **watches it climb past the peak and collapse** — the non-monotonic turnover is
the discoverable result (validation target 6), not decoration.
**AVOID:** linear axes (hides the decades), faking N_max (keep the dimensionally-correct
`1 + (ħω_c·E_AD)/T²`; do **not** regress to the paper's printed `1 + ħω_c/T²` — guarded by the
`hbar_wc=2, E_AD=0.5 → 1636` regression test), and representing the rate as a glowing ball on a stick.

---

## 5. Polariton potential-energy surfaces (PoPES) vs reaction coordinate — the qed-ci killer figure

Mirrors FoleyLab/qed-ci MgH⁺ PECs and Galego/Garcia-Vidal/Feist photoisomerization-suppression figures.

### 5.1 Axes, curves, character
- **y:** `Energy (eV)` on an **absolute** scale (label realistic values, e.g. the MgH⁺ regime if matching
  qed-ci, or the model's own eV; plot energies as E_ref + Ω per field convention).
- **x:** `Reaction coordinate q (a.u.)` or `Bond length (Å)`.
- **DASHED** bare references: photon-dressed ground `V_c(q) = V_g(q) + ħω_c` (e.g. **blue dotted**) and
  bare excited `V_e(q)` (e.g. **orange dotted**) — drawn crossing where the solid branches anticross.
- **SOLID** coupled LP/UP **surfaces**, each painted by continuous photon↔exciton character
  (purple–orange per Galego/Feist, or the project's red/blue).
- **Dark-state band (optional):** the N−2 (System C) / N−1 (System B) degenerate manifold as a **gray
  bundle pinned at the bare exciton energy BETWEEN LP and UP** — never above UP or below LP (hard convention).

### 5.2 Render approach, interaction, AVOID
Clean **2D line plot**. **Coupling-strength slider** (λ / V) shown as a small-multiple sweep OR live
morph: the LP minimum **deepens and a barrier opens** as V grows (the photochemistry-suppression story,
Galego/Feist Fig 2 a→c). Optional overlay of the bare Marcus parabolas from `diabats()` with the
activation barrier marked.
**AVOID:** glossy 3D PES sheets (reserve 3D only for genuine 2-coordinate conical-intersection sheets);
placing dark states above UP or below LP, or omitting them; flat single-color coupled surfaces (character
must be color-encoded); same line style for bare and coupled.

### 5.3 New engine helper required
`polaritonPES(q[], {diabat params, omega_c, V})`: at each q build the 2×2
`[[V_g(q)+ω_c, V], [V, V_e(q)]]` (**reuse the exact eigensolver form already in `polaritonBranches`**),
diagonalize, return `{q, ELP_surface, EUP_surface, photonChar(q)}`. Same validated 2×2 as the hero,
applied along a nuclear coordinate instead of k.

---

## 6. Energy-level ladder — vacuum Rabi, √N collective splitting, dark-state manifold

### 6.1 Axes, levels, source
- **y:** **true energy axis (eV)** — **NOT** pixel-scaled. Replace the current `split*0.055` hack with
  real `Omega+ − Omega−` (System C) or `rabiSplitting` (System B).
- Horizontal levels: **LP teal** (below), **UP gold** (above); their vertical separation **is** the meV
  splitting. The bare degenerate `|g,1>/|e,0>` hybridize into LP/UP.
- **Dark manifold:** gray degenerate band of **N−2** (System C, `darkStateCountC(N)`) or **N−1**
  (System B, `darkStateCount(N)`) levels **exactly at the bare emitter energy, between LP and UP**, labeled
  with the count.
- Sources: `polaritonEnergies({Delta, N, T})` (System C), `rabiSplitting(g,N)=2g√N` /
  `collectiveCoupling(g,N)=g√N` (System B), `jcSplitting(g,δ,n)=√(δ²+4g²n)` (JC anharmonic inset). No new code.

### 6.2 Render approach, interaction, AVOID
**Flat 2D vector ladder** on a light background (Chem-Rev house style). Bracket annotates
`2√(N−1)|T₀₁|` (System C) or `2g√N` (System B). As the **N slider** moves, the bars separate as **√N**
live. Optional √n anharmonic JC-ladder inset for the single-emitter limit.
**AVOID:** the pixel-fake y-axis; placing dark states outside the LP/UP window; conflating single-emitter
(gap = 2g) with collective (gap = 2g√N) — the √N enhancement is the defining feature; omitting the
dark-state manifold (it is the field's whole point — "action in the dark").

---

## 7. Cavity standing-wave |E(z)|² field map — replaces the decorative glowing gold tube

### 7.1 What it shows
The longitudinal standing-wave mode |E(z)|² along the optical axis: sin² antinodes whose **count equals
the real longitudinal mode index M** from `k_z = Mπ/L_z` (PHYSICS-SPEC §A.1) — tied to ω_c, **not**
arbitrary. Oscillating-exponential penetration into the mirror stack; overlaid on the DBR refractive-index
step profile. **Currently `FabryPerotCavity` passes `antinodes = round(2 + hbar_wc*3)` — a fake; tie M to
the real mode relation.**

### 7.2 Render approach (two options) & colormap rule
- **Option A (2D, preferred for credibility):** |E|² vs position `z (nm)` line/area plot with the DBR
  index profile overlaid as a **step function**, antinodes visibly sitting in the defect layer,
  oscillating-exponential decay into the stack — a transfer-matrix-style figure.
- **Option B (3D cross-section, if kept):** a **cut-plane heatmap** of |E|² with a **sequential /
  perceptually-uniform** colormap and a **labeled colorbar** (enhancement numbers), thin geometry
  outlines — a FEM-style field map, **not** additive-blended glow.
- **Colormap rule:** signed standing-wave amplitude (±) → **diverging** red-white-blue;
  |E|² (unsigned) → **sequential**. **Faster decay into the lossy mirror** than into the gap
  (asymmetry is diagnostic).

### 7.3 New helper & AVOID
`standingWaveProfile(z[], {M, L, nLayers})` → `{|E|²(z), indexStep}`, antinode count from the real mode
index M. **AVOID:** `UnrealBloom`, the `sin(uTime*2.2)` time-pulse over-brightness, the `*1.7` bloom feed,
an arbitrary antinode count, symmetric decay into both media (must decay faster into metal).

---

## 8. SPP dispersion + near-field map — for the plasmonic-cavity toggle

Fills the currently-empty `PlasmonicCavity` toggle with real physics (COMSOL model 119251 grammar).

### 8.1 Dispersion plot
- **y:** `Photon energy (eV)` or `ω (THz)`. **x:** `In-plane wavevector β (rad/m or µm⁻¹)`.
- **Free-space light line `ω = c·k`** drawn as a straight **DASHED** reference.
- **SPP branch** SOLID, **always to the RIGHT** of (higher k than) the light line, bending over and
  flattening toward the asymptote **ω_sp = ω_p/√2** at large k. Drude metal `ε_m(ω)=1−ω_p²/ω²`.
- Branch color optionally encodes **Q-factor = Re(k)/Im(k)** (brighter = higher Q).
- Overlay discrete **simulated markers** on the analytic curve (validation-overlay look).
- `k_SPP = k0·√(ε_d ε_m / (ε_d + ε_m))`.

### 8.2 Near-field map
2D field of |E| **bound to the interface**, decaying evanescently, **faster into the lossy metal**;
sequential (Prism/viridis) for |E|, diverging (Wave/Dipole) for signed Eₓ; **black arrow overlay** for
field direction.

### 8.3 New helpers & AVOID
`sppDispersion(omega[], {omega_p, eps_d, gamma})` → `{omega, kReal, kImag, Q}`; `drudeEps(omega, {omega_p, gamma})`.
Pure analytic, matches the engine's oracle style.
**AVOID:** k on vertical / ω on horizontal; omitting the light line (then "SPP lies to the right" is
invisible); a straight ever-rising branch (omitting the ω_p/√2 asymptote is physically wrong); a
non-dispersive (constant-ε) metal; normalized axes; symmetric decay into both media.

---

## 9. Marcus diabatic parabolas — for the ET story, replaces the hopping glowing electron

### 9.1 What it shows
Donor/acceptor diabatic parabolas vs reaction coordinate q; crossing-point activation energy
`E_a = (ΔG+λ)²/4λ`; cavity-shifted polariton parabolas whose crossing **moves with N** — making the
barrier-less turnover visible **in coordinate space**.

### 9.2 Render approach & AVOID
Two intersecting harmonic parabolas (**reactant blue, product orange**) vs q from `diabats()`; crossing
marked with `E_a` (`activationBarrier(dG, λ)`) annotated. Add `|+,0>/|-,0>` polariton parabolas
color-coded by coupling/N (colorbar) per the Huo ET figure; as N → N_max the polariton-acceptor crossing
drops to zero (barrier-less) — the **same event** the rate-vs-N turnover marks, shown geometrically.
Optional **JC (symmetric, no DSE) vs Pauli-Fierz (asymmetric, with dipole self-energy)** toggle to show
the DSE effect (a headline result the field insists must not be dropped).
Sources: `diabats()`, `activationBarrier()`, `marcusRateEa()`, `polaritonEnergies()`. No new core code.
**AVOID:** dropping the DSE silently (turns Pauli-Fierz into Jaynes-Cummings); a glowing ball sliding on a stick.

---

## 10. GEOMETRY SCHEMATIC — the canonical "panel-a" Fabry-Perot microcavity (flat line-art)

**Directly-verified template:** Fig 1(a) of Ribeiro/Yuen-Zhou arXiv:1802.08681. Reskin
`src/three/FabryPerotCavity.tsx` + `Mirror.tsx` away from specular iridescent `meshPhysicalMaterial`
(iridescence=1, clearcoat=1, emissive rims) toward **flat / line shading**. Draw as line-art, **not** a
glossy 3D render.

### 10.1 Exact composition
1. **Two mirrors as thin parallel SLABS** in light isometric / tilted-into-page perspective,
   flat-shaded with thin outlines — abstract plain slabs (as in 1802.08681) **OR** a few-stripe λ/4 DBR
   stack if the Bragg mirror matters; pick **one** and stay consistent. **Not** polished glass dishes.
   Kill `UnrealBloom`; kill the `autoRotate` turntable (`autoRotateSpeed 0.35`). Default to a still
   near-orthographic view; motion comes from physics.
2. **Cavity length L** labeled at the **bottom** between the slabs with a horizontal **double-headed arrow**.
3. **One incident ray** = a single straight **PURPLE** arrow from the upper-left, with the angle **θ**
   marked between the ray and the **mirror normal** as a small arc labeled θ. **This θ is the SAME
   variable as the hero dispersion's x-axis** — wire the visible ray angle to the dispersion cursor so
   dragging θ moves both. Decompose k explicitly: in-plane `k‖ = k0·sinθ` (= dispersion x-axis) and
   out-of-plane `k_z = Mπ/L` (quantized). State `k‖ = (E/ħc) sinθ`.
4. **Polarization basis, literal:** **TE** labeled **RED** next to an **encircled-cross glyph** (circle
   with an X = field out of the plane of incidence, along n_q); **TM** labeled **BLUE** with in-plane
   vectors showing the e_q and e_z components. **Do NOT invert this** (TE ⟂ plane of incidence, TM in it —
   reversing it is a real error).
5. **Inside the gap:** the green standing-wave lobes (the §7 |E|² view), antinode count = real mode index
   M, plus explicit **ball-and-stick molecules** (gray C, white H) scattered in the volume for the
   collective/multimode variant. Toggle **"show molecules"** to switch the abstract single-mode slab view
   (empty gap, one dispersion curve) vs the molecules-filled multimode view (anticrossing UP/LP) —
   mirroring Fig 1 vs Fig 3 of 1802.08681. The reacting donor-acceptor pair gets a transition-dipole arrow;
   orbitals (if shown) use **orange(+)/blue(−) isosurfaces**.
6. **Small LOCAL basis triad** at lower-left: three short arrows labeled **e_q, n_q, e_z** (z =
   cavity-confinement / mirror-normal axis) — **not** a giant global XYZ gizmo.

### 10.2 Color grammar (fixed; reuse verbatim across geometry AND every plot panel)
**PURPLE** = incident light / photon / polariton · **RED** = TE / cavity-mode / exciton character ·
**BLUE** = TM / photon character · **GREEN** = in-cavity field vectors · dashed bare-cavity (red/gray
diagonal) + dashed bare-exciton (orange/gray horizontal). Consistency between the geometry panel and the
dispersion panel **is itself the convention**.

### 10.3 Plasmonic toggle
Swap the Fabry-Perot slabs for a **nanostructure outline with a polarization arrow** and show the SPP
dispersion + near-field map (§8) instead of the standing-wave-in-a-stack.

### 10.4 What to AVOID
Glossy/reflective/specular mirrors; bloom; PBR glass/metal; the incident ray normal to the mirrors (the
oblique-incidence-→-in-plane-momentum mapping is the whole point); inverting TE/TM; mixing plain-slab and
DBR-stripe styles inconsistently; a giant XYZ gizmo instead of the local (e_q, n_q, e_z) triad.

---

## 11. Engine-function inventory (what exists vs what's new)

**Already exists — drive views with zero new physics:**
`polaritonBranches`, `cavityDispersion`, `hopfield`, `detuning`, `angleToK` (`microcavity.ts`);
`collectiveCoupling`, `rabiSplitting`, `darkStateCount`, `jcSplitting` (`collective.ts`);
`polaritonEnergies`, `mixingAngle`, `effectiveCouplings`, `nMax`, `darkStateCountC`, `etRateVsN` (`htc.ts`);
`marcusRateEa`, `marcusRate`, `activationBarrier`, `diabats` (`marcus.ts`);
`linspace`, `logspace`, `argmax` (`index.ts`). Defaults: `DEFAULT_MICROCAVITY`, `DEFAULT_HTC`.

**New functions needed (small; all reuse the existing 2×2 eigensolver and analytic style):**
1. `dispersionVsAngle(thetaDeg[], {Ecav0, Eexc, mcav, V, n})` — twin-axis hero (§2.5).
2. `polaritonPES(q[], {diabat params, omega_c, V})` — CQED-CI-style LP/UP surfaces (§5.3).
3. `sppDispersion(omega[], {omega_p, eps_d, gamma})` + `drudeEps(...)` — SPP branch (§8.3).
4. `standingWaveProfile(z[], {M, L})` — |E|²(z), antinode count = real mode index M (§7.3).

**Correctness / honesty guards (each a unit-test invariant):** hero gap = exactly 2V at resonance,
collapses to 0 as V→0; Hopfield |X|²+|C|²=1, cross 0.5 at δ=0; √(N−1) collective splitting; N_max golden
1636/10785 (keep `1 + (ħω_c·E_AD)/T²`); dark states pinned at bare energy between LP/UP, count N−2 (C) /
N−1 (B); angleToK/cavityDispersion 1e9 unit chain consistent.

**Keep (genuinely good, don't rebuild):** the three engine-driven sliders (ħω_c, N log, T01),
guided/expert narration, Fabry-Perot ⇄ plasmonic toggle, the 3-step journey, the verified engine +
vitest golden tests. Add hover-readouts + CSV/PNG export.

**Every-pixel test:** *"Can I read a number off this, and does it follow a convention an expert has seen
in a paper?"*

---

## 12. Citation spine

- **Dispersion + Hopfield:** Houdré et al. PRL 73, 2043 (1994); Deng–Haug–Yamamoto RMP 82, 1489 (2010);
  Carusotto–Ciuti RMP 85, 299 (2013).
- **Geometry panel-a, TE/TM, twin axis:** Ribeiro/Martinez-Martinez/Du/Campos-Gonzalez-Angulo/Yuen-Zhou,
  arXiv:1802.08681.
- **PoPES, dashed-bare/solid-coupled, photon/exciton character, DSE/JC distinction:** FoleyLab/qed-ci
  (github.com/FoleyLab/qed-ci); Foley/McTague/DePrince, *Ab initio methods for polariton chemistry*,
  Chem. Phys. Rev. 4, 041301 (2023) = arXiv:2307.04881; Galego/Garcia-Vidal/Feist, arXiv:1506.03331,
  arXiv:1606.04684.
- **HTC turnover money shot:** Sharma & Chen, J. Chem. Phys. 161, 104102 (2024) = arXiv:2406.17101.
- **SPP dispersion + field-map conventions:** COMSOL SPP model 119251,
  comsol.com/blogs/modeling-surface-plasmon-polaritons-in-comsol.
- **Field-map colormap grammar (signed↔diverging / unsigned↔sequential):** MEEP
  (meep.readthedocs.io/en/latest/Python_Tutorials/Basics/), QuTiP `wigner_cmap`
  (qutip.org/docs/4.7/guide/guide-visualization.html).
- **Polariton-graph density+arrows / FM-blue/AFM-red convention:** Berloff/Lagoudakis NJP 19, 125008
  (2017) = arXiv:1709.05498; Berloff et al. Nature Materials 16, 1120 (2017) = arXiv:1607.06065.

---

## SUMMARY (6 lines)

1. The hero is the **live angle-resolved dispersion E(θ)/E(k‖)** — four curves (dashed bare cavity +
   exciton, solid LP/UP), twin angle/k axis, on a **true eV axis** so the rendered gap is the meV Rabi
   splitting; LP/UP painted by Hopfield photon fraction (red↔blue) so character shows in the curve.
2. Two non-interchangeable grammars: **classical field-map** (3D cavity, |E|², SPP) vs
   **quantitative-plot** (dispersion, Hopfield, turnover, PoPES, ladder); the universal rule is
   **diverging colormap for signed fields, sequential for |E|² intensity**, always with reference lines.
3. Co-heroes beside the dispersion: the **HTC rate-vs-N turnover** (log-log, gold curve, magenta N_max
   marker at 1636/10785) and the **qed-ci PoPES** (LP/UP surfaces vs bond length, character-colored,
   dashed bare references).
4. The geometry schematic is **flat line-art** (Yuen-Zhou panel-a): two matte slabs, purple incident ray
   at angle θ wired to the dispersion x-axis, k decomposed into k‖/k_z, TE(red encircled-cross)/TM(blue
   in-plane), L double-arrow, local e_q/n_q/e_z triad.
5. Kill every AI-slop tell: no bloom, no glossy iridescent mirrors, no teal/magenta neon on black, no
   auto-rotate, no floating glowing equations, no fake `*0.055` pixel axis — light backgrounds, real units,
   matte DBR, physics-driven motion, static typeset equations, true energy axes.
6. Everything renders a **computed** object from `engine/*.ts`; four small new helpers
   (`dispersionVsAngle`, `polaritonPES`, `sppDispersion`+`drudeEps`, `standingWaveProfile`) reuse the
   validated 2×2 eigensolver; every pixel must pass *"can I read a number off this, and is it a
   convention an expert has seen in a paper?"*

**Path:** `/Users/dhruvjain/polariton-research/sim/docs/VISUAL-SPEC.md`
