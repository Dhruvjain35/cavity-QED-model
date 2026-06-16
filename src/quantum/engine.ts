// Thin TS wrapper over the QuTiP-validated Rust→WASM core (sim/wasm/pkg-web).
// All physics is computed in WASM; this only marshals parameters and the RGBA buffer.
import init, { Sim, spectrum, arrowhead_modes, arrowhead_modes_gi, arrowhead_matrix_gi, cavity_power_spectrum, cavity_power_spectrum_gi, coupling_sweep, coupling_sweep_gi, htc_spectrum, htc_spectrum_multi, htc_franck_condon, wigner_rgba_of_rho, wigner_of_rho, cavity_layers, cavity_field, cavity_reflectance } from "../../wasm/pkg-web/cqed_core.js";

let initPromise: Promise<unknown> | null = null;
export function loadWasm(): Promise<unknown> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

/** RGBA Wigner (n·n·4) of an arbitrary cavity density matrix supplied as row-major re/im arrays.
 *  Reuses the QuTiP-validated Clenshaw + RdBu pipeline — used for the disorder→Wigner bridge. */
export function wignerRgbaOfRho(
  re: Float64Array, im: Float64Array, dim: number, n: number, wMax: number,
): Uint8Array {
  return wigner_rgba_of_rho(re, im, dim, -5, 5, n, wMax);
}

/** Raw real-valued Wigner grid (n·n, row-major) of an arbitrary cavity density matrix — colour
 *  mapping is left to the caller (the dark-theme colormap lives in the UI). */
export function wignerRawOfRho(re: Float64Array, im: Float64Array, dim: number, n: number): Float64Array {
  return wigner_of_rho(re, im, dim, -5, 5, n);
}

// ── Cavity cross-section (transfer-matrix optics) ──
/** DBR-cavity layer stack as [{n, d_nm}, …] (index + thickness in nm). */
export function cavityLayers(lambda: number, nHi: number, nLo: number, pairs: number, nCav: number): { n: number; d: number }[] {
  const flat = cavity_layers(lambda, nHi, nLo, pairs, nCav);
  const out: { n: number; d: number }[] = [];
  for (let k = 0; k < flat.length; k += 2) out.push({ n: flat[k]!, d: flat[k + 1]! });
  return out;
}
/** |E(z)|² standing-wave field across the stack. */
export function cavityField(lambda: number, nHi: number, nLo: number, pairs: number, nCav: number, n0: number, ns: number, perLayer: number): { z: Float64Array; intensity: Float64Array } {
  const f = cavity_field(lambda, nHi, nLo, pairs, nCav, n0, ns, perLayer);
  const n = f.length / 2;
  return { z: f.slice(0, n), intensity: f.slice(n) };
}
/** Power reflectance R(λ) of the DBR cavity. */
export function cavityReflectance(lambda: number, nHi: number, nLo: number, pairs: number, nCav: number, n0: number, ns: number): number {
  return cavity_reflectance(lambda, nHi, nLo, pairs, nCav, n0, ns);
}

/** One arrowhead diagonalization (Regime 2): M emitters at w_a with Gaussian disorder σ, coupling g,
 *  cavity at w_c. Returns the M+1 eigen-energies (ascending) and their Hopfield photon fractions.
 *  Validated against numpy `eigh` in wasm/tests/spectrum_golden.rs. */
export function solveSpectrum(
  wc: number, wa: number, g: number, m: number, sigma: number, seed: number,
): { eigs: Float64Array; photon: Float64Array } {
  const flat = spectrum(wc, wa, g, m, sigma, seed); // length 2·(M+1): [eigs…, photon…]
  const k = m + 1;
  return { eigs: flat.slice(0, k), photon: flat.slice(k, 2 * k) };
}

/** Eigen-modes of the single-excitation arrowhead for real-time dynamics: eigenvalues + the (M+1)²
 *  row-major eigenvector matrix (V[i][k] = vecs[i·n + k], n = M+1). The UI evolves
 *  ψ(t) = Σ_k c_k e^{−iE_k t} φ_k from these (c_k from the chosen initial state). */
