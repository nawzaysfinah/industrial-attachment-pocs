import { z } from "zod";

import { getCaseDetail, saveReport } from "@/lib/cases";
import { ingestCaseGraph, syncPocNodes } from "@/lib/graphrag";
import { jsonError } from "@/lib/http";
import { createChatStream } from "@/lib/ollama";
import { REPORT_PROMPT_VERSION, buildReportMessages } from "@/lib/report";

export const runtime = "nodejs";

const RegenerateSchema = z.object({
  tone: z.enum(["standard", "critical"]).default("critical"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const params = await context.params;
    const caseId = Number(params.id);

    if (Number.isNaN(caseId)) {
      return jsonError("Invalid case id", 400);
    }

    const caseDetail = getCaseDetail(caseId);
    if (!caseDetail) {
      return jsonError("Case not found", 404);
    }

    const body = await request.json().catch(() => ({}));
    const payload = RegenerateSchema.parse(body);

    const messages = buildReportMessages(caseId, payload.tone);
    const { stream, done } = await createChatStream({
      messages,
      temperature: payload.tone === "critical" ? 0.2 : 0.35,
    });

    const textStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = stream.getReader();

        try {
          while (true) {
            const { done: streamDone, value } = await reader.read();
            if (streamDone) {
              break;
            }
            controller.enqueue(value);
          }

          const markdown = await done;
          saveReport({
            caseId,
            markdown,
            promptVersion: REPORT_PROMPT_VERSION,
            modelUsed: process.env.OLLAMA_MODEL || "qwen3:latest",
          });
          await ingestCaseGraph(caseId);
          syncPocNodes(caseId, markdown);

          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Case-Id": String(caseId),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid regenerate payload", 400, error.flatten());
    }

    return jsonError("Failed to regenerate report", 500, String(error));
  }
}
