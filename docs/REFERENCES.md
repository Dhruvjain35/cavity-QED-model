# References: Annotated Catalog of Studied Sources

> Every real reference studied for this build, with URL, what it is, and the specific lesson
> taken into our simulation. Five primary tools were studied in depth (FoleyLab/qed-ci,
> the Foley Lab publications/render aesthetic, the COMSOL SPP model, the Cambridge/Berloff
> polariton-graph simulator, Photizon), plus the broader simulation ecosystem (QuTiP, MEEP,
> Lumerical, Tidy3D, Falstad, nanoHUB, PhET) and the cited convention figures the field
> reproduces. Accessibility/uncertainty is flagged inline with **[UNCERTAIN]** or **[INACCESSIBLE]**.
>
> Companion docs: physics in `PHYSICS-SPEC.md`, validation in `VALIDATION.md`.

---

## A. Primary tools studied in depth

### A.1 FoleyLab/qed-ci: ab initio cavity-QED configuration interaction
- **GitHub repo:** https://github.com/FoleyLab/qed-ci
- **Upstream:** https://github.com/mapol-chem/qed-ci
- **Core source (PFHamiltonianGenerator):** https://raw.githubusercontent.com/FoleyLab/qed-ci/main/src/helper_PFCI.py
- **CQED-RHF reference:** https://raw.githubusercontent.com/FoleyLab/qed-ci/main/src/helper_cqed_rhf.py
- **Bond-length scan example:** https://raw.githubusercontent.com/FoleyLab/qed-ci/main/examples/LiH_qedfci_r_scan.py
- **Reference-value tests:** https://raw.githubusercontent.com/FoleyLab/qed-ci/main/tests/test_helperPFCI.py

**What it is.** Open-source (GPL-3.0) Python research code that diagonalizes the length-gauge
Pauli-Fierz Hamiltonian (electronic H + ωb†b photon energy + bilinear −√(ω/2)(λ·μ)(b†+b) coupling
+ ½(λ·μ)² dipole self-energy) over electron-determinant × photon-number space, built on
Psi4/Psi4NumPy integrals with a C-accelerated Davidson solver. A single driver class
`PFHamiltonianGenerator(molecule_string, psi4_options, cavity_options)` runs the whole pipeline
and exposes eigenvalues (`.CIeigs`), dipoles, and RDMs as attributes. The canonical research
deliverable is a polariton potential-energy curve (state energy vs nuclear coordinate, e.g. MgH⁺
1.4–2.6 Å, ~−199.6 Eh) with lower/upper-polariton branches and Rabi-split avoided crossings.

**Lesson for our build.** This is the citation spine for our **PoPES view** (`polaritonPES`): the
field's canonical figure is energy-vs-bond-length LP/UP curves with **dashed bare references, solid
coupled branches**, energies plotted as E_ref+Ω on an **absolute eV/Hartree axis**, and a
**coupling sweep that opens a barrier**. We reuse the same 2×2 eigensolver applied along a nuclear
coordinate. Expose cavity params exactly as qed-ci does: ω, a **3-vector λ** (never a scalar:
polarization is physics), photon-number cutoff, coherent-state vs photon-number basis, CI level.
λ=[0,0,0] must reduce cleanly to bare quantum chemistry (our V→0 collapse invariant mirrors this).
Keep the **dipole self-energy**: dropping it silently turns Pauli-Fierz into Jaynes-Cummings and
gives non-gauge-invariant energies (the JC-vs-PF gap is a headline result, their Fig. 6). Match
their honesty ethic: milli-Hartree regression tests (atol~1e-4); our vitest golden values
(N_max=1636, √(N−1) Rabi) are the analog. **Do not** invent a GUI/3D "cavity" for it: the real code
has zero plotting and emits raw .npy/.json. **[UNCERTAIN]** Exact default values for some
`cavity_options` keys and a few truncated example scripts (`c10h8.py`) were inferred from the README
and sibling scripts, not directly confirmed.

### A.2 Foley Lab: publications page + group render aesthetic
- **Publications:** https://foleylab.github.io/publications/
- **Homepage:** https://foleylab.github.io/
- **Jekyll source repo:** https://github.com/foleylab/foleylab.github.io
- **Hero render (CQED-CASCI TOC):** https://raw.githubusercontent.com/foleylab/foleylab.github.io/master/images/JCTC.png
- **Gold-mirror TOC:** https://raw.githubusercontent.com/foleylab/foleylab.github.io/master/images/JCP24.png
- **Scalable-aiQED TOC (PES inset):** https://raw.githubusercontent.com/foleylab/foleylab.github.io/master/images/JCTC-kenny-nam-25.png

