# BUILD-PLAN.md — Rebuilding the polariton sim into research-grade software

**Summary (6 lines):**
The engine (`engine/*.ts`, 23/23 tests) is a sound validated oracle; the failure is entirely the presentation layer, where an aesthetic R3F render owns the screen and the real physics is demoted to two 268px SVGs with a *fake* energy axis (`split = clamp(splitMeV*0.055, 2, 64)`). This plan **kills** the bloom hero, glossy iridescent mirrors, the decorative gold cylinder, the auto-rotate turntable, and the floating glowing Hamiltonian. It **builds** a live angle-resolved dispersion `E(θ)` as the centerpiece (true eV axis, dashed-bare/solid-coupled, Hopfield branch coloring), a flat line-art Fabry–Pérot schematic, quantitative field/mode maps, a co-hero HTC turnover, synced panels, plus data export + a validation mode. New engine functions: `dispersionVsAngle`, `sppDispersion`, `polaritonPES`, `standingWaveProfile`. Every pixel must pass: *can I read a number off this, and does it follow a convention an expert has seen in a paper?*
**Path: `/Users/dhruvjain/polariton-research/sim/docs/BUILD-PLAN.md`**

---

## 0. Diagnosis (why the current build reads as slop)

Read directly from the code, not inferred:

- `src/three/CavityCanvas.tsx` — `<color args={["#0d1014"]}/>` near-black bg, `Bloom intensity={1.15}` + `Vignette darkness={0.78}`, two saturated point lights (`#2bb6c6` intensity 28, `#ff5fb6` intensity 22) + 4 `Lightformer`s, and `OrbitControls autoRotate autoRotateSpeed={0.35}` — the turntable is the single strongest "AI product render" tell.
- `src/three/Mirror.tsx` — iridescent `meshPhysicalMaterial` (iridescence=1, clearcoat=1) with emissive glowing rims: glossy chrome, not a matte DBR stack.
- `src/three/PhotonField.tsx` — additive-blended gold cylinder shader with `sin(uTime*2.2)` over-brightness purely to feed bloom: decorative, not a computed mode.
- `src/App.tsx` (overlay-tr `.hamiltonian`) — floating glowing equations layered over the 3D scene.
- `src/views/SidePanels.tsx` — the **only** quantitative plots, shrunk to 268px and drawn with a **fake** energy axis: `const split = clamp(data.splitMeV * 0.055, 2, 64)` (pixels, not eV). An expert sees the y-axis isn't energy.
- `src/physics/useCavity.ts` — `antinodes = Math.round(2 + c.hbar_wc * 3)` is a fake mode count untied to the real mode relation `k_z = Mπ/L`.

**Keep (genuinely good, do not rebuild):** the three engine-driven sliders (`ℏω_c`, `N` log, `T₀₁`), guided/expert narration, Fabry–Pérot↔plasmonic toggle, the 3-step journey, the verified engine + vitest golden tests. The rejection is a re-skin + re-prioritize of `src/three/*`, `src/views/*`, and `App.tsx` styling — **not** an engine rewrite.

---

## 1. KILL list (delete or gut)

