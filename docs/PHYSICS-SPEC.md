# Polariton Cavity-QED Simulation — Physics Specification (Source of Truth)

> This document is the single physics reference the simulation code is built against.
> Every equation carries a citation: `[paper, Eq./page]` for the local PDFs, or `[author, venue]` for
> web/textbook sources. All equations were extracted by a 7-paper + 6-web research workflow
> (`RESEARCH-EVIDENCE.json`, 166 equations / 67 sources) and the **central result (N_max) was
> re-derived by hand** (see §6). Where a printed form is dimensionally inconsistent, the corrected
> form is given and flagged.
>
> **Golden rule for the build:** never render a quantity that is not computed from an equation in
> this file. No invented parameters, no decorative sliders that change nothing.

---

## 0. The three physical systems this simulation covers

| # | System | What it shows | Why it's here |
|---|--------|---------------|---------------|
| **A** | Microcavity exciton-polaritons | Dispersion E(k‖), avoided crossing, Rabi splitting, Hopfield fractions | The *iconic* polariton picture; the visually unmistakable "two branches anticrossing" |
| **B** | Cavity-QED collective coupling (Jaynes→Tavis→Dicke) | Energy-level ladder, √N Rabi scaling, bright vs N−1 dark states | The conceptual core of light–matter coupling; explains *why* N matters |
| **C** | Holstein–Tavis–Cummings (HTC) cavity-modified electron transfer | Marcus surfaces, polariton-PES, ET-rate vs N **turnover at N_max** | **This project's money shot** — Sharma & Chen 2024, the paper the whole collaboration is about |

Systems A and B are the *established, textbook* physics (give the website credibility + history).
System C is the *frontier* physics (the actual research). They share one engine: a 2×2 coupled-oscillator
eigensolver and a Marcus/FGR rate kernel.

---

## A. Microcavity exciton-polaritons

### A.1 Bare cavity-photon dispersion
$$E_{\mathrm{cav}}(k_\parallel) = \frac{\hbar c}{n}\sqrt{k_z^2 + k_\parallel^2}, \qquad k_z = \frac{\pi M}{L_z}$$
[Carusotto & Ciuti, *Rev. Mod. Phys.* **85**, 299 (2013), Eq. 1; Deng, Haug & Yamamoto, *RMP* **82**, 1489 (2010)]

Near k‖≈0 this is parabolic — the photon acts as a 2-D massive particle:
$$E_{\mathrm{cav}}(k_\parallel) \simeq E_{\mathrm{cav}}^{0} + \frac{\hbar^2 k_\parallel^2}{2 m_{\mathrm{cav}}}, \qquad m_{\mathrm{cav}} = \frac{\hbar n k_z}{c} = \frac{n^2 E_{\mathrm{cav}}^{0}}{c^2}$$
[Carusotto & Ciuti 2013, Eqs. 1–2; Deng & Yamamoto, *PNAS* **100**, 15318 (2003)]
Typical `m_cav ≈ 10⁻⁵–10⁻⁴ mₑ` (measured 3.6×10⁻⁵ m₀ in CdTe) — ~4 orders lighter than the exciton.

### A.2 Exciton dispersion (≈ flat on this scale)
`E_exc(k‖) ≈ E_exc⁰` (exciton mass ~10⁴–10⁵× heavier than photon, so flat over the plotted k-range).

### A.3 Coupled-oscillator (Hopfield) Hamiltonian
$$H(k_\parallel) = \begin{pmatrix} E_{\mathrm{cav}}(k_\parallel) & V \\ V & E_{\mathrm{exc}}(k_\parallel) \end{pmatrix}, \qquad \hbar\Omega_R = 2V$$
[Deveaud review arXiv:0811.2502; Carusotto & Ciuti 2013, Eq. 21; Kavokin & Baumberg, *Microcavities* (OUP)]

### A.4 Lower / upper polariton branches (eigenvalues)
$$E_{\mathrm{LP/UP}}(k_\parallel) = \tfrac{1}{2}\Big[ E_{\mathrm{cav}} + E_{\mathrm{exc}} \pm \sqrt{(E_{\mathrm{cav}} - E_{\mathrm{exc}})^2 + (2V)^2} \Big]$$
[Deng & Yamamoto, *PNAS* 2003, Eq. 1; Carusotto & Ciuti 2013, Eq. 24]
At resonance the gap `E_UP − E_LP = 2V = ℏΩ_R`; branches **anticross, never cross** (level repulsion). This is the signature plot.

