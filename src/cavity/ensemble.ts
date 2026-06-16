// Shared molecular ensemble — the single source of truth for BOTH the physics and the 3D view.
// Each molecule i gets a position r_i, a transition-dipole unit vector μ̂_i, and the per-molecule
// light–matter coupling factor
//     g_i / g_0 = (μ̂_i · ε̂) · f(r_i),   ε̂ = cavity field polarization (ŷ),
//     f(r) = exp(−r²/w²) = TEM00 Gaussian mode amplitude transverse to the cavity axis.
// The SAME factors are fed to the WASM arrowhead (so a dipole ⟂ ε̂, or a molecule at the mode edge,
// genuinely decouples into the dark manifold) AND drive the arrows/orientation in the 3D — they are
// never out of sync. Deterministic in `seed` so a sweep stays on one realization.

export const POLAR: readonly [number, number, number] = [0, 1, 0]; // cavity mode polarization ε̂ = ŷ

export interface Ensemble {
  m: number;
  centers: [number, number, number][]; // molecule positions (cavity mid-plane, x ≈ 0 antinode)
  dipoles: [number, number, number][]; // unit transition-dipole vectors μ̂_i
  factors: Float64Array;               // g_i/g_0 = (μ̂_i·ε̂)·f(r_i), signed
  modeAmp: Float64Array;               // f(r_i) = exp(−r²/w²) — the spatial mode amplitude alone
}

// deterministic PRNG (mulberry32) — pure JS, fixed by seed
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the ensemble. `order` ∈ [0,1]: 1 = perfectly oriented crystal (all μ̂ ∥ ε̂), 0 = amorphous
 *  film (random 3D orientations). `waist` = Gaussian mode waist w (in the same length units as the
 *  layout); molecules far from the cavity axis couple weakly. */
export function buildEnsemble(m: number, seed: number, order: number, waist: number): Ensemble {
  const rng = mulberry32(Math.floor(seed) * 2654435761 + 12345);
  const cols = Math.max(1, Math.ceil(Math.sqrt(m))), rows = Math.ceil(m / cols), gap = 1.12;
  const centers: [number, number, number][] = [];
  const dipoles: [number, number, number][] = [];
  const factors = new Float64Array(m);
  const modeAmp = new Float64Array(m);
  const w2 = waist * waist;
  for (let i = 0; i < m; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const y = (r - (rows - 1) / 2) * gap, z = (c - (cols - 1) / 2) * gap, x = (rng() - 0.5) * 0.4;
    centers.push([x, y, z]);
    // uniform random unit vector on the sphere
    const u = rng() * 2 - 1, phi = rng() * 2 * Math.PI, s = Math.sqrt(Math.max(0, 1 - u * u));
    // μ̂ = normalize( lerp(random, ε̂, order) ): order→1 aligns to ŷ, order→0 fully random
    let dx = s * Math.cos(phi) * (1 - order);
    let dy = u * (1 - order) + order;
    let dz = s * Math.sin(phi) * (1 - order);
    const dn = Math.hypot(dx, dy, dz) || 1; dx /= dn; dy /= dn; dz /= dn;
    dipoles.push([dx, dy, dz]);
    const f = Math.exp(-(y * y + z * z) / w2); // transverse Gaussian mode amplitude
    modeAmp[i] = f;
    factors[i] = dy * f; // (μ̂·ε̂)·f(r), ε̂=ŷ ⇒ μ̂·ε̂ = dy
  }
  return { m, centers, dipoles, factors, modeAmp };
}

/** Collective bright-mode weights b_i = g_i/‖g‖ (the only matter direction the photon couples to).
 *  Returns a length-M unit vector; ‖g‖ ≈ 0 (all decoupled) yields zeros. */
export function brightWeights(factors: Float64Array): Float64Array {
  let nrm = 0;
  for (let i = 0; i < factors.length; i++) nrm += factors[i]! * factors[i]!;
  nrm = Math.sqrt(nrm);
  const b = new Float64Array(factors.length);
  if (nrm > 1e-12) for (let i = 0; i < factors.length; i++) b[i] = factors[i]! / nrm;
  return b;
}
