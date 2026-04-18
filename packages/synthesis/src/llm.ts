/**
 * LLM client — unified interface over free-tier providers.
 *
 * Strategy:
 *   - Groq Llama 3.3 70B Versatile:  brief synthesis (high quality)
 *   - Groq Llama 3.1 8B Instant:     classification + ranking (cheap + fast)
 *   - Groq Gemma 2 9B:               sensitivity filtering (fast)
 *   - OpenRouter free models:        fallback on 429s
 *
 * Rate limits (Groq free, April 2026): 30 RPM, 14,400 RPD, 6,000 TPM.
 * We handle 429s with exponential backoff and provider fallback.
 */

type LLMTask = "synthesis" | "classification" | "sensitivity";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  task: LLMTask;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json_object";
}

interface LLMResponse {
  content: string;
  model: string;
  provider: "groq" | "openrouter";
  usage: { promptTokens: number; completionTokens: number };
}

const GROQ_MODELS: Record<LLMTask, string> = {
  synthesis: "llama-3.3-70b-versatile",
  classification: "llama-3.1-8b-instant",
  sensitivity: "gemma2-9b-it",
};

const OPENROUTER_FALLBACK: Record<LLMTask, string> = {
  synthesis: "meta-llama/llama-3.3-70b-instruct:free",
  classification: "meta-llama/llama-3.1-8b-instruct:free",
  sensitivity: "google/gemma-2-9b-it:free",
};

async function callGroq(model: string, opts: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.4,
      ...(opts.responseFormat === "json_object"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  if (res.status === 429) {
    const err = new Error("Groq rate limit hit") as Error & { code?: string };
    err.code = "RATE_LIMIT";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: json.choices[0]!.message.content,
    model,
    provider: "groq",
    usage: {
      promptTokens: json.usage.prompt_tokens,
      completionTokens: json.usage.completion_tokens,
    },
  };
}

async function callOpenRouter(model: string, opts: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://dealbrief.io",
      "X-Title": "DealBrief",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: json.choices[0]!.message.content,
    model,
    provider: "openrouter",
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Main entry point. Try Groq first, fall back to OpenRouter on rate limit.
 * Exponential backoff for transient errors.
 */
export async function llm(opts: LLMOptions): Promise<LLMResponse> {
  const groqModel = GROQ_MODELS[opts.task];
  const fallbackModel = OPENROUTER_FALLBACK[opts.task];

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callGroq(groqModel, opts);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "RATE_LIMIT") {
        // Immediate fallback to OpenRouter on rate limit
        try {
          return await callOpenRouter(fallbackModel, opts);
        } catch (fallbackErr) {
          // If OpenRouter also fails, wait and retry Groq
          await sleep(2 ** attempt * 1000);
          continue;
        }
      }
      if (attempt === maxRetries - 1) throw err;
      await sleep(2 ** attempt * 500);
    }
  }
  throw new Error("LLM call failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a JSON-mode response safely. Strips markdown fences if the model
 * ignored response_format (some free-tier models do).
 */
export function parseJSON<T>(content: string): T {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
