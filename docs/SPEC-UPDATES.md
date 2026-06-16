# SPEC-UPDATES — Patch List for PHYSICS-SPEC.md & HISTORY-TREE.md

> Actionable corrections derived **only** from the verified material (verifications + resolutions).
> Each item: **what** to change, **where** (file + line/anchor), **source**. Items are ordered by impact.
> Nothing here changes a golden number or a validation target; these are citation, dimensional-form,
> wording, and one-equation-prefactor corrections.

---

## A. Citation / DOI corrections

### A1. Sharma & Chen 2024 — fill in the DOI (it is verified, not `[verify]`)
- **What:** The DOI is confirmed: **`10.1063/5.0225434`**, J. Chem. Phys. **161**, 104102 (2024) (vol 161, issue 10, published Sep 2024; preprint arXiv:2406.17101). Article number is **104102, NOT 104109**.
- **Where (HISTORY-TREE.md):**
  - Line 61 narrative leaf: change `DOI `[verify]`` → `DOI 10.1063/5.0225434 ✅`.
  - Line 88 JSON node `sharma2024`: set `"doi": "10.1063/5.0225434"` and `"verified": true`.
- **Where (PHYSICS-SPEC.md):** Lines 100–101 (System C header) — append the DOI to the full citation: `..., J. Chem. Phys. 161, 104102 (2024), DOI 10.1063/5.0225434`.
- **Also fix:** `_compact-evidence.json` fact #17 mis-states the page as `104109` → correct to `104102` (the file is internally inconsistent; fact #46 and PHYSICS-SPEC.md already use 104102).
- **Source:** Resolution "exact bibliographic citation… 104102 vs 104109" (confidence high): Crossref DOI 10.1063/5.0225434 → article-number 104102; DOI handle 302-redirects to `/jcp/article/161/10/104102/…`; arXiv:2406.17101 journal-ref "J. Chem. Phys. 161, 104102 (2024)"; downloaded PDF first-page citation reads 104102. Verification theme "Historical timeline citations," Sharma & Chen check (verdict verified).

### A2. Jaynes–Cummings citation — wrong lead author ("Le Boité")
- **What:** arXiv:2403.02402 is **De Bernardis, Mercurio & De Liberato**, *"Nonperturbative cavity QED: is the Jaynes–Cummings model still relevant?"* — NOT "Le Boité & De Liberato." Equation content (Eqs. 1 and 6) is correct; only the author attribution is wrong.
- **Where (PHYSICS-SPEC.md):**
  - Line 72 (§B.1): `[Le Boité & De Liberato, arXiv:2403.02402, Eq. 1]` → `[De Bernardis, Mercurio & De Liberato, arXiv:2403.02402, Eq. 1]`.
  - Line 76 (§B.2, "[same, Eq. 6]") — no change needed beyond inheriting the corrected attribution above.
- **Source:** Verification theme "Collective coupling," JC-Hamiltonian and vacuum-Rabi-ladder checks: "IMPORTANT ATTRIBUTION ERROR: the spec attributes arXiv:2403.02402 to 'Le Boité & De Liberato' but the actual authors are Daniele De Bernardis, Alberto Mercurio, and Simone De Liberato."

### A3. arXiv:2511.04017 — do NOT add it as a Chen-group multimode follow-up
- **What:** If anyone proposes adding arXiv:2511.04017 / J. Chem. Phys. **164**, 024113 (2026) to the history tree as a "Chen-group multimode" node: **don't.** It is **Ying & Nitzan** (single-mode unified FGR ET rate theory; multimode is only future work, single donor–acceptor pair, no N-dependence). The non-monotonic-N result stays attributed to Sharma & Chen (arXiv:2406.17101).
- **Where:** No file currently mis-cites it; this is a guard note. If a node is added, label it `ying-nitzan2026`, branch `theory`/`project`, single-mode.
- **Source:** Resolution "Is arXiv 2511.04017 a Chen group multimode or N-dependence follow-up" (confidence high): "No, not Chen group. By Ying and Nitzan (UPenn)… Single mode only, multimode is future work… no N dependence."

---

## B. The multimode follow-up paper to ADD to the history tree

### B1. Add the genuine multimode Fabry–Perot node (Branch 3 / theory frontier)
- **What:** Add a node for the real multimode result that motivates the project's "multimode frontier" leaf, so the roadmap leaf (`thisproject2026`) has a true antecedent rather than an implied one. The correct multimode papers are:
  - **Zhou, Chen, Sukharev, Subotnik, Nitzan**, *"Nature of polariton transport in a Fabry–Perot cavity,"* Phys. Rev. A **109**, 033717 (2024); arXiv:2310.11228 — genuinely multimode (in-plane k continuum, ballistic polariton transport at group velocity). This is the Chen-group multimode paper.
  - **Ke & Assan**, *"Harnessing multi-mode optical structure for chemical reactivity,"* J. Chem. Phys. **163**, 164703 (2025); arXiv:2507.13897 — multimode rate enhancement (FSR ~ Rabi splitting; cascade ladder-climbing) that single-mode theory misses.