### A.5 Detuning
$$\delta(k_\parallel) = E_{\mathrm{cav}}(k_\parallel) - E_{\mathrm{exc}}(k_\parallel)$$
[Deng, Haug & Yamamoto, *RMP* 2010]. `δ<0` → photon-like LP at k=0 (light mass); `δ>0` → exciton-like; `δ=0` → 50/50.

### A.6 Hopfield coefficients (matter / light fractions of the LP)
$$|X_k|^2 = \tfrac{1}{2}\!\left(1 + \frac{\delta}{\sqrt{\delta^2 + (2V)^2}}\right),\quad |C_k|^2 = \tfrac{1}{2}\!\left(1 - \frac{\delta}{\sqrt{\delta^2 + (2V)^2}}\right),\quad |X_k|^2+|C_k|^2=1$$
[Hopfield, *Phys. Rev.* **112**, 1555 (1958); Kavokin & Baumberg]. UP has X and C swapped. At δ=0, LP is exactly 50% exciton / 50% photon.

### A.7 Angle ⇄ momentum (why angle-resolved PL maps work)
$$k_\parallel = \frac{E}{\hbar c}\sin\theta, \qquad E_C(\theta) = \frac{E_C(0)}{\sqrt{1 - (\sin\theta/n_c)^2}}$$
[Houdré et al., *C. R. Physique* **3** (2002) 15]. Each external emission angle maps 1-to-1 to an in-plane k — the twin x-axes of every dispersion figure.

**Typical numbers (System A):** Rabi splitting 2V = 4–16 meV (GaAs/III-V), 10–26 meV (CdTe), tens→>100 meV (organic/perovskite); n ≈ 3.5 (GaAs); δ tuned over −10…+10 meV.

---

## B. Cavity-QED collective coupling: Jaynes → Tavis → Dicke

### B.1 Jaynes–Cummings (single emitter, RWA)
$$\hat{H}_{\mathrm{JC}} = \hbar\omega_c\,\hat{a}^{\dagger}\hat{a} + \tfrac{\hbar\omega_{eg}}{2}\,\hat{\sigma}_z + \hbar\Omega_R(\hat{a}\,\hat{\sigma}_+ + \hat{a}^{\dagger}\hat{\sigma}_-)$$
[De Bernardis, Mercurio & De Liberato, arXiv:2403.02402, Eq. 1]

### B.2 Vacuum Rabi splitting
$$\omega_{n,+}-\omega_{n,-} = 2\Omega_R\sqrt{n} \;\Rightarrow\; \text{(n=1)}\; 2\Omega_R = 2g$$
[same, Eq. 6]. The √n Jaynes–Cummings ladder anharmonicity underlies photon blockade.

### B.3 Single-emitter coupling vs mode volume (the honest "cavity geometry" knob)
$$\hbar g = \boldsymbol{\mu}\cdot\mathbf{E}_{\mathrm{vac}}, \qquad g = \frac{\mu}{\hbar}\sqrt{\frac{\hbar\omega_c}{2\varepsilon_0 V}}$$
[Rider et al., arXiv:2402.09885, Eqs. 3–4]. **g ∝ 1/√V** — shrinking mode volume (plasmonic picocavities) is the route to single-molecule strong coupling.

### B.4 Tavis–Cummings (N emitters)
$$\hat{H}_{\mathrm{TC}} = \omega_r a^{\dagger}a + \sum_{j=1}^{N}\Big[\tfrac{\omega_j}{2}\sigma_{z,j} + \Gamma_j(a^{\dagger}\sigma_{-,j} + \sigma_{+,j}a)\Big]$$
[Dong et al., arXiv:2110.14174, Eq. 5]

### B.5 Collective bright state and √N enhancement — **the key scaling**
$$|\mathrm{B},0\rangle = \frac{1}{\sqrt{N}}\sum_{J}|e_J\rangle, \qquad g_N = g\sqrt{N}, \qquad \Omega_R = 2g\sqrt{N}$$
[Mandal et al., *Chem. Rev.* **123**, 9786 (2023), Eq. 13]. Only the symmetric combination couples; collective Rabi splitting ∝ √N (∝ √density).

### B.6 The N−1 dark states
$$|\mathrm{D}_\alpha,0\rangle = \sum_J c_{J\alpha}|e_J\rangle,\quad \sum_J c_{J\alpha}=0,\quad \langle\mathrm{D}_\alpha|\hat{\boldsymbol{\mu}}|\mathrm{G}\rangle=0,\quad \alpha=1\dots N-1$$
[Mandal et al. 2023, Eq. 18]. N−1 states with zero net dipole — dark to the cavity. Their fate (disorder/dephasing) is *the* central theme of polariton chemistry, and the reason "large N" is subtle.

