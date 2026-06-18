# 4-Category Fix Spec (verbatim requirements — survives /compact)

Strict order. Screenshot (Playwright headless) after each category. Do not proceed until verified.
Constraint reminders: CAT1 = JS-only for transmission (do not touch WASM FFT; pass longer time series).
CAT2 = full 3D rebuild (LiveCavityScene.tsx + CavityScene.tsx). CAT3 = `npm i leva maath` (only these two new deps).

## CATEGORY 1 — PHYSICS CORRECTNESS
- **1.A Transmission doublet equal-height.** At resonance LP/UP have identical photon fraction → two equal-height Lorentzians. Currently left ≈ half of right. Diagnose: (a) FFT time series must span ≥5–6 Rabi cycles, T_total > 6·π/Ω_R, Ω_R=2g√N; too short → LP decays before window closes → weaker. (b) Subtract DC (mean of photon amplitude) before FFT. (c) Frequency axis: both peaks symmetric about ω_c=1.0, at 1.0 ± g√N — print these to console & verify. Fix on JS side: extend T_total + subtract DC. Do NOT touch WASM FFT.
- **1.B Dark-state horizontal lines in COLLECTIVE fan.** N−1 degenerate dark states at E=ω_a, flat horizontal, independent of detuning, currently absent. After LP/UP branches, draw each dark eigenvalue as thin (lineWidth 0.5) horizontal line in #9e77ed spanning full detuning range. σ=0 → one degenerate line; σ>0 → band, draw each. Label cluster "N−1 dark / subradiant reservoir" in purple at right edge.
- **1.C Hopfield bar chart updates on eigenstate click.** Click handler that sets selected eigenstate must redraw the Hopfield bars. Verify: LP→~50/50 at resonance; dark→photon~0/matter~1; UP→~50/50.
- **1.D VIBRONIC FC panel separation.** FC bars in amber #ffcc00 @60% opacity, lineWidth 3, vertical bars y=0→FC_weight at each nω_vib. In-cavity absorption = continuous cyan #00ffff line curve overlaid. Legend top-right: amber square "bare FC |⟨n|0⟩|² = e⁻ˢSⁿ/n!", cyan line "in-cavity polariton absorption".

## CATEGORY 2 — 3D CAVITY REBUILD (from scratch, both scenes)
- **2.A Kill the cylinder completely.** Remove ALL tube/cylinder cavity-wall geometry. Space between mirrors visually open.
- **2.B DBR mirror geometry.** Each mirror = stack of N_pairs flat disc meshes (cylinderGeometry [radius,radius,thickness,64], height=thickness). Alternate two materials: MeshStandardMaterial #2a2a3a rough 0.7 metal 0.15, and #12121e rough 0.9 metal 0.05. Disc radius=110, thickness=6, stacked along z, no gap. Mirrors at z=±cavity_half_length, both facing inward. Rim disc radius 115 thickness 2 color #444466 (mounting ring). No chrome/glass/emission on mirrors.
- **2.C TEM₀₀ standing-wave field volume (centerpiece).** Replace the single white line. Place flat disc meshes at ANTINODE positions z_k = −half + k·(length/n_antinodes), k=1,3,5… (n_antinodes ~4–6 from TMM). Each disc radius = w_k·2.5 where w_k = w0·sqrt(1+(z_k/zR)²), w0=28, zR=length·0.4. Material MeshBasicMaterial #00ffff transparent depthWrite=false side=DoubleSide. opacity = 0.12 + 0.55·P_photon(t). Nodes: nothing (dark gaps = standing-wave structure). Discs pulse with photon population.
- **2.D Molecule emissive live response.** Each molecule: bright_weight_i = g_i/‖g‖. Per frame: emissiveIntensity_i = bright_weight_i · P_bright(t) · 4.0. Excited color #ff3333; base/dark color #3a1a2a. bright_weight_i < 0.1 → clamp emissiveIntensity to 0 (never glow). Pass P_bright, P_dark as refs updated each RAF (no React re-render).
- **2.E Lighting — replace everything.** Remove all <Environment>, HDRI, ContactShadows. Use exactly: ambientLight 0.12; directionalLight [3,5,3] 1.4 #ffffff; directionalLight [-2,-1,-3] 0.35 #6688ff; pointLight [0,0,0] 0.8 #00ffff distance 200 decay 2. No shadows.
- **2.F Postprocessing — surgical.** Exactly: Bloom luminanceThreshold 0.6 luminanceSmoothing 0.4 intensity 0.8 radius 0.5; ChromaticAberration offset [0.0004,0.0004]; Vignette darkness 0.45 offset 0.3. Nothing else.
- **2.G Camera + OrbitControls.** Camera [0,70,320] → [0,0,0]. OrbitControls minDistance 150 maxDistance 600 enablePan false autoRotate false enableDamping true dampingFactor 0.05.

