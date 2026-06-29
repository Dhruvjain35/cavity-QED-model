// System C: Holstein–Tavis–Cummings cavity-modified electron transfer, THE CORE.
// docs/PHYSICS-SPEC.md §C and §6 (Sharma & Chen, J. Chem. Phys. 161, 104102, 2024).

import { marcusRateEa } from "./marcus";

export interface HTCParams {
  hbar_wc: number; // cavity photon energy [eV]
  E_AD: number; // |donor–acceptor gap| [eV]
  Delta: number; // detuning ħω_c − E_AD [eV]
  T01: number; // photon-mediated ET coupling (absorption) [eV]
  H_AD: number; // bare electronic coupling [eV]
  E_r: number; // reorganization energy [eV]
  kT: number; // thermal energy [eV]
}

/**
 * Collective polariton energies (RWA-I, §C.7, Eq. 26):
 * Ω± = Δ/2 ± √((Δ/2)² + (N−1)|T|²).  Splitting ∝ √(N−1) (Tavis–Cummings).
 */
export function polaritonEnergies(p: { Delta: number; N: number; T: number }): {
  OmegaPlus: number;
  OmegaMinus: number;
} {
  const half = p.Delta / 2;
  const root = Math.sqrt(half * half + Math.max(p.N - 1, 0) * p.T * p.T);
  return { OmegaPlus: half + root, OmegaMinus: half - root };
}

/** Polariton mixing angle Θ (§C.8). At resonance (Δ=0) Θ = π/4. Returns radians. */
export function mixingAngle(p: { Delta: number; N: number; T: number }): number {
  const half = p.Delta / 2;
  const root = Math.sqrt(half * half + Math.max(p.N - 1, 0) * p.T * p.T);
  const cos2 = root === 0 ? 0.5 : 0.5 + 0.5 * (half / root);
  return Math.acos(Math.sqrt(Math.min(1, Math.max(0, cos2))));
}

/** Effective ET couplings in the g_AD=0 limit (§C.6). */
export function effectiveCouplings(p: { H_AD: number; hbar_wc: number; t_AD: number }): {
  T00: number;
  T11: number;
  T01: number;
  T10: number;
} {
  const Tph = p.hbar_wc * p.t_AD;
  return { T00: p.H_AD, T11: p.H_AD, T01: Tph, T10: -Tph };
}

/**
 * Barrier-less turnover molecule number N_max (docs/PHYSICS-SPEC.md §6).
 *
 * DIMENSIONALLY CORRECT form:  N_max = 1 + (ħω_c · E_AD) / |T|²
 * which equals 1 + (ħω_c)²/|T|² at resonance (ħω_c = E_AD).
 *
 * Do NOT regress to the paper's printed Eq. 44 form (1 + ħω_c/|T|²): it has units
 * of 1/energy and only gives the right number because E_AD = 1 eV.  See §6.3.
 */
export function nMax(p: { hbar_wc: number; E_AD: number; T: number }): number {
  return 1 + (p.hbar_wc * p.E_AD) / (p.T * p.T);
}

/**
 * Dark-state count for System C (HTC electron transfer): **N−2**, because the one
 * reacting molecule is excluded from the collective manifold (1 bright + N−2 dark over
 * the N−1 spectators). Contrast the generic Tavis–Cummings count N−1 in collective.ts.
 * The paper's Eq. 38 prints the sum upper limit as N−1, but Appendix A (A6/A7) and the
 * RWA-I text define N−2; use N−2 for any System-C dark-state channel. (docs/SPEC-UPDATES.md §D1)
 */
export function darkStateCountC(N: number): number {
  return Math.max(0, N - 2);
}

export interface ETPoint {
  N: number;
  cavityPlus: number;
  cavityMinus: number;
  baseline: number;
  kTotal: number;
  channels: { cavityPlus: number; cavityMinus: number; baseline: number };
}

/**
 * Cavity-modified ET rate vs molecule number N, the turnover curve (§C.9).
 *
 * The photon-coupled ET path P± → {A₁}1 [Eq. 36] becomes barrier-less when the
 * collective polariton energy Ω± reaches ħω_c, i.e. its activation energy
 * E_a = Ω±(N) − ħω_c vanishes.  At resonance Ω₊ = √((N−1))|T₀₁| sweeps up through
 * ħω_c exactly at N = N_max, so the rate rises, peaks at N_max, then decays
 * (asymptotically ∝ e^{−N}, since E_a² ∝ N for large N).  The ordinary (non-cavity)
 * ET path (a), K(T₀₀=H_AD, E_a=E_r−E_AD), is N-independent and returned as `baseline`.
 */
export function etRateVsN(Ns: number[], p: HTCParams): ETPoint[] {
  return Ns.map((N) => {
    const { OmegaPlus, OmegaMinus } = polaritonEnergies({ Delta: p.Delta, N, T: p.T01 });
    const theta = mixingAngle({ Delta: p.Delta, N, T: p.T01 });
    const Vplus = p.H_AD * Math.cos(theta);
    const Vminus = p.H_AD * Math.sin(theta);
    const cavityPlus = marcusRateEa({ V: Vplus, E_a: OmegaPlus - p.hbar_wc, E_r: p.E_r, kT: p.kT });
    const cavityMinus = marcusRateEa({ V: Vminus, E_a: OmegaMinus - p.hbar_wc, E_r: p.E_r, kT: p.kT });
    const baseline = marcusRateEa({ V: p.H_AD, E_a: p.E_r - p.E_AD, E_r: p.E_r, kT: p.kT });
    return {
      N,
      cavityPlus,
      cavityMinus,
      baseline,
      kTotal: cavityPlus + cavityMinus,
      channels: { cavityPlus, cavityMinus, baseline },
    };
  });
}
