//! Arrowhead spectrum (Regime 2) validation against the numpy `eigh` golden.
//!   - eigenvalues + photon fractions match numpy element-wise for identical/detuned/disordered cases
//!   - identical resonant emitters give the 2g√M splitting and exactly M−1 zero-photon dark states

use cqed_core::spectrum::{modes, solve};
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
struct Case {
    label: String,
    wc: f64,
    w: Vec<f64>,
    g: Vec<f64>,
    eigs: Vec<f64>,
    photon_frac: Vec<f64>,
}
#[derive(Deserialize)]
struct Golden {
    cases: Vec<Case>,
}

fn load() -> Golden {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/golden/spectrum_golden.json");
    serde_json::from_str(&fs::read_to_string(path).expect("spectrum_golden.json")).unwrap()
}

#[test]
fn arrowhead_matches_numpy_eigh() {
    let g = load();
    for c in &g.cases {
        let s = solve(c.wc, &c.w, &c.g);
        assert_eq!(s.eigs.len(), c.eigs.len());
        let mut max_e = 0.0_f64;
        let mut max_p = 0.0_f64;
        for k in 0..c.eigs.len() {
            max_e = max_e.max((s.eigs[k] - c.eigs[k]).abs());
            // photon fraction is basis-independent (dark states are 0 in any degenerate basis)
            max_p = max_p.max((s.photon_frac[k] - c.photon_frac[k]).abs());
        }
        println!("{:22} max|Δeig| = {max_e:.2e}   max|Δphoton| = {max_p:.2e}", c.label);
        assert!(max_e < 1e-10, "{}: eigenvalues deviate {max_e:.2e}", c.label);
        assert!(max_p < 1e-9, "{}: photon fractions deviate {max_p:.2e}", c.label);
    }
}

#[test]
fn identical_resonant_gives_2g_sqrt_m_split_and_m_minus_1_dark() {
    let (m, g, w0) = (4usize, 0.1, 1.0);
    let s = solve(w0, &vec![w0; m], &vec![g; m]);

    let split = s.eigs[m] - s.eigs[0];
    let expect = 2.0 * g * (m as f64).sqrt();
    println!("collective splitting = {split:.6}   2g√M = {expect:.6}");
    assert!((split - expect).abs() < 1e-12, "splitting {split} != 2g√M {expect}");

    // exactly M−1 dark states at the bare energy, each with zero photon weight
    let dark: Vec<usize> = (0..s.eigs.len()).filter(|&k| (s.eigs[k] - w0).abs() < 1e-9).collect();
    assert_eq!(dark.len(), m - 1, "expected M−1 dark states, got {}", dark.len());
    for &k in &dark {
        assert!(s.photon_frac[k] < 1e-9, "dark state carries photon weight {}", s.photon_frac[k]);
    }
    // the two bright polaritons are 50/50 photon/matter on resonance
    assert!((s.photon_frac[0] - 0.5).abs() < 1e-9 && (s.photon_frac[m] - 0.5).abs() < 1e-9);
}

#[test]
fn vacuum_rabi_oscillation_matches_analytic() {
    // 1 photon into M identical resonant molecules → the cavity population is the exact
    // single-excitation vacuum-Rabi law pop_cav(t) = cos²(g√M·t). Reconstruct ψ(t) from the modes.
    let (m, g, w0) = (6usize, 0.08, 1.0);
    let md = modes(w0, &vec![w0; m], &vec![g; m]);
    let n = m + 1;
    for &t in &[0.0, 1.0, 2.5, 5.0, 9.3, 14.7] {
        let (mut re, mut im) = (0.0_f64, 0.0_f64);
        for k in 0..n {
            let v0 = md.vecs[k]; // V[0][k] = cavity component of eigenvector k (row 0)
            let amp = v0 * v0; // c_k·V[0][k], with c_k = ⟨φ_k|ψ0⟩ = V[0][k] for ψ0 = |cavity⟩
            re += amp * (md.eigs[k] * t).cos();
            im -= amp * (md.eigs[k] * t).sin();
        }
        let pop = re * re + im * im;
        let analytic = (g * (m as f64).sqrt() * t).cos().powi(2);
        assert!((pop - analytic).abs() < 1e-9, "Rabi pop_cav {pop:.6} != cos²(g√M·t) {analytic:.6} at t={t}");
    }
}
