//! Single-molecule Holstein–Tavis–Cummings (HTC): one cavity mode + one two-level emitter + one local
//! vibration (phonon). In the single-excitation electronic sector with a truncated vibrational ladder
//! the Hamiltonian is a `2·n_vib` real-symmetric matrix — exactly diagonalizable.
//!
//! Grounded in Mandal, Taylor, Weight, Koessler, Li & Huo, *Chem. Rev.* 2023, 123, 9786 (HTC model
//! eq 103 §1; displaced-oscillator / polaron transformation §6.3; 1/N polaron decoupling §6.4):
//!     H = ω_c a†a + ω_x σ†σ + ω_v b†b + λω_v σ†σ(b+b†) + g(a†σ + aσ†).
//! λ is the DIMENSIONLESS Holstein coupling = √(Huang–Rhys S), so S = λ², reorganization energy
//! E_r = Sω_v, and the excited 0-0 origin is polaron-shifted to ω_x − Sω_v. Validated in tests/htc.rs
//! against the analytic g→0 Franck–Condon progression I_n = e^{−S}S^n/n!.
//!
//! Basis (size 2·n_vib): indices 0..n_vib  = |1 photon, electronic-ground, n_v phonons⟩ (Holstein OFF,
//! ground electronic); indices n_vib..2n_vib = |0 photon, electronic-excited, n_v phonons⟩ (Holstein ON).

use nalgebra::DMatrix;

pub struct Htc {
    pub eigs: Vec<f64>,        // ascending eigenvalues
    pub photon_frac: Vec<f64>, // Σ_{j<n_vib} v[j]²  (cavity-photon weight of each polariton/vibronic state)
    pub absorption: Vec<f64>,  // |v[n_vib]|²  — Condon dipole onto |excited, n_v=0⟩ (the absorption stick)
}

/// Build and exact-diagonalize the single-molecule HTC matrix. `lambda` dimensionless (=√S);
/// `n_vib` ≳ 4 + 3·S for convergence.
pub fn htc(w_c: f64, w_x: f64, w_v: f64, lambda: f64, g: f64, n_vib: usize) -> Htc {
    let dim = 2 * n_vib;
    let mut h = DMatrix::zeros(dim, dim);
    // photon block |photon, n_v⟩ — electronic ground, Holstein term off (carries σ†σ)
    for j in 0..n_vib {
        h[(j, j)] = w_c + j as f64 * w_v;
    }
    // excited block |excited, n_v⟩ — electronic energy + oscillator + Holstein ladder λω_v√(n+1)
    for n in 0..n_vib {
        let e = n_vib + n;
        h[(e, e)] = w_x + n as f64 * w_v;
        if n + 1 < n_vib {
            let c = lambda * w_v * ((n + 1) as f64).sqrt();
            h[(e, e + 1)] = c;
            h[(e + 1, e)] = c;
        }
    }
    // Tavis–Cummings light–matter: |photon, n_v⟩ ↔ |excited, n_v⟩ — phonon-diagonal (photon ⊥ phonon)
    for j in 0..n_vib {
        h[(j, n_vib + j)] = g;
        h[(n_vib + j, j)] = g;
    }
    let se = h.symmetric_eigen();
    let mut idx: Vec<usize> = (0..dim).collect();
    idx.sort_by(|&a, &b| se.eigenvalues[a].partial_cmp(&se.eigenvalues[b]).unwrap_or(std::cmp::Ordering::Equal));
    let mut eigs = Vec::with_capacity(dim);
    let mut photon_frac = Vec::with_capacity(dim);
    let mut absorption = Vec::with_capacity(dim);
    for &k in &idx {
        eigs.push(se.eigenvalues[k]);
        let mut pf = 0.0;
        for j in 0..n_vib {
            pf += se.eigenvectors[(j, k)].powi(2);
        }
        photon_frac.push(pf);
        absorption.push(se.eigenvectors[(n_vib, k)].powi(2)); // |⟨excited,0|ψ_k⟩|²
    }
    Htc { eigs, photon_frac, absorption }
}

/// Analytic bare-molecule (g=0) Franck–Condon progression — the validation oracle. Peaks at
/// ω_x − Sω_v + nω_v with Poisson weights I_n = e^{−S}S^n/n! (S = λ²), computed iteratively.
pub fn franck_condon(w_x: f64, w_v: f64, lambda: f64, n_max: usize) -> (Vec<f64>, Vec<f64>) {
    let s = lambda * lambda;
    let mut pos = Vec::with_capacity(n_max);
    let mut wt = Vec::with_capacity(n_max);
    let mut w = (-s).exp(); // I_0 = e^{−S}
    for n in 0..n_max {
        pos.push(w_x - s * w_v + n as f64 * w_v);
        wt.push(w);
        w *= s / (n as f64 + 1.0); // I_{n+1} = I_n · S/(n+1)
    }
    (pos, wt)
}
