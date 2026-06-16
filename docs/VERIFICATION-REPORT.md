# Verification Report — Polariton Engine

Per-equation verification ledger for the simulation engine in `/Users/dhruvjain/polariton-research/sim/engine/`. Ground truth: Sharma & Chen, *J. Chem. Phys.* **161**, 104102 (2024) (= arXiv:2406.17101); Mandal, Taylor, Weight, Koessler, Li & Huo, *Chem. Rev.* **123**, 9786 (2023); Carusotto & Ciuti, *Rev. Mod. Phys.* **85**, 299 (2013); Deng, Haug & Yamamoto, *Rev. Mod. Phys.* **82**, 1489 (2010); Hopfield, *Phys. Rev.* **112**, 1555 (1958); De Bernardis, Mercurio & De Liberato, arXiv:2403.02402; Rider et al., arXiv:2402.09885.

Verdicts are blunt. **Verified** = transcribed correctly, dimensionally consistent, matches the cited primary source. **Refuted** = the stated/printed form is wrong (and the corrected form is given). **Uncertain** = not independently re-derived here, or a known open clarification.

---

## 1. Per-Equation Ledger

### System C — Holstein–Tavis–Cummings electron transfer (Sharma & Chen 2024)

| # | Equation (engine fn) | Verdict | Dimensional check | Authoritative source |
|---|---|---|---|---|
| C1 | Collective polariton energies `polaritonEnergies()` $\Omega_\pm^{(\mathrm{I})} = \frac{\Delta}{2} \pm \sqrt{(\frac{\Delta}{2})^2 + (N-1)\lvert T_{01}\rvert^2}$, $\Delta = \hbar\omega_c - E_{AD}$ | **Verified** | $\Delta/2$ → eV; inside √: $(\Delta/2)^2$ → eV², $(N-1)\lvert T_{01}\rvert^2$ → (dimensionless)·eV² = eV²; √ → eV. Consistent. | Eq. 26, p. 104102-6. Verbatim from local PDF. The factor is $(N-1)$ not $N$: the one reacting molecule is excluded from the collective manifold. |
| C2 | Resonance Rabi splitting $\Omega_\pm^{(\mathrm{I})}(N) = \pm\sqrt{(N-1)\lvert T_{01}\rvert^2}$; $\Omega_\pm^{(\mathrm{II})}(N) = \pm\sqrt{(N-1)\lvert T_{10}\rvert^2}$; splitting $\propto\sqrt{N-1}$ | **Verified** | $(N-1)\lvert T\rvert^2$ → eV²; √ → eV. Consistent. | Eqs. 42, 43, p. 104102-8/9. Mixing angle $\theta=\pi/4$ at resonance; effective splitting $\Omega_+-\Omega_- = 2\sqrt{(N-1)\lvert T_{01}\rvert^2}$. |
| C3 | Effective couplings `effectiveCouplings()` $T_{00}=T_{11}=H_{AD}$; $T_{01}=\hbar\omega_c\,t_{AD}$; $T_{10}=-\hbar\omega_c\,t_{AD}$ | **Verified** | $H_{AD}$ → eV; $\hbar\omega_c$ (eV) · $t_{AD}$ (dimensionless) → eV. All couplings eV. Consistent. | Text after Eq. 23, p. 104102-5 (verbatim). $t_{AD}$ dimensionless, $\lvert t_{AD}\rvert = 8.5\times10^{-3}$. |
| C4 | **N_max — PRINTED (paper Eq. 44a/44b)** $N_{\max}^{(\mathrm{I})} = 1 + \frac{\hbar\omega_c}{\lvert T_{01}\rvert^2}$ | **REFUTED** | $\hbar\omega_c/\lvert T_{01}\rvert^2$ → eV/eV² = **1/eV**. Cannot add a 1/eV quantity to the dimensionless "1". Inconsistent. | Eqs. 44a/44b, p. 104102-9 (verbatim — confirmed the paper literally prints this). See §2. |
| C5 | **N_max — DIMENSIONALLY CORRECT (engine `nMax()`)** $N_{\max} = 1 + \frac{(\hbar\omega_c)^2}{\lvert T_{01}\rvert^2} = 1 + \frac{\hbar\omega_c\,E_{AD}}{\lvert T_{01}\rvert^2}$ | **Verified** | $(\hbar\omega_c)^2/\lvert T_{01}\rvert^2$ → eV²/eV² = **dimensionless**. Consistent. | Re-derived by hand from Eq. 42 + the paper's own barrier-less condition $\Omega_+^{(\mathrm{I})}-\hbar\omega_c=0$. `htc.ts:57-59` implements this corrected form. |
| C6 | Golden values $N_{\max}^{(\mathrm{I})}=1636$ at $\lvert T_{01}\rvert=0.024731$ eV; $N_{\max}^{(\mathrm{II})}=10785$ at $\lvert T_{10}\rvert=0.0096297$ eV ($\hbar\omega_c=1$ eV) | **Verified** | $1 + 1/(0.024731)^2 = 1635.996 \to 1636$; $1 + 1/(0.0096297)^2 = 10784.87 \to 10785$. Self-consistency: at these $N$, $\Omega_+=\sqrt{N-1}\,\lvert T\rvert = 1.0000$ eV $= \hbar\omega_c$ exactly (barrier-less). | Computed (Python); cross-checked vs PHYSICS-SPEC §6.4 golden table. |
| C7 | Marcus/FGR kernel `marcusRateEa()` $\mathcal{K}(V,E_a)=\sqrt{\frac{\pi}{E_r k_B T}}\frac{\lvert V\rvert^2}{2\hbar}\exp[-\frac{E_a^2}{4 k_B T E_r}]$, $E_a=E_{fi}+E_r$ | **Verified (transcription); see C8** | Prefactor $\sqrt{\pi/(E_r k_B T)}$ → 1/eV; $\lvert V\rvert^2/(2\hbar)$ → eV²/(eV·s) = eV/s; product → **1/s** (rate). Exponent → eV²/eV² = dimensionless. Consistent. | Eq. 35, p. 104102-8 (verbatim from local PDF). Exponent is exactly textbook Marcus. |
| C8 | **Equivalence claim:** Eq. 35 is "*identical to*" the classical Marcus rate $\frac{2\pi}{\hbar}\lvert V\rvert^2(4\pi\lambda k_B T)^{-1/2}e^{-(\lambda+\Delta G)^2/4\lambda k_B T}$ | **REFUTED (factor of 2)** | Both are rates [1/s] — not a dimensional error, a **numerical factor**. Standard Marcus $= \frac{\lvert V\rvert^2}{\hbar}\sqrt{\frac{\pi}{\lambda k_B T}}$; Eq. 35 carries $\frac{\lvert V\rvert^2}{2\hbar}$. **Ratio = exactly 1/2.** | Tokmakoff LibreTexts 19.4.28; Mandal-Huo Eq. 214; and the parent paper Semenov & Nitzan, *J. Chem. Phys.* **150**, 174122 (2019), Eq. 23 — all have **no 1/2**. Soften wording to "identical up to an overall factor 1/2 in the prefactor." Impact is nil for ratios/turnover (see §3). |
| C9 | Mixing angle `mixingAngle()` $\cos^2\Theta = \tfrac{1}{2}+\tfrac{1}{2}\frac{\Delta/2}{\sqrt{(\Delta/2)^2+(N-1)\lvert T\rvert^2}}$ | **Verified** | Ratio eV/eV = dimensionless; $\arccos(\sqrt{\cdot})$ → radians; $\Theta=\pi/4$ at resonance. Consistent. | Eqs. 29-30, p. 104102-7. |
| C10 | Dark-state count `darkStateCount()` for System C = $N-2$ | **Verified** | Pure count. One reacting molecule excluded → $N-1$ spectators collectivized → 1 bright + $N-2$ dark; $2+(N-2)=N$. | Eq. 38 sum upper limit printed as $N-1$ is a **typo**; text after Eq. 38, App. A6/A7, App. B1 all define $k=1\ldots N-2$. Settled as $N-2$. See §4. |