- **Where (HISTORY-TREE.md):**
  - Add to the §"Where this project sits" / a "multimode frontier" stub near lines 60–65.
  - Add JSON nodes after `sharma2024` (line 88), e.g.:
    ```json
    { "id": "zhou2024", "year": 2024, "title": "Nature of polariton transport in a Fabry-Perot cavity", "authors": "Zhou, Chen, Sukharev, Subotnik, Nitzan", "venue": "Phys. Rev. A 109, 033717", "doi": "10.1103/PhysRevA.109.033717", "contribution": "Genuinely multimode Fabry-Perot; ballistic polariton transport (in-plane k continuum)", "parents": ["sharma2024"], "branch": "project", "verified": true },
    { "id": "keassan2025", "year": 2025, "title": "Harnessing multi-mode optical structure for chemical reactivity", "authors": "Ke, Assan", "venue": "J. Chem. Phys. 163, 164703", "doi": "", "contribution": "Multimode rate enhancement (FSR~Rabi, cascade ladder-climbing) absent in single-mode theory", "parents": ["sharma2024"], "branch": "project", "verified": false }
    ```
  - Then add `"zhou2024"`/`"keassan2025"` to the `parents` of `thisproject2026` (line 90) so "multimode = open frontier" has explicit lineage.
- **Source:** Resolution on arXiv:2511.04017 (which disambiguates the Chen-group vs Ying–Nitzan attribution) and DEEP CONCEPTS topic "Multimode cavity QED…" (citation-accuracy note: Zhou et al. PRA 109, 033717 = arXiv:2310.11228 is the Chen-group multimode transport paper; Ke & Assan arXiv:2507.13897 = J. Chem. Phys. 163, 164703 is the multimode-FGR work). Mark `keassan2025` DOI `[verify]` until the journal DOI is confirmed.

---

## C. Equation-form / convention corrections

