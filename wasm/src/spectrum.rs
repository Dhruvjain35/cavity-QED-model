//! Single-excitation Tavis-Cummings ARROWHEAD spectrum (Regime 2).
//!
//! In the one-excitation subspace {|1 photon, all ground⟩} ∪ {|0 photon, emitter i excited⟩}, the
//! Hamiltonian of M emitters coupled to one cavity mode is an (M+1)×(M+1) real-symmetric arrowhead:
//!   index 0   → photon state, diagonal w_c (cavity) on the corner,
//!   index i+1 → emitter i,     diagonal w_i,
//!   couplings g_i on the single coupled row/column (the "arrow").
//! Diagonalizing gives 2 bright polaritons (split by 2g√M for identical emitters) + M−1 dark states
//! at the bare emitter energy (photon weight 0). Validated against numpy `eigh` in
//! `tests/spectrum_golden.rs`. See docs/GROUNDING-RESEARCH.md §2.

use nalgebra::DMatrix;
use std::f64::consts::PI;

pub struct Spectrum {
    pub eigs: Vec<f64>,        // ascending eigenvalues (energies)
    pub photon_frac: Vec<f64>, // Hopfield photon weight |v_k[0]|² of each eigenstate
}

/// Build the (M+1)×(M+1) arrowhead matrix.
pub fn arrowhead(w_c: f64, w: &[f64], g: &[f64]) -> DMatrix<f64> {
    let m = w.len();
    let mut h = DMatrix::zeros(m + 1, m + 1);
    h[(0, 0)] = w_c;
    for i in 0..m {
        h[(i + 1, i + 1)] = w[i];
        h[(0, i + 1)] = g[i];
        h[(i + 1, 0)] = g[i];
    }
    h
}

/// Diagonalize the arrowhead, returning eigenvalues (ascending) and per-state photon fraction.
pub fn solve(w_c: f64, w: &[f64], g: &[f64]) -> Spectrum {
    let se = arrowhead(w_c, w, g).symmetric_eigen();
    // pair each eigenvalue with its eigenvector's photon component (row 0), then sort ascending
    let mut pairs: Vec<(f64, f64)> = se
        .eigenvalues
        .iter()
        .enumerate()
        .map(|(k, &e)| (e, se.eigenvectors[(0, k)].powi(2)))
        .collect();
    pairs.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    Spectrum {
        eigs: pairs.iter().map(|p| p.0).collect(),
        photon_frac: pairs.iter().map(|p| p.1).collect(),
    }
}

/// Eigen-decomposition of the arrowhead for real-time dynamics: ascending eigenvalues + the full
/// eigenvector matrix (row-major, `vecs[i*n + k]` = i-th component of the k-th eigenvector, n=M+1).
/// A state ψ(t) = Σ_k c_k e^{-iE_k t} φ_k is then cheap to evolve in the UI for the live simulation.
pub struct Modes {
    pub eigs: Vec<f64>,
    pub vecs: Vec<f64>,
}

pub fn modes(w_c: f64, w: &[f64], g: &[f64]) -> Modes {
    let n = w.len() + 1;
    let se = arrowhead(w_c, w, g).symmetric_eigen();
    let mut idx: Vec<usize> = (0..n).collect();
    idx.sort_by(|&a, &b| se.eigenvalues[a].partial_cmp(&se.eigenvalues[b]).unwrap_or(std::cmp::Ordering::Equal));
    let mut eigs = Vec::with_capacity(n);
    let mut vecs = vec![0.0; n * n];
    for (col, &k) in idx.iter().enumerate() {
        eigs.push(se.eigenvalues[k]);
        for i in 0..n {
            vecs[i * n + col] = se.eigenvectors[(i, k)];
        }
    }
    Modes { eigs, vecs }
}

/// Deterministic standard normals from a u64 seed (splitmix64 + Box–Muller). Pure Rust, keeps the
/// wasm build dependency-free; used only to draw the live disorder realization (not validation).
pub fn gaussians(seed: u64, n: usize) -> Vec<f64> {
    let mut state = seed;
    let mut next = || {
        state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    };
    let u01 = |x: u64| ((x >> 11) as f64) / ((1u64 << 53) as f64);
    let mut out = Vec::with_capacity(n);
    while out.len() < n {
        let u1 = u01(next()).max(1e-300);
        let u2 = u01(next());
        let r = (-2.0 * u1.ln()).sqrt();
        out.push(r * (2.0 * PI * u2).cos());
        if out.len() < n {
            out.push(r * (2.0 * PI * u2).sin());
        }
    }
    out
}

/// Sweep the coupling g over [g0, g1] in `steps` points (one fixed disorder realization), returning
/// the full (M+1) eigen-energies at each step, flat and row-major by step. Plotting energy vs g gives
/// the polariton dispersion fan: the two bright states split apart as 2g√M while the M−1 dark states
/// stay pinned at the bare emitter energy, the canonical Rabi-splitting-vs-coupling phase map.
pub fn coupling_sweep(w_c: f64, w_a: f64, m: usize, sigma: f64, seed: u64, g0: f64, g1: f64, steps: usize) -> Vec<f64> {
    let z = gaussians(seed, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let mut out = Vec::with_capacity(steps * (m + 1));
    for s in 0..steps {
        let g = if steps <= 1 { g0 } else { g0 + (g1 - g0) * s as f64 / (steps as f64 - 1.0) };
        out.extend_from_slice(&solve(w_c, &w, &vec![g; m]).eigs);
    }
    out
}

/// Live spectrum for M identical-coupling emitters with Gaussian energy disorder.
/// w_i = w_a + sigma·N(0,1)_i  (deterministic from `seed`, so a detuning sweep keeps one realization),
/// g_i = g for all i. Returns the (M+1) eigenvalues + photon fractions.
pub fn disordered_spectrum(w_c: f64, w_a: f64, g: f64, m: usize, sigma: f64, seed: u64) -> Spectrum {
    let z = gaussians(seed, m);
    let w: Vec<f64> = z.iter().map(|zi| w_a + sigma * zi).collect();
    let gg = vec![g; m];
    solve(w_c, &w, &gg)
}