| Target | File | Action |
|---|---|---|
| `UnrealBloom` + `Vignette` dominant look | `three/CavityCanvas.tsx` | Remove `EffectComposer`/`Bloom`/`Vignette`. |
| Auto-rotate turntable | `three/CavityCanvas.tsx` | Delete `autoRotate`/`autoRotateSpeed`; default to a still near-orthographic camera; orbit only on user drag. |
| Saturated teal/magenta point lights + 4 Lightformers on `#0d1014` | `three/CavityCanvas.tsx` | Replace with flat neutral lighting on a **light/near-white** background. |
| Glossy iridescent clearcoat mirrors + emissive rims | `three/Mirror.tsx` | Replace with matte/flat-shaded DBR slabs (or a few-stripe λ/4 stack). |
| Decorative gold standing-wave cylinder (additive + time-pulse) | `three/PhotonField.tsx` | Replace with the **computed** `|E(z)|²` field map (§4, View F). |
| Glowing hopping electron carrying the rate | `three/Molecule.tsx` | Demote to a static ball-and-stick prop; the rate physics moves to the Marcus-parabola + turnover views. |
| Floating glowing Hamiltonian overlay | `App.tsx` overlay-tr | Move to a clean static typeset block beside the figures. |
| Fake pixel energy axis `split*0.055` | `views/SidePanels.tsx` `LevelDiagram` | Replace with a true linear eV axis (the rendered gap **is** the meV splitting). |
| Fake antinode count `2 + ℏω_c*3` | `physics/useCavity.ts` | Tie antinode count to the real mode index `M` from `k_z = Mπ/L`. |
| 268px demotion of the real plots | `views/SidePanels.tsx`, `App.tsx` | Promote dispersion + turnover to full-size co-heroes. |

**Hard rules going forward:** no bloom; no auto-rotate; no neon-on-black; no floating glowing equations; no decorative volumetric glow; no arbitrary pixel→energy scale factors. Two-colormap rule for all field maps — **diverging** red-white-blue (zero-centered) for signed fields/charge, **sequential** (log if many decades) for `|E|²`/intensity — always with a labeled colorbar and reference lines.

---

## 2. BUILD list — the centerpiece and supporting views

### CENTERPIECE — View A: Live angle-resolved dispersion `E(θ)` / `E(k‖)`
The hero. Promote from the demoted SVG to full center stage. A twin-axis 2D plot, **Energy [eV]** on y vs **emission angle θ [deg, −25..+25]** on bottom x and **in-plane momentum k‖ [µm⁻¹]** on top x, carrying four curves:

1. bare cavity parabola `E_cav(k‖)` from `cavityDispersion` — **dashed** (uncoupled reference);
2. bare exciton line `E_exc = const` — **dashed**, nearly flat (mcav ≈ 3.6e-5 m_e is ~4 orders lighter than the exciton; a *curved* exciton line is a correctness failure);
3+4. coupled LP/UP branches from `polaritonBranches` — **solid**, anticrossing, minimum gap = `2V = ħΩ_R` read straight off the y-axis in meV.

- **Color = physics:** each LP/UP branch painted per-point by its Hopfield photon/exciton fraction from `hopfield(detuning(E_cav(k),Eexc), V)` — diverging gradient red `#d1495b` (excitonic) ↔ blue `#1d6f7e` (photonic), white at 0.5, so a branch visibly changes character through the anticrossing.
- **Detuning slider** `δ = E_cav0 − E_exc` slides the dashed parabola vertically through the flat exciton line, sweeping the published negative/zero/positive panel series (Deng–Haug–Yamamoto b/c/d) as one continuous motion.
- **Invariants (also unit tests):** gap = exactly `2V` at resonance; collapses to 0 as `V→0` (LP/UP land on the dashed bare crossing) — the cleanest "the splitting IS the coupling" demonstration.
- True linear eV axis (rendered gap = meV splitting), hover-readout `(θ, E_LP, E_UP, gap, photon%)`, "show bare modes" toggle, legend `UP / LP / Cavity(dashed) / Exciton(dashed)`, numeric `2V = N meV` bracket at the gap minimum.
- **"Data mode" alt-skin:** false-color PL-style sequential intensity heatmap behind the curves with dashed bare overlays, mirroring angle-resolved PL papers.
- *Reads as real because:* it is the genre-defining figure (Houdré 1994, RMP 82 1489 2010) — four curves, dashed-bare/solid-coupled, twin angle↔k axis via `k = (E/ħc)sinθ`, gap=Rabi, exciton flat, never-touching anticross. A physicist recognizes it in under a second.

