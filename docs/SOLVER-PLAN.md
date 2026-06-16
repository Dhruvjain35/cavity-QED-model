# SOLVER-PLAN.md — Rust→WASM open-system compute core

**Scope.** This document specifies the Rust→WASM compute layer that adds *open-system, time-resolved* cavity-QED dynamics on top of the existing closed-form TypeScript oracle (`engine/*.ts`). The TS engine stays the instant-response eigensolver/Marcus layer (dispersion, Hopfield fractions, HTC turnover); the WASM core powers the views that the eigenvalue picture cannot produce — damped vacuum-Rabi oscillations, the loss-broadened polariton spectrum, purity/entanglement decay, steady state, and the Wigner phase-space heatmap. It solves the Lindblad (GKSL) master equation in the **exact QuTiP convention** so that QuTiP `mesolve`/`steadystate`/`wigner` can serve as a bit-level validation oracle.

The single governing equation (QuTiP form, collapse operators carry the rate, $C_n=\sqrt{\gamma_n}A_n$):

$$\dot\rho(t)=-\frac{i}{\hbar}\,[H(t),\rho(t)]+\sum_n \tfrac{1}{2}\left[2\,C_n\,\rho\,C_n^{\dagger}-\rho\,C_n^{\dagger}C_n-C_n^{\dagger}C_n\,\rho\right]$$

with $H$ the Jaynes–Cummings (1 emitter) or Tavis–Cummings ($N$ emitters) RWA Hamiltonian and collapse operators $\sqrt{\kappa(1+n_{\rm th})}\,a$, $\sqrt{\kappa\,n_{\rm th}}\,a^{\dagger}$, $\sqrt{\gamma}\,\sigma_-$, $\sqrt{\gamma_\phi/2}\,\sigma_z$ (QuTiP Lindblad guide; QuTiP Jaynes–Cummings Lecture-1).

---

## 1. Chosen Lindblad integration method (with justification + complexity)

**DECISION: integrate the density matrix $\rho$ directly in its native $\dim\times\dim$ matrix form with an explicit adaptive Runge–Kutta integrator (Dormand–Prince RK45 / Dopri5), using the non-Hermitian regrouping.** Not the vectorized Liouvillian, not Monte-Carlo trajectories, for the live 60fps path.

Native dimension $\dim = N_{\rm fock}\times 2^{M}$ for $M$ emitters. The RHS is evaluated with dense complex matrix–matrix products using the QuantumOptics.jl regrouping that halves the products:

$$\dot\rho = -\frac{i}{\hbar}\bigl[H_{\rm nh},\rho\bigr] + \sum_i J_i\,\rho\,J_i^{\dagger},\qquad H_{\rm nh}=H-\frac{i\hbar}{2}\sum_i J_i^{\dagger}J_i$$

(QuantumOptics.jl `dmaster_h!`; QuTiP `matrix_form` option). Precompute $H_{\rm nh}$ and each $J_i^{\dagger}J_i$ once per slider change; the per-step RHS is then one commutator (2 GEMMs) plus one triple product $J_i\rho J_i^{\dagger}$ per collapse operator.

**Complexity.** Cost per RHS eval is dominated by $(2+2 n_{\rm collapse})$ complex $\dim\times\dim$ GEMMs $= O(\dim^3)$. Dopri5 uses ~6 RHS evals per step. Memory is $O(\dim^2)$ (one $\rho$ plus scratch). For a single emitter, $N_{\rm fock}=20\!\to\!\dim=40$ ($\dim^3\approx6.4\times10^4$ complex FMA/GEMM); $N_{\rm fock}=40\!\to\!\dim=80$. A few adaptive steps fit comfortably inside the 16.7 ms frame budget.

**Justification — why NOT the alternatives:**