**Typical numbers (System B):** single-emitter g ~ 1–380 meV; collective g_N ~ 25–310 meV for molecular ensembles; molecular N ~ 10⁶–10¹².

---

## C. Holstein–Tavis–Cummings cavity-modified electron transfer (THE CORE)

All from **Sharma & Chen, "Unraveling abnormal collective effects via the non-monotonic number dependence
of electron transfer in confined electromagnetic fields," *J. Chem. Phys.* **161**, 104102 (2024), DOI 10.1063/5.0225434** (preprint arXiv:2406.17101) unless noted.

### C.1 Total Hamiltonian
$$\hat{H} = \hat{H}_C + \hat{H}_I + \sum_{j=1}^{N}\hat{H}_{M,j}$$
[Eq. 1, p.2]. `Ĥ_C = ℏω_c â†â` (cavity); `Ĥ_I` light–matter; `Ĥ_{M,j}` molecular (j-th donor–acceptor pair). N identical non-interacting molecules, single cavity mode, long-wavelength approximation.

### C.2 Molecular spin-boson Hamiltonian (per pair)
$$\hat{H}_{M,j} = E_D|D_j\rangle\langle D_j| + \Big(E_A + \textstyle\sum_\alpha c_{\alpha,j}(\hat{b}^\dagger_{j,\alpha}+\hat{b}_{j,\alpha})\Big)|A_j\rangle\langle A_j| + H_{AD}|A_j\rangle\langle D_j| + H_{DA}|D_j\rangle\langle A_j| + \textstyle\sum_\alpha \hbar\omega_\alpha(\hat{b}^\dagger_{j,\alpha}\hat{b}_{j,\alpha}+\tfrac12)$$
[Eq. 2, p.3]

### C.3 Diabatic potential energy surfaces (the Marcus parabolas)
$$V_D(R_j) = E_D + \tfrac12\omega_v^2 R_j^2, \qquad V_A(R_j) = E_A + \lambda_v R_j + \tfrac12\omega_v^2 R_j^2$$
[Eqs. 4a–4b, p.3]. Equal-curvature harmonic diabats. Reorganization energy:
$$E_r = \frac{\lambda_v^2}{2\omega_v^2}$$
Donor–acceptor gap `E_AD = E_A − E_D` (|E_AD| = 1.0 eV baseline).

### C.4 Light–matter interaction (dipole + dipole self-energy, PZW gauge)
$$\hat{H}_I = \sum_j \vec{\mu}_j\cdot\vec{E}(\vec{r}_j) + \sum_j \frac{(\vec{\mu}_j\cdot\vec{\xi})^2}{2\varepsilon_0\mathcal{V}}, \qquad \vec{E} = i\vec{\xi}\sqrt{\tfrac{\omega_c}{2\mathcal{V}\varepsilon_0}}(\hat a - \hat a^\dagger)$$
[Eqs. 6–7, p.3]

### C.5 Dimensionless couplings
$$g_D,\,g_A,\,t_{AD} = i\sqrt{\tfrac{1}{2\hbar\omega_c\mathcal{V}\varepsilon_0}}\;\vec{\xi}\cdot\vec{d}_{\{DD,AA,AD\}}$$
[Eqs. 8–10, p.4]. `d_AD` = transition dipole; `t_AD ∝ d_AD/√V` — this is the microscopic link from cavity/molecule geometry to the coupling.

### C.6 Effective (polaron-transformed) ET couplings — **how the cavity rewires ET**
$$\mathcal{T}_{lm} = (H_{AD} + \hbar\omega_c\, t_{AD} g_{AD})F_{lm} + \hbar\omega_c\, t_{AD}\big(\sqrt{m}\,F_{l,m-1} - \sqrt{m+1}\,F_{l,m+1}\big)$$
[Eq. 20, p.5]. In the `g_AD=0` limit (`F_{l,m}=δ_{l,m}`):
$$T_{00}=T_{11}=H_{AD}, \qquad T_{01}=\hbar\omega_c\,t_{AD}, \qquad T_{10}=-\hbar\omega_c\,t_{AD}$$
[text after Eq. 23]. `T_00` recovers ordinary ET; `T_01` (photon absorption) and `T_10` (photon emission) are the **new cavity channels**.