### System A — Microcavity exciton-polaritons (Carusotto-Ciuti / Deng-Haug-Yamamoto / Hopfield)

| # | Equation (engine fn) | Verdict | Dimensional check | Authoritative source |
|---|---|---|---|---|
| A1 | Cavity dispersion `cavityDispersion()` $E_{\mathrm{cav}}(k_\parallel)=\frac{\hbar c}{n}\sqrt{k_z^2+k_\parallel^2}$, $k_z=\pi M/L_z$ | **Verified** | $[\hbar c/n]$ = J·m; $[\sqrt{k_z^2+k_\parallel^2}]$ = 1/m; product = J = energy. Consistent. | Carusotto-Ciuti RMP 85, 299 (2013) Eq. 1 (via arXiv:1205.6500). Exact match (with $E=\hbar\omega$). |
| A2 | Photon effective mass $m_{\mathrm{cav}}=\frac{\hbar n k_z}{c}=\frac{n^2 E_{\mathrm{cav}}^0}{c^2}$ | **Verified** | $[\hbar n k_z/c]$ = kg; $[n^2 E/c^2]$ = kg. The two forms are algebraically identical (re-derived by hand). | Carusotto-Ciuti Eq. 2. CdTe value $3.6\times10^{-5}\,m_0$ plausible/sample-specific. |
| A3 | Polariton branches `polaritonBranches()` $E_{\mathrm{LP/UP}}=\tfrac{1}{2}[E_{\mathrm{cav}}+E_{\mathrm{exc}}\pm\sqrt{(E_{\mathrm{cav}}-E_{\mathrm{exc}})^2+(2V)^2}]$ | **Verified** | All terms eV; radicand eV²; √ → eV. Resonance gap $=2V=\hbar\Omega_R$. Consistent. | Deng-Haug-Yamamoto RMP 82, 1489 (2010); Deng-Weihs PNAS 100, 15318 (2003) Eq. 1. Convention note in §1.1. |
| A4 | Hopfield coefficients `hopfield()` $\lvert X\rvert^2=\tfrac{1}{2}(1+\frac{\delta}{\sqrt{\delta^2+(2V)^2}})$, $\lvert C\rvert^2=1-\lvert X\rvert^2$, $\delta=E_{\mathrm{cav}}-E_{\mathrm{exc}}$ | **Verified** | $\delta/\sqrt{\cdot}$ dimensionless ∈ [−1,1]; fractions ∈ [0,1]; $\lvert X\rvert^2+\lvert C\rvert^2=1$ identically; 50/50 at $\delta=0$. Consistent. | Hopfield Phys. Rev. 112, 1555 (1958); Deng-Haug-Yamamoto RMP. Sign/labeling convention note in §1.1. |
| A5 | Angle→momentum `angleToK()` $k_\parallel=\frac{E}{\hbar c}\sin\theta$ | **Verified** | $[E/(\hbar c)]$ = 1/m; ·$\sin\theta$ (dimensionless) = 1/m = wavevector. Consistent. | Houdre, Stanley, Oesterle, Weisbuch, *C. R. Physique* **3** (2002) 15. Citation real and correctly attributed. **Unit caution:** `angleToK` returns nm⁻¹ while `cavityDispersion` expects m⁻¹ (factor $10^9$); neither equation is wrong, but chaining without conversion is off by $10^9$. |

