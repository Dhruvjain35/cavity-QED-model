# Wigner Phase-Space & Open-System Dynamics — Visual Specification

**Status:** source of truth for the **quantum-state / open-system** view group (the second visual
grammar of `VISUAL-SPEC.md §0`). Covers the Wigner phase-space panel, the damped vacuum-Rabi panel,
the polariton emission spectrum, the purity-decay coherence meter, and the disorder-broadening view —
plus how the Wigner panel docks beside the cavity/dispersion hero. Every panel here renders a
**computed object** (the Lindblad-evolved density matrix $\rho(t)$, its Wigner transform, its
spectrum), not decoration.

**Companion docs:** `VISUAL-SPEC.md §0` (the two-grammar prime directive — these panels live entirely
in the *quantum-state / quantitative-plot* grammar), `PHYSICS-SPEC.md §B` (Jaynes/Tavis–Cummings,
deferred open-system layer in §9), `REFERENCES.md`. Engine target: a Rust/WASM Lindblad core
(`engine/oqs/`, new) validated against QuTiP `mesolve` / `wigner`.

**Convention lock (state once, obey everywhere).** QuTiP convention end-to-end:
$a = \tfrac{1}{2}g(x+ip)$, default $g=\sqrt{2}\Rightarrow \hbar = 2/g^2 = 1$; Lindblad collapse
operators carry the **square root** of the rate, $C_n=\sqrt{\gamma_n}\,A_n$; cavity loss $\sqrt{\kappa}\,a$,
emitter decay $\sqrt{\gamma}\,\sigma_-$, pure dephasing $\sqrt{\gamma_\phi/2}\,\sigma_z$
(QuTiP Jaynes–Cummings tutorial; `wigner.py` docstring; Cahill–Glauber PR 177, 1882 (1969)).
A panel that silently switches $g$, drops the $\sqrt{}$ on a rate, or mislabels $\kappa$ as a field
(amplitude) rate is a correctness failure, not a style choice.

---

## 1. Where these panels live in the two-grammar split

`VISUAL-SPEC.md §0` forbids blending the **classical field-map** grammar (red/white/blue over
grayscale structure, micron axes — the 3D cavity, |E|², SPP map) with the **quantum-state**
grammar (flat 2D plots, ladders, character-colored branches — dispersion hero, Hopfield strip,
turnover). **All five panels in this doc are quantum-state grammar.** Concretely:

| Panel | Grammar | Signed? | Colormap rule (`VISUAL-SPEC.md §0`) |
|---|---|---|---|
| Wigner $W(x,p)$ | quantum-state (the one 2D *map* in this grammar) | **signed** ($W$ goes negative) | **diverging, zero-centered** |
| Damped vacuum-Rabi $\langle a^\dagger a\rangle(t),\,\langle\sigma_z\rangle(t)$ | quantum-state | line plot | n/a (two fixed hues) |
| Emission spectrum $S(\omega)$ | quantum-state | unsigned intensity | sequential/flat line |
| Purity $\mathrm{Tr}[\rho^2](t)$ | quantum-state | unsigned scalar | single line |
| Disorder broadening $A(E;\sigma)$ | quantum-state | unsigned intensity | family of lines + eigenvalue scatter |

The Wigner panel is the **only** signed 2D field in the quantum-state grammar, so it is the one place
the diverging-zero-centered rule applies *inside* a flat-plot context. Do not let it pick up the
field-map grammar's micron axes or grayscale structure — its axes are **quadratures**, not space.

---

## 2. THE WIGNER PHASE-SPACE PANEL

### 2.1 What it is

A real (sign-changing) quasiprobability $W(x,p)$ for the **cavity field mode** over phase space.
Axes are conjugate quadratures $x=\mathrm{Re}\,\alpha$ (horizontal), $p=\mathrm{Im}\,\alpha$ (vertical).
Negativity is the **measurable witness of non-classicality** — the whole point of rendering it
(Royer PRA 15, 449 (1977); Cahill–Glauber 1969). When this view sits inside the coupled cavity+emitter
system, render $W$ of the **photon-reduced** density matrix $\rho_c = \mathrm{Tr}_{\text{emitter}}\,\rho$.