### C.7 Collective polariton energies (RWA-I, absorption)
$$\Omega_\pm^{(\mathrm{I})} = \frac{\Delta}{2} \pm \sqrt{\Big(\frac{\Delta}{2}\Big)^2 + (N-1)|T_{01}|^2}, \qquad \Delta = \hbar\omega_c - E_{AD}$$
[Eq. 26, p.6]. **Splitting ∝ √(N−1)** — Tavis–Cummings collective enhancement. The factor is `N−1` (not N) because the one *reacting* molecule is excluded from the collective manifold (leaving N−2 dark states). RWA-II (emission) is the mirror with `−Δ/2` and `T_10` [Eq. 32, p.7].

At resonance (Δ=0):
$$\Omega_\pm^{(\mathrm{I})}(N) = \pm\sqrt{(N-1)|T_{01}|^2}, \qquad \Omega_\pm^{(\mathrm{II})}(N) = \pm\sqrt{(N-1)|T_{10}|^2}$$
[Eqs. 42–43, p.9]

### C.8 Polariton mixing angle (Hopfield analog)
$$\cos\Theta = \sqrt{\tfrac12 + \tfrac12\frac{\Delta/2}{\sqrt{(\Delta/2)^2+(N-1)|\mathcal{T}|^2}}}, \quad \sin\Theta = \sqrt{\tfrac12 - \tfrac12\frac{\Delta/2}{\sqrt{(\Delta/2)^2+(N-1)|\mathcal{T}|^2}}}$$
[Eqs. 29–30, p.7]. At resonance Θ=π/4.

### C.9 Cavity-modified Marcus / FGR ET rate (the kernel)
$$\mathcal{K}(V,E_a) = \sqrt{\frac{\pi}{E_r k_B T}}\,\frac{|V|^2}{2\hbar}\,\exp\!\Big[-\frac{E_a^2}{4 k_B T E_r}\Big], \qquad E_a = E_{fi} + E_r$$
[Eq. 35, p.8]. Equal to the classical Marcus rate `k = (1/ℏ)|V|² √(π/λk_BT) exp[−(λ+ΔG)²/4λk_BT]` (λ=E_r, ΔG=E_fi) **up to an overall factor of 1/2**: Sharma & Chen print `|V|²/(2ℏ)`, textbook/Semenov–Nitzan have `|V|²/ℏ` (verified refuted in deep-verify — see VERIFICATION-REPORT). We keep the paper's normalization so output matches its Fig. 2; the 1/2 is an overall prefactor that **cancels in every rate ratio (quantum yields, branching) and does not affect N_max or the barrier-less condition.** The activation energy `E_a` depends on the polariton energy Ω, so **a path goes barrier-less when Ω hits ℏω_c** → the turnover.

The photon-coupled ET paths (RWA-I) are evaluated as:
$$k_{P_\pm\to\{A_1\}1} = \mathcal{K}\big(\mathcal{T}_{11}\sin/\cos\Theta,\; \Omega_\pm^{(\mathrm{I})} - \hbar\omega_c\big)$$
[Eqs. 36a–d, p.8]. Path (a) `k_{D0→A_10}=K(T_00, E_AD)` recovers ordinary single-pair ET.

### C.10 Cavity-induced quantum yields
$$QY_b^{(\mathrm{I})} = \frac{k_{P_+\to\{A_1\}0}}{K_+^{(\mathrm{I})}} + \frac{k_{P_-\to\{A_1\}0}}{K_-^{(\mathrm{I})}}, \quad K_\pm^{(\mathrm{I})} = k_{P_\pm\to\{A_1\}0} + k_{P_\pm\to\{A_1\}1} + \Gamma_\pm^{(\mathrm{I})}$$
[Eqs. 45a–b, p.10]. `QY_b ~ N` (linear/Dicke) at small N; suppressed at large N. `QY_c < 0.5`.

---

## 6. THE CENTRAL RESULT — N_max turnover (verified by hand)

### 6.1 Printed form (paper Eq. 44a–b, p.9)
$$N_{\max}^{(\mathrm{I})} = 1 + \frac{\hbar\omega_c}{|T_{01}|^2}, \qquad N_{\max}^{(\mathrm{II})} = 1 + \frac{\hbar\omega_c}{|T_{10}|^2}$$