### View B: Hopfield fraction companion `|X|²/|C|²` vs detuning
A small synced strip under View A. `|X|²` (red, exciton) and `|C|²` (blue, photon), both 0→1, x = `δ [meV]`, two complementary curves that **sum to 1 and cross at exactly 0.5 at δ=0**. Shares View A's colormap and updates live with the detuning slider. The Deng–Haug–Yamamoto companion panel; the sum-to-1 / cross-at-0.5 invariant is what an expert checks instantly.

### View C — MONEY SHOT: HTC ET-rate-vs-N turnover (promoted to co-hero)
Full-size, co-equal with View A. x = **molecule number N** (log 1..1e5), y = **ET rate / ordinary ET** (log). A single gold turnover curve that rises, peaks, then decays `~e^−N`; a magenta **dashed vertical at N_max** with the value labeled; a faint horizontal `baseline = ordinary ET (=1)`; a live filled marker at the slider's current N; hover `(N, relative rate)`. The non-monotonic turnover is the **discoverable** research result (Sharma & Chen 2024) — let the user drag N and watch the marker climb past the peak and collapse. Log-log real axes + a dimensionally-correct `N_max` signal research-grade honesty.

### View D: CQED-CI-style polariton potential-energy surfaces (PoPES)
LP/UP **surfaces** vs a reaction coordinate q: photon-dressed ground `V_c(q)=V_g(q)+ħω_c` hybridizing with the bare excited surface `V_e(q)`. y = **Energy [eV]** on an absolute scale (`E_ref + Ω` convention), x = **reaction coordinate q (a.u.)** / **bond length (Å)**. Dashed = bare `V_g+ħω_c` (blue dotted) and `V_e` (orange dotted); solid = coupled LP/UP painted by continuous photon↔exciton character. A coupling slider (`V`) morphs the LP minimum deeper and opens a barrier (the Galego/Feist photochemistry-suppression story). Optional: overlay bare Marcus parabolas; draw the dark-state band as a gray bundle pinned at the bare exciton energy **between** LP and UP (never above UP / below LP). This is the explicit canonical output of FoleyLab/qed-ci scan scripts.

### View E: Energy-level ladder — vacuum Rabi, √N collective splitting, dark manifold
Flat 2D vector ladder, **true eV axis** (replace `split*0.055`). LP teal, UP gold, horizontal bars whose separation **is** the meV splitting. Dark manifold = gray degenerate band of `N−2` (System C) / `N−1` (System B) levels exactly at the bare energy between LP and UP, count labeled. Bracket annotates `2√(N−1)|T₀₁|` (System C) or `2g√N` (System B); bars separate as √N live with the N slider. Optional √n JC anharmonic-ladder inset for the single-emitter limit. The dark-state manifold pinned at the bare energy between LP and UP is the field's single most load-bearing convention.

### View F: Quantitative standing-wave `|E(z)|²` field map (replaces the gold tube)
**Option A (preferred, 2D):** `|E|²` vs position z (nm) with the DBR refractive-index step profile overlaid, antinodes pinned in the defect layer, oscillating-exponential decay into the stack — a transfer-matrix-style figure. **Option B (3D cut-plane):** `|E|²` heatmap with a **sequential** colormap + labeled colorbar (enhancement numbers), thin geometry outlines — FEM-style, not glow. Signed amplitude uses diverging red-white-blue; `|E|²` uses sequential. Antinode count = real mode index M (not the fake `2+ℏω_c*3`); faster decay into the lossy mirror.

### View G: SPP dispersion + near-field (the plasmonic toggle)
For the `PlasmonicCavity` toggle, which currently has no real dispersion physics. y = **photon energy [eV]** or **ω [THz]**, x = **β [rad/m or µm⁻¹]**. Dashed straight free-space light line `ω=ck`; solid SPP branch **always to the right of** the light line, bending over and flattening toward `ω_p/√2`. Curve color encodes Q = Re(k)/Im(k); discrete simulated markers overlaid on the analytic curve (validation look). Pair with an SPP near-field map: `|E|` bound to the interface, decaying faster into the metal. The light-line + `ω_p/√2` asymptote is the instantly-recognizable SPP grammar (COMSOL model 119251).

