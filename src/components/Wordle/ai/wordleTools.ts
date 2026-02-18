import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

export const makeGuessDef = toolDefinition({
  name: 'make_guess',
  description:
    'Submit a 5-letter Wordle guess. Returns feedback: correct (green) = right letter right position, present (yellow) = letter in word elsewhere, absent (grey) = letter not in word. The response includes gameState with all past guesses, feedback, guessNumber, and guessesRemaining. When guessesRemaining is 0 or status is won/lost, the game is over.',
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
      .describe('Per-letter feedback for this guess if valid'),
    status: z.enum(['playing', 'won', 'lost']),
    message: z.string().optional().describe('Error message if invalid (e.g. not in word list)'),
    /** Full game state after this guess: all guesses made, all feedback, and progress. */
    gameState: z
      .object({
        guesses: z.array(z.string()).describe('All guesses made including this one'),
        feedback: z
          .array(z.array(z.enum(['correct', 'present', 'absent'])))
          .describe('Feedback for each guess'),
        guessNumber: z.number().describe('Which guess this was (1-based)'),
        guessesRemaining: z.number().describe('Guesses left; 0 means game over'),
      })
      .optional()
      .describe('Present when guess was successful; includes past state and current progress'),
    /** The answer word, only present when status is "lost" (for UI display). */
    answer: z.string().optional(),
  }),
});