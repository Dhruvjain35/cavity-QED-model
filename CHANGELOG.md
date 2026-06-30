# Changelog

All notable changes to this project are recorded here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are pre-1.0 and may move quickly.

## [Unreleased]

### Added
- **Dispersion tab.** Microcavity exciton-polariton dispersion `E(k‖)` from the 2×2 coupled-oscillator
  (Hopfield) model, plus the **angle-resolved reflectivity heatmap** `A(ω,k‖) = −(1/π) Im G_c`: the same
  anticrossing as a theory curve and as a lab measures it, on a perceptually-uniform `inferno` colormap.
  Live `δ`, `2V`, and cavity-linewidth `κ` sliders sharpen or broaden the branches.
- **Transmission-spectroscopy view** in Dynamics: the vacuum-Rabi anticrossing in transmission `A(ω,Δ)` as
  the cavity tunes through the emitters, with a live `Δ`-slice cursor, the line-cut doublet, and a
  cavity-QED figures-of-merit panel (`Ω_R`, collective cooperativity, cavity `Q`, strong/weak regime). All
  analytic from the input-output cavity Green's function, no new WASM.
- **Electron-transfer `N_max` turnover panel** (Vibronic) reproducing the Sharma & Chen collective-coupling
  result, and a 23-case `vitest` suite for the closed-form analytic engine.

### Changed
- **Full UI redesign to a dark, professional instrument theme** (VS Code / IBM Quantum Composer idiom):
  graphite panels, 1px hairlines, a single restrained selection-blue accent, native system sans + tabular
  mono, a numbered sidebar nav, subtle rounding on controls and scopes. Removed the neon, glows, and the
  "live" pulsing dot.
- **All plots are now dark-faced** and integrate into the dashboard; the Wigner / density-matrix heatmaps
  use a dark diverging map and the 2D intensity maps use `inferno`.
- **Hero plots fit their container** so the Dispersion and Transmission tabs fill the screen instead of
  floating at native size, re-rendered crisp at the displayed size (no stretched bitmaps), with the hover
  crosshair kept aligned.

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
  Collective, Dynamics, Vibronic, Dispersion.
- **Guided tour** auto-opens once on a first visit, walks all six views, and the 3D scene labels (light
  field, molecules, cavity mirrors) are anchored to real 3D points so they track the camera on orbit/zoom.
- Removed em dashes from all user-facing copy; tightened the avoided-crossing centerpiece and the 3D
  scene-control panel so nothing clips.

## [0.1.0]
- Initial in-browser cavity-QED instrument: Rust→WASM quantum core validated against QuTiP 5.3 / NumPy
  goldens; transfer-matrix optics and Holstein–Tavis–Cummings vibronics against closed-form benchmarks.
- Five regime tabs (single emitter, cavity field, collective, dynamics, vibronic), shareable-link state,
  example gallery, CSV/JSON/`Ĥ.npy` exports.
