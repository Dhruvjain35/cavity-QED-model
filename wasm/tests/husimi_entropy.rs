//! Husimi Q-function and von Neumann entropy, validated against exact analytic closed forms
//! (no golden needed): Q of a coherent state is a known Gaussian; S of diag(p,1−p) is −Σ p ln p.

use cqed_core::entropy::von_neumann_entropy;
use cqed_core::operators::CMat;
use cqed_core::wigner::q_function;
use nalgebra::Complex;
use std::f64::consts::{PI, SQRT_2};

/// Coherent state |β⟩ as a density matrix: c_n = e^(−|β|²/2) β^n/√n!, ρ = |β⟩⟨β|.
fn coherent(n: usize, beta: Complex<f64>) -> CMat {
    let pref = (-0.5 * beta.norm_sqr()).exp();
    let mut c = vec![Complex::new(0.0, 0.0); n];
    let (mut p, mut sqrt_fact) = (Complex::new(1.0, 0.0), 1.0_f64);
    for k in 0..n {
        if k > 0 {
            sqrt_fact *= (k as f64).sqrt();
        }
        c[k] = Complex::new(pref, 0.0) * p / sqrt_fact; // e^(−|β|²/2) β^k/√k!
        p *= beta;
    }
    let mut rho = CMat::zeros(n, n);
    for i in 0..n {
        for j in 0..n {
            rho[(i, j)] = c[i] * c[j].conj();
        }
    }
    rho
}

#[test]
fn husimi_matches_analytic_coherent_gaussian() {
    let n = 16;
    let beta = Complex::new(1.0, 0.5);
    let rho = coherent(n, beta);
    let xvec: Vec<f64> = (0..60).map(|i| -5.0 + 10.0 * i as f64 / 59.0).collect();
    let q = q_function(&rho, &xvec, &xvec, SQRT_2);

    let (mut max_err, mut min_q) = (0.0_f64, f64::INFINITY);
    for (r, &y) in xvec.iter().enumerate() {
        for (col, &x) in xvec.iter().enumerate() {
            let alpha = Complex::new(x / SQRT_2, y / SQRT_2); // α = ½g(x+iy), g=√2
            let analytic = (-(alpha - beta).norm_sqr()).exp() / PI; // (1/π) e^(−|α−β|²)
            let got = q[r * xvec.len() + col];
            max_err = max_err.max((got - analytic).abs());
            min_q = min_q.min(got);
        }
    }
    println!("Husimi Q vs analytic coherent: max err = {max_err:.3e}   min Q = {min_q:.3e}");
    assert!(max_err < 1e-6, "Husimi deviates from analytic coherent Gaussian: {max_err:.3e}");
    assert!(min_q >= -1e-12, "Husimi Q went negative ({min_q:.3e}), it must be ≥ 0");
}

#[test]
fn von_neumann_entropy_matches_analytic() {
    let n = 4;
    let p = 0.3;
    // diag(p, 1−p, 0, 0) → S = −p ln p − (1−p) ln(1−p)
    let mut rho = CMat::zeros(n, n);
    rho[(0, 0)] = Complex::new(p, 0.0);
    rho[(1, 1)] = Complex::new(1.0 - p, 0.0);
    let s = von_neumann_entropy(&rho);
    let analytic = -(p * p.ln() + (1.0 - p) * (1.0 - p).ln());
    println!("S(diag(0.3,0.7)) = {s:.10}   analytic = {analytic:.10}");
    assert!((s - analytic).abs() < 1e-10, "von Neumann entropy {s} != analytic {analytic}");

    // pure state → S = 0
    let mut pure = CMat::zeros(n, n);
    pure[(0, 0)] = Complex::new(1.0, 0.0);
    assert!(von_neumann_entropy(&pure).abs() < 1e-10, "pure-state entropy should be 0");
}