### View H: Marcus diabatic parabolas (replaces the hopping electron)
Donor (blue) / acceptor (orange) intersecting harmonic parabolas vs q, crossing-point `E_a=(ΔG+λ)²/4λ` annotated. Add `|+,0>/|-,0>` polariton parabolas color-coded by N; as N→N_max the polariton-acceptor crossing drops to barrier-less — the **same** event View C marks, shown in coordinate space. JC (symmetric, no DSE) vs Pauli–Fierz (asymmetric, with DSE) toggle. The DSE/JC distinction is a headline result the field insists must not be dropped.

---

## 3. Geometry schematic (re-skin `FabryPerotCavity.tsx` + `Mirror.tsx`)

Draw the canonical **panel-a** as **flat line-art**, template = Fig 1(a) of Ribeiro/Yuen-Zhou arXiv:1802.08681. Reskin away from specular iridescent `meshPhysicalMaterial` toward flat/line shading.

1. **Two mirrors** as thin parallel **slabs** in light isometric perspective, flat-shaded, thin outlines — plain slabs OR a few-stripe λ/4 DBR (pick one, stay consistent). No polished glass, no bloom, no turntable; default still near-orthographic.
2. **Cavity length L** labeled at the bottom with a horizontal double-headed arrow.
3. **One incident ray** = a single straight **purple** arrow from upper-left; angle **θ** marked between ray and **mirror normal** as a small labeled arc. This θ is the **same variable** as View A's x-axis — wire the visible ray to the dispersion cursor. State `k‖ = k₀sinθ` (= dispersion x-axis) and `k_z = Mπ/L` (quantized).
4. **Polarization basis drawn literally:** **TE** in red next to an encircled-cross glyph (field out of plane of incidence, along n_q); **TM** in blue with in-plane `e_q`/`e_z` vectors. Do not invert (TE ⊥ plane of incidence, TM in it).
5. **Inside the gap:** the View F standing-wave lobes (antinode count = real M) + explicit ball-and-stick molecules (gray C, white H) for the collective variant. "Show molecules" toggles abstract single-mode (empty gap, one curve) ↔ molecules-filled multimode (anticrossing) — Fig 1 vs Fig 3 of 1802.08681. Reacting pair gets a transition-dipole arrow; orbitals (if shown) orange(+)/blue(−).
6. **Small local basis triad** lower-left (e_q, n_q, e_z; z = mirror normal) — not a giant global XYZ gizmo.

**Color grammar (fixed, reuse verbatim across geometry AND every plot):** purple = light/photon/polariton; red = TE / cavity-mode / exciton character; blue = TM / photon character; green = in-cavity field vectors; dashed bare-cavity (red/gray diagonal) + dashed bare-exciton (orange/gray horizontal). For the plasmonic toggle, swap the slabs for a nanostructure outline + polarization arrow and View G instead of View F.

---

## 4. Engine-function breakdown

### Already exists (drives most views, zero new physics)
- `microcavity.ts`: `cavityDispersion`, `polaritonBranches`, `hopfield`, `detuning`, `angleToK`.
- `collective.ts`: `collectiveCoupling`, `rabiSplitting`, `darkStateCount`, `jcSplitting`.
- `htc.ts`: `polaritonEnergies`, `mixingAngle`, `effectiveCouplings`, `nMax`, `darkStateCountC`, `etRateVsN`.
- `marcus.ts`: `marcusRateEa`, `marcusRate`, `activationBarrier`, `diabats`.
- `index.ts`: `linspace`, `logspace`, `argmax`.
- Defaults: `DEFAULT_MICROCAVITY` (Ecav0=Eexc=1.5, V=0.005 → 2V=10 meV, mcav=3.6e-5, n=3.5), `DEFAULT_HTC`.

