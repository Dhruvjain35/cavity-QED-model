# Deep Concepts — A Defensible Conceptual Guide to the Physics Behind the Simulation

> **Audience.** A strong high-schooler who must defend every claim to a physicist.
> **Promise.** Every section gives you four things: the **WHY** (physical intuition you can
> reason from, not memorize), the **governing equations** (with citations you can point to),
> **how to visualize it faithfully** (so the simulation never lies), and the **misconceptions**
> that will get you caught.
>
> **Citation discipline.** Equations carry `[author, venue, Eq./page]`. Every claim here traces to
> the verified research material (`PHYSICS-SPEC.md`, `_compact-evidence.json`, `RESEARCH-EVIDENCE.json`).
> Two corrections to the *printed literature* are flagged in-line and you should be ready to defend them:
> (1) the printed Sharma–Chen $N_\text{max}$ formula is dimensionally inconsistent, and
> (2) the Sharma–Chen Marcus prefactor is $1/2$ of textbook Marcus. Neither changes a published *number*.
>
> **The eight concept areas.** §1 Collective coupling & dark states · §2 The HTC turnover · §3 Marcus/MLJ ·
> §4 Cavity-QED foundations & gauge · §5 Microcavity polaritons & condensation · §6 The VSC controversy ·
> §7 Multimode frontier · §8 Cavity hardware. Ends with a **"things I can now defend"** checklist (§9).

---

## 1. Collective strong coupling and the dark-state / large-$N$ problem

### The WHY

Put $N$ identical two-level molecules (transition energy $\hbar\omega_{eg}$, transition dipole $\mu$)
inside a cavity tuned to $\omega_c$. In the single-excitation subspace the states are: one photon
$|0,1\rangle$ and $N$ "one molecule excited" states $|e_J,0\rangle$. The cavity couples *identically*
to every molecule with the same single-molecule strength $g$. That single fact forces everything else.

**Why only ONE matter state is bright.** The photon field has exactly one dipole "handle." It cannot
tell molecule 3 from molecule 700,000; it couples only to the totally symmetric combination

$$|B,0\rangle = \frac{1}{\sqrt{N}}\sum_{J}|e_J,0\rangle .$$

The photon-to-matter matrix element is $\langle 0,1|\hat H_\text{int}|B\rangle = \frac{1}{\sqrt N}\sum_J g = \frac{Ng}{\sqrt N} = g\sqrt N$.
The $N$ in-phase dipoles add to $N$ (constructive interference); the $1/\sqrt N$ unit-norm factor removes
only *one* power of $\sqrt N$. Net: the bright state couples $\sqrt N$ times harder than one molecule.
This is the exact arithmetic of **Dicke superradiance** [Dicke, Phys. Rev. **93**, 99 (1954)].

**Why $N-1$ states are DARK.** The matter subspace is $N$-dimensional; the photon picked off one
direction (the symmetric one). The remaining $N-1$ orthogonal combinations
$|D_\alpha,0\rangle = \sum_J c_{J\alpha}|e_J,0\rangle$ with $\sum_J c_{J\alpha}=0$ have **zero net
transition dipole**, so $\langle D_\alpha,0|\sum_J\hat{\boldsymbol\mu}_J|G,0\rangle = \mu_{eg}\sum_J c_{J\alpha}=0$
and they decouple from the photon [Mandal et al., *Chem. Rev.* **123**, 9786 (2023), Eq. 18]. Their dipoles
cancel by destructive interference, like nonbonding molecular orbitals. They sit *unshifted* at the bare
molecular energy, sandwiched between the two polaritons. For $N\sim 10^6$–$10^{12}$ there are essentially
$N$ dark states and only **2** bright polaritons — an overwhelming "dark-state reservoir."

**The $\sqrt{\text{density}}$ statement (the experimentally load-bearing one).** From the single-emitter
coupling $g=\frac{\mu}{\hbar}\sqrt{\hbar\omega_c/(2\varepsilon_0 V)}\propto 1/\sqrt V$, the collective
splitting $\hbar\Omega_R = 2\mu\sqrt{N/V}\sqrt{\hbar\omega_c/2\varepsilon_0}$ depends only on the **number
density** $N/V$, not on $N$ or $V$ separately. That is *why* measured Rabi splittings scale as
$\sqrt{\text{concentration}}$, and why doubling both volume and molecule count leaves the splitting unchanged.

**The central puzzle.** Hold density (and therefore $\Omega_R$) fixed while growing $N$; then the
per-molecule coupling must shrink as $g\propto 1/\sqrt N$. A collective splitting of $\sim 0.1$–$1$ eV
shared over $10^6$–$10^{12}$ molecules is $\sim 10^{-7}$–$10^{-12}$ eV *per molecule* — utterly negligible
against $k_BT\approx 0.025$ eV. How can that move a local single-molecule barrier? Two genuine resolutions:
(1) **Symmetry breaking** — the moment one molecule differs (it reacts, or fluctuates), permutation
symmetry breaks and a localized dark state forms whose local property shift scales with the *collective*
coupling, not the per-molecule one [Sidler, Schäfer, Ruggenthaler, Rubio, *JPCL* **12**, 508 (2021)].
(2) **Disorder/dephasing** — real disorder and dephasing ($\hat L = \sqrt{\gamma/2}\,\hat\sigma_z$) mix dark
states with polaritons so they gain partial photonic weight and stop being perfectly dark [Reitz et al.,
PMC7615654]. **Honest caveat:** whether this yields experimentally meaningful *ground-state thermal*
chemistry remains contested (see §6).

### Governing equations

Tavis–Cummings Hamiltonian ($N$ emitters, one mode) [Dong et al., arXiv:2110.14174, Eq. 5]:

$$\hat H_\text{TC} = \omega_r a^\dagger a + \sum_{j=1}^{N}\Big[\tfrac{\omega_j}{2}\sigma_{z,j} + \Gamma_j\big(a^\dagger\sigma_{-,j} + \sigma_{+,j}a\big)\Big].$$

Bright state and $\sqrt N$ enhancement [Mandal et al., *Chem. Rev.* **123**, 9786 (2023), Eq. 13]:

$$|B,0\rangle = \frac{1}{\sqrt N}\sum_J|e_J\rangle,\qquad g_N = g\sqrt N,\qquad \Omega_R = 2g\sqrt N.$$

Collective Rabi splitting, general and resonant [Mandal et al., Eqs. 16–17]:

$$\Omega_R = \sqrt{(\Delta E - \hbar\omega_c)^2 + 4Ng_c^2}\ \xrightarrow{\ \Delta E=\hbar\omega_c\ }\ 2\sqrt{N}\,g_c.$$

> **Convention to defend (factor of 2).** The single-emitter splitting is $2g$; the collective splitting is
> $2g\sqrt N$. Some papers name the *per-emitter coupling* "$\Omega_R$" (e.g. De Bernardis, Mercurio &
> De Liberato, arXiv:2403.02402), others name it "$g_c$" (Mandal, Rider). A quoted "Rabi splitting $X$ meV"
> means the off-diagonal Hamiltonian element is $V=X/2$. Never mix the two bookkeepings.

### How to visualize it faithfully

- **Energy-level fan vs $N$:** two polaritons split apart as $2g\sqrt N$ while a flat band of $N-1$ dark
  states stays pinned at the bare energy in the gap; the dark band thickens into a near-continuum at large $N$.
- **Dipole-arrow interference panel:** $N$ little arrows; bright = all in-phase (resultant grows like $\sqrt N$),
  dark = zero resultant. Let the user rotate arrows (add disorder) and watch a dark state "light up."
- **Two-convention meter:** toggle "constant $g$ (splitting $\propto\sqrt N$)" vs "constant density
  ($g\propto 1/\sqrt N$, splitting fixed)"; display splitting **and** energy-share-per-molecule $=\Omega_R/N$
  against a $k_BT$ reference line so the per-molecule share visibly drops below thermal.
