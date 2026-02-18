/**
 * In-memory game state store for server-side Wordle. Keyed by conversationId.
 * For serverless, consider Redis or similar for persistence.
 */

import type { LetterResult } from '../../components/Wordle/types';
import { randomAnswer } from './words';

export interface ServerGameState {
  answer: string;
  guesses: string[];
  feedback: LetterResult[][];
  status: 'playing' | 'won' | 'lost';
}

const games = new Map<string, ServerGameState>();

export function getOrCreateGame(
  conversationId: string,
  options?: { newGame?: boolean }
): ServerGameState {
  const existing = games.get(conversationId);
  if (options?.newGame || !existing) {
    const state: ServerGameState = {
      answer: randomAnswer(),
      guesses: [],
      feedback: [],
      status: 'playing',
    };
    games.set(conversationId, state);
    return state;
  }
  return existing;
}

export function getGame(conversationId: string): ServerGameState | undefined {
  return games.get(conversationId);
}
