//! Lindblad master-equation solver: adaptive Dormand–Prince (Dopri5) on the density
//! matrix, using the non-Hermitian regrouping (QuantumOptics.jl `dmaster_h!`):
//!
//!   ρ̇ = −i (H_nh ρ − ρ H_nh†) + Σ_i J_i ρ J_i† ,   H_nh = H − (i/2) Σ_i J_i† J_i
//!
//! which is algebraically identical to the GKSL form. ρ is hermitized and renormalized
//! on every accepted step. Validated against the QuTiP `mesolve` golden in
//! `tests/solver_golden.rs`. (Correctness-first: dense matmul; sparse/in-place is a
//! later guarded refactor with that test as the guardrail.)

use crate::operators::{build, Params, CMat, C};
use nalgebra::{Complex, DMatrix};

// ── Dormand–Prince (Dopri5 / RK45) Butcher tableau ────────────────────────────
const A21: f64 = 1.0 / 5.0;
const A31: f64 = 3.0 / 40.0;
const A32: f64 = 9.0 / 40.0;
const A41: f64 = 44.0 / 45.0;
const A42: f64 = -56.0 / 15.0;
const A43: f64 = 32.0 / 9.0;
const A51: f64 = 19372.0 / 6561.0;
const A52: f64 = -25360.0 / 2187.0;
const A53: f64 = 64448.0 / 6561.0;
const A54: f64 = -212.0 / 729.0;
const A61: f64 = 9017.0 / 3168.0;
const A62: f64 = -355.0 / 33.0;
const A63: f64 = 46732.0 / 5247.0;
const A64: f64 = 49.0 / 176.0;
const A65: f64 = -5103.0 / 18656.0;
// 5th-order solution weights (b2 = b7 = 0)
const B1: f64 = 35.0 / 384.0;
const B3: f64 = 500.0 / 1113.0;
const B4: f64 = 125.0 / 192.0;
const B5: f64 = -2187.0 / 6784.0;
const B6: f64 = 11.0 / 84.0;
// error weights E_i = b_i − b*_i (embedded 4th order)
const E1: f64 = 35.0 / 384.0 - 5179.0 / 57600.0;
const E3: f64 = 500.0 / 1113.0 - 7571.0 / 16695.0;
const E4: f64 = 125.0 / 192.0 - 393.0 / 640.0;
const E5: f64 = -2187.0 / 6784.0 + 92097.0 / 339200.0;
const E6: f64 = 11.0 / 84.0 - 187.0 / 2100.0;
const E7: f64 = -1.0 / 40.0;

const NEG_I: C = Complex { re: 0.0, im: -1.0 };

pub struct Solver {
    pub dim: usize,
    h_nh: CMat,
    h_nh_dag: CMat,
    jumps: Vec<CMat>,
    jumps_dag: Vec<CMat>,
    num: CMat,
    pe: CMat,
}

impl Solver {
    pub fn new(p: &Params) -> Self {
        let ops = build(p);
        let dim = p.n_fock * 2;
        let mut sum_jdj = CMat::zeros(dim, dim);
        for j in &ops.c_ops {
            sum_jdj += j.adjoint() * j;
        }
        // H_nh = H − (i/2) Σ J†J
        let h_nh = &ops.h - sum_jdj.map(|x| x * Complex::new(0.0, 0.5));
        let h_nh_dag = h_nh.adjoint();
        let jumps_dag = ops.c_ops.iter().map(|j| j.adjoint()).collect();
        Solver {
            dim,
            h_nh,
            h_nh_dag,
            jumps: ops.c_ops,
            jumps_dag,
            num: ops.num,
            pe: ops.p_e,
        }
    }

    /// ρ̇ = −i(H_nh ρ − ρ H_nh†) + Σ J ρ J†.
    pub fn rhs(&self, rho: &CMat) -> CMat {
        let hr = &self.h_nh * rho;
        let rh = rho * &self.h_nh_dag;
        let mut out = (&hr - &rh).map(|x| x * NEG_I);
        for (j, jd) in self.jumps.iter().zip(self.jumps_dag.iter()) {
            let jr = j * rho;
            out = out + &jr * jd;
        }
        out
    }