### New functions needed (small; all reuse the existing 2×2 eigensolver / analytic style)

1. **`dispersionVsAngle(thetaDeg: number[], p: {Ecav0,Eexc,mcav,V,n})` → `{theta,kPar,ELP,EUP,Ecav,Eexc,photonFrac}[]`** (`microcavity.ts`)
   Twin-axis hero (View A). Build k‖ from θ via `E_C(θ)=E_C(0)/sqrt(1−(sinθ/n)²)` (spec A.7), then call `polaritonBranches`. **Unit guard:** `angleToK` returns m⁻¹ (×1e9) and `cavityDispersion` expects m⁻¹ — keep the chain consistent (the documented 1e9 hazard noted in `microcavity.ts`); do not feed nm⁻¹ in.

2. **`polaritonPES(q: number[], p: {E_D,E_A,omega_v,lambda_v, omega_c, V})` → `{q,ELP,EUP,photonChar}[]`** (`marcus.ts` or new `popes.ts`)
   View D. At each q build the 2×2 `[[V_g(q)+ω_c, V],[V, V_e(q)]]` (photon-dressed ground vs bare excited) and diagonalize using the **same** form as `polaritonBranches`/`polaritonEnergies`. Reuses `diabats` for `V_g`/`V_e`.

3. **`sppDispersion(omega: number[], p: {omega_p, eps_d, gamma?})` → `{omega,kReal,kImag,Q}[]`** + **`drudeEps(omega, {omega_p,gamma})`** (new `spp.ts`)
   View G. `k_SPP = k0·√(eps_d·eps_m/(eps_d+eps_m))`, Drude `eps_m(ω)=1−ω_p²/ω²`, light line `ω=ck`, asymptote `ω_p/√2`. Pure analytic, fits the engine's oracle style (`HBARC_EV_NM` already present).

4. **`standingWaveProfile(z: number[], p: {M,L,nLayers?})` → `{z, E2, indexStep}`** (new or in `microcavity.ts`)
   View F. `|E|²(z)` with antinode count = real mode index `M` from `k_z = Mπ/L`, plus the DBR index-step array. Replaces `useCavity.ts`'s fake `antinodes = 2+ℏω_c*3`.

### Wiring
Extend `physics/useCavity.ts` to expose dispersion/PES/SPP/standing-wave arrays (memoized) alongside the existing turnover. Keep the slider→engine contract; add a `delta` (detuning) control for View A and a `V`/coupling control for View D.

---

## 5. Tech approach

