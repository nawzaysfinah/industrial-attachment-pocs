import { z } from "zod";

import { createCase, getCaseDetail, listCases } from "@/lib/cases";
import { ingestCaseGraph } from "@/lib/graphrag";
import { jsonError } from "@/lib/http";
import { CaseInputSchema } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const cases = listCases();
    return Response.json({ cases });
  } catch (error) {
    return jsonError("Failed to list cases", 500, String(error));
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const payload = CaseInputSchema.parse(body);

    const caseId = createCase(payload);
    const graph = await ingestCaseGraph(caseId);

    return Response.json({
      case_id: caseId,
      graph,
      case: getCaseDetail(caseId),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid case payload", 400, error.flatten());
    }

    return jsonError("Failed to create case", 500, String(error));
  }
}
