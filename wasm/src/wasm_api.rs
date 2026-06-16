//! WASM boundary — a JS-friendly `Sim` wrapping the QuTiP-validated solver + Wigner.
//! Only `f64` and `Float64Array` cross the boundary; nalgebra stays internal. Arrays are
//! returned by value (a copy) — correctness-first, which sidesteps the `memory.grow`
//! detached-view trap entirely. Zero-copy views are a later, measured optimization.

use crate::operators::{CMat, Params};
use crate::solver::Solver;
use crate::spectrum::disordered_spectrum;
use crate::wigner::{partial_trace_atom, q_function, wigner_to_rgba, WignerGrid};
use nalgebra::Complex;
use wasm_bindgen::prelude::*;

const SQRT2: f64 = std::f64::consts::SQRT_2;

#[wasm_bindgen]
pub struct Sim {
    n_fock: usize,
    solver: Solver,
    rho: CMat,
    t: f64,
    dt: f64,
}

#[wasm_bindgen]
impl Sim {
    /// Build a single-emitter Jaynes–Cummings open system, initial state |0 photon, atom excited⟩.
    #[wasm_bindgen(constructor)]
    pub fn new(
        n_fock: usize,
        w_c: f64,
        w_a: f64,
        g: f64,
        kappa: f64,
        gamma: f64,
        gamma_phi: f64,
    ) -> Sim {
        let p = Params { n_fock, w_c, w_a, g, kappa, gamma, gamma_phi };
        let solver = Solver::new(&p);
        let mut sim = Sim { n_fock, solver, rho: CMat::zeros(2 * n_fock, 2 * n_fock), t: 0.0, dt: 0.01 };
        sim.reset();
        sim
    }

    /// Reset to |0 photon, atom excited⟩ at t = 0. (cavity-first index 2·0 + 0 = 0)
    pub fn reset(&mut self) {
        self.rho = CMat::zeros(2 * self.n_fock, 2 * self.n_fock);
        self.rho[(0, 0)] = Complex::new(1.0, 0.0);
        self.t = 0.0;
        self.dt = 0.01;
    }

    /// Advance the dissipative dynamics by `dt_advance` of simulation time.
    pub fn advance(&mut self, dt_advance: f64, atol: f64, rtol: f64) {
        let t1 = self.t + dt_advance;
        self.dt = self.solver.integrate(&mut self.rho, self.t, t1, atol, rtol, self.dt);
        self.t = t1;
    }

    pub fn time(&self) -> f64 {
        self.t
    }
    pub fn photon_number(&self) -> f64 {
        self.solver.expect_num(&self.rho)
    }
    pub fn excited_pop(&self) -> f64 {
        self.solver.expect_pe(&self.rho)
    }
    pub fn trace(&self) -> f64 {
        self.rho.trace().re
    }
    pub fn min_eigenvalue(&self) -> f64 {
        Solver::min_eigenvalue(&self.rho)
    }

    /// Flattened |ρ_c[n,n′]| (row-major, n_fock²) of the current cavity-reduced state — a
    /// hinton-style density-matrix diagnostic. ρ_c = Tr_atom ρ (validated vs QuTiP ptrace(0)).
    pub fn cavity_rho_abs(&self) -> Vec<f64> {
        let rc = partial_trace_atom(&self.rho, self.n_fock);
        let mut out = Vec::with_capacity(self.n_fock * self.n_fock);
        for i in 0..self.n_fock {
            for j in 0..self.n_fock {
                out.push(rc[(i, j)].norm());
            }
        }
        out
    }

    /// Flattened |ρ[i,j]| (row-major, (2·n_fock)²) of the FULL joint cavity⊗emitter state.
    /// Unlike the cavity-reduced ρ_c (diagonal in vacuum-Rabi), the joint state carries the
    /// oscillating-and-decaying coherence ρ[|0,e⟩,|1,g⟩] — the honest picture of decoherence.
    pub fn rho_abs(&self) -> Vec<f64> {
        let d = 2 * self.n_fock;
        let mut out = Vec::with_capacity(d * d);
        for i in 0..d {
            for j in 0..d {
                out.push(self.rho[(i, j)].norm());
            }
        }
        out
    }

    /// Purity Tr(ρ²) = Σ_ij |ρ_ij|² (= 1 pure, < 1 mixed). Falls as the open system decoheres.
    pub fn purity(&self) -> f64 {
        self.rho.iter().map(|z| z.norm_sqr()).sum()
    }

