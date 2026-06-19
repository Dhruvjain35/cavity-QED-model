/* tslint:disable */
/* eslint-disable */

export class Sim {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Advance the dissipative dynamics by `dt_advance` of simulation time.
     */
    advance(dt_advance: number, atol: number, rtol: number): void;
    /**
     * Flattened |ρ_c[n,n′]| (row-major, n_fock²) of the current cavity-reduced state — a
     * hinton-style density-matrix diagnostic. ρ_c = Tr_atom ρ (validated vs QuTiP ptrace(0)).
     */
    cavity_rho_abs(): Float64Array;
    /**
     * Bloch vector of the single-excitation effective qubit {|0,e⟩, |1,g⟩} — the two states the vacuum
     * Rabi oscillation swaps the excitation between. Returns [x, y, z] = [2 Re ρ_01, 2 Im ρ_01, ρ_00 −
     * ρ_11] with 0 ≡ |0,e⟩ (basis index 2·0+0 = 0) and 1 ≡ |1,g⟩ (index 2·1+1 = 3). Tracing out the
     * cavity kills the BARE-atom g–e coherence (the photon-number entanglement is orthogonal), so this
     * manifold coherence ρ[|0,e⟩,|1,g⟩] is the honest one: its (x,z) projection spirals inward as κ,γ
     * leak population to |0,g⟩ and damp the coherence — the geometric signature of decoherence.
     */
    emitter_bloch(): Float64Array;
    excited_pop(): number;
    /**
     * Live Husimi Q-function grid (row-major n×n, r→y c→x) of the cavity-reduced state — a
     * strictly non-negative phase-space density that complements the (signed) Wigner.
     */
    husimi(xmin: number, xmax: number, n: number): Float64Array;
    min_eigenvalue(): number;
    /**
     * Build a single-emitter Jaynes–Cummings open system, initial state |0 photon, atom excited⟩.
     */
    constructor(n_fock: number, w_c: number, w_a: number, g: number, kappa: number, gamma: number, gamma_phi: number);
    photon_number(): number;
    /**
     * Purity Tr(ρ²) = Σ_ij |ρ_ij|² (= 1 pure, < 1 mixed). Falls as the open system decoheres.
     */
    purity(): number;
    /**
     * Reset to |0 photon, atom excited⟩ at t = 0. (cavity-first index 2·0 + 0 = 0)
     */
    reset(): void;
    /**
     * Flattened |ρ[i,j]| (row-major, (2·n_fock)²) of the FULL joint cavity⊗emitter state.
     * Unlike the cavity-reduced ρ_c (diagonal in vacuum-Rabi), the joint state carries the
     * oscillating-and-decaying coherence ρ[|0,e⟩,|1,g⟩] — the honest picture of decoherence.
     */
    rho_abs(): Float64Array;
    /**
     * Flattened Im ρ[i,j] (SIGNED, row-major (2·n_fock)²) of the FULL joint state. For the resonant JC
     * coupling phase the vacuum-Rabi coherence ρ[|0,e⟩,|1,g⟩] is PURELY IMAGINARY (= (i/2)·sin 2gt), so
     * the honest "where is the coherence" signal lives here, not in `rho_real`. Antisymmetric (Im ρ_ji =
     * −Im ρ_ij). Paired with `rho_real`, gives the UI the full complex ρ for a signed colour map.
     */
    rho_imag(): Float64Array;
    /**
     * Flattened Re ρ[i,j] (SIGNED, row-major (2·n_fock)²) of the FULL joint state. ρ is Hermitian, so
     * Re ρ is symmetric and the diagonal is the (real, ≥0) populations; off-diagonal real parts carry the
     * SIGN of the in-phase coherence. Pairs with `rho_imag` so the UI can render a diverging (signed)
     * density-matrix colour map instead of a magnitude-only one.
     */
    rho_real(): Float64Array;
    time(): number;
    trace(): number;
    /**
     * von Neumann entropy S = −Tr(ρ ln ρ) of the full joint state (0 = pure, > 0 = mixed).
     */
    von_neumann_entropy(): number;
    /**
     * Wigner grid (row-major, n×n, r→y c→x) of the current cavity-reduced state.
     */
    wigner(xmin: number, xmax: number, n: number): Float64Array;
    /**
     * Live cavity-reduced Wigner mapped to a flat RGBA buffer (n²·4 bytes) — ready for
     * `putImageData`. Colour mapping happens here so only RGBA crosses the boundary.
     * `w_max ≤ 0` auto-scales; otherwise fixed (use 1/π for the absolute physical scale).
     */
    wigner_rgba(xmin: number, xmax: number, n: number, w_max: number): Uint8Array;
}

