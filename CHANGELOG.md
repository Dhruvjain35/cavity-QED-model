# Changelog

All notable changes to this project are recorded here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are pre-1.0 and may move quickly.

## [Unreleased]

### Fixed
- **Live-dynamics decay model is now physically correct.** Cavity loss acts on the photon, so each
  eigenstate now decays in proportion to its photon fraction `f_k = |⟨0|φ_k⟩|²`. The bright polaritons
  leak through the mirrors while the dark/subradiant reservoir (zero photon weight) stays long-lived,
  in both the 2D population traces and the 3D scene. Previously a single envelope `e^{−2Γt}` drained
  every mode at the same rate, which incorrectly emptied the dark manifold.
- **Removed self-contradicting "lossless" captions** on the dynamics tab that sat next to a decaying
  population plot and a `P_leaked` readout. The copy now describes the photon-weighted loss consistently.
- **No more whole-app white-screen on a 3D failure.** The lazy 3D scene is wrapped in an error boundary,
  so a stale-chunk 404 after a redeploy or a machine that cannot start WebGL degrades to a static notice
  in that one pane; every plot, number, and control elsewhere keeps working.
- **Vibronic tab no longer feels frozen.** The exact N-body diagonalization (N = 2, 3) now paints a
  "computing" state and runs after a frame, so the tab switch and slider settle land immediately instead
  of looking hung.
- README test count corrected to 22 cargo tests (11 QuTiP/NumPy goldens), matching `docs/VALIDATION.md`.
- `npm test` now also re-checks the shipping WASM core against its QuTiP goldens through the Node
  boundary, not just the analytic oracle in `engine/`.

### Changed
- **Tab order now follows the physics build-up and the guided tour:** Single emitter, Cavity field,
  Collective, Dynamics, Vibronic.
- **Guided tour** auto-opens once on a first visit, walks all six views, and the 3D scene labels (light
  field, molecules, cavity mirrors) are anchored to real 3D points so they track the camera on orbit/zoom.
- Removed em dashes from all user-facing copy; tightened the avoided-crossing centerpiece and the 3D
  scene-control panel so nothing clips.

## [0.1.0]
- Initial in-browser cavity-QED instrument: Rust→WASM quantum core validated against QuTiP 5.3 / NumPy
  goldens; transfer-matrix optics and Holstein–Tavis–Cummings vibronics against closed-form benchmarks.
- Five regime tabs (single emitter, cavity field, collective, dynamics, vibronic), shareable-link state,
  example gallery, CSV/JSON/`Ĥ.npy` exports.
