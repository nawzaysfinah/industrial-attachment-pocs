import { getCaseDetail } from "@/lib/cases";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const params = await context.params;
  const caseId = Number(params.id);

  if (Number.isNaN(caseId)) {
    return jsonError("Invalid case id", 400);
  }

  const detail = getCaseDetail(caseId);
  if (!detail) {
    return jsonError("Case not found", 404);
  }

  return Response.json({ case: detail });
}
