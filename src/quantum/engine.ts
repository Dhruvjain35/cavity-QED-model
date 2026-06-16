// Thin TS wrapper over the QuTiP-validated Rust→WASM core (sim/wasm/pkg-web).
// All physics is computed in WASM; this only marshals parameters and the RGBA buffer.
import init, { Sim, spectrum, wigner_rgba_of_rho, wigner_of_rho, cavity_layers, cavity_field, cavity_reflectance } from "../../wasm/pkg-web/cqed_core.js";

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