/**
 * The exact single-excitation Hamiltonian matrix (the (M+1)×(M+1) real-symmetric arrowhead the engine
 * diagonalizes), flat row-major, for per-molecule couplings g_i. For export to NumPy/MATLAB so a
 * researcher can pull the current operator into a notebook. Index 0 = photon (diagonal w_c); index
 * i+1 = emitter i (diagonal w_i from σ-disorder); off-diagonal row/col 0 carry g_i.
 */
export function arrowhead_matrix_gi(w_c: number, w_a: number, sigma: number, seed: number, gi: Float64Array): Float64Array;

/**
 * Eigen-modes of the single-excitation arrowhead for real-time dynamics: a flat array
 * [eigs (M+1), then the (M+1)² row-major eigenvector matrix]. The UI evolves ψ(t) from these.
 */
export function arrowhead_modes(w_c: number, w_a: number, g: number, m: number, sigma: number, seed: number): Float64Array;

/**
 * Eigen-modes for PER-MOLECULE couplings g_i (orientation- and position-dependent). Site energies
 * w_i come from Gaussian energy disorder (w_a + σ·N(0,1)); the couplings g_i are passed in directly
 * (g_i = g_0·(μ̂_i·ε̂)·f(r_i), computed in the UI from the shared ensemble). Returns the same flat
 * [eigs(M+1), then (M+1)² eigenvectors] as `arrowhead_modes`. A perpendicular dipole (g_i=0) yields a
 * dark eigenstate localized on that molecule — the physics is identical to the validated arrowhead.
 */
export function arrowhead_modes_gi(w_c: number, w_a: number, sigma: number, seed: number, gi: Float64Array): Float64Array;

/**
 * |E(z)|² standing-wave field across the stack as a flat [z_0…z_{N-1}, i_0…i_{N-1}] array
 * (`per_layer` samples per layer), with incident index `n0` and substrate `ns`.
 */
export function cavity_field(lambda: number, n_hi: number, n_lo: number, pairs: number, n_cav: number, n0: number, ns: number, per_layer: number): Float64Array;

/**
 * DBR-cavity layer stack as a flat [n_0, d_0, n_1, d_1, …] array (index, thickness in nm).
 */
export function cavity_layers(lambda: number, n_hi: number, n_lo: number, pairs: number, n_cav: number): Float64Array;

/**
 * Cavity transmission/PL power spectrum: a flat array [ω (n/2 values), then power (n/2, peak=1)].
 * `n_fft` must be a power of two. Peaks land at the polariton energies (the vacuum-Rabi doublet);
 * disorder σ splits and broadens them. See `fft::power_spectrum`.
 */
export function cavity_power_spectrum(w_c: number, w_a: number, g: number, m: number, sigma: number, seed: number, n_fft: number, dt: number, gamma: number): Float64Array;

/**
 * Cavity power spectrum for per-molecule couplings g_i — flat [ω (n/2), power (n/2)]. As above, w_i
 * from (σ, seed); the doublet collapses as orientational/spatial disorder weakens the bright coupling.
 */
export function cavity_power_spectrum_gi(w_c: number, w_a: number, sigma: number, seed: number, gi: Float64Array, n_fft: number, dt: number, gamma: number): Float64Array;

/**
 * Power reflectance R(λ) of the DBR cavity at wavelength `lambda` (nm).
 */
export function cavity_reflectance(lambda: number, n_hi: number, n_lo: number, pairs: number, n_cav: number, n0: number, ns: number): number;

/**
 * Coupling sweep: the (M+1) eigen-energies at each of `steps` values of g in [g0, g1], flat and
 * row-major by step (length steps·(M+1)). The polariton dispersion fan. See `spectrum::coupling_sweep`.
 */
export function coupling_sweep(w_c: number, w_a: number, m: number, sigma: number, seed: number, g0: number, g1: number, steps: number): Float64Array;

/**
 * Coupling sweep for per-molecule geometry: g_i(g_0) = g_0·`factors[i]`. Returns the (M+1) energies
 * at each of `steps` values of g_0 in [g0, g1], flat row-major. The dispersion fan with realistic
 * (orientation/position-weighted) collective coupling.
 */
