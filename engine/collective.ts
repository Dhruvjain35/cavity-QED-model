// System B: Jaynes–Tavis–Cummings collective coupling. docs/PHYSICS-SPEC.md §B.
// The √N collective enhancement and the N−1 dark states.

/** Collective light–matter coupling g_N = g√N (§B.5). */
export function collectiveCoupling(g: number, N: number): number {
  return g * Math.sqrt(N);
}

/** Collective vacuum Rabi splitting Ω_R = 2g√N (§B.5). Scales as √(density). */
export function rabiSplitting(g: number, N: number): number {
  return 2 * g * Math.sqrt(N);
}

/** Number of dark states in the single-excitation manifold: N−1 (§B.6). */
export function darkStateCount(N: number): number {
  return Math.max(0, N - 1);
}

/**
 * Jaynes–Cummings doublet splitting at detuning Δ for excitation n (§B.2).
 * √(Δ² + 4g²n); at resonance (Δ=0, n=1) this is the vacuum Rabi splitting 2g.
 */
export function jcSplitting(g: number, delta: number, n = 1): number {
  return Math.sqrt(delta * delta + 4 * g * g * n);
}
