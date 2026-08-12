/**
 * Deterministic PRNG for the GA (FR-ALLOC-01: results must be reproducible
 * under a fixed seed). Every stochastic choice in the engine draws from one
 * mulberry32 stream in fixed program order — never Math.random.
 */

export type Rng = () => number

/** mulberry32: fast 32-bit PRNG, uniform in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n)
}

/** In-place Fisher–Yates shuffle. */
export function shuffleInPlace<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