$$
W(\alpha) = \frac{2}{\pi}\,\mathrm{Tr}\!\left[\hat D(\alpha)\,\hat\rho\,\hat D^\dagger(\alpha)\,(-1)^{\hat a^\dagger \hat a}\right]
$$

### 2.2 Axes & units (DO)

- **Square domain, equal aspect** — `x,p ∈ [−5, 5]`, 200 samples/axis default (QuTiP visualization
  guide uses `linspace(-5,5,200)`; 500 for publication stills). Equal aspect is **mandatory**: a
  coherent state must read as a *round* blob, not an ellipse. A non-square aspect is the fastest tell
  the renderer is wrong.
- **Label axes as quadratures**, not space: `x = Re α` (horizontal), `p = Im α` (vertical), with a
  thin axis cross through the origin. Never `µm`, never `nm` — those belong to the field-map grammar.
- **State the convention on-panel:** caption `g = √2 (ħ=1)`. With this scaling a coherent state $|\beta\rangle$
  peaks at $(\sqrt2\,\mathrm{Re}\,\beta,\ \sqrt2\,\mathrm{Im}\,\beta)$ with height $1/\pi$; vacuum peaks
  at the origin at $1/\pi$. These two numbers are the panel's built-in unit test (see §6).

### 2.3 The diverging colormap, centered at zero (the load-bearing rule)

- **Diverging map, hard-centered on $W=0$.** Use `seismic` (blue→white→red) or `RdBu_r` so the
  requested reading **negative = blue, positive = red** holds. NOTE: plain `RdBu` maps low→red,
  high→blue (the *reverse*) — QuTiP's own example uses `cm.RdBu` under symmetric `Normalize`, which is
  the opposite of the convention we want, so pick the **`_r` / seismic** variant deliberately and say so.
- **Symmetric limits, recomputed per state:** `vmin = −max|W|`, `vmax = +max|W|`
  (matplotlib `Normalize(-W.max(), W.max())` ≡ `CenteredNorm(vcenter=0)`). This forces the neutral
  (white) color **exactly** onto $W=0$. Without it the zero crossing is mis-colored and the negativity
  reads as a lie.
- **Freeze the scale across an animation.** During a decoherence sweep, compute `max|W|` once on the
  initial (most-structured) frame and hold `vmin/vmax` fixed for all frames, so fringes visibly *fade*
  rather than the colormap silently rescaling to keep them saturated. Per-frame autoscale is a slop tell:
  it makes a dying cat look immortal.
- **GPU mapping:** upload the diverging palette as a 256×1 RGBA LUT; in-shader
  `t = clamp(0.5 + 0.5*W/vmax, 0, 1)` so `W=0 → t=0.5 →` the central white texel. Compute `max|W|`
  by a parallel max-reduce (or CPU-precompute and pass as a uniform). Do **not** rely on per-frame
  auto-normalize.
- **Optional single black contour at $W=0$** cleanly outlines the negativity boundary (QuTiP guide uses
  `contourf`, 100 levels; one zero-contour is enough and reads as "real figure", not glow).

### 2.4 Canonical state signatures (the panel must reproduce these exactly)

| State | Signature | Sign | Check |
|---|---|---|---|
| **Vacuum / coherent** $|\beta\rangle$ | single **round** Gaussian blob (origin / displaced) | strictly **positive** (all red, no blue) | $W=\frac{2}{\pi}e^{-2|\alpha-\beta|^2}$ |
| **Fock** $|n\rangle$ | concentric **rings**, central dip | rings **alternate**; core blue for odd $n$, negative for all $n\ge1$ | $W=\frac{2}{\pi}(-1)^n e^{-2|\alpha|^2}L_n(4|\alpha|^2)$ |
| **Cat** $\frac{1}{\mathcal N}(|\beta\rangle\pm|-\beta\rangle)$ | two lobes **plus a barred band of fringes** between them | central fringes **alternate red/blue** (even=central max, odd=central min) | fringe term $\sim e^{-2|\alpha|^2}\cos(4\beta\,\mathrm{Im}\,\alpha)$ |
| **Squeezed** | positive **ellipse** (area-preserving) | positive | narrowed one quadrature, stretched the other |
| **Thermal** | broad, low, centered Gaussian | positive | wider for higher $\bar n$ |