- **Stack:** keep React + R3F for the geometry schematic only (Views: panel-a). All quantitative plots (A,B,C,D,E,F-2D,G,H) are **2D SVG/Canvas** (D3-style scales or a thin custom plotter) — the field's language is flat quantitative 2D, and SVG gives crisp real-unit axes + hover + CSV/PNG export cheaply.
- **Plot primitive:** one reusable `<Plot>` component with linear/log scales, real tick labels + units, dashed/solid line styles, per-segment colormap painting (for Hopfield branch coloring), hover crosshair returning exact values, and PNG/CSV export. Every view is an instance of it.
- **Colormap module:** a single `colormap.ts` enforcing the two-colormap rule (diverging zero-centered vs sequential/log) + a labeled colorbar component. No view picks colors ad hoc.
- **Background/lighting:** light/near-white, flat neutral lighting; remove `EffectComposer`. Camera still + orthographic-ish; orbit only on drag.
- **Export + validation mode:** every plotted curve exports CSV/JSON with the exact parameter set that produced it. A "Verify the engine" button surfaces the vitest golden tests (N_max 1636/10785, √(N−1) Rabi scaling, mixing angle π/4 at resonance, gap=2V at resonance, |X|²+|C|²=1) as a pass/fail panel — the in-app benchmark that makes a physicist trust the tool.
- **Honesty guards (each a unit-test invariant):** View A gap = exactly 2V at resonance, → 0 as V→0; Hopfield sums to 1, crosses 0.5 at δ=0; √(N−1) collective splitting; keep `nMax = 1+(ħω_c·E_AD)/T²` (do **not** regress to the paper's dimensionally-broken printed form); dark states pinned at bare energy between LP and UP, count N−2 (C)/N−1 (B); guard the angleToK↔cavityDispersion 1e9 unit hazard.

---

## 6. Build order

1. **Plot + colormap primitives** (`<Plot>`, `colormap.ts`, colorbar, hover, CSV/PNG export). Everything downstream depends on these.
2. **New engine fns** `dispersionVsAngle`, then `standingWaveProfile`, `polaritonPES`, `sppDispersion`/`drudeEps`. Add vitest invariants for each (gap=2V, V→0 collapse, Hopfield, SPP-right-of-light-line, antinode count = M).
3. **View A (centerpiece)** dispersion `E(θ)` + **View B** Hopfield strip, wired to a new `δ` detuning slider. This single figure carries the most field-credibility — ship it first.
4. **View C** turnover promoted to co-hero (re-skin `RateMini` to full size, real log-log axes, N_max marker, live N marker). Kill the 268px demotion.
5. **View E** energy ladder with a **true eV axis** (delete `split*0.055`); **View F** `|E|²(z)` 2D field map (delete the gold cylinder; tie antinodes to M).
6. **Geometry re-skin** `FabryPerotCavity.tsx` + `Mirror.tsx` to flat line-art panel-a (θ ray wired to View A cursor, TE/TM glyphs, L arrow, basis triad, show-molecules toggle); remove bloom + auto-rotate from `CavityCanvas.tsx`; move Hamiltonian to a static typeset block.
7. **View D** PoPES + **View H** Marcus parabolas (links the abstract turnover to coordinate space; JC vs Pauli–Fierz toggle).
8. **View G** SPP dispersion + near-field for the plasmonic toggle.
9. **Validation mode** ("Verify the engine" button) + global CSV/PNG export pass.

---

## 7. Citation spine

- Dispersion + Hopfield: Houdré et al. PRL 73, 2043 (1994); Deng–Haug–Yamamoto, RMP 82, 1489 (2010), https://link.aps.org/doi/10.1103/RevModPhys.82.1489
- Geometry panel-a, TE/TM, twin axis: Ribeiro/Yuen-Zhou, arXiv:1802.08681, https://arxiv.org/abs/1802.08681
- PoPES, dashed-bare/solid-coupled, photon/exciton character coloring, DSE/JC: FoleyLab/qed-ci https://github.com/FoleyLab/qed-ci ; Foley/McTague/DePrince, "Ab initio methods for polariton chemistry," arXiv:2307.04881 ; Galego/García-Vidal/Feist, arXiv:1606.04684
- Dark-state manifold convention: Feist/Galego/García-Vidal, arXiv:1802.08681 ; Mandal/Huo/Foley Chem. Rev. 2023, https://pmc.ncbi.nlm.nih.gov/articles/PMC10450711/
- HTC turnover (money shot): Sharma & Chen, J. Chem. Phys. 161, 104102 (2024), https://arxiv.org/abs/2406.17101
- SPP dispersion + field-map conventions: COMSOL model 119251, https://www.comsol.com/model/simulation-of-metalair-surface-plasmon-polariton-propagation-and-dispersion-119251 ; blog https://www.comsol.com/blogs/modeling-surface-plasmon-polaritons-in-comsol
- Visual/colormap grammar (diverging signed vs sequential intensity): QuTiP https://qutip.org/docs/4.7/guide/guide-visualization.html ; MEEP https://meep.readthedocs.io/en/latest/Python_Tutorials/Basics/