    /// von Neumann entropy S = −Tr(ρ ln ρ) of the full joint state (0 = pure, > 0 = mixed).
    pub fn von_neumann_entropy(&self) -> f64 {
        crate::entropy::von_neumann_entropy(&self.rho)
    }

    /// Live Husimi Q-function grid (row-major n×n, r→y c→x) of the cavity-reduced state — a
    /// strictly non-negative phase-space density that complements the (signed) Wigner.
    pub fn husimi(&self, xmin: f64, xmax: f64, n: usize) -> Vec<f64> {
        let xvec = linspace(xmin, xmax, n);
        q_function(&partial_trace_atom(&self.rho, self.n_fock), &xvec, &xvec, SQRT2)
    }

    /// Wigner grid (row-major, n×n, r→y c→x) of the current cavity-reduced state.
    pub fn wigner(&self, xmin: f64, xmax: f64, n: usize) -> Vec<f64> {
        let xvec = linspace(xmin, xmax, n);
        let grid = WignerGrid::new(&xvec, &xvec, SQRT2);
        grid.compute(&partial_trace_atom(&self.rho, self.n_fock))
    }

    /// Live cavity-reduced Wigner mapped to a flat RGBA buffer (n²·4 bytes) — ready for
    /// `putImageData`. Colour mapping happens here so only RGBA crosses the boundary.
    /// `w_max ≤ 0` auto-scales; otherwise fixed (use 1/π for the absolute physical scale).
    pub fn wigner_rgba(&self, xmin: f64, xmax: f64, n: usize, w_max: f64) -> Vec<u8> {
        let xvec = linspace(xmin, xmax, n);
        let w = WignerGrid::new(&xvec, &xvec, SQRT2)
            .compute(&partial_trace_atom(&self.rho, self.n_fock));
        wigner_to_rgba(&w, w_max)
    }
}

/// Wigner of an arbitrary cavity density matrix supplied from JS (row-major re/im).
#[wasm_bindgen]
pub fn wigner_of_rho(re: &[f64], im: &[f64], dim: usize, xmin: f64, xmax: f64, n: usize) -> Vec<f64> {
    let rho = CMat::from_fn(dim, dim, |i, j| Complex::new(re[i * dim + j], im[i * dim + j]));
    let xvec = linspace(xmin, xmax, n);
    WignerGrid::new(&xvec, &xvec, SQRT2).compute(&rho)
}

/// RGBA Wigner of an arbitrary cavity density matrix from JS (row-major re/im).
#[wasm_bindgen]
pub fn wigner_rgba_of_rho(
    re: &[f64], im: &[f64], dim: usize, xmin: f64, xmax: f64, n: usize, w_max: f64,
) -> Vec<u8> {
    let rho = CMat::from_fn(dim, dim, |i, j| Complex::new(re[i * dim + j], im[i * dim + j]));
    let xvec = linspace(xmin, xmax, n);
    let w = WignerGrid::new(&xvec, &xvec, SQRT2).compute(&rho);
    wigner_to_rgba(&w, w_max)
}