- **Density slider, not number slider:** a Fabry–Pérot cartoon where the Rabi readout tracks $\sqrt{N/V}$.

### Misconceptions to avoid

- *"A big Rabi splitting means each molecule is strongly coupled."* No — at fixed density each molecule's
  $g\propto 1/\sqrt N$ is tiny; the splitting is a property of the single bright collective mode.
- *"$\sqrt N$ enhancement means more total light–matter energy."* No — the photon couples to exactly one
  collective mode; it is constructive interference, not $N$ independent strong couplings.
- *"Dark states are inert."* Only in the idealized homogeneous, dephasing-free limit; they are the reservoir
  where most population lives.
- *"The splitting scales with absolute $N$."* It scales with density $N/V$.

---

## 2. The HTC turnover: why cavity-modified electron transfer is non-monotonic in $N$

> Source throughout: Sharma & Chen, *J. Chem. Phys.* **161**, 104102 (2024) = arXiv:2406.17101.
> (Verified citation; the "104109" sometimes seen is an error — DOI 10.1063/5.0225434 resolves to 104102.)

### The WHY

Start from Marcus electron transfer (ET, §3): a donor–acceptor pair has two diabatic parabolas; the rate
is a Gaussian in the activation energy $E_a$, maximal when $E_a=0$ (barrier-less). Now put $N$ identical
D–A pairs in a single-mode cavity. The light–matter coupling opens a **photon-assisted ET channel**: the
electron can hop while absorbing (RWA-I, $E_{AD}>0$) or emitting (RWA-II, $E_{AD}<0$) a cavity photon.
After polaron-transforming, the effective diabatic couplings (in the $g_{AD}=0$ limit) are
$T_{00}=T_{11}=H_{AD}$ (ordinary), $T_{01}=\hbar\omega_c\,t_{AD}$ (absorption), $T_{10}=-\hbar\omega_c\,t_{AD}$
(emission), where $t_{AD}$ is dimensionless [text after Eq. 23].

**Crucially, only ONE molecule actively reorganizes at a time** (its slow nuclear mode $R_1$). The other
$N-1$ molecules just fluctuate thermally and form the collective bright superposition. So this is a
Tavis–Cummings problem with $N-1$ participants, not $N$. Diagonalizing gives polariton energies

$$\Omega_\pm^{(\mathrm I)} = \frac{\Delta}{2} \pm \sqrt{\Big(\frac{\Delta}{2}\Big)^2 + (N-1)|T_{01}|^2},\qquad \Delta=\hbar\omega_c-E_{AD},$$

and at resonance $\Omega_\pm^{(\mathrm I)}=\pm\sqrt{(N-1)|T_{01}|^2}$ — the splitting grows as $\sqrt{N-1}$
(textbook $\sqrt N$ minus the one reacting molecule).

**The turnover.** The rich path is $P_+\to\{A_1\}1$, whose activation energy is set by
$\Omega_+^{(\mathrm I)}-\hbar\omega_c$. As $N$ grows from 1, $\Omega_+^{(\mathrm I)}=\sqrt{(N-1)|T_{01}|^2}$
climbs toward $\hbar\omega_c$, $E_a$ shrinks toward zero, and the **rate rises**. It is maximal exactly when
the polariton surface is barrier-less:

$$\Omega_+^{(\mathrm I)} - \hbar\omega_c = 0 \;\Longrightarrow\; \sqrt{(N-1)|T_{01}|^2} = \hbar\omega_c.$$

Beyond $N_\text{max}$ **two effects suppress the rate**: (i) the barrier *reopens* — $\Omega_+^{(\mathrm I)}$
overshoots $\hbar\omega_c$, so $E_a$ grows positive again and the Marcus Gaussian collapses; and (ii)
**dilution + dark-state leakage** — the polariton excitation is shared among more molecules, and polariton
relaxation into the $N-2$ dark states (rate $\propto N^{-2}$) increasingly wins. Asymptotically the ET rate
decays as $e^{-N}$ while the polariton-relaxation rate decays as $N^{-2}$. The result is a non-monotonic
rate-vs-$N$ curve: rise (barrier closing) → peak at $N_\text{max}$ (barrier-less) → fall.

### Governing equations and the two corrections you must defend

The Marcus/FGR kernel [Sharma & Chen, Eq. 35]:

$$\mathcal K(V,E_a) = \sqrt{\frac{\pi}{E_r k_B T}}\,\frac{|V|^2}{2\hbar}\,\exp\!\Big[-\frac{E_a^2}{4 k_B T E_r}\Big],\qquad E_a=E_{fi}+E_r.$$

> **Correction #1 (prefactor factor of 2).** This kernel carries $|V|^2/(2\hbar)$. Textbook nonadiabatic
> Marcus is $k=\frac{|V|^2}{\hbar}\sqrt{\pi/(\lambda k_BT)}\exp[\dots]$ — i.e. **twice** Eq. 35. Even
> Sharma–Chen's own parent paper (Semenov & Nitzan, *JCP* **150**, 174122 (2019), Eq. 23) has no $1/2$. So
> Eq. 35 is the standard Marcus rate **up to an overall factor $1/2$**. This is physically inconsequential:
> the factor cancels in every rate *ratio* (quantum yields, branching), and the turnover, barrier, and
> barrier-less condition are prefactor-independent. State it as "identical up to $1/2$," not "identical."

The printed turnover formula [Sharma & Chen, Eq. 44a]:

$$N_\text{max}^{(\mathrm I)} = 1 + \frac{\hbar\omega_c}{|T_{01}|^2}\qquad\text{(as printed)}.$$

> **Correction #2 (dimensions).** $\hbar\omega_c/|T_{01}|^2$ has units $\mathrm{eV}/\mathrm{eV}^2=1/\mathrm{eV}$,
> which cannot be added to the dimensionless $1$. Deriving from the barrier-less condition
> $\sqrt{(N-1)|T_{01}|^2}=\hbar\omega_c$ gives the **dimensionally correct** form
> $$N_\text{max}=1+\frac{(\hbar\omega_c)^2}{|T_{01}|^2}=1+\frac{\hbar\omega_c\,E_{AD}}{|T_{01}|^2}\ \xrightarrow{\ \hbar\omega_c=E_{AD}\ }\ 1+\frac{(\hbar\omega_c)^2}{|T_{01}|^2}.$$
> The two coincide **numerically** only because every published result is at resonance with
> $\hbar\omega_c=E_{AD}=1$ eV, hiding a factor of $E_{AD}=1$ eV. **No published number changes.** Frame this
> as a diligence/clarifying note, not an erratum. The simulation engine already implements the corrected form.

**Golden values (unit-test anchors).** At $\hbar\omega_c=1$ eV:
$N_\text{max}^{(\mathrm I)}=1+1/(0.024731)^2=1636$ (absorption, $|T_{01}|=0.024731$ eV);
$N_\text{max}^{(\mathrm{II})}=1+1/(0.0096297)^2=10785$ (emission, $|T_{10}|=0.0096297$ eV). At each
$N_\text{max}$, $\Omega_+=\hbar\omega_c=1$ eV exactly — the barrier-less point.

> **Dark-state count to defend.** System C has **$N-2$** dark states (the index in Eq. 38's sum upper limit is
> a typo; Appendices A/B count $k=1\dots N-2$). Reconciliation: only the $N-1$ spectators are collectivized;
> Tavis–Cummings on $N-1$ emitters gives 1 bright + $N-2$ dark, and $2+(N-2)=N$. This is *not* a contradiction
> of the generic $N-1$ count in §1 — that applies to textbook TC on $N$ emitters.

### How to visualize it faithfully

- **Sliding Marcus parabolas:** as $N$ rises, the upper-polariton surface climbs as $\sqrt{N-1}\,|T_{01}|$,
  the crossing slides toward the donor minimum until the parabolas are tangent (barrier-less) at $N_\text{max}$,
  then the barrier reopens. Couple to a live $E_a$ and $\exp(-E_a^2/4k_BTE_r)$ readout.
