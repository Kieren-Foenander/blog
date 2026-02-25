import type { APIRoute } from 'astro';
import {
  chat,
  toServerSentEventsResponse,
  type ModelMessage,
} from '@tanstack/ai';
import { getWordleChatConfig, type WordleEnv } from '../../lib/ai/adapters';
import { makeGuessDef } from '../../components/Wordle/ai/wordleTools';
import { evaluateGuess } from '../../components/Wordle/evaluateGuess';
import { getOrCreateGame } from '../../lib/wordle/gameStore';
import { VALID_GUESSES } from '../../lib/wordle/words';
import { MAX_GUESSES } from '../../components/Wordle/types';

export const prerender = false;

const MAX_AI_GAMES_PER_IP = 5;

function getClientIdentifier(request: Request): string {
  // Cloudflare sets this with the real client IP
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp?.trim()) return cfIp.trim();
  // Fallback for proxies
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded?.trim()) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  // Local dev: platformProxy may not set CF-Connecting-IP; use localhost so rate limit still applies
  // uncomment this to test locally
  // try {
  //   const url = new URL(request.url);
  //   if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
  //     return '127.0.0.1';
  //   }
  // } catch {
  //   /* ignore */
  // }
  return 'unknown';
}

async function checkRateLimit(
  kv: { get: (k: string) => Promise<string | null>; put: (k: string, v: string) => Promise<void> },
  identifier: string
): Promise<{ allowed: boolean; count: number }> {
  const key = `wordle-ai:${identifier}`;
  const raw = await kv.get(key);
  const count = raw ? Math.min(parseInt(raw, 10) || 0, MAX_AI_GAMES_PER_IP) : 0;
  if (count >= MAX_AI_GAMES_PER_IP) {
    return { allowed: false, count };
  }
  await kv.put(key, String(count + 1));
  return { allowed: true, count: count + 1 };
}

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;

  const env = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime
    ?.env;

  if (!env?.AI) {
    return new Response(
      JSON.stringify({
        error:
          'AI binding not configured. Add "ai": { "binding": "AI" } to wrangler.jsonc and run with Cloudflare runtime (wrangler dev / deploy).',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Rate limit: max 2 AI games per IP
  const kv = env.WORDLE_RATE_LIMIT as { get: (k: string) => Promise<string | null>; put: (k: string, v: string) => Promise<void> } | undefined;
  const identifier = getClientIdentifier(request);
  if (kv) {
    try {
      const { allowed } = await checkRateLimit(kv, identifier);
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "You've used your 2 free AI Wordle games. Thanks for playing!",
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } catch {
      // If KV fails, allow the request (fail open) so users aren't blocked
    }
  }

  try {
    const body = await request.json();
    const { messages, data } = body as {
      messages: ModelMessage[];
      data?: { provider?: string; conversationId?: string; newGame?: boolean };
    };

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = (data?.provider as string) ?? 'openai';
    const chatConfig = getWordleChatConfig(provider, env as unknown as WordleEnv);

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
      ...chatConfig,
      messages: messages as never,
      conversationId,
      tools: [makeGuess],
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
