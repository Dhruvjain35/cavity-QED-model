# VALIDATION

This document is the validation record for **polariton-sim**: the consolidated record of
every physics check, its numeric result, the test that runs it, and the golden file
it is checked against. Nothing here is asserted from memory. The independent arbiters
are **QuTiP 5.3.0** and **NumPy** (numpy 2.4.6 / scipy 1.17.1, Python 3.12.13); the
goldens they produce are committed to the repository and the Rust core is checked
against them element-by-element.

To audit this code: every number the simulator can
produce has a corresponding number from QuTiP or `numpy.linalg.eigh` sitting in a
committed JSON file, and a test that fails the build if they disagree beyond a stated
tolerance. The tables below record each check, its numeric result, and its tolerance.

- **Project:** polariton-sim: an open-source, in-browser cavity-QED simulator.
- **Author:** Dhruv Jain (high-school researcher), with the Hsing-Ta Chen group, University of Notre Dame.
- **Model reference (Regime 2):** Sharma & Chen, *J. Chem. Phys.* **161**, 104102 (2024).
- **License:** MIT, 2026.

---

## 1. What is validated, and what is not

polariton-sim is a focused, validated **subset** of cavity QED, not a QuTiP
replacement and not a novel research result. Stating the scope precisely is part of
the credibility.

**Regime 1: single emitter, full Lindblad.** One two-level emitter in one lossy
cavity (Jaynes–Cummings). The full Lindblad master equation is integrated on the
32-dimensional Hilbert space (Fock truncation `N = 16` photons × 2 atom levels),
with cavity loss `kappa` and emitter decay `gamma`. This is checked against QuTiP
`mesolve`.

**Regime 2: M emitters, single-excitation subspace.** M emitters coupled to one
cavity mode, restricted to the one-excitation subspace, assembled as an
`(M+1)×(M+1)` real-symmetric **arrowhead** matrix and exactly diagonalized
(cost linear in M). This is checked against `numpy.linalg.eigh`. There is **no**
multi-excitation sector and **no** full `2^M` multi-emitter Lindblad; that is
intentionally avoided, not approximated.

**Bridge.** Clicking an eigenstate in the Regime-2 spectrum forms its cavity-reduced
state `rho = (1 - |C|^2)|0><0| + |C|^2|1><1|` and renders its Wigner function;
`W(0,0) = (1 - 2|C|^2)/pi`. Polaritons (high photon weight) go negative/non-classical;
dark states (zero photon weight) stay vacuum-positive. The Wigner port and the partial
trace it relies on are both checked against QuTiP.

**Out of scope: do not infer otherwise.** Single cavity mode only. No multimode, no
multi-excitation, no full multi-emitter open dynamics. No performance, browser-support,
or feature claims are made here.

---

## 2. The locked conventions

Every downstream number depends on these choices matching QuTiP exactly. They are
locked once, in the golden generator, and the Rust core is built to reproduce them.
The operator-lock test (§3) is what guarantees the lock holds. Sources for the
physical conventions are cited in [`docs/GROUNDING-RESEARCH.md`](./GROUNDING-RESEARCH.md).