## CATEGORY 3 — UI PROFESSIONALISM (CSS/canvas, zero new components)
- **3.A** `npm i leva maath` (only these).
- **3.B Leva panel "3D SCENE CONTROLS"** (floating top-right of 3D canvas): fieldOpacity 0.05–0.8 def 0.12; moleculeScale 0.5–2.0 def 1.0; bloomIntensity 0–2 def 0.8 (wired to Bloom intensity); showFieldDiscs bool true; showDipoleArrows bool true.
- **3.C Canvas crosshair + readout** on EVERY physics plot canvas (transmission, populations, collective fan, Hopfield bars, vibronic absorption, entropy/purity). mousemove → 1px #ffffff44 vertical crosshair at mouse x + label [x_value,y_value] in #00ffff mono 10px (PHYSICS coords via axis mapping, not pixels). mouseleave → clear.
- **3.D Slider overhaul** (styles.css). Track height 2px bg #21262d radius 0. Thumb (webkit+moz) width 3px height 14px radius 0 bg #00ffff no border cursor col-resize. transition background 0.1s (flash white on active).
- **3.E Panel header hierarchy** (global, all panel headers): border-top 1px solid #00ffff22; padding-top 4px; letter-spacing 0.12em; font-size 9px; color #888.
- **3.F URL hash state.** encodeStateToHash()/decodeHashToState(). On param change (N,g,σ,Γ,regime) → window.location.replace('#'+encode). On load if hash non-empty → decode + init. Use btoa(JSON.stringify(params)). "COPY LINK" button in top bar (12px mono, #444 bg, #00ff66 text) → navigator.clipboard.writeText(href), flash "COPIED" 1.5s.
- **3.G About panel.** Top-bar "?" button (18×18, #21262d bg, #888 color, radius 0, 1px #30363d border) toggles floating overlay (absolute centered, #0c0f12 bg, 1px #30363d, 400px, padding 16, z 1000): title "POLARITON CAVITY-QED LAB"; "A research-grade cavity QED simulator. Physics engine: Rust→WASM (validated vs QuTiP 5.3/NumPy). Model: single-excitation Tavis–Cummings + Holstein–Tavis–Cummings vibronic."; "Physics reference: Dong, Zhang, Wu & Wu — 'On the Dynamics of the Tavis–Cummings Model', IEEE TAC 2023."; "Developed in collaboration with Shravan Kumar Sharma, PhD Candidate, Dept of Chemistry, University of Notre Dame. Polariton chemistry + ML."; "Dhruv Jain — Independent researcher. github.com/Dhruvjain35/cavity-QED-model". Monospace. Close "×" top-right.

## CATEGORY 4 — FILL REMAINING DEAD SPACE
- **4.A SINGLE — Panel F "QUANTUM TRAJECTORY — BLOCH VECTOR PROJECTION".** Bloch: x=2·Re(ρ_01), y=2·Im(ρ_01), z=ρ_00−ρ_11. Plot x(t) vs z(t) parametric (last 200 pts) cyan, opacity fade 0.1(old)→1.0(new). Unit circle outline #21262d. Axes "Re(ρ₀₁)" / "ρ₀₀−ρ₁₁". Spirals inward → decoherence.
- **4.B CAVITY — Panel G "CAVITY TRANSFER FUNCTION — |T(ω)|² VS FREQUENCY".** Using TMM: plot 0.5ω_c→1.5ω_c. Bare cavity Lorentzian (gray dashed), coupled with 2g splitting (cyan solid), FSR vertical dashed #ffffff22. Label finesse F and linewidth κ.
- **4.C VIBRONIC — Panel W "DISORDER AVERAGING — INHOMOGENEOUS BROADENING".** Two curves vs σ∈[0,0.5ω_c]: (1) Γ_LP = κ/2 + γ/2 + σ²/(2Ω_R) (motional narrowing, valid Ω_R≫σ) cyan; (2) bare γ+σ gray dashed. Label "strong coupling / motional narrowing" (Ω_R>σ) vs "disorder-dominated" (σ>Ω_R) with vertical divider.

## VERIFICATION CHECKLIST (after all 4)
Transmission two equal peaks symmetric @1.0 · COLLECTIVE N−1 purple dark lines · Hopfield updates on click ·
FC amber bars + cyan curve + legend · 3D no cylinder + 2 flat DBR stacks · 3D cyan discs Gaussian radius (narrow at waist) ·
3D molecules pulse red w/ P_bright, dark stay dim purple · bloom only on emissive · Leva 5 controls · crosshair+coords on all plots ·
sliders thin cyan thumbs · panel headers cyan top border · COPY LINK flashes COPIED · About panel correct · SINGLE Bloch trace ·
CAVITY transfer-fn panel · VIBRONIC disorder-broadening panel.
