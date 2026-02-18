/**
 * Shared word lists for Wordle - used by both client and server.
 */

import answersRaw from '../../assets/wordle-answers-alphabetical.txt?raw';
import guessesRaw from '../../assets/wordle-allowed-guesses.txt?raw';

export const ANSWERS: string[] = answersRaw
  .trim()
  .toLowerCase()
  .split('\n')
  .filter(Boolean);

export const VALID_GUESSES = new Set<string>([
  ...ANSWERS,
  ...guessesRaw
    .trim()
    .toLowerCase()
    .split('\n')
    .filter(Boolean),
]);

export function randomAnswer(): string {
  const idx = Math.floor(Math.random() * ANSWERS.length);
  return ANSWERS[idx]!;
}
