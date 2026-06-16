"""Golden reference for the single-excitation Tavis-Cummings ARROWHEAD spectrum (Regime 2).

Independent arbiter = numpy.linalg.eigh on the (M+1)x(M+1) real-symmetric arrowhead matrix.
Convention (must match wasm/src/spectrum.rs):
  index 0   = photon state |1 photon, all emitters ground>,  diagonal = w_c (cavity), on the corner.
  index i+1 = matter state |0 photon, emitter i excited>,    diagonal = w_i (bare emitter energy).
  arrow     = couplings g_i connecting ONLY the photon state to each matter state.
  eigh returns ascending eigenvalues; photon_frac[k] = |eigenvector_k[0]|^2 (Hopfield photon weight).

Physics this pins (see docs/GROUNDING-RESEARCH.md §2):
  - identical emitters on resonance -> 2 bright polaritons at w0 ± g*sqrt(M), full splitting 2*g*sqrt(M).
  - exactly M-1 dark states, degenerate at the bare emitter energy, with photon_frac = 0.
"""
import json, math, os
import numpy as np

def arrowhead(wc, w, g):
    w = np.asarray(w, float); g = np.asarray(g, float)
    m = len(w)
    h = np.zeros((m + 1, m + 1))
    h[0, 0] = wc
    for i in range(m):
        h[i + 1, i + 1] = w[i]
        h[0, i + 1] = g[i]
        h[i + 1, 0] = g[i]
    return h

def solve(wc, w, g):
    vals, vecs = np.linalg.eigh(arrowhead(wc, w, g))  # ascending; columns orthonormal
    photon = (vecs[0, :] ** 2)
    return vals, photon

cases = []
def add(label, wc, w, g):
    vals, photon = solve(wc, w, g)
    cases.append({"label": label, "wc": wc, "w": list(map(float, w)), "g": list(map(float, g)),
                  "eigs": vals.tolist(), "photon_frac": photon.tolist()})

# 1. identical, resonant, M=4 -> bright at 1±0.2, three dark at 1.0, splitting 0.4
add("identical_resonant_M4", 1.0, [1.0] * 4, [0.1] * 4)
# 2. detuned identical, M=4
add("detuned_identical_M4", 1.0, [0.9] * 4, [0.1] * 4)
# 3. disordered, M=8, sigma=0.05, fixed seed (w_i stored explicitly so Rust feeds the same inputs)
w8 = (1.0 + np.random.default_rng(42).normal(0, 0.05, 8))
add("disordered_M8", 1.0, w8, [0.08] * 8)
# 4. disordered, M=24, sigma=0.08
w24 = (1.0 + np.random.default_rng(7).normal(0, 0.08, 24))
add("disordered_M24", 1.0, w24, [0.06] * 24)

out = {
    "convention": "index0=photon(w_c on corner); index1..M=emitters(w_i diag); g_i on the arrow; "
                  "eigh ascending; photon_frac=|v[0]|^2.",
    "cases": cases,
    "checks": {
        "identical_resonant_M4_full_splitting": 2 * 0.1 * math.sqrt(4),  # 0.4
        "identical_resonant_M4_dark_energy": 1.0,
        "identical_resonant_M4_n_dark": 3,
    },
}
# write directly to the committed golden location (robust to the cwd it is launched from)
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wasm", "golden", "spectrum_golden.json")
with open(out_path, "w") as f:
    json.dump(out, f, indent=1)
print(f"wrote {os.path.relpath(out_path)}")
for c in cases:
    print(f"  {c['label']:24s} eigs = {[round(x,4) for x in c['eigs']]}")
    print(f"  {'':24s} pho  = {[round(x,3) for x in c['photon_frac']]}")
