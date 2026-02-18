import type { APIRoute } from 'astro';
import {
  chat,
  toServerSentEventsResponse,
  type ConstrainedModelMessage,
} from '@tanstack/ai';
import { getChatAdapter } from '../../lib/ai/adapters';
import { makeGuessDef } from '../../components/Wordle/ai/wordleTools';
import { evaluateGuess } from '../../components/Wordle/evaluateGuess';
import { getOrCreateGame } from '../../lib/wordle/gameStore';
import { VALID_GUESSES } from '../../lib/wordle/words';
import { MAX_GUESSES } from '../../components/Wordle/types';
import type { OpenAIMessageMetadataByModality } from '@tanstack/ai-openai';

export const prerender = false;

const WORDLE_SYSTEM_PROMPT = `You are an expert Wordle player agent. it is a game where you need to guess a word in 6 attempts or less. The word is 5 letters long.
You have been given a tool make_guess which you can use to make a guess. The tool will return a feedback on your guess and the game state. if this tool does not return a status of "playing" you should continue making guesses until the game status is "win" or "lose".
Before each guess give a very short and concise explanation to the user how you are thinking through your guesses and optimize for information gain to achieve the word in a few guesses as possible. 
After each guess, use the feedback to think about optimising your next guess for achieving the fewest guesses possible and then guess again.
After winning be really smug about it. After losing be really disappointed and hard on yourself for not being able to guess the word.
IT IS EXTREMELY IMPORTANT THAT YOU DO NOT STOP GUESSING UNTIL THE GAME IS IN A STATE OF "WON" OR "LOST".
`;

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;

  const apiKey =
    (locals as { runtime?: { env?: { OPENAI_API_KEY?: string } } })?.runtime?.env
      ?.OPENAI_API_KEY ?? (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { messages, data } = body as {
      messages: ConstrainedModelMessage<{
        inputModalities: ["text", "image"];
        messageMetadataByModality: OpenAIMessageMetadataByModality;
    }>[];
      data?: { provider?: string; conversationId?: string; newGame?: boolean };
    };

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = (data?.provider as string) ?? 'openai';
    const adapter = getChatAdapter(provider, apiKey);

    const conversationId =
      (data?.conversationId as string)?.trim() || `wordle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGame = data?.newGame === true;

    // Initialize or reset game before the agent loop runs
    getOrCreateGame(conversationId, { newGame });

    const makeGuess = makeGuessDef.server(async (input: unknown) => {
      const { word } = input as { word: string };
      let game = getOrCreateGame(conversationId);

      // If game isn't playing but has no guesses, it was never properly started
      // (e.g. serverless cold start, module reload). Force a fresh game.
      if (game.status !== 'playing' && game.guesses.length === 0) {
        game = getOrCreateGame(conversationId, { newGame: true });
      }

      if (game.status !== 'playing') {
        return {
          success: false,
          status: game.status,
          message: 'Game is not in progress',
        };
      }

      const guess = word.toLowerCase().trim();
      if (guess.length !== 5) {
        return {
          success: false,
          status: 'playing' as const,
          message: 'Word must be exactly 5 letters',
        };
      }
      if (!VALID_GUESSES.has(guess)) {
        return {
          success: false,
          status: 'playing' as const,
          message: 'Not in word list',
        };
      }

      const fb = evaluateGuess(guess, game.answer);
      game.guesses = [...game.guesses, guess];
      game.feedback = [...game.feedback, fb];
      const won = fb.every((r) => r === 'correct');
      const lost = !won && game.guesses.length >= MAX_GUESSES;
      game.status = won ? 'won' : lost ? 'lost' : 'playing';

      const result = {
        success: true,
        feedback: fb,
        status: game.status,
        gameState: {
          guesses: game.guesses,
          feedback: game.feedback,
          guessNumber: game.guesses.length,
          guessesRemaining: game.status === 'playing' ? MAX_GUESSES - game.guesses.length : 0,
        },
        ...(game.status === 'lost' ? { answer: game.answer } : {}),
      };
      return result;
    });

    const stream = chat({
      adapter,
      messages: messages,
      conversationId,
      systemPrompts: [WORDLE_SYSTEM_PROMPT],
      tools: [makeGuess],
      agentLoopStrategy: (data) => {
      // Find the most recent make_guess tool result and check status
      for (let i = data.messages.length - 1; i >= 0; i--) {
        const msg = data.messages[i];
        if (msg.role === 'tool' && typeof msg.content === 'string') {
          try {
            const result = JSON.parse(msg.content) as {
              status?: 'playing' | 'won' | 'lost';
            };
            if (result.status === 'playing') return true; // continue
            if (result.status === 'won' || result.status === 'lost')
              return false; // stop
            // No status (unexpected), continue to be safe
            return true;
          } catch {
            return true;
          }
        }
      }
      return true; // No tool result yet, continue
    },
      modelOptions: {
        reasoning: { effort: 'low', summary: 'auto' },
      },
    });

    return toServerSentEventsResponse(stream);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
