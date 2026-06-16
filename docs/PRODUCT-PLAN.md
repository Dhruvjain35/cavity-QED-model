# Product plan — research-grade cavity-QED tool (grounded, June 2026)

Synthesized from an 8-agent cited research pass (`weekbzr3u`) on how real cavity-QED /
polariton tools are built, what makes them credible vs slop, the Chen-group physics, and
honest in-browser 3D feasibility. This supersedes the "generic cavity-QED dashboard" framing.

> **Scope (Dhruv, June 15):** this is a **general** cavity-QED / polariton-chemistry / ML platform
> for the whole research realm — Shravan's group is *one* user, not the only use case — with real,
> credible, non-photoreal visuals (must not look AI-generated). The Sharma & Chen N_max turnover
> below is **one flagship feature, not the whole product**: it sits alongside general strong-coupling
> / dispersion / Lindblad / Wigner / collective-disorder physics and the physics-informed
> ML-surrogate dimension. Read the per-paper MVP below as the *first* flagship, then generalize.

## The core reframe

The current tool is rigorous but **generic textbook cavity-QED** — not the Chen group's
research. To be *used by the Chen group* and to be a real MIT spike, the headline must become
**their physics**: the Sharma & Chen 2024 non-monotonic N-dependence of cavity-modified
electron transfer (the N_max turnover; 1636 absorption / 10785 emission), made **interactive**
on the validated engine we already have (the TS HTC/Marcus engine, 23 tests + the Rust→WASM
cavity-QED core, QuTiP-validated to ~1e-16).

Credibility lives in the **validated engine + standardized scientific visualization + a
writeup/paper + the collaboration** — *never* in photoreal graphics.

## The precedent to copy: Quantum Flytrap "Virtual Lab"

`quantumflytrap.com/virtual-lab` — a browser, no-code quantum-optics simulator researchers
respect. It is credible because of: (1) a **peer-reviewed paper** (Migdal et al., Optical
Engineering 61(8) 081808, 2022; arXiv:2203.13300); (2) a **real validated numeric engine**
underneath; (3) **standardized physics viz** (ket notation, operator heatmaps), not decorative
3D; (4) drag-and-drop interaction. That is the template. (QuTiP's own browser tools —
`qutip-virtual-lab`, `try-qutip.html` — confirm the genre and that credible quantum viz =
Bloch/Wigner/Hinton/dynamics, never a glossy 3D cavity.)

## The 3D verdict (honest, grounded)

**No respected cavity-QED/polariton tool leans on photoreal 3D.** A glossy raymarched
volumetric "cavity" is the *lowest credibility-per-effort path and the easiest to read as
AI-slop*. Smoke/fog scattering is *physically wrong* for a coherent sin² standing-wave mode —
it renders the mode as glowing fog, which is precisely the slop tell. That is why the last 3D
read as slop: the whole approach is slop-bait. So **3D is OUT of the MVP.**

The *one* credible form of 3D, if added later (Tier-2), is a **stylized-but-literal 2.5D
technical cross-section that is a RENDER OF THE COMPUTED FIELD**, grounded in three references:
1. **COMSOL DBR look** — the mirror is a visible *stack of discrete λ/4n quarter-wave layers*
   drawn to **true sub-micron scale with a labeled nm axis**. (Wrong scale is the #1 physicist
   tell: a real λ/2 organic cavity gap is ~125–140 nm between ~70–105 nm layers — NOT a glowing
   cathedral.)
2. **The field = transfer-matrix |E(z)|²** over that real stack: antinode count tied to the true
   k_z = Mπ/L, exponential decay into the mirrors, colored by the colormap law (diverging RdBu
   for signed E, sequential viridis for |E|²) with a labeled colorbar.
3. **QuteMol render recipe** — ambient occlusion (SSAO/N8AO) + depth-aware silhouette outlines +
   matte material (roughness ~0.7, metalness 0). Explicitly **NO bloom, NO iridescent/clearcoat
   mirrors, NO teal-magenta-neon, NO auto-rotate, NO floating glowing Hamiltonian.** Motion comes
   from the physics changing under a slider, not the camera. (This is the Foley TOC-figure
   grammar executed with the QuteMol recipe.)

## MVP — the smallest genuinely-useful + impressive build

A single shareable URL making Sharma & Chen 2024's headline result interactive, on the
already-validated engine. **2D heroes only; no 3D.**

1. **The N_max turnover (money shot)** — rate-vs-N on log–log reproducing Fig 2: RED Path-b,
   BLUE non-monotonic Path-c, GREY-DASHED dark-state/PR rate, BLACK baseline = 1, BLACK-DOTTED
   N_max. N_max is **computed from the engine** (never hardcoded), and the dimensionless turnover
   group (N−1)|T01|²/(ħω_c·E_AD) is shown hitting exactly 1.
2. **Polariton dispersion E(θ)/E(k‖)** — the object that says "cavity QED" to a physicist:
   dashed bare cavity + exciton, solid LP/UP painted by Hopfield photon fraction, true-eV gap,
   detuning + 2V sliders, with the V=0 → branches-land-on-bare-crossing invariant visible.
3. **Quantum-yield-vs-N** (Fig 3 grammar) — black total / red-dashed QY_b / blue-dashed QY_c with
   the linear-in-N Dicke reference line: the "large-N problem" made visual.
4. **Honest controls** — sliders expose ONLY real inputs (ω_c, Δ, H_AD, t_AD, ω_v, E_AD, E_r, T,
   σ disorder); the four couplings T00..T11 are DERIVED (Franck-Condon) and shown read-only.
5. **The bridge** (keep) — click an arrowhead eigenstate → its cavity-reduced Wigner (validated).
6. **"Verify the engine" drawer** — live golden values (N_max 1636/10785, √(N−1) Rabi, θ=π/4 at
   resonance, cat negativity −0.2330): a one-glance audit no slop demo has.
7. **Shareable-URL parameter state + CSV/PNG export.**
8. **Disorder σ slider** (already supported by the Rust arrowhead) — the frontier direction.

## The credibility / spike path (time-sensitive)

- **Make the repo public NOW with genuine, spread-out, student-authored commits.** JOSS has a
  HARD 6-month public-development-history gate + an automated commit-distribution check + a
  mandatory AI-use disclosure. A single mid-June-2026 commit dump is **disqualifying and is itself
  the AI-slop tell.** The current mid-June file clustering is a real risk — start the public history
  immediately and disclose AI use honestly.
- **The interview-proof narrative:** "I found a units inconsistency in a J. Chem. Phys. paper and
  built the validated tool that proves it" — the N_max correction (N_max = 1 + ħω_c·E_AD/|T01|²;
  the printed Eq.44 only holds because the paper sets E_AD = 1 eV). The student must be able to
  explain the Marcus inverted regime and this correction **by hand** — genuine authorship is the
  only thing that survives a technical interviewer.
- **Citable homes:** JOSS or JORS (no endorsement wall) — or an **arXiv preprint co-authored with
  the Chen group** (a HS student cannot post unendorsed; the collaboration is the unlock).

## Top risks (from the research)

1. **Adoption is gated on people, not code** — "usable by the Chen group" depends on Shravan/Chen
   actually using/blessing it. Lead with reproducing *their* figure + surfacing the corrected N_max
   formula (a concrete reason to open it); confirm with Shravan before claiming adoption.
2. **Physics fidelity** — the N_max numbers and units correction rest on locally-validated notes,
   not an independently re-extracted primary quote (arXiv PDF captions weren't fetchable). **Read
   Sharma & Chen Fig 1–4 firsthand and confirm exact ranges/units before hardcoding any default.**
3. **Scope creep** — do NOT try to become a general open-quantum solver (loses to QuTiP and the
   group's own MQED-QD). v1 single-mode + σ disorder; multimode is a deliberately-scoped v2.
4. **3D-slop temptation** — the old `.impeccable.md` brief (bloom, gold glow, dark-bg, floating
   LaTeX) is the exact slop signature. Ship zero 3D in the MVP; if added, obey the COMSOL/TMM/
   QuteMol recipe strictly.
