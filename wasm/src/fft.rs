//! Minimal dependency-free radix-2 Cooley–Tukey FFT + the cavity transmission/PL power spectrum.
//!
//! The single-excitation cavity response measured in a transmission or photoluminescence experiment is
//! the Fourier transform of the photon field amplitude ψ₀(t) = Σ_k |v₀ₖ|² e^{−iE_k t} (start from one
//! photon ⇒ c_k = v₀ₖ). Its power spectrum peaks at the eigen-energies weighted by photon fraction:
//! the two polaritons give the vacuum-Rabi doublet; the M−1 dark states carry no photon weight and are
//! invisible; energy disorder σ splits/broadens the peaks. Validated in `tests/fft_spectrum.rs`.

use nalgebra::Complex;
use std::f64::consts::PI;

/// In-place forward FFT of a power-of-two-length buffer (iterative, bit-reversal + butterflies).
pub fn fft(x: &mut [Complex<f64>]) {
    let n = x.len();
    if n <= 1 {
        return;
    }
    debug_assert!(n.is_power_of_two(), "fft length must be a power of two");
    // bit-reversal permutation
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            x.swap(i, j);
        }
    }
    // butterflies
    let mut len = 2;
    while len <= n {
        let ang = -2.0 * PI / len as f64;
        let wlen = Complex::new(ang.cos(), ang.sin());
        let mut i = 0;
        while i < n {
            let mut w = Complex::new(1.0, 0.0);
            for k in 0..len / 2 {
                let u = x[i + k];
                let v = x[i + k + len / 2] * w;
                x[i + k] = u + v;
                x[i + k + len / 2] = u - v;
                w *= wlen;
            }
            i += len;
        }
        len <<= 1;
    }
}

/// Cavity power spectrum S(ω) from the eigen-energies + photon fractions: synthesize the Hann-windowed
/// photon amplitude ψ₀(t) on an `n`-point grid (step `dt`), FFT, return the positive-frequency half as
/// `(energy axis ω, power normalized to peak 1)`. `n` must be a power of two.
pub fn power_spectrum(eigs: &[f64], photon_frac: &[f64], n: usize, dt: f64) -> (Vec<f64>, Vec<f64>) {
    let mut x = vec![Complex::new(0.0, 0.0); n];
    for (j, xj) in x.iter_mut().enumerate() {
        let t = j as f64 * dt;
        let hann = 0.5 - 0.5 * (2.0 * PI * j as f64 / (n as f64 - 1.0)).cos();
        let mut s = Complex::new(0.0, 0.0);
        for (k, &e) in eigs.iter().enumerate() {
            // +iE_k t so each eigen-frequency lands in the positive (lower) half of the FFT bins,
            // which is the half we return; the power spectrum is sign-convention independent.
            let ph = e * t;
            s += Complex::new(ph.cos(), ph.sin()) * photon_frac[k];
        }
        *xj = s * hann;
    }
    fft(&mut x);
    let half = n / 2;
    let scale = 2.0 * PI / (n as f64 * dt); // DFT bin m ↔ angular frequency ω = 2π m /(N dt)
    let mut freqs = Vec::with_capacity(half);
    let mut power = Vec::with_capacity(half);
    let mut pmax = 1e-30;
    for m in 0..half {
        freqs.push(m as f64 * scale);
        let p = x[m].norm_sqr();
        power.push(p);
        if p > pmax {
            pmax = p;
        }
    }
    for p in power.iter_mut() {
        *p /= pmax;
    }
    (freqs, power)
}