export function arrowheadModes(wc: number, wa: number, g: number, m: number, sigma: number, seed: number): { eigs: Float64Array; vecs: Float64Array; n: number } {
  const flat = arrowhead_modes(wc, wa, g, m, sigma, seed);
  const n = m + 1;
  return { eigs: flat.slice(0, n), vecs: flat.slice(n), n };
}

/** Cavity transmission/PL power spectrum S(ω) (FFT of the photon amplitude, computed in Rust):
 *  vacuum-Rabi doublet at the polariton energies, broadening with disorder. Validated in
 *  wasm/tests/fft_spectrum.rs (two peaks split by 2g√M, centred on ω_a). */
export function cavityPowerSpectrum(
  wc: number, wa: number, g: number, m: number, sigma: number, seed: number, nFft: number, dt: number, gamma = 0,
): { omega: Float64Array; power: Float64Array } {
  const flat = cavity_power_spectrum(wc, wa, g, m, sigma, seed, nFft, dt, gamma); // [ω(n/2), power(n/2)]
  const h = flat.length / 2;
  return { omega: flat.slice(0, h), power: flat.slice(h) };
}

/** Coupling sweep: the (M+1) eigen-energies at each of `steps` values of g in [g0, g1] (Rust loop).
 *  Reshaped to one Float64Array of energies per step — the polariton dispersion fan. */
export function couplingSweep(
  wc: number, wa: number, m: number, sigma: number, seed: number, g0: number, g1: number, steps: number,
): { gs: Float64Array; eigs: Float64Array[] } {
  const flat = coupling_sweep(wc, wa, m, sigma, seed, g0, g1, steps); // steps·(m+1), row-major by step
  const k = m + 1, eigs: Float64Array[] = [], gs = new Float64Array(steps);
  for (let s = 0; s < steps; s++) {
    gs[s] = steps <= 1 ? g0 : g0 + (g1 - g0) * s / (steps - 1);
    eigs.push(flat.slice(s * k, s * k + k));
  }
  return { gs, eigs };
}

/** Modes for explicit per-molecule couplings g_i (orientation/position-dependent), site energies from
 *  (σ, seed). Returns eigenvalues + the (M+1)² eigenvector matrix. */
export function arrowheadModesGi(wc: number, wa: number, sigma: number, seed: number, gi: Float64Array): { eigs: Float64Array; vecs: Float64Array; n: number } {
  const flat = arrowhead_modes_gi(wc, wa, sigma, seed, gi);
  const n = gi.length + 1;
  return { eigs: flat.slice(0, n), vecs: flat.slice(n), n };
}

/** The exact (M+1)×(M+1) single-excitation Hamiltonian matrix the engine diagonalizes (row-major),
 *  for export to NumPy/MATLAB. */
export function arrowheadMatrixGi(wc: number, wa: number, sigma: number, seed: number, gi: Float64Array): { h: Float64Array; n: number } {
  return { h: arrowhead_matrix_gi(wc, wa, sigma, seed, gi), n: gi.length + 1 };
}

/** Power spectrum for per-molecule couplings g_i. */
export function cavityPowerSpectrumGi(wc: number, wa: number, sigma: number, seed: number, gi: Float64Array, nFft: number, dt: number, gamma: number): { omega: Float64Array; power: Float64Array } {
  const flat = cavity_power_spectrum_gi(wc, wa, sigma, seed, gi, nFft, dt, gamma);
  const h = flat.length / 2;
  return { omega: flat.slice(0, h), power: flat.slice(h) };
}

/** Coupling sweep for per-molecule geometry factors (g_i = g_0·factor_i). */
export function couplingSweepGi(wc: number, wa: number, sigma: number, seed: number, factors: Float64Array, g0: number, g1: number, steps: number): { gs: Float64Array; eigs: Float64Array[] } {
  const flat = coupling_sweep_gi(wc, wa, sigma, seed, factors, g0, g1, steps);
  const k = factors.length + 1, eigs: Float64Array[] = [], gs = new Float64Array(steps);
  for (let s = 0; s < steps; s++) { gs[s] = steps <= 1 ? g0 : g0 + (g1 - g0) * s / (steps - 1); eigs.push(flat.slice(s * k, s * k + k)); }
  return { gs, eigs };
}

/** Single-molecule Holstein–Tavis–Cummings absorption (cavity + emitter + one vibration). Returns the
 *  2·n_vib eigen-energies, their photon weight, and absorption stick intensity. Validated against the
 *  analytic g→0 Franck–Condon progression in wasm/tests/htc.rs. λ = √(Huang–Rhys S). */
