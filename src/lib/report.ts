import { getCaseDetail } from "@/lib/cases";
import type { OllamaMessage } from "@/lib/ollama";
import { loadPrompt, renderTemplate } from "@/lib/prompts";
import type { ToneSchema } from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";
import type { z } from "zod";

export const REPORT_PROMPT_VERSION = "v1";

export type ReportTone = z.infer<typeof ToneSchema>;

export type CasePromptContext = {
  caseId: number;
  contextJson: string;
  sourceIndex: string;
};

function buildSourceIndex(caseId: number): string {
  const detail = getCaseDetail(caseId);
  if (!detail) {
    throw new Error(`Case ${caseId} not found`);
  }

  const lines: string[] = [];

  if (detail.web_sources.length > 0) {
    lines.push("Web sources:");
    for (const source of detail.web_sources) {
      lines.push(`- [source_${source.id}] ${source.url} (${source.title})`);
    }
  }

  if (detail.attachments.length > 0) {
    lines.push("Attachments:");
    for (const attachment of detail.attachments) {
      lines.push(`- [attachment_${attachment.id}] ${attachment.filename}`);
    }
  }

  return lines.join("\n") || "No sources provided.";
}

export function buildCasePromptContext(caseId: number): CasePromptContext {
  const detail = getCaseDetail(caseId);
  if (!detail) {
    throw new Error(`Case ${caseId} not found`);
  }

  const description = safeJsonParse<Record<string, unknown>>(detail.description_json, {});

  const normalized = {
    case_id: detail.id,
    company_name: detail.company_name,
    industry_type: detail.industry_type,
    company_size: detail.company_size,
    ai_maturity: detail.ai_maturity,
    ...description,
    pain_points: detail.pain_points,
    attachments: detail.attachments.map((item) => ({
      id: item.id,
      filename: item.filename,
      extracted_text: item.extracted_text.slice(0, 4000),
      marker: `[attachment_${item.id}]`,
    })),
    web_sources: detail.web_sources.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      extracted_text: item.extracted_text,
      marker: `[source_${item.id}]`,
      retrieved_at: item.retrieved_at,
    })),
  };

  return {
    caseId,
    contextJson: JSON.stringify(normalized, null, 2),
    sourceIndex: buildSourceIndex(caseId),
  };
}

export function buildReportMessages(caseId: number, tone: ReportTone): OllamaMessage[] {
  const systemPrompt = loadPrompt("system.md");
  const reportPrompt = loadPrompt("report.md");
  const context = buildCasePromptContext(caseId);

  const userPrompt = renderTemplate(reportPrompt, {
    TONE: tone,
    CASE_CONTEXT_JSON: context.contextJson,
    SOURCE_INDEX: context.sourceIndex,
  });

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];
}

export function buildPitchRegenerationMessages(caseId: number): OllamaMessage[] {
  const detail = getCaseDetail(caseId);
  if (!detail) {
    throw new Error(`Case ${caseId} not found`);
  }

  const latestReport = detail.reports[0];
  if (!latestReport) {
    throw new Error("No report exists for this case yet.");
  }

  return [
    {
      role: "system",
      content:
        "You write concise SME pitch messages with practical scope. Always include exact phrase: POC built in-school first to de-risk.",
    },
    {
      role: "user",
      content: [
        "Rewrite only the SME pitch message section for this report.",
        "Keep to 120 words max.",
        "Do not add markdown heading, only the message body.",
        "",
        "Context report:",
        latestReport.markdown,
      ].join("\n"),
    },
  ];
}

export function replacePitchMessage(markdown: string, newPitchBody: string): string {
  const sectionRegex =
    /(### SME Pitch Message\s*[\r\n]+)([\s\S]*?)(?=(\n### |\n## |$))/i;

  if (!sectionRegex.test(markdown)) {
    return `${markdown.trim()}\n\n### SME Pitch Message\n${newPitchBody.trim()}\n`;
  }

  return markdown.replace(sectionRegex, (_, heading: string) => {
    return `${heading}${newPitchBody.trim()}\n`;
  });
}
