export type LetterResult = 'correct' | 'present' | 'absent';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  answer: string;
  guesses: string[]; // submitted guesses, lowercase
  feedback: LetterResult[][]; // feedback[row][col]
  currentGuess: string; // in-progress guess, lowercase
  status: GameStatus;
  message?: string; // transient UI message (e.g. invalid word)
}

export type WordleAction =
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'REMOVE_LETTER' }
  | { type: 'SUBMIT_GUESS' }
  | { type: 'NEW_GAME'; answer: string }
  | { type: 'SET_MESSAGE'; message?: string };

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