- **Vectorized Liouvillian** $\mathcal{L}$ (QuTiP's *default* `mesolve` path) lives on the doubled space $\mathcal{H}\otimes\mathcal{H}$, so it is $\dim^2\times\dim^2$. QuTiP states *"the memory cost increases quadratically due to the doubling of the Hilbert space."* At $\dim=512$, $\mathcal{L}$ is $262144\times262144$ ($\sim$1.1 TB dense) — infeasible. Even sparse, $\mathcal{L}\!\cdot\!\mathrm{vec}(\rho)$ is $O(\dim^3)$-equivalent, no cheaper than the matrix-form RHS, with extra cost to build/store $\mathcal{L}$. **REJECTED** for the live path. *Reserved* for steady state and spectrum (§4).
- **Monte-Carlo wavefunction (MCWF)** evolves length-$\dim$ state vectors ($O(\dim^2)$ per RHS, cheaper per trajectory) but needs hundreds–thousands of trajectories per frame for non-flickering expectation curves (statistical error $\sim 1/\sqrt{N_{\rm traj}}$). For $\dim\lesssim1000$ it is noisier and not faster than one deterministic $\rho$ integration. **Kept only as the "big Hilbert space" fallback** when $\dim^2$ storage of $\rho$ becomes the bottleneck (Mølmer–Castin–Dalibard, JOSA B 10, 524 (1993)).

**Parameter-regime fast path.** If $H$/$c_{\rm ops}$ are constant for a slider setting **and** $\dim\lesssim60$, precompute the dense propagator $P=\exp(\mathcal{L}\,\Delta t_{\rm frame})$ **once** (Higham scaling-and-squaring, degree-13 Padé, $O((\dim^2)^3)$ one-time but small), then every frame is a single $\mathrm{vec}(\rho)\leftarrow P\,\mathrm{vec}(\rho)$ matvec — the cheapest possible replay. The moment a slider moves $H$, or $\dim$ is in the hundreds, switch back to Dopri5 on $\rho$. Recomputing $\exp(\mathcal{L}\Delta t)$ every frame is $O(\dim^6)$ — **catastrophic**, never do it on a moving slider.

**Stiffness caveat.** Dopri5/Dop853 are *explicit* (non-stiff). Widely separated timescales (very large $\kappa$ vs slow drive) make the adaptive controller shrink $\Delta t$ and miss the frame budget; QuTiP switches to BDF (`zvode`) for stiff cases but `ode_solvers` has no implicit solver. For stiff regimes prefer the precomputed-propagator (`exp`) path.

---

## 2. Fock truncation

The cavity is an infinite oscillator and **must** be truncated to $N_{\rm fock}$ photons (`destroy(N)` in QuTiP). Total Hilbert space is $N_{\rm fock}\times 2^{M}$ ($M$ emitters) — exponential in emitter count.

- **Sizing.** Choose $N_{\rm fock}$ so the population in the top level is negligible. For low-excitation vacuum-Rabi (start in $|1,g\rangle$ or $|0,e\rangle$), $N_{\rm fock}\approx15$–$30$ is plenty (QuTiP's reference notebook uses 15). For a coherent-state field of mean $\bar n$ photons take $N_{\rm fock}\gg\bar n$, e.g. $\bar n+5\sqrt{\bar n}$.
- **Convergence check (mandatory).** Raise $N_{\rm fock}$ until observables ($\langle a^\dagger a\rangle(t)$, etc.) stop moving; assert top-level population $<10^{-6}$ and $\mathrm{Tr}(\rho)=1$ to tolerance.
- **CRITICAL — this is NOT the repo's `N_max`.** The HTC `N_max` in `engine/htc.ts` (1636, 10785, …) is a **molecule count** for the polariton-chemistry turnover, *not* a photon Fock-space size. Sizing $N_{\rm fock}$ to `N_max` would be catastrophically slow and physically wrong. The Wigner grid only needs $N_{\rm fock}$ large enough that the displayed field's photon-number tail is negligible (typically 20–80).
- **Liouvillian/memory wall.** Superoperator space is $\dim^2$; the practical wall for large $M$. Tavis–Cummings scales as $N_{\rm fock}\times2^{M}$ — past $M\approx3$–4, drop to the sparse-Liouvillian or MCWF route.

---

## 3. The Wigner algorithm

Port QuTiP's **default `_wigner_clenshaw`** (`method='clenshaw'`, `g=√2`) exactly — it is numerically stable to high photon number and is QuTiP's own default. Use the **displaced-parity / Fock-basis** form, never the position integral. The cavity reduced density matrix $\rho_c$ (trace out the emitter(s)) is the input.

Definition (Cahill–Glauber / Royer displaced parity):

$$W(\alpha)=\frac{2}{\pi}\,\mathrm{Tr}\!\left[\hat D(\alpha)\,\rho\,\hat D^\dagger(\alpha)\,(-1)^{\hat a^\dagger\hat a}\right],\qquad \alpha=\tfrac12 g\,(x+iy),\ \ g=\sqrt2\Rightarrow\hbar=2/g^2=1$$

**Algorithm (verbatim from `qutip/wigner.py`).** $M=\rho_c$ dimension; $X,Y=\mathrm{meshgrid}(xvec,yvec)$; `A2 = g*(X + 1j*Y)`; `B = |A2|²`. Vectorized over the whole grid:

1. **Grid & constants.** Form `A2`, `B`, accumulator `w0` as 2-D arrays the grid's size; default `g=√2`.
2. **Init (top diagonal $L=M-1$).** `w0 = (2*rho[0, M-1]) * ones_like(A2)`; `L = M-1`.
3. **Outer Clenshaw sweep.** Build `rho_dense = rho.full() * (2*ones((M,M)) - diag(ones(M)))` (off-diagonals doubled, diagonal single — encodes the factor-2 for Hermitian off-diagonal pairs). Loop $L$ down: `L -= 1; diag = diagonal(rho_dense, L); w0 = _wig_laguerre_val(L, B, diag) + w0 * A2 * (L+1)**-0.5`.
4. **Inner Laguerre Clenshaw** `_wig_laguerre_val(L, x=B, c=diag)` evaluates $\sum_n c_n LL_n^L(B)$ with $LL_n^L=(-1)^n\sqrt{L!\,n!/(L+n)!}\,\mathrm{LaguerreL}[n,L,x]$, itself a Clenshaw recurrence; implement the `len(c)==1` and `len(c)==2` base cases.
5. **Finalize.** `W = w0.real * exp(-B*0.5) * (g*g*0.5/pi)`. With `g=√2` the prefactor $g^2/2\pi=1/\pi$ and vacuum gives $e^{-(x^2+y^2)}/\pi$.

Canonical signatures the port must reproduce: coherent = one round positive Gaussian at $(\sqrt2\,\mathrm{Re}\,\alpha,\sqrt2\,\mathrm{Im}\,\alpha)$, peak $1/\pi$; Fock $|n\rangle = \frac{2}{\pi}(-1)^n e^{-2|\alpha|^2}L_n(4|\alpha|^2)$ (rings, negative for $n\ge1$); cat = two lobes + sign-alternating fringes (exercises the off-diagonal ×2).

**Rust/WASM port notes.** Flat row-major `Float64`/`Complex` arrays length $n_x n_y$; precompute `B` once per frame (only recompute when `xvec/yvec` change). Hoist all $(L,k)$-dependent $\sqrt{\cdot}$ scalar coefficients into precomputed tables when $M$ changes — they depend only on integers, not the grid. **Compute the recurrence in f64**, downcast to f32 only for the texture upload (f32 loses negativity fidelity, the physically important blue region). Match `np.meshgrid` row-major layout (`y` is the row axis) or the $x,p$ axes transpose on the canvas. **Complexity** $O(n_x n_y\cdot M^2)$: a 200×200 grid at $M=40$ is ~$10^8$ FMA/frame — recompute every 2–4 frames and interpolate if needed.

---

## 4. Steady state and spectrum (the sparse-Liouvillian niche)

Reserve the vectorized Liouvillian here, matching QuTiP `steadystate`.

- **Steady state.** Solve $\mathcal{L}\,\mathrm{vec}(\rho_{ss})=0$ (the right null vector) with sparse LU (`faer-sparse`), per QuTiP `steadystate` `method='direct'`. Far cheaper than integrating $t\to\infty$. Requires a unique steady state (generically true with $\ge1$ loss channel). Build $\mathcal{L}$ via `spre/spost/sprepost`-style stacking using **QuTiP's column-stacking convention**: $|\psi_i\rangle\langle\psi_j|\mapsto|\psi_j\rangle\otimes|\psi_i\rangle$. Mixing this up gives a transposed/conjugated Liouvillian and wrong dynamics.
- **Spectrum.** Two routes: **(a)** closed-form sum of two Lorentzians at the complex eigenfrequencies of the non-Hermitian matrix (cheap, exact in the linear/single-excitation regime), peaks at $\omega_c\pm g$ (or $\pm g\sqrt N$), each FWHM $\Gamma=(\kappa+\gamma)/2$ at resonance; **(b)** Wiener–Khinchin FFT of the steady-state two-time correlation $\langle a^\dagger(\tau)a(0)\rangle$ via the quantum regression theorem (QuTiP `spectrum_ss`/`spectrum_correlation_fft`), for driven/nonlinear cases. For a live tool the analytic doublet (a) is the default; flag it as a linear-response approximation.

---

## 5. Real Rust crates (verified versions)

| Crate | Version | Role | Note |
|---|---|---|---|
| `nalgebra` | 0.35.0 | `DMatrix<Complex<f64>>` dense complex LA; `Matrix::exp()` for the propagator | Compiles to `wasm32-unknown-unknown` out of the box (official WASM guide). `nalgebra-lapack` does **NOT** build for wasm. |
| `num-complex` | 0.4.6 | `Complex<f64>`/`Complex64` scalar | `no_std`/`libm`-capable. |
| `ode_solvers` | 0.6.2 | `Dopri5` (RK 5(4)), `Dop853` (8(5,3)), `Rk4` | `System` trait `fn system(&self,x:T,y:&V,dy:&mut V)`; **state `V` is a REAL nalgebra vector — no complex state**. |
| `faer` (faer-rs) | latest | Dense complex GEMM + **sparse** module (LU/QR/Cholesky) for the Liouvillian path; native `c32`/`c64` | wasm32 support **NOT** confirmed in sources — verify a wasm build before committing. |
| `wasm-bindgen` | 0.2.122 | JS↔Rust bindings, wasm memory model | pair with `wasm-pack`. |
| `js-sys` | latest | `Float64Array`/`Float32Array` views (`view`, `subarray`, `copy_to/from`) | zero-copy reads. |
| `web-sys` | (wasm-bindgen) | `Worker`/`MessagePort`/`WebAssembly.Memory` | if instantiating wasm inside workers. |
| `ndarray` | 0.17.2 | optional n-d layout for $\rho$/Wigner grid | `ndarray-linalg`/`ndarray-npy` pull in BLAS/LAPACK — do **NOT** build for wasm. |
| `getrandom` | — | ONLY if MCWF/disorder sampling used | must enable the **js backend** on `wasm32-unknown-unknown` (0.2: feature `"js"`; 0.3: `wasm_js` cfg) or it panics at runtime. |
| `wasm-bindgen-rayon` | latest | OPTIONAL threads (only if single-thread too slow) | needs nightly + `rust-src`, `RUSTFLAGS="-C target-feature=+atomics,+bulk-memory --shared-memory"`, COOP/COEP. |
| `wasm-pack` | — | build/packaging tool (not a lib dep) | `wasm-pack build --target web`. |

**Hard constraint:** no transitive dependency may pull a system BLAS/LAPACK (`blas-src`, `nalgebra-lapack`, `ndarray-linalg`) or the WASM build breaks. All LA must be pure-Rust nalgebra/faer/num-complex.

---

## 6. wasm-bindgen / Web-Worker setup

- **Project.** `crates/solver` lib, `crate-type = ["cdylib", "rlib"]` (keep `rlib` so native `cargo test` links the same code). Build `wasm-pack build --target web` → ES-module output consumable by Vite with no extra glue. (`--target bundler` output "is not natively implemented in any JS implementation" and needs a bundler — avoid.)
- **`Solver` owns all state.** A `#[wasm_bindgen]` struct holds $\rho$ (row-major dense complex, $\dim\times\dim$), $H$, $c_{\rm ops}$, precomputed $H_{\rm nh}$ and $J_i^\dagger J_i$, the integrator, and **persistent scratch buffers**: `obs: Vec<f64>` (`[t, ⟨a†a⟩, ⟨σz⟩, purity]`) and `wigner: Vec<f32>` ($n\times n$ grid). Capacities are fixed at construction (no per-frame allocation).
- **Worker.** The entire `Solver` lives in a dedicated **module Web Worker** (Vite: `new Worker(new URL('./solver.worker.ts', import.meta.url), {type:'module'})`). The worker runs the step loop paced to the frame budget; the UI/render thread never blocks on integration. **Decouple sim-time from wall-time** (e.g. advance 1 ns of physics per 16.7 ms frame); the adaptive controller takes as many internal substeps as accuracy needs.
- **Streaming, default path (a):** the worker copies `obs`+`wigner` into a small `ArrayBuffer` and `postMessage(buf, [buf])` (**transferable** → ~1 ms move, not a structured-clone copy). Keep a **ring/double-buffer** of frame snapshots in the worker so there is always a writable buffer while the previous is in flight (after transfer the buffer is *neutered* — cannot be reused). Main thread double-buffers so the renderer always reads a complete frame.
- **Streaming, advanced path (b):** a `SharedArrayBuffer`-backed shared `WebAssembly.Memory` → render thread reads the same bytes, zero transfer. **Opt-in only** — requires cross-origin isolation (`COOP: same-origin` + `COEP: require-corp`), which many static hosts cannot set. Default to (a).
- **Threads.** `wasm-bindgen-rayon` only if single-thread is too slow; same COOP/COEP + nightly requirement. Not the default.

---

## 7. JS↔WASM data interface

- **Setup (rare, not per frame).** Complex matrices cross as interleaved `[re, im, re, im, …]` `Float64Array`.
- **Per-frame reads (zero-copy).** The wasm module is the **single owner** of linear memory and exposes raw pointers. After `await init()`, build long-lived typed-array views **once**:
  ```js
  const obs = new Float64Array(wasm.memory.buffer, solver.obs_ptr(),    solver.obs_len());
  const wig = new Float32Array(wasm.memory.buffer, solver.wigner_ptr(), n*n);
  ```
- **CRITICAL — detached views.** `js_sys` docs: *"Views into WebAssembly memory are only valid so long as the backing buffer isn't resized… any future malloc may invalidate the returned value"* (wasm-bindgen #4395). If `memory.grow` fires, `wasm.memory.buffer` **detaches** and every cached view silently breaks (garbage or throws). **Mitigation:** fix all buffer capacities at construction, pre-grow memory, avoid runtime allocation; **rebuild views** after any call that could allocate. This is the single highest-risk bug in the zero-copy design.
- **Pointers are stable** as long as the backing `Vec`s are not reallocated (capacity fixed at construction).
- `f32` for the Wigner stream is fine for the colormap (halves bytes, ~160 KB for 200×200) but the recurrence is computed in `f64` and downcast last.

**Exported boundary (signatures):**

```rust
#[wasm_bindgen]
impl Solver {
    pub fn new(params: &JsValue) -> Solver;          // build H, c_ops, H_nh, J†J, ρ0, buffers
    pub fn set_param(&mut self, name: &str, val: f64);// rebuild affected operators
    pub fn step(&mut self, dt: f64);                  // advance sim-time by dt (adaptive substeps)
    pub fn obs_ptr(&self) -> *const f64;              // → [t, ⟨a†a⟩, ⟨σz⟩, purity]
    pub fn obs_len(&self) -> usize;
    pub fn wigner_ptr(&self) -> *const f32;
    pub fn wigner_n(&self) -> usize;                  // grid edge length n (n×n)
    pub fn recompute_wigner(&mut self, xmin: f64, xmax: f64, n: usize);
    pub fn steady_state(&mut self);                   // sparse L·vec(ρ_ss)=0 → fills ρ
    pub fn spectrum(&mut self, wmin: f64, wmax: f64, n: usize) -> Vec<f64>; // two-Lorentzian doublet
}
```

---

## 8. QuTiP VALIDATION HARNESS (the critical deliverable)

**Strategy.** A Python generator runs QuTiP on a *fixed* JC+Lindblad problem and serializes golden arrays into the repo. Rust `#[test]` (native target, `cargo test`) loads them and asserts the Rust solver agrees to tolerance. **CI gate: `cargo test` MUST pass before `wasm-pack build` and before deploy.** All conventions pinned to **QuTiP 5.1**, `wigner method='clenshaw'`, `g=√2`, `a=0.5·g·(x+iy)`, and the QuTiP Lindblad dissipator (rate inside the operator — never multiply by $\kappa$ **and** use $\sqrt\kappa\,a$; never double-count the $\tfrac12$ dissipator factor).

### 8.1 Problem T1 — damped vacuum-Rabi dynamics (golden: time series)

```python
import qutip as qt, numpy as np
N=20; a=qt.tensor(qt.destroy(N), qt.qeye(2)); sm=qt.tensor(qt.qeye(N), qt.destroy(2))
wc=wa=1.0*2*np.pi; g=0.05*2*np.pi; kappa=0.1; gamma=0.0
H=wc*a.dag()*a + wa*sm.dag()*sm + g*(a.dag()*sm + a*sm.dag())
c_ops=[np.sqrt(kappa)*a]
psi0=qt.tensor(qt.basis(N,1), qt.basis(2,0)); tlist=np.linspace(0,25,200)
res=qt.mesolve(H,psi0,tlist,c_ops,e_ops=[a.dag()*a, sm.dag()*sm])
```
**Tolerance.** Build the same $H$, $c_{\rm ops}$ on $\dim=2N=40$, integrate $\rho$ with Dopri5 (`atol=1e-8`, `rtol=1e-6`, matching QuTiP zvode/Adams defaults). Assert at *every* `tlist` point: `max|⟨a†a⟩_rust − res.expect[0]| < 1e-4`; `max|⟨σz⟩| error < 1e-4`; and throughout `Tr(ρ)=1`, $\rho$ Hermitian, all eigenvalues $\ge -10^{-8}$. Exercises coherent vacuum-Rabi exchange **and** cavity decay.

### 8.2 Problem T2 — full JC+Lindblad with dephasing + Wigner (golden: series + 200×200 grid)

```python
Nf=20; a=qt.tensor(qt.qeye(2), qt.destroy(Nf)); sm=qt.tensor(qt.destroy(2), qt.qeye(Nf))
wc=wa=1.0*2*np.pi; g=0.05*2*np.pi; kappa=0.05; gamma=0.05; gphi=0.01
psi0=qt.tensor(qt.fock(2,0), qt.fock(Nf,5)); times=np.linspace(0,10,200)
H=wc*a.dag()*a + wa*sm.dag()*sm + g*(sm*a.dag()+sm.dag()*a)
c_ops=[np.sqrt(kappa)*a, np.sqrt(gamma)*sm, np.sqrt(gphi/2)*qt.tensor(qt.sigmaz(),qt.qeye(Nf))]
res=qt.mesolve(H,psi0,times,c_ops,e_ops=[a.dag()*a, sm.dag()*sm])
rho_f=qt.mesolve(H,psi0,times,c_ops).states[-1]; rho_c=rho_f.ptrace(1)
xvec=np.linspace(-5,5,200)
W=qt.wigner(rho_c, xvec, xvec, method='clenshaw', g=np.sqrt(2))
```
Dump `times`, `res.expect[0]` (⟨a†a⟩), `res.expect[1]`, purity `Tr(ρ²)`, and the 200×200 `W` to `golden_T2.json`/`.npy`. **Tolerance.** Rust runs the identical $H$, `psi0`, $c_{\rm ops}$, `tlist`: `max|⟨a†a⟩ error| < 1e-4` over all $t$; `max|⟨σz⟩ error| < 1e-4`; **full Wigner grid `max|W_rust − W_qutip| < 1e-4`** (W is $O(1)$, peak $\sim1/\pi$). The Wigner check is what catches the `g=√2` grid-convention bug and the off-diagonal ×2 bug.

### 8.3 Problem T3 — steady state

`kappa=0.1, gamma=0.0` with $c_{\rm ops}=[\sqrt\kappa\,a]$: assert steady-state $\langle a^\dagger a\rangle\to0$ to $<10^{-5}$. Add a coherent drive term and compare the Rust steady state to `qt.steadystate(H, c_ops)` element-wise to $<10^{-5}$.

### 8.4 Wigner unit tests (operator + state conventions)

Standalone (no dynamics), `atol=1e-10, rtol=0` element-wise vs QuTiP:
- `coherent_dm(40, 2.0)` — Gaussian; assert `∫W dx dp = 1` to `1e-3` and peak `≈ 1/π` to `5e-3`, centered at $(2\sqrt2,0)$.
- `fock_dm(40, 3)` — ring with negativity (checks the Laguerre recurrence / sign).
- `(coherent(40,2)+coherent(40,-2)).unit().proj()` — cat fringes (checks the off-diagonal ×2; fringes come out at half amplitude if the factor-2 is dropped).
- `thermal_dm(40, …)` — purely positive Gaussian (mixed-state path).

### 8.5 Operator-builder unit tests

Confirm `destroy(N)` matches QuTiP's $\sqrt n$ upper-off-diagonal element-by-element; confirm `tensor` ordering matches the harness (`tensor(qeye(N), sigmam())` vs `tensor(sigmam(), qeye(N))` — pin one and use it everywhere). A transposed tensor order silently breaks every comparison.

### 8.6 Physicality guard (each accepted step, before display)

RK does not conserve trace/positivity exactly; over long runs $\rho$ drifts (validation can pass early, diverge late). Hermitize $\rho\leftarrow(\rho+\rho^\dagger)/2$ and renormalize $\rho\leftarrow\rho/\mathrm{Tr}(\rho)$ every accepted step ($O(\dim^2)$, cheap).

---

## 9. Build order

1. **Skeleton.** `crates/solver` (`cdylib`+`rlib`); `nalgebra`/`num-complex`/`ode_solvers` deps; `wasm-pack build --target web` produces an importable ES module; a trivial `#[wasm_bindgen] add()` proves the JS↔WASM round-trip in Vite.
2. **Operators (native, tested first).** `destroy(N)`, `sigmam/sigmaz`, `tensor`, JC `H`, collapse ops. Land §8.5 operator unit tests against QuTiP-dumped matrices — *before any integration*.
3. **RHS + integrator.** Flatten $\rho$ to a real `2·dim²` vector (the #1 `ode_solvers` gotcha — no complex state); reconstruct complex $\rho$ inside `system()`; implement $\dot\rho=-i(H_{\rm nh}\rho-\rho H_{\rm nh}^\dagger)+\sum J_i\rho J_i^\dagger$; wire Dopri5 (`atol=1e-8,rtol=1e-6`); §8.6 physicality guard.
4. **Validation T1.** Generate `golden_T1.json`; pass §8.1 native `cargo test`. **CI gate goes live here.**
5. **Observables.** `obs` buffer (`⟨a†a⟩,⟨σz⟩,purity`) as $\mathrm{Tr}(O\rho)$; validation T2 series (§8.2 dynamics half).
6. **Wigner.** Port `_wigner_clenshaw` (f64), `ptrace` to $\rho_c$; §8.4 + §8.2 grid tests to `1e-4`/`1e-10`.
7. **WASM boundary.** Exported `Solver` API (§7); zero-copy typed-array views; detached-view mitigation.
8. **Web Worker.** Move `Solver` into the worker; transferable ring-buffer streaming (path a); double-buffer on main thread; render `obs` time-series + Wigner `DataTexture` (diverging zero-centered colormap, `RdBu_r`/`seismic`, `vmin=-max|W|, vmax=+max|W|`).
9. **Steady state + spectrum.** Sparse Liouvillian (`faer-sparse`) for `steady_state()`; analytic two-Lorentzian `spectrum()`; §8.3 tests.
10. **(Optional) scale-out.** MCWF fallback and/or `wasm-bindgen-rayon` only if single-emitter $N_{\rm fock}\le40$ at 60fps proves insufficient for the multi-emitter / large-Wigner cases.

---

## 10. Engine functions / signatures (Rust core)

```rust
// ── operators.rs ─────────────────────────────────────────────────────────────
fn destroy(n: usize) -> DMatrix<Complex64>;                 // √n upper off-diagonal
fn create(n: usize)  -> DMatrix<Complex64>;                 // destroy(n).adjoint()
fn num(n: usize)     -> DMatrix<Complex64>;                 // a†a
fn sigmam() -> DMatrix<Complex64>; fn sigmaz() -> DMatrix<Complex64>;
fn tensor(ops: &[&DMatrix<Complex64>]) -> DMatrix<Complex64>;// QuTiP Kronecker order
fn jc_hamiltonian(nf: usize, wc: f64, wa: f64, g: f64) -> DMatrix<Complex64>;
fn tc_hamiltonian(nf: usize, m: usize, wc: f64, wa: &[f64], g: &[f64]) -> DMatrix<Complex64>;
fn collapse_ops(nf:usize, m:usize, kappa:f64, gamma:f64, gphi:f64, n_th:f64)
    -> Vec<DMatrix<Complex64>>;                             // √(κ(1+n_th))a, √(κ n_th)a†, √γ σ₋, √(γφ/2) σz

// ── lindblad.rs ──────────────────────────────────────────────────────────────
struct Lindblad {                                           // precomputed once per slider change
    h_nh: DMatrix<Complex64>,                               // H − (i/2) Σ Jᵢ†Jᵢ
    jumps: Vec<DMatrix<Complex64>>,                         // Jᵢ = √γᵢ Aᵢ
}
impl Lindblad {
    fn new(h: &DMatrix<Complex64>, c_ops: &[DMatrix<Complex64>]) -> Self;
    fn rhs(&self, rho: &DMatrix<Complex64>) -> DMatrix<Complex64>; // −i[H_nh,ρ] + ΣJᵢρJᵢ†
}
fn flatten(rho: &DMatrix<Complex64>, out: &mut [f64]);      // ρ → real 2·dim² vector
fn unflatten(v: &[f64], dim: usize) -> DMatrix<Complex64>;  // inverse
fn hermitize_renorm(rho: &mut DMatrix<Complex64>);          // physicality guard

// ── steady.rs ────────────────────────────────────────────────────────────────
fn liouvillian(h:&DMatrix<Complex64>, c_ops:&[DMatrix<Complex64>]) -> SparseMat;// column-stack vec
fn steadystate(l: &SparseMat) -> DMatrix<Complex64>;       // sparse LU null vector
fn spectrum_lorentzian(wc:f64, g:f64, kappa:f64, gamma:f64, w:&[f64]) -> Vec<f64>;

// ── wigner.rs ────────────────────────────────────────────────────────────────
fn ptrace_cavity(rho:&DMatrix<Complex64>, nf:usize, m:usize) -> DMatrix<Complex64>;
fn wigner_clenshaw(rho_c:&DMatrix<Complex64>, xvec:&[f64], yvec:&[f64], g:f64) -> Vec<f32>;
fn wig_laguerre_val(l: usize, x: &[f64], c: &[Complex64]) -> Vec<f64>; // inner Clenshaw

// ── observables.rs ───────────────────────────────────────────────────────────
fn expect(op:&DMatrix<Complex64>, rho:&DMatrix<Complex64>) -> f64; // Re Tr(Oρ)
fn purity(rho: &DMatrix<Complex64>) -> f64;                        // Tr(ρ²) = ‖ρ‖_F²
```

---

## 11. Pitfall checklist (must hold before merge)

- [ ] `ode_solvers` state is **real** — flatten $\rho$ to `2·dim²` and rebuild complex inside `system()`.
- [ ] Never build the dense Liouvillian for $\dim$ in the hundreds (doubled space, $O(\dim^4)$ memory). Dense only for $\dim\lesssim60$ propagator path.
- [ ] QuTiP **column-stacking** $|\psi_i\rangle\langle\psi_j|\to|\psi_j\rangle\otimes|\psi_i\rangle$ for any $\mathcal{L}$ comparison.
- [ ] Hermitize + renormalize trace **every accepted step** (RK drifts).
- [ ] Wigner `g=√2` end-to-end; off-diagonal ×2; f64 recurrence; `np.meshgrid` row-major layout.
- [ ] Lindblad rate inside the operator ($\sqrt\kappa\,a$), dissipator $\tfrac12$ factor present once — no double counting.
- [ ] No BLAS/LAPACK transitive dep (`nalgebra-lapack`/`ndarray-linalg`) — breaks wasm.
- [ ] `getrandom` js backend enabled if any RNG path is linked.
- [ ] Rebuild typed-array views after any allocation (`memory.grow` detaches the buffer).
- [ ] Transferable buffer is neutered after `postMessage` — use the ring buffer.
- [ ] `N_fock` is a photon cutoff (~20–80), **not** the HTC `N_max` molecule count.

---

## Sources (verified)
- QuTiP Lindblad Master Equation guide — https://qutip.readthedocs.io/en/latest/guide/dynamics/dynamics-master.html
- QuTiP Steady-State guide — https://qutip.readthedocs.io/en/latest/guide/guide-steady.html
- QuTiP Jaynes–Cummings Lecture-1 (collapse ops, params) — https://github.com/qutip/qutip-tutorials/blob/main/tutorials-v5/lectures/Lecture-1-Jaynes-Cumming-model.md
- QuTiP `rabi-oscillations.ipynb` (golden params wc=wa=2π, g=0.05·2π, κ=0.005, γ=0.05, N=15) — https://github.com/qutip/qutip-notebooks/blob/master/examples/rabi-oscillations.ipynb
- QuTiP `wigner.py` source (`_wigner_clenshaw`, `g=√2`, off-diagonal ×2) — https://github.com/qutip/qutip/blob/master/qutip/wigner.py
- QuTiP visualization guide (diverging colormap, `Normalize(-W.max(),W.max())`) — https://qutip.readthedocs.io/en/latest/guide/guide-visualization.html
- QuantumOptics.jl master equation (`dmaster_h!`, non-Hermitian $H_{\rm nh}$) — https://docs.qojulia.org/timeevolution/master/
- QuTiP 5 paper (column-stacking, doubled-space quadratic memory) — https://arxiv.org/abs/2412.04705
- Mølmer, Castin, Dalibard, MCWF, JOSA B 10, 524 (1993) — https://doi.org/10.1364/JOSAB.10.000524
- Higham, scaling-and-squaring matrix exponential, SIAM JMAA 26 (2005) — https://eprints.maths.manchester.ac.uk/634/1/high05e.pdf
- Cahill & Glauber, Phys. Rev. 177, 1882 (1969); Royer, Phys. Rev. A 15, 449 (1977) — displaced-parity Wigner
- `ode_solvers` 0.6.2 — https://docs.rs/ode_solvers/ ; `nalgebra` WASM guide — https://www.nalgebra.org/docs/user_guide/wasm_and_embedded_targets/
- `js_sys::Float64Array` (detached-buffer warning) — https://docs.rs/js-sys/latest/js_sys/struct.Float64Array.html ; wasm-bindgen #4395
- `wasm-pack build` targets — https://wasm-bindgen.github.io/wasm-pack/book/commands/build.html ; `getrandom` wasm backend — https://docs.rs/getrandom
- Boca/Kimble, PRL 93, 233603 (2004) — vacuum-Rabi doublet $2g\sqrt N$, width $(\kappa+\gamma)/2$