The cat fringes are the **single most diagnostic feature** of the whole panel — they are the visual
proof of quantum coherence and the first thing decoherence destroys (§2.5). If the off-diagonal
factor-of-2 in the Clenshaw evaluation is dropped, the fringes render at **half amplitude** while the
diagonal (Fock/thermal) still looks right — an easy-to-miss correctness bug (`wigner.py`: off-diagonals
are doubled, diagonal single-weighted).

### 2.5 Decoherence (animate, do not fake)

Loss ($\kappa$) and dephasing damp the off-diagonal coherences that produce the fringes **much faster**
than they move the lobes (cat decoherence scales with the square of phase-space separation, textbook;
imaged in Deléglise et al., Nature 455, 510 (2008)). So:

- Recompute $W$ from the **Lindblad-evolved** $\rho(t)$ each shown frame — the smoothing toward a
  positive Gaussian is an *emergent* property of $\rho(t)$, **never** a blur applied to $W$ directly.
- The visual signature: cat fringes (the blue/red bars) **wash out first**, negativity vanishes, the
  two lobes only slowly drift together, ending in one smooth positive Gaussian — mirroring the Deléglise
  snapshots.
- Scalar readout beside the panel: **Wigner negative volume**
  $\delta = \tfrac12\!\left(\int |W|\,dx\,dp - 1\right)\in[0,1]$, $\delta>0$ certifies non-classicality.
  Plot $\delta(t)$ as a small companion trace; it should fall to 0 as fringes die.

### 2.6 DO NOT (Wigner-specific slop tells)

- **DON'T** use a sequential/rainbow map (viridis, jet, hot) — that hides the sign, which *is* the
  physics. Signed field ⇒ diverging, always (`VISUAL-SPEC.md §0`).
- **DON'T** auto-center the colormap off the data mean or use asymmetric limits — white must sit on
  exactly $0$, not on $\overline{W}$.
- **DON'T** let `max|W|` float per frame during an animation (makes decoherence invisible).
- **DON'T** apply a Gaussian blur / bloom / glow to "show decoherence" — recompute from $\rho(t)$.
- **DON'T** render with non-equal aspect (round states must stay round).
- **DON'T** mislabel axes as position/space in µm — they are dimensionless quadratures.
- **DON'T** accumulate the Clenshaw recurrence in f32 — the negativity (the blue region) loses
  fidelity; compute in f64, downcast only for the texture upload.
- **DON'T** size the Fock cutoff $M$ to the HTC molecule count $N_\text{max}$ (1636/10785) — those are
  unrelated. $M$ is the photon Fock truncation, $M\sim20$–$80$ is typical; pick it so the displayed
  field's top-level population is `<1e-6` and `∫W = 1` to tolerance.

---

## 3. DAMPED VACUUM-RABI PANEL

### 3.1 Axes & curves

- **x:** `Time` in units of $g^{-1}$ or $\kappa^{-1}$ (or ns with a stated conversion) — real units,
  never normalized-unitless.
- **y:** `Occupation probability` (dimensionless 0–1).
- **Two solid curves**, fixed hues from the project character map (`VISUAL-SPEC.md §1`):
  cavity photon number $\langle a^\dagger a\rangle$ in **photon-blue `#1d6f7e`**, emitter excitation
  $\langle\sigma_+\sigma_-\rangle$ (or $\langle\sigma_z\rangle$) in **matter-red `#d1495b`**.
