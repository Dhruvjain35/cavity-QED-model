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

fn linspace(a: f64, b: f64, n: usize) -> Vec<f64> {
    if n < 2 {
        return vec![a];
    }
    let step = (b - a) / ((n - 1) as f64);
    (0..n).map(|i| a + step * i as f64).collect()
}
