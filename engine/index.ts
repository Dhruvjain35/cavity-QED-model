// Polariton cavity-QED physics engine, the validated "oracle".
// Pure TypeScript, zero rendering dependencies. See docs/PHYSICS-SPEC.md.

export * from "./constants";
export * from "./marcus";
export * from "./microcavity";
export * from "./collective";
export * from "./htc";

// Small numeric helpers shared by views/tests.
export function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return [a];
  const out: number[] = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out.push(a + step * i);
  return out;
}

/** Logarithmically spaced samples from 10^aExp to 10^bExp (decades). */
export function logspace(aExp: number, bExp: number, n: number): number[] {
  return linspace(aExp, bExp, n).map((e) => Math.pow(10, e));
}

export function argmax(xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i]! > xs[best]!) best = i;
  return best;
}