- **Overlay the decay envelope** $\pm e^{-(\kappa+\gamma)t/2}$ as a **thin dashed gray** reference
  (dashed = reference, per the universal line convention) so the eye separates the *coherent* frequency
  (zeros spaced by the $2g$ oscillation) from the *incoherent* damping. Treat the closed-form envelope
  as illustrative only — the curves themselves come from `mesolve`, not the formula (the exact prefactor
  is regime-dependent; compute it).

### 3.2 What it must show

- **Strong coupling** ($C=g^2/\kappa\gamma>1$, equivalently $2g>\kappa,\gamma$): several clean
  oscillations of period $\pi/g$ inside the decaying envelope.
- **Weak coupling** ($C<1$): monotonic decay, no resolved oscillation (Purcell-enhanced emission).
- A **$g$ vs $\kappa,\gamma$ slider** crosses the boundary live — the oscillations wash out as you turn
  loss up. This is the strong→weak crossover as **one motion**, not two static panels.
- Canonical QuTiP seed (for the validation harness and a recognizable default):
  $\omega_c=\omega_a=2\pi$, $g=0.05\cdot2\pi$, $\kappa=0.005$, $\gamma=0.05$, $n_\text{th}=0$,
  $N_\text{fock}=15$, $\psi_0=|e,0\rangle$ (qutip-notebooks `rabi-oscillations.ipynb`).

### 3.3 Optional collapse-and-revival inset

Start the field in a coherent state $|\alpha\rangle$ (mean $\sim$ a few photons) and plot
$\langle\sigma_z\rangle(t)$: the inversion **collapses then revives** — the textbook fingerprint of
field quantization, with no classical analog ($\langle\sigma_z\rangle=\sum_n P_n\cos(2\Omega_n t)$,
Poisson $P_n$). Keep it as a clean second trace, not an effect.

---

## 4. POLARITON EMISSION SPECTRUM PANEL

### 4.1 Axes & form

- **x:** `Energy` (meV/eV) **or** detuning $(\omega-\omega_0)$ in units of $\kappa$ or $g$ — real units.
- **y:** spectral density $S(\omega)$ (a.u., or normalized to the taller peak).
- **Sum of two Lorentzians** at the damped normal-mode eigenfrequencies; at zero detuning peaks at
  $\omega_0\pm g$ (single emitter) or $\omega_0\pm g\sqrt N$ (collective), each FWHM
  $\Gamma=(\kappa+\gamma)/2$ — the arithmetic average of the bare cavity and emitter widths
  (Savona, arXiv:0811.2502, text after Eq. 1; Boca/Kimble PRL 93, 233603 (2004)):

$$
S(\omega)\;\propto\;\sum_{i\in\{-,+\}}\frac{(\Gamma_i/2)^2}{(\omega-\omega_i)^2+(\Gamma_i/2)^2}.
$$

### 4.2 What it must show

- **Total spectrum solid**, the two component Lorentzians **dotted** beneath it.
- **Annotate** the peak separation as the **Rabi splitting** ($2g$ or $2g\sqrt N$); bracket it the way
  the dispersion hero brackets $2V$ (`VISUAL-SPEC.md §2.2`), for a consistent house grammar.
- **Strong→weak collapse via slider:** as $g$ drops below $|\kappa-\gamma|/4$ the resolved doublet
  **merges into a single bare-cavity Lorentzian** — the canonical "two peaks → one peak" transition,
  shown as a smooth family of curves (small inset or slider sweep), not an animation gimmick.
- **Optional Hopfield coloring:** tint each peak by its photonic fraction on the diverging
  red(exciton `#d1495b`)↔blue(photon `#1d6f7e`) character map, reusing the dispersion convention,
  rather than a flat color.
- Two numerically equivalent routes — (a) closed-form two-Lorentzian sum from the complex eigenvalues
  of the $(n{+}1)\times(n{+}1)$ non-Hermitian matrix (cheap, exact in the linear/single-excitation
  regime, **the default for the live tool**); (b) Wiener–Khinchin FFT of the steady-state correlation
  $\int\langle a^\dagger(\tau)a(0)\rangle e^{-i\omega\tau}d\tau$ via QuTiP `spectrum_ss` (captures
  driven/nonlinear effects). Flag the analytic doublet as the fast linear-response approximation.