/// Eigen-modes of the single-excitation arrowhead for real-time dynamics: a flat array
/// [eigs (M+1), then the (M+1)² row-major eigenvector matrix]. The UI evolves ψ(t) from these.
#[wasm_bindgen]
pub fn arrowhead_modes(w_c: f64, w_a: f64, g: f64, m: usize, sigma: f64, seed: f64) -> Vec<f64> {
    let z = crate::spectrum::gaussians(seed as u64, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let md = crate::spectrum::modes(w_c, &w, &vec![g; m]);
    let mut out = Vec::with_capacity(md.eigs.len() + md.vecs.len());
    out.extend_from_slice(&md.eigs);
    out.extend_from_slice(&md.vecs);
    out
}

/// Eigen-modes for PER-MOLECULE couplings g_i (orientation- and position-dependent). Site energies
/// w_i come from Gaussian energy disorder (w_a + σ·N(0,1)); the couplings g_i are passed in directly
/// (g_i = g_0·(μ̂_i·ε̂)·f(r_i), computed in the UI from the shared ensemble). Returns the same flat
/// [eigs(M+1), then (M+1)² eigenvectors] as `arrowhead_modes`. A perpendicular dipole (g_i=0) yields a
/// dark eigenstate localized on that molecule — the physics is identical to the validated arrowhead.
#[wasm_bindgen]
pub fn arrowhead_modes_gi(w_c: f64, w_a: f64, sigma: f64, seed: f64, gi: &[f64]) -> Vec<f64> {
    let m = gi.len();
    let z = crate::spectrum::gaussians(seed as u64, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let md = crate::spectrum::modes(w_c, &w, gi);
    let mut out = Vec::with_capacity(md.eigs.len() + md.vecs.len());
    out.extend_from_slice(&md.eigs);
    out.extend_from_slice(&md.vecs);
    out
}

/// The exact single-excitation Hamiltonian matrix (the (M+1)×(M+1) real-symmetric arrowhead the engine
/// diagonalizes), flat row-major, for per-molecule couplings g_i. For export to NumPy/MATLAB so a
/// researcher can pull the current operator into a notebook. Index 0 = photon (diagonal w_c); index
/// i+1 = emitter i (diagonal w_i from σ-disorder); off-diagonal row/col 0 carry g_i.
#[wasm_bindgen]
pub fn arrowhead_matrix_gi(w_c: f64, w_a: f64, sigma: f64, seed: f64, gi: &[f64]) -> Vec<f64> {
    let m = gi.len();
    let z = crate::spectrum::gaussians(seed as u64, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let h = crate::spectrum::arrowhead(w_c, &w, gi);
    let n = m + 1;
    let mut out = Vec::with_capacity(n * n);
    for i in 0..n {
        for j in 0..n {
            out.push(h[(i, j)]);
        }
    }
    out
}

/// Cavity power spectrum for per-molecule couplings g_i — flat [ω (n/2), power (n/2)]. As above, w_i
/// from (σ, seed); the doublet collapses as orientational/spatial disorder weakens the bright coupling.
#[wasm_bindgen]
pub fn cavity_power_spectrum_gi(w_c: f64, w_a: f64, sigma: f64, seed: f64, gi: &[f64], n_fft: usize, dt: f64) -> Vec<f64> {
    let m = gi.len();
    let z = crate::spectrum::gaussians(seed as u64, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let s = crate::spectrum::solve(w_c, &w, gi);
    let (freqs, power) = crate::fft::power_spectrum(&s.eigs, &s.photon_frac, n_fft, dt);
    let mut out = Vec::with_capacity(freqs.len() + power.len());
    out.extend_from_slice(&freqs);
    out.extend_from_slice(&power);
    out
}

/// Coupling sweep for per-molecule geometry: g_i(g_0) = g_0·`factors[i]`. Returns the (M+1) energies
/// at each of `steps` values of g_0 in [g0, g1], flat row-major. The dispersion fan with realistic
/// (orientation/position-weighted) collective coupling.
#[wasm_bindgen]
pub fn coupling_sweep_gi(w_c: f64, w_a: f64, sigma: f64, seed: f64, factors: &[f64], g0: f64, g1: f64, steps: usize) -> Vec<f64> {
    let m = factors.len();
    let z = crate::spectrum::gaussians(seed as u64, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let mut out = Vec::with_capacity(steps * (m + 1));
    for sidx in 0..steps {
        let g = if steps <= 1 { g0 } else { g0 + (g1 - g0) * sidx as f64 / (steps as f64 - 1.0) };
        let gi: Vec<f64> = factors.iter().map(|f| g * f).collect();
        out.extend_from_slice(&crate::spectrum::solve(w_c, &w, &gi).eigs);
    }
    out
}

/// Single-excitation arrowhead spectrum (Regime 2) for M emitters with Gaussian energy disorder.
/// Returns a flat `Float64Array` of length 2·(M+1): the (M+1) eigenvalues (ascending), then the
/// (M+1) Hopfield photon fractions in the same order. `seed` fixes the disorder realization so a
/// detuning sweep stays continuous; bump it to re-roll. See `spectrum::disordered_spectrum`.
#[wasm_bindgen]
pub fn spectrum(w_c: f64, w_a: f64, g: f64, m: usize, sigma: f64, seed: f64) -> Vec<f64> {
    let s = disordered_spectrum(w_c, w_a, g, m, sigma, seed as u64);
    let mut out = Vec::with_capacity(2 * (m + 1));
    out.extend_from_slice(&s.eigs);
    out.extend_from_slice(&s.photon_frac);
    out
}

/// Cavity transmission/PL power spectrum: a flat array [ω (n/2 values), then power (n/2, peak=1)].
/// `n_fft` must be a power of two. Peaks land at the polariton energies (the vacuum-Rabi doublet);
/// disorder σ splits and broadens them. See `fft::power_spectrum`.
#[wasm_bindgen]
pub fn cavity_power_spectrum(w_c: f64, w_a: f64, g: f64, m: usize, sigma: f64, seed: f64, n_fft: usize, dt: f64) -> Vec<f64> {
    let s = disordered_spectrum(w_c, w_a, g, m, sigma, seed as u64);
    let (freqs, power) = crate::fft::power_spectrum(&s.eigs, &s.photon_frac, n_fft, dt);
    let mut out = Vec::with_capacity(freqs.len() + power.len());
    out.extend_from_slice(&freqs);
    out.extend_from_slice(&power);
    out
}

/// Coupling sweep: the (M+1) eigen-energies at each of `steps` values of g in [g0, g1], flat and
/// row-major by step (length steps·(M+1)). The polariton dispersion fan. See `spectrum::coupling_sweep`.
#[wasm_bindgen]
pub fn coupling_sweep(w_c: f64, w_a: f64, m: usize, sigma: f64, seed: f64, g0: f64, g1: f64, steps: usize) -> Vec<f64> {
    crate::spectrum::coupling_sweep(w_c, w_a, m, sigma, seed as u64, g0, g1, steps)
}

/// Single-molecule Holstein–Tavis–Cummings absorption: flat [eigs (2·n_vib), photon_frac (2·n_vib),
/// absorption (2·n_vib)]. Vibronic polaritons + Franck–Condon sidebands. See `htc::htc`.
#[wasm_bindgen]
pub fn htc_spectrum(w_c: f64, w_x: f64, w_v: f64, lambda: f64, g: f64, n_vib: usize) -> Vec<f64> {
    let r = crate::htc::htc(w_c, w_x, w_v, lambda, g, n_vib);
    let mut out = Vec::with_capacity(6 * n_vib);
    out.extend_from_slice(&r.eigs);
    out.extend_from_slice(&r.photon_frac);
    out.extend_from_slice(&r.absorption);
    out
}

/// Analytic bare-molecule (g=0) Franck–Condon reference: flat [position (n_max), weight (n_max)].
#[wasm_bindgen]
pub fn htc_franck_condon(w_x: f64, w_v: f64, lambda: f64, n_max: usize) -> Vec<f64> {
    let (p, w) = crate::htc::franck_condon(w_x, w_v, lambda, n_max);
    let mut out = Vec::with_capacity(2 * n_max);
    out.extend_from_slice(&p);
    out.extend_from_slice(&w);
    out
}

// ── Cavity cross-section (transfer-matrix optics) ──────────────────────────────
/// DBR-cavity layer stack as a flat [n_0, d_0, n_1, d_1, …] array (index, thickness in nm).
#[wasm_bindgen]
pub fn cavity_layers(lambda: f64, n_hi: f64, n_lo: f64, pairs: usize, n_cav: f64) -> Vec<f64> {
    let mut out = Vec::new();
    for l in crate::optics::dbr_cavity(lambda, n_hi, n_lo, pairs, n_cav) {
        out.push(l.n);
        out.push(l.d_nm);
    }
    out
}

/// |E(z)|² standing-wave field across the stack as a flat [z_0…z_{N-1}, i_0…i_{N-1}] array
/// (`per_layer` samples per layer), with incident index `n0` and substrate `ns`.
#[wasm_bindgen]
pub fn cavity_field(lambda: f64, n_hi: f64, n_lo: f64, pairs: usize, n_cav: f64, n0: f64, ns: f64, per_layer: usize) -> Vec<f64> {
    let stack = crate::optics::dbr_cavity(lambda, n_hi, n_lo, pairs, n_cav);
    let (z, i) = crate::optics::field_profile(&stack, lambda, n0, ns, per_layer);
    let mut out = Vec::with_capacity(z.len() + i.len());
    out.extend_from_slice(&z);
    out.extend_from_slice(&i);
    out
}

/// Power reflectance R(λ) of the DBR cavity at wavelength `lambda` (nm).
#[wasm_bindgen]
pub fn cavity_reflectance(lambda: f64, n_hi: f64, n_lo: f64, pairs: usize, n_cav: f64, n0: f64, ns: f64) -> f64 {
    crate::optics::reflectance(&crate::optics::dbr_cavity(lambda, n_hi, n_lo, pairs, n_cav), lambda, n0, ns)
}

fn linspace(a: f64, b: f64, n: usize) -> Vec<f64> {
    if n < 2 {
        return vec![a];
    }
    let step = (b - a) / ((n - 1) as f64);
    (0..n).map(|i| a + step * i as f64).collect()
}
