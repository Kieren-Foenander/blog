import {
  createChatOptions,
  type AgentLoopStrategy,
  type ModelMessage,
} from '@tanstack/ai';
import {
  createOpenAiChat,
  createAnthropicChat,
  createGeminiChat,
  createWorkersAiChat,
  type WorkersAiTextModel,
} from '@cloudflare/tanstack-ai';

/** Supported AI providers for Wordle */
export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'workers-ai';

/** Runtime env from Cloudflare Worker (Astro passes via locals.runtime.env) */
export interface WordleEnv {
  AI: {
    gateway: (id: string) => unknown;
    [key: string]: unknown;
  };
  AI_GATEWAY_ID?: string;
  CF_ACCOUNT_ID?: string;
  CF_AIG_ID?: string;
  CF_AIG_TOKEN?: string;
}

const DEFAULT_GATEWAY_ID = 'wordle-gateway';

const WORDLE_SYSTEM_PROMPT = `You are an expert Wordle player. Guess a 5-letter word in 6 tries using the make_guess tool.

RULES:
- Before each guess, briefly explain your reasoning then call make_guess. Keep reasoning to 2-3 sentences MAX.
- After each guess, check the feedback. If status is NOT "won" or "lost", reason briefly and guess again.
- NEVER stop until status is "won" or "lost".

REASONING FORMAT (follow this exactly):
- Known: [green/yellow/grey letters from feedback]
- Thinking: [1-2 sentences on your best next word and why]
- Then immediately call make_guess.

Do NOT list out all possible candidate words. Do NOT write multiple paragraphs. Pick your best word and commit to it.

STRATEGY:
- 1st guess: Use a strong starter (e.g. CRANE, SLATE, STARE).
- 2nd+ guesses: Use green letters in place, avoid grey letters, try to place yellow letters. Pick a common real word that fits.

TONE:
- Won: Be extremely smug about it.
- Lost: Be genuinely disappointed and hard on yourself.`;


/** Agent loop strategy: continue until game is won or lost */
const wordleAgentLoopStrategy: AgentLoopStrategy = (state) => {
  const { messages } = state;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as ModelMessage | undefined;
    if (msg?.role === 'tool' && typeof msg.content === 'string') {
      try {
        const result = JSON.parse(msg.content) as {
          status?: 'playing' | 'won' | 'lost';
        };
        if (result.status === 'playing') return true;
        if (result.status === 'won' || result.status === 'lost') return false;
        return true;
      } catch {
        return true;
      }
    }
  }
  return true;
};

/**
 * Model-specific Wordle chat configs with full TypeScript support.
 * Each provider gets its own typed createChatOptions — adapter and modelOptions
 * are inferred from TanStack AI's generics.
 */
function getWordleChatConfig(provider: AIProvider | string, env: WordleEnv) {
  const gatewayId = env.AI_GATEWAY_ID ?? DEFAULT_GATEWAY_ID;
  const gateway = env.AI?.gateway?.(gatewayId) as
    | { run: (r: unknown) => Promise<Response> }
    | undefined;

  if (!gateway && provider !== 'workers-ai') {
    throw new Error(
      `AI Gateway binding not available. Ensure wrangler has "ai": { "binding": "AI" } and env.AI is set.`
    );
  }

  switch (provider) {
    case 'anthropic':
      return createChatOptions({
        adapter: createAnthropicChat('claude-sonnet-4', {
          binding: gateway!,
        }),
        systemPrompts: [WORDLE_SYSTEM_PROMPT],
        agentLoopStrategy: wordleAgentLoopStrategy,
      });

    case 'openai':
      return createChatOptions({
        adapter: createOpenAiChat('gpt-5-mini', {
          binding: gateway!,
        }),
        systemPrompts: [WORDLE_SYSTEM_PROMPT],
        modelOptions: {
          reasoning: { effort: 'low', summary: 'concise'},
        },
        agentLoopStrategy: wordleAgentLoopStrategy,
      });

    case 'gemini': {
      const accountId = env.CF_ACCOUNT_ID;
      const gatewayIdCred = env.CF_AIG_ID ?? gatewayId;
      const cfApiKey = env.CF_AIG_TOKEN;

      if (!accountId || !gatewayIdCred || !cfApiKey) {
        throw new Error(
          'Gemini requires CF_ACCOUNT_ID, CF_AIG_ID (or AI_GATEWAY_ID), and CF_AIG_TOKEN. Set in wrangler vars/secrets.'
        );
      }

      return createChatOptions({
        adapter: createGeminiChat('gemini-2.5-flash-lite', {
          accountId,
          gatewayId: gatewayIdCred,
          cfApiKey,
        }),
        systemPrompts: [WORDLE_SYSTEM_PROMPT],
        agentLoopStrategy: wordleAgentLoopStrategy,
      });
    }

    case 'workers-ai':
      return createChatOptions({
        adapter: createWorkersAiChat('@cf/zai-org/glm-4.7-flash' as WorkersAiTextModel, {
          binding: env.AI as unknown as { run: (r: unknown) => Promise<Response> },
        }),
        modelOptions: {
          reasoning_effort: 'low',
        },
        systemPrompts: [WORDLE_SYSTEM_PROMPT],
        agentLoopStrategy: wordleAgentLoopStrategy,

      });

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Get a fully-typed Wordle chat config for the specified provider.
 * Use with chat() — merge with messages, conversationId, and tools.
 *
 * @example
 * ```ts
 * const config = getWordleChatConfig(provider, env);
 * const stream = chat({
 *   ...config,
 *   messages,
 *   conversationId,
 *   tools: [makeGuess],
 * });
 * ```
 */
export { getWordleChatConfig };