### 4.3 DO NOT

- **DON'T** draw the doublet as decorative twin glows — it is two labeled Lorentzians with a measured
  separation and width.
- **DON'T** let the two peaks **cross or touch** as coupling drops; below threshold they *merge*, they
  do not pass through each other.
- **DON'T** invent linewidths — $\Gamma$ comes from $(\kappa+\gamma)/2$ at resonance and from
  $2|\mathrm{Im}\,\omega_\pm|$ off resonance, read from the eigenvalues.

---

## 5. PURITY (COHERENCE METER) & DISORDER BROADENING

### 5.1 Purity decay panel

- **x:** `Time` (share the axis with the Rabi panel so they stack/sync). **y:** $\mathrm{Tr}[\rho^2]$,
  range $[1/d,\,1]$ with **horizontal dashed references** at $1$ (pure) and $1/d$ (maximally mixed);
  state $d$ (the truncated Hilbert dimension) in the caption since the floor depends on it.
- **One monotone-ish decaying curve.** This is a **quantitative trace with a labeled axis** — it is the
  dedicated decoherence meter. **DO NOT** encode purity as glow/opacity/bloom on another panel; that is
  exactly the slop substitution the project bans (`VISUAL-SPEC.md §1`, "no bloom"). Purity is cheap:
  $\mathrm{Tr}[\rho^2]=\|\rho\|_F^2$ each step.
- Optional companion traces on the same axes (label which measure is valid for the current dynamics):
  von Neumann entanglement entropy $S(\rho_A)=-\mathrm{Tr}[\rho_A\log_2\rho_A]$ — **valid as
  entanglement only while the global state is pure**; once $\kappa,\gamma,\gamma_\phi$ mix it, switch to
  concurrence/negativity and say so. $\ell_1$-coherence $\sum_{i\ne j}|\rho_{ij}|$ is a basis-dependent
  third trace. All collapse under dissipation.

### 5.2 Disorder-broadening panel (the disordered Tavis–Cummings view)

The realistic-physics layer `PHYSICS-SPEC.md §9` defers. Diagonal Gaussian disorder
$\omega_j\sim\mathcal N(\omega_0,\sigma^2)$ on the emitter energies; the single controlling parameter is
$\sigma/g_c$ with $g_c=g\sqrt N$ (Gera–Sebastian JCP 156, 194304 (2022); Zeb PRA 106, 063720 (2022);
Botzung et al. PRB 102, 144202 (2020)).

- **The money plot — absorption $A(E)$ vs $\sigma$.** **x:** `Energy` (meV/eV); **y:** $A(E)$.
  Draw the clean symmetric LP/UP doublet ($\sigma=0$) as a **thin dashed reference**, then overlay the
  disorder-broadened spectrum **solid** for increasing $\sigma/g_c$ (e.g. 0.2 … 1.6). As
  $\sigma\to g_c$ the doublet broadens, develops **asymmetric Fano shoulders** (sharp low-energy LP
  tail, slow high-energy UP tail), and **merges into one bare-cavity peak** near $\sigma/g_c\sim1$
  (the strong→weak crossover). **$\sigma$ is the master slider.**
- **Companion eigenvalue scatter — grey-state brightening.** Diagonalize the $(N{+}1)\times(N{+}1)$
  arrowhead matrix over many disorder realizations at fixed $g_c$. Scatter Re$(\omega)$ on x; **color
  each eigenstate by photonic weight $|\langle G,1|\psi\rangle|^2$** on the same diverging
  photon↔matter map. At $\sigma=0$ only the two polaritons are bright (weight $\tfrac12$ each) and the
  $N{-}1$ middle states are black; as $\sigma$ grows the dark band **lights up faintly** ($\sim1/N$
  each) — the literal visual of "dark states turn grey". The two polariton branches bow apart slightly
  and dissolve into the band near $\sigma\sim g_c$.