### 6.2 Hand derivation (do NOT trust the printed form blindly)
Barrier-less condition at resonance: set `Ω₊⁽ᴵ⁾ = ℏω_c` using Eq. 42 `Ω₊⁽ᴵ⁾ = √((N−1)|T₀₁|²)`:
$$\sqrt{(N-1)|T_{01}|^2} = \hbar\omega_c \;\Rightarrow\; (N-1)|T_{01}|^2 = (\hbar\omega_c)^2 \;\Rightarrow\; \boxed{N_{\max}^{(\mathrm{I})} = 1 + \frac{(\hbar\omega_c)^2}{|T_{01}|^2}}$$

### 6.3 Dimensional check & the correction
- Printed `ℏω_c/|T₀₁|²` has units eV/eV² = **1/eV — dimensionally inconsistent.**
- Derived `(ℏω_c)²/|T₀₁|²` has units eV²/eV² = **dimensionless ✓.**
- They agree numerically **only because** the paper always works at resonance, where `ℏω_c = E_AD = 1 eV`, so the missing factor of `E_AD = 1 eV` is invisible.
- **Honest general form** (exposes the hidden gap) — ⚠️ **THIS is the form the engine implements**, NOT the resonance-only `(ℏω_c)²/|T₀₁|²` box above:
$$\boxed{N_{\max} = 1 + \frac{\hbar\omega_c\, E_{AD}}{|T_{01}|^2}} \;\xrightarrow{\ \hbar\omega_c = E_{AD}\ }\; 1 + \frac{(\hbar\omega_c)^2}{|T_{01}|^2}$$

> **ENGINE NOTE (do not "fix"):** `htc.ts::nMax` returns `1 + (ħω_c·E_AD)/|T|²` (the general form). The `(ħω_c)²` box in §6.2 is only its resonance special case. A regression test (`hbar_wc:2.0, E_AD:0.5` → 1636) fails if anyone collapses the engine to the resonance-only or printed form. The paper was verified verbatim (arXiv:2406.17101) to literally print the dimensionally-inconsistent `1 + ħω_c/|T₀₁|²`; the project's own Pilot Plan PDF (Eq. 10) inherited the same slip.

### 6.4 Numerical confirmation (these are the unit-test golden values)
| Channel | coupling | N_max | check |
|---|---|---|---|
| Absorption (I) | \|T₀₁\| = 0.024731 eV | **1636** | `1 + 1/(0.024731²) = 1 + 1634.7 ≈ 1636` ✓ |
| Emission (II) | \|T₁₀\| = 0.0096297 eV | **10785** | `1 + 1/(0.0096297²) = 1 + 10784.9 ≈ 10785` ✓ |
(ℏω_c = E_AD = 1.0 eV throughout; equivalently N_max = 1 + 1/t_AD² with t_AD = T/ℏω_c.)

### 6.5 Framing (per project guidance — NOT an erratum)
This is a **units/normalization note, not an error in the science.** The paper's results are all at resonance,
where the printed and corrected forms coincide, so **zero published numbers change.** The general form is
already implicit in the repo code (`New_main_code.py`). Present to Shravan as diligence / a clarifying
question ("should Eq. 44 carry an explicit E_AD to be dimensionally general?"), never as "I found a mistake."

---

## 7. Master parameter table — the REAL knobs (≈11, not 50)

> Every slider below changes a quantity that appears in an equation above. Physical cavity geometry
> is mapped to model parameters honestly (right column). **No standalone "mirror thickness" slider** —
> thickness acts *through* ω_c and mode volume, shown explicitly.

### System C (HTC — primary)
| Symbol | Meaning | Units | Default | Range | Effect |
|---|---|---|---|---|---|
| `N` | molecule number | – | 100 | 1 … 10⁵ (log) | x-axis of the turnover; Rabi ∝ √(N−1) |
| `ℏω_c` | cavity photon energy | eV | 1.0 | 0.5 … 2.0 | resonance position; ← cavity length L_z |
| `E_AD` | donor–acceptor gap | eV | 1.0 | 0.5 … 2.0 | sets resonance + driving force |
| `Δ = ℏω_c − E_AD` | detuning | eV | 0 | −0.5 … +0.5 | off-resonance Rabi & rates |
| `\|T₀₁\|` | photon-mediated coupling (abs.) | eV | 0.024731 | 0.005 … 0.05 | ← transition dipole / √V; sets N_max |
| `\|T₁₀\|` | photon-mediated coupling (emis.) | eV | 0.009630 | 0.005 … 0.05 | sets N_max⁽ᴵᴵ⁾ |
| `H_AD` | bare electronic coupling | eV | 0.0304 (245 cm⁻¹) | 0.001 … 0.1 | ordinary (non-cavity) ET rate |
| `E_r` | reorganization energy | eV | 1.0 | 0.2 … 1.5 | Marcus parabola curvature/width |
| `ω_v` | primary vibrational frequency | cm⁻¹ | 80.6 | 50 … 1500 | bath timescale; with λ_v sets E_r |
| `k_B T` | thermal energy | eV | 0.025 (≈290 K) | 0.01 … 0.05 | barrier sensitivity |

