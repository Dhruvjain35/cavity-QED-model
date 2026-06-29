// Empirical proof that the QuTiP-validated physics survives the JS↔WASM boundary.
// Runs the solver + Wigner THROUGH the compiled wasm and compares to the golden.
const path = require("path");
const fs = require("fs");
const wasm = require(path.join(__dirname, "pkg", "cqed_core.js"));
const g = JSON.parse(fs.readFileSync(path.join(__dirname, "golden", "golden.json"), "utf8"));

// ── 1. solver through WASM ──
const p = g.params;
const sim = new wasm.Sim(p.N, p.w_c, p.w_a, p.g, p.kappa, p.gamma, p.gamma_phi);
const tl = g.dynamics.tlist;
let maxN = 0, maxPe = 0, minEig = Infinity;
for (let i = 0; i < tl.length; i++) {
  if (i > 0) sim.advance(tl[i] - tl[i - 1], 1e-10, 1e-10);
  maxN = Math.max(maxN, Math.abs(sim.photon_number() - g.dynamics.n_t[i]));
  maxPe = Math.max(maxPe, Math.abs(sim.excited_pop() - g.dynamics.pe_t[i]));
  minEig = Math.min(minEig, sim.min_eigenvalue());
}
const traceEnd = sim.trace();

// ── 2. wigner_of_rho through WASM (golden coherent state) ──
const cr = g.wigner.coherent.rho;
const dim = cr.shape[0];
const re = new Float64Array(dim * dim), im = new Float64Array(dim * dim);
for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) { re[i * dim + j] = cr.re[i][j]; im[i * dim + j] = cr.im[i][j]; }
const xv = g.wigner.xvec, nx = xv.length;
const W = wasm.wigner_of_rho(re, im, dim, xv[0], xv[nx - 1], nx);
let maxW = 0;
for (let r = 0; r < nx; r++) for (let c = 0; c < nx; c++) maxW = Math.max(maxW, Math.abs(W[r * nx + c] - g.wigner.coherent.W[r][c]));

// ── 3. Sim.wigner of the live cavity-reduced state: ∫∫W = Tr(ρ_c) = 1 ──
const Wlive = sim.wigner(-5, 5, 100);
const dx = 10 / 99;
let integ = 0; for (const v of Wlive) integ += v; integ *= dx * dx;

console.log("=== WASM-boundary validation vs QuTiP golden ===");
console.log("solver  max |Δ⟨a†a⟩| =", maxN.toExponential(3), " max |Δ⟨P_e⟩| =", maxPe.toExponential(3));
console.log("        Tr(ρ) =", traceEnd.toFixed(13), " min eig =", minEig.toExponential(3));
console.log("wigner  max |ΔW| (coherent) =", maxW.toExponential(3));
console.log("        live ∫∫W (≈1) =", integ.toFixed(6));

const ok =
  maxN < 1e-6 && maxPe < 1e-6 && maxW < 1e-4 &&
  Math.abs(traceEnd - 1) < 1e-10 && minEig > -1e-8 && Math.abs(integ - 1) < 1e-2;
console.log(ok ? "PASS: validated physics survives the WASM boundary" : "FAIL");
process.exit(ok ? 0 : 1);