- **Cavity-protection demonstration (two-curve).** Plot polariton FWHM vs $\sigma$ for several Rabi
  splittings $g_c$, alongside the bare-ensemble width (which tracks $\sigma$ linearly). For large
  $g_c$ the polariton width stays near the homogeneous (lifetime) floor — making "motional narrowing /
  cavity protection" (Houdré, Stanley & Ilegems PRA 53, 2711 (1996); Climent–Subotnik–Nitzan
  arXiv:2310.13860 (2023)) tangible as a flat line under a rising one.
- **DO honor the project's no-dead-slider rule:** the $\sigma/g_c$ knob must visibly thicken the dark
  band and broaden the peaks in real time — a slider that changes nothing is banned.
- **DON'T** perturb the off-diagonal couplings to model energetic disorder — diagonal-only
  ($\omega_j=\omega_0+\sigma z_j$); coupling/orientational disorder is a distinct effect.

---

## 6. HOW THE WIGNER PANEL DOCKS BESIDE THE CAVITY / DISPERSION HERO

The dispersion hero (`VISUAL-SPEC.md §2`) owns the screen and answers *"what are the eigenmodes"*; the
Wigner + open-system panels answer *"what is the quantum state doing in time, and what does loss do to
it"* — the time-resolved / dissipative layer the eigenvalue picture cannot show. Layout discipline:

- **Hero stays primary; these are a co-panel cluster, not a replacement.** Put the Wigner square as a
  fixed-aspect panel adjacent to (not overlapping) the dispersion plot, with the damped-Rabi, spectrum,
  and purity panels stacked beneath it sharing a synced time axis where applicable.
- **One consistent character key across the whole screen:** photon/cavity = blue `#1d6f7e`,
  exciton/matter = red `#d1495b`, white at 50/50 (`VISUAL-SPEC.md §1`). The Rabi panel's two curves,
  the spectrum's Hopfield tint, and the disorder scatter's photonic-weight coloring **all reuse this
  map**. The Wigner panel uses the *same* diverging family but mapped to **sign of $W$** (blue negative,
  red positive) — call this out in its caption so it is not confused with the photon↔matter axis.
- **Grammar firewall (`VISUAL-SPEC.md §0`):** the 3D cavity / |E|² standing-wave / SPP panels stay in
  the **field-map** grammar (micron axes, grayscale structure). The Wigner panel, despite being a 2D
  heatmap, stays in the **quantum-state** grammar — **quadrature axes, no µm, no grayscale slab behind
  it.** Never let the Wigner heatmap pick up the field-map's spatial axes; never let the field map
  borrow the Wigner sign-diverging palette. Mixing the two grammars is the headline tell of fake.
- **Light background everywhere** (`#fafafa`–`#ffffff`); no bloom, no gloss, no auto-rotate; equations
  in a static typeset block beside the figure, never floating glowing over a dark scene.
- **"Verify the engine" affordance** (mirrors `VISUAL-SPEC.md §1`): expose the QuTiP-golden checks —
  vacuum $W$ peak $=1/\pi$, $\int W\,dx\,dp = 1$, damped-Rabi $\langle a^\dagger a\rangle(t)$ matching
  `mesolve` to `<1e-4`, Fock $|n\rangle$ reproducing $\frac{2}{\pi}(-1)^n e^{-2r^2}L_n(4r^2)$ — as a
  surfacable panel, so the rendering's honesty is checkable, not asserted.

---

## 7. AI-SLOP TELLS TO INVERT (forensic checklist, this view group)

