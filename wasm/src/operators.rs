//! Jaynes–Cummings operators in the locked QuTiP convention.
//!
//! Resolved 2-level basis (matches QuTiP, confirmed by the golden):
//!   sigma_z = diag(1, -1)  →  basis(2,0) is EXCITED |e> (sz=+1), basis(2,1) is GROUND |g>.
//!   sigmam = |g><e| = [[0,0],[1,0]] lowers the atom; sp = sigmam†; P_e = sp*sm = |e><e|.

use nalgebra::{Complex, DMatrix};

pub type C = Complex<f64>;
pub type CMat = DMatrix<C>;

#[inline]
fn c(re: f64) -> C {
    Complex::new(re, 0.0)
}

/// Physical parameters (ħ = 1).
#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub n_fock: usize,
    pub w_c: f64,
    pub w_a: f64,
    pub g: f64,
    pub kappa: f64,
    pub gamma: f64,
    pub gamma_phi: f64,
}

/// All operators for the single-emitter JC system, in the locked convention.
pub struct Ops {
    pub a: CMat,        // tensor(destroy(N), I2)
    pub sm: CMat,       // tensor(I_N, sigmam)
    pub sp: CMat,       // sm†
    pub sz: CMat,       // tensor(I_N, sigmaz)
    pub num: CMat,      // a† a
    pub p_e: CMat,      // sp sm
    pub h: CMat,        // Jaynes–Cummings Hamiltonian (RWA)
    pub c_ops: Vec<CMat>, // collapse operators, rate-in-operator
}

/// Bosonic lowering operator: `a|n> = sqrt(n)|n-1>` → matrix element `<r|a|col> = sqrt(col)` at `r = col-1`.
fn destroy(n: usize) -> CMat {
    DMatrix::from_fn(n, n, |r, col| {
        if r + 1 == col {
            Complex::new((col as f64).sqrt(), 0.0)
        } else {
            Complex::new(0.0, 0.0)
        }
    })
}

fn eye(n: usize) -> CMat {
    DMatrix::<C>::identity(n, n)
}

/// sigmam = |g><e| = [[0,0],[1,0]] (row-major).
fn sigmam() -> CMat {
    DMatrix::from_row_slice(2, 2, &[c(0.0), c(0.0), c(1.0), c(0.0)])
}

/// sigmaz = diag(1, -1).
fn sigmaz() -> CMat {
    DMatrix::from_row_slice(2, 2, &[c(1.0), c(0.0), c(0.0), c(-1.0)])
}

#[inline]
fn scale(m: &CMat, s: f64) -> CMat {
    m.map(|x| x * Complex::new(s, 0.0))
}

/// Build every operator in the locked cavity-first convention.
pub fn build(p: &Params) -> Ops {
    let n = p.n_fock;
    // cavity-first tensor order
    let a = destroy(n).kronecker(&eye(2));
    let sm = eye(n).kronecker(&sigmam());
    let sp = sm.adjoint();
    let sz = eye(n).kronecker(&sigmaz());

    let adag = a.adjoint();
    let num = &adag * &a;
    let p_e = &sp * &sm;

    // H = w_c a†a + w_a sp sm + g (a† sm + a sp)
    let coupling = (&adag * &sm) + (&a * &sp);
    let h = scale(&num, p.w_c) + scale(&p_e, p.w_a) + scale(&coupling, p.g);

    // rate-in-operator collapse ops
    let mut c_ops = vec![scale(&a, p.kappa.sqrt()), scale(&sm, p.gamma.sqrt())];
    if p.gamma_phi > 0.0 {
        c_ops.push(scale(&sz, (p.gamma_phi / 2.0).sqrt()));
    }

    Ops { a, sm, sp, sz, num, p_e, h, c_ops }
}
