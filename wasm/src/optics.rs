//! Transfer-matrix method (TMM) for a 1D multilayer optical cavity at normal incidence.
//!
//! Computes the reflectance and the |E(z)|² field profile of a distributed-Bragg-reflector (DBR)
//! cavity, the real physics behind the cavity cross-section visual: a standing-wave antinode in
//! the spacer that decays into the mirror stacks. Uses the standard interface + propagation 2×2
//! matrices (forward/backward field amplitudes). Validated against exact analytic benchmarks
//! (Fresnel single interface, quarter-wave anti-reflection / high-reflector) in `tests/optics.rs`.

use nalgebra::{Complex, Matrix2, Vector2};
use std::f64::consts::PI;

type C = Complex<f64>;

/// One layer: refractive index `n` and physical thickness `d_nm` (nanometres).
#[derive(Clone, Copy)]
pub struct Layer {
    pub n: f64,
    pub d_nm: f64,
}

/// Interface matrix from medium `na` into medium `nb`: I = (1/t)·[[1, r],[r, 1]],
/// r = (na−nb)/(na+nb), t = 2na/(na+nb).
fn interface(na: f64, nb: f64) -> Matrix2<C> {
    let r = (na - nb) / (na + nb);
    let t = 2.0 * na / (na + nb);
    Matrix2::new(C::new(1.0 / t, 0.0), C::new(r / t, 0.0), C::new(r / t, 0.0), C::new(1.0 / t, 0.0))
}

/// Propagation matrix through a layer: P = diag(e^{−iφ}, e^{+iφ}), φ = 2π n d / λ.
fn propagate(n: f64, d_nm: f64, lambda: f64) -> Matrix2<C> {
    let phi = 2.0 * PI * n * d_nm / lambda;
    Matrix2::new(C::new(0.0, -phi).exp(), C::new(0.0, 0.0), C::new(0.0, 0.0), C::new(0.0, phi).exp())
}

/// Total system matrix M with [E0⁺;E0⁻] = M·[Es⁺;Es⁻] for incident index `n0`, substrate `ns`.
fn system_matrix(stack: &[Layer], lambda: f64, n0: f64, ns: f64) -> Matrix2<C> {
    let first = if stack.is_empty() { ns } else { stack[0].n };
    let mut m = interface(n0, first);
    for (i, l) in stack.iter().enumerate() {
        m = m * propagate(l.n, l.d_nm, lambda);
        let n_next = if i + 1 < stack.len() { stack[i + 1].n } else { ns };
        m = m * interface(l.n, n_next);
    }
    m
}

/// Power reflectance R = |S21/S11|² of the stack at wavelength `lambda` (nm).
pub fn reflectance(stack: &[Layer], lambda: f64, n0: f64, ns: f64) -> f64 {
    let m = system_matrix(stack, lambda, n0, ns);
    (m[(1, 0)] / m[(0, 0)]).norm_sqr()
}

/// |E(z)|² sampled across the whole stack (incident E0⁺ = 1, normalized). Returns
/// (z_nm, intensity) with `per_layer` samples per layer. The intensity peaks at the cavity
/// antinode and decays into the Bragg mirrors.
pub fn field_profile(stack: &[Layer], lambda: f64, n0: f64, ns: f64, per_layer: usize) -> (Vec<f64>, Vec<f64>) {
    let m = system_matrix(stack, lambda, n0, ns);
    let r = m[(1, 0)] / m[(0, 0)];
    let mut v = Vector2::new(C::new(1.0, 0.0), r); // [E⁺;E⁻] in the incident medium
    let (mut zs, mut is) = (Vec::new(), Vec::new());
    let mut z0 = 0.0;
    let mut n_prev = n0;
    for l in stack {
        let vl = interface(n_prev, l.n).try_inverse().unwrap() * v; // amplitudes at the layer's left edge
        let k = 2.0 * PI * l.n / lambda;
        for s in 0..per_layer {
            let z = l.d_nm * (s as f64) / (per_layer as f64);
            let e = vl[0] * C::new(0.0, -k * z).exp() + vl[1] * C::new(0.0, k * z).exp();
            zs.push(z0 + z);
            is.push(e.norm_sqr());
        }
        v = propagate(l.n, l.d_nm, lambda).try_inverse().unwrap() * vl; // advance to the right edge
        z0 += l.d_nm;
        n_prev = l.n;
    }
    (zs, is)
}

/// Build a DBR–cavity–DBR stack designed for `lambda` (nm): `pairs` quarter-wave (n_hi, n_lo)
/// bilayers on each side of a λ/2 cavity spacer of index `n_cav`. Layer thicknesses are the true
/// quarter-/half-wave optical thicknesses (sub-micron), so the cross-section renders to real scale.
pub fn dbr_cavity(lambda: f64, n_hi: f64, n_lo: f64, pairs: usize, n_cav: f64) -> Vec<Layer> {
    let qh = Layer { n: n_hi, d_nm: lambda / (4.0 * n_hi) };
    let ql = Layer { n: n_lo, d_nm: lambda / (4.0 * n_lo) };
    let cav = Layer { n: n_cav, d_nm: lambda / (2.0 * n_cav) };
    let mut s = Vec::with_capacity(4 * pairs + 1);
    for _ in 0..pairs { s.push(qh); s.push(ql); }
    s.push(cav);
    for _ in 0..pairs { s.push(ql); s.push(qh); }
    s
}