### System B — Collective coupling (Jaynes/Tavis-Cummings, Mandal-Huo 2023; De Bernardis 2024; Rider 2024)

| # | Equation (engine fn) | Verdict | Dimensional check | Authoritative source |
|---|---|---|---|---|
| B1 | Jaynes-Cummings $\hat H_{JC}=\hbar\omega_c\hat a^\dagger\hat a+\frac{\hbar\omega_{eg}}{2}\hat\sigma_z+\hbar\Omega_R(\hat a\hat\sigma_++\hat a^\dagger\hat\sigma_-)$ | **Verified** | Every term → J (energy). Consistent. | De Bernardis, Mercurio & De Liberato arXiv:2403.02402 Eq. 1 (verbatim). **Citation error:** spec attributes this to "Le Boite & De Liberato" — wrong lead author; see §5. |
| B2 | Vacuum Rabi ladder `jcSplitting()` $\omega_{n,+}-\omega_{n,-}=2\Omega_R\sqrt{n}$; $n=1\Rightarrow 2\Omega_R=2g$ | **Verified** | LHS and RHS both 1/s. $\sqrt{n}$ dimensionless. Consistent. | arXiv:2403.02402 Eq. 6 (verbatim). $\sqrt{n}$ anharmonicity = photon-blockade ladder. |
| B3 | Single-emitter coupling `collectiveCoupling()` $\hbar g=\boldsymbol\mu\cdot\mathbf E_{\mathrm{vac}}$, $g=\frac{\mu}{\hbar}\sqrt{\frac{\hbar\omega_c}{2\varepsilon_0 V}}\propto V^{-1/2}$ | **Verified** | √-term → J/(C·m) = V/m = E-field; $g$ → 1/s; $\hbar g$ → J. Consistent. | Rider et al. arXiv:2402.09885 Eqs. 3-4 (verbatim). Picocavity $V\sim1$ nm³ → $\hbar g\sim450$ meV, right order. |
| B4 | Tavis-Cummings collective coupling $g_N=g\sqrt{N}$; bright state $\lvert B,0\rangle=\frac{1}{\sqrt N}\sum_J\lvert E_J,0\rangle$ | **Verified** | $\sqrt N$ dimensionless; $g_N$ → eV; bright-state norm $=1$. Consistent. | Mandal-Huo Chem. Rev. 123, 9790 (2023) Eqs. 12-13 (verbatim from local PDF). |
| B5 | Collective Rabi splitting `rabiSplitting()` $\Omega_R=2g\sqrt{N}$ (general $\Omega_R=\sqrt{(\Delta E-\hbar\omega_c)^2+4Ng_c^2}$) | **Verified** | All eV; resonance reduces to $2\sqrt N g_c$. Consistent. | Mandal-Huo Eqs. 16-17; independently confirmed by Rider Eq. 4 ($\Omega_R=2g_N$). Factor-of-2 reconciled in §1.1. |
| B6 | Dark-state count (System B / textbook TC) $=N-1$, $\sum_J c_{J\alpha}=0$, zero net dipole | **Verified** | Pure count; constraint gives $\langle D_\alpha\rvert\hat\mu\lvert G\rangle=0$. Consistent. | Mandal-Huo Eq. 18 (verbatim). Distinct from System C's $N-2$ (see §4). |

