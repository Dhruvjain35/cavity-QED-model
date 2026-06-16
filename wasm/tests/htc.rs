//! HTC validation. The decisive check: with the cavity decoupled (g=0) the matrix-diagonalized
//! absorption spectrum must reproduce the analytic displaced-oscillator Franck–Condon progression
//! I_n = e^{−S}S^n/n! at ω = ω_x − Sω_v + nω_v (S = λ²). Also the λ=0 limit gives the bare vacuum-Rabi
//! doublet ω_c ± g in the lowest phonon sector.

use cqed_core::htc::{franck_condon, htc, htc_multi};

#[test]
fn htc_g0_reproduces_franck_condon_progression() {
    let (w_c, w_x, w_v, lambda, n_vib) = (1.0, 1.0, 0.2, 1.0, 30); // S = λ² = 1
    let r = htc(w_c, w_x, w_v, lambda, 0.0, n_vib); // g = 0 (cavity decoupled)
    let (fc_pos, fc_wt) = franck_condon(w_x, w_v, lambda, 8);
    for n in 0..6 {
        // the excited-block eigenstate whose energy matches FC peak n
        let mut best = 0usize;
        let mut bd = f64::INFINITY;
        for k in 0..r.eigs.len() {
            let d = (r.eigs[k] - fc_pos[n]).abs();
            if d < bd && r.absorption[k] > 1e-7 {
                bd = d;
                best = k;
            }
        }
        println!("n={n}  E={:.5} (FC {:.5})   A={:.6} (FC {:.6})", r.eigs[best], fc_pos[n], r.absorption[best], fc_wt[n]);
        assert!((r.eigs[best] - fc_pos[n]).abs() < 1e-4, "FC peak {n} position {:.5} != {:.5}", r.eigs[best], fc_pos[n]);
        assert!((r.absorption[best] - fc_wt[n]).abs() < 1e-4, "FC peak {n} weight {:.6} != {:.6}", r.absorption[best], fc_wt[n]);
    }
    // sum rule: total absorption = 1 (single electronic transition, Condon)
    let total: f64 = r.absorption.iter().sum();
    assert!((total - 1.0).abs() < 1e-9, "absorption sum {total} != 1");
}

#[test]
fn htc_multi_n1_equals_single_molecule() {
    // the explicit N-body builder at N=1 must be byte-for-byte the validated single-molecule HTC
    let (wc, wx, wv, lam, g, nv) = (1.0, 1.0, 0.2, 1.0, 0.05, 16);
    let a = htc(wc, wx, wv, lam, g, nv);
    let b = htc_multi(wc, wx, wv, lam, g, 1, nv);
    assert_eq!(a.eigs.len(), b.eigs.len());
    for k in 0..a.eigs.len() {
        assert!((a.eigs[k] - b.eigs[k]).abs() < 1e-9, "eig {k}: {} vs {}", a.eigs[k], b.eigs[k]);
        assert!((a.absorption[k] - b.absorption[k]).abs() < 1e-9, "abs {k}: {} vs {}", a.absorption[k], b.absorption[k]);
    }
}

#[test]
fn htc_multi_lambda0_collective_vacuum_rabi() {
    // λ=0, N identical molecules, uniform g → the lower polariton sits at ω_c − g√N, 50% photon
    let (wc, wv, g, nv, n) = (1.0, 0.25, 0.05, 4, 3);
    let r = htc_multi(wc, wc, wv, 0.0, g, n, nv);
    let lp = r.eigs[0]; // global minimum = lower polariton of the vib-0 manifold
    let expect = wc - g * (n as f64).sqrt();
    println!("LP = {lp:.6}  ω_c − g√N = {expect:.6}  photon_frac = {:.4}", r.photon_frac[0]);
    assert!((lp - expect).abs() < 1e-9, "LP {lp} != ω_c − g√N {expect}");
    assert!((r.photon_frac[0] - 0.5).abs() < 1e-6, "LP photon fraction {} != 0.5", r.photon_frac[0]);
}

#[test]
fn htc_lambda0_gives_bare_vacuum_rabi() {
    let (w0, w_v, g, n_vib) = (1.0, 0.2, 0.05, 12);
    let r = htc(w0, w0, w_v, 0.0, g, n_vib); // no vibronic coupling → decoupled phonon sectors
    // the n_v=0 sector is a bare 2-level: eigenvalues ω0 ± g, each 50% photon
    let lp = r.eigs.iter().cloned().fold(f64::INFINITY, f64::min);
    let up = w0 + g;
    let lower = w0 - g;
    assert!(r.eigs.iter().any(|&e| (e - up).abs() < 1e-9), "missing upper polariton ω0+g");
    assert!((lp - lower).abs() < 1e-9, "lowest eigenvalue {lp} != ω0−g {lower}");
}