### System A (microcavity)
| Symbol | Meaning | Units | Default | Range | Effect |
|---|---|---|---|---|---|
| `2V = ℏΩ_R` | Rabi splitting | meV | 10 | 2 … 120 | gap at anticrossing; ← coupling/√V |
| `δ` | cavity–exciton detuning | meV | 0 | −20 … +20 | LP/UP character, Hopfield mix |
| `m_cav` | photon effective mass | mₑ | 3.6×10⁻⁵ | 10⁻⁵ … 10⁻⁴ | LP curvature at k=0 |
| `n` | cavity refractive index | – | 3.5 | 1.5 … 3.6 | dispersion steepness |

### Honest cavity-geometry → parameter map (answers "change the mirrors")
| Physical knob | Real effect | Where it enters |
|---|---|---|
| Cavity length `L_z` | `k_z = πM/L_z` → `E_cav⁰ = ℏck_z/n` → ω_c | A.1, C.1 (sets resonance) |
| Mode volume `V` (mirror spacing × spot) | `g ∝ 1/√V` → Rabi splitting, `t_AD` | B.3, C.5 |
| Mirror reflectivity / finesse | photon lifetime → cavity loss κ | **DEFERRED** (see §9) |
| Incidence/emission angle θ | `k_∥ = (E/ℏc)sinθ` | A.7 (scans the dispersion) |

---

## 8. Validation targets (the code MUST reproduce these)

1. **N_max golden values:** 1636 (abs, |T₀₁|=0.024731 eV) and 10785 (emis, |T₁₀|=0.009630 eV) at ℏω_c=1 eV. *(unit test)*
2. **Anticrossing:** at δ=0 the LP/UP gap = 2V exactly; branches never cross. *(System A)*
3. **Hopfield at resonance:** |X|²=|C|²=0.5 at δ=0; →1/0 in the wings. *(System A)*
4. **√N Rabi:** collective splitting Ω₊−Ω₋ = 2√((N−1))|T₀₁| scales as √(N−1). *(System C, Eq. 42)*
5. **Marcus barrier-less:** rate `K` is maximal when `E_a = E_fi + E_r = 0`. *(System C, Eq. 35)*
6. **ET turnover shape:** rate vs N rises, peaks at N_max, then decays (asymptotically ∝ e^{−N}); PR rates ∝ N⁻². *(Fig. 2 of the paper)*
7. **Dark-state count:** N−2 dark states in the collective manifold (one reacting molecule excluded). *(System C)*

Reproduce against the paper's **Fig. 2** (rate vs N) and **Fig. 4** (slow/fast bath). Numeric anchors:
`E_r=1.0 eV`, `ω_v=80.6 cm⁻¹`, `λ_v²=2ω_v²` (Fig. 4 baseline), `H_AD=245 cm⁻¹`, `k_BT=0.025 eV`, `|E_AD|=1.0 eV`.

---

## 9. Limitations & deferred physics (state these in the UI — physicists trust honesty)

- **Single cavity mode only.** Multimode (the realistic case Shravan is moving toward) is *not* in this model. This is the honest frontier the project points at, not something the sim fakes.
- **Cavity loss / photon lifetime (κ) deferred.** No Lindblad dissipation of the photon; mirrors are treated as ideal. The "mirror reflectivity" knob is therefore shown as *roadmap*, not active.
- **Marcus/FGR (nonadiabatic, semiclassical) regime.** Classical nuclei (Langevin), high-T Marcus limit; no nuclear tunneling beyond the MLJ note, no strong-coupling (polaron) breakdown.
- **N−1 dark states treated as ideal/degenerate.** Disorder and dephasing — the crux of the real-world VSC controversy (§ HISTORY) — are not modeled.
- **RWA** used for the polariton energies (counter-rotating terms dropped); valid in the strong-but-not-ultrastrong regime.
- **Resonance-centric.** The cleanest results (and the N_max golden values) are at Δ=0; off-resonance is supported but less validated against the paper.

> A simulation that *says* these limits, and lets the user see the single-mode result clearly, is more
> impressive to a physicist than one that hides them behind 50 fake sliders.