**What it is.** Jonathan "Jay" Foley IV's group site (HTML5-UP "Massively" Jekyll theme), whose
publication cards pair each paper with its journal graphical-abstract. The recurring TOC graphics
are the lab's signature look: **teal/cyan glassy (or gold metal) Fabry-Perot mirrors + a magenta/pink
hourglass cavity field** on a deep purple-blue (or black) background, a real ball-and-stick molecule
inside, an energy-level ladder, and the **literal Pauli-Fierz Hamiltonian + |Ψ⟩=ΣC_{I,n}|Φ_I⟩⊗|nᵖ⟩
ansatz baked into the art** in white LaTeX. Data plots follow a fixed convention: Total energy vs Bond
length, overlaid dotted curves keyed by method+active-space (e.g. QED-DMRG(12e,23o,10ph)).

**Lesson for our build.** This is the project's named aesthetic anchor, but the **forensic finding
inverts it**: the lab's own *published-figure* language is flat, data-dense 2D plots, not a cinematic
glossy hero. So we keep the **palette grammar** (teal/magenta complementary, gold only where photons
are) for the geometry schematic, but render the cavity as **flat line-art slabs**, not specular
iridescent chrome. Inherit the PES/dispersion convention (overlaid dotted curves keyed by
method+active-space) for our PoPES and dispersion panels. **[UNCERTAIN]** The exact teal/magenta/gold
"hero render" the project brief cites could not be confirmed as one canonical public image. The
3D-render look is **inference** (Blender/Cycles-class is not documented anywhere by the lab); several
site `_publications/*.md` entries are placeholder stubs, so DOIs/authors were resolved from
journal/PMC records, not the stub prose.

### A.3 COMSOL: Metal-Air Surface Plasmon Polariton Propagation and Dispersion (App ID 119251)
- **Model page:** https://www.comsol.com/model/simulation-of-metalair-surface-plasmon-polariton-propagation-and-dispersion-119251
- **Walkthrough blog (conventions/captions):** https://www.comsol.com/blogs/modeling-surface-plasmon-polaritons-in-comsol
- **Companion thin-film model (App 127161):** https://www.comsol.com/model/dispersion-of-surface-plasmon-polariton-in-thin-metal-embedded-in-dielectric-127161
- **Color-table docs:** https://doc.comsol.com/6.0/doc/com.comsol.help.comsol/comsol_ref_results.33.015.html
- **SPP theory (light line, ω_sp asymptote):** https://arxiv.org/pdf/cond-mat/0611257

**What it is.** A Wave-Optics-Module FEM tutorial that launches a TM-polarized SPP from a numeric
port at an air/silver interface, runs Boundary Mode Analysis (extracts complex β) + a Frequency-Domain
sweep, and reconstructs the SPP ω-vs-k dispersion vs the closed-form
k_SPP = k0·√(ε_d·ε_m/(ε_d+ε_m)), with silver as a dispersive Drude metal (plasma ~9.6 eV).

**Lesson for our build.** This is the citation spine for our **SPP dispersion view**
(`sppDispersion`, `drudeEps`) on the plasmonic toggle. Fixed grammar to reproduce exactly: **ω/energy
on y, in-plane β (rad/m) on x; the free-space light line ω=c·k as a dashed reference; the SPP branch
always to the RIGHT of the light line, bending over and flattening toward ω_sp=ω_p/√2**; discrete
simulated markers overlaid on the analytic curve (the validation-overlay look). Color can carry a
third channel (Q-factor = Re(k)/Im(k)). For field maps, the **two-colormap rule**: sequential
(Prism/Rainbow) for |E| norm, zero-centered diverging (Wave/Dipole, red-white-blue) for signed Ez;
field bound to the interface, **decaying faster into the lossy metal**. Real units throughout (eV/THz,
rad/m, nm). A non-dispersive metal or an ever-rising straight branch is physically wrong. **[UNCERTAIN]**
The model page itself is JS-gated/thin; precise in-figure colors, marker styles, and whether 119251
uses eV vs THz or color-codes by Q come from the closely-matched blog + companion 127161, not
pixel-level inspection of 119251. Quoted captions are near-verbatim WebFetch summaries.

