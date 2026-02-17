import { createOpenaiChat } from '@tanstack/ai-openai';

export type AIProvider = 'openai';

const DEFAULT_MODEL = 'gpt-5-mini' as const;

/**
 * Get a chat adapter for the specified provider.
 * Extensible for future providers (anthropic, gemini, etc.).
 */
export function getChatAdapter(
  provider: AIProvider | string = 'openai',
  apiKey?: string
) {
  const key =
    apiKey ??
    (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined) ??
    '';

  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is required. Set it in .dev.vars (local) or Wrangler secrets (production).'
    );
  }

  switch (provider) {
    case 'openai':
      return createOpenaiChat(DEFAULT_MODEL, key);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