export function htcSpectrum(wc: number, wx: number, wv: number, lambda: number, g: number, nVib: number): { eigs: Float64Array; photon: Float64Array; absorption: Float64Array } {
  const flat = htc_spectrum(wc, wx, wv, lambda, g, nVib);
  const d = 2 * nVib;
  return { eigs: flat.slice(0, d), photon: flat.slice(d, 2 * d), absorption: flat.slice(2 * d, 3 * d) };
}

/** EXACT N-molecule HTC absorption (no 1/N shortcut) — for small N. Returns d = (N+1)·nVib^N
 *  eigenvalues, photon weights, and collective absorption sticks. Validated: N=1 ≡ htcSpectrum. */
export function htcSpectrumMulti(wc: number, wx: number, wv: number, lambda: number, g: number, nMol: number, nVib: number): { eigs: Float64Array; photon: Float64Array; absorption: Float64Array } {
  const flat = htc_spectrum_multi(wc, wx, wv, lambda, g, nMol, nVib);
  const d = flat.length / 3;
  return { eigs: flat.slice(0, d), photon: flat.slice(d, 2 * d), absorption: flat.slice(2 * d, 3 * d) };
}

/** Analytic bare-molecule (g=0) Franck–Condon sticks: positions ω_x−Sω_v+nω_v and Poisson weights. */
export function htcFranckCondon(wx: number, wv: number, lambda: number, nMax: number): { pos: Float64Array; weight: Float64Array } {
  const flat = htc_franck_condon(wx, wv, lambda, nMax);
  return { pos: flat.slice(0, nMax), weight: flat.slice(nMax) };
}

export interface SimParams {
  nFock: number;
  wc: number;
  wa: number;
  g: number;
  kappa: number;
  gamma: number;
  gammaPhi: number;
}

/** A single-emitter Jaynes–Cummings open system, evolving under the Lindblad master equation. */
export class Quantum {
  private sim: Sim;
  constructor(p: SimParams) {
    this.sim = new Sim(p.nFock, p.wc, p.wa, p.g, p.kappa, p.gamma, p.gammaPhi);
  }
  advance(dt: number, atol = 1e-6, rtol = 1e-6): void {
    this.sim.advance(dt, atol, rtol);
  }
  reset(): void {
    this.sim.reset();
  }
  /** RGBA bytes (n·n·4) of the live cavity-reduced Wigner. wMax ≤ 0 auto-scales. */
  rgba(n: number, wMax: number): Uint8Array {
    return this.sim.wigner_rgba(-5, 5, n, wMax);
  }
  get time(): number {
    return this.sim.time();
  }
  get photon(): number {
    return this.sim.photon_number();
  }
  get excited(): number {
    return this.sim.excited_pop();
  }
  get trace(): number {
    return this.sim.trace();
  }
  get minEig(): number {
    return this.sim.min_eigenvalue();
  }
  /** Flattened |ρ_c[n,n′]| (n_fock·n_fock, row-major) of the cavity-reduced state. */
  cavityRhoAbs(): Float64Array {
    return this.sim.cavity_rho_abs();
  }
  /** Flattened |ρ[i,j]| ((2·n_fock)², row-major) of the full joint cavity⊗emitter state. */
  rhoAbs(): Float64Array {
    return this.sim.rho_abs();
  }
  /** Raw real-valued Wigner grid (n·n, row-major) of the live cavity-reduced state. */
  wignerRaw(n: number): Float64Array {
    return this.sim.wigner(-5, 5, n);
  }
  /** Raw Husimi Q-function grid (n·n, row-major) of the live cavity-reduced state (always ≥ 0). */
  husimiRaw(n: number): Float64Array {
    return this.sim.husimi(-5, 5, n);
  }
  /** Purity Tr(ρ²) ∈ (0, 1]. */
  get purity(): number {
    return this.sim.purity();
  }
  /** von Neumann entropy S = −Tr(ρ ln ρ) ≥ 0 (0 = pure). */
  get entropy(): number {
    return this.sim.von_neumann_entropy();
  }
  dispose(): void {
    this.sim.free();
  }
}
