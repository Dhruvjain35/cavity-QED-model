# Open-Quantum Cavity-QED Layer — Physics Specification (Source of Truth)

> This document is the physics reference for the **open-system / dynamical** layer of the
> simulation: the Lindblad master equation, the Wigner phase-space view, static disorder, and the
> real-time observables. It is the dissipative complement to `PHYSICS-SPEC.md`, which covers the
> **closed-form eigenvalue** engine (System A dispersion, System B √N scaling, System C HTC
> turnover). That document explicitly **defers** cavity loss κ and Lindblad dissipation
> (`PHYSICS-SPEC.md §9`); this layer is what fills that gap.
>
> Every equation carries a citation. Where a convention is load-bearing (e.g. whether κ is an
> energy or amplitude decay rate, the Wigner `g` scaling, the pure-dephasing prefactor) it is
> stated explicitly, because a wrong factor of 2 silently corrupts every comparison to QuTiP.
>
> **Golden rule (inherited):** never render a quantity that is not computed from an equation in
> this file or `PHYSICS-SPEC.md`. No invented parameters, no decorative sliders that change nothing.
> **Validation rule:** every dynamical result must reproduce a QuTiP `mesolve`/`steadystate`/
> `wigner` call to a stated tolerance (`SOLVER-PLAN.md`).

---

## 0. Why this layer exists, and how it bolts onto the existing engine

The closed-form engine (`engine/microcavity.ts`, `engine/collective.ts`, `engine/htc.ts`) answers
*"where are the polariton energies and how big is the splitting?"* by diagonalizing a small
Hermitian matrix. It cannot answer *"how does the state evolve in time, how do the lines broaden
when the mirrors leak, and what does the quantum state of the field actually look like?"* — those
require an **open quantum system**: the cavity+emitter density matrix $\rho$ propagated under the
Lindblad master equation with explicit loss channels.

| Closed-form engine (`PHYSICS-SPEC.md`) | This open-system layer |
|---|---|
| 2×2 / $(N{+}1)$ Hermitian eigensolver → energies, Hopfield fractions | Lindblad propagation of $\rho(t)$ → time-resolved observables |
| Real eigenvalues; lines are infinitely sharp (ideal mirrors) | Complex eigenvalues / Lindblad widths; lines broadened by $\kappa,\gamma,\gamma_\phi$ |
| `polaritonBranches`, `rabiSplitting`, `etRateVsN` | photon number $\langle a^\dagger a\rangle(t)$, inversion $\langle\sigma_z\rangle(t)$, spectrum $S(\omega)$, purity $\mathrm{Tr}\,\rho^2$, Wigner $W(x,p)$ |
| Instant (slider-speed) | Integrated per frame in Rust/WASM (`SOLVER-PLAN.md`) |

**Concrete connection points (the layer reuses, not replaces, the existing physics):**

1. **System A — dispersion → broadened dispersion.** `microcavity.ts::polaritonBranches` gives the
   real $E_{\mathrm{LP/UP}}(k_\parallel)$. This layer adds the imaginary part: each branch acquires a
   width from the **same** non-Hermitian coupled-oscillator model (§6), so the anticrossing plot gains
   honest Lorentzian linewidths $(\kappa+\gamma)/2$ at resonance instead of zero-width lines.
2. **System B — √N splitting → damped Rabi dynamics.** `collective.ts::rabiSplitting` ($\Omega_R=2g\sqrt N$)
   sets the oscillation frequency of the vacuum-Rabi dynamics (§5.1); the dark-state count
   `darkStateCount` ($N{-}1$) is exactly the manifold that disorder turns "grey" (§7).
3. **System C — HTC turnover → loss-limited turnover.** `htc.ts` treats the cavity as **lossless**
   (the relaxation $\Gamma_\pm$ there is *molecular-vibration-induced*, not photon loss). This layer
   is the place to add a genuine cavity-loss channel $\sqrt\kappa\,a$ and ask how finite mirror
   quality (the "mirror reflectivity" knob shown as roadmap in `PHYSICS-SPEC.md §7`) affects the
   polariton-mediated ET path. **Do not conflate** the HTC $\Gamma_\pm$ with Lindblad $\kappa$.
4. **Shared parameters.** $g$, $N$, $\hbar\omega_c$, detuning $\Delta$, $k_BT$ are the *same* knobs
   the closed-form engine already exposes; this layer adds exactly three new ones — $\kappa$, $\gamma$,
   $\gamma_\phi$ — plus a disorder width $\sigma$ (§7).

> The honest framing for a physicist: the closed-form engine is the *spectral* picture (Hermitian,
> ideal mirrors); this layer is the *dissipative dynamical* picture (Lindblad, leaky mirrors). The
> tool shows both and labels which approximation is active.

---

## 1. The Lindblad (GKSL) master equation

The reduced density matrix $\rho$ of the cavity+emitter system, traced over the environment under
the Born–Markov(–secular) approximation, obeys the Gorini–Kossakowski–Sudarshan–Lindblad equation.
**QuTiP form** (the form the solver matches bit-for-bit):

$$\dot\rho(t)=-\frac{i}{\hbar}\,[H(t),\rho(t)]+\sum_n \frac{1}{2}\Big[2\,C_n\,\rho(t)\,C_n^{\dagger}-\rho(t)\,C_n^{\dagger}C_n-C_n^{\dagger}C_n\,\rho(t)\Big]$$

