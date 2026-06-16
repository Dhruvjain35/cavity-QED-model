//! THE convention lock. Builds every JC operator in Rust and asserts element-wise
//! agreement with the QuTiP golden (../golden/golden.json) to 1e-12. If this passes,
//! the tensor order, signs, and dissipator form match QuTiP bit-for-bit — every
//! downstream check (dynamics, Wigner, steady state) then rests on solid ground.

use cqed_core::operators::{build, CMat, Params};
use serde::Deserialize;

#[derive(Deserialize)]
struct Mat {
    shape: Vec<usize>,
    re: Vec<Vec<f64>>,
    im: Vec<Vec<f64>>,
}

#[derive(Deserialize)]
struct GParams {
    #[serde(rename = "N")] n: usize,
    w_c: f64,
    w_a: f64,
    g: f64,
    kappa: f64,
    gamma: f64,
    gamma_phi: f64,
}

#[derive(Deserialize)]
struct GOps {
    a: Mat,
    adag_a: Mat,
    sm: Mat,
    sp: Mat,
    sz: Mat,
    #[serde(rename = "P_e")] p_e: Mat,
    #[serde(rename = "H")] h: Mat,
    c_ops: Vec<Mat>,
}

#[derive(Deserialize)]
struct Golden {
    params: GParams,
    operators: GOps,
}

fn load() -> Golden {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/golden/golden.json");
    let txt = std::fs::read_to_string(path)
        .unwrap_or_else(|_| panic!("golden not found at {path} — run golden/gen_golden.py"));
    serde_json::from_str(&txt).expect("golden JSON parse")
}

const TOL: f64 = 1e-12;

/// Assert a Rust complex matrix equals a QuTiP golden matrix element-wise.
fn assert_match(name: &str, rust: &CMat, gold: &Mat) {
    assert_eq!(
        (rust.nrows(), rust.ncols()),
        (gold.shape[0], gold.shape[1]),
        "{name}: shape mismatch"
    );
    let mut max_err = 0.0_f64;
    for r in 0..rust.nrows() {
        for col in 0..rust.ncols() {
            let z = rust[(r, col)];
            let dre = (z.re - gold.re[r][col]).abs();
            let dim = (z.im - gold.im[r][col]).abs();
            max_err = max_err.max(dre).max(dim);
            assert!(
                dre < TOL && dim < TOL,
                "{name}: element ({r},{col}) Rust=({:.15},{:.15}) QuTiP=({:.15},{:.15})",
                z.re, z.im, gold.re[r][col], gold.im[r][col]
            );
        }
    }
    println!("  ✓ {name:<8} matches QuTiP (max element error {max_err:.2e})");
}

#[test]
fn operators_match_qutip_bit_for_bit() {
    let golden = load();
    let p = Params {
        n_fock: golden.params.n,
        w_c: golden.params.w_c,
        w_a: golden.params.w_a,
        g: golden.params.g,
        kappa: golden.params.kappa,
        gamma: golden.params.gamma,
        gamma_phi: golden.params.gamma_phi,
    };
    let ops = build(&p);
    let g = &golden.operators;

    println!("Convention lock — Rust vs QuTiP {}, dim {}:", "5.3.0", 2 * p.n_fock);
    assert_match("a", &ops.a, &g.a);
    assert_match("a†a", &ops.num, &g.adag_a);
    assert_match("sm", &ops.sm, &g.sm);
    assert_match("sp", &ops.sp, &g.sp);
    assert_match("sz", &ops.sz, &g.sz);
    assert_match("P_e", &ops.p_e, &g.p_e);
    assert_match("H", &ops.h, &g.h);
    assert_eq!(ops.c_ops.len(), g.c_ops.len(), "c_ops count mismatch");
    for (i, (ru, go)) in ops.c_ops.iter().zip(g.c_ops.iter()).enumerate() {
        assert_match(&format!("c_op[{i}]"), ru, go);
    }
}

#[test]
fn hamiltonian_is_hermitian() {
    let golden = load();
    let p = Params {
        n_fock: golden.params.n, w_c: golden.params.w_c, w_a: golden.params.w_a, g: golden.params.g,
        kappa: golden.params.kappa, gamma: golden.params.gamma, gamma_phi: golden.params.gamma_phi,
    };
    let h = build(&p).h;
    let diff = (&h - h.adjoint()).norm();
    assert!(diff < 1e-12, "H not Hermitian: ||H - H†|| = {diff:.2e}");
}