### 1.1 Convention subtleties (not errors — must not be mixed)

- **Factor of 2 in $V$ vs $\Omega_R$.** The engine/Hopfield convention defines $V$ = half the Rabi splitting (off-diagonal Hamiltonian element), so the radicand carries $(2V)^2=(\hbar\Omega_R)^2$. Equivalent literature writes $\Omega_R^2$ directly where $\Omega_R$ is the full splitting. Both give the same physical gap $E_{UP}-E_{LP}=2V=\hbar\Omega_R$ at resonance. **A quoted "Rabi splitting = X meV" means off-diagonal $V=X/2$.** Independently confirmed both ways (Mandal: $\Omega_R=2\sqrt N g_c$; Rider: $\Omega_R=2g_N$). The two cited single-emitter papers use *different symbols* for the per-emitter coupling (De Bernardis calls it $\Omega_R$; Mandal/Rider call it $g_c$/$g$) — the spec reconciles them correctly.
- **Detuning sign.** Engine uses $\delta=E_{\mathrm{cav}}-E_{\mathrm{exc}}$ (Deng convention), under which $\lvert X\rvert^2=\tfrac12(1+\delta/\sqrt{\cdot})$ correctly makes the LP excitonic for $\delta>0$. Sources using $\delta=E_{\mathrm{exc}}-E_{\mathrm{cav}}$ flip the sign. Internally self-consistent.

---

## 2. The N_max Units Resolution

This is the project's flagged equation and the central units finding. **Confirmed: the paper literally prints a dimensionally-inconsistent formula.**

### Printed form (paper Eqs. 42, 44)

Direct quote, transcribed verbatim from the source PDF (`/Users/dhruvjain/Downloads/Non monotonic numbe dependence for polariton dynamics.pdf`; identical in arXiv:2406.17101v1 via `pdftotext`):

> **Eq. 42** (resonance, $\Delta=0$): $\quad\Omega_\pm^{(\mathrm{I})}(N) = \pm\sqrt{(N-1)\lvert T_{01}\rvert^2}$
>
> **Eq. 44a/44b** (printed): $\quad N_{\max}^{(\mathrm{I})} = 1 + \dfrac{\hbar\omega_c}{\lvert T_{01}\rvert^2}, \qquad N_{\max}^{(\mathrm{II})} = 1 + \dfrac{\hbar\omega_c}{\lvert T_{10}\rvert^2}$

The paper's own prose states the barrier-less / maximum-rate condition verbatim as:

> "*maximal ET rate constant when $\Omega_+^{(\mathrm{I})} - \hbar\omega_c = 0$ … the polariton PES becomes barrier-less*"

