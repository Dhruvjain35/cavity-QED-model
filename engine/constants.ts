// Physical constants and unit conversions. See docs/PHYSICS-SPEC.md.
// Energies are in eV throughout the engine unless a function documents otherwise.

export const HBAR_EV_S = 6.582119569e-16; // reduced Planck constant [eV·s]
export const HBAR_J_S = 1.054571817e-34; // reduced Planck constant [J·s]
export const KB_EV_PER_K = 8.617333262e-5; // Boltzmann constant [eV/K]
export const HBARC_EV_NM = 197.3269804; // ħc [eV·nm]
export const ME_KG = 9.1093837015e-31; // electron mass [kg]
export const J_PER_EV = 1.602176634e-19; // [J/eV]

// 1 eV = 8065.543937 cm^-1
export const CM1_PER_EV = 8065.543937;
export const cm1ToEv = (x: number): number => x / CM1_PER_EV;
export const evToCm1 = (x: number): number => x * CM1_PER_EV;

// Baseline HTC parameters (docs/PHYSICS-SPEC.md §7, §8 — paper Fig.2/4 anchors).
export const DEFAULT_HTC = {
  hbar_wc: 1.0, // cavity photon energy [eV]
  E_AD: 1.0, // |donor–acceptor gap| [eV]
  Delta: 0.0, // detuning ħω_c − E_AD [eV] (resonance)
  T01: 0.024731, // photon-mediated ET coupling, absorption [eV]  → N_max = 1636
  T10: 0.0096297, // photon-mediated ET coupling, emission  [eV]  → N_max = 10785
  H_AD: 0.0304, // bare electronic coupling (245 cm^-1) [eV]
  E_r: 1.0, // reorganization energy [eV]
  omega_v_cm1: 80.6, // primary vibrational frequency [cm^-1]
  kT: 0.025, // thermal energy (~290 K) [eV]
} as const;

// Baseline microcavity parameters (docs/PHYSICS-SPEC.md §7).
export const DEFAULT_MICROCAVITY = {
  Ecav0: 1.5, // cavity cutoff energy at k‖=0 [eV]
  Eexc: 1.5, // exciton energy [eV]
  V: 0.005, // light–matter coupling; Rabi splitting 2V = 10 meV [eV]
  mcav: 3.6e-5, // photon effective mass [units of electron mass]
  n: 3.5, // refractive index
} as const;