### A.4 Cambridge DAMTP Polariton Graph Simulator (Berloff/Lagoudakis)
- **DAMTP page:** https://www.damtp.cam.ac.uk/user/ngb23/polgraph.html
- **Theory paper (NJP):** https://iopscience.iop.org/article/10.1088/1367-2630/aa924b · https://arxiv.org/pdf/1709.05498
- **Experimental (Nature Materials, imaging conventions):** https://arxiv.org/pdf/1607.06065 · https://www.nature.com/articles/nmat4971
- **Gain-dissipative optimisation:** https://www.nature.com/articles/s41598-018-35416-1
- **Cambridge press ("magic dust"):** http://www.cam.ac.uk/research/news/new-type-of-supercomputer-could-be-based-on-magic-dust-combination-of-light-and-matter

**What it is.** A platform (and outreach page) where networks of exciton-polariton condensates,
imprinted on an arbitrary 2D graph by a structured pump, self-organise their phases to **minimise the
classical XY Hamiltonian**, an analogue optimiser. Physics = a driven-dissipative Gross-Pitaevskii /
complex Ginzburg-Landau equation coupled to a hot-exciton reservoir; couplings J_ij are **emergent**
from geometry+pump (oscillating in sign with k_c·d), not free parameters. Above threshold the same
model becomes a Kuramoto synchronisation network.

**Lesson for our build.** Visualization grammar to inherit: density colormap + **per-vertex spin
arrows**; **solid-blue (FM) / dashed-red (AFM)** edges; relative phase read off **interference fringe
parity** (even=π, odd=0); k-space tomography with a k_c ring. Frame value the way Berloff does:
"magic dust that shines only at the deepest valley," bosonic stimulation reaching the global minimum
bottom-up. Honesty lesson directly relevant to this project's accuracy bar: it is a **classical mean-field**
simulator whose speed-up is from BEC statistics; reproduce that careful framing, do not overclaim
"quantum." **[INACCESSIBLE]** The DAMTP page failed WebFetch (TLS "unable to verify first certificate")
and was retrieved via `curl -k`; the hero image and embedded YouTube were not visually rendered.
PMC/Sci.Rep. full texts were CAPTCHA/redirect-blocked; gain-dissipative figure details rely on the
arXiv PDFs (1709.05498, 1607.06065), not the Sci.Rep. figures directly. **Not directly used in our
build** (different problem domain) but studied for visualization conventions and honest framing.

### A.5 Photizon: browser-based photonics simulator suite
- **Thin-film TMM simulator:** https://photizon.com/simulator
- **Homepage:** https://photizon.com
- **PIC waveguide mode solver:** https://photizon.com/pic-mode-solver
- **Fabry-Perot / resonator:** https://photizon.com/resonator
- **Gaussian beam propagator:** https://photizon.com/gaussian-beam
- **Q-factor academy:** https://photizon.com/academy/q-factor-cavities
- **Fabry-Perot academy:** https://photizon.com/academy/fabry-perot-resonators

**What it is.** A no-install, client-side-JS photonics platform (~a dozen tools across Thin Films &
Gratings, Integrated Photonics, Optical Fundamentals) computing reflectance/transmittance via TMM,
waveguide n_eff/mode maps, the Airy function T=1/[1+F·sin²(δ/2)] with FSR/finesse/Q/linewidth/photon-
lifetime, ABCD Gaussian-beam chains, Jones polarization, and RCWA grating efficiency, each paired with
an Academy tutorial that states the governing equation.

**Lesson for our build.** Adopt the **control-left / live-plot-right / prominent scalar-readout**
layout and **SI-unit-labeled controls** (nm, µm, deg, MHz, dB), with physically meaningful **presets**
so users perturb a known-good system. For our cavity work, mirror the **linked resonator readout
stack**: FSR=c/2nL → finesse F=π√R/(1−R) → FWHM=FSR/F → Q=ν₀/Δν → photon lifetime, surfaced together.
Plot the **conjugate axis** (round-trip phase/detuning, not only wavelength). Build **visible
self-validation checks** (ABCD determinant ≈1, Σ diffraction orders =1.0000), the analog of our
"verify the engine" golden tests. Pair every tool with an embedded teaching explanation. **[UNCERTAIN]**
Live charts are JS-rendered, so exact curve colors/styles and the mode-solver |E|² colormap are
inferred from control labels/conventions, not observed pixels; `/ring-resonator`, `/resonator`,
`/materials` returned only titles (JS-gated). No third-party coverage of "Photizon" surfaced. It is a
newer/less-indexed tool; possible account-gating was not confirmed.