[QuTiP 5.x, *Lindblad Master Equation Solver* guide, transcribed verbatim — https://qutip.readthedocs.io/en/latest/guide/dynamics/dynamics-master.html]

Algebraically identical **symmetric-anticommutator (dissipator) form** used in derivations:

$$\frac{d\rho}{dt}=-\frac{i}{\hbar}[H,\rho]+\sum_k\Big(L_k\,\rho\,L_k^{\dagger}-\tfrac{1}{2}\{L_k^{\dagger}L_k,\rho\}\Big)$$

[Breuer & Petruccione, *The Theory of Open Quantum Systems*, §3.2.2 "The Markovian quantum master
equation" (p. 119), §3.2.1 "Quantum dynamical semigroups" (p. 117)]. Here $L_k \equiv C_n$.

**Collapse-operator definition** (the rate is folded *into* the operator as a square root):

$$C_n=\sqrt{\gamma_n}\,A_n$$

[QuTiP guide, verbatim]. $A_n$ is the system operator through which the bath couples; $\gamma_n$ is
the corresponding rate. **Implementation warning:** because $C_n$ already carries $\sqrt{\gamma_n}$,
the dissipator must **not** carry an extra factor of $\gamma_n$ — a common double-counting bug.

### 1.1 Non-Hermitian regrouping (used by the integrator)

For the solver it is cheaper to precompute the effective non-Hermitian Hamiltonian and write the
RHS as one commutator-like term plus the "recycling" terms:

$$\dot\rho = -\frac{i}{\hbar}\big(H_{\mathrm{nh}}\rho - \rho H_{\mathrm{nh}}^{\dagger}\big) + \sum_k L_k\rho L_k^{\dagger},\qquad H_{\mathrm{nh}} = H - \frac{i\hbar}{2}\sum_k L_k^{\dagger}L_k$$

[QuantumOptics.jl, *Master equation* docs — https://docs.qojulia.org/timeevolution/master/]. This is
the algebraic regrouping the Rust solver uses (`SOLVER-PLAN.md`); it halves the matrix products.

### 1.2 Steady state

For time-independent $H,C_n$ the system relaxes to $\rho_{ss}$:

$$\frac{d\rho_{ss}}{dt}=\mathcal{L}\,\rho_{ss}=0$$

[QuTiP, *Solving for Steady-State Solutions* — https://qutip.readthedocs.io/en/latest/guide/guide-steady.html].
$\rho_{ss}$ is the right null vector of the Liouvillian superoperator $\mathcal{L}$. It is unique
when at least one loss channel breaks all conserved quantities (generically true once $\kappa>0$).
This is computed directly (sparse solve), not by integrating $t\to\infty$.

---

## 2. The system Hamiltonian (Jaynes–Cummings / Tavis–Cummings)

### 2.1 Jaynes–Cummings — single emitter, RWA

$$\hat{H}_{\mathrm{JC}} = \hbar\omega_c\,\hat{a}^{\dagger}\hat{a} + \tfrac{1}{2}\hbar\omega_{a}\,\hat{\sigma}_z + \hbar g\,(\hat{a}^{\dagger}\hat{\sigma}_{-} + \hat{a}\,\hat{\sigma}_{+})$$

[QuTiP tutorial *Lecture 1 — Jaynes–Cummings model*, verbatim —
https://github.com/qutip/qutip-tutorials/blob/main/tutorials-v5/lectures/Lecture-1-Jaynes-Cumming-model.md;
consistent with `PHYSICS-SPEC.md §B.1`]. $\omega_c$ cavity frequency, $\omega_a$ emitter frequency,
$g$ single-photon coupling (vacuum Rabi frequency $\Omega_R = 2g$). Conserves excitation number
$\hat a^\dagger\hat a + \hat\sigma_+\hat\sigma_-$.

### 2.2 Tavis–Cummings — $N$ emitters, RWA

$$\hat{H}_{\mathrm{TC}} = \hbar\omega_c\,\hat{a}^{\dagger}\hat{a} + \sum_{j=1}^{N}\Big[\tfrac{1}{2}\hbar\omega_j\,\hat{\sigma}_{z,j} + \hbar g_j\,(\hat{a}^{\dagger}\hat{\sigma}_{-,j} + \hat{\sigma}_{+,j}\hat{a})\Big]$$

[Tavis & Cummings, *Phys. Rev.* **170**, 379 (1968), DOI 10.1103/PhysRev.170.379; form in
`PHYSICS-SPEC.md §B.4`, Dong et al. arXiv:2110.14174 Eq. 5]. For identical emitters ($\omega_j=\omega_a$,
$g_j=g$) only the symmetric **bright** combination couples, giving the collective coupling and
splitting that the closed-form engine already implements:

$$g_N = g\sqrt{N},\qquad \Omega_R^{(N)} = 2g\sqrt{N}$$

[Mandal et al., *Chem. Rev.* **123**, 9786 (2023), Eq. 13; = `collective.ts::rabiSplitting`]. The
remaining $N{-}1$ states are dark (`collective.ts::darkStateCount`); §7 is what happens to them under
disorder.

### 2.3 Dressed-state ladder (for the spectrum and blockade)

$$E_{n,\pm} = \big(n+\tfrac{1}{2}\big)\hbar\omega_c \pm \tfrac{1}{2}\hbar\,\Omega_n,\qquad \Omega_n = \sqrt{(\omega_c-\omega_a)^2 + 4g^2(n+1)}$$

[Computational Quantum Optics, Lecture 2 —
https://daniele-pybectn.github.io/Computational_quantum_optics_lectures/lecture2/jaynes_cummings.html;
vacuum ($n=0$) splitting $2g$ matches `PHYSICS-SPEC.md §B.2`]. The $\sqrt{n+1}$ anharmonicity is the
ladder the closed-form `jcSplitting` exposes; here it also seeds collapse-and-revival (§5.2).

---

## 3. The three physical collapse operators

These are the **exact** channels the solver implements. Rates are in the QuTiP/energy-decay
convention (§3.4).

### 3.1 Cavity photon loss (imperfect mirrors), $T=0$

$$L_{\mathrm{cav}}=\sqrt{\kappa}\,\hat{a}$$

[QuTiP JC tutorial: `np.sqrt(kappa*(1+n_th))*a`, at $n_{\mathrm{th}}=0$ → $\sqrt\kappa\,a$]. $\kappa$
is the cavity **energy/intensity** decay rate. **This is the channel `PHYSICS-SPEC.md §9` defers** —
adding it here is the whole point of this layer.

### 3.2 Cavity loss at finite temperature (two operators)

$$L_{\downarrow}=\sqrt{\kappa(1+n_{\mathrm{th}})}\,\hat{a},\qquad L_{\uparrow}=\sqrt{\kappa\,n_{\mathrm{th}}}\,\hat{a}^{\dagger},\qquad n_{\mathrm{th}}=\frac{1}{e^{\hbar\omega_c/k_BT}-1}$$

[QuTiP JC tutorial collapse list]. Include the thermal-pumping operator only when $n_{\mathrm{th}}$ is
non-negligible. At optical frequencies and room temperature $n_{\mathrm{th}}\approx 0$ (default off);
it matters in microwave/circuit-QED. $n_{\mathrm{th}}$ uses the same $k_BT$ knob as the HTC engine.

### 3.3 Emitter spontaneous emission

$$L_{\mathrm{sp}}=\sqrt{\gamma}\,\hat{\sigma}_{-}$$

[QuTiP JC tutorial: `np.sqrt(gamma)*sm`]. $\gamma$ is the emitter **population** (excited-state) decay
rate; excited-state lifetime $1/\gamma$. Emission into non-cavity modes.

### 3.4 Pure dephasing

$$L_{\phi}=\sqrt{\frac{\gamma_{\phi}}{2}}\,\hat{\sigma}_z$$

[QuTiP convention; collapse op for pure dephasing $=\sqrt{\gamma_\phi/2}\,\sigma_z$ —
https://groups.google.com/g/qutip/c/YxcYvLUS44I]. With this $\sqrt{\gamma_\phi/2}$ prefactor the
off-diagonal coherence decays at rate $\gamma_\phi$ **without** changing populations. (Convention note:
$L=\sqrt{g}\,\sigma_z$ would damp transverse Bloch components at $2g$, hence the $/2$.) Relates to a
measured $T_2$ via $1/T_2 = \gamma/2 + \gamma_\phi$ — state the mapping per source.

### 3.5 Rate conventions (the #1 numerical pitfall — fix these end-to-end)

- **$\kappa$ is an energy/intensity (FWHM) rate.** With $L=\sqrt\kappa\,a$, the photon-number
  expectation $\langle a^\dagger a\rangle$ decays at rate $\kappa$; photon lifetime
  $\tau_{\mathrm{photon}}=1/\kappa$; quality factor $Q=\omega_c/\kappa$. Some quantum-optics texts
  define $\kappa$ as the **field/amplitude** (HWHM) rate so energy decays at $2\kappa$ — that carries
  a factor of 2 vs here. **We use the QuTiP convention.** [Standard cavity definitions; consistent with
  QuTiP treating $\kappa$ as the cavity dissipation rate.]
- **$\gamma$ is the population-decay (FWHM) rate** (same family as $\kappa$).
- **$\gamma_\phi$ uses the $\sqrt{\gamma_\phi/2}\,\sigma_z$ form** so coherence decays at $\gamma_\phi$.

Pin one convention, state it in the UI, and only then compare to experimental linewidths.

---

## 4. Loss-broadened polaritons (how this connects to the dispersion view)

### 4.1 Complex normal-mode eigenfrequencies (damped two-oscillator)

$$\omega_{\pm}=\frac{\omega_x+\omega_c-i(\gamma_x+\gamma_c)}{2}\;\pm\;\frac{1}{2}\sqrt{\Omega_R^{2}+\big(\omega_x-\omega_c-i(\gamma_x-\gamma_c)\big)^{2}}$$

[Savona, *Fifteen years of microcavity polaritons*, arXiv:0811.2502, Eq. 1]. $\mathrm{Re}\,\omega_\pm$
are the peak positions (the **same** anticrossing the closed-form `polaritonBranches` gives);
$2|\mathrm{Im}\,\omega_\pm|$ are the FWHM linewidths. This is the non-Hermitian version of the §A.3
Hopfield matrix — the loss simply adds $-i\gamma/2$ to each diagonal.

### 4.2 Resonant linewidth and strong-coupling criteria

At zero detuning ($\omega_x=\omega_c$) both polaritons share the **arithmetic-average** width:

$$\Gamma_{\pm}=\frac{\gamma_x+\gamma_c}{2}\;=\;\frac{\kappa+\gamma}{2}\qquad(\text{resonance})$$

[Savona arXiv:0811.2502, text after Eq. 1: "arithmetic average of the two initial damping rates"; the
$(\kappa+\gamma)/2$ vacuum-Rabi peak width is also the spectroscopic result of Boca, Miller, Kimble
et al., *Phys. Rev. Lett.* **93**, 233603 (2004)]. **Strong coupling / resolved doublet** requires the
coupling to beat the loss:

$$2\,\Omega_R > (\kappa+\gamma),\qquad g \ge \frac{|\gamma_{\mathrm{ph}}-\gamma_X|}{2}$$

[$2\Omega_R>(K+\Gamma)$: *Molecular Strong Coupling and Cavity Finesse*, arXiv:2211.08300, Eq. 2;
real-splitting condition $g\ge|\gamma_{\mathrm{ph}}-\gamma_X|/2$ from the coupled-oscillator treatment,
Törmä & Barnes, *Rep. Prog. Phys.* **78**, 013901 (2015), arXiv:1405.1661].

> ⚠️ **Uncertain phrasing.** The exact line "resonant polariton width $=(\kappa+\gamma)/2$ with these
> symbols" is the standard $2\times2$ non-Hermitian coupled-oscillator result but was **not** found
> stated verbatim in a single primary source; it follows from Savona Eq. 1 above. The published
> *inequalities* ($2\Omega_R>K+\Gamma$; $g\ge|\gamma_{\mathrm{ph}}-\gamma_X|/2$) are direct quotes.

---

## 5. Real-time observables (the dynamical plots)

All are cheap traces $\langle O\rangle=\mathrm{Tr}[O\rho(t)]$ computed each frame from the propagated
$\rho$.

### 5.1 Damped vacuum-Rabi oscillations

Cavity photon number $\langle\hat a^\dagger\hat a\rangle(t)$ and excited-state population
$\langle\hat\sigma_+\hat\sigma_-\rangle(t)$ (or inversion $\langle\hat\sigma_z\rangle(t)$). In the
single-excitation sector, energy swaps coherently at $2g$ under a decaying envelope:

$$P_e(t)\;\approx\; e^{-(\kappa+\gamma)t/2}\,\cos^2(g t),\qquad \Omega_{\mathrm{vac}}=2g$$

[Undamped $P_e=\cos^2(gt)$ (resonant single-excitation), QuTiP/Wikipedia *Vacuum Rabi oscillation*;
$e^{-(\kappa+\gamma)t/2}$ envelope follows from the §4.2 linewidth].

> ⚠️ **Illustrative closed form.** The exact envelope prefactor is **not** pinned to one cited
> primary equation and is exact only when $2g\gg\kappa,\gamma$ and $\gamma_\phi=0$. **Compute the
> envelope numerically from the Lindblad solver, do not hard-code it.** Each single-excitation normal
> mode is half-atom/half-photon, so its *amplitude* decays at the average $(\kappa+\gamma)/4$, hence
> the *population* envelope $\sim e^{-(\kappa+\gamma)t/2}$.

### 5.2 Collapse-and-revival (a quantization fingerprint)

With the field initialized in a coherent state $|\alpha\rangle$:

$$\langle\hat\sigma_z(t)\rangle = \sum_{n=0}^{\infty} P_n\,\cos(2\Omega_n t),\qquad P_n = e^{-|\alpha|^2}\,\frac{|\alpha|^{2n}}{n!}$$

[Computational Quantum Optics, Lecture 2, collapse–revival section]. Interference of the
$n$-dependent Rabi frequencies $\Omega_n$ (§2.3) collapses then revives the inversion — a signature
with no classical analog.

### 5.3 Emission / absorption spectrum (the polariton doublet)

Two Lorentzians at the normal-mode frequencies, each broadened by the loss:

$$S(\omega)\;\propto\;\sum_{\pm}\frac{\Gamma/2}{(\omega-\omega_{\pm})^2 + (\Gamma/2)^2},\quad \omega_{\pm}=\omega_c\pm g\ (N{=}1),\quad \omega_{\pm}=\omega_c\pm g\sqrt N\ (N\ \text{emitters}),\quad \Gamma=\frac{\kappa+\gamma}{2}$$

[Doublet split by $2g\sqrt N$, FWHM $(\kappa+\gamma)/2$: Boca/Kimble, *PRL* **93**, 233603 (2004)].
Resolvable only in strong coupling (§4.2); as $g$ drops the doublet merges into one bare-cavity peak.
For a rigorous spectrum (driven/nonlinear) use the **Wiener–Khinchin** route on the steady-state
two-time correlation:

$$S(\omega)=\int_{-\infty}^{\infty}\langle \hat a^{\dagger}(\tau)\,\hat a(0)\rangle\,e^{-i\omega\tau}\,d\tau$$

[QuTiP *Two-time correlation functions* guide — https://qutip.org/docs/4.7/guide/guide-correlation.html
(`spectrum_ss` / `spectrum_correlation_fft`)]. The analytic two-Lorentzian form is the fast
linear-response approximation; flag it as such.

### 5.4 Purity / decoherence meter

$$\mathcal{P}(t) = \mathrm{Tr}[\rho(t)^2],\qquad \frac{1}{d}\le \mathcal{P}\le 1$$

[Standard; $d$ = truncated Hilbert dimension]. $\mathcal{P}=1$ pure, $\mathcal{P}=1/d$ maximally
mixed. Monotone-ish decay under any of $\kappa,\gamma,\gamma_\phi$ — the dedicated quantitative
coherence trace (plotted as an axis, never as a glow). Cheap: $\mathrm{Tr}[\rho^2]=\|\rho\|_F^2$.

### 5.5 Entanglement & coherence (optional, regime-gated)

- **von Neumann entropy** of the reduced state — valid as an *entanglement* measure **only while the
  global state is pure** (unitary regime): $S(\rho_A)=-\sum_i\lambda_i\log_2\lambda_i$,
  $\rho_A=\mathrm{Tr}_{\mathrm{field}}|\psi\rangle\langle\psi|$ [Phoenix & Knight, arXiv:quant-ph/0505119].
  Once $\kappa,\gamma,\gamma_\phi$ make the global state mixed, $S$ measures *mixedness*, not
  entanglement — switch to concurrence/negativity and **label which measure is valid**.
- **Wootters concurrence** (two-qubit truncation only): $C(\rho)=\max\{0,\sqrt{\lambda_1}-\sqrt{\lambda_2}-\sqrt{\lambda_3}-\sqrt{\lambda_4}\}$
  [Wootters, *PRL* **80**, 2245 (1998)]. Requires a genuine 4-dim two-qubit state (atom + 0/1-photon
  subspace, or two emitters); undefined otherwise.
- **$\ell_1$-coherence:** $C_{\ell_1}(\rho)=\sum_{i\ne j}|\rho_{ij}|$ [Baumgratz, Cramer & Plenio,
  *PRL* **113**, 140401 (2014)]; basis-dependent, no diagonalization.

---

## 6. The Wigner quasiprobability distribution (the centerpiece view)

A real (possibly negative) quasiprobability over field phase space; the standard way to "see" the
cavity field state.

### 6.1 Definitions

**Position-basis integral (Weyl) form:**

$$W(x,p) = \frac{1}{\pi\hbar}\int_{-\infty}^{\infty} \langle x-y\,|\,\hat{\rho}\,|\,x+y\rangle\, e^{2ipy/\hbar}\, dy$$

[Wigner, *Phys. Rev.* **40**, 749 (1932); Wikipedia *Wigner quasiprobability distribution*].

**Displaced-parity (Grossmann–Royer / Cahill–Glauber) form — used numerically:**

$$W(\alpha) = \frac{2}{\pi}\,\mathrm{Tr}\!\big[\hat{D}(\alpha)\,\hat{\rho}\,\hat{D}^{\dagger}(\alpha)\,(-1)^{\hat{a}^{\dagger}\hat{a}}\big]$$

[A. Royer, *Phys. Rev. A* **15**, 449 (1977); $s{=}0$ case of Cahill & Glauber, *Phys. Rev.* **177**,
1882 (1969)]. $\hat D(\alpha)=e^{\alpha a^\dagger-\alpha^* a}$, $(-1)^{\hat a^\dagger\hat a}$ is the
photon-number parity. $\alpha=(x+ip)/\sqrt2$.

### 6.2 Properties

$$\int\! W\,dx\,dp = \mathrm{Tr}\,\rho = 1,\qquad \int\! W\,dp = \langle x|\rho|x\rangle,\qquad -\frac{2}{h}\le W \le \frac{2}{h}\ \Longleftrightarrow\ |W|\le \frac{1}{\pi}\ (\hbar=1)$$

[Wikipedia *Wigner quasiprobability distribution*]. The marginals reproduce true quadrature
probabilities; the bound comes from parity eigenvalues $\pm1$. **Negativity ($W<0$ anywhere) is a
sufficient witness of non-classicality** — the headline readout. Negative-volume metric:

$$\delta = \tfrac{1}{2}\Big(\int |W|\,dx\,dp - 1\Big)\in[0,1],\qquad \delta>0 \Rightarrow \text{non-classical}.$$

### 6.3 Canonical state signatures (what the panel must reproduce)

| State | $W$ | Look |
|---|---|---|
| Vacuum / coherent | $W_{|\beta\rangle}=\frac{2}{\pi}e^{-2|\alpha-\beta|^2}$ | round positive Gaussian, offset to $\beta$ |
| Fock $|n\rangle$ | $W_{|n\rangle}=\frac{2}{\pi}(-1)^n e^{-2|\alpha|^2}L_n(4|\alpha|^2)$ | concentric rings; negative core for $n\ge1$ |
| Cat $\tfrac{1}{\mathcal N}(|\beta\rangle+|-\beta\rangle)$ | two Gaussians + central $\propto e^{-2|\alpha|^2}\cos(4\beta\,\mathrm{Im}\,\alpha)$ fringe | two lobes bridged by sign-alternating fringes |
| Squeezed | positive Gaussian | area-preserving ellipse |
| Thermal | broad positive Gaussian, variance $\sim(2\bar n{+}1)$ | wide centered blob |

[Coherent/Fock forms: Wikipedia *Wigner quasiprobability distribution* and Walls & Milburn,
*Quantum Optics* Ch. 4, in the $\hbar=1$, $g=\sqrt2$ convention; cat structure: Deléglise et al.,
*Nature* **455**, 510 (2008)].

> ⚠️ **Convention-dependent constants.** The factors of 2 and 4 in the exponentials/Laguerre argument
> and the $2/\pi$ vs $1/\pi$ prefactor depend on the quadrature scaling. The forms above are the
> QuTiP $g=\sqrt2$ ($\hbar=1$) convention (§6.4). The even-cat normalization/fringe term was
> transcribed schematically; verify against the cited primary equations before locking constants.

### 6.4 QuTiP numerical convention (lock this end-to-end)

$$a = \tfrac{1}{2}\,g\,(x + i y),\qquad \hbar = \frac{2}{g^{2}},\qquad g=\sqrt{2}\Rightarrow \hbar=1$$

[QuTiP `qutip.wigner` docstring — https://qutip.readthedocs.io/en/latest/_modules/qutip/wigner.html
(refs U. Leonhardt, *Measuring the Quantum State of Light*, CUP 1997)]. With $g=\sqrt2$: vacuum
$W=e^{-x^2-y^2}/\pi$, peak $=1/\pi$.

### 6.5 Numerical form — Clenshaw/Laguerre recurrence (QuTiP default)

The solver evaluates $W$ on the whole $x$–$p$ grid via QuTiP's `_wigner_clenshaw` (numerically
stable for high Fock number). Treat $W$ as a polynomial series in $A=g(x+ip)$, summed by Clenshaw
recursion over the Fock index $L=0..M{-}1$ ($M=\dim\rho_{\mathrm{cavity}}$). Grid: $A_2=g(X+iY)$,
$B=|A_2|^2$. Per QuTiP source, off-diagonals of $\rho$ are doubled (factor 2 for Hermitian pairs),
the sweep accumulates $w_0 \leftarrow \texttt{lag\_val}(L,B,\mathrm{diag}_L) + w_0\,A_2\,(L{+}1)^{-1/2}$,
and the result is $W=\mathrm{Re}(w_0)\,e^{-B/2}\,(g^2/2)/\pi$. Full recurrence and the exact
off-diagonal weighting are specified in `SOLVER-PLAN.md` / `WIGNER-VIZ-SPEC.md`.

[QuTiP `qutip/wigner.py` — https://github.com/qutip/qutip/blob/master/qutip/wigner.py; underlying
Laguerre form from Leonhardt 1997.]

### 6.6 Polariton / decoherence note

For a polariton (hybrid photon–exciton mode), the **photon-reduced** Wigner function (partial-trace
the emitter, then evaluate $W$ on $\rho_{\mathrm{cavity}}$) inherits whatever non-classicality the
coupling generates; as a mixed reduced state it is generally smoother/positive unless the dynamics
produce true negativity. **Decoherence is computed upstream by the Lindblad equation** (§1, §3):
cavity loss and dephasing damp the off-diagonal coherences that produce fringes/negativity faster
than they move the peaks, so $W$ relaxes toward a positive Gaussian — exactly the fringe wash-out
imaged by Deléglise et al. (2008). $W$ is **recomputed from the time-evolved $\rho(t)$**, never
smoothed by hand.

---

## 7. Static disorder / inhomogeneous broadening (the realistic layer)

This is the realistic-physics layer the closed-form System B/C explicitly defers
(`PHYSICS-SPEC.md §9`: "$N{-}1$ dark states treated as ideal/degenerate"). It is the microscopic
origin of the large-$N$ dark-state problem.

### 7.1 Gaussian (diagonal) disorder model

Each emitter's transition energy is an independent Gaussian random variable:

$$P(\omega) = \frac{1}{\sqrt{2\pi}\,\sigma}\,e^{-(\omega-\omega_0)^2/2\sigma^2},\qquad \omega_j \sim \mathcal{N}(\omega_0,\sigma^2)$$

[Zeb, *Phys. Rev. A* **106**, 063720 (2022), Eq. 24 (arXiv:2208.11990); same model in Gera & Sebastian,
*J. Chem. Phys.* **156**, 194304 (2022)]. Disorder enters **only** on the emitter-energy diagonal —
do **not** perturb the off-diagonal couplings (that would be a distinct, separate coupling-disorder
effect). $\sigma$ is the single new knob; the controlling dimensionless parameter is $\sigma/g_N=\sigma/(g\sqrt N)$.

### 7.2 Disordered Tavis–Cummings Hamiltonian (single-excitation sector)

$$\hat{H} = \epsilon_c\,|c\rangle\langle c| + \sum_{i=1}^{N}(\epsilon_a+\xi_i)\,|a_i\rangle\langle a_i| + \sum_{i=1}^{N}\big(V_i\,|c\rangle\langle a_i| + V_i^{*}\,|a_i\rangle\langle c|\big)$$

[Gera & Sebastian, *JCP* **156**, 194304 (2022), Eqs. 1–2]. $|c\rangle$ = singly-excited cavity,
$|a_i\rangle$ = emitter $i$ excited, $\xi_i$ = random shift. This is an **arrowhead** matrix (cavity
row/column couples to every emitter; the emitter block is now non-degenerate):

$$\hat{H} = \begin{pmatrix} w_1 & 0 & \cdots & 0 & g \\ 0 & w_2 & & 0 & g \\ \vdots & & \ddots & & \vdots \\ 0 & 0 & & w_N & g \\ g & g & \cdots & g & 0 \end{pmatrix}$$

[Botzung et al., *Phys. Rev. B* **102**, 144202 (2020), Eq. B1 (arXiv:2003.07179)]. The arrowhead
structure is *why* disorder mixes bright and dark: the symmetric bright mode is no longer an exact
eigenstate.

### 7.3 What disorder does — three linked effects

**(a) Dark states turn "grey."** Each formerly-dark eigenstate acquires photonic weight

$$\big|\langle G,1|\psi_{\alpha\neq\pm}\rangle\big|^2 \;\sim\; \frac{1}{N}$$

[Botzung et al., *PRB* **102**, 144202 (2020), §III.A; corroborated Gera & Sebastian 2022 — "dark
states … turn grey … contribution to the absorption increasing with $\sigma$"]. The $N{-}1$
dark-state manifold (`collective.ts::darkStateCount`) becomes a dense, nearly-dark reservoir.

**(b) Polariton gap shift and Fano broadening.** On resonance the gap grows:

$$E_+ - E_- \;\to\; 2g_c + \frac{2\sigma^2}{\sqrt{N}\,|\tilde{V}|}$$

[Gera & Sebastian 2022, on-resonance result]. Each polariton picks up a disorder-induced (Fano-type)
width

$$F(\omega) = \pi\,\omega_R^2\,P(\omega)\,\mathrm{erfi}\!\Big(\frac{\omega}{\sqrt{2}\,\sigma}\Big),\qquad \mathrm{erfi}(\omega)=\mathrm{erf}(i\omega)/i$$

[Zeb, *PRA* **106**, 063720 (2022), Eqs. 25–26]. Width grows with $\sigma$ until, at
$\sigma\gtrsim g_N$, the two peaks merge into a single bare-cavity resonance — the strong→weak
crossover.

> ⚠️ The prefactor $2\sigma^2/(\sqrt N|\tilde V|)$ is taken from the Gera & Sebastian abstract/result
> statement; the precise definition/normalization of $\tilde V$ vs $g_c$ was not hand-re-derived.
> Botzung et al. use **box** disorder; the qualitative conclusions carry over to Gaussian but exact
> distributions differ.

**(c) Cavity protection / motional narrowing.** The polariton lines are far **more robust** to
$\sigma$ than the bare ensemble: for large Rabi splitting the polariton width is dominated by the
**homogeneous** ($\kappa,\gamma$) widths, not the full inhomogeneous $\sigma$. In the Kubo–Anderson
fast limit:

$$I(\omega)=\frac{2\Gamma}{\omega^2+\Gamma^2},\qquad \Gamma = \tau_c\,\Omega^2 = \alpha\,\Omega \;\ll\; \Omega$$

[Climent, Subotnik & Nitzan, *Kubo–Anderson theory of polariton lineshape*, arXiv:2310.13860 (2023),
fast limit; effect first noted by Houdré, Stanley & Ilegems, *Phys. Rev. A* **53**, 2711 (1996)].
This is the "two-curve" demonstration: bare-ensemble width tracks $\sigma$ linearly while polariton
width stays near the lifetime floor.

> ⚠️ The full-text of Houdré et al. (1996) could not be read first-hand (paywalled); the insensitivity
> result is corroborated by its abstract and a 2025 review (arXiv:2505.20601). A simple
> Hopfield-weighted homogeneous width $\gamma_{\mathrm{LP/UP}}=|X|^2\gamma_X+|C|^2\gamma_c$ (the
> natural complement to §4.2, reusing `microcavity.ts::hopfield`) is widely used but was not pinned to
> one canonical citation here; use it as the homogeneous floor, label it as the coupled-oscillator
> result.

### 7.4 Numerical handling

Single-excitation sector: the matrix is $(N{+}1)\times(N{+}1)$, exact diagonalization $O(N^3)$, cheap
to $N\sim10^3$–$10^4$, averaged over $10^2$–$10^4$ Gaussian realizations. Real molecular ensembles
($N\sim10^6$–$10^{12}$, `PHYSICS-SPEC.md §B`) are intractable by brute force — the literature uses the
photon Green's-function / self-energy in the thermodynamic limit (Zeb, Gera & Sebastian) or CUT-E
$1/N$ reductions. Including loss: add $-i\kappa/2$ to the cavity diagonal and $-i\gamma/2$ to each
emitter diagonal (non-Hermitian effective Hamiltonian); for large Rabi splitting the polariton width
is then dominated by these homogeneous terms — the numerical signature of cavity protection (§7.3c).

---

## 8. Parameter regimes — the new knobs and the coupling map

The closed-form engine already owns $g$/$g_N$, $N$, $\hbar\omega_c$, $\Delta$, $k_BT$. This layer adds
**$\kappa$, $\gamma$, $\gamma_\phi$, $\sigma$** (and optional $n_{\mathrm{th}}$).

### 8.1 Cooperativity and coupling-regime criteria

$$C = \frac{g^2}{\kappa\,\gamma},\qquad f_P = 2C = \frac{2g^2}{\kappa\,\gamma};\qquad \text{strong: } C>1\ \Leftrightarrow\ 2g>\kappa,\gamma;\qquad \text{ultrastrong: } \eta=\frac{g}{\omega_c}>0.1$$

[Cooperativity $C=g^2/(\kappa\gamma)$ and Purcell $f_P=2C$, strong coupling $C>1$: cavity-QED review,
*New J. Phys.* **22**, 073012 (2020); USC threshold $\eta>0.1$, deep-strong $\eta>1$: Forn-Díaz et al.,
*Rev. Mod. Phys.* **91**, 025005 (2019); Frisk Kockum et al., *Nat. Rev. Phys.* **1**, 19 (2019)].

| Regime | Condition | Behavior |
|---|---|---|
| Weak | $C<1$ ($2g<\kappa,\gamma$) | irreversible decay, Purcell-enhanced emission, **single** peak |
| Strong | $C>1$ ($2g>\kappa,\gamma$) | reversible exchange, vacuum-Rabi oscillations, **resolved doublet** |
| Ultrastrong | $\eta=g/\omega_c>0.1$ | RWA fails → **full Rabi model** required (add counter-rotating $a^\dagger\sigma_+ + a\sigma_-$); reconsider collapse ops (dressed-state) |

> ⚠️ **Cooperativity convention.** $C=g^2/(\kappa\gamma)$ is the common form; some texts write
> $g^2/(2\kappa\gamma)$ or $4g^2/(\kappa\gamma)$ depending on whether $\kappa,\gamma$ are amplitude
> (HWHM) or energy (FWHM) rates and on factors of 2 in $g$. Fix energy-decay rates and $g$ as half the
> vacuum splitting; the factor only shifts the $C=1$ boundary, not the physics. **Gate the UI into the
> full Rabi model when $\eta>0.1$ — never silently extrapolate JC.**

### 8.2 The new knobs

| Symbol | Meaning | Units | Default | Range | Effect |
|---|---|---|---|---|---|
| $\kappa$ | cavity energy-decay rate ($L=\sqrt\kappa\,a$) | (freq units of $g$) | small ($\ll g$) | $0 \ldots {\sim}10g$ | photon lifetime $1/\kappa$, $Q=\omega_c/\kappa$; broadens both peaks |
| $\gamma$ | emitter population decay ($L=\sqrt\gamma\,\sigma_-$) | (freq units of $g$) | small | $0 \ldots {\sim}10g$ | excited-state lifetime $1/\gamma$ |
| $\gamma_\phi$ | pure dephasing ($L=\sqrt{\gamma_\phi/2}\,\sigma_z$) | (freq units of $g$) | 0 | $0 \ldots {\sim}10g$ | kills coherence/fringes, not populations |
| $\sigma$ | Gaussian disorder width | (freq units of $g_N$) | 0 | $0 \ldots {\sim}2g_N$ | grey states, peak broadening, $\sigma/g_N\sim1$ collapse |
| $n_{\mathrm{th}}$ | thermal photon number | – | 0 | $0\ldots$few | thermal pumping (microwave only) |

> Honest cavity-geometry map (completes `PHYSICS-SPEC.md §7`): **mirror reflectivity / finesse →
> photon lifetime → $\kappa = \omega_c/Q$.** This is the knob `PHYSICS-SPEC.md §7` shows as "DEFERRED";
> this layer makes it active and routes it through $\kappa$, not a fake standalone slider.

---

## 9. Validation targets (the dynamical layer MUST reproduce these against QuTiP)

Full harness and tolerances in `SOLVER-PLAN.md`; the canonical reproductions are:

1. **Damped vacuum-Rabi (golden):** $N{=}20$ Fock, $\omega_c=\omega_a=2\pi$, $g=0.05\cdot2\pi$,
   $\kappa=0.005$, $\gamma=0.05$, $n_{\mathrm{th}}=0$, $\psi_0=|0\rangle_{\mathrm{fock}}\otimes|e\rangle$.
   Reproduce QuTiP `mesolve` $\langle a^\dagger a\rangle(t)$ and $\langle\sigma_z\rangle(t)$
   point-by-point. [QuTiP `rabi-oscillations.ipynb`.]
2. **Steady state:** $\sqrt\kappa\,a$ only ⇒ $\langle a^\dagger a\rangle_{ss}\to0$; with a coherent
   drive, match `qutip.steadystate(H,c_ops)`.
3. **Wigner grid:** for coherent $|\alpha{=}2\rangle$, Fock $|3\rangle$ (ring + negativity), and an
   even cat (fringes), match `qutip.wigner(rho, xvec, yvec, method='clenshaw', g=√2)` element-wise;
   normalization $\int W\,dx\,dp=1$; coherent peak $=1/\pi$.
4. **Loss-broadened linewidth:** at resonance each polariton FWHM $=(\kappa+\gamma)/2$ (§4.2).
5. **Strong→weak crossover:** doublet merges to one peak as $2g$ drops below $(\kappa+\gamma)$.
6. **Disorder collapse:** disorder-averaged spectrum stays a doublet for $\sigma/g_N\ll1$ and merges
   near $\sigma/g_N\sim1$ (§7.3); dark-state band brightens with $\sigma$.
7. **Purity:** $\mathcal{P}=1$ for a pure initial state, monotone decay under any loss channel.

---

## 10. Limitations of this layer (state in the UI — physicists trust honesty)

- **RWA / JC–TC only by default.** Counter-rotating terms dropped; valid in strong-but-not-ultrastrong
  ($\eta=g/\omega_c<0.1$). Above that the UI must switch to the full quantum Rabi model and
  reconsider the (dressed-state) collapse operators (§8.1).
- **Born–Markov–secular.** Lindblad assumes a memoryless bath and well-separated timescales; non-
  Markovian and structured-bath effects are out of scope.
- **Single cavity mode.** Multimode (the realistic Fabry–Pérot case Shravan is moving toward) is not
  in this layer (inherits `PHYSICS-SPEC.md §9`).
- **Static (diagonal) disorder only.** $\omega_j\sim\mathcal N(\omega_0,\sigma^2)$ on the emitter
  diagonal; no dynamic disorder, no coupling/orientational disorder, no spatial correlation.
- **Fock truncation.** The cavity is truncated to $M$ levels; every result is only trustworthy once
  occupation of the top level is negligible — converge by raising $M$ (`SOLVER-PLAN.md`). $M$ (photon
  Fock cutoff, ~20–80) is **not** `htc.ts`'s $N$/$N_{\max}$ (a molecule count).
- **HTC coupling stays Marcus/FGR.** Adding $\kappa$ to System C is a *roadmap* extension; the
  current HTC turnover (`htc.ts`) remains the lossless, vibration-relaxation result and must not be
  silently merged with Lindblad $\kappa$.

---

### Companion documents
- Physics (closed-form engine): `PHYSICS-SPEC.md` · Engine code: `../engine/`
- Solver architecture + QuTiP validation harness: `SOLVER-PLAN.md`
- Wigner / dynamics rendering conventions: `WIGNER-VIZ-SPEC.md`
- Verification ledger: `VERIFICATION-REPORT.md` · Source catalog: `REFERENCES.md`

---

**Summary (6 lines).**
This spec defines the open-system / dynamical layer: the Lindblad master equation
$\dot\rho=-\frac{i}{\hbar}[H,\rho]+\sum_n\frac12[2C_n\rho C_n^\dagger-\rho C_n^\dagger C_n-C_n^\dagger C_n\rho]$
with the JC/TC Hamiltonian and the three exact collapse operators $\sqrt\kappa\,a$, $\sqrt\gamma\,\sigma_-$,
$\sqrt{\gamma_\phi/2}\,\sigma_z$ (QuTiP convention; §3.5 fixes every factor of 2). It specifies the Wigner
function (displaced-parity + Clenshaw numerical form, $g=\sqrt2$), the observables (photon number, inversion,
two-Lorentzian spectrum with $(\kappa+\gamma)/2$ widths, purity), the Gaussian-disorder model
$\omega_j\sim\mathcal N(\omega_0,\sigma^2)$, and the regimes (cooperativity $C=g^2/\kappa\gamma$, weak/strong/USC).
It bolts onto the closed-form engine: the same JC/TC Hamiltonian and √N splitting drive the dynamics, the
non-Hermitian version of the §A.3 Hopfield matrix supplies the broadened dispersion, and $\kappa$ finally
activates the "mirror reflectivity" knob that `PHYSICS-SPEC.md §9` defers — without altering the lossless HTC turnover.
Path: `/Users/dhruvjain/polariton-research/sim/docs/OPEN-QUANTUM-SPEC.md`.
