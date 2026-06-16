//! Lindblad solver validation against the QuTiP `mesolve` golden.
//! Asserts the three acceptance metrics:
//!   - time-series ⟨a†a⟩(t), ⟨P_e⟩(t)  vs QuTiP, max abs error < 1e-6
//!   - Tr(ρ) = 1 to 1e-12 at the time horizon
//!   - eigenvalues of ρ ≥ −1e-8 across the whole series (positivity)
//! plus a long-run drift test out to 10× the horizon.

mod common;
use common::load;
use cqed_core::operators::CMat;
use cqed_core::solver::{hermitize_renorm, Solver};

const ATOL: f64 = 1e-10;
const RTOL: f64 = 1e-10;

#[test]
fn dynamics_match_qutip_mesolve() {
    let g = load();
    let solver = Solver::new(&g.params());
    let mut rho: CMat = g.psi0.to_rho();

    let tl = &g.dynamics.tlist;
    let snap_idx: &[usize] = &g.dynamics.rho_snapshots.indices;
    let mut snaps: Vec<(usize, CMat)> = Vec::new();

    let mut max_n_err = 0.0_f64;
    let mut max_pe_err = 0.0_f64;
    let mut min_eig = f64::INFINITY;
    let mut dt = 0.01;

    for i in 0..tl.len() {
        if i > 0 {
            dt = solver.integrate(&mut rho, tl[i - 1], tl[i], ATOL, RTOL, dt);
        }
        max_n_err = max_n_err.max((solver.expect_num(&rho) - g.dynamics.n_t[i]).abs());
        max_pe_err = max_pe_err.max((solver.expect_pe(&rho) - g.dynamics.pe_t[i]).abs());
        min_eig = min_eig.min(Solver::min_eigenvalue(&rho));
        if snap_idx.contains(&i) {
            snaps.push((i, rho.clone()));
        }
    }

    // ρ-snapshot element-wise error vs QuTiP states
    let mut max_rho_err = 0.0_f64;
    for (i, rho_i) in &snaps {
        let pos = snap_idx.iter().position(|x| x == i).unwrap();
        let gold = g.dynamics.rho_snapshots.rho[pos].to_cmat();
        for r in 0..rho_i.nrows() {
            for c in 0..rho_i.ncols() {
                let z = rho_i[(r, c)] - gold[(r, c)];
                max_rho_err = max_rho_err.max(z.norm());
            }
        }
    }
    let trace_end = rho.trace().re;

    println!("Lindblad solver vs QuTiP mesolve (atol=rtol={ATOL:.0e}):");
    println!("  max |⟨a†a⟩_rust − ⟨a†a⟩_qutip| = {max_n_err:.3e}   (bar < 1e-6)");
    println!("  max |⟨P_e⟩_rust − ⟨P_e⟩_qutip|  = {max_pe_err:.3e}   (bar < 1e-6)");
    println!("  max ρ-snapshot element error    = {max_rho_err:.3e}");
    println!("  min eigenvalue over series      = {min_eig:.3e}   (bar ≥ −1e-8)");
    println!("  Tr(ρ) at horizon                = {trace_end:.13}   (bar |Tr−1| < 1e-12)");

    assert!(max_n_err < 1e-6, "⟨a†a⟩(t) deviates {max_n_err:.3e} ≥ 1e-6");
    assert!(max_pe_err < 1e-6, "⟨P_e⟩(t) deviates {max_pe_err:.3e} ≥ 1e-6");
    assert!(max_rho_err < 1e-6, "ρ snapshots deviate {max_rho_err:.3e} ≥ 1e-6");
    assert!(min_eig > -1e-8, "positivity violated: min eig {min_eig:.3e}");
    assert!((trace_end - 1.0).abs() < 1e-12, "trace not conserved: {trace_end}");
}

#[test]
fn long_run_drift_to_10x_horizon() {
    let g = load();
    let solver = Solver::new(&g.params());
    let mut rho: CMat = g.psi0.to_rho();

    let t_end = g.dynamics.tlist.last().unwrap() * 10.0; // 10× the horizon
    let mut min_eig = f64::INFINITY;
    let mut dt = 0.01;
    let mut t = 0.0;
    let step = t_end / 400.0;
    while t < t_end - 1e-9 {
        dt = solver.integrate(&mut rho, t, t + step, ATOL, RTOL, dt);
        t += step;
        min_eig = min_eig.min(Solver::min_eigenvalue(&rho));
    }
    // also force a final clean-up read
    hermitize_renorm(&mut rho);
    let trace = rho.trace().re;
    println!("Drift test to t={t_end} (10× horizon): Tr(ρ)={trace:.13}, min eig={min_eig:.3e}");
    assert!((trace - 1.0).abs() < 1e-12, "long-run trace drift: {trace}");
    assert!(min_eig > -1e-8, "long-run positivity violated: {min_eig:.3e}");
}
