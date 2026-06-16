//! Transfer-matrix optics — validated against exact analytic closed forms (no golden needed).

use cqed_core::optics::{dbr_cavity, field_profile, reflectance, Layer};

#[test]
fn fresnel_single_interface() {
    // empty stack = a single n0 → ns interface: R = ((n0 − ns)/(n0 + ns))²
    for (n0, ns) in [(1.0, 1.5), (1.0, 2.25), (1.33, 1.5)] {
        let got = reflectance(&[], 550.0, n0, ns);
        let want = ((n0 - ns) / (n0 + ns)).powi(2);
        assert!((got - want).abs() < 1e-12, "Fresnel R {got} != {want}");
    }
}

#[test]
fn quarter_wave_antireflection() {
    // a λ/4 layer of index √(n0·ns) perfectly cancels reflection at the design wavelength: R = 0
    let (lambda, n0, ns) = (550.0, 1.0_f64, 2.25_f64);
    let nl = (n0 * ns).sqrt();
    let stack = [Layer { n: nl, d_nm: lambda / (4.0 * nl) }];
    let r = reflectance(&stack, lambda, n0, ns);
    assert!(r < 1e-12, "quarter-wave AR R should be ~0, got {r}");
}

#[test]
fn quarter_wave_high_reflector() {
    // N (high,low) λ/4 pairs → reflectance matches the exact admittance result and rises toward 1:
    // R = ((n0·nl^{2N} − ns·nh^{2N}) / (n0·nl^{2N} + ns·nh^{2N}))²
    let (lambda, n0, ns, nh, nl) = (550.0, 1.0, 1.5, 2.5, 1.46);
    let qh = Layer { n: nh, d_nm: lambda / (4.0 * nh) };
    let ql = Layer { n: nl, d_nm: lambda / (4.0 * nl) };
    let mut prev = 0.0;
    for pairs in [2usize, 4, 8] {
        let mut s = Vec::new();
        for _ in 0..pairs { s.push(qh); s.push(ql); }
        let r = reflectance(&s, lambda, n0, ns);
        let (a, b) = (n0 * nl.powi(2 * pairs as i32), ns * nh.powi(2 * pairs as i32));
        let want = ((a - b) / (a + b)).powi(2);
        assert!((r - want).abs() < 1e-8, "DBR R {r} != analytic {want} (pairs={pairs})");
        assert!(r > prev, "reflectance should grow with pairs");
        prev = r;
    }
    assert!(prev > 0.99, "8-pair DBR should be a high reflector, got {prev}");
}

#[test]
fn cavity_resonance_dip_and_field_enhancement() {
    let (lambda, n0, ns) = (550.0, 1.0, 1.5);
    let stack = dbr_cavity(lambda, 2.5, 1.46, 6, 1.6);
    // symmetric cavity transmits on resonance → reflectance dips below the off-resonance value
    let on = reflectance(&stack, lambda, n0, ns);
    let off = reflectance(&stack, lambda + 25.0, n0, ns);
    assert!(on < off, "cavity should dip on resonance: R(λ)={on} !< R(λ+25)={off}");
    // the intracavity field is enhanced: peak |E|² in the spacer exceeds the incident |E|² = 1
    let (_z, i) = field_profile(&stack, lambda, n0, ns, 12);
    let peak = i.iter().cloned().fold(0.0_f64, f64::max);
    assert!(peak > 1.5, "expected cavity field enhancement, peak |E|² = {peak}");
    assert!(i.iter().all(|&v| v >= 0.0), "intensity must be non-negative");
}