---

## B. The broader simulation ecosystem (visual + interaction conventions)

### B.1 QuTiP: quantum-optics state/dynamics library
- **Visualization guide:** https://qutip.org/docs/4.7/guide/guide-visualization.html
- **Bloch sphere:** https://qutip.org/docs/4.7/guide/guide-bloch.html
- **wigner_cmap (nonlinear negative-region colormap):** https://qutip.org/docs/4.6/modules/qutip/visualization.html
- **Tutorials (JC vacuum Rabi, Tavis-Cummings):** https://qutip.org/qutip-tutorials/
- **Master-equation solver:** https://qutip.org/docs/4.7/guide/dynamics/dynamics-master.html

**What it is.** The standard Python library for coupled cavity+emitter dynamics: build Hamiltonians
from operators [a, a†, σ], add collapse operators √γ·A, integrate the Lindblad master equation
(`mesolve`)/Monte-Carlo (`mcsolve`), return expectation-value arrays you plot. Visualizes
Hilbert-space objects: Wigner phase space, Bloch sphere, Fock distributions, Hinton/3D-bar density
matrices.

**Lesson for our build.** The **Hilbert-space visual language** (distinct from classical field maps)
governs our abstract side panels (energy ladder, Hopfield strip). Deepest lesson: **`wigner_cmap`
deliberately recolors negative (nonclassical) regions** so the load-bearing physics cannot vanish:
engineer our palette around the load-bearing physics (anticrossing gap, √N brightening, dark states),
not aesthetics. Use a **diverging zero-centered colormap for any signed field**, the de-facto standard.
Keep abstract panels **honest and minimal** (Fock bars, a small two-level indicator, expectation-value
traces). **[UNCERTAIN]** Quoted color/alpha values (sphere #FFDDDD α=0.2, vector/point color cycles)
are from the 4.7 docs as summarized; 4.x-vs-5.x defaults may differ. The `mcsolve` page 404'd at the
tried URL.

### B.2 MEEP / Lumerical / Tidy3D: classical FDTD field solvers
- **MEEP basics tutorial:** https://meep.readthedocs.io/en/latest/Python_Tutorials/Basics/
- **MEEP home:** https://meep.readthedocs.io/en/latest/
- **Lumerical FDTD overview:** https://www.ansys.com/products/optics/fdtd
- **Lumerical convergence/mesh:** https://optics.ansys.com/hc/en-us/articles/360034915833-Convergence-testing-process-for-FDTD-simulations
- **Tidy3D GUI walkthrough:** https://www.flexcompute.com/tidy3d/learning-center/tidy3d-gui/Lecture-1-FDTD-Walkthrough/
- **Tidy3D monitors:** https://www.flexcompute.com/tidy3d/learning-center/tidy3d-gui/Lecture-6-Monitors/

**What it is.** Maxwell solvers on a discretized grid producing time-domain field maps, resonant
modes, and broadband transmission/flux spectra. MEEP's canonical hero is a 90° bent waveguide:
**grayscale "binary" dielectric (high-index dark) + RdBu Ez field overlay (red −, white 0, blue +)**,
axes in microns. Tidy3D/Lumerical converge on a 3D viewport + structure-tree + numeric property
sidebar + monitor/result selector.

**Lesson for our build.** This is the **classical field-map visual language** governing our standing-
wave |E|²(z) view: render the field as a **quantitative cut-plane heatmap with a labeled colorbar**,
not additive glow: diverging RdBu for signed field, sequential for |E|² intensity. Real tools demand
**stated mesh/convergence assumptions and real units**; we state single-mode/lossless/resonance
in-scene. If we ever expose parameter editing, the **3D-viewport + typed real-unit sidebar + result
selector** is the trust-building layout. Practitioners keep the **classical (field-map) and quantum
(Hilbert-space) languages distinct**; so do we. **[UNCERTAIN]** Commercial-GUI palettes (Lumerical/
Tidy3D theme, exact field colormaps) were not recoverable pixel-by-pixel; only MEEP/Falstad colormap
conventions are confirmed.

### B.3 Falstad applets / PhET / nanoHUB: interactive education tools
- **Falstad emwave1 (EM):** https://www.falstad.com/emwave1/
- **Falstad qm1d (1D quantum states):** https://www.falstad.com/qm1d/
- **Falstad ripple directions:** https://www.falstad.com/ripple-java/directions.html
- **PhET Lasers:** https://phet.colorado.edu/en/simulations/lasers
- **nanoHUB Quantum Dot Lab:** https://nanohub.org/resources/qdot
- **nanoHUB photonics tools:** https://nanohub.org/groups/photonics/simulation_tools

**What it is.** Real-time direct-manipulation physics: Falstad's emwave1 colors +z vs −z field and
lets you **draw sources/walls on the live canvas** with sliders for speed/frequency; qm1d stacks
**coordinated views** (potential+energy levels, |ψ(x)|², momentum space, draggable phasor bank, phase
shown as color, measurement collapses the state). PhET Lasers uses grab-and-move physical objects that
react and even break. nanoHUB runs containerized solvers (Schrödinger-Poisson) returning 3D
wavefunction isosurfaces + absorption spectra.

**Lesson for our build.** The **interaction model** to emulate: every control maps to a **recomputed,
visible result** (no decorative sliders), and **multiple coordinated views of one state** update
coherently from a single parameter change (our 3D cavity hero + synced energy-ladder/rate panels).
**Color carries information** (phase as hue). Default the hero to a **still view; motion comes from the
physics changing**, not a turntable. **[INACCESSIBLE]** Falstad pages 403'd on direct WebFetch (one
mirror had a self-signed cert); the qm1d coordinated-views/phasor/phase-color/measurement detail comes
from AAPT/PSRC secondary descriptions, consistent across three sources but not a direct render.

