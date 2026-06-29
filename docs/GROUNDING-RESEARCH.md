# Grounding Research: source-cited reference for the cavity-QED lab

Source-cited reference compiled from primary literature, library source code, and standard texts. Every load-bearing
claim was checked by two skeptical lenses (find-primary-source / try-to-refute). Status legend:

- **[VERIFIED]** confirmed against a primary source (paper, library source, standard text).
- **[FLAGGED]** plausible but only secondary sources reached; do not hard-code without confirming.
- **[REFUTED]** the claim as originally stated is wrong; the correction is given.
- **[PENDING]** (Notre Dame) a literature default to be replaced by Shravan's lab constants.

No value in this reference is asserted from memory. Numbers below carry their source
URL; where a value could not be sourced, it is flagged, not asserted.

---

## §1 Wigner rendering (the visual ground truth)

**[VERIFIED]** **matplotlib `RdBu` midpoint is light gray #F7F7F7 = (247,247,247), NOT pure white.**
Verified three independent ways: matplotlib `lib/matplotlib/_cm.py` `_RdBu_data`, the official
`colorbrewer2.org/export/colorbrewer.json` RdBu-11 array, and a local matplotlib 3.10.9 run. The
ramp never reaches (255,255,255); max red channel across the LUT is 253. The 11 anchors
(red end → blue end): (103,0,31) (178,24,43) (214,96,77) (244,165,130) (253,219,199)
**(247,247,247)** (209,229,240) (146,197,222) (67,147,195) (33,102,172) (5,48,97).
→ *Sources:* `raw.githubusercontent.com/matplotlib/matplotlib/main/lib/matplotlib/_cm.py`,
`colorbrewer2.org/export/colorbrewer.json`.
→ **Action taken:** `wasm/src/wigner.rs` colormap rewritten from a red→white→blue ramp to the
true 11-anchor RdBu LUT; vacuum-gate test now asserts the (247,247,247) background.

