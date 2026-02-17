import { useEffect, useRef, useState } from 'react';
import { useChat, fetchServerSentEvents, createChatClientOptions } from '@tanstack/ai-react';
import { clientTools } from '@tanstack/ai-client';
import { useWordleGame } from './useWordleGame';
import { makeGuessDef, getGameStateDef } from './ai/wordleTools';
import type { LetterResult } from './types';
import { MAX_GUESSES, WORD_LENGTH } from './types';
import './WordleGame.css';
import './WordleAIPage.css';

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

  if (isSubmittedRow && result) {
    return (
      <div className={baseClassName} role="textbox" aria-label={displayLetter || 'empty'}>
        <div
          className={`wordle-cell-inner ${shouldAnimate ? 'wordle-cell-inner--flip' : ''} wordle-cell-inner--${result}`}
          style={shouldAnimate ? { animationDelay: `${cellIndex * 100}ms` } : undefined}
        >
          <div className="wordle-cell-front">{displayLetter}</div>
          <div className={`wordle-cell-back wordle-cell-back--${result}`}>{displayLetter}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={baseClassName} role="textbox" aria-label={displayLetter || 'empty'}>
      {displayLetter}
    </div>
  );
}

export default function WordleAIPage() {
  const {
    state,
    submitGuessWord,
    getGameStateSnapshot,
    newGame,
    keyboardStatus,
  } = useWordleGame();

  const [hasStarted, setHasStarted] = useState(false);
  const thoughtPanelRef = useRef<HTMLDivElement>(null);
  const prevGuessesLenRef = useRef(state.guesses.length);

  const [isAnimating, setIsAnimating] = useState(false);

  const makeGuessClient = makeGuessDef.client((input) => {
    return submitGuessWord((input as { word: string }).word);
  });

  // const getGameStateClient = getGameStateDef.client(() => {
  //   return getGameStateSnapshot();
  // });

  const tools = clientTools(makeGuessClient);

  const chatOptions = createChatClientOptions({
    connection: fetchServerSentEvents('/api/chat'),
    tools,
  });

  const { messages, sendMessage, isLoading, error } = useChat(chatOptions);

  const handleStartGame = () => {
    setHasStarted(true);
    sendMessage('Start playing Wordle. Keep going until you win or lose.');
  };

  // Show Continue button when model may have stopped (game still playing, not loading, last message from assistant)
  const lastMsg = messages.at(-1);
  const isStuck =
    state.status === 'playing' &&
    !isLoading &&
    state.guesses.length < MAX_GUESSES &&
    lastMsg?.role === 'assistant';

  useEffect(() => {
    if (state.guesses.length > prevGuessesLenRef.current) {
      setIsAnimating(true);
      const id = setTimeout(() => {
        setIsAnimating(false);
        prevGuessesLenRef.current = state.guesses.length;
      }, 900);
      return () => clearTimeout(id);
    }
    prevGuessesLenRef.current = state.guesses.length;
  }, [state.guesses.length]);

  const handleNewGame = () => {
    newGame();
    sendMessage('New game. The board is reset. Start playing Wordle from the beginning.');
  };

  useEffect(() => {
    thoughtPanelRef.current?.scrollTo({
      top: thoughtPanelRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  return (
    <div className="wordle-ai-page">
      <div className="wordle-ai-game">
        <h2 className="wordle-title">Wordle (AI)</h2>

        {!hasStarted ? (
          <button
            type="button"
            className="wordle-new-game"
            onClick={handleStartGame}
          >
            Start Game
          </button>
        ) : null}

        <div className="wordle-grid" aria-label="Guess grid">
          {Array.from({ length: MAX_GUESSES }, (_, rowIdx) => (
            <div key={rowIdx} className="wordle-row" role="row">
              {Array.from({ length: WORD_LENGTH }, (_, colIdx) => {
                const isSubmitted = rowIdx < state.guesses.length;
                const isCurrentRow = !isSubmitted && rowIdx === state.guesses.length;
                const letter = isSubmitted
                  ? state.guesses[rowIdx]?.[colIdx]
                  : isCurrentRow
                    ? state.currentGuess[colIdx]
                    : undefined;
                const result = state.feedback[rowIdx]?.[colIdx];
                const isSubmittedRow = isSubmitted && !!result;
                const isLastSubmittedRow = isSubmitted && rowIdx === state.guesses.length - 1;

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

        {hasStarted && (state.status === 'won' || state.status === 'lost') && (
          <div className="wordle-result">
            <p>
              {state.status === 'won' ? 'AI won!' : `The word was ${state.answer.toUpperCase()}`}
            </p>
            <button
              type="button"
              className="wordle-new-game"
              onClick={handleNewGame}
              disabled={isLoading}
            >
              New Game
            </button>
          </div>
        )}

        <div className="wordle-keyboard" role="group" aria-label="Keyboard status">
          {KEYBOARD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="wordle-keyboard-row">
              {row.map((key) => {
                const status = key.length === 1 ? keyboardStatus[key] : undefined;
                const className = [
                  'wordle-key wordle-key--display-only',
                  key.length > 1 && 'wordle-key--wide',
                  status && `wordle-key--${status}`,
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <span key={key} className={className}>
                    {key === 'Backspace' ? '⌫' : key}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="wordle-ai-thought-panel" ref={thoughtPanelRef}>
        <h3 className="wordle-ai-thought-title">AI thinking</h3>
        {error && (
          <div className="wordle-ai-error">
            {error.message}
          </div>
        )}
        <div className="wordle-ai-thought-content">
          {messages.map((message) =>
            message.parts.map((part, idx) => {
              if (part.type === 'thinking') {
                return (
                  <div key={`${message.id}-${idx}`} className="wordle-ai-thinking">
                    {part.content}
                  </div>
                );
              }
              if (part.type === 'text' && part.content) {
                return (
                  <div key={`${message.id}-${idx}`} className="wordle-ai-text">
                    {part.content}
                  </div>
                );
              }
              if (part.type === 'tool-call') {
                const name = part.name;
                const input = part.input as Record<string, unknown> | undefined;
                const word = name === 'make_guess' && input?.word ? String(input.word).toUpperCase() : null;
                return (
                  <div key={`${message.id}-${idx}`} className="wordle-ai-tool-call">
                    {name === 'make_guess' && word ? `Guessing: ${word}` : `Tool: ${name}`}
                  </div>
                );
              }
              return null;
            })
          )}
        </div>
        {isLoading && (
          <div className="wordle-ai-loading">Thinking…</div>
        )}
        {isStuck && (
          <div className="wordle-ai-stalled">
            <p className="wordle-ai-stalled-message">The AI stopped responding. Tap continue to prompt it to make its next guess.</p>
            <button
              type="button"
              className="wordle-continue"
              onClick={() => sendMessage('Continue. Make your next guess using make_guess.')}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