### Why the printed form is wrong

$T_{01}=\hbar\omega_c\,t_{AD}$ with $t_{AD}$ **dimensionless**, so $T_{01}$ has units of energy (eV). Then:

$$\frac{\hbar\omega_c}{\lvert T_{01}\rvert^2} \;=\; \frac{\text{eV}}{\text{eV}^2} \;=\; \frac{1}{\text{eV}}$$

A molecule count $N$ (pure number) cannot equal $1 + (1/\text{eV})$. **Refuted as a general formula.** This is reproduced uncorrected in the project's own Pilot Plan PDF (its Eq. 10), inheriting the slip.

### Dimensionally-correct form (engine `htc.ts:57-59`)

Substituting Eq. 42 into the paper's *own* barrier-less condition $\Omega_+^{(\mathrm{I})}=\hbar\omega_c$:

$$\sqrt{(N-1)\lvert T_{01}\rvert^2}=\hbar\omega_c \;\Longrightarrow\; (N-1)\lvert T_{01}\rvert^2=(\hbar\omega_c)^2 \;\Longrightarrow\; \boxed{N_{\max}=1+\frac{(\hbar\omega_c)^2}{\lvert T_{01}\rvert^2}=1+\frac{\hbar\omega_c\,E_{AD}}{\lvert T_{01}\rvert^2}}$$

Units: $\text{eV}^2/\text{eV}^2=$ **dimensionless**. Consistent. The general off-resonance form carries an explicit $E_{AD}$ factor.

### Why no published number changes

Every result in the paper is at resonance $\hbar\omega_c=E_{AD}=1$ eV. There the missing factor of $E_{AD}=1$ eV is numerically invisible: the printed (1/eV) form and the corrected (dimensionless) form yield **identical numbers** — $1636$ at $\lvert T_{01}\rvert=0.024731$ eV and $10785$ at $\lvert T_{10}\rvert=0.0096297$ eV (each computed as $1635.996$ / $10784.87$ either way). At each $N_{\max}$, $\Omega_+=\sqrt{N-1}\,\lvert T\rvert=1.0000$ eV $=\hbar\omega_c$ exactly, so the polariton PES crossing is genuinely barrier-less ($E_a=(\Omega_+-\hbar\omega_c)^2/4E_r\to0$).

**Status: a units/normalization slip in the printed equation, not a science error.** The engine implements the corrected form, and `engine.test.ts:33-37` guards against regressing to the printed form by checking an off-resonance point ($\hbar\omega_c=2.0$, $E_{AD}=0.5$) still yields $1636$. Frame as a diligence/clarifying question to the authors, not an erratum.

---

## 3. Resolved Uncertainties

Items that have been chased down and **closed**:

1. **Sharma & Chen article number — 104102 vs 104109.** **RESOLVED → 104102.** Quadruple-confirmed: (a) Crossref metadata for DOI 10.1063/5.0225434 returns article 104102; (b) the DOI handle 302-redirects to the AIP URL path `.../jcp/article/161/10/104102/...`; (c) arXiv:2406.17101 journal-ref reads verbatim "J. Chem. Phys. **161**, 104102 (2024)"; (d) the downloaded PDF's first-page citation line prints 104102. The "104109" in `_compact-evidence.json` fact #17 is an **error**. **Fix needed:** `/Users/dhruvjain/polariton-research/sim/docs/_compact-evidence.json` fact #17: `104109` → `104102`. (The file is internally inconsistent — fact #46 and PHYSICS-SPEC.md line 101 already use 104102.)

2. **Author citation for arXiv:2403.02402.** **RESOLVED.** Actual authors are **De Bernardis, Mercurio & De Liberato** — the spec's "Le Boite & De Liberato" attribution has the wrong lead author. Equation content (JC Hamiltonian, vacuum Rabi ladder) is correct; only the byline is wrong. **Fix:** correct the attribution.

3. **Multimode follow-up paper (arXiv:2511.04017).** **RESOLVED — misattributed.** It is **Ying & Nitzan** (UPenn), *J. Chem. Phys.* **164**, 024113 (2026), NOT a Chen-group paper. It is a *single-mode* unified Fermi-golden-rule ET rate theory (revisiting Semenov-Nitzan 2019); its only "multimode" content is mapping cavity loss to a Brownian-oscillator continuum. It does **not** extend the non-monotonic $N$-dependence — that result stays in Sharma & Chen 2024 (arXiv:2406.17101). Any roadmap claim that 2511.04017 is a multimode/$N$-scaling follow-up is **unsupported**.