    /// One Dopri5 step; returns (5th-order state, scaled-RMS error norm).
    fn dopri_step(&self, y: &CMat, dt: f64, atol: f64, rtol: f64) -> (CMat, f64) {
        let k1 = self.rhs(y);
        let k2 = self.rhs(&(y + k1.scale(dt * A21)));
        let k3 = self.rhs(&(y + k1.scale(dt * A31) + k2.scale(dt * A32)));
        let k4 = self.rhs(&(y + k1.scale(dt * A41) + k2.scale(dt * A42) + k3.scale(dt * A43)));
        let k5 = self.rhs(
            &(y + k1.scale(dt * A51) + k2.scale(dt * A52) + k3.scale(dt * A53) + k4.scale(dt * A54)),
        );
        let k6 = self.rhs(
            &(y + k1.scale(dt * A61)
                + k2.scale(dt * A62)
                + k3.scale(dt * A63)
                + k4.scale(dt * A64)
                + k5.scale(dt * A65)),
        );
        let y5 = y + k1.scale(dt * B1) + k3.scale(dt * B3) + k4.scale(dt * B4)
            + k5.scale(dt * B5)
            + k6.scale(dt * B6);
        let k7 = self.rhs(&y5); // FSAL: a7 = b
        let err_mat = k1.scale(dt * E1) + k3.scale(dt * E3) + k4.scale(dt * E4)
            + k5.scale(dt * E5)
            + k6.scale(dt * E6)
            + k7.scale(dt * E7);

        let mut sumsq = 0.0;
        for r in 0..self.dim {
            for col in 0..self.dim {
                let sc = atol + rtol * y[(r, col)].norm().max(y5[(r, col)].norm());
                let e = err_mat[(r, col)].norm() / sc;
                sumsq += e * e;
            }
        }
        let err = (sumsq / (self.dim * self.dim) as f64).sqrt();
        (y5, err)
    }

    /// Adaptively advance ρ from t0 to t1. Hermitizes + renormalizes each accepted
    /// step. Returns the suggested next natural step size.
    pub fn integrate(
        &self,
        rho: &mut CMat,
        t0: f64,
        t1: f64,
        atol: f64,
        rtol: f64,
        dt_init: f64,
    ) -> f64 {
        let mut t = t0;
        let mut dt = dt_init.max(1e-8);
        let mut iters = 0u64;
        while t < t1 - 1e-12 {
            let h = dt.min(t1 - t);
            let (y5, err) = self.dopri_step(rho, h, atol, rtol);
            if err <= 1.0 {
                *rho = y5;
                hermitize_renorm(rho);
                t += h;
                dt = (h * (0.9 * err.max(1e-12).powf(-0.2)).clamp(0.2, 5.0)).max(1e-8);
            } else {
                dt = (h * (0.9 * err.powf(-0.2)).max(0.2)).max(1e-8);
            }
            iters += 1;
            assert!(iters < 1_000_000, "integrator stalled at t={t}");
        }
        dt
    }

    pub fn expect(&self, op: &CMat, rho: &CMat) -> f64 {
        (op * rho).trace().re
    }
    pub fn expect_num(&self, rho: &CMat) -> f64 {
        self.expect(&self.num, rho)
    }
    pub fn expect_pe(&self, rho: &CMat) -> f64 {
        self.expect(&self.pe, rho)
    }

    /// Smallest eigenvalue of a Hermitian ρ, via the real symmetric embedding
    /// M = [[Re, −Im],[Im, Re]] (eigenvalues of M = eigenvalues of ρ, each twice).
    pub fn min_eigenvalue(rho: &CMat) -> f64 {
        let d = rho.nrows();
        let mut m = DMatrix::<f64>::zeros(2 * d, 2 * d);
        for i in 0..d {
            for j in 0..d {
                let z = rho[(i, j)];
                m[(i, j)] = z.re;
                m[(i + d, j + d)] = z.re;
                m[(i, j + d)] = -z.im;
                m[(i + d, j)] = z.im;
            }
        }
        // eigenvalues-only path (tridiagonal symmetric QR); filter any non-finite
        // values the solver may emit on the heavily-degenerate spectrum of a pure state.
        m.symmetric_eigenvalues()
            .iter()
            .cloned()
            .filter(|x| x.is_finite())
            .fold(f64::INFINITY, f64::min)
    }
}

/// ρ ← (ρ + ρ†)/2 then ρ ← ρ / Tr(ρ).  Run on every ACCEPTED integrator step.
pub fn hermitize_renorm(rho: &mut CMat) {
    let herm = (&*rho + rho.adjoint()).scale(0.5);
    let tr = herm.trace().re;
    *rho = herm.scale(1.0 / tr);
}