- **Rate-vs-$N$ turnover (log-log, like Fig. 2):** rising rate, vertical marker at $N_\text{max}$, decay;
  overlay the $e^{-N}$ asymptote and the $N^{-2}$ polariton-relaxation curve; shade where ET beats relaxation.
- **Energy ladder:** $\Omega_+^{(\mathrm I)}$ climbing toward a horizontal $\hbar\omega_c$ target; flash
  "barrier-less / $N_\text{max}$" the instant they touch.
- **RWA-I vs RWA-II side-by-side** on the same slider, using $|T_{01}|$ vs $|T_{10}|$, so two $N_\text{max}$
  values ($\sim1636$ vs $\sim10785$) emerge from the same mechanism.

### Misconceptions to avoid

- *"The enhancement scales as $\sqrt N$."* Here it is $\sqrt{N-1}$ (one molecule reacts and is excluded).
- *"$N_\text{max}$ is where the coupling/Rabi splitting is maximal."* No — it is where $\Omega_+=\hbar\omega_c$
  makes the path *activationless*. The optimum is a resonance, not a coupling maximum.
- *"The turnover has one cause."* Two compounding causes past $N_\text{max}$: barrier reopening **and**
  $N^{-2}$ dark-state relaxation, together giving $e^{-N}$.
- *"The asymptotic decay is power-law."* The ET rate decays $e^{-N}$ (exponential); only the relaxation rate
  is $N^{-2}$. Getting these backwards inverts which process dominates.

---

## 3. Marcus and Marcus–Levich–Jortner theory, and the cavity (LP/UP/dark) generalization

### The WHY

ET looks simple — an electron hops D→A — but the deep insight is that the *electron* is fast and the
*nuclei* (bonds + solvent) are slow. The bottleneck is the nuclei rearranging into a geometry where D and A
momentarily have the **same** energy; only there can the electron tunnel without violating energy
conservation (Franck–Condon applied to a reaction). Marcus models the nuclear free energy along a reaction
coordinate $q$ as two equal-curvature parabolas, offset vertically by the driving force $\Delta G^\circ$ and
horizontally by the nuclear distortion. The horizontal offset costs the **reorganization energy** $\lambda$:
the energy to move the charge while freezing every nucleus in its old geometry.

The geometry of two equal parabolas forces the barrier to sit at their intersection:

$$\Delta G^\ddagger = \frac{(\Delta G^\circ + \lambda)^2}{4\lambda}$$

[Tokmakoff, LibreTexts 19.4.05; Marcus, *Rev. Mod. Phys.* **65**, 599 (1993)]. This single quadratic
generates all three regimes:

- **Normal** ($-\Delta G^\circ<\lambda$): more exergonic → lower barrier → faster (chemical intuition).
- **Activationless** ($-\Delta G^\circ=\lambda$): barrier vanishes, fastest possible rate.
- **Inverted** ($-\Delta G^\circ>\lambda$): the crossing climbs the far wall of the product parabola, the
  barrier **re-grows**, and the reaction *slows down even though it is more favorable* — Marcus's signature,
  predicted decades before Closs–Miller measured it.

**Why a rate at all, and what is the prefactor?** In the nonadiabatic (weak-coupling) limit, $H_{AB}\ll\lambda$,
the surfaces nearly cross; Fermi's golden rule gives a rate $\propto |H_{AB}|^2$:

$$k_\text{ET} = \frac{2\pi}{\hbar}|H_{AB}|^2\frac{1}{\sqrt{4\pi\lambda k_BT}}\exp\!\Big[-\frac{(\lambda+\Delta G^\circ)^2}{4\lambda k_BT}\Big].$$

This is *perturbative* — valid only when $H_{AB}$ is small. If $H_{AB}$ grows, the surfaces split into one
smooth adiabatic ground surface, the $|H_{AB}|^2$ scaling breaks, and the prefactor saturates at a nuclear
frequency (adiabatic TST; Landau–Zener interpolates).

**Why MLJ.** Real molecules have stiff vibrations ($\sim1500$ cm$^{-1}$) whose $\hbar\omega$ is *not* $\ll k_BT$,
so they cannot be classical. Levich and Jortner keep the solvent classical ($\lambda_S$) but treat one
high-frequency mode quantum-mechanically, giving a Poisson-weighted sum of Marcus Gaussians, one per
vibrational quantum $v$, with Huang–Rhys factor $S=\lambda_P/\hbar\omega_P$
[Campos-Gonzalez-Angulo, Ribeiro & Yuen-Zhou, *Nat. Commun.* **10**, 4685 (2019), Eq. 1]:

$$k_{R\to P} = \sqrt{\frac{\pi}{\lambda_S k_BT}}\,\frac{|J_{RP}|^2}{\hbar}\,e^{-S}\sum_{v=0}^{\infty}\frac{S^v}{v!}\exp\!\Big[-\frac{(\Delta E+\lambda_S+v\hbar\omega_P)^2}{4\lambda_S k_BT}\Big].$$

Physically, in the inverted region the molecule can dump excess energy into vibrational quanta instead of
fighting the barrier — fast channels that "fill in" the inverted slowdown.

**The cavity twist.** Couple $N$ molecules to a cavity resonant with that high-frequency mode. Strong coupling
hybridizes the photon with the collective bright vibration into two polaritons,
$\omega_{\pm(N)}=\frac{\omega_0+\omega_P}{2}\pm\frac{\Omega_N}{2}$, $\Omega_N=\sqrt{4g^2N+\Delta^2}$, leaving
$N-1$ dark modes at $\omega_P$. MLJ's per-quantum channels split into **three families** — create a quantum in
the **lower polariton (LP)**, the **upper polariton (UP)**, or a **dark mode** — each with its own activation
energy because its product energy is shifted by $\hbar\omega_\pm$ or $\hbar\omega_P$:

$$E^\ddagger_{v_+,v_-,v_D} = \frac{[\Delta E + \lambda_S + \hbar(v_+\omega_+ + v_-\omega_- + v_D\omega_P)]^2}{4\lambda_S}.$$

The LP sits *below* the bare mode, so its channel energy is lower; if the bare channel is in the inverted
region (high barrier), the lowered LP channel can fall into the normal region with a much smaller barrier —
**resonant catalysis**. The catch is statistics: there are $N-1$ dark channels but only one LP. The
Franck–Condon weights carry exactly this bookkeeping — $\sin^2\theta/N$ (UP), $\cos^2\theta/N$ (LP),
$(N-1)/N$ (dark). It is a tug-of-war: entropy favors the dark sea, but the rate depends *exponentially* on
$E^\ddagger$ and only *linearly* on channel count, so a single low-barrier LP channel can still dominate.
Campos et al. show the catalysis is maximal exactly at resonance ($\Delta=0$).

### How to visualize it faithfully

- **Two draggable parabolas:** $\lambda$ slider (horizontal offset), $\Delta G^\circ$ slider (vertical);
  highlight the intersection, show $\Delta G^\ddagger=(\lambda+\Delta G^\circ)^2/4\lambda$ updating live.
- **Regime sweep:** drag $\Delta G^\circ$ down and watch the crossing slide down the reactant well (normal),
  touch the bottom (activationless), then climb the inner product wall (inverted); pair with a rate-vs-$-\Delta G^\circ$
  plot that rises, peaks at $-\Delta G^\circ=\lambda$, and falls.
- **$H_{AB}$ knob:** small $H_{AB}$ = near-crossing diabats (FGR, $\propto|H_{AB}|^2$); large $H_{AB}$ = avoided
  crossing of gap $2|H_{AB}|$ morphing into one adiabatic surface (label switches FGR → adiabatic TST).
- **MLJ ladder:** overlay the Poisson stack of shifted Gaussians (weights $e^{-S}S^v/v!$); vary $S$ and watch
  the $v\ge1$ channels fill the inverted region.
