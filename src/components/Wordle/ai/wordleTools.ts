import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

export const makeGuessDef = toolDefinition({
  name: 'make_guess',
  description:
    'Submit a 5-letter Wordle guess. Returns feedback: correct (green) = right letter right position, present (yellow) = letter in word elsewhere, absent (grey) = letter not in word. Use get_game_state first to see previous guesses and feedback.',
  inputSchema: z.object({
    word: z
      .string()
      .length(5)
      .describe('Exactly 5 lowercase letters'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    feedback: z
      .array(z.enum(['correct', 'present', 'absent']))
      .optional()
      .describe('Per-letter feedback if guess was valid'),
    status: z.enum(['playing', 'won', 'lost']),
    message: z.string().optional().describe('Error message if invalid (e.g. not in word list)'),
  }),
});

export const getGameStateDef = toolDefinition({
  name: 'get_game_state',
  description:
    'Get the current Wordle game state: guesses made, feedback for each guess, keyboard letter status (correct/present/absent), and how many guesses remain.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    guesses: z.array(z.string()).describe('Submitted guesses (lowercase)'),
    feedback: z
      .array(z.array(z.enum(['correct', 'present', 'absent'])))
      .describe('Feedback per guess per position'),
    status: z.enum(['playing', 'won', 'lost']),
    keyboardStatus: z
      .record(z.string(), z.enum(['correct', 'present', 'absent']))
      .describe('Per-letter status from all guesses'),
    guessesRemaining: z.number().describe('Guesses left (out of 6)'),
  }),
});
