#!/usr/bin/env python3
"""
AUTHORITATIVE QuTiP golden generator, the single source of truth for the
Rust→WASM open-quantum solver's bit-level validation. (QuTiP 5.x)

LOCKED CONVENTIONS (confirm with Shravan before trusting downstream tests):
  1. Tensor order: CAVITY-FIRST.  a = tensor(destroy(N), qeye(2)),  sm = tensor(qeye(N), sigmam()).
     State layout is |n> ⊗ |sigma>.
  2. Atom energy term: NUMBER OPERATOR  H_atom = w_a * sp*sm  (= w_a |e><e|), NOT (1/2) w_a sigma_z.
     (They differ by a constant (1/2)w_a·I shift, which changes what <sigma_z> means, we avoid that.)
  3. Jaynes–Cummings (RWA):  H = w_c a†a + w_a sp sm + g (a† sm + a sp).
  4. Dissipator: rate-in-operator.  Collapse ops C = sqrt(rate)·A:
        sqrt(kappa) a   (cavity loss),  sqrt(gamma) sm   (emitter decay),  sqrt(gamma_phi/2) sigma_z (dephasing).
     QuTiP's mesolve applies  D[C]rho = C rho C† − ½{C†C, rho}.
  5. Wigner: QuTiP default g = sqrt(2), alpha = x + i y  (so x,y are the dimensionless quadratures with hbar=1).

NOTE on the 2-level basis (resolved by DUMPING QuTiP's own matrices, Rust matches the dump, not a textbook):
  QuTiP sigma_z = diag(1, -1), so basis(2,0) has <sigma_z>=+1 → EXCITED |e>; basis(2,1) → GROUND |g>.
  sm = sigmam() = |g><e| lowers the atom.  Excited projector P_e = sp*sm = |e><e| = proj(basis(2,0)).
"""
import json, numpy as np, qutip as qt

OUT = "/Users/dhruvjain/polariton-research/sim/wasm/golden/golden.json"

# ── parameters (ħ = 1) ────────────────────────────────────────────────────────
N = 16          # Fock truncation (PHOTON number; NOT the HTC molecule N_max)
w_c = 1.0       # cavity frequency
w_a = 1.0       # atom frequency (resonant)
g   = 0.20      # JC coupling  → vacuum-Rabi splitting 2g = 0.40
kappa = 0.05    # cavity loss
gamma = 0.02    # emitter decay
gamma_phi = 0.0 # pure dephasing (0 for the first lock; operator path still exercised below)

# ── operators (LOCKED cavity-first tensor order) ──────────────────────────────
a  = qt.tensor(qt.destroy(N), qt.qeye(2))
sm = qt.tensor(qt.qeye(N), qt.sigmam())
sp = sm.dag()
sz = qt.tensor(qt.qeye(N), qt.sigmaz())
num_c = a.dag() * a          # photon number
P_e  = sp * sm               # excited-state projector |e><e|

H = w_c * num_c + w_a * P_e + g * (a.dag() * sm + a * sp)

c_ops = [np.sqrt(kappa) * a, np.sqrt(gamma) * sm]
if gamma_phi > 0:
    c_ops.append(np.sqrt(gamma_phi / 2.0) * sz)

# ── initial state: |0 photons, atom EXCITED> → vacuum-Rabi sloshing ───────────
psi0 = qt.tensor(qt.fock(N, 0), qt.basis(2, 0))   # basis(2,0) = excited (see header)

tlist = np.linspace(0.0, 40.0, 200)
res = qt.mesolve(H, psi0, tlist, c_ops, e_ops=[num_c, P_e],
                 options={"store_states": True, "atol": 1e-12, "rtol": 1e-10})
n_t, pe_t = res.expect[0], res.expect[1]

