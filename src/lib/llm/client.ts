import { z } from "zod";

const chatChoiceSchema = z.object({
  message: z.object({
    content: z.string().nullable().optional()
  })
});

const chatResponseSchema = z.object({
  choices: z.array(chatChoiceSchema)
});

const embeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number())
    })
  )
});

function withTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer)
  };
}

export async function callJsonModel<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  opts: { model?: string; temperature?: number } = {}
): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = opts.model ?? process.env.ANSWER_MODEL ?? "gpt-4o-mini";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 2000);
  const { signal, cleanup } = withTimeoutSignal(timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.1,
        messages: [
          { role: "system", content: "Return only valid JSON. Do not include markdown." },
          { role: "user", content: prompt }
        ]
      }),
      signal
    });
  } catch {
    cleanup();
    return null;
  }
  cleanup();

  if (!response.ok) {
    return null;
  }

  const parsed = chatResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  const content = parsed.data.choices[0]?.message.content;
  if (!content) return null;

  try {
    const payload = JSON.parse(content);
    const validated = schema.safeParse(payload);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export async function callEmbeddingModel(
  texts: string[],
  model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"
): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 2000);
  const { signal, cleanup } = withTimeoutSignal(timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: texts
      }),
      signal
    });
  } catch {
    cleanup();
    return null;
  }
  cleanup();
  if (!response.ok) return null;
  const parsed = embeddingResponseSchema.safeParse(await response.json());
  if (!parsed.success) return null;
  return parsed.data.data.map((entry) => entry.embedding);
}
