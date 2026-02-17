import type { APIRoute } from 'astro';
import {
  chat,
  combineStrategies,
  maxIterations,
  toServerSentEventsResponse,
  type ConstrainedModelMessage,
} from '@tanstack/ai';
import { getChatAdapter } from '../../lib/ai/adapters';
import { makeGuessDef, getGameStateDef } from '../../components/Wordle/ai/wordleTools';
import type { OpenAIMessageMetadataByModality } from '@tanstack/ai-openai';

export const prerender = false;

const WORDLE_SYSTEM_PROMPT = `You are an expert Wordle player. 
Before each guess give a very short and concise explanation to the user how you are thinking through your guesses and optimize for information gain. 
After each guess, use the feedback to make your next guess.
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
      data?: { provider?: string; conversationId?: string };
    };

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = (data?.provider as string) ?? 'openai';
    const adapter = getChatAdapter(provider, apiKey);

    const stream = chat({
      adapter,
      messages: messages,
      conversationId: data?.conversationId,
      systemPrompts: [WORDLE_SYSTEM_PROMPT],
      tools: [makeGuessDef],
      agentLoopStrategy: combineStrategies([
        maxIterations(20),
        (data) => {
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
      ]),
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
