# MASTER BUILD PLAN — research-grade cavity-QED simulator (unifies both research passes)

> Reconciles the visual/product pass (`PRODUCT-SPEC`, `VISUAL-SPEC`, `BUILD-PLAN`) with the open-quantum
> pass (`OPEN-QUANTUM-SPEC`, `SOLVER-PLAN`, `WIGNER-VIZ-SPEC`). This is the single source of truth for the
> rebuild. Architecture decisions: **in-browser Rust→WASM solver, sharp core first, validated against QuTiP.**

---

## 0. The architecture resolution (the key insight)

The open-quantum critic flagged the real fork: single-emitter JC is trivially 60fps (d ≤ 80), but multi-emitter
Tavis–Cummings blows up as `N_fock·2^M`, and **disorder breaks the permutation symmetry** that would otherwise
tame it. Resolution — split the physics into **two cheap, exact, separately-validated compute regimes**:

| Regime | What it computes | Method | Cost | Validated against |
|---|---|---|---|---|
| **R1 — open dynamics** | Wigner phase space, damped vacuum-Rabi, purity decay, steady state | Single-emitter JC, **full Lindblad** on dense ρ (Dopri5, non-Hermitian regrouping), `N_fock ≤ 40` → d ≤ 80 | comfortably 60fps | QuTiP `mesolve` / `wigner` (bit-level golden) |
| **R2 — collective + disorder** | polariton/dark-state spectrum, disorder broadening, √N | **single-excitation arrowhead matrix**, exact diagonalization — scales *linearly* in M, no 2^M blowup, **works WITH disorder** | instant | QuTiP Hamiltonian eigenvalues |

This is the elegant out: never do full multi-emitter Lindblad. R1 gives the Wigner/dynamics; R2 gives the
collective disorder physics (the dark-state story that IS the research). Both exact, both fast, both validated.

---

## 1. Deliverable #0 — the QuTiP convention lock (FIRST code, before any solver)

The single load-bearing thing. The specs are internally inconsistent (cavity-first vs emitter-first tensor
order; `½ħω_a σ_z` vs `ħω_a σ₊σ₋` number-operator; differing κ). A transposed tensor order or flipped σ₋
makes the Rust solver wrong everywhere and looks like any other bug. **Lock ONE convention, regenerate ONE
golden from ONE authoritative QuTiP script, make the operator-builder tests the literal first code that compiles.**

Pinned convention (to implement): **cavity-first** `tensor(destroy(N), qeye(2))`; atom energy as the
**number operator** `ħω_a σ₊σ₋` (so ⟨n_atom⟩ is unambiguous); **rate-in-operator** dissipator
`C = √γ·A`; collapse ops `√κ a`, `√γ σ₋`, `√(γ_φ/2) σz`.

---

## 2. What gets BUILT (only what's computable + validated now)

**Centerpiece — Open-quantum dynamics (R1, the differentiator):**
- **Live Wigner phase space** of the photon-reduced ρ_c — RdBu diverging colormap centered at 0, symmetric
  limits, x–p quadrature axes; negativity reads as the non-classicality signal. Port QuTiP `_wigner_clenshaw`
  (g=√2) exactly; **the cat-state fringe test is the validation that catches the off-diagonal ×2 bug.**
- **Damped vacuum-Rabi**: ⟨a†a⟩(t), ⟨σz⟩(t) with the decay envelope; cooperativity `C = g²/κγ` readout;
  weak/strong-coupling regime indicator.
- Driven by the WASM Lindblad solver in a Web Worker.

**Collective + disorder spectrum (R2, ties to the research):**
- The **disorder slider σ** adds Gaussian spread to emitter frequencies → render the **numerically
  diagonalized** spectrum broadening + dark-state mixing (NOT the analytic Fano/grey-state closed forms —
  those are self-flagged uncertain; render the computed eigenvalues).

**Recognizable entry view — angle-resolved dispersion (existing TS engine, fixed):**
- True **linear-eV y-axis** (kill the `split=clamp(...)` pixel fake), θ [deg] + k‖ [µm⁻¹] twin x-axis, four
  curves (bare cavity dashed, bare exciton flat-dashed, LP/UP solid anticrossing), branches colored by the
  **Hopfield fraction**, default **slight negative detuning** so the anticrossing actually reads.
