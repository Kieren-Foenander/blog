import { useEffect, useRef, useState } from 'react';
import { useChat, fetchServerSentEvents, createChatClientOptions } from '@tanstack/ai-react';
import type { AIProvider } from '../../lib/ai/adapters';
import type { LetterResult } from './types';
import { MAX_GUESSES, WORD_LENGTH } from './types';
import './WordleGame.css';
import './WordleGameAI.css';

const MODEL_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'anthropic', label: 'Claude Sonnet 4.5' },
  { value: 'openai', label: 'GPT 5 Mini' },
  { value: 'gemini', label: 'Gemini 3.0' },
  { value: 'workers-ai', label: 'GLM 4.7 Flash' },
];

interface MakeGuessOutput {
  success: boolean;
  status: 'playing' | 'won' | 'lost';
  gameState?: { guesses: string[]; feedback: LetterResult[][] };
  answer?: string;
}

function useWordleStateFromMessages(
  messages: Array<{
    parts: Array<
      | { type: string; name?: string; output?: unknown }
      | { type: 'tool-result'; content?: string }
    >;
  }>
) {
  let latest: MakeGuessOutput | null = null;
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'tool-call' && part.name === 'make_guess' && part.output) {
        const out = part.output as MakeGuessOutput;
        if (out.gameState) latest = out;
      }
      if (part.type === 'tool-result' && 'content' in part && typeof part.content === 'string') {
        try {
          const out = JSON.parse(part.content) as MakeGuessOutput;
          if (out.gameState) latest = out;
        } catch {
          /* ignore */
        }
      }
    }
  }
  const guesses = latest?.gameState?.guesses ?? [];
  const feedback = latest?.gameState?.feedback ?? [];
  const status = latest?.status ?? 'playing';
  const answer = latest?.answer ?? '';

  const keyboardStatus: Record<string, LetterResult> = Object.create(null);
  for (let rowIdx = 0; rowIdx < feedback.length; rowIdx++) {
    const row = feedback[rowIdx]!;
    const guess = guesses[rowIdx]!;
    for (let i = 0; i < row.length; i++) {
      const letter = guess[i];
      if (!letter) continue;
      const prev = keyboardStatus[letter];
      const next = row[i]!;
      if (prev === 'correct' || next === 'correct') keyboardStatus[letter] = 'correct';
      else if (prev === 'present' || next === 'present') keyboardStatus[letter] = 'present';
      else keyboardStatus[letter] = 'absent';
    }
  }

  return { guesses, feedback, status, answer, keyboardStatus };
}

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

export default function WordleGameAI() {
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const requestBodyRef = useRef<Record<string, unknown>>({ provider });
  const chatOptions = createChatClientOptions({
    connection: fetchServerSentEvents('/api/chat', {
      fetchClient: async (url, init) => {
        const res = await fetch(url, init);
        if (!res.ok && res.status === 429) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Rate limit exceeded. You've used your 2 free AI games.");
        }
        return res;
      },
    }),
    body: requestBodyRef.current,
  });

  const { messages, sendMessage, isLoading, error } = useChat(chatOptions);

  const { guesses, feedback, status, answer, keyboardStatus } =
    useWordleStateFromMessages(messages);

  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    requestBodyRef.current.provider = provider;
  }, [provider]);
  const thoughtPanelRef = useRef<HTMLDivElement>(null);
  const prevGuessesLenRef = useRef(guesses.length);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleStartGame = () => {
    setHasStarted(true);
    requestBodyRef.current.newGame = true;
    sendMessage('Start playing Wordle. Keep going until you win or lose.');
  };

  useEffect(() => {
    if (guesses.length > prevGuessesLenRef.current) {
      setIsAnimating(true);
      const id = setTimeout(() => {
        setIsAnimating(false);
        prevGuessesLenRef.current = guesses.length;
      }, 900);
      return () => clearTimeout(id);
    }
    prevGuessesLenRef.current = guesses.length;
  }, [guesses.length]);

  const handleNewGame = () => {
    requestBodyRef.current.newGame = true;
    sendMessage('New game. The board is reset. Start playing Wordle from the beginning.');
  };

  // Clear newGame flag after request so it doesn't persist
  useEffect(() => {
    if (!isLoading) {
      delete requestBodyRef.current.newGame;
    }
  }, [isLoading]);

  useEffect(() => {
    if (thoughtPanelRef.current) {
      thoughtPanelRef.current.scrollTo({
        top: thoughtPanelRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <div className="wordle-ai-page">
      <div className="wordle-ai-game">
        <h2 className="wordle-title">Wordle (AI)</h2>

        {!hasStarted ? (
          <div className="wordle-ai-model-select">
            <label htmlFor="wordle-model-select" className="wordle-ai-model-label">
              Model
            </label>
            <select
              id="wordle-model-select"
              className="wordle-ai-model-select-input"
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              aria-label="Select AI model"
            >
              {MODEL_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
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
                const isSubmitted = rowIdx < guesses.length;
                const isCurrentRow = false;
                const letter = isSubmitted ? guesses[rowIdx]?.[colIdx] : undefined;
                const result = feedback[rowIdx]?.[colIdx];
                const isSubmittedRow = isSubmitted && !!result;
                const isLastSubmittedRow = isSubmitted && rowIdx === guesses.length - 1;

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

        {hasStarted && (status === 'won' || status === 'lost') && (
          <div className="wordle-result">
            <p>
              {status === 'won' ? 'AI won!' : `The word was ${answer.toUpperCase()}`}
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

      <div className="wordle-ai-thought-panel">
        <h3 className={`wordle-ai-thought-title ${isLoading ? 'wordle-ai-loading wordle-ai-loading-text' : ''}`}>AI thinking</h3>
        {error && (
          <div
            className="wordle-ai-error"
            role="alert"
          >
            {error.message}
          </div>
        )}
        <div className="wordle-ai-thought-content" ref={thoughtPanelRef}>
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
      </div>
    </div>
  );
}
