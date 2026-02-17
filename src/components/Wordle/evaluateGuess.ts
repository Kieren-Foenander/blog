import type { LetterResult } from './types';

/**
 * Wordle scoring with duplicate-letter handling.
 *
 * - First mark exact matches as "correct" (green) and consume them.
 * - Then mark remaining guess letters as "present" (yellow) only if the letter
 *   exists in the remaining (unconsumed) answer letter pool.
 * - Otherwise mark as "absent" (grey).
 */
export function evaluateGuess(guess: string, answer: string): LetterResult[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();

  if (g.length !== a.length) {
    throw new Error(
      `evaluateGuess: guess length ${g.length} != answer length ${a.length}`
    );
  }

  const result: LetterResult[] = Array.from({ length: g.length }, () => 'absent');

  // Remaining counts for letters in the answer that haven't been consumed by greens.
  const remaining: Record<string, number> = Object.create(null);

  // Pass 1: greens, and build remaining pool.
  for (let i = 0; i < g.length; i++) {
    const gc = g[i]!;
    const ac = a[i]!;
    if (gc === ac) {
      result[i] = 'correct';
    } else {
      remaining[ac] = (remaining[ac] ?? 0) + 1;
    }
  }

  // Pass 2: yellows for non-greens, consuming from remaining pool.
  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'correct') continue;
    const gc = g[i]!;
    const count = remaining[gc] ?? 0;
    if (count > 0) {
      result[i] = 'present';
      remaining[gc] = count - 1;
    }
  }

  return result;
}