### C1. Marcus/FGR kernel (§C.9) — "identical to classical Marcus" is wrong by a factor of 2
- **What:** §C.9 line 145 claims Eq. 35 is *"Identical to the classical Marcus rate."* It is **identical only up to an overall factor of 1/2 in the prefactor.** The standard classical Marcus rate is
  $$k = \frac{|V|^2}{\hbar}\sqrt{\frac{\pi}{\lambda k_B T}}\exp\!\Big[-\frac{(\Delta G+\lambda)^2}{4\lambda k_B T}\Big],$$
  whereas Sharma–Chen Eq. 35 carries $|V|^2/(2\hbar)$, i.e. **exactly one half** of textbook Marcus. (Sharma–Chen's own parent paper, Semenov & Nitzan, J. Chem. Phys. 150, 174122 (2019), Eq. 23, has $|V|^2/\hbar$ with **no** 1/2.)
- **Fix the wording** at line 145 from "Identical to the classical Marcus rate …" → **"Identical to the classical Marcus rate up to an overall factor of 1/2 in the prefactor"** (Sharma–Chen print $|V|^2/2\hbar$; textbook/Semenov–Nitzan have $|V|^2/\hbar$).
- **Physical impact: nil.** The factor of 2 is an overall prefactor; it cancels in all rate **ratios** (quantum yields $QY_b$, $QY_c$, branching ratios in §C.10) and does not affect $N_{\max}$, the activation energy, or the barrier-less condition. **No golden value changes.** Keep the sim's Eq. 35 as printed (matches the paper); only document that absolute rates are 2× below textbook Marcus.
- **Same fix** in `_compact-evidence.json` wherever the "algebraically identical to the classical Marcus rate" claim appears (soften to "up to a factor of 1/2").
- **Source:** Verification theme "Marcus/FGR rate kernel," equivalence-claim check (verdict **refuted**): "(2π/ℏ)(4πλk_BT)^{-1/2} simplifies EXACTLY to (1/ℏ)√(π/(λk_BT)). Sharma–Chen has (1/(2ℏ))√(π/(E_r k_BT)). Ratio = 1/2." Cross-checked vs Tokmakoff LibreTexts 19.4.28 and Semenov–Nitzan Eq. 23 (no 1/2).

### C2. N_max printed form (§6.1) — keep the dimensional flag; tighten the general form's statement
- **What:** §6 already correctly flags that the **paper's printed Eq. 44** ($N_{\max}=1+\hbar\omega_c/|T_{01}|^2$, units 1/eV) is dimensionally inconsistent and gives the corrected dimensionless form $N_{\max}=1+(\hbar\omega_c)^2/|T_{01}|^2 = 1+\hbar\omega_c E_{AD}/|T_{01}|^2$. **No change to the physics or numbers** — this is confirmed correct.
- **Optional clarity edit (§6.1, line 159–160):** add a one-line note that the printed form was independently confirmed verbatim from the PDF (i.e. it is the *paper's* slip, not a transcription artifact), and that the project's own Pilot Plan PDF (`ML_BO_for_HTC_inverse_design.pdf`, its Eq. 10) reproduces the same uncorrected form. Keep the §6.5 "diligence / clarifying question, not erratum" framing.
- **Verified resonance subtlety to record:** the engine (`htc.ts`) already implements the dimensionally-correct general form $1+(\hbar\omega_c E_{AD})/|T|^2$, and a test guards against regressing to the printed form — so spec and code agree.
- **Source:** Verification themes "HTC electron-transfer core" (N_max printed-form verdict **refuted**; hand-derived form **verified**) and "Dimensional-consistency audit" (nMax check verified, engine uses corrected form). Resolution "Eqs 26 42 43 44 verbatim and N_max dimensional check" (confidence high): printed Eq. 44 has $\hbar\omega_c$ to the first power and "appears to drop the square… (apparent typo)."

### C3. §C.9 emission coupling value — align |T₁₀| precision
- **What:** The spec uses `|T₁₀| = 0.009630 eV` (lines 177, 202, 228). The verified golden-value derivation uses `|T₁₀| = 0.0096297 eV` → $N_{\max}^{(II)} = 1 + 1/0.0096297^2 = 10784.87 \to 10785$. These agree to the rounding already shown (10785), so **no numeric change**; for internal consistency, optionally carry the full `0.0096297` in the parameter table (line 202) and §6.4 (line 177) to match the cited precision.
- **Source:** Verification theme "HTC electron-transfer core," golden-values check (verified): `|T_10| = 0.0096297 eV`, $N_{\max}=10784.87\to10785$.

---

## D. Dark-state count clarification (the N−1 vs N−2 issue)

### D1. Reconcile §B.6 (N−1) with §C.7 / §8 (N−2) explicitly
- **What:** Two **different, both-correct** counts must not be read as a contradiction:
  - **§B.6 (System B, textbook Tavis–Cummings on N emitters):** **N−1 dark states.** Correct for generic TC.
  - **System C (Sharma–Chen HTC-ET):** **N−2 dark states.** One reacting molecule is excluded; the remaining N−1 spectators are collectivized → 1 bright + N−2 dark = TC rule applied to N−1 emitters. The √(N−1) coupling scaling is consistent (N−1 = collectivized spectators; N−2 = left dark after one becomes bright).
- **Where (PHYSICS-SPEC.md):**
  - §C.7 line 133 already says "leaving N−2 dark states" — **good, keep.** Add a parenthetical cross-reference: *"(contrast §B.6's generic Tavis–Cummings count of N−1, which applies to N emitters; here only N−1 spectators are collectivized → N−2 dark)."*
  - §8 validation target #7 (line 234) already says "N−2 dark states… one reacting molecule excluded" — **correct, keep.**
  - §B.6 line 92 — add one clause: *"(in the HTC electron-transfer model of System C the count is N−2, because the reacting molecule is excluded — see §C.7)."*
- **Resolved typo to record:** Sharma–Chen Eq. 38 prints the dark-state sum upper limit as N−1, but the surrounding text, Appendix A (A6, A7), Appendix B (B1), and the RWA-I body all define **N−2**. Any explicit dark-state channel sum in code must iterate **k = 1 … N−2**. The oracle Γ values use the reduced Eqs. 40–41, so the Eq. 38 typo does not change existing golden numbers.
- **Source:** Resolution "are there N−1 or N−2 dark states…" (confidence high): "N−2 is the correct count… The upper limit N−1 printed on the sum in Eq. 38 is a typo… 2 + (N−2) = N… TC applied to N−1 emitters gives 1 bright plus N−2 dark." Verification theme "Collective coupling," N−1-dark-states check (notes the System B vs System C distinction is "stated correctly in their respective contexts").

---

## E. Langevin / friction-term note (deferred-physics honesty)

### E1. Record the classical-nuclei (Langevin) treatment as a stated limitation
- **What:** §9 already lists "Classical nuclei (Langevin), high-T Marcus limit." Add an explicit honesty line that the friction/dissipation in the nuclear Langevin dynamics is the **classical, high-temperature** bath treatment (no quantum nuclear tunneling beyond the MLJ note; no strong-coupling/polaron breakdown), and that the dark-state polariton-relaxation drain (PR rate ∝ N⁻²) enters through this fluctuating bath, not through any added per-mode photon-loss friction (κ remains **deferred**, §9). This prevents conflating (i) classical nuclear Langevin friction with (ii) the not-yet-modeled cavity-loss κ.
- **Where (PHYSICS-SPEC.md):** §9 line 245 — append the clause above; and near §8 line 233 (turnover shape) note the PR ∝ N⁻² drain is bath-mediated (dark-state leakage), the second of the two compounding large-N suppression effects alongside barrier reopening.
- **Source:** DEEP CONCEPTS topic "non-monotonic N turnover" (misconceptions: "via the fluctuating (Langevin) bath they provide a polariton-relaxation drain (PR rate)… the sink that makes the large-N problem real"; asymptotics k ∝ e^{−N}, Γ ∝ N⁻²). §9 of PHYSICS-SPEC (Langevin/Marcus regime, κ deferred).

---

## F. Minor / corroborating notes (no number changes)

- **§A citations are all verified** (Carusotto–Ciuti RMP 85, 299; Deng–Haug–Yamamoto RMP 82, 1489; Deng–Weihs–Yamamoto PNAS 100, 15318; Hopfield PR 112, 1555; Houdré C. R. Physique 3 (2002) 15). The two convention subtleties (factor-of-2 in $V$ vs full $\Omega_R$; detuning sign $\delta=E_{cav}-E_{exc}$) are handled **self-consistently** — keep as-is, no edit. *Source: verification theme "Microcavity exciton-polariton equations."*
- **HISTORY-TREE `[verify]` DOIs that are now confirmable** (set verified:true, fill DOI):
  - `imamoglu1996` → DOI **10.1103/PhysRevA.53.4250** (lines 30, 78).
  - `thomas2016` → DOI **10.1002/anie.201605504** (lines 44, 83).
  - `galego2015` → DOI **10.1103/PhysRevX.5.041022** (lines 48, 84).
  - `imperatore2021` → DOI **10.1063/5.0046310** (line 54, 87) — note author is Imperatore, Asbury & **Giebink** (the narrative line 54 lists "Frank"; the third author on the reproducibility paper is Giebink — verify before flipping author string).
  - *Source: verification theme "Historical timeline citations" (all four publisher records resolved) and VSC-controversy DEEP CONCEPTS grounding sources.*
- **VSC controversy framing** in HISTORY-TREE Branch 6 is correct and should stay: settled = strong coupling/spectroscopy real; unsettled = whether VSC modifies thermal ground-state rates (multiple groups reproduce the Rabi splitting but not the rate changes). *Source: Resolution "VSC → No agreed effect / Unproven"; DEEP CONCEPTS "VSC chemistry controversy."*

---

### Summary
1. **Sharma & Chen DOI is now confirmed `10.1063/5.0225434`, article 104102 (not 104109)** — fill it in HISTORY-TREE (lines 61, 88) and PHYSICS-SPEC (line 101); fix `_compact-evidence.json` fact #17.
2. **§B.1 JC citation author is wrong** — change "Le Boité & De Liberato" → "De Bernardis, Mercurio & De Liberato" (arXiv:2403.02402).
3. **Add the genuine multimode follow-ups** — Zhou et al. PRA 109, 033717 (2024, Chen-group) and Ke & Assan JCP 163, 164703 (2025) as history-tree nodes parenting `thisproject2026`; do NOT add arXiv:2511.04017 as Chen-group (it is single-mode Ying–Nitzan).
4. **§C.9 Marcus kernel is "identical to classical Marcus" only up to a 1/2 prefactor** — soften the wording (Sharma–Chen print $|V|^2/2\hbar$; textbook = $|V|^2/\hbar$); ratios/golden values unaffected.
5. **Dark-state count: clarify N−1 (System B, generic TC) vs N−2 (System C, HTC-ET, one molecule excluded)** as two correct counts; record the Eq. 38 N−1 print as a typo (use k=1…N−2 in any channel sum).
6. **N_max dimensional flag and Langevin/κ-deferred limitation stay** — keep §6's corrected dimensionless form $1+(\hbar\omega_c)^2/|T_{01}|^2$ and §9's classical-nuclei note; no published number changes.

Path: `/Users/dhruvjain/polariton-research/sim/docs/SPEC-UPDATES.md`
