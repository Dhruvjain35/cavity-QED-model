// Marcus / Fermi-golden-rule electron-transfer rate kernel and diabatic surfaces.
// docs/PHYSICS-SPEC.md §C.3, §C.9 (Sharma & Chen 2024, Eqs. 4, 35).

import { HBAR_EV_S } from "./constants";

/**
 * Marcus/FGR rate expressed directly in terms of the activation energy E_a.
 * K = sqrt(π/(E_r·kT)) · |V|²/(2ħ) · exp(−E_a²/(4·kT·E_r))   [s⁻¹]
 * The rate is MAXIMAL (barrier-less) when E_a = 0.
 *
 * NORMALIZATION: this is Sharma & Chen Eq. 35 verbatim, which carries |V|²/(2ħ), i.e.
 * exactly HALF the textbook classical Marcus rate (|V|²/ħ, Semenov–Nitzan / Tokmakoff).
 * We keep the paper's normalization so output matches the paper's Fig. 2; the factor of 2
 * is an overall prefactor that cancels in every rate RATIO (quantum yields, branching) and
 * does not affect N_max, the activation energy, or the barrier-less condition.
 */
export function marcusRateEa(p: { V: number; E_a: number; E_r: number; kT: number }): number {
  const { V, E_a, E_r, kT } = p;
  const pref = Math.sqrt(Math.PI / (E_r * kT)) * (V * V) / (2 * HBAR_EV_S);
  return pref * Math.exp(-(E_a * E_a) / (4 * kT * E_r));
}

/**
 * Classical Marcus rate in terms of driving force E_fi (= ΔG) and reorganization energy.
 * Activation energy E_a = E_fi + E_r  (barrier-less when E_fi = −E_r).
 */
export function marcusRate(p: { V: number; E_fi: number; E_r: number; kT: number }): number {
  return marcusRateEa({ V: p.V, E_a: p.E_fi + p.E_r, E_r: p.E_r, kT: p.kT });
}

/** Marcus activation barrier ΔG‡ = (ΔG° + λ)² / (4λ). docs/PHYSICS-SPEC viz source. */
export function activationBarrier(dG: number, lambda: number): number {
  return ((dG + lambda) * (dG + lambda)) / (4 * lambda);
}

/**
 * Diabatic donor/acceptor potential-energy parabolas (equal curvature) over a
 * reaction coordinate q. docs/PHYSICS-SPEC.md §C.3 (Eqs. 4a–4b).
 * V_D = E_D + ½ω_v²q² ;  V_A = E_A + λ_v q + ½ω_v²q²
 */
export function diabats(
  q: number[],
  p: { E_D: number; E_A: number; omega_v: number; lambda_v: number },
): { VD: number[]; VA: number[] } {
  const k = 0.5 * p.omega_v * p.omega_v;
  const VD = q.map((x) => p.E_D + k * x * x);
  const VA = q.map((x) => p.E_A + p.lambda_v * x + k * x * x);
  return { VD, VA };
}