---

## C. Cited convention figures (the "what the field's plots look like" anchors)

### C.1 Canonical angle-resolved dispersion (UP/LP anticrossing): primary dispersion reference
- **Houdré et al. PRL 73, 2043 (1994), first measured dispersion:** https://link.aps.org/doi/10.1103/PhysRevLett.73.2043
- **Deng, Haug & Yamamoto, Rev. Mod. Phys. 82, 1489 (2010):** https://link.aps.org/doi/10.1103/RevModPhys.82.1489
- **Carusotto & Ciuti, RMP 85, 299 (2013):** https://arxiv.org/abs/1205.6500
- **Organic microcavity (PIC), exciton 2.132 eV, ~40 meV split:** https://pmc.ncbi.nlm.nih.gov/articles/PMC8585971/
- **Tamm-plasmon/ZnO, detuning via DBR thickness:** https://pmc.ncbi.nlm.nih.gov/articles/PMC5048173/
- **Modern false-color PL dispersion (Nat. Commun. 2024):** https://www.nature.com/articles/s41467-024-47669-8
- **Wikipedia color convention (red bare / black coupled):** https://en.wikipedia.org/wiki/Polariton

**Lesson.** The genre-defining figure and our **primary dispersion view** (`dispersionVsAngle`): four
curves, **dashed bare cavity parabola + dashed flat exciton, solid LP/UP**, on a **twin angle/k axis**
(k=(E/ℏc)sinθ), gap = exactly 2V at resonance (collapses to 0 as V→0), branches **colored by Hopfield
fraction** (red exciton ↔ blue photon), Rabi readout in meV. The exciton line **must be flat** (m_cav
~4 orders lighter). A "data mode" false-color PL skin mirrors experiments. This **replaces the faked
`split=clamp(splitMeV*0.055)` pixel axis with a true linear eV axis**. Rabi magnitudes stay
literature-grounded per material class (GaAs 4–16, CdTe 10–26, organic 30–100+, perovskite hundreds of
meV). **[UNCERTAIN/INACCESSIBLE]** APS/Nature/Science full texts were 403/login-gated; several organic/
perovskite splitting values and the exact b/c/d detuning-panel colorings come from PMC HTML + search
summaries, not direct figure inspection.

### C.2 Canonical "panel-a" cavity geometry schematic: geometry view
- **Ribeiro/Yuen-Zhou, arXiv:1802.08681 (THE template, read from PDF):** https://arxiv.org/abs/1802.08681 · https://arxiv.org/pdf/1802.08681
- **Polaritonic photochemistry review (k‖=(E_c/ℏc)sinθ sketch):** https://pmc.ncbi.nlm.nih.gov/articles/PMC10540218/
- **Fregoni/Garcia-Vidal/Feist, theoretical challenges:** https://pmc.ncbi.nlm.nih.gov/articles/PMC9026242/

