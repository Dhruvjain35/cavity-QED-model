//! Shared golden-loading helpers for integration tests.
use cqed_core::operators::CMat;
use nalgebra::Complex;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Mat {
    pub shape: Vec<usize>,
    pub re: Vec<Vec<f64>>,
    pub im: Vec<Vec<f64>>,
}
impl Mat {
    pub fn to_cmat(&self) -> CMat {
        CMat::from_fn(self.shape[0], self.shape[1], |i, j| {
            Complex::new(self.re[i][j], self.im[i][j])
        })
    }
}

#[derive(Deserialize)]
pub struct Ket {
    pub dim: usize,
    pub re: Vec<f64>,
    pub im: Vec<f64>,
}
impl Ket {
    /// Outer product |ψ⟩⟨ψ| as a density matrix.
    pub fn to_rho(&self) -> CMat {
        let psi = CMat::from_fn(self.dim, 1, |i, _| Complex::new(self.re[i], self.im[i]));
        &psi * psi.adjoint()
    }
}

#[derive(Deserialize)]
pub struct GParams {
    #[serde(rename = "N")]
    pub n: usize,
    pub w_c: f64,
    pub w_a: f64,
    pub g: f64,
    pub kappa: f64,
    pub gamma: f64,
    pub gamma_phi: f64,
}

#[derive(Deserialize)]
pub struct RhoSnaps {
    pub indices: Vec<usize>,
    pub t: Vec<f64>,
    pub rho: Vec<Mat>,
}

#[derive(Deserialize)]
pub struct Dynamics {
    pub tlist: Vec<f64>,
    pub n_t: Vec<f64>,
    pub pe_t: Vec<f64>,
    pub rho_snapshots: RhoSnaps,
}

#[derive(Deserialize)]
pub struct WignerState {
    pub rho: Mat,
    #[serde(rename = "W")]
    pub w: Vec<Vec<f64>>,
}

#[derive(Deserialize)]
pub struct Wigner {
    pub xvec: Vec<f64>,
    pub g: f64,
    pub coherent: WignerState,
    pub cat: WignerState,
}

#[derive(Deserialize)]
pub struct PtraceCheck {
    pub rho_c_end: Mat,
}

#[derive(Deserialize)]
pub struct Golden {
    pub params: GParams,
    pub psi0: Ket,
    pub dynamics: Dynamics,
    pub ptrace_check: PtraceCheck,
    pub wigner: Wigner,
}

pub fn load() -> Golden {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/golden/golden.json");
    let txt = std::fs::read_to_string(path)
        .unwrap_or_else(|_| panic!("golden not found at {path} — run golden/gen_golden.py"));
    serde_json::from_str(&txt).expect("golden JSON parse")
}

use cqed_core::operators::Params;
impl Golden {
    pub fn params(&self) -> Params {
        Params {
            n_fock: self.params.n,
            w_c: self.params.w_c,
            w_a: self.params.w_a,
            g: self.params.g,
            kappa: self.params.kappa,
            gamma: self.params.gamma,
            gamma_phi: self.params.gamma_phi,
        }
    }
}
