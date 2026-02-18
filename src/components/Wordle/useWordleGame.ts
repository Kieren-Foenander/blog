import { useReducer, useRef } from 'react';
import { evaluateGuess } from './evaluateGuess';
import type { GameState, GameStatus, LetterResult } from './types';
import { MAX_GUESSES, WORD_LENGTH } from './types';

import answersRaw from '../../assets/wordle-answers-alphabetical.txt?raw';
import guessesRaw from '../../assets/wordle-allowed-guesses.txt?raw';

const ANSWERS: string[] = answersRaw
  .trim()
  .toLowerCase()
  .split('\n')
  .filter(Boolean);

const VALID_GUESSES = new Set<string>([
  ...ANSWERS,
  ...guessesRaw
    .trim()
    .toLowerCase()
    .split('\n')
    .filter(Boolean),
]);

function randomAnswer(): string {
  const idx = Math.floor(Math.random() * ANSWERS.length);
  return ANSWERS[idx]!;
}

function initialState(answer: string): GameState {
  return {
    answer,
    guesses: [],
    feedback: [],
    currentGuess: '',
    status: 'playing',
    message: undefined,
  };
}

type InternalAction =
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'REMOVE_LETTER' }
  | { type: 'ACCEPT_GUESS'; guess: string; feedback: LetterResult[] }
  | { type: 'NEW_GAME'; answer: string }
  | { type: 'SET_MESSAGE'; message?: string };

function reducer(state: GameState, action: InternalAction): GameState {
  switch (action.type) {
    case 'ADD_LETTER': {
      if (state.status !== 'playing') return state;
      if (state.currentGuess.length >= WORD_LENGTH) return state;
      return {
        ...state,
        currentGuess: (state.currentGuess + action.letter).slice(0, WORD_LENGTH),
        message: undefined,
      };
    }
    case 'REMOVE_LETTER': {
      if (state.status !== 'playing') return state;
      if (!state.currentGuess) return state;
      return {
        ...state,
        currentGuess: state.currentGuess.slice(0, -1),
        message: undefined,
      };
    }
    case 'ACCEPT_GUESS': {
      if (state.status !== 'playing') return state;
      if (state.guesses.length >= MAX_GUESSES) return state;

      const nextGuesses = [...state.guesses, action.guess];
      const nextFeedback = [...state.feedback, action.feedback];

      const won = action.feedback.every((r) => r === 'correct');
      const lost = !won && nextGuesses.length >= MAX_GUESSES;

      return {
        ...state,
        guesses: nextGuesses,
        feedback: nextFeedback,
        currentGuess: '',
        status: won ? 'won' : lost ? 'lost' : 'playing',
        message: undefined,
      };
    }
    case 'NEW_GAME':
      return initialState(action.answer);
    case 'SET_MESSAGE':
      return { ...state, message: action.message };
    default:
      return state;
  }
}

function mergeLetterResult(
  prev: LetterResult | undefined,
  next: LetterResult
): LetterResult {
  if (prev === 'correct') return 'correct';
  if (next === 'correct') return 'correct';
  if (prev === 'present') return 'present';
  if (next === 'present') return 'present';
  return 'absent';
}

export function useWordleGame() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(randomAnswer())
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const addLetter = (letter: string) => {
    const l = letter.toLowerCase();
    if (!/^[a-z]$/.test(l)) return;
    dispatch({ type: 'ADD_LETTER', letter: l });
  };

  const removeLetter = () => {
    dispatch({ type: 'REMOVE_LETTER' });
  };

  const submitGuess = () => {
    if (state.status !== 'playing') return;

    const guess = state.currentGuess.toLowerCase();
    if (guess.length !== WORD_LENGTH) {
      dispatch({ type: 'SET_MESSAGE', message: 'Not enough letters' });
      return;
    }
    if (!VALID_GUESSES.has(guess)) {
      dispatch({ type: 'SET_MESSAGE', message: 'Not in word list' });
      return;
    }

    console.log('guess', guess);
    console.log('state.answer', state.answer);
    const fb = evaluateGuess(guess, state.answer);
    dispatch({ type: 'ACCEPT_GUESS', guess, feedback: fb });
  };

  const newGame = () => {
    dispatch({ type: 'NEW_GAME', answer: randomAnswer() });
  };

  const setMessage = (message?: string) => {
    dispatch({ type: 'SET_MESSAGE', message });
  };

  const keyboardStatusMap: Record<string, LetterResult> = Object.create(null);
  for (let rowIdx = 0; rowIdx < state.feedback.length; rowIdx++) {
    const row = state.feedback[rowIdx]!;
    const guess = state.guesses[rowIdx]!;
    for (let i = 0; i < row.length; i++) {
      const letter = guess[i];
      if (!letter) continue;
      keyboardStatusMap[letter] = mergeLetterResult(keyboardStatusMap[letter], row[i]!);
    }
  }
  const keyboardStatus = keyboardStatusMap;

  /** Submit a full word directly (for AI tooling). Returns structured result. */
  const submitGuessWord = (
    (word: string): {
      success: boolean;
      feedback?: LetterResult[];
      status: GameStatus;
      message?: string;
      gameState?: {
        guesses: string[];
        feedback: LetterResult[][];
        guessNumber: number;
        guessesRemaining: number;
      };
    } => {
      const currentState = stateRef.current;
      if (currentState.status !== 'playing') {
        return {
          success: false,
          status: currentState.status,
          message: 'Game is not in progress',
        };
      }

      const guess = word.toLowerCase().trim();
      if (guess.length !== WORD_LENGTH) {
        return {
          success: false,
          status: 'playing',
          message: 'Word must be exactly 5 letters',
        };
      }
      if (!VALID_GUESSES.has(guess)) {
        return {
          success: false,
          status: 'playing',
          message: 'Not in word list',
        };
      }

      const fb = evaluateGuess(guess, currentState.answer);
      dispatch({ type: 'ACCEPT_GUESS', guess, feedback: fb });

      const nextGuesses = [...currentState.guesses, guess];
      const nextFeedback = [...currentState.feedback, fb];
      const won = fb.every((r) => r === 'correct');
      const lost = !won && nextGuesses.length >= MAX_GUESSES;
      const status: GameStatus = won ? 'won' : lost ? 'lost' : 'playing';

      stateRef.current = {
        ...currentState,
        guesses: nextGuesses,
        feedback: nextFeedback,
        status,
      };

      return {
        success: true,
        feedback: fb,
        status,
        gameState: {
          guesses: nextGuesses,
          feedback: nextFeedback,
          guessNumber: nextGuesses.length,
          guessesRemaining: status === 'playing' ? MAX_GUESSES - nextGuesses.length : 0,
        },
      };
    }
  );

  /** Snapshot of game state for AI tooling. */
  const getGameStateSnapshot = () => {
    return {
      guesses: state.guesses,
      feedback: state.feedback,
      status: state.status,
      keyboardStatus,
      guessesRemaining: MAX_GUESSES - state.guesses.length,
    };
  };

  return {
    state,
    addLetter,
    removeLetter,
    submitGuess,
    submitGuessWord,
    getGameStateSnapshot,
    newGame,
    setMessage,
    keyboardStatus,
    // exported for future AI tooling
    WORD_LENGTH,
    MAX_GUESSES,
  };
}

