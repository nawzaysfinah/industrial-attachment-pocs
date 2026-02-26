import { z } from "zod";

import { setPocValidated } from "@/lib/graphrag";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const BodySchema = z.object({
  validated: z.boolean(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; nodeId: string }> },
): Promise<Response> {
  try {
    const params = await context.params;
    const caseId = Number(params.id);
    const nodeId = Number(params.nodeId);

    if (Number.isNaN(caseId) || Number.isNaN(nodeId)) {
      return jsonError("Invalid id", 400);
    }

    const body = await request.json();
    const payload = BodySchema.parse(body);

    setPocValidated(caseId, nodeId, payload.validated);

    return Response.json({
      success: true,
      case_id: caseId,
      node_id: nodeId,
      validated: payload.validated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid request", 400, error.flatten());
    }

    return jsonError("Failed to update POC validation state", 500, String(error));
  }
}