- **Cavity panel:** three stacked Marcus diagrams (LP / dark / UP), each with its own product shift and barrier;
  a tug-of-war meter (dark multiplicity $\propto N-1$ vs LP advantage $\propto e^{-(E_\text{dark}-E_\text{LP})/k_BT}$)
  peaking at $\Delta=0$.

### Misconceptions to avoid

- *"$\lambda$ is electronic."* No — $\lambda$ is purely nuclear/environmental reorganization; $H_{AB}$ is a
  separate quantity that sets the prefactor, not the barrier.
- *"The inverted region goes backward / violates thermodynamics."* It is still exergonic; the *rate* drops for
  a kinetic (Franck–Condon) reason.
- *"More exergonic is always faster."* Only in the normal region.
- *"Classical Marcus is always valid."* Needs $\hbar\omega\ll k_BT$; stiff modes require MLJ.
- *"Strong coupling changes the molecules' intrinsic chemistry."* In the Campos model the bare per-molecule
  barrier is unchanged; the cavity *reshapes channels* (LP/UP/dark), it does not modify bonds.
- *"Polariton catalysis works at any detuning."* It is maximal at $\Delta=0$ and washes out off-resonance.

---

## 4. Cavity-QED foundations and the gauge question

### The WHY

A single cavity mode is a quantum harmonic oscillator, $\hat H_\text{ph}=\hbar\omega_c(a^\dagger a+\tfrac12)$
[Mandal et al., *Chem. Rev.* **123**, 9786 (2023), Eq. 42]. The "$+\tfrac12$" is the vacuum energy: the field
has irreducible **zero-point fluctuations** $E_0=\sqrt{\hbar\omega_c/2\varepsilon_0 V}$ even with no photons,
and those fluctuations couple to the molecular dipole. This is why mode volume matters so much:
$g\sim\mu E_0\propto 1/\sqrt V$, so crushing $V$ (plasmonic picocavities) is the route to single-molecule
strong coupling.

**The matter hierarchy.** One two-level emitter + one mode, counter-rotating terms dropped = Jaynes–Cummings,
$\hat H_\text{JC}=\hbar\omega_c(a^\dagger a+\tfrac12)+\tfrac{\hbar\omega_{eg}}{2}\sigma_z+\hbar g(\sigma^\dagger a+\sigma a^\dagger)$
[De Bernardis, Mercurio & De Liberato, arXiv:2403.02402, Eq. 1]. It conserves excitation number, block-diagonalizes
into $2\times2$ doublets split by $2g\sqrt n$ (the $\sqrt n$ anharmonic ladder behind photon blockade). Add $N$
emitters → Tavis–Cummings, $g_N=\sqrt N g$ (only the symmetric bright state couples; $N-1$ dark). Keep the
counter-rotating terms → Dicke/Rabi, valid at any coupling.

> **Citation to get right.** arXiv:2403.02402 is **De Bernardis, Mercurio & De Liberato** (not "Le Boité").
> Its Eq. 6 gives the ladder $\omega_{n,+}-\omega_{n,-}=2\Omega_R\sqrt n$, so at $n=1$ the vacuum Rabi splitting
> is $2g$.

**The gauge issue.** The same physics is written in the **minimal-coupling / Coulomb gauge** ($\mathbf p\cdot\mathbf A$),
$\hat H=\sum_j\frac{1}{2m_j}(\hat{\mathbf p}_j-z_j\hat{\mathbf A})^2+\hat V+\hat H_\text{ph}$, or in the
**dipole / length gauge** ($\mathbf d\cdot\mathbf E$) reached by the Power–Zienau–Woolley unitary
$U=\exp(-i q\hat x\hat A/\hbar)$, with $\hat H_D=U\hat H_C U^\dagger$. In the *complete* basis these are exactly
unitarily equivalent — identical spectra and observables. Gauge invariance is forced by $U(1)$ local symmetry,
the principle QED is derived from.

**Why the famous "gauge ambiguity" appears.** It is an artifact of **truncation**. The instant you keep only
two matter levels, the projection does not commute with the gauge transformation, so the truncated
$\mathbf p\cdot\mathbf A$ and $\mathbf d\cdot\mathbf E$ Rabi models disagree once $\eta=g/\omega$ is appreciable.
The sharp reason: $p_{nk}=i m(\omega_n-\omega_k)x_{nk}$ [De Bernardis et al., *PRA* **98**, 053819 (2018), Eq. 9].
Momentum couplings *grow* with the energy gap, so in the Coulomb gauge far-off-resonant levels refuse to
decouple and the truncated $\mathbf p\cdot\mathbf A$ model "can dramatically fail even for an extremely anharmonic
spectrum." In the dipole gauge ($x$-couplings are largest between neighbors) truncation is safe. The
**Thomas–Reiche–Kuhn sum rule** $\sum_n(\omega_n-\omega_0)|x_{n0}|^2=\hbar/2m$ bounds the dipole-gauge coupling
and underlies the superradiant no-go theorem. **Resolution** [Di Stefano et al., *Nat. Phys.* **15**, 803 (2019);
Savasta et al., arXiv:2101.00083]: re-impose $U(1)$ inside the truncated space via a parallel transporter
(Peierls phase), yielding a gauge-invariant Coulomb-gauge Rabi model with field operators to all orders that
matches the dipole-gauge result.

**The dipole self-energy (DSE).** The $(\boldsymbol\mu\cdot\mathbf A_0)^2$ / $(\boldsymbol\mu\cdot\mathbf E_0)^2$
term is **not optional**: it appears only upon field quantization, and dropping it makes the ground state
unbounded below in strong/ultrastrong coupling [Mandal et al., Eq. 52]. The **Pauli–Fierz** Hamiltonian
$\hat H_\text{PF}=\hat H_M+\hbar\omega_c(a^\dagger a+\tfrac12)-\boldsymbol\mu\cdot\mathbf E_0\,\hat q_c+\frac{1}{2\hbar\omega_c}(\boldsymbol\mu\cdot\mathbf E_0)^2$
packages dipole coupling + DSE as a displaced oscillator, letting the photon be treated as an extra nuclear
coordinate. **Caveat:** for *plasmonic* (longitudinal-Coulomb) nanocavities the DSE should **not** be added,
because Coulomb coupling is untouched by PZW [Feist et al.].

**The regime ladder.** Set by $\eta=g/\omega$: weak ($g<$ loss), strong ($g>$ loss, vacuum Rabi splitting
resolvable), ultrastrong at $g/\omega\sim0.1$, deep-strong at $g/\omega\sim1$ [Forn-Díaz et al.,
*Rev. Mod. Phys.* **91**, 025005 (2019)]. The RWA is valid only in strong-but-not-ultrastrong coupling;
past $\eta=0.1$ counter-rotating effects (Bloch–Siegert shift, virtual ground-state photons) become observable.

### How to visualize it faithfully

- **Gauge side-by-side (the single most important figure):** compute the *same* full-Hamiltonian spectrum in
  both gauges — they overlay perfectly. Then a "truncate to 2 levels" toggle: the dipole-gauge curve stays close
  to exact while the Coulomb-gauge curve diverges as $\eta$ passes $\sim0.1$ (reproduces De Bernardis Fig. 3).
- **Vacuum-field oscillator:** a fuzzy $n=0$ state of width $E_0\propto1/\sqrt V$; a $V$ slider broadens it and
  raises $g$.
- **JC ladder:** dressed doublets split by $2g\sqrt n$ (anharmonic).
- **DSE stability:** ground-state energy vs coupling **with** and **without** $(\boldsymbol\mu\cdot\mathbf A_0)^2$;
  without it the curve dives to $-\infty$.
- **Regime ruler:** $\eta$ axis with bands at weak / strong / USC (0.1) / DSC (1); toggling RWA shows the error
  growing in the USC band.

