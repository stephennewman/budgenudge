import OpenAI from 'openai';

/**
 * Shared LLM client for Krezzo, backed by OpenRouter (Claude by default).
 *
 * OpenRouter exposes an OpenAI-compatible API, so we reuse the `openai` SDK
 * and simply point it at the OpenRouter base URL. The model is configurable
 * via OPENROUTER_MODEL so we can swap Claude versions without code changes.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Stable alias that always resolves to the newest Claude Sonnet on OpenRouter.
// Override with a concrete slug (e.g. anthropic/claude-sonnet-4.6) for reproducibility.
export const DEFAULT_LLM_MODEL = process.env.OPENROUTER_MODEL || '~anthropic/claude-sonnet-latest';

export function isLLMConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        // Optional attribution headers used by OpenRouter analytics.
        'HTTP-Referer': 'https://get.krezzo.com',
        'X-Title': 'Krezzo',
      },
    });
  }
  return client;
}

export interface GenerateTextOptions {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Single-shot text generation. Throws if the call fails so callers can
 * decide whether to fall back to deterministic output.
 */
export async function generateText({
  prompt,
  system,
  model,
  temperature = 0.7,
  maxTokens = 400,
}: GenerateTextOptions): Promise<string> {
  const resp = await getClient().chat.completions.create({
    model: model || DEFAULT_LLM_MODEL,
    temperature,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user' as const, content: prompt },
    ],
  });

  return resp.choices[0]?.message?.content?.trim() || '';
}
