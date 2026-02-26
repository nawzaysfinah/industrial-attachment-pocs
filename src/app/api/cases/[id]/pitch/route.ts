import { chatCompletion } from "@/lib/ollama";
import {
  buildPitchRegenerationMessages,
  replacePitchMessage,
} from "@/lib/report";
import {
  getCaseDetail,
  getLatestReport,
  touchCase,
  updateReport,
} from "@/lib/cases";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const params = await context.params;
    const caseId = Number(params.id);

    if (Number.isNaN(caseId)) {
      return jsonError("Invalid case id", 400);
    }

    const detail = getCaseDetail(caseId);
    if (!detail) {
      return jsonError("Case not found", 404);
    }

    const latestReport = getLatestReport(caseId);
    if (!latestReport) {
      return jsonError("No report found for this case", 404);
    }

    const newPitch = await chatCompletion({
      messages: buildPitchRegenerationMessages(caseId),
      temperature: 0.3,
    });

    const updated = replacePitchMessage(latestReport.markdown, newPitch);
    updateReport(latestReport.id, updated);
    touchCase(caseId);

    return Response.json({
      case_id: caseId,
      pitch: newPitch,
      markdown: updated,
    });
  } catch (error) {
    return jsonError("Failed to regenerate pitch", 500, String(error));
  }
}