| # | Convention | Locked value | Where it lives |
|---|---|---|---|
| 1 | **Tensor order: cavity-first** | `a = tensor(destroy(N), qeye(2))`, `sm = tensor(qeye(N), sigmam())`; combined state is `|n> ⊗ |sigma>`, combined index `2n + sigma`. | `wasm/src/operators.rs` (`build`), `golden/gen_golden.py` |
| 2 | **Atom energy term: number operator** | `H_atom = w_a · sp·sm = w_a |e><e|`, **not** `(1/2) w_a sigma_z`. (They differ by a constant `(1/2)w_a·I` shift.) | `operators.rs`, `gen_golden.py` |
| 3 | **Jaynes–Cummings Hamiltonian (RWA)** | `H = w_c a†a + w_a sp sm + g (a† sm + a sp)` | `operators.rs`, `gen_golden.py` |
| 4 | **Dissipator: rate-in-operator** | Collapse operators `C = sqrt(rate)·A`: `sqrt(kappa) a` (cavity loss), `sqrt(gamma) sm` (emitter decay), `sqrt(gamma_phi/2) sigma_z` (dephasing). QuTiP applies `D[C]ρ = C ρ C† − ½{C†C, ρ}`. | `operators.rs` (`c_ops`), `solver.rs`, `gen_golden.py` |
| 5 | **Two-level basis** | `sigma_z = diag(1, −1)`, so `basis(2,0)` is **excited** `|e>` (sz = +1) and `basis(2,1)` is **ground** `|g>`. `sm = |g><e|` lowers; `P_e = sp·sm = |e><e|`. (Resolved by dumping QuTiP's own matrices, not from a textbook.) | `operators.rs`, `gen_golden.py` header |
| 6 | **Wigner: `g = sqrt(2)`** | QuTiP-default `g = √2`, `alpha = x + i y` (dimensionless quadratures, ħ = 1). Off-diagonals of ρ are doubled in the Clenshaw sweep (the ×2 factor the cat-state negativity catches). | `wasm/src/wigner.rs`, `gen_golden.py` |
| 7 | **RdBu colormap midpoint `#F7F7F7`** | The W = 0 neutral is light gray `#F7F7F7 = (247,247,247)`, **not** pure white; the ramp never reaches `(255,255,255)`. True matplotlib/ColorBrewer "RdBu" 11-class anchors under a symmetric norm `Normalize(−w_max, +w_max)`: negative W → red, positive → blue. | `wigner.rs` (`RDBU`, `rdbu`), [`GROUNDING-RESEARCH.md`](./GROUNDING-RESEARCH.md) §1 |
| 8 | **Cavity loss `kappa = c(1−R)/(nL)`** | The energy/FWHM decay rate that feeds the master equation is `kappa = c(1−R)/(nL)` (or exactly `−c·ln R/(nL)`). The amplitude/HWHM rate `c(1−R)/(2nL)` is **half** of this and is **not** what enters the Lindblad equation. `FSR = c/(2nL)`, `Q = ω_c/kappa`. | [`GROUNDING-RESEARCH.md`](./GROUNDING-RESEARCH.md) §3 |

The committed goldens carry these conventions in their `conventions`/`convention`
fields so they are auditable from the data alone, independent of the code.

The arrowhead convention (Regime 2): index 0 is the photon state `|1 photon, all
emitters ground>` with diagonal `w_c` on the corner; index `i+1` is the matter state
`|0 photon, emitter i excited>` with diagonal `w_i`; the couplings `g_i` sit on the
single arrow row/column connecting the photon state to each emitter.
`eigh` returns ascending eigenvalues; the photon fraction (Hopfield weight) of
eigenstate `k` is `|eigenvector_k[0]|²`.

---

## 3. Check-by-check evidence

All figures below are the actual printed output of the committed tests, re-run on
the committed goldens. Tolerances are the `assert!` bars in each test, which are far
looser than the observed agreement: the gap between "observed" and "bar" is the
margin of safety.

### 3.1 Operators: the convention lock

Builds every JC operator in Rust and asserts element-wise agreement with the QuTiP
golden to `1e-12`. If this passes, tensor order, signs, and dissipator form match
QuTiP bit-for-bit, and every downstream check rests on it.

| Operator | Max element error vs QuTiP | Bar |
|---|---|---|
| `a` (cavity-first) | `4.44e-16` | `< 1e-12` |
| `a†a` | `0.00` (exact) | `< 1e-12` |
| `sm` | `0.00` (exact) | `< 1e-12` |
| `sp` | `0.00` (exact) | `< 1e-12` |
| `sz` | `0.00` (exact) | `< 1e-12` |
| `P_e = sp·sm` | `0.00` (exact) | `< 1e-12` |
| `H` (JC, RWA) | `4.44e-16` | `< 1e-12` |
| `c_op[0] = sqrt(kappa) a` | `5.55e-17` | `< 1e-12` |
| `c_op[1] = sqrt(gamma) sm` | `0.00` (exact) | `< 1e-12` |
| `H` Hermiticity `‖H − H†‖` | `< 1e-12` | `< 1e-12` |

- **Test:** `wasm/tests/operator_lock.rs` (`operators_match_qutip_bit_for_bit`, `hamiltonian_is_hermitian`)
- **Golden:** `wasm/golden/golden.json` (`operators`, `params`)
- **Golden source:** `golden/gen_golden.py` (QuTiP 5.3.0). Dim 32 = `N_fock 16 × 2` atom.

### 3.2 Lindblad evolution: adaptive Dormand–Prince vs QuTiP `mesolve`

Integrates ρ with an adaptive Dormand–Prince (Dopri5/RK45) step on the
non-Hermitian regrouping of the GKSL generator, hermitizing and renormalizing on
every accepted step. Initial state `|0 photons, atom excited>` (vacuum-Rabi
sloshing), `tlist = linspace(0, 40, 200)`, `atol = rtol = 1e-10`.

| Quantity | Result | Bar |
|---|---|---|
| `max |⟨a†a⟩_rust − ⟨a†a⟩_qutip|` over the series | `6.934e-9` | `< 1e-6` |
| `max |⟨P_e⟩_rust − ⟨P_e⟩_qutip|` over the series | `6.952e-9` | `< 1e-6` |
| `max` ρ-snapshot element error vs QuTiP states | `5.036e-9` | `< 1e-6` |
| `min eig(ρ)` over the series (positivity) | `−2.208e-16` | `≥ −1e-8` |
| `Tr(ρ)` at the horizon | `1.0000000000000` | `|Tr − 1| < 1e-12` |
| **Long-run drift to 10× horizon** (`t = 400`): `Tr(ρ)` | `1.0000000000000` | `|Tr − 1| < 1e-12` |
| **Long-run drift to 10× horizon:** `min eig(ρ)` | `−2.220e-16` | `≥ −1e-8` |

- **Test:** `wasm/tests/solver_golden.rs` (`dynamics_match_qutip_mesolve`, `long_run_drift_to_10x_horizon`)
- **Golden:** `wasm/golden/golden.json` (`dynamics`, `psi0`)
- **Golden source:** `golden/gen_golden.py` → `qt.mesolve(..., atol=1e-12, rtol=1e-10)`

### 3.3 Wigner: faithful port of QuTiP `_wigner_clenshaw` (`g = sqrt(2)`)

Ports QuTiP's dense Clenshaw Wigner (offset 0, `g = √2`, `alpha = x + iy`) on a
`100×100` grid over `[−5, 5]²`. The cat state is the case that catches the
off-diagonal ×2 scale bug (fringes halve if dropped).

| State | Max element error vs QuTiP | `∫∫ W dx dy` | Negativity |
|---|---|---|---|
| Coherent `|α=1+0.5i>` | `2.220e-16` | `1.000000` | none |
| Schrödinger cat `(|2> + |−2>)/N` | `2.776e-16` | `0.999275` | Rust min `−0.2330`, QuTiP min `−0.2330` |

Bars: element error `< 1e-4`; `|∫∫W − 1| < 1e-2`; cat min `< −0.2` and
`|rust_min − qutip_min| < 1e-4` (proves the off-diagonal ×2 factor is correct).
The cat `∫∫W = 0.999275` is the finite-grid rectangle sum of a fringed distribution,
within the `1e-2` quasiprobability-normalization bar; the coherent state integrates
to `1.000000`.

A separate test (`vacuum_wigner_renders_rdbu_neutral_background`) gates the colormap:
the zero-field corner renders as `(247, 247, 247)` = `#F7F7F7` exactly (RdBu neutral,
not white), and the positive-W vacuum peak renders deep blue `(6, 49, 99)` under the
symmetric norm.

- **Test:** `wasm/tests/wigner_golden.rs` (`wigner_matches_qutip`, `vacuum_wigner_renders_rdbu_neutral_background`)
- **Golden:** `wasm/golden/golden.json` (`wigner`)
- **Golden source:** `golden/gen_golden.py` → `qt.wigner(..., g=√2)`

### 3.4 Partial trace: cavity-reduced state vs QuTiP `ptrace(0)`

Traces out the 2-level atom from a cavity-first density matrix and compares to
QuTiP's `ptrace(0)` on the final dynamics snapshot. This is the operation the
Regime-1→Wigner and the eigenstate-bridge both depend on.

| Quantity | Result | Bar |
|---|---|---|
| Max element error vs QuTiP `ptrace(0)` | `0.00` (exact) | `< 1e-12` |

- **Test:** `wasm/tests/wigner_golden.rs` (`partial_trace_matches_qutip`)
- **Golden:** `wasm/golden/golden.json` (`ptrace_check.rho_c_end`)
- **Golden source:** `golden/gen_golden.py` → `rho.ptrace(0)`

### 3.5 Arrowhead spectrum (Regime 2) vs `numpy.linalg.eigh`

Builds and diagonalizes the single-excitation Tavis–Cummings arrowhead for four
cases (identical/detuned/disordered, M = 4…24) and compares eigenvalues and photon
fractions to `numpy.linalg.eigh`. Photon fraction is basis-independent, so it is
well-defined even on the degenerate dark-state manifold.

| Case | `max |Δeig|` | `max |Δphoton_frac|` |
|---|---|---|
| `identical_resonant_M4` | `7.77e-16` | `8.88e-16` |
| `detuned_identical_M4` | `8.88e-16` | `1.55e-15` |
| `disordered_M8` (σ = 0.05) | `1.33e-15` | `8.33e-16` |
| `disordered_M24` (σ = 0.08) | `2.66e-15` | `1.17e-15` |

Bars: `max |Δeig| < 1e-10`, `max |Δphoton_frac| < 1e-9`.

Physics also pinned directly (no golden needed; these are exact closed-form facts):

| Property (identical resonant emitters) | Result | Bar |
|---|---|---|
| Collective splitting `s.eigs[M] − s.eigs[0]` (M = 4, g = 0.1) | `0.400000` = `2g√M` | `|s − 2g√M| < 1e-12` |
| Number of zero-photon dark states at the bare energy | exactly `M − 1` | `== M − 1` |
| Photon fraction of each dark state | `< 1e-9` | `< 1e-9` |
| Photon fraction of each bright polariton (on resonance) | `0.5` (50/50 light–matter) | `|p − 0.5| < 1e-9` |

- **Test:** `wasm/tests/spectrum_golden.rs` (`arrowhead_matches_numpy_eigh`, `identical_resonant_gives_2g_sqrt_m_split_and_m_minus_1_dark`)
- **Golden:** `wasm/golden/spectrum_golden.json`
- **Golden source:** `golden/gen_spectrum_golden.py` (NumPy `numpy.linalg.eigh`)

### 3.6 WASM-boundary recheck: does the validated physics survive JS↔WASM?

The native Rust tests prove the math is right. This recheck proves the **compiled
WASM** still produces the same numbers across the JavaScript↔WASM boundary: it drives
the solver and the Wigner port through the wasm-pack nodejs build and compares to the
same golden.

| Quantity | Result | Bar |
|---|---|---|
| Solver `max |Δ⟨a†a⟩|` | `6.934e-9` | `< 1e-6` |
| Solver `max |Δ⟨P_e⟩|` | `6.952e-9` | `< 1e-6` |
| `Tr(ρ)` | `1.0000000000000` | `|Tr − 1| < 1e-10` |
| `min eig(ρ)` | `−2.208e-16` | `> −1e-8` |
| Wigner `max |ΔW|` (coherent) | `2.220e-16` | `< 1e-4` |
| Live cavity-reduced `∫∫W` (= `Tr ρ_c`) | `1.000000` | `|∫∫W − 1| < 1e-2` |

These are identical to the native results in §3.2–3.3.

- **Validator:** `wasm/validate_wasm.cjs` (prints `PASS`, exits non-zero on any failure)
- **Requires:** the nodejs wasm build at `wasm/pkg/` (see step 2 below)
- **Golden:** `wasm/golden/golden.json`

---

## 4. Test inventory

**11 cargo tests** across the four golden files below, plus **1 Node boundary validation** (`wasm/validate_wasm.cjs`). The full `wasm/tests/` suite is **22 tests across 8 files** (the others cover optics/HTC/FFT/Husimi against analytic benchmarks). Run via `npm run test:quantum` (or `cargo test --manifest-path wasm/Cargo.toml`).

| File | Tests | Arbiter |
|---|---|---|
| `wasm/tests/operator_lock.rs` | 2 (`operators_match_qutip_bit_for_bit`, `hamiltonian_is_hermitian`) | QuTiP 5.3.0 |
| `wasm/tests/solver_golden.rs` | 2 (`dynamics_match_qutip_mesolve`, `long_run_drift_to_10x_horizon`) | QuTiP 5.3.0 `mesolve` |
| `wasm/tests/wigner_golden.rs` | 3 (`wigner_matches_qutip`, `partial_trace_matches_qutip`, `vacuum_wigner_renders_rdbu_neutral_background`) | QuTiP 5.3.0 `wigner` / `ptrace` / matplotlib RdBu |
| `wasm/tests/spectrum_golden.rs` | 4 (`arrowhead_matches_numpy_eigh`, `identical_resonant_gives_2g_sqrt_m_split_and_m_minus_1_dark`, `perpendicular_dipole_decouples_into_dark_manifold`, `vacuum_rabi_oscillation_matches_analytic`) | `numpy.linalg.eigh` |
| `wasm/validate_wasm.cjs` | 1 (boundary recheck) | QuTiP golden, through compiled WASM |

**Scope caveat: pure dephasing.** The committed golden is generated with `gamma_phi = 0`, so the
`sqrt(gamma_phi/2)·sigma_z` dephasing collapse operator (`operators.rs`) is exercised only by the cavity
loss / emitter decay goldens with the dephasing channel off. The dephasing **convention** (§2, row 4) is
locked, but its element-wise dynamics are not yet diffed against a `gamma_phi > 0` QuTiP run; treat that
one channel as convention-checked, not golden-checked, until a second golden is added.

The goldens themselves are committed, so the cargo tests reproduce the figures above
with no Python or network needed:

- `wasm/golden/golden.json`, QuTiP 5.3.0: operators, dynamics, Wigner, partial trace.
- `wasm/golden/spectrum_golden.json`, NumPy `eigh`: arrowhead eigenvalues + photon fractions.

---

## 5. Exact reproduction steps

Run from the repository root (`sim/`).

**1. Run the full validation suite against the committed goldens (no Python needed):**

```
cargo test --manifest-path wasm/Cargo.toml
```

Expect: `22 passed` for the whole `wasm/tests/` suite (11 of them the QuTiP/NumPy
golden checks in the four files above; the rest analytic optics/HTC/FFT/Husimi).
Add `-- --nocapture` to print the numeric tables in §3:

```
cargo test --manifest-path wasm/Cargo.toml -- --nocapture
```

(The `long_run_drift_to_10x_horizon` test integrates to 10× the horizon and takes a
couple of minutes in the debug profile; this is expected.)

**2. Build the WASM, then run the JS↔WASM boundary recheck:**

```
wasm-pack build wasm --target nodejs --out-dir pkg --out-name cqed_core
node wasm/validate_wasm.cjs
```

Expect: `PASS: validated physics survives the WASM boundary` (exits 0).
The web build is the same crate, different target:

```
wasm-pack build wasm --target web --out-dir pkg-web --out-name cqed_core
```

**3. (Optional) Regenerate the goldens from the independent arbiters.**

The goldens are committed; you only need this to re-derive them from scratch. It
requires the `uv` venv at `golden/.venv` (QuTiP 5.3.0, numpy 2.4.6, scipy 1.17.1,
Python 3.12.13):

```
golden/.venv/bin/python golden/gen_golden.py
golden/.venv/bin/python golden/gen_spectrum_golden.py
```

`gen_golden.py` writes `wasm/golden/golden.json`; `gen_spectrum_golden.py` writes
`spectrum_golden.json` (copied to `wasm/golden/`). Re-running step 1 against freshly
generated goldens must still pass: that is the closed loop.

**4. (Optional) Run the frontend that consumes the validated core:**

```
npm install
npm run dev      # http://localhost:5180
npm run build
```

---

## 6. The audit claim, stated plainly

- The independent arbiters are **QuTiP 5.3.0** and **NumPy** (`numpy.linalg.eigh`).
- Their outputs are **committed** as `wasm/golden/golden.json` and
  `wasm/golden/spectrum_golden.json`, with the conventions recorded inside the files.
- The Rust core `cqed_core` reproduces those outputs element-by-element to the
  tolerances in §3: operators to machine epsilon, dynamics to `~7e-9`, Wigner to
  `~3e-16`, partial trace exactly, spectrum to `~3e-15`.
- The same numbers survive compilation to WASM and the JS boundary (§3.6).
- The conventions every number depends on (§2) are locked in one place and gated by
  the operator-lock test.

Every number this simulator can show has a QuTiP or NumPy counterpart you can diff
against by running the commands above. That is the whole claim: a correct, open,
teachable cavity-QED instrument, not a QuTiP replacement and not a new result.