export function coupling_sweep_gi(w_c: number, w_a: number, sigma: number, seed: number, factors: Float64Array, g0: number, g1: number, steps: number): Float64Array;

/**
 * Analytic bare-molecule (g=0) Franck–Condon reference: flat [position (n_max), weight (n_max)].
 */
export function htc_franck_condon(w_x: number, w_v: number, lambda: number, n_max: number): Float64Array;

/**
 * HTC Hamiltonian matrix-inspector view: flat [out_dim, then out_dim² row-major values], block-max
 * downsampled to ≤`cap`×`cap`. Reveals the Holstein/Franck–Condon off-diagonal blocks. See htc::htc_matrix_view.
 */
export function htc_matrix_view(w_c: number, w_x: number, w_v: number, lambda: number, g: number, n_mol: number, n_vib: number, cap: number): Float64Array;

/**
 * Single-molecule Holstein–Tavis–Cummings absorption: flat [eigs (2·n_vib), photon_frac (2·n_vib),
 * absorption (2·n_vib)]. Vibronic polaritons + Franck–Condon sidebands. See `htc::htc`.
 */
export function htc_spectrum(w_c: number, w_x: number, w_v: number, lambda: number, g: number, n_vib: number): Float64Array;

/**
 * EXPLICIT N-molecule HTC absorption (exact, no 1/N shortcut) — flat [eigs (d), photon_frac (d),
 * absorption (d)] with d = (n_mol+1)·n_vib^n_mol. Tractable for small n_mol only. See `htc::htc_multi`.
 */
export function htc_spectrum_multi(w_c: number, w_x: number, w_v: number, lambda: number, g: number, n_mol: number, n_vib: number): Float64Array;

/**
 * Single-excitation arrowhead spectrum (Regime 2) for M emitters with Gaussian energy disorder.
 * Returns a flat `Float64Array` of length 2·(M+1): the (M+1) eigenvalues (ascending), then the
 * (M+1) Hopfield photon fractions in the same order. `seed` fixes the disorder realization so a
 * detuning sweep stays continuous; bump it to re-roll. See `spectrum::disordered_spectrum`.
 */
export function spectrum(w_c: number, w_a: number, g: number, m: number, sigma: number, seed: number): Float64Array;

/**
 * Wigner of an arbitrary cavity density matrix supplied from JS (row-major re/im).
 */
export function wigner_of_rho(re: Float64Array, im: Float64Array, dim: number, xmin: number, xmax: number, n: number): Float64Array;

/**
 * RGBA Wigner of an arbitrary cavity density matrix from JS (row-major re/im).
 */
export function wigner_rgba_of_rho(re: Float64Array, im: Float64Array, dim: number, xmin: number, xmax: number, n: number, w_max: number): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_sim_free: (a: number, b: number) => void;
    readonly arrowhead_matrix_gi: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly arrowhead_modes: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly arrowhead_modes_gi: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly cavity_field: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly cavity_layers: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly cavity_power_spectrum: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly cavity_power_spectrum_gi: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly coupling_sweep: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly coupling_sweep_gi: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly htc_franck_condon: (a: number, b: number, c: number, d: number) => [number, number];
    readonly htc_matrix_view: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly htc_spectrum: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly htc_spectrum_multi: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly sim_advance: (a: number, b: number, c: number, d: number) => void;
    readonly sim_cavity_rho_abs: (a: number) => [number, number];
    readonly sim_emitter_bloch: (a: number) => [number, number];
    readonly sim_excited_pop: (a: number) => number;
    readonly sim_husimi: (a: number, b: number, c: number, d: number) => [number, number];
    readonly sim_min_eigenvalue: (a: number) => number;
    readonly sim_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly sim_photon_number: (a: number) => number;
    readonly sim_purity: (a: number) => number;
    readonly sim_reset: (a: number) => void;
    readonly sim_rho_abs: (a: number) => [number, number];
    readonly sim_rho_imag: (a: number) => [number, number];
    readonly sim_rho_real: (a: number) => [number, number];
    readonly sim_time: (a: number) => number;
    readonly sim_trace: (a: number) => number;
    readonly sim_von_neumann_entropy: (a: number) => number;
    readonly sim_wigner: (a: number, b: number, c: number, d: number) => [number, number];
    readonly sim_wigner_rgba: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly spectrum: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly wigner_of_rho: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly wigner_rgba_of_rho: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly cavity_reflectance: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
