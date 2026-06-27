# Contributing

Thanks for looking at the cavity-QED instrument. The bar for this project is simple: no number is asserted from memory. Every physical quantity is either computed by the validated core or checked against an independent reference. Contributions are expected to hold that line.

## Architecture in one minute

There are two physics layers, on purpose:

- **`wasm/` — the shipping quantum core (Rust → WebAssembly).** This is what the app actually runs: the single-excitation Jaynes–Cummings / Tavis–Cummings spectra, the Lindblad time evolution (Dormand–Prince / Dopri5), the Wigner function, the partial trace, and the Holstein–Tavis–Cummings vibronic matrix. It is checked element by element against QuTiP 5.3 / NumPy goldens committed under `wasm/golden/`.
- **`engine/` — a closed-form analytic oracle (TypeScript).** Marcus electron-transfer rates, transfer-matrix optics, and Franck–Condon sums in closed form. The app does not import it; it exists as an independent self-check and as a fast reference. Its vitest suite lives in `engine/__tests__/`.

The React UI is in `src/`. The 3D scene is `src/cavity/LiveCavityScene.tsx`. The avoided-crossing centerpiece is `src/PolaritonFormation.tsx`.

## Build and run

```bash
npm install
npm run dev          # local dev server

# rebuild the WASM core (only if you change wasm/src/*.rs — needs the Rust toolchain + wasm-pack)
wasm-pack build wasm --target web    --out-dir pkg-web
wasm-pack build wasm --target nodejs --out-dir pkg-node
```

The compiled `wasm/pkg-web/` is committed, so a plain `npm install && npm run build` works with no Rust toolchain.

## Tests (the important part)

```bash
npm test            # analytic vitest suite + re-check the shipping WASM core vs goldens through the Node boundary (no Rust needed)
npm run test:quantum  # full native Rust golden suite: 22 cargo tests, 11 of them QuTiP 5.3 / NumPy goldens (needs Rust)
npm run test:all      # everything
```

CI (`.github/workflows/ci.yml`) gates the cargo golden suite and the Node boundary recheck on every push and PR. The full validation table is in [`docs/VALIDATION.md`](docs/VALIDATION.md); the conventions behind each check are source-cited in [`docs/GROUNDING-RESEARCH.md`](docs/GROUNDING-RESEARCH.md).

## Expectations for a change

- **New or changed physics** must come with a golden or analytic check, and `npm run test:all` must pass. If you add a regime, add its reference values to `wasm/golden/` (regenerate with `golden/gen_golden.py` / `golden/gen_spectrum_golden.py`, QuTiP 5.3.0 + NumPy in a `uv` venv) and a `wasm/tests/*.rs` check.
- **UI text** states the model and its approximations honestly. If a panel applies an approximation (RWA, single-excitation subspace, a phenomenological linewidth), say so in the panel. Do not claim a model is exact or lossless when it is not.
- **Style:** the type system is IBM Plex Sans / Mono with KaTeX for math; no em dashes in user-facing copy; the visual language is a flat scientific instrument (no bloom, neon, or decorative gradients).
- `npm run build` (which runs `tsc --noEmit`) must pass clean before you open a PR.
