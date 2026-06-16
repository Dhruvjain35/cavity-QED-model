//! von Neumann entropy of a (Hermitian) density matrix.

use crate::operators::CMat;
use nalgebra::DMatrix;

/// von Neumann entropy S = −Tr(ρ ln ρ) = −Σ_i λ_i ln λ_i (natural log), over the eigenvalues of
/// the Hermitian ρ. S = 0 for a pure state, > 0 for a mixed one — the complement of purity Tr(ρ²).
///
/// Eigenvalues come from the real-symmetric embedding M = [[Re ρ, −Im ρ], [Im ρ, Re ρ]] (the same
/// trick used for `min_eigenvalue`); each eigenvalue of ρ appears twice in M's 2n-spectrum, so
/// S = −½ Σ_j μ_j ln μ_j over M's eigenvalues. Validated against the analytic diag(p, 1−p) value.
pub fn von_neumann_entropy(rho: &CMat) -> f64 {
    let n = rho.nrows();
    let mut m = DMatrix::<f64>::zeros(2 * n, 2 * n);
    for i in 0..n {
        for j in 0..n {
            let z = rho[(i, j)];
            m[(i, j)] = z.re;
            m[(i + n, j + n)] = z.re;
            m[(i, j + n)] = -z.im;
            m[(i + n, j)] = z.im;
        }
    }
    let mut s = 0.0;
    for &mu in m.symmetric_eigenvalues().iter() {
        if mu.is_finite() && mu > 1e-12 {
            s += mu * mu.ln();
        }
    }
    -0.5 * s
}