**Lesson.** The directly-verified template for our geometry panel: **two mirror slabs in light
isometric perspective (flat-shaded line-art, not glossy)**, L labeled with a double-headed arrow, one
**purple incident ray at angle θ to the mirror normal** (θ wired to the dispersion x-axis), **TE = red
encircled-cross glyph** (out of plane of incidence), **TM = blue in-plane vectors** (do NOT invert),
green standing-wave lobes, a small local **e_q/n_q/e_z triad** (not a giant XYZ gizmo), and a
"show molecules" toggle (abstract single-mode vs molecules-filled multimode, their Fig 1 vs Fig 3).
Fixed color grammar reused across geometry AND plots: purple=light/polariton, red=TE/cavity/exciton,
blue=TM/photon, green=in-cavity field. **[UNCERTAIN]** Fig 1(a)/Fig 3 of 1802.08681 were read
first-hand from the rendered PDF; the two review figures are described from caption text (line/arrow
weights inferred from the consistent convention). Mandal et al. Chem. Rev. 2023 figures are
paywalled/JS-gated, reported via secondary summary. DBR-stripes vs plain-slab is a stylistic choice
(template uses plain slabs).

### C.3 Field/mode visual conventions (SPP maps, standing waves, Hopfield)
- **COMSOL SPP field+dispersion:** https://www.comsol.com/blogs/modeling-surface-plasmon-polaritons-in-comsol
- **Surface plasmon polariton (Wikipedia):** https://en.wikipedia.org/wiki/Surface_plasmon_polariton
- **Nanoparticle-on-mirror hotspots (log|E/E0|⁴, red/blue charge):** https://pmc.ncbi.nlm.nih.gov/articles/PMC4945943/
- **Open Fabry-Perot Purcell / mode volume:** https://arxiv.org/pdf/2203.07070
- **False-color k-space polariton flow:** https://pmc.ncbi.nlm.nih.gov/articles/PMC11547211/
- **Foley journal cover (project aesthetic ref):** https://science.charlotte.edu/2025/10/27/foley-lab-research-article-selected-for-journal-cover-pays-tribute-to-the-beach-boys/

**Lesson.** The **two-colormap hard rule** (the strongest realism lever): **diverging zero-centered
(RdBu/bwr)** for signed fields (real Ez, standing-wave amplitude, surface charge), **sequential
(hot/dark→bright, log if many decades)** for unsigned |E|²/|E|⁴/PL intensity. Every canonical figure
pairs the primary view with **explicit reference lines** (light line for SPP, dashed bare modes for
dispersion, DBR index-step overlay for the standing wave). Honesty markers: **field asymmetry** (faster
decay into metal), **antinodes pinned in the defect layer** with count tied to the real mode index (our
`standingWaveProfile` replaces the faked `antinodes=round(2+ℏω_c·3)`). **[UNCERTAIN/INACCESSIBLE]**
Nature srep30011/s41467 and the APS Houdré PDF and the Lumerical SPP page were 403/auth-gated; two
arXiv PDFs (2407.17713, 2205.06307) were binary-unparseable. The COMSOL blog confirms arrows +
Q-colored dispersion but does not name the scalar |E| colormap. The teal/magenta/gold palette is the
project's own `.impeccable.md` reading, **not pinned to one public Foley image**; no single open figure
color-codes branches by Hopfield fraction along a red/blue axis; that encoding is a community
convention + our PHYSICS-SPEC, not one verified URL.

