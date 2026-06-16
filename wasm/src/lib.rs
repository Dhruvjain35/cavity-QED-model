//! Open-quantum cavity-QED compute core.
//!
//! Built in the LOCKED QuTiP convention (see ../golden/gen_golden.py header):
//!   - cavity-first tensor order: `a = kron(destroy(N), I2)`, `sm = kron(I_N, sigmam)`
//!   - atom energy = number operator `w_a * sp*sm`
//!   - dissipator rate-in-operator: `C = sqrt(rate) * A`
//!
//! Every operator is validated element-wise against a QuTiP golden in `tests/operator_lock.rs`.

pub mod entropy;
pub mod fft;
pub mod htc;
pub mod operators;
pub mod optics;
pub mod solver;
pub mod spectrum;
pub mod wigner;
pub mod wasm_api;
