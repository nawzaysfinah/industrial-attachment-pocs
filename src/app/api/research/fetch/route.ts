import { z } from "zod";

import { jsonError } from "@/lib/http";
import { fetchResearchBatch } from "@/lib/web-research";

export const runtime = "nodejs";

const ResearchRequestSchema = z.object({
  urls: z.array(z.string()).min(1).max(5),
  budget: z.enum(["low", "medium"]).default("low"),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const payload = ResearchRequestSchema.parse(body);
    const sources = await fetchResearchBatch(payload.urls, payload.budget);

    return Response.json({
      sources,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid research payload", 400, error.flatten());
    }

    return jsonError("Research fetch failed", 500, String(error));
  }
}