4. **Dark-state count for System C — $N-1$ vs $N-2$.** **RESOLVED → $N-2$.** The Eq. 38 sum upper limit printed as $N-1$ is a typo; the text after Eq. 38, App. A6/A7, and App. B1 all define dark states for $k=1\ldots N-2$, and App. A states diagonalizing the submatrix gives $N-2$ degenerate dark eigenvalues. Bookkeeping: molecule 1 reacts (excluded) → $N-1$ spectators collectivized → 1 bright + $N-2$ dark, and $2+(N-2)=N$. This is exactly textbook TC applied to $N-1$ emitters; not a contradiction of System B's generic $N-1$ count. The engine's oracle $\Gamma$ values use the reduced Eqs. 40-41, so existing golden numbers are unaffected — but any explicit dark-channel sum must iterate $k=1\ldots N-2$.

5. **Marcus/FGR equivalence claim.** **RESOLVED — off by a factor of 2.** Eq. 35 carries $\lvert V\rvert^2/(2\hbar)$; textbook Marcus and Sharma-Chen's own parent paper (Semenov & Nitzan 2019, Eq. 23, read directly) carry $\lvert V\rvert^2/\hbar$ — **no 1/2**. So the printed 1/2 is an extra factor (likely a normalization slip), not an inherited convention. **Fix wording** in `_compact-evidence.json` and PHYSICS-SPEC §C.9 from "identical to the classical Marcus rate" → "identical up to an overall factor of 1/2 in the prefactor." Physical impact is **nil** for all the paper's conclusions: the factor cancels in every rate *ratio* (quantum yields, branching), and the turnover $N_{\max}$, activation energy, and barrier-less condition are entirely prefactor-independent. If the sim ever reports *absolute* ET rates, either multiply Eq. 35 by 2 to match textbook/Semenov-Nitzan, or document that it deliberately matches Sharma-Chen's printed normalization.

6. **All 14 historical timeline citations.** **RESOLVED — all correct.** Verified against APS/Wiley/Nature/ACS/IOP records + Crossref/ADS/DOI resolution: Dicke 1954 (PR 93, 99), Hopfield 1958 (PR 112, 1555), Jaynes-Cummings 1963 (Proc. IEEE 51, 89), Tavis-Cummings 1968 (PR 170, 379), Weisbuch 1992 (PRL 69, 3314), Imamoglu 1996 (PRA 53, 4250), Kasprzak 2006 (Nature 443, 409), Carusotto-Ciuti 2013 (RMP 85, 299), Lagoudakis/Berloff 2017 (NJP 19, 125008), Hutchison 2012 (ACIE 51, 1592), Thomas 2016 (ACIE 55, 11462), Galego 2015 (PRX 5, 041022), Campos-Gonzalez-Angulo 2019 (Nat. Commun. 10, 4685), Mandal-Huo 2023 (Chem. Rev. 123, 9786).

---

## 4. Still-Open Items

Items **not** confirmed, deliberately deferred, or genuinely contested:

1. **VSC ground-state chemistry is unproven.** Whether a dark optical cavity changes *thermal ground-state* reaction rates/selectivity (the Ebbesen-group claim) is **unresolved as of 2025**. The optics (Rabi splitting) reproduce, but the *rate changes* largely do **not** (Imperatore/Giebink 2021 null; Wiesehan/Xiong non-reproducible; Weichman/Chen 2024 unchanged). Equilibrium TST predicts no resonant effect (Galego/Feist PRX 2019); exact HEOM (Ke 2025) finds equilibrium populations unchanged, so any genuine effect must be *non-equilibrium/dynamical*. No agreed mechanism, no agreed best practices for excluding artifacts.

2. **The 1/N collective-dilution survival problem.** Single-molecule, lossy, fully-quantum models *can* produce resonant features (Lindoy-Mandal-Reichman 2023 — but only with cavity loss included). Whether these survive dilution to a macroscopic cavity of $\sim10^{6}$–$10^{12}$ molecules to explain experiments is **unverified**; the theorists themselves flag this gap.

