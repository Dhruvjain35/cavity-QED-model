//! Wigner Clenshaw port validation against the QuTiP `wigner` golden.
//!   - element-wise match to QuTiP for a coherent state AND a Schrödinger-cat state, ≤ 1e-4
//!   - the cat-state interference fringes reproduce the negativity (≈ −0.233) — this is the
//!     case that catches the off-diagonal ×2 scale bug (fringes halve if dropped)
//!   - ∫∫ W dx dy = 1 for both (catches a broken g=√2 / normalization factor)

mod common;
use common::load;
use cqed_core::operators::CMat;
use cqed_core::wigner::{integrate_grid, partial_trace_atom, wigner_to_rgba, WignerGrid};
use nalgebra::Complex;
use std::f64::consts::{PI, SQRT_2};

#[test]
fn vacuum_wigner_renders_rdbu_neutral_background() {
    // cavity vacuum |0><0| → a positive Gaussian peak at the origin on a flat W≈0 field.
    let nf = 16;
    let mut rho = CMat::zeros(nf, nf);
    rho[(0, 0)] = Complex::new(1.0, 0.0);
    let xvec: Vec<f64> = (0..100).map(|i| -5.0 + 10.0 * i as f64 / 99.0).collect();
    let w = WignerGrid::new(&xvec, &xvec, SQRT_2).compute(&rho);
    let rgba = wigner_to_rgba(&w, 1.0 / PI); // fixed physical scale [-1/π, +1/π]

    let px = |i: usize| (rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    let corner = px(0); // (x=-5, y=-5), W≈0
    let center = px(50 * 100 + 50); // near origin, W>0
    println!("vacuum: corner rgb={corner:?} (want 247,247,247)  center rgb={center:?} (want deep blue)");

    // The gate: zero-field background is the RdBu neutral midpoint #F7F7F7, NOT pure white.
    // (Verified vs matplotlib _cm.py / colorbrewer2.org; QuTiP plot_wigner's actual default.)
    assert_eq!(corner, (247, 247, 247), "vacuum background is not the RdBu neutral gray");
    // positive-W center is deep blue under the symmetric norm: r < g < b, well away from gray.
    assert!(center.0 < center.1 && center.1 < center.2, "vacuum center not bluish: {center:?}");
    assert!(center.2 > 80 && center.0 < 40, "vacuum center not deep blue: {center:?}");
}

#[test]
fn partial_trace_matches_qutip() {
    let g = load();
    let full = g.dynamics.rho_snapshots.rho.last().unwrap().to_cmat();
    let rc = partial_trace_atom(&full, g.params.n);
    let gold = g.ptrace_check.rho_c_end.to_cmat();
    let mut max_err = 0.0_f64;
    for r in 0..g.params.n {
        for c in 0..g.params.n {
            max_err = max_err.max((rc[(r, c)] - gold[(r, c)]).norm());
        }
    }
    println!("partial_trace_atom vs QuTiP ptrace(0): max elem err = {max_err:.3e}");
    assert!(max_err < 1e-12, "partial trace deviates {max_err:.3e}");
}

fn grid_stats(rust: &[f64], gold: &[Vec<f64>], nx: usize) -> (f64, f64) {
    let mut max_err = 0.0_f64;
    let mut min_val = f64::INFINITY;
    for r in 0..nx {
        for col in 0..nx {
            let got = rust[r * nx + col];
            max_err = max_err.max((got - gold[r][col]).abs());
            min_val = min_val.min(got);
        }
    }
    (max_err, min_val)
}

#[test]
fn wigner_matches_qutip() {
    let g = load();
    let w = &g.wigner;
    let nx = w.xvec.len();
    let dx = w.xvec[1] - w.xvec[0];
    let grid = WignerGrid::new(&w.xvec, &w.xvec, w.g);

    // coherent state
    let wc = grid.compute(&w.coherent.rho.to_cmat());
    let (err_coh, _) = grid_stats(&wc, &w.coherent.w, nx);
    let int_coh = integrate_grid(&wc, dx, dx);

    // Schrödinger cat |α> + |−α>
    let wcat = grid.compute(&w.cat.rho.to_cmat());
    let (err_cat, min_cat) = grid_stats(&wcat, &w.cat.w, nx);
    let int_cat = integrate_grid(&wcat, dx, dx);
    let gold_cat_min = w.cat.w.iter().flatten().cloned().fold(f64::INFINITY, f64::min);

    println!("Wigner Clenshaw port vs QuTiP (g=√2, {nx}×{nx} grid):");
    println!("  coherent: max elem err = {err_coh:.3e}   ∫∫W = {int_coh:.6}");
    println!("  cat:      max elem err = {err_cat:.3e}   ∫∫W = {int_cat:.6}");
    println!("  cat negativity: rust min = {min_cat:.4}   QuTiP min = {gold_cat_min:.4}");

    assert!(err_coh < 1e-4, "coherent Wigner deviates {err_coh:.3e} ≥ 1e-4");
    assert!(err_cat < 1e-4, "cat Wigner deviates {err_cat:.3e} ≥ 1e-4");
    // the fringe negativity must match QuTiP (proves the off-diagonal ×2 factor is right)
    assert!(
        (min_cat - gold_cat_min).abs() < 1e-4,
        "cat negativity {min_cat:.5} != QuTiP {gold_cat_min:.5} (off-diagonal scale bug?)"
    );
    assert!(min_cat < -0.2, "cat fringes not negative enough: {min_cat:.4}");
    // quasiprobability normalization
    assert!((int_coh - 1.0).abs() < 1e-2, "coherent ∫∫W = {int_coh} ≠ 1");
    assert!((int_cat - 1.0).abs() < 1e-2, "cat ∫∫W = {int_cat} ≠ 1");
}