| Slop tell | Invert to |
|---|---|
| Rainbow/viridis on the Wigner map (sign hidden) | **diverging seismic/RdBu_r**, white hard-centered on $W=0$ |
| Colormap autoscales per animation frame | **freeze `vmin/vmax`** on the initial frame; fringes fade honestly |
| "Decoherence" faked by Gaussian-blurring $W$ | **recompute $W$ from Lindblad $\rho(t)$**; smoothing is emergent |
| Cat fringes at half amplitude / missing | restore the **off-diagonal ×2** in Clenshaw; fringes are the diagnostic |
| Non-square Wigner aspect (oval coherent state) | **equal aspect**; round states stay round |
| Wigner axes labeled in µm / over a grayscale slab | **quadrature axes** `Re α, Im α`; quantum-state grammar |
| Purity shown as glow/opacity on another panel | **dedicated $\mathrm{Tr}[\rho^2]$ line plot**, labeled axis, $1/d$ floor |
| Polariton doublet as twin neon glows | **two labeled Lorentzians**, FWHM $=(\kappa+\gamma)/2$, bracketed Rabi split |
| Peaks crossing as coupling drops | below threshold they **merge**, not cross |
| Disorder slider that changes nothing | $\sigma/g_c$ **thickens the grey band + broadens peaks live** |
| $\kappa$ used as the rate AND $\sqrt\kappa$ in the operator (double-count) | collapse op is $\sqrt\kappa\,a$, rate **not** re-applied in the dissipator |
| f32 Clenshaw losing the negative (blue) region | **f64** recurrence; downcast only for texture upload |

---

## 8. Minimal engine/render contract

- **`wigner(rhoFlat, nx, ny, g=√2) → Float32[ny*nx]`** — Clenshaw/Laguerre over Fock states (port of
  QuTiP `_wigner_clenshaw`), row-major `W[j,k] ↔ (yvec[j], xvec[k])` to match `meshgrid`. Off-diagonals
  doubled, diagonal single; final scale `Re(w0)·exp(−B/2)·(g²/2)/π`. f64 internally.
- **`mesolve`-equivalent** over $\rho$ at native dim (RK45/Dopri5 on the density matrix; `H_nh`
  regrouping), one frame of model-time per `step(dt)`; Hermitize + renormalize trace each accepted step.
- **observables per frame:** $t,\ \langle a^\dagger a\rangle,\ \langle\sigma_z\rangle,\ \mathrm{Tr}[\rho^2],\
  \delta_{\text{neg}}$ into a persistent buffer; Wigner grid into a persistent f32 buffer; both read
  zero-copy by the renderer (rebuild the typed-array view if WASM memory grows).
- **validation gate (CI, before deploy):** Rust/native test diffs $\langle a^\dagger a\rangle(t)$,
  $\langle\sigma_z\rangle(t)$, steady state, and the full Wigner grid against QuTiP goldens
  (`max err < 1e-4`); same convention ($g=\sqrt2$, $\sqrt{}$-rate collapse ops, QuTiP dissipator sign).

---

### Sources (real, as cited inline)

QuTiP master-equation & Wigner: `wigner.py` (Clenshaw, `g=√2`, off-diagonal ×2); Jaynes–Cummings
tutorial & `rabi-oscillations.ipynb` (collapse ops, params); visualization guide
(`Normalize(-W.max(),W.max())`, `cm.RdBu`). Royer PRA 15, 449 (1977); Cahill–Glauber PR 177, 1882
(1969); Wigner PR 40, 749 (1932). Deléglise et al., Nature 455, 510 (2008) (cat decoherence imaging).
Savona arXiv:0811.2502 ($(\gamma_x+\gamma_c)/2$ linewidth, complex normal modes). Boca/Kimble PRL 93,
233603 (2004) (vacuum-Rabi doublet). Gera–Sebastian JCP 156, 194304 (2022); Zeb PRA 106, 063720 (2022);
Botzung et al. PRB 102, 144202 (2020) (disordered Tavis–Cummings, grey states). Houdré–Stanley–Ilegems
PRA 53, 2711 (1996); Climent–Subotnik–Nitzan arXiv:2310.13860 (2023) (cavity protection / motional
narrowing). matplotlib `CenteredNorm` (symmetric diverging norm). Forn-Díaz et al. RMP 91, 025005
(2019) (ultrastrong threshold $g/\omega>0.1$ — flag, don't extrapolate JC).