### C.4 Energy-level diagrams & polaritonic potential-energy surfaces (PoPES)
- **Galego/Garcia-Vidal/Feist PRX 2015 (foundational PoPES):** https://arxiv.org/abs/1506.03331
- **Suppressing photochemistry (double-well, purple-orange character map):** https://arxiv.org/pdf/1606.04684
- **Feist 2018 (JC/TC ladder, N−1 dark states between LP/UP):** https://arxiv.org/pdf/1802.08681
- **Herrera & Feist 2019 (diabatic-replica Jablonski ladder):** https://arxiv.org/pdf/1911.05017
- **Theoretical Challenges (cavity=blue/molecule=orange dotted):** https://arxiv.org/pdf/2111.08394
- **Foley ab initio review (MgH⁺ LP/UP, %-photonic coloring, QED-CIS-1 tutorial):** https://par.nsf.gov/servlets/purl/10485184
- **Huo-group electron transfer (Marcus parabolas, JC vs Pauli-Fierz):** https://pubs.acs.org/doi/10.1021/acs.jpcb.0c03227
- **Groenhof/Feist relaxation (LP magenta / UP cyan / dark black palette):** https://pmc.ncbi.nlm.nih.gov/articles/PMC6914212
- **Mandal-Huo Chem. Rev. 2023 (canonical review):** https://pubs.acs.org/doi/10.1021/acs.chemrev.2c00855 · preprint https://chemrxiv.org/engage/chemrxiv/article-details/63903eee92f084c9612a9086
- **"Action in the Dark" (dark-state dominance framing):** https://pubs.acs.org/doi/10.1021/acscentsci.9b00219

**Lesson.** Two figure families with different x-axes: **ladder/Jablonski** (energy vs nothing/photon-
number/detuning) and **PoPES** (energy vs nuclear/reaction coordinate). The single most load-bearing
convention: the **N−1 (or our N−2) dark states drawn as a degenerate gray bundle pinned at the bare
exciton energy, BETWEEN LP and UP, never above UP or below LP**. Universal building blocks:
**dashed-bare / solid-coupled**, the photon-dressed ground surface **V_c=V_g+ω_c**, and **character as
a color-encoded scalar field** along each surface (purple↔orange in Feist, %-photonic with
excitonic=red in Foley). **Coupling strength is the master slider** (LP minimum deepening, barrier
opening, Rabi gap widening). For the ET story use **Marcus parabolas** with E_a=(ΔG+λ)²/4λ, and a
**JC-vs-Pauli-Fierz (DSE)** toggle; the DSE distinction must not be dropped. These drive our PoPES,
energy-ladder, and Marcus-parabola views (replacing the hopping glowing electron). **[INACCESSIBLE/
UNCERTAIN]** The explicitly-requested Mandal-Huo Chem. Rev. 2023 is paywalled (ACS 403) and the
ChemRxiv/OSTI full texts also 403'd; its figure specifics are reconstructed from the group's primary
papers + aligned Feist figures, not read first-hand. The 5-color mechanism palette (reactant blue / LP
red / dark green / UP purple / product orange) was surfaced via a search summary, not a verified
caption; attribute cautiously. Colormap direction (which end is photon-like) could be reversed.

---

## Summary

Five primary tools were studied in depth and map directly onto our views: **FoleyLab/qed-ci** (the
PoPES eigensolver and dipole-self-energy honesty), the **Foley Lab render aesthetic** (palette
grammar, but the lab's real language is flat data plots, inverting the glossy "hero"), the **COMSOL
SPP model** (the plasmonic-toggle dispersion + two-colormap field-map rule), the **Berloff/Lagoudakis
polariton-graph simulator** (visualization conventions + honest "classical mean-field" framing), and
**Photizon** (control-left/plot-right layout, linked resonator readouts, visible self-validation). The
broader ecosystem, **QuTiP** (Hilbert-space language, `wigner_cmap` "engineer color around load-bearing
physics"), **MEEP/Lumerical/Tidy3D** (classical field-map language, stated assumptions), **Falstad/PhET/
nanoHUB** (coordinated-views direct-manipulation, no decorative sliders), sets the interaction and
colormap discipline. The cited convention figures anchor our four signature panels: the **angle-resolved
UP/LP anticrossing** (Houdré/Deng-Haug-Yamamoto, our promoted hero), the **flat panel-a geometry
schematic** (Ribeiro/Yuen-Zhou 1802.08681, read first-hand), **SPP/field-map conventions** (COMSOL +
two-colormap rule), and **PoPES/energy-ladder/Marcus** diagrams (Galego/Feist/Foley/Huo, with the
dark-state-manifold-between-LP-and-UP convention). Anything paywalled, JS-gated, or inferred is flagged
**[UNCERTAIN]**/**[INACCESSIBLE]** inline, most notably the exact Foley "hero render" and the Mandal-Huo
Chem. Rev. 2023 figures, neither of which was inspected first-hand.

**Path:** `/Users/dhruvjain/polariton-research/sim/docs/REFERENCES.md`
