import { describe, test, expect } from "vitest";
import {
  nMax,
  polaritonEnergies,
  mixingAngle,
  effectiveCouplings,
  etRateVsN,
  polaritonBranches,
  hopfield,
  angleToK,
  collectiveCoupling,
  rabiSplitting,
  darkStateCount,
  darkStateCountC,
  marcusRate,
  marcusRateEa,
  activationBarrier,
  logspace,
  argmax,
  DEFAULT_HTC,
  DEFAULT_MICROCAVITY,
} from "../index";

// ─────────────────────────────────────────────────────────────────────────────
// THE central result — N_max turnover and the units correction (PHYSICS-SPEC §6)
// ─────────────────────────────────────────────────────────────────────────────
describe("N_max turnover (central result)", () => {
  test("absorption channel → 1636 (golden)", () => {
    expect(nMax({ hbar_wc: 1.0, E_AD: 1.0, T: 0.024731 })).toBeCloseTo(1636, 0);
  });
  test("emission channel → 10785 (golden)", () => {
    expect(nMax({ hbar_wc: 1.0, E_AD: 1.0, T: 0.0096297 })).toBeCloseTo(10785, 0);
  });
  test("dimensionally correct: depends on ħω_c·E_AD, not ħω_c alone", () => {
    // ħω_c·E_AD = 1.0 here too (2.0 × 0.5), off resonance → must still give 1636.
    // Guards against regressing to the printed 1 + ħω_c/|T|² form.
    expect(nMax({ hbar_wc: 2.0, E_AD: 0.5, T: 0.024731 })).toBeCloseTo(1636, 0);
  });
  test("is dimensionless (a pure count), value ≥ 1", () => {
    const v = nMax({ hbar_wc: 1.0, E_AD: 1.0, T: 0.05 });
    expect(v).toBeGreaterThan(1);
    expect(Number.isFinite(v)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTC polariton energies & the turnover curve (PHYSICS-SPEC §C)
// ─────────────────────────────────────────────────────────────────────────────
describe("HTC collective polariton energies", () => {
  test("Rabi splitting scales as √(N−1)", () => {
    const { OmegaPlus, OmegaMinus } = polaritonEnergies({ Delta: 0, N: 101, T: 0.0247 });
    expect(OmegaPlus - OmegaMinus).toBeCloseTo(2 * Math.sqrt(100) * 0.0247, 4);
  });
  test("mixing angle = π/4 at resonance", () => {
    expect(mixingAngle({ Delta: 0, N: 500, T: 0.0247 })).toBeCloseTo(Math.PI / 4, 6);
  });
  test("effective couplings: T01 = ħω_c·t_AD, T10 = −T01, T00 = T11 = H_AD", () => {
    const c = effectiveCouplings({ H_AD: 0.0304, hbar_wc: 1.0, t_AD: 0.024731 });
    expect(c.T01).toBeCloseTo(0.024731, 6);
    expect(c.T10).toBeCloseTo(-0.024731, 6);
    expect(c.T00).toBe(0.0304);
    expect(c.T11).toBe(0.0304);
  });
});

describe("ET rate vs N turnover", () => {
  const Ns = logspace(0, 5, 120); // 1 … 10^5
  const curve = etRateVsN(Ns, DEFAULT_HTC);

  test("curve rises to an interior peak then decays (non-monotonic)", () => {
    const peak = argmax(curve.map((c) => c.kTotal));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(curve.length - 1);
  });
  test("peak sits at N ≈ N_max (≈1636 for the absorption channel)", () => {
    const peakN = curve[argmax(curve.map((c) => c.kTotal))]!.N;
    const expected = nMax({ hbar_wc: DEFAULT_HTC.hbar_wc, E_AD: DEFAULT_HTC.E_AD, T: DEFAULT_HTC.T01 });
    // within a quarter-decade on a log axis
    expect(Math.abs(Math.log10(peakN) - Math.log10(expected))).toBeLessThan(0.25);
  });
  test("baseline (ordinary ET) is N-independent", () => {
    expect(curve[0]!.baseline).toBeCloseTo(curve[curve.length - 1]!.baseline, 6);
  });
  test("decays past the peak (well above N_max smaller than at peak)", () => {
    const peakIdx = argmax(curve.map((c) => c.kTotal));
    expect(curve[curve.length - 1]!.kTotal).toBeLessThan(curve[peakIdx]!.kTotal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marcus kernel (PHYSICS-SPEC §C.9)
// ─────────────────────────────────────────────────────────────────────────────
describe("Marcus / FGR kernel", () => {
  test("rate maximal at E_a = 0 (barrier-less)", () => {
    const peak = marcusRateEa({ V: 0.02, E_a: 0, E_r: 1, kT: 0.025 });
    const off = marcusRateEa({ V: 0.02, E_a: 0.3, E_r: 1, kT: 0.025 });
    expect(peak).toBeGreaterThan(off);
  });
  test("classical form: barrier-less when E_fi = −E_r", () => {
    const a = marcusRate({ V: 0.02, E_fi: -1.0, E_r: 1.0, kT: 0.025 });
    const b = marcusRate({ V: 0.02, E_fi: -0.6, E_r: 1.0, kT: 0.025 });
    expect(a).toBeGreaterThan(b);
  });
  test("activation barrier (ΔG°+λ)²/4λ: zero when ΔG° = −λ", () => {
    expect(activationBarrier(-1.0, 1.0)).toBeCloseTo(0, 9);
    expect(activationBarrier(0, 1.0)).toBeCloseTo(0.25, 9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Microcavity (System A) — anticrossing & Hopfield (PHYSICS-SPEC §A)
// ─────────────────────────────────────────────────────────────────────────────
describe("microcavity polaritons", () => {
  test("anticrossing: LP/UP gap = 2V at resonance, branches never cross", () => {
    const { ELP, EUP } = polaritonBranches([0], {
      Ecav0: 1.5,
      Eexc: 1.5,
      mcav: DEFAULT_MICROCAVITY.mcav,
      V: 0.005,
    });
    expect(EUP[0]! - ELP[0]!).toBeCloseTo(0.01, 9); // 2V = 10 meV
  });
  test("LP always below UP across a k-sweep (no crossing)", () => {
    const ks = Array.from({ length: 50 }, (_, i) => i * 2e7);
    const { ELP, EUP } = polaritonBranches(ks, {
      Ecav0: 1.49,
      Eexc: 1.5,
      mcav: DEFAULT_MICROCAVITY.mcav,
      V: 0.005,
    });
    for (let i = 0; i < ks.length; i++) expect(EUP[i]!).toBeGreaterThan(ELP[i]!);
  });
  test("Hopfield: 50/50 at resonance, sums to 1, →excitonic for δ>0", () => {
    const r0 = hopfield(0, 0.005);
    expect(r0.X2).toBeCloseTo(0.5, 9);
    expect(r0.C2).toBeCloseTo(0.5, 9);
    const rPos = hopfield(0.05, 0.005);
    expect(rPos.X2 + rPos.C2).toBeCloseTo(1, 12);
    expect(rPos.X2).toBeGreaterThan(0.9); // strongly excitonic far detuned
  });
  test("angle→k is zero at normal incidence and grows with angle", () => {
    expect(angleToK(1.5, 0)).toBeCloseTo(0, 12);
    expect(angleToK(1.5, 30)).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Collective coupling (System B) — √N scaling (PHYSICS-SPEC §B)
// ─────────────────────────────────────────────────────────────────────────────
describe("Tavis–Cummings collective coupling", () => {
  test("g_N = g√N and Rabi = 2g√N", () => {
    expect(collectiveCoupling(0.01, 100)).toBeCloseTo(0.1, 9);
    expect(rabiSplitting(0.01, 100)).toBeCloseTo(0.2, 9);
  });
  test("√N scaling: quadrupling N doubles the splitting", () => {
    expect(rabiSplitting(0.01, 400) / rabiSplitting(0.01, 100)).toBeCloseTo(2, 9);
  });
  test("dark-state count = N−1 (generic Tavis–Cummings, System B)", () => {
    expect(darkStateCount(1_000_000)).toBe(999_999);
  });
  test("System-C dark-state count = N−2 (reacting molecule excluded)", () => {
    expect(darkStateCountC(1_000_000)).toBe(999_998);
    expect(darkStateCountC(2)).toBe(0);
    expect(darkStateCountC(1)).toBe(0);
  });
});

describe("angle ⇄ momentum units (deep-verify bug fix)", () => {
  test("angleToK returns m⁻¹ (~few µm⁻¹ at optical energies), consistent with cavityDispersion", () => {
    const k = angleToK(1.5, 30); // ~3.8e6 m^-1 = 3.8 µm^-1
    expect(k).toBeGreaterThan(1e6);
    expect(k).toBeLessThan(1e7);
  });
});
