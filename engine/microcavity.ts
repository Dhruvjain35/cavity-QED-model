// System A: microcavity exciton-polaritons. docs/PHYSICS-SPEC.md §A.
// Coupled-oscillator (Hopfield) model: dispersion, LP/UP branches, Hopfield fractions.

import { HBAR_J_S, ME_KG, J_PER_EV, HBARC_EV_NM } from "./constants";

/**
 * Parabolic cavity-photon in-plane dispersion (§A.1).
 * E_cav(k‖) = E_cav0 + ħ²k‖²/(2 m_cav).
 * @param kPar in-plane wavevector samples [m⁻¹]
 * @param mcav photon effective mass [units of electron mass m_e]
 * @returns energies [eV]
 */
export function cavityDispersion(kPar: number[], p: { Ecav0: number; mcav: number }): number[] {
  const m = p.mcav * ME_KG;
  return kPar.map((k) => p.Ecav0 + (HBAR_J_S * HBAR_J_S * k * k) / (2 * m) / J_PER_EV);
}

/**
 * Lower/upper polariton branches, eigenvalues of the 2×2 coupled-oscillator
 * Hamiltonian (§A.4). E = ½[E_cav+E_exc ± √((E_cav−E_exc)²+(2V)²)].
 * At resonance the gap E_UP−E_LP = 2V and the branches anticross (never cross).
 */
export function polaritonBranches(
  kPar: number[],
  p: { Ecav0: number; Eexc: number; mcav: number; V: number },
): { ELP: number[]; EUP: number[] } {
  const Ec = cavityDispersion(kPar, { Ecav0: p.Ecav0, mcav: p.mcav });
  const ELP: number[] = [];
  const EUP: number[] = [];
  for (let i = 0; i < kPar.length; i++) {
    const ec = Ec[i]!;
    const ex = p.Eexc;
    const root = Math.sqrt((ec - ex) * (ec - ex) + (2 * p.V) * (2 * p.V));
    ELP.push(0.5 * (ec + ex - root));
    EUP.push(0.5 * (ec + ex + root));
  }
  return { ELP, EUP };
}

/**
 * Hopfield coefficients for the lower polariton (§A.6).
 * |X|² = ½(1 + δ/√(δ²+(2V)²)) matter fraction; |C|² = 1 − |X|² photon fraction.
 * (Upper polariton swaps X and C.) At δ=0 both are 0.5.
 */
export function hopfield(delta: number, V: number): { X2: number; C2: number } {
  const denom = Math.sqrt(delta * delta + (2 * V) * (2 * V));
  const X2 = 0.5 * (1 + delta / denom);
  return { X2, C2: 1 - X2 };
}

/** Cavity–exciton detuning δ = E_cav − E_exc (§A.5). */
export function detuning(Ecav: number, Eexc: number): number {
  return Ecav - Eexc;
}

/**
 * In-plane momentum from external emission angle (§A.7). Returns k‖ in **m⁻¹**,
 * consistent with cavityDispersion's k input (E/ħc with ħc in eV·nm gives nm⁻¹; ×1e9 → m⁻¹).
 * NOTE: keep this in m⁻¹ when chaining into cavityDispersion for V1's twin angle axis,
 * else the dispersion is off by 1e9 (bug caught in deep-verify).
 */
export function angleToK(E: number, thetaDeg: number): number {
  return (E / HBARC_EV_NM) * Math.sin((thetaDeg * Math.PI) / 180) * 1e9;
}