# rho snapshots for element-wise comparison
snap_idx = [0, len(tlist) // 4, len(tlist) // 2, len(tlist) - 1]
rho_snaps = [res.states[i] for i in snap_idx]

# ── Wigner goldens (for the solver's Wigner port, step 3) ─────────────────────
xvec = np.linspace(-5.0, 5.0, 100)
gW = np.sqrt(2.0)
coh = qt.coherent(N, 1.0 + 0.5j)                       # offset Gaussian
cat = (qt.coherent(N, 2.0) + qt.coherent(N, -2.0)).unit()  # interference fringes (catches off-diag ×2 bug)
W_coh = qt.wigner(coh, xvec, xvec, g=gW)
W_cat = qt.wigner(cat, xvec, xvec, g=gW)

# ── serialize ─────────────────────────────────────────────────────────────────
def mat(q):
    m = q.full()
    return {"shape": list(m.shape), "re": m.real.tolist(), "im": m.imag.tolist()}

def ket(q):
    v = q.full().ravel()
    return {"dim": int(v.shape[0]), "re": v.real.tolist(), "im": v.imag.tolist()}

golden = {
    "_meta": "QuTiP %s golden, locked conventions (see gen_golden.py header)" % qt.__version__,
    "conventions": {
        "tensor_order": "cavity_first: tensor(cavity, atom), |n>⊗|sigma>",
        "atom_energy": "number_operator w_a*sp*sm",
        "dissipator": "rate_in_operator C=sqrt(rate)*A; D[C]=C rho C† - 1/2{C†C,rho}",
        "wigner_g": gW, "wigner_alpha": "x+iy",
        "excited_state": "basis(2,0) (sigma_z=+1)",
    },
    "params": {"N": N, "w_c": w_c, "w_a": w_a, "g": g,
               "kappa": kappa, "gamma": gamma, "gamma_phi": gamma_phi, "dim": 2 * N},
    "operators": {"a": mat(a), "adag_a": mat(num_c), "sm": mat(sm), "sp": mat(sp),
                  "sz": mat(sz), "P_e": mat(P_e), "H": mat(H),
                  "c_ops": [mat(c) for c in c_ops]},
    "psi0": ket(psi0),
    "dynamics": {"tlist": tlist.tolist(), "n_t": list(map(float, n_t)),
                 "pe_t": list(map(float, pe_t)),
                 "rho_snapshots": {"indices": snap_idx, "t": [float(tlist[i]) for i in snap_idx],
                                   "rho": [mat(r) for r in rho_snaps]}},
    "ptrace_check": {"rho_c_end": mat(rho_snaps[-1].ptrace(0))},
    "wigner": {"xvec": xvec.tolist(), "g": gW,
               "coherent": {"alpha": [1.0, 0.5], "rho": mat(qt.ket2dm(coh)), "W": W_coh.tolist()},
               "cat": {"rho": mat(qt.ket2dm(cat)), "W": W_cat.tolist()}},
}

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(golden, f)

# ── human-readable summary for audit ──────────────────────────────────────────
print("QuTiP", qt.__version__, "golden written:", OUT)
print(f"  Hilbert dim = {2*N}  (N_fock={N} × 2 atom)")
print(f"  H is Hermitian: {bool((H - H.dag()).norm() < 1e-12)}   H.shape={H.shape}")
print(f"  <n>(0)  = {n_t[0]:.6f}   <P_e>(0) = {pe_t[0]:.6f}   (expect 0 photons, atom excited → 0.0, 1.0)")
print(f"  <n>(t_end)={n_t[-1]:.6f}  <P_e>(t_end)={pe_t[-1]:.6f}  (both decaying toward 0)")
print(f"  max <n>(t) = {max(n_t):.6f}  (vacuum-Rabi transfer of the excitation to the cavity)")
print(f"  Tr[rho(t_end)] = {rho_snaps[-1].tr().real:.10f}  (must be ~1)")
print(f"  W_coherent integral ≈ {np.trapezoid(np.trapezoid(W_coh, xvec), xvec):.4f}  (Wigner normalizes to 1)")
print(f"  W_cat min = {W_cat.min():.4f}  (NEGATIVE → non-classical fringes present)")