3. **N_max general off-resonance form — confirm with authors.** The dimensional fix ($N_{\max}=1+\hbar\omega_c E_{AD}/\lvert T_{01}\rvert^2$) is derived and self-consistent with the paper's prose, but whether the printed Eq. 44 is an intentional resonance-only shorthand or a typo is best confirmed directly. No published number changes either way.

4. **N_max golden-value reproduction from raw $t_{AD}$.** $N_{\max}=1+(\hbar\omega_c)^2/\lvert T_{01}\rvert^2$ with the stated $\lvert t_{AD}\rvert=8.5\times10^{-3}$ yields $\approx13842$, **not** the reported 1636/10785. The reported numerics use the *table* values $\lvert T_{01}\rvert=0.024731$ eV, $\lvert T_{10}\rvert=0.0096297$ eV (which reproduce exactly), implying additional parameters/detuning beyond the bare $\hbar\omega_c\,t_{AD}$ product. Does not affect the dimensional finding, but the $t_{AD}\to T_{01}$ mapping is **not fully pinned down**.

5. **Paywalled published versions not fully cross-checked.** The published JCP (161, 104102) and the AIP article-abstract page returned HTTP 403; verification rests on the arXiv v1 PDF + DOI/Crossref/ADS metadata. Whether the missing-square in Eq. 44 was silently corrected *in print* is **not confirmed** (the arXiv v1 read here prints it uncorrected).

6. **Cavity loss ($\kappa$) is DEFERRED in the engine.** Per PHYSICS-SPEC §9, mirrors are ideal, single-mode, no Lindblad. The "reflectivity" slider is roadmap, not active — it does **not** drive a real linewidth. Whether adding photon loss shifts $N_{\max}$ or softens the turnover (the project's central result) is **untested**. Real VSC cavities are very lossy ($Q\sim50$), where $(\gamma_x+\gamma_c)/2$ may exceed $2V$ and break the avoided-crossing picture the sim draws.

7. **Single-mode assumption.** Real Fabry-Perot cavities are a 2D mode continuum (in-plane $k_\parallel$ continuous + longitudinal comb spaced by FSR). In-plane disorder mixes bright/dark states and blurs the $N-1$/$N-2$ accounting (T. E. Li arXiv:2403.12411); multimode opens transport and cascade channels with no single-mode analog (Zhou et al. PRA 109, 033717; Ke & Assan 2025). The engine is single-mode only.

8. **DBR penetration-depth formula** $L_{\mathrm{DBR}}=(\lambda/2)/(n_H-n_L)$ came from a literature search summary, not a directly verified primary page; confirm against Kavokin & Baumberg, *Microcavities* (OUP) before quoting.

9. **`angleToK` ↔ `cavityDispersion` unit bridge.** `angleToK` returns nm⁻¹, `cavityDispersion` expects m⁻¹ (factor $10^9$). Neither equation is wrong, but any call site chaining them needs an explicit conversion or a comment. **Recommended fix at call sites.**

---

## 5. Required Document Fixes (non-physics)

| Location | Issue | Fix |
|---|---|---|
| `_compact-evidence.json` fact #17 | Article number `104109` | → `104102` |
| PHYSICS-SPEC §B (cite of arXiv:2403.02402) | "Le Boite & De Liberato" | → "De Bernardis, Mercurio & De Liberato" |
| `_compact-evidence.json` & PHYSICS-SPEC §C.9 | "identical to the classical Marcus rate" | → "identical up to an overall factor 1/2 in the prefactor" |
| Roadmap notes referencing arXiv:2511.04017 | Called Chen-group multimode/$N$ follow-up | → Ying & Nitzan, single-mode; not an $N$-scaling extension |

---

## Bottom Line

Every equation the engine **actually computes** is dimensionally consistent as implemented, and all 21 engine tests pass. The engine already corrects the one defective literature equation. The defects found live in the *source papers* and *project metadata*, not the engine code:

- **One refuted printed equation** (paper Eq. 44 N_max, units 1/eV) — engine implements the corrected dimensionless form.
- **One refuted equivalence claim** (Marcus kernel off by factor 1/2) — physically inconsequential, wording fix only.
- **Four metadata fixes** (article number, author byline, equivalence wording, follow-up-paper attribution).
- **Nine genuinely open items** — chiefly the contested VSC/ground-state question, the unverified 1/N dilution survival, and the deferred cavity-loss and multimode physics.