**[VERIFIED]** **QuTiP `plot_wigner` default = `cm.RdBu` under a symmetric norm `Normalize(-max|W|, +max|W|)`.**
Verified against the actual QuTiP 5.3.0 source in this repo's venv
(`golden/.venv/.../qutip/visualization.py`) and GitHub master: `wlim = max(abs(W).max(), wlim)`,
`norm = Normalize(-wlim, wlim)`, `cmap = _diverging_cmap()` → `cm.RdBu` (or `cm.seismic` in
colorblind-safe mode), drawn with `contourf(..., 100, norm=norm, cmap=cmap)`. So **W=0 → gray
midpoint, negative W → red, positive W → blue**, which matches the desired "negative = red =
non-classical" convention. *No colorbar by default* (`colorbar=False`); default grid `linspace(-7.5,
7.5, 200)`. → *Source:* `qutip.readthedocs.io/en/latest/_modules/qutip/visualization.html`.
→ Empirically confirmed orientation from the anchors: W=−1/π→(103,0,31), W=0→(247,247,247),
W=+1/π→(5,48,97).

**[VERIFIED]** **QuTiP quadrature convention: g = √2, α = ½·g·(x+iy) = (x+iy)/√2, ħ = 1.** Our validated core
uses g=√2, so the grid coordinates are the **quadratures x, p** (label the axes `x`, `p`, not
`Re α`/`Im α`; under g=√2 a coherent state |α₀⟩ sits at x=√2·Re α₀, off by √2 from α). To make
axis values equal Re/Im α directly you'd need g=2. → *Source:* `qutip.org/docs/4.7/modules/qutip/wigner.html` (QuTiP issue #1112 documents the √2 offset).

**[VERIFIED]** **max|W| for the vacuum / any coherent state = 1/π.** Confirms `w_max = 1/π` as the physical
fixed scale. Strawberry Fields hard-codes its Wigner range to ±1/π for the same reason.
→ *Source:* `github.com/XanaduAI/strawberryfields/blob/master/strawberryfields/plot.py`.

---

## §2 Collective spectrum (the arrowhead view)

**[VERIFIED]** **Single-excitation Tavis-Cummings = an (M+1)×(M+1) arrowhead matrix.** Basis
{|1 photon, all ground⟩} ∪ {|0 photon, emitter i excited⟩}; ω_c on the corner, bare ω_i down the
diagonal, couplings g_i along the one coupled row/column. Eigenvalues **interlace** the bare
energies, pushing the two outer ones out as polaritons. → *Sources:* arXiv:2003.07179,
arXiv:2312.03833, "Large Random Arrowhead Matrices" (ResearchGate 351685474).

**[VERIFIED]** **Collective vacuum Rabi splitting Ω_R = 2·g·√M** (full peak-to-peak, on resonance, identical
emitters; half-splitting = g√M). Off-resonance: √(Δ² + 4g²M). Reduces to the 2g Jaynes-Cummings
splitting at M=1. **Convention trap:** the factor of 2 holds only when g
is the per-emitter bilinear coupling ħg(σ⁺a + h.c.); if a paper defines its "g" or "Rabi
frequency" as the full splitting, there is no extra 2. Always state the definition.
→ *Sources:* Tavis & Cummings, Phys. Rev. 170, 379 (1968); Mandal et al., Chem. Rev. (PMC10450711),
Eqs. 14–18; arXiv:2503.22354.

**[VERIFIED]** **Exactly M−1 dark states + 2 bright polaritons** in the single-excitation manifold of M
*identical* emitters; the M−1 dark states are degenerate at the bare emitter energy and decouple
from the cavity (total (M−1)+2 = M+1). Disorder lifts the degeneracy and gives them weak photonic
character but the count stays M−1. → *Sources:* arXiv:2504.20798 ("the well-known LP and UP states
and a set of N−1 dark states"); arXiv:2208.11990; arXiv:2111.08394 (notes the *identical-emitter*
qualifier is essential).

**[VERIFIED]** **Hopfield coefficients:** |C|² (photon) + |X|² (matter) = 1; at zero detuning each polariton is
50/50. |X|² = ½(1 + Δ/√(Δ² + Ω_R²)). Concept from Hopfield, Phys. Rev. 112, 1555 (1958).
→ *Sources:* arXiv:2503.13613, nature.com/articles/srep12020.

---

## §3 Disorder physics (the disorder slider)

**[VERIFIED]** **Model:** Gaussian (diagonal/energetic) disorder: emitter frequencies ω_i ~ N(ω₀, σ²). Slider
variable is σ, best expressed as the ratio **σ/Ω_R**. → *Sources:* arXiv:2202.06643 (Gera-Sebastian),
Engelhardt-Cao Comm. Chem. 2022 (PMC9814737, s42004-022-00660-0).

**[VERIFIED]** **Polaritons are robust; the gap slightly *widens* with disorder** by ≈ 2σ²/(√N·|Ṽ|) ~ σ²/Ω_R
(it does *not* shrink). → *Source:* arXiv:2202.06643.

**[VERIFIED]** **Dark states "turn grey":** they borrow oscillator strength / photonic character as σ grows
(weak when Ω_R ≫ σ). The dark band acquires width ~ σ; at large disorder the polaritons collapse
back toward the bare cavity energy (strong→weak-coupling crossover). → *Sources:* arXiv:2202.06643,
arXiv:2208.11990 (PRA 106, 063720).

**[FLAGGED]** **Delocalization criterion Ω_R/(4σ) ≥ 1 (full), Ω_R/(3σ) ≥ 1 (partial).** The *ratio* governs
delocalization, but the exact multiplier is metric-dependent (nIPR with a chosen cutoff): present
"Ω_R must be a few × σ," not a universal constant. Dark states are *semilocalized* over ~2–4
molecules in single-mode/1D models. → *Sources:* PMC11817099, arXiv:2505.15153, jpcc.5c00479.

**[VERIFIED]** **Motional/exchange narrowing (Houdré 1996):** collective coupling to one shared mode averages
out inhomogeneous broadening, so the polariton linewidth can be *narrower* than the bare
distribution and the splitting size is unchanged. **[FLAGGED]** The Houdré 1996 full text (PRA 53, 2711) was
paywalled (403); confirmed via its title and multiple secondary restatements, not verbatim.
Distinct mechanism: Whittaker 1996 (PRL 77, 4792) real-space small-mass motional narrowing; don't
conflate the two in the UI. → *Sources:* journals.aps.org/pra/abstract/10.1103/PhysRevA.53.2711,
arXiv:2310.13860 (Kubo-Anderson quantitative theory), 10.1021/acs.jpclett.3c03217 (α = σ/Ω_R).

**[REFUTED]** **Scope correction: Sharma & Chen 2024 (arXiv:2406.17101) is SINGLE-MODE with HOMOGENEOUS
disorder**, a non-adiabatic electron-transfer model. It is *not* multimode and *not* a static-energy-
disorder study. Its result is a **non-monotonic (rise-then-turnover) dependence of the cavity-modified
ET rate on molecule number N** (N_max^I=1636, N_max^II=10785), with the N−1 non-reacting molecules
forming the dark-state reservoir. The multimode + energetic-disorder physics for the slider must be
sourced from *other* papers (Engelhardt-Cao multimode; Gera-Sebastian; the 3D dark-state paper), not
from Sharma-Chen. → *Source:* arXiv:2406.17101 (full text).

---

## §4 Cavity geometry → κ map (configurator)

**[REFUTED]** **`κ ≈ c(1−R)/(2nL)` is NOT the energy decay rate, and is NOT equal to 2π·FSR/F.**
This is a factor-of-2 error in the common high-R approximation. Our Lindblad κ is the
**energy/FWHM** rate (L=√κ·a makes ⟨a†a⟩ decay at κ; τ=1/κ; Q=ω/κ; confirmed against
the Aspelmeyer RMP convention). The correct self-consistent forms:

| quantity | high-R form | exact (equal mirrors) |
|---|---|---|
| **energy / FWHM rate κ** (our convention) | **κ ≈ c(1−R)/(nL)** | κ = −c·ln R/(nL) = (πc/nL)/F |
| finesse F | F ≈ π/(1−R) | F = π√R/(1−R) |
| amplitude / HWHM rate | κ/2 ≈ c(1−R)/(2nL) | N/A |

So `c(1−R)/(2nL)` is the **amplitude (field) rate**, exactly half of what feeds our master
equation. The configurator must use **κ = c(1−R)/(nL)** (or the exact −c·ln R/(nL)). FSR = c/(2nL),
Q = ω_c/κ. Numerical check (R=0.99, n=1.5, L=1mm): exact κ = 2.009×10⁹ s⁻¹ = c(1−R)/(nL);
c(1−R)/(2nL) = 9.99×10⁸ (half). → *Sources:* Aspelmeyer/Kippenberg/Marquardt, Cavity Optomechanics,
RMP 86, 1391 (2014) = arXiv:1303.0733 (defines κ = energy decay, amplitude = κ/2; F = Δω_FSR/κ);
Wikipedia Fabry-Pérot (Airy finesse, Lorentzian finesse −2π/ln(R₁R₂)); rp-photonics.com/finesse.html.

**[PENDING]** The 1/(2nL)-vs-1/(nL) prefactor, and whether one or both mirrors are lossy, and whether L is the
physical gap, must be pinned against the Notre Dame cavity bookkeeping. Index n enters only via FSR
(intracavity medium); for an air cavity n=1.

---

## §5 Material presets (literature defaults **[PENDING]** pending Shravan)

Order-of-magnitude regime contrast is **[VERIFIED]**; the trade-off follows from g ∝ 1/√V with the
strong-coupling condition 2g > {κ, γ}. Specific numbers are cited defaults, **not** universal
constants, to be replaced by the lab's measured values.

| regime | coupling / Rabi splitting | cavity Q | emitter γ | source |
|---|---|---|---|---|
| **Organic** microcavity (J-aggregate/dye) | full Ω_R ≈ 80–265 meV (Lidzey 1998: **160 meV**; up to ~500 meV) | **[FLAGGED]** ~10–100 (metal), ~325 (DBR) | **[FLAGGED]** ~40 meV | nature.com/articles/25692; Lidzey 1999 PRL 82, 3316 |
| **Inorganic** GaAs/InGaAs DBR | Ω_R ≈ **4–15 meV** (Cilibrizzi ~8; RT 12.3–15.2) | ~4×10³–5.4×10⁴ (up to 10⁶) | 0.05–5 meV (cryo) | arXiv:1407.6535, arXiv:2502.12338, Weisbuch PRL 69, 3314 |
| **Plasmonic** NPoM nanocavity | g ≈ **90–305 meV** (Chikkaraddy: 305±8 for ~10 mol., 90 single) | ~5–10 (to ~60) | γ̄ ~120 meV | Chikkaraddy, Nature 535, 127 (2016); s41467-024-51170-7 |

**[FLAGGED]** Organic Q (~100) and exciton γ (~40 meV) came from secondary summaries. Confirm against a
primary TDBC-in-cavity paper before hard-coding. Keep the **g vs full-splitting** distinction
straight (Chikkaraddy's 305 meV is g; many papers quote 2g).

---

## §6 Polariton figure conventions (the spectrum view)

**[REFUTED]** **Correction: neither cited paper has an angle-resolved dispersion plot.** "Lagoudakis 2017
NJP 19 125008" is the *polariton graph simulator* (3 figures, no E-vs-k anticrossing).
Sharma-Chen 2024 has 4 figures: PES diagrams (donor black / acceptor blue / polariton red / dark
grey-dashed), a log-log rate-vs-N plot, a log-log quantum-yield-vs-N plot (linear-in-N Dicke
scaling then turnover), and a QY heatmap (hot/afmhot-style colormap). Dispersion conventions below
are sourced from *other* authoritative figures. → *Sources:* iopscience 10.1088/1367-2630/aa924b,
arXiv:2406.17101.

**[VERIFIED]** **Dispersion plot:** Energy (**eV**) on y; angle θ (deg) or in-plane wavevector k∥ on x
(k∥ = (E/ħc)·sinθ). Bare cavity = dashed parabola, bare exciton = dashed horizontal line, crossing
at resonance; UP/LP = solid anticrossing branches separated by ħΩ_R, where
E_LP/UP = ½(E_ph+E_ex) ∓ ½√((E_ph−E_ex)² + (ħΩ_R)²). → *Sources:* Rana et al. arXiv:1809.01508
(Fig 3); Ribeiro/Yuen-Zhou Chem. Sci. 9, 6325 (2018) PMC6115696; Houdré PRL 73, 2043 (1994).

**[VERIFIED]** **Intensity maps:** reflectivity/PL shown as a sequential colormap (modern: viridis; historic:
jet, now discouraged) with the computed polariton branches overlaid as dashed lines (white for
reflectivity minima, blue for the LP in PL). No single mandated colormap. → *Sources:*
arXiv:1809.01508, bids.github.io/colormap, PLOS ONE 10.1371/journal.pone.0199239.

---

## §7 Instrument aesthetic ("PRL journal figure")

All **[VERIFIED]** from the APS PRL "Information for Contributors" + Physical Review Style Guide (Wayback
2023 snapshot; rules stable for years) and matplotlib source:

- **Line weight** ≥ 0.5 pt (0.18 mm) final. **Column width** 8.6 cm single / 17.8 cm double; aspect
  ~1.3:1 reads as "one PRL column." **600 dpi** output (use 2–3× devicePixelRatio canvas).
- **Axis labels** = `Quantity (unit)` with a space before the parenthesis. **Tick labels** integers
  or nice steps, `0.2` not `.2`, uniform decimals. **Panel labels** lowercase parenthesized `(a)`
  `(b)`, roman upright, top-left.
- **White background, black axes/text, max contrast;** differentiate with line style + marker, not
  color alone (color is print-extra). → *Source:* PRL Info for Contributors,
  `cdn.journals.aps.org/files/styleguide-pr.pdf`.
- **matplotlib default look** = white bg, no grid, ticks-out, only left/bottom spines, DejaVu Sans
  10 pt, viridis. The **tab10** cycle starts blue **#1f77b4**, orange **#ff7f0e**, green #2ca02c,
  red #d62728; reusing #1f77b4/#ff7f0e for the first two traces is the single strongest "this is a
  real scientific plot" tell. → *Source:* matplotlib `mpl-data/matplotlibrc`.
- Real research-tool chrome (DAMTP polgraph) = system sans, navy #000080 headings, teal #008080
  links on plain light bg: sober, not glossy. → *Source:* damtp.cam.ac.uk/user/ngb23/polgraph.html.
- **[FLAGGED]** APS does **not** mandate a figure font family (only "consistent with body text" = Computer
  Modern serif in REVTeX); serif vs sans plot lettering is convention-dependent. No tick
  direction/density rule beyond label formatting.

---

## §8 Open items to confirm with Notre Dame

1. κ bookkeeping: one vs two lossy mirrors, L = physical gap vs round-trip, intracavity n (§4).
2. The lab's measured g / Q / γ for its actual cavities + emitters, to replace §5 defaults.
3. Per-emitter g convention in their code (does g already include √N; is "Rabi splitting" 2g√N or
   g√N) (§2).
4. Whether the disorder slider should expose σ in absolute meV or as σ/Ω_R (§3).
