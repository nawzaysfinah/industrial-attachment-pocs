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

  const latest = detail.reports[0];
  if (!latest) {
    return jsonError("No generated report found", 404);
  }

  const filename = `${detail.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.md`;

  return new Response(latest.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