- **HTC turnover** + **energy ladder** + **Marcus parabolas** — existing engine, real axes.

**Trust-builders (cheap, decisive — NOT deferred):**
- Hover-readouts of exact (θ, E)/(t, ⟨n⟩) values · CSV + PNG export · a visible **"verify" button** that
  runs the TS 23/23 tests AND shows the WASM-vs-QuTiP benchmark agreement.

---

## 3. What gets KILLED (named offenders)

- `CavityCanvas.tsx`: Bloom `intensity={1.15}`, Vignette, `autoRotate`/`autoRotateSpeed=0.35`, `#0d1014` mood bg.
- `Mirror.tsx`: `iridescence=1`, `clearcoat=1`, emissive glowing rims. The decorative gold standing-wave cylinder.
- `SidePanels.tsx:8` faked eV axis (`split=clamp(splitMeV*0.055,2,64)`) · `useCavity.ts:54` faked antinodes.
- `App.tsx:62` on-screen Hamiltonian that **drops the detuning term** the engine computes (fix to match code).
- Masthead marketing prose ("a reaction changes its mind", "every glow…"). Use flat descriptive figure titles.
- The saturated neon palette **token values** (not just names) — repaint to muted, meaningful hues; one meaning per hue.

## 4. What's DEFERRED (gated on net-new physics + golden tests — do NOT fake)

PoPES / CQED-CI polariton potential-energy surfaces (engine has no excited-state surface); SPP / Drude
dispersion (no plasmonic physics); quantitative |E(z)|² with DBR penetration (no transfer-matrix); multi-emitter
M>3 full Lindblad (exponential); non-Markovian baths. Each needs its own validated engine fn + tests first.

---

## 5. Build order

0. **QuTiP convention lock** + one golden generator script + serialized golden matrices/time-series.
1. Rust→WASM scaffold (`wasm-pack`); **verify `faer`/`faer-sparse` build for wasm32 in step 1** (else nalgebra-only
   fallback, fine for d≲60); confirm no transitive BLAS/LAPACK. Operator-builder unit tests vs the dumped matrices = first code.
2. Lindblad Dopri5 solver (non-Hermitian regrouping); validate ⟨a†a⟩(t) vs QuTiP `mesolve` golden; **hermitize
   ρ←(ρ+ρ†)/2 + renormalize on every accepted step**; long-run drift test (10× tlist, Tr=1, eigs≥−1e-8).
3. Wigner Clenshaw port; element-wise vs `qt.wigner` ≤1e-4; **cat-state fringe test**.
4. Web Worker + JS↔WASM interface; **memory.grow view-invalidation**: fixed capacities, pre-grow once,
   `set_param`/`recompute_wigner` signal JS to rebuild typed-array views; **Dopri5 substep cap + "integrating…"**
   for stiff κ≫g; Wigner cadence decoupled (every ~3 frames), budget integrator+Wigner+hermitize jointly in 16.7ms.
5. Frontend centerpiece: Wigner panel + dynamics plots wired to the worker.
6. R2 arrowhead collective+disorder spectrum view.
7. Rebuild the TS views with real axes; delete all §3 slop.
8. Trust-builders (hover, export, verify button).
9. Open-source packaging: README, unit tests, CI (`cargo test` + `vitest`), docs.

## 6. Honest caveats carried into the UI
Label every analytic shortcut as an approximation and never validate the solver against it: the `(κ+γ)/2`
linewidth, the two-Lorentzian spectrum, the `e^{−(κ+γ)t/2}` Rabi envelope, all disorder broadening closed
forms. Render the numerically computed quantity; the closed forms are dashed reference overlays at most.
`N_fock` is a PHOTON truncation (~20–40), **NOT** the HTC molecule-count `N_max` (1636) — conflating them is
catastrophic. Complex GEMM on wasm is not auto-vectorized; don't assume peak FLOP/s until measured in-browser.
