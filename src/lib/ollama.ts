import { env } from "@/lib/env";

export type OllamaRole = "system" | "user" | "assistant";

export type OllamaMessage = {
  role: OllamaRole;
  content: string;
};

type ChatOptions = {
  model?: string;
  messages: OllamaMessage[];
  temperature?: number;
};

function withTimeout(signalTimeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), signalTimeoutMs);
  return controller.signal;
}

function ollamaUrl(path: string): string {
  return `${env.OLLAMA_HOST.replace(/\/$/, "")}${path}`;
}

function normalizeOllamaError(status: number, detail: string): Error {
  if (status === 404) {
    return new Error(
      `Ollama endpoint not found at ${env.OLLAMA_HOST}. Confirm Ollama is running and API routes are available.`,
    );
  }

  if (status >= 500) {
    return new Error(`Ollama server error (${status}): ${detail}`);
  }

  return new Error(`Ollama request failed (${status}): ${detail}`);
}

export async function chatCompletion({
  model = env.OLLAMA_MODEL,
  messages,
  temperature = 0.2,
}: ChatOptions): Promise<string> {
  const response = await fetch(ollamaUrl("/api/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: {
        temperature,
      },
    }),
    signal: withTimeout(180_000),
  }).catch((error) => {
    throw new Error(`Cannot reach Ollama at ${env.OLLAMA_HOST}: ${String(error)}`);
  });

  if (!response.ok) {
    const detail = await response.text();
    throw normalizeOllamaError(response.status, detail);
  }

  const payload = (await response.json()) as {
    message?: { content?: string };
    response?: string;
  };

  const content = payload.message?.content ?? payload.response;
  if (!content) {
    throw new Error("Ollama returned an empty response.");
  }

  return content;
}

export async function createChatStream({
  model = env.OLLAMA_MODEL,
  messages,
  temperature = 0.2,
}: ChatOptions): Promise<{ stream: ReadableStream<Uint8Array>; done: Promise<string> }> {
  const response = await fetch(ollamaUrl("/api/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
      options: {
        temperature,
      },
    }),
    signal: withTimeout(300_000),
  }).catch((error) => {
    throw new Error(`Cannot reach Ollama at ${env.OLLAMA_HOST}: ${String(error)}`);
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw normalizeOllamaError(response.status, detail);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let resolveDone: (value: string) => void = () => undefined;
  let rejectDone: (reason?: unknown) => void = () => undefined;

  const done = new Promise<string>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finalText = "";
      let buffer = "";
      const reader = response.body!.getReader();

      try {
        while (true) {
          const { done: readerDone, value } = await reader.read();
          if (readerDone) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          while (buffer.includes("\n")) {
            const lineBreakIndex = buffer.indexOf("\n");
            const line = buffer.slice(0, lineBreakIndex).trim();
            buffer = buffer.slice(lineBreakIndex + 1);

            if (!line) {
              continue;
            }

            const parsed = JSON.parse(line) as {
              message?: { content?: string };
              response?: string;
              done?: boolean;
            };

            const token = parsed.message?.content ?? parsed.response ?? "";
            if (token) {
              finalText += token;
              controller.enqueue(encoder.encode(token));
            }

            if (parsed.done) {
              resolveDone(finalText);
            }
          }
        }

        if (buffer.trim()) {
          const parsed = JSON.parse(buffer.trim()) as {
            message?: { content?: string };
            response?: string;
          };
          const token = parsed.message?.content ?? parsed.response ?? "";
          if (token) {
            finalText += token;
            controller.enqueue(encoder.encode(token));
          }
        }

        resolveDone(finalText);
        controller.close();
      } catch (error) {
        rejectDone(error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return {
    stream,
    done,
  };
}

export async function embedText(input: string, model = env.OLLAMA_EMBEDDING_MODEL): Promise<number[]> {
  const prompt = input.trim();
  if (!prompt) {
    return [];
  }

  const request = async (path: string, body: unknown): Promise<Response> => {
    return fetch(ollamaUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: withTimeout(120_000),
    });
  };

  let response = await request("/api/embeddings", {
    model,
    prompt,
  }).catch((error) => {
    throw new Error(`Cannot reach Ollama at ${env.OLLAMA_HOST}: ${String(error)}`);
  });

  if (response.status === 404) {
    response = await request("/api/embed", {
      model,
      input: prompt,
    });
  }

  if (!response.ok) {
    throw normalizeOllamaError(response.status, await response.text());
  }

  const payload = (await response.json()) as {
    embedding?: number[];
    embeddings?: number[][];
  };

  const embedding = payload.embedding ?? payload.embeddings?.[0];

  if (!embedding || embedding.length === 0) {
    throw new Error(`Ollama embeddings returned no vector using model ${model}.`);
  }

  return embedding;
}
