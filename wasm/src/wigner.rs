//! Wigner quasiprobability distribution, a faithful port of QuTiP's `_wigner_clenshaw`
//! (dense path, offset = 0, g = √2, α = x + iy). See QuTiP `qutip/wigner.py`.
//!
//!   W = e^(−B/2) · (g²/2π) · Re( Σ_L c_L (A2)^L / √(L!) )   via Horner/Clenshaw,
//!   c_L = Σ_n ρ_dense[n, n+L] · LL_n^L(B),  ρ_dense = ρ with off-diagonals doubled.
//!
//! The α-only terms (A2, B = |A2|², exp(−B/2)) depend on the grid alone, so they are
//! precomputed once in `WignerGrid::new`; only the ρ-dependent Clenshaw sweep runs per call.
//! Validated element-wise against the QuTiP golden in `tests/wigner_golden.rs`.
//! (Correctness-first; the live path will vectorize these flat loops to SIMD in a Worker.)

use crate::operators::{CMat, C};
use nalgebra::Complex;
use std::f64::consts::PI;

#[inline]
fn rmul(z: C, s: f64) -> C {
    Complex::new(z.re * s, z.im * s)
}

pub struct WignerGrid {
    pub nx: usize,
    pub ny: usize,
    a2: Vec<C>,               // A2 = g·(x + i·y), row-major (r → y, c → x)
    b: Vec<f64>,              // B = |A2|²
    exp_neg_b_half: Vec<f64>, // exp(−B/2)
    prefactor: f64,           // g²·0.5/π
}

impl WignerGrid {
    pub fn new(xvec: &[f64], yvec: &[f64], g: f64) -> Self {
        let (nx, ny) = (xvec.len(), yvec.len());
        let mut a2 = Vec::with_capacity(nx * ny);
        let mut b = Vec::with_capacity(nx * ny);
        let mut exp_neg_b_half = Vec::with_capacity(nx * ny);
        for r in 0..ny {
            for col in 0..nx {
                let z = Complex::new(g * xvec[col], g * yvec[r]); // A2 = g(X + iY)
                let bb = z.norm_sqr();
                a2.push(z);
                b.push(bb);
                exp_neg_b_half.push((-0.5 * bb).exp());
            }
        }
        WignerGrid { nx, ny, a2, b, exp_neg_b_half, prefactor: g * g * 0.5 / PI }
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.nx * self.ny
    }
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Wigner grid (row-major, r → y, c → x) of an M×M cavity density matrix ρ.
    pub fn compute(&self, rho: &CMat) -> Vec<f64> {
        let m = rho.nrows();
        let ng = self.len();

        // offset = 0:  w0 = 2·ρ[0, M−1]
        let init = rmul(rho[(0, m - 1)], 2.0);
        let mut w0 = vec![init; ng];

        // Horner sweep down the superdiagonals L = M−2 … 0
        let mut l = m - 1;
        while l > 0 {
            l -= 1;
            // ρ_dense's L-th superdiagonal: ρ[n, n+L] with off-diagonals (L≠0) doubled.
            let scale = if l != 0 { 2.0 } else { 1.0 };
            let diag: Vec<C> = (0..(m - l)).map(|n| rmul(rho[(n, n + l)], scale)).collect();
            let lag = self.wig_laguerre_val(l, &diag);
            let s = ((l as f64) + 1.0).powf(-0.5);
            for i in 0..ng {
                w0[i] = lag[i] + rmul(w0[i] * self.a2[i], s);
            }
        }

        (0..ng)
            .map(|i| w0[i].re * self.exp_neg_b_half[i] * self.prefactor)
            .collect()
    }

    /// `_wig_laguerre_val(L, x=B, c)` evaluated over the grid via Clenshaw recursion.
    fn wig_laguerre_val(&self, l: usize, c: &[C]) -> Vec<C> {
        let ng = self.len();
        let lf = l as f64;
        let n = c.len();

        if n == 1 {
            return vec![c[0]; ng];
        }
        if n == 2 {
            let s = (lf + 1.0).powf(-0.5);
            return (0..ng)
                .map(|i| c[0] - rmul(c[1], ((lf + 1.0) - self.b[i]) * s))
                .collect();
        }

        // n ≥ 3: y0, y1 carried per grid point.
        let mut y0 = vec![c[n - 2]; ng];
        let mut y1 = vec![c[n - 1]; ng];
        let mut k = n;
        for i_iter in 3..=n {
            k -= 1;
            let kf = k as f64;
            let coef0 = (((kf - 1.0) * (lf + kf - 1.0)) / ((lf + kf) * kf)).sqrt();
            let inv = ((lf + kf) * kf).powf(-0.5);
            let c_neg_i = c[n - i_iter];
            let lk = lf + 2.0 * kf - 1.0;
            let mut ny0 = vec![Complex::new(0.0, 0.0); ng];
            let mut ny1 = vec![Complex::new(0.0, 0.0); ng];
            for p in 0..ng {
                ny0[p] = c_neg_i - rmul(y1[p], coef0);
                ny1[p] = y0[p] - rmul(y1[p], (lk - self.b[p]) * inv);
            }
            y0 = ny0;
            y1 = ny1;
        }
        let s = (lf + 1.0).powf(-0.5);
        (0..ng)
            .map(|p| y0[p] - rmul(y1[p], ((lf + 1.0) - self.b[p]) * s))
            .collect()
    }
}

/// ∫∫ W dx dy via a rectangle sum, the quasiprobability normalizes to 1.
pub fn integrate_grid(w: &[f64], dx: f64, dy: f64) -> f64 {
    w.iter().sum::<f64>() * dx * dy
}