### Misconceptions to avoid

- *"No photons → no coupling."* The $n=0$ mode fluctuates ($E_0$); vacuum Rabi splitting exists with zero photons.
- *"The two gauges can give different physical answers."* Not in the complete basis — they are exactly unitarily
  equivalent. Differences appear *only* after truncation and are artifacts.
- *"The $\mathbf p\cdot\mathbf A$ and $\mathbf d\cdot\mathbf E$ two-level models are equally valid."* Under the
  same truncation they disagree; truncate in the dipole gauge (or gauge-fix the Coulomb model).
- *"The DSE is a droppable small correction."* False in strong/USC (unbounded ground state) — but also do **not**
  add it for longitudinal plasmonic nanocavities.
- *"The RWA is always fine."* It silently fails for $g/\omega\gtrsim0.1$.

---

## 5. Microcavity exciton-polaritons and polariton condensation

### The WHY

A planar microcavity is two distributed Bragg reflectors (DBRs) sandwiching a $\lambda$-spacer. The trapped
photon has quantized $k_z=\pi M/L_z$ but free in-plane $k_\parallel$, so it disperses as a paraboloid; near
$k_\parallel=0$,

$$E_\text{cav}(k_\parallel)\simeq E_\text{cav}^0 + \frac{\hbar^2 k_\parallel^2}{2 m_\text{cav}},\qquad m_\text{cav}=\frac{\hbar n k_z}{c}=\frac{n^2 E_\text{cav}^0}{c^2}$$

[Carusotto & Ciuti, *Rev. Mod. Phys.* **85**, 299 (2013), Eqs. 1–2]. Because the photon rest energy is huge,
this **effective mass is tiny** — $\sim10^{-5}$–$10^{-4}\,m_e$ (CdTe: $\sim3.6\times10^{-5}\,m_e$). The
confined photon behaves as an ultralight 2D massive particle. *This lightness is the single most important
fact* — it is what later makes a solid-state condensate possible far above the nanokelvin scale of atomic BEC.

**Strong coupling.** Add a quantum-well exciton near resonance. When the coupling $V$ exceeds both linewidths,
the right description is a $2\times2$ coupled oscillator with eigenvalues

$$E_\text{LP/UP}=\tfrac12\Big[E_\text{cav}+E_\text{exc}\pm\sqrt{(E_\text{cav}-E_\text{exc})^2+(2V)^2}\Big].$$

The branches **anticross** (level repulsion, never touch); at resonance the minimum gap is the vacuum Rabi
splitting $\hbar\Omega_R=2V$ [Weisbuch et al., *PRL* **69**, 3314 (1992)]. The eigenvector weights are the
**Hopfield coefficients**, set by the detuning $\delta=E_\text{cav}-E_\text{exc}$:

$$|X|^2=\tfrac12\Big(1+\frac{\delta}{\sqrt{\delta^2+(2V)^2}}\Big),\quad |C|^2=\tfrac12\Big(1-\frac{\delta}{\sqrt{\delta^2+(2V)^2}}\Big),\quad |X|^2+|C|^2=1$$

[Hopfield, *Phys. Rev.* **112**, 1555 (1958)]. At $\delta=0$ the LP is exactly 50/50; for $\delta<0$ it is
photon-like (light, fast), for $\delta>0$ exciton-like (heavy, interacting). **A single knob — detuning,
set by the cavity-length wedge — continuously tunes the LP's mass and interaction strength.** This is the
lever the whole field uses.

> **Convention to defend (sign + factor of 2).** The spec uses $\delta=E_\text{cav}-E_\text{exc}$ (Deng
> convention), under which $|X|^2=\tfrac12(1+\delta/\sqrt{\cdots})$ correctly makes the LP excitonic for
> $\delta>0$. Sources using $\delta=E_\text{exc}-E_\text{cav}$ flip the sign. And $V$ here is *half* the Rabi
> splitting, so the radicand carries $(2V)^2=(\hbar\Omega_R)^2$.

**Condensation.** Polaritons are composite bosons inheriting the photon's ultralight mass ($\sim10^9$ times
lighter than rubidium). Above a threshold pump density they macroscopically occupy $k\approx0$ via bosonic
final-state stimulation, with measured signatures of a macroscopic quantum phase: massive ground-state
occupation, temporal coherence, long-range spatial coherence, and spontaneous linear polarization
[Kasprzak et al., *Nature* **443**, 409 (2006)]. This is a **polariton laser, not a photon laser**: coherent
light with *no electronic population inversion* [Imamoğlu et al., *PRA* **53**, 4250 (1996)]. But polaritons
leak through the mirrors on ps timescales, so the condensate is inherently **driven-dissipative** —
non-equilibrium, described by a generalized (complex Ginzburg–Landau) Gross–Pitaevskii equation with gain and
loss [Wouters & Carusotto, *PRL* **99**, 140402 (2007)], which even makes the Goldstone mode diffusive rather
than sonic.

**The graph simulator.** Shaping the pump imprints a lattice of condensates; each condensate's phase
$\theta_i$ is a continuous "XY spin." Outflowing polaritons couple neighbors with a strength that, via a
Bessel $J_0(k_c r)$, oscillates in sign — tunable ferro- or antiferromagnetic by spacing. At threshold,
bosonic stimulation makes the system condense into the global phase configuration of maximum total occupation
(minimum loss), which is exactly the global minimum of $\mathcal H_\text{XY}=-\sum_{i<j}J_{ij}\cos(\theta_i-\theta_j)$
[Lagoudakis & Berloff, *New J. Phys.* **19**, 125008 (2017); Berloff et al., *Nat. Mater.* **16**, 1120 (2017)].
The machine "computes" the XY ground state by physically condensing into it.

### How to visualize it faithfully

- **Live $E$ vs $k_\parallel$:** dashed bare cavity parabola + flat exciton line, solid LP/UP anticrossing; a
  detuning slider slides the photon parabola and the gap stays pinned at $2V$ at resonance. Color the branches
  by Hopfield fraction (red↔blue exciton/photon).
- **Vacuum Rabi oscillation inset:** probability sloshing photon↔exciton at $\Omega_R$; a damping slider past
  $V$ collapses two modes into one (strong→weak crossover).
- **Angle-resolved PL emulator:** dual axis ($\theta$ and $k_\parallel=\frac{E}{\hbar c}\sin\theta$).
- **Condensation threshold:** a $k$-space occupation histogram that collapses to a $k=0$ spike as pump crosses
  threshold; side gauges for $g_1(r)$, temporal coherence, polarization.
- **Graph-simulator sandbox:** place sites; bonds auto-color ferro/antiferro from $J_0(k_c r)$; phase arrows
  relax under Kuramoto dynamics to the live-computed $\mathcal H_\text{XY}$ minimum.

### Misconceptions to avoid

- *"The cavity photon has a real rest mass."* It is an *effective* mass from $z$-confinement + parabolic expansion.
- *"The branches cross."* They **anticross** — rendering crossing parabolas is the classic error.
- *"Strong coupling = a big splitting on a plot."* It requires coupling to beat *both* linewidths; otherwise one
  broadened mode.
- *"Polariton lasing is photon lasing."* It needs *no* electronic inversion.
- *"Polariton BEC is equilibrium BEC."* It is driven-dissipative; the Goldstone mode is diffusive.
- *"Hopfield fractions are fixed at 50/50."* Only at $\delta=0$.
- *"The simulator anneals / does gradient descent."* It is gain-driven selection of the max-occupation state at
  threshold.

---

## 6. The vibrational-strong-coupling (VSC) controversy

### The WHY — the claim

