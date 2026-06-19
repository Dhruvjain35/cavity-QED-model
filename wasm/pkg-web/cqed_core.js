/* @ts-self-types="./cqed_core.d.ts" */

export class Sim {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SimFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sim_free(ptr, 0);
    }
    /**
     * Advance the dissipative dynamics by `dt_advance` of simulation time.
     * @param {number} dt_advance
     * @param {number} atol
     * @param {number} rtol
     */
    advance(dt_advance, atol, rtol) {
        wasm.sim_advance(this.__wbg_ptr, dt_advance, atol, rtol);
    }
    /**
     * Flattened |ρ_c[n,n′]| (row-major, n_fock²) of the current cavity-reduced state — a
     * hinton-style density-matrix diagnostic. ρ_c = Tr_atom ρ (validated vs QuTiP ptrace(0)).
     * @returns {Float64Array}
     */
    cavity_rho_abs() {
        const ret = wasm.sim_cavity_rho_abs(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Bloch vector of the single-excitation effective qubit {|0,e⟩, |1,g⟩} — the two states the vacuum
     * Rabi oscillation swaps the excitation between. Returns [x, y, z] = [2 Re ρ_01, 2 Im ρ_01, ρ_00 −
     * ρ_11] with 0 ≡ |0,e⟩ (basis index 2·0+0 = 0) and 1 ≡ |1,g⟩ (index 2·1+1 = 3). Tracing out the
     * cavity kills the BARE-atom g–e coherence (the photon-number entanglement is orthogonal), so this
     * manifold coherence ρ[|0,e⟩,|1,g⟩] is the honest one: its (x,z) projection spirals inward as κ,γ
     * leak population to |0,g⟩ and damp the coherence — the geometric signature of decoherence.
     * @returns {Float64Array}
     */
    emitter_bloch() {
        const ret = wasm.sim_emitter_bloch(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {number}
     */
    excited_pop() {
        const ret = wasm.sim_excited_pop(this.__wbg_ptr);
        return ret;
    }
    /**
     * Live Husimi Q-function grid (row-major n×n, r→y c→x) of the cavity-reduced state — a
     * strictly non-negative phase-space density that complements the (signed) Wigner.
     * @param {number} xmin
     * @param {number} xmax
     * @param {number} n
     * @returns {Float64Array}
     */
    husimi(xmin, xmax, n) {
        const ret = wasm.sim_husimi(this.__wbg_ptr, xmin, xmax, n);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {number}
     */
    min_eigenvalue() {
        const ret = wasm.sim_min_eigenvalue(this.__wbg_ptr);
        return ret;
    }
    /**
     * Build a single-emitter Jaynes–Cummings open system, initial state |0 photon, atom excited⟩.
     * @param {number} n_fock
     * @param {number} w_c
     * @param {number} w_a
     * @param {number} g
     * @param {number} kappa
     * @param {number} gamma
     * @param {number} gamma_phi
     */
    constructor(n_fock, w_c, w_a, g, kappa, gamma, gamma_phi) {
        const ret = wasm.sim_new(n_fock, w_c, w_a, g, kappa, gamma, gamma_phi);
        this.__wbg_ptr = ret;
        SimFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    photon_number() {
        const ret = wasm.sim_photon_number(this.__wbg_ptr);
        return ret;
    }
    /**
     * Purity Tr(ρ²) = Σ_ij |ρ_ij|² (= 1 pure, < 1 mixed). Falls as the open system decoheres.
     * @returns {number}
     */
    purity() {
        const ret = wasm.sim_purity(this.__wbg_ptr);
        return ret;
    }
    /**
     * Reset to |0 photon, atom excited⟩ at t = 0. (cavity-first index 2·0 + 0 = 0)
     */
    reset() {
        wasm.sim_reset(this.__wbg_ptr);
    }
    /**
     * Flattened |ρ[i,j]| (row-major, (2·n_fock)²) of the FULL joint cavity⊗emitter state.
     * Unlike the cavity-reduced ρ_c (diagonal in vacuum-Rabi), the joint state carries the
     * oscillating-and-decaying coherence ρ[|0,e⟩,|1,g⟩] — the honest picture of decoherence.
     * @returns {Float64Array}
     */
    rho_abs() {
        const ret = wasm.sim_rho_abs(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Flattened Im ρ[i,j] (SIGNED, row-major (2·n_fock)²) of the FULL joint state. For the resonant JC
     * coupling phase the vacuum-Rabi coherence ρ[|0,e⟩,|1,g⟩] is PURELY IMAGINARY (= (i/2)·sin 2gt), so
     * the honest "where is the coherence" signal lives here, not in `rho_real`. Antisymmetric (Im ρ_ji =
     * −Im ρ_ij). Paired with `rho_real`, gives the UI the full complex ρ for a signed colour map.
     * @returns {Float64Array}
     */
    rho_imag() {
        const ret = wasm.sim_rho_imag(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Flattened Re ρ[i,j] (SIGNED, row-major (2·n_fock)²) of the FULL joint state. ρ is Hermitian, so
     * Re ρ is symmetric and the diagonal is the (real, ≥0) populations; off-diagonal real parts carry the
     * SIGN of the in-phase coherence. Pairs with `rho_imag` so the UI can render a diverging (signed)
     * density-matrix colour map instead of a magnitude-only one.
     * @returns {Float64Array}
     */
    rho_real() {
        const ret = wasm.sim_rho_real(this.__wbg_ptr);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * @returns {number}
     */
    time() {
        const ret = wasm.sim_time(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    trace() {
        const ret = wasm.sim_trace(this.__wbg_ptr);
        return ret;
    }
    /**
     * von Neumann entropy S = −Tr(ρ ln ρ) of the full joint state (0 = pure, > 0 = mixed).
     * @returns {number}
     */
    von_neumann_entropy() {
        const ret = wasm.sim_von_neumann_entropy(this.__wbg_ptr);
        return ret;
    }
    /**
     * Wigner grid (row-major, n×n, r→y c→x) of the current cavity-reduced state.
     * @param {number} xmin
     * @param {number} xmax
     * @param {number} n
     * @returns {Float64Array}
     */
    wigner(xmin, xmax, n) {
        const ret = wasm.sim_wigner(this.__wbg_ptr, xmin, xmax, n);
        var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
        return v1;
    }
    /**
     * Live cavity-reduced Wigner mapped to a flat RGBA buffer (n²·4 bytes) — ready for
     * `putImageData`. Colour mapping happens here so only RGBA crosses the boundary.
     * `w_max ≤ 0` auto-scales; otherwise fixed (use 1/π for the absolute physical scale).
     * @param {number} xmin
     * @param {number} xmax
     * @param {number} n
     * @param {number} w_max
     * @returns {Uint8Array}
     */
    wigner_rgba(xmin, xmax, n, w_max) {
        const ret = wasm.sim_wigner_rgba(this.__wbg_ptr, xmin, xmax, n, w_max);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
    }
}
if (Symbol.dispose) Sim.prototype[Symbol.dispose] = Sim.prototype.free;

/**
 * The exact single-excitation Hamiltonian matrix (the (M+1)×(M+1) real-symmetric arrowhead the engine
 * diagonalizes), flat row-major, for per-molecule couplings g_i. For export to NumPy/MATLAB so a
 * researcher can pull the current operator into a notebook. Index 0 = photon (diagonal w_c); index
 * i+1 = emitter i (diagonal w_i from σ-disorder); off-diagonal row/col 0 carry g_i.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} sigma
 * @param {number} seed
 * @param {Float64Array} gi
 * @returns {Float64Array}
 */
export function arrowhead_matrix_gi(w_c, w_a, sigma, seed, gi) {
    const ptr0 = passArrayF64ToWasm0(gi, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.arrowhead_matrix_gi(w_c, w_a, sigma, seed, ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Eigen-modes of the single-excitation arrowhead for real-time dynamics: a flat array
 * [eigs (M+1), then the (M+1)² row-major eigenvector matrix]. The UI evolves ψ(t) from these.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} g
 * @param {number} m
 * @param {number} sigma
 * @param {number} seed
 * @returns {Float64Array}
 */
export function arrowhead_modes(w_c, w_a, g, m, sigma, seed) {
    const ret = wasm.arrowhead_modes(w_c, w_a, g, m, sigma, seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Eigen-modes for PER-MOLECULE couplings g_i (orientation- and position-dependent). Site energies
 * w_i come from Gaussian energy disorder (w_a + σ·N(0,1)); the couplings g_i are passed in directly
 * (g_i = g_0·(μ̂_i·ε̂)·f(r_i), computed in the UI from the shared ensemble). Returns the same flat
 * [eigs(M+1), then (M+1)² eigenvectors] as `arrowhead_modes`. A perpendicular dipole (g_i=0) yields a
 * dark eigenstate localized on that molecule — the physics is identical to the validated arrowhead.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} sigma
 * @param {number} seed
 * @param {Float64Array} gi
 * @returns {Float64Array}
 */
export function arrowhead_modes_gi(w_c, w_a, sigma, seed, gi) {
    const ptr0 = passArrayF64ToWasm0(gi, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.arrowhead_modes_gi(w_c, w_a, sigma, seed, ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * |E(z)|² standing-wave field across the stack as a flat [z_0…z_{N-1}, i_0…i_{N-1}] array
 * (`per_layer` samples per layer), with incident index `n0` and substrate `ns`.
 * @param {number} lambda
 * @param {number} n_hi
 * @param {number} n_lo
 * @param {number} pairs
 * @param {number} n_cav
 * @param {number} n0
 * @param {number} ns
 * @param {number} per_layer
 * @returns {Float64Array}
 */
export function cavity_field(lambda, n_hi, n_lo, pairs, n_cav, n0, ns, per_layer) {
    const ret = wasm.cavity_field(lambda, n_hi, n_lo, pairs, n_cav, n0, ns, per_layer);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * DBR-cavity layer stack as a flat [n_0, d_0, n_1, d_1, …] array (index, thickness in nm).
 * @param {number} lambda
 * @param {number} n_hi
 * @param {number} n_lo
 * @param {number} pairs
 * @param {number} n_cav
 * @returns {Float64Array}
 */
export function cavity_layers(lambda, n_hi, n_lo, pairs, n_cav) {
    const ret = wasm.cavity_layers(lambda, n_hi, n_lo, pairs, n_cav);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Cavity transmission/PL power spectrum: a flat array [ω (n/2 values), then power (n/2, peak=1)].
 * `n_fft` must be a power of two. Peaks land at the polariton energies (the vacuum-Rabi doublet);
 * disorder σ splits and broadens them. See `fft::power_spectrum`.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} g
 * @param {number} m
 * @param {number} sigma
 * @param {number} seed
 * @param {number} n_fft
 * @param {number} dt
 * @param {number} gamma
 * @returns {Float64Array}
 */
export function cavity_power_spectrum(w_c, w_a, g, m, sigma, seed, n_fft, dt, gamma) {
    const ret = wasm.cavity_power_spectrum(w_c, w_a, g, m, sigma, seed, n_fft, dt, gamma);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Cavity power spectrum for per-molecule couplings g_i — flat [ω (n/2), power (n/2)]. As above, w_i
 * from (σ, seed); the doublet collapses as orientational/spatial disorder weakens the bright coupling.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} sigma
 * @param {number} seed
 * @param {Float64Array} gi
 * @param {number} n_fft
 * @param {number} dt
 * @param {number} gamma
 * @returns {Float64Array}
 */
export function cavity_power_spectrum_gi(w_c, w_a, sigma, seed, gi, n_fft, dt, gamma) {
    const ptr0 = passArrayF64ToWasm0(gi, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.cavity_power_spectrum_gi(w_c, w_a, sigma, seed, ptr0, len0, n_fft, dt, gamma);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Power reflectance R(λ) of the DBR cavity at wavelength `lambda` (nm).
 * @param {number} lambda
 * @param {number} n_hi
 * @param {number} n_lo
 * @param {number} pairs
 * @param {number} n_cav
 * @param {number} n0
 * @param {number} ns
 * @returns {number}
 */
export function cavity_reflectance(lambda, n_hi, n_lo, pairs, n_cav, n0, ns) {
    const ret = wasm.cavity_reflectance(lambda, n_hi, n_lo, pairs, n_cav, n0, ns);
    return ret;
}

/**
 * Coupling sweep: the (M+1) eigen-energies at each of `steps` values of g in [g0, g1], flat and
 * row-major by step (length steps·(M+1)). The polariton dispersion fan. See `spectrum::coupling_sweep`.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} m
 * @param {number} sigma
 * @param {number} seed
 * @param {number} g0
 * @param {number} g1
 * @param {number} steps
 * @returns {Float64Array}
 */
export function coupling_sweep(w_c, w_a, m, sigma, seed, g0, g1, steps) {
    const ret = wasm.coupling_sweep(w_c, w_a, m, sigma, seed, g0, g1, steps);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Coupling sweep for per-molecule geometry: g_i(g_0) = g_0·`factors[i]`. Returns the (M+1) energies
 * at each of `steps` values of g_0 in [g0, g1], flat row-major. The dispersion fan with realistic
 * (orientation/position-weighted) collective coupling.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} sigma
 * @param {number} seed
 * @param {Float64Array} factors
 * @param {number} g0
 * @param {number} g1
 * @param {number} steps
 * @returns {Float64Array}
 */
export function coupling_sweep_gi(w_c, w_a, sigma, seed, factors, g0, g1, steps) {
    const ptr0 = passArrayF64ToWasm0(factors, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.coupling_sweep_gi(w_c, w_a, sigma, seed, ptr0, len0, g0, g1, steps);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Analytic bare-molecule (g=0) Franck–Condon reference: flat [position (n_max), weight (n_max)].
 * @param {number} w_x
 * @param {number} w_v
 * @param {number} lambda
 * @param {number} n_max
 * @returns {Float64Array}
 */
export function htc_franck_condon(w_x, w_v, lambda, n_max) {
    const ret = wasm.htc_franck_condon(w_x, w_v, lambda, n_max);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * HTC Hamiltonian matrix-inspector view: flat [out_dim, then out_dim² row-major values], block-max
 * downsampled to ≤`cap`×`cap`. Reveals the Holstein/Franck–Condon off-diagonal blocks. See htc::htc_matrix_view.
 * @param {number} w_c
 * @param {number} w_x
 * @param {number} w_v
 * @param {number} lambda
 * @param {number} g
 * @param {number} n_mol
 * @param {number} n_vib
 * @param {number} cap
 * @returns {Float64Array}
 */
export function htc_matrix_view(w_c, w_x, w_v, lambda, g, n_mol, n_vib, cap) {
    const ret = wasm.htc_matrix_view(w_c, w_x, w_v, lambda, g, n_mol, n_vib, cap);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Single-molecule Holstein–Tavis–Cummings absorption: flat [eigs (2·n_vib), photon_frac (2·n_vib),
 * absorption (2·n_vib)]. Vibronic polaritons + Franck–Condon sidebands. See `htc::htc`.
 * @param {number} w_c
 * @param {number} w_x
 * @param {number} w_v
 * @param {number} lambda
 * @param {number} g
 * @param {number} n_vib
 * @returns {Float64Array}
 */
export function htc_spectrum(w_c, w_x, w_v, lambda, g, n_vib) {
    const ret = wasm.htc_spectrum(w_c, w_x, w_v, lambda, g, n_vib);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * EXPLICIT N-molecule HTC absorption (exact, no 1/N shortcut) — flat [eigs (d), photon_frac (d),
 * absorption (d)] with d = (n_mol+1)·n_vib^n_mol. Tractable for small n_mol only. See `htc::htc_multi`.
 * @param {number} w_c
 * @param {number} w_x
 * @param {number} w_v
 * @param {number} lambda
 * @param {number} g
 * @param {number} n_mol
 * @param {number} n_vib
 * @returns {Float64Array}
 */
export function htc_spectrum_multi(w_c, w_x, w_v, lambda, g, n_mol, n_vib) {
    const ret = wasm.htc_spectrum_multi(w_c, w_x, w_v, lambda, g, n_mol, n_vib);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Single-excitation arrowhead spectrum (Regime 2) for M emitters with Gaussian energy disorder.
 * Returns a flat `Float64Array` of length 2·(M+1): the (M+1) eigenvalues (ascending), then the
 * (M+1) Hopfield photon fractions in the same order. `seed` fixes the disorder realization so a
 * detuning sweep stays continuous; bump it to re-roll. See `spectrum::disordered_spectrum`.
 * @param {number} w_c
 * @param {number} w_a
 * @param {number} g
 * @param {number} m
 * @param {number} sigma
 * @param {number} seed
 * @returns {Float64Array}
 */
export function spectrum(w_c, w_a, g, m, sigma, seed) {
    const ret = wasm.spectrum(w_c, w_a, g, m, sigma, seed);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Wigner of an arbitrary cavity density matrix supplied from JS (row-major re/im).
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {number} dim
 * @param {number} xmin
 * @param {number} xmax
 * @param {number} n
 * @returns {Float64Array}
 */
export function wigner_of_rho(re, im, dim, xmin, xmax, n) {
    const ptr0 = passArrayF64ToWasm0(re, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(im, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wigner_of_rho(ptr0, len0, ptr1, len1, dim, xmin, xmax, n);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

/**
 * RGBA Wigner of an arbitrary cavity density matrix from JS (row-major re/im).
 * @param {Float64Array} re
 * @param {Float64Array} im
 * @param {number} dim
 * @param {number} xmin
 * @param {number} xmax
 * @param {number} n
 * @param {number} w_max
 * @returns {Uint8Array}
 */
export function wigner_rgba_of_rho(re, im, dim, xmin, xmax, n, w_max) {
    const ptr0 = passArrayF64ToWasm0(re, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(im, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.wigner_rgba_of_rho(ptr0, len0, ptr1, len1, dim, xmin, xmax, n, w_max);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_ea4887a5f8f9a9db: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./cqed_core_bg.js": import0,
    };
}

const SimFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sim_free(ptr, 1));

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('cqed_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