// ── Colour mapping (done in Rust so only RGBA crosses the WASM boundary) ──────
// The true matplotlib / ColorBrewer "RdBu" 11-class anchors (red end → blue end), verified
// byte-for-byte against matplotlib `lib/matplotlib/_cm.py` (_RdBu_data) AND colorbrewer2.org.
// The neutral midpoint (W=0) is light gray #F7F7F7 = (247,247,247), NOT pure white; the ramp
// never reaches (255,255,255). This is exactly QuTiP `plot_wigner`'s default: `cm.RdBu` under a
// symmetric norm `Normalize(-w_max, +w_max)`, so negative W → red (non-classical), positive → blue.
// See docs/GROUNDING-RESEARCH.md §1.
const RDBU: [(f64, f64, f64); 11] = [
    (103.0, 0.0, 31.0),    // most negative
    (178.0, 24.0, 43.0),
    (214.0, 96.0, 77.0),
    (244.0, 165.0, 130.0),
    (253.0, 219.0, 199.0),
    (247.0, 247.0, 247.0), // W = 0  (#F7F7F7)
    (209.0, 229.0, 240.0),
    (146.0, 197.0, 222.0),
    (67.0, 147.0, 195.0),
    (33.0, 102.0, 172.0),
    (5.0, 48.0, 97.0),     // most positive
];

/// Continuous linear interpolation across the 11 RdBu anchors, `t` ∈ [0, 1].
#[inline]
fn ramp(t: f64) -> (u8, u8, u8) {
    let pos = t.clamp(0.0, 1.0) * 10.0;
    let i = (pos as usize).min(9);
    let f = pos - i as f64;
    let (r0, g0, b0) = RDBU[i];
    let (r1, g1, b1) = RDBU[i + 1];
    let mix = |a: f64, b: f64| (a + f * (b - a)).round().clamp(0.0, 255.0) as u8;
    (mix(r0, r1), mix(g0, g1), mix(b0, b1))
}

/// QuTiP-default Wigner colour map: matplotlib RdBu under a symmetric norm centred at zero.
/// `w_max` sets the symmetric range [−w_max, +w_max]; W maps to t = (W + w_max)/(2·w_max), so
/// W=0 → neutral gray (247,247,247), negative → red, positive → blue.
#[inline]
pub fn rdbu(w: f64, w_max: f64) -> (u8, u8, u8) {
    ramp((w + w_max) / (2.0 * w_max))
}

/// Map a Wigner grid to a flat RGBA buffer (len = grid·4). If `w_max ≤ 0`, auto-scale to max|W|.
pub fn wigner_to_rgba(w: &[f64], w_max: f64) -> Vec<u8> {
    let scale = if w_max > 0.0 {
        w_max
    } else {
        w.iter().fold(0.0_f64, |m, &v| m.max(v.abs())).max(1e-12)
    };
    let mut out = Vec::with_capacity(w.len() * 4);
    for &v in w {
        let (r, g, b) = rdbu(v, scale);
        out.extend_from_slice(&[r, g, b, 255]);
    }
    out
}

/// Husimi Q-function Q(x,y) = (1/π)·⟨α|ρ|α⟩ with α = ½·g·(x+iy) (QuTiP `qfunc` convention, g=√2).
/// Always ≥ 0, a genuine probability density complementing the (signed) Wigner. For a coherent
/// state |β⟩ it is the Gaussian Q(α) = (1/π)·exp(−|α−β|²). Validated analytically in
/// tests/husimi_entropy.rs.
pub fn q_function(rho: &CMat, xvec: &[f64], yvec: &[f64], g: f64) -> Vec<f64> {
    let m = rho.nrows();
    let mut inv_sqrt_fact = vec![1.0_f64; m]; // 1/√n!
    for n in 1..m {
        inv_sqrt_fact[n] = inv_sqrt_fact[n - 1] / (n as f64).sqrt();
    }
    let mut out = Vec::with_capacity(xvec.len() * yvec.len());
    let mut v = vec![C::new(0.0, 0.0); m];
    for &y in yvec {
        for &x in xvec {
            let alpha = C::new(0.5 * g * x, 0.5 * g * y);
            let mut p = C::new(1.0, 0.0);
            for n in 0..m {
                v[n] = rmul(p, inv_sqrt_fact[n]); // α^n / √n!
                p *= alpha;
            }
            // ⟨α|ρ|α⟩ = e^{−|α|²} · Σ_nm conj(v_n) ρ_nm v_m
            let mut acc = C::new(0.0, 0.0);
            for n in 0..m {
                let mut inner = C::new(0.0, 0.0);
                for mm in 0..m {
                    inner += rho[(n, mm)] * v[mm];
                }
                acc += v[n].conj() * inner;
            }
            out.push(acc.re * (-alpha.norm_sqr()).exp() / PI);
        }
    }
    out
}

/// Cavity-reduced density matrix: trace out the 2-level atom from a cavity-first
/// |n⟩⊗|σ⟩ density matrix (combined index = 2n+σ). ρ_c[n,n'] = Σ_σ ρ[2n+σ, 2n'+σ].
/// Validated against QuTiP `ptrace(0)` in tests/wigner_golden.rs.
pub fn partial_trace_atom(rho: &CMat, n_fock: usize) -> CMat {
    let mut rc = CMat::zeros(n_fock, n_fock);
    for n in 0..n_fock {
        for np in 0..n_fock {
            let mut s = Complex::new(0.0, 0.0);
            for sigma in 0..2 {
                s += rho[(2 * n + sigma, 2 * np + sigma)];
            }
            rc[(n, np)] = s;
        }
    }
    rc
}