In VSC you put a neat liquid between two IR mirrors, tune the cavity into resonance with a molecular vibration,
and the vibration + photon hybridize into two vibrational polaritons split by $\hbar\Omega_R=2g\sqrt N$
($N\sim10^{10}$ per mode). The striking Ebbesen-group claim: this happens **in the dark**, with only the
vacuum field, yet it changes thermal chemistry. Thomas et al. (2016) reported a deprotection reaction *slowed*
by up to $\sim5.5\times$ when the Si–C stretch was coupled [*Angew. Chem. Int. Ed.* **55**, 11462]; Thomas et
al. (2019) reported slowed rate **and** switched selectivity (branching ratio) [*Science* **363**, 615], with
Eyring analyses showing large $\Delta H^\ddagger$/$\Delta S^\ddagger$ changes and sharp on-resonance behavior.

### The WHY — why theorists balk

Conventional transition-state theory (TST) predicts **essentially no effect**, because the Eyring rate
$k=\frac{k_BT}{h}e^{-\Delta G^\ddagger/k_BT}$ depends only on *equilibrium* partition-function ratios. Galego,
Climent, García-Vidal & Feist [*PRX* **9**, 021057 (2019)] and Campos-Gonzalez-Angulo & Yuen-Zhou showed the
cavity's TST influence reduces to a Casimir–Polder-like electrostatic shift that is **resonance-independent**
and vanishingly small in a macroscopic cavity. Worse is the **collective-coupling dilemma**: although $N$
molecules couple collectively (big Rabi splitting), only 2 polaritons are shifted; the $N-1$ dark modes behave
like bare molecules. By sheer entropy they dominate, so the per-molecule polariton effect is diluted by $1/N$
to nothing. The very feature that makes the splitting large (collectivity) makes the chemical effect tiny.
Equilibrium theory therefore predicts **no resonant rate effect** — contradicting the sharp resonances reported.

### The WHY — the reproducibility crisis

Multiple independent groups reproduce the *optics* (Rabi splitting) but not the *rate change*:
Imperatore, Asbury & Giebink (cyanate hydrolysis, null) [*JCP* **154**, 191103 (2021)]; Wiesehan & Xiong
(ester hydrolysis, non-reproducible, with a catalogue of artifacts — dead volume, evaporation, fringe-baseline
drift, pathlength changes); Weichman's group (CN + cyclohexane, no change). Simpkins notes there are no agreed
best practices for building/interrogating cavities or excluding artifacts.

### The WHY — proposed rescues

Because equilibrium TST fails, surviving mechanisms are **dynamical / non-equilibrium**. Campos-Gonzalez-Angulo
et al. proposed dark-state-channel catalysis (§3). Lindoy, Mandal & Reichman [*Nat. Commun.* **14**, 2733 (2023)]
found sharp resonant rate changes in numerically exact quantum dynamics — **but only when cavity loss is
included** (no loss, no resonance) and only fully quantum-mechanically. Ke [arXiv:2503.12568 (2025)] showed with
exact HEOM that *equilibrium populations are unchanged* inside the cavity, so any resonant effect **must** be
non-equilibrium. **Honest state of the art:** a single-molecule, fully quantum, lossy, non-equilibrium model
can produce resonant features, but whether they survive the $1/N$ collective dilution to explain macroscopic
experiments is **unproven** — the authors themselves flag this gap.

### Governing equations

$$\hbar\Omega_R = 2\hbar g\sqrt N\quad\text{(collective)},\qquad k=\frac{k_BT}{h}\,e^{\Delta S^\ddagger/k_B}\,e^{-\Delta H^\ddagger/k_BT}\quad\text{(Eyring/TST)}.$$

### How to visualize it faithfully

- **Polariton dispersion + rate overlay:** rate curve peaking exactly at zero detuning.
- **Collective fan with a $N$ slider:** 1 UP, 1 LP, a thick band of $N-1$ dark states; as $N$ grows the
  splitting grows but the *fractional* shifted population shrinks as $1/N$ — make dilution visceral.
- **Two competing explanations side-by-side:** (a) the tiny resonance-independent equilibrium shift vs (b) a
  dynamical channel that opens only on resonance.
- **Cavity-loss knob:** rate-vs-frequency flat at loss $=0$, growing a sharp resonance as loss rises
  (the Lindoy–Mandal–Reichman finding).
- **Artifact simulator:** inject evaporation / pathlength drift / fringe error into a synthetic kinetic trace
  and watch a *spurious* "rate change" appear with zero true cavity effect.

### Misconceptions to avoid

- *"VSC pumps energy into the molecule."* No — it is in the dark; any effect is structural or
  vacuum-fluctuation-mediated, never absorbed photons.
- *"A large Rabi splitting implies a large chemical effect."* Diluted by $\sim1/N$.
- *"Polaritons form on individual molecules."* They are delocalized over $\sim10^{10}$ molecules; almost every
  molecule is a dark spectator.
- *"Equilibrium TST can explain a sharp resonance."* It cannot — do not let a sim show resonant catalysis
  emerging from equilibrium thermodynamics alone.
- *"The claims are settled."* As of 2025 they are contested.
- *"The cavity changes equilibrium populations."* Exact simulations say populations are unchanged; the effect
  (if real) is non-equilibrium.
- *Conflating VSC ground-state thermal chemistry (controversial) with laser-driven or electronic strong
  coupling (different, less contested).*

---

## 7. The multimode frontier: a real Fabry–Pérot is a mode continuum

> **Citation hygiene to defend.** arXiv:2511.04017 = *J. Chem. Phys.* **164**, 024113 (2026) is **Ying & Nitzan**
> (a *single-mode* polaron/FGR theory whose only multimode content is a lossy-cavity continuum mapping) —
> **not** the Chen group, and **not** an $N$-dependence follow-up. The genuine multimode/$N$ work is: Sharma &
> Chen 2024 (single-mode HTC, non-monotonic $N$); Zhou, Chen, Sukharev, Subotnik, Nitzan, *PRA* **109**, 033717
> (2024) (truly multimode Fabry–Pérot transport); Ke & Assan, *JCP* **163**, 164703 (2025) (few-mode rate
> enhancement); T. E. Li, arXiv:2403.12411 (broken in-plane symmetry). A Notre Dame physicist will catch a
> misattribution instantly.

### The WHY

Two parallel mirrors confine light only along $z$, so $k_\perp=m\pi/L_z$ is quantized but the in-plane
$\mathbf k_\parallel$ is a continuous 2D vector. The cavity supports not one frequency but a paraboloid,

$$\omega_c(\mathbf k_\parallel)=c\sqrt{(\pi/L_z)^2+|\mathbf k_\parallel|^2},$$

plus a longitudinal comb spaced by the free spectral range $\Delta_\text{FSR}=\pi c/(n_\text{ref}L_z)$. "The
cavity mode at $\omega_c$" is shorthand for one slice. Single-mode theory is the approximation that the FSR is
huge and the molecular linewidth small.

**What physically changes with many modes.** (1) **Broken clean permutational symmetry.** The crisp
1-bright/$(N-1)$-dark accounting assumes every molecule sees the same field (exact in-plane translational
symmetry). Real layers are inhomogeneous in-plane, scattering between $\mathbf k_\parallel$ modes and mixing
bright with formerly dark states [Li, arXiv:2403.12411]. (2) **Dispersion → transport.** Lower polaritons
inherit the photon's tiny effective mass, so the LP dispersion has real curvature and a finite group velocity
$v_g=d\omega/dk_\parallel$. Exciton transport is then synchronized with the field and moves *ballistically*
(hundreds of µm/ps) [Zhou et al., *PRA* **109**, 033717 (2024)] — a multimode-only effect, the cavity-QED face
of retardation. (3) **A spectral density, not a delta.** Once many modes (including loss) participate the right
object is $J(\omega)$. Ying & Nitzan model a lossy cavity as a Brownian-oscillator broadening,
$J_\text{eff}(\tilde\omega)=2\omega\Gamma\tilde\omega/[(\tilde\omega^2-\omega^2)^2+\Gamma^2\tilde\omega^2]$,
$\Gamma=1/\tau_c$.

