import { useEffect, useReducer, useRef, useState } from 'react';
import { useWordleGame } from './useWordleGame';
import type { LetterResult } from './types';
import { MAX_GUESSES, WORD_LENGTH } from './types';
import './WordleGame.css';

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace'],
];

function Cell({
  letter,
  result,
  isCurrentRow,
  isSubmittedRow,
  isLastSubmittedRow,
  cellIndex,
}: {
  letter?: string;
  result?: LetterResult;
  isCurrentRow: boolean;
  isSubmittedRow: boolean;
  isLastSubmittedRow: boolean;
  cellIndex: number;
}) {
  const displayLetter = letter?.toUpperCase() ?? '';
  const shouldAnimate = isSubmittedRow && isLastSubmittedRow && result;

  const baseClassName = [
    'wordle-cell',
    !result && isCurrentRow && letter && 'wordle-cell--filled',
    isSubmittedRow && result && 'wordle-cell--flip',
  ]
    .filter(Boolean)
    .join(' ');

  // Submitted row with result: use flip structure
  if (isSubmittedRow && result) {
    return (
      <div
        className={baseClassName}
        role="textbox"
        aria-label={displayLetter || 'empty'}
      >
        <div
          className={`wordle-cell-inner ${shouldAnimate ? 'wordle-cell-inner--flip' : ''} wordle-cell-inner--${result}`}
          style={
            shouldAnimate
              ? { animationDelay: `${cellIndex * 100}ms` }
              : undefined
          }
        >
          <div className="wordle-cell-front">{displayLetter}</div>
          <div className={`wordle-cell-back wordle-cell-back--${result}`}>
            {displayLetter}
          </div>
        </div>
      </div>
    );
  }

  // Non-submitted or current row: simple display
  return (
    <div className={baseClassName} role="textbox" aria-label={displayLetter || 'empty'}>
      {displayLetter}
    </div>
  );
}

export default function WordleGame() {
  const {
    state,
    addLetter,
    removeLetter,
    submitGuess,
    newGame,
    setMessage,
    keyboardStatus,
  } = useWordleGame();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAnimating, dispatchAnim] = useReducer(
    (s: boolean, a: 'start' | 'end') => (a === 'start' ? true : false),
    false
  );
  const prevGuessesLenRef = useRef(state.guesses.length);

  // Block input during flip animation (~900ms for 5 letters)
  useEffect(() => {
    if (state.guesses.length > prevGuessesLenRef.current) {
      let endId: ReturnType<typeof setTimeout>;
      const id = setTimeout(() => {
        dispatchAnim('start');
        prevGuessesLenRef.current = state.guesses.length;
        endId = setTimeout(() => dispatchAnim('end'), 900);
      }, 0);
      return () => {
        clearTimeout(id);
        clearTimeout(endId!);
      };
    }
    prevGuessesLenRef.current = state.guesses.length;
  }, [state.guesses.length]);

  const canPlay = state.status === 'playing' && !isAnimating;

  // Physical keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canPlay) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        submitGuess();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        removeLetter();
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        addLetter(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canPlay, addLetter, removeLetter, submitGuess]);

  // Clear transient message after delay
  useEffect(() => {
    if (!state.message) return;
    const id = setTimeout(() => setMessage(undefined), 2000);
    return () => clearTimeout(id);
  }, [state.message, setMessage]);

  const handleKeyClick = (key: string) => {
    if (!canPlay) return;
    if (key === 'Enter') submitGuess();
    else if (key === 'Backspace') removeLetter();
    else addLetter(key);
  };

  const buildShareText = () => {
    const emojiMap: Record<LetterResult, string> = {
      absent: '⬛',
      present: '🟨',
      correct: '🟩',
    };
    const lines = state.feedback.map((row) =>
      row.map((r) => emojiMap[r]).join('')
    );
    return `my word was ${state.answer.toUpperCase()}\n\n${lines.join('\n')}`;
  };

  const handleCopyResult = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setMessage('Copied!');
    } catch {
      setMessage('Failed to copy');
    }
  };

  return (
    <div ref={containerRef} className="wordle-game" role="application" aria-label="Wordle game">
      <h2 className="wordle-title">Wordle</h2>

      <div
        className={`wordle-message${state.message ? ' wordle-message--visible' : ''}`}
        role="alert"
        aria-live="polite"
      >
        {state.message ?? '\u00A0'}
      </div>

      <div className="wordle-grid" aria-label="Guess grid">
        {Array.from({ length: MAX_GUESSES }, (_, rowIdx) => (
          <div key={rowIdx} className="wordle-row" role="row">
            {Array.from({ length: WORD_LENGTH }, (_, colIdx) => {
              const isSubmitted = rowIdx < state.guesses.length;
              const isCurrentRow =
                !isSubmitted && rowIdx === state.guesses.length;
              const letter = isSubmitted
                ? state.guesses[rowIdx]?.[colIdx]
                : isCurrentRow
                  ? state.currentGuess[colIdx]
                  : undefined;
              const result = state.feedback[rowIdx]?.[colIdx];

              const isSubmittedRow = isSubmitted && !!result;
              const isLastSubmittedRow =
                isSubmitted && rowIdx === state.guesses.length - 1;

              return (
                <Cell
                  key={colIdx}
                  letter={letter}
                  result={result}
                  isCurrentRow={isCurrentRow}
                  isSubmittedRow={isSubmittedRow}
                  isLastSubmittedRow={isLastSubmittedRow}
                  cellIndex={colIdx}
                />
              );
            })}
          </div>
        ))}
      </div>

      {(state.status === 'won' || state.status === 'lost') && (
        <div className="wordle-result">
          <p>
            {state.status === 'won'
              ? 'You won!'
              : `The word was ${state.answer.toUpperCase()}`}
          </p>
          <div className="wordle-result-actions">
            <button
              type="button"
              className="wordle-copy-result"
              onClick={handleCopyResult}
            >
              <svg
                className="wordle-copy-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              Copy your result and put it in the comments!
            </button>
            <button
              type="button"
              className="wordle-new-game"
              onClick={newGame}
            >
              New Game
            </button>
          </div>
        </div>
      )}

      <div className="wordle-keyboard" role="group" aria-label="Virtual keyboard">
        {KEYBOARD_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="wordle-keyboard-row">
            {row.map((key) => {
              const status = key.length === 1 ? keyboardStatus[key] : undefined;
              const className = [
                'wordle-key',
                key.length > 1 && 'wordle-key--wide',
                status && `wordle-key--${status}`,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  onClick={() => handleKeyClick(key)}
                  disabled={!canPlay}
                >
                  {key === 'Backspace' ? '⌫' : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
