//! The cavity power spectrum (FFT of the photon amplitude) must reproduce the vacuum-Rabi doublet:
//! two peaks symmetric about ω_a, split by 2g√M, for identical resonant emitters.

use cqed_core::fft::power_spectrum;
use cqed_core::spectrum::disordered_spectrum;
use std::f64::consts::PI;

#[test]
fn power_spectrum_shows_rabi_doublet() {
    let (m, g, w0) = (6usize, 0.08, 1.0);
    let s = disordered_spectrum(w0, w0, g, m, 0.0, 1); // no disorder
    let (n, dt) = (2048usize, 0.12);
    let (freqs, power) = power_spectrum(&s.eigs, &s.photon_frac, n, dt, 0.0); // γ=0 → sharp doublet
    let res = 2.0 * PI / (n as f64 * dt);

    // strongest bin = one polariton; strongest bin ≥ 8 cells away = the other
    let p1 = (0..power.len()).max_by(|&a, &b| power[a].partial_cmp(&power[b]).unwrap()).unwrap();
    let p2 = (0..power.len())
        .filter(|&i| (freqs[i] - freqs[p1]).abs() > 8.0 * res)
        .max_by(|&a, &b| power[a].partial_cmp(&power[b]).unwrap())
        .unwrap();

    let split = (freqs[p1] - freqs[p2]).abs();
    let expect = 2.0 * g * (m as f64).sqrt();
    let center = (freqs[p1] + freqs[p2]) / 2.0;
    println!("doublet split = {split:.4}  2g√M = {expect:.4}  center = {center:.4}  fft res = {res:.4}");

    assert!((split - expect).abs() < 3.0 * res, "doublet split {split:.4} != 2g√M {expect:.4}");
    assert!((center - w0).abs() < 3.0 * res, "doublet not centered on ω_a (center {center:.4})");
    assert!(power[p2] > 0.3, "second polariton peak too weak ({:.3}), not a clean doublet", power[p2]);
}