**Relevance to rates.** Nonadiabatic ET is FGR,
$k_{D\to A}=\frac{1}{\hbar^2}\int dt\,e^{-i\Delta G_0 t/\hbar}C_{ff}(t)$, with the kernel
$C_{ff}(t)=[h(t)+g(t)]e^{f(t)}$ whose exponent $f(t)$ carries both cavity and bath as sums/integrals over
their spectral densities — "multimode" just replaces a single cosine by an integral over $J(\omega)$
[Ying & Nitzan, arXiv:2511.04017, Eqs. 8, 10, 11]. New multimode physics that single-mode theory misses: when
the FSR $\sim$ Rabi splitting, adjacent modes open new pathways, and molecular anharmonicity + several resonant
modes enables cascade vibrational ladder-climbing — a *non-additive* enhancement [Ke & Assan].

### How to visualize it faithfully

- **Cavity paraboloid + angle slider:** drag $\theta$, watch the point slide up the band (so "$k_\parallel\neq0$
  is a different mode").
- **Avoided crossing → polariton band:** turn $g$ on; show the LP slope (group velocity) change near resonance.
- **Ballistic transport movie:** launch a wavepacket at chosen $k_\parallel$, front propagates at $v_g$; compare
  a flat (single-mode, $v_g\approx0$) vs curved band.
- **Bright/dark bookkeeping that breaks:** start periodic (clean 1 bright + $N-1$ dark), add in-plane disorder,
  watch weight leak from dark into bright.
- **Mode comb vs FSR:** shrink $L$ to widen the FSR (single-mode) or grow it to pack modes near a vibration
  (multimode); shade which modes fall within a linewidth.
- **Spectral-density picker:** single delta vs Brownian $J_\text{eff}(\omega)$, recomputing the FGR rate live.

### Misconceptions to avoid

- *"A cavity has one mode at $\omega_c$."* Only $k_\perp$ is quantized; $k_\parallel$ is continuous plus a comb.
- *"Collective coupling always speeds chemistry; bigger $N$ is better."* The yield is non-monotonic in $N$
  (large-$N$ problem, §2).
- *"The $N-1$ dark states are inert spectators."* Only under exact in-plane symmetry; inhomogeneity mixes them.
- *"Multimode just renormalizes the single-mode answer."* It opens qualitatively new channels (ballistic
  transport, cascade ladder-climbing).
- *"Cavity loss is a small correction."* Loss turns the discrete mode into a continuum and can dominate.
- *"arXiv:2511.04017 is a Chen-group multimode unified theory."* It is Ying & Nitzan, single-mode + lossy
  continuum.

---

## 8. The experimental reality of optical cavities (the hardware behind the sliders)

### The WHY

A real cavity is two mirrors with three independent quantitative jobs: (1) cavity **length** sets *which*
frequencies resonate, (2) mirror **reflectivity** sets *how long* a photon survives (finesse, $Q$, loss
$\kappa$), (3) **mode volume** sets *how strongly* one molecule couples. The simulation's geometry sliders map
onto exactly these.

**Which frequencies.** A Fabry–Pérot of optical length $nL$ resonates when an integer number of half-wavelengths
fits: $\nu_m=mc/(2nL)$, spaced by the free spectral range $\mathrm{FSR}=c/(2nL)$. Shrinking $L$ pushes modes
apart and up — the spec's $L_z\to k_z=\pi M/L_z\to E_\text{cav}^0$ mapping. For one mode near the exciton you
need $L$ of order one wavelength (sub-micron) — a microcavity.

**Why mirrors are stacks, not metal.** Metal absorbs a few percent per bounce — fatal for thousands of bounces.
A distributed Bragg reflector (DBR) uses alternating quarter-wave ($nd=\lambda/4$) high/low-index layers; the
partial reflections add in phase and reflectivity climbs toward 1 with the index ratio raised to the $2N$ power,

$$R=\Big(\frac{n_o n_2^{2N}-n_s n_1^{2N}}{n_o n_2^{2N}+n_s n_1^{2N}}\Big)^2$$

[Wikipedia, *Distributed Bragg reflector*; verified numerically: GaAs/AlAs reaches $R\approx0.965$ at 15 pairs,
$\approx0.995$ at 20]. The stopband *width* $\Delta f/f_0=(4/\pi)\arcsin[(n_2-n_1)/(n_2+n_1)]$ is fixed by
contrast alone. The field also penetrates a depth $L_\text{DBR}\approx(\lambda/2)/(n_H-n_L)$, lengthening the
effective cavity and lowering the photon mass.

**How long a photon lives.** Finesse $F=\mathrm{FSR}/\mathrm{FWHM}\approx\pi\sqrt R/(1-R)$ ($R=0.99\to F\approx313$,
$R=0.999\to F\approx3140$). The quality factor $Q=\omega_0/\kappa=\omega_0\tau=F\,(\nu_0/\mathrm{FSR})$ is the
photon lifetime in optical cycles. The loss rate $\kappa=\omega_0/Q=2\pi\,\mathrm{FWHM}$ is the linewidth — the
quantity the spec **defers** (§9 of the spec): the reflectivity slider should drive $\kappa$, not the resonance
position. Honest numbers: III-V polariton cavities $Q\sim10^3$–$10^4$; liquid IR (VSC) cavities are *lossy*,
$Q\sim50$; silica microspheres $Q\sim8\times10^9$.

**How strongly one molecule couples.** $g=\frac{\mu}{\hbar}\sqrt{\hbar\omega_c/(2\varepsilon_0 V)}\propto1/\sqrt V$.
Diffraction caps dielectric cavities at $V\sim(\lambda/n)^3$; plasmonic nanocavities confine light in metal gaps.
Chikkaraddy et al. [*Nature* **535**, 127 (2016)] reached $V<40$ nm$^3$ ($\sim10^{-6}$ of a cubic wavelength)
and single-molecule strong coupling **at room temperature**: vacuum Rabi splitting $\sim90$ meV for one
molecule, $\sim300$ meV for ten.

**What counts as "strong."** Coupling must beat loss:

$$\hbar\Omega_R>\frac{\gamma_x+\gamma_c}{2},\qquad C\equiv\frac{g^2}{\kappa\gamma_\perp}>1.$$

Real splittings span six orders of magnitude: III-V excitons 4–16 meV; organic/plasmonic excitons up to
100–300 meV; molecular vibrations tens–hundreds of cm$^{-1}$ (e.g. W(CO)$_6$ C–O stretch up to $\sim480$ cm$^{-1}$
neat, $\sim24\%$ of the $\sim2000$ cm$^{-1}$ mode — ultrastrong).

### How to visualize it faithfully

- **Reflectivity → finesse → linewidth:** raise $R$ (or DBR pair count); the resonance peak grows *taller and
  sharper*; show $F$ and FWHM $=\mathrm{FSR}/F$ updating — makes the deferred $\kappa$ real.
- **DBR stack build-up:** add pairs; the reflectance fills into a flat-topped stopband whose *width* is fixed by
  contrast; mark $L_\text{DBR}$.
- **Length dial → comb of modes** spaced by $\mathrm{FSR}=c/2nL$; highlight the one mode on the exciton.
- **Mode-volume morph** from microcavity $(\lambda/n)^3$ down to a $<40$ nm$^3$ plasmonic gap, with the Rabi
  splitting growing (reproduce 90 meV / 300 meV).
- **Strong-vs-weak phase diagram:** Rabi splitting vs $(\gamma_x+\gamma_c)/2$; the single peak resolves into the
  anticrossing only above the loss line.

### Misconceptions to avoid

- *"More layer pairs improve the mirror without limit."* Reflectivity saturates; the *stopband width* is fixed by
  contrast alone.
- *"A DBR is a hard mirror at a fixed plane."* The field penetrates $L_\text{DBR}$; the effective length is longer.
- *"Higher $Q$ means stronger coupling."* $Q$ (set by reflectivity) and $g$ (set by mode volume) are independent —
  plasmonic cavities have terrible $Q$ yet single-molecule strong coupling; liquid IR cavities have $Q\sim50$ yet
  strong-couple via $\sqrt N$.
- *"Finesse and $Q$ are the same."* $F=\mathrm{FSR}/$linewidth; $Q=F\times\nu/\mathrm{FSR}$.
- *"A bigger Rabi splitting automatically means strong coupling."* It must exceed the *combined* linewidths.
- *"The simulation models photon loss."* The spec **defers** $\kappa$ (ideal mirrors, single mode, no Lindblad);
  the reflectivity slider is roadmap — a credible sim must say so, not fake a linewidth.

---

## 9. Things I can now defend (checklist)

**Collective coupling & dark states (§1)**
- [ ] Why exactly *one* bright state couples and it does so $\sqrt N$ harder (Dicke arithmetic: $N$ in-phase
      dipoles, $1/\sqrt N$ norm).
- [ ] Why there are $N-1$ dark states ($\sum_J c_{J\alpha}=0\Rightarrow$ zero net dipole) pinned at the bare energy.
- [ ] Why the Rabi splitting scales as $\sqrt{N/V}=\sqrt{\text{density}}$, and what changes between constant-$g$
      and constant-density conventions.
- [ ] The per-molecule-energy puzzle and its two resolutions (symmetry breaking; disorder/dephasing).

**The HTC turnover (§2)**
- [ ] The mechanism: barrier closes ($\Omega_+\to\hbar\omega_c$), is barrier-less at $N_\text{max}$, reopens, and
      is then killed by $e^{-N}$ dilution + $N^{-2}$ relaxation.
- [ ] **Correction #1:** Eq. 35 is textbook Marcus up to a prefactor $1/2$ (cancels in all ratios).
- [ ] **Correction #2:** printed $N_\text{max}=1+\hbar\omega_c/|T_{01}|^2$ is dimensionally wrong; correct form
      $1+(\hbar\omega_c)^2/|T_{01}|^2$ (no published number changes — all results at $\hbar\omega_c=E_{AD}=1$ eV).
- [ ] Golden values 1636 and 10785, and why each sits exactly at $\Omega_+=\hbar\omega_c$.
- [ ] Why the dark-state count is $N-2$ for System C (TC on $N-1$ spectators), not $N-1$.

**Marcus / MLJ (§3)**
- [ ] The three regimes from one quadratic, and why the inverted region is kinetic (Franck–Condon), not
      thermodynamic.
- [ ] Why the prefactor is $\propto|H_{AB}|^2$ only in the nonadiabatic limit (and the adiabatic/Landau–Zener
      crossover).
- [ ] Why MLJ (Poisson sum, Huang–Rhys $S$) is needed for stiff modes and fills the inverted region.
- [ ] The LP/UP/dark channel split, per-channel barriers, the $(N-1)$-vs-1 weight tug-of-war, resonance peak.

**Cavity-QED foundations & gauge (§4)**
- [ ] Vacuum fluctuations $E_0\propto1/\sqrt V$ as the origin of coupling with zero photons.
- [ ] JC → TC → Dicke, and the $2g\sqrt n$ ladder.
- [ ] Why complete-basis gauges agree (PZW unitary), why *truncation* breaks it, and the $p_{nk}\propto(\omega_n-\omega_k)x_{nk}$
      reason the Coulomb gauge fails under truncation.
- [ ] The DSE (mandatory in strong/USC; *omit* for longitudinal plasmonic cavities), Pauli–Fierz, the $\eta=g/\omega$
      regime ladder, and RWA validity.
- [ ] **Citation:** arXiv:2403.02402 is De Bernardis, Mercurio & De Liberato.

**Microcavity polaritons & condensation (§5)**
- [ ] The ultralight cavity-photon effective mass and why it is the key to high-temperature condensation.
- [ ] The anticrossing, $2V$ at resonance, and Hopfield coefficients tuning LP mass/interaction via detuning.
- [ ] Polariton lasing without inversion; driven-dissipative (non-equilibrium) BEC; diffusive Goldstone mode.
- [ ] The XY/Kuramoto graph simulator as gain-driven minimization (not annealing).
- [ ] **Conventions:** $\delta=E_\text{cav}-E_\text{exc}$ sign; $V=$ half the Rabi splitting.

**VSC controversy (§6)**
- [ ] Why equilibrium TST predicts no resonant effect, and the $1/N$ dilution dilemma.
- [ ] The reproducibility record (optics reproduce; rates largely do not) and the artifact pathways.
- [ ] Why any genuine effect must be non-equilibrium (Ke: equilibrium populations unchanged), and that resonance
      needs cavity loss (Lindoy–Mandal–Reichman).
- [ ] The honest open question: does a single-molecule lossy resonance survive $1/N$ to a macroscopic effect?

**Multimode frontier (§7)**
- [ ] Why a real Fabry–Pérot is a $k_\parallel$ continuum + FSR comb, not one mode.
- [ ] The three multimode consequences: broken bright/dark symmetry, ballistic transport from band curvature,
      spectral-density rate kernels.
- [ ] **Citation:** arXiv:2511.04017 = Ying & Nitzan (single-mode + lossy continuum), *not* the Chen group.

**Cavity hardware (§8)**
- [ ] How length → $\omega_c$, reflectivity → $\kappa$ (finesse/$Q$), mode volume → $g$.
- [ ] Why DBR reflectivity saturates but stopband width is contrast-limited; field penetration $L_\text{DBR}$.
- [ ] Why $Q$ and $g$ are independent (plasmonic: low $Q$, single-molecule strong coupling).
- [ ] The strong-coupling inequality $\hbar\Omega_R>(\gamma_x+\gamma_c)/2$ and that the sim *defers* photon loss.

---

### Source pointers (for the verbatim equations and numbers above)

- Sharma & Chen, *J. Chem. Phys.* **161**, 104102 (2024) = arXiv:2406.17101 — HTC model (Eqs. 23, 26, 35, 42–44).
- Mandal, Taylor, Weight, Koessler, Li, Huo, *Chem. Rev.* **123**, 9786 (2023) — bright/dark states, JC/TC, gauge, DSE, Pauli–Fierz.
- De Bernardis, Mercurio & De Liberato, arXiv:2403.02402; De Bernardis et al., *PRA* **98**, 053819 (2018); Savasta et al., arXiv:2101.00083; Forn-Díaz et al., *RMP* **91**, 025005 (2019) — gauge & regimes.
- Carusotto & Ciuti, *RMP* **85**, 299 (2013); Hopfield, *Phys. Rev.* **112**, 1555 (1958); Weisbuch et al., *PRL* **69**, 3314 (1992); Kasprzak et al., *Nature* **443**, 409 (2006); Lagoudakis & Berloff, *NJP* **19**, 125008 (2017) — microcavity & condensation.
- Campos-Gonzalez-Angulo, Ribeiro & Yuen-Zhou, *Nat. Commun.* **10**, 4685 (2019); Galego, Climent, García-Vidal & Feist, *PRX* **9**, 021057 (2019); Thomas et al., *Angew. Chem. Int. Ed.* **55**, 11462 (2016) & *Science* **363**, 615 (2019); Lindoy, Mandal & Reichman, *Nat. Commun.* **14**, 2733 (2023); Ke, arXiv:2503.12568 — MLJ & VSC.
- Ying & Nitzan, *JCP* **164**, 024113 (2026) = arXiv:2511.04017; Zhou et al., *PRA* **109**, 033717 (2024); Ke & Assan, *JCP* **163**, 164703 (2025); T. E. Li, arXiv:2403.12411 — multimode.
- Chikkaraddy et al., *Nature* **535**, 127 (2016); Wikipedia *Distributed Bragg reflector*; RP-Photonics *Finesse* / *Bragg Mirrors*; Vahala, *Nature* **424**, 839 (2003) — cavity hardware.
