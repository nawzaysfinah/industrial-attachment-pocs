import { getDb } from "@/lib/db";
import type { CaseDetail, CaseInput, CaseSummary } from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";

export function listCases(): CaseSummary[] {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        c.id,
        c.company_name,
        c.industry_type,
        c.company_size,
        c.ai_maturity,
        c.created_at,
        c.updated_at,
        MAX(r.created_at) AS latest_report_at
      FROM cases c
      LEFT JOIN reports r ON r.case_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      `,
    )
    .all() as CaseSummary[];
}

export function createCase(input: CaseInput): number {
  const db = getDb();

  const tx = db.transaction((payload: CaseInput): number => {
    const descriptionJson = JSON.stringify({
      industry_other: payload.industry_other,
      what_they_do: payload.what_they_do,
      revenue_model: payload.revenue_model,
      revenue_model_other: payload.revenue_model_other,
      tools_used: payload.tools_used,
      data_types: payload.data_types,
      data_access_level: payload.data_access_level,
      data_sensitivity: payload.data_sensitivity,
      top_3_priorities: payload.top_3_priorities,
      observations: payload.observations,
      meeting_notes: payload.meeting_notes,
      research_budget: payload.web_research.budget,
      tone: payload.tone,
    });

    const caseResult = db
      .prepare(
        `
        INSERT INTO cases (
          company_name,
          industry_type,
          company_size,
          ai_maturity,
          description_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `,
      )
      .run(
        payload.company_name,
        payload.industry_type,
        payload.company_size,
        payload.ai_maturity,
        descriptionJson,
      );

    const caseId = Number(caseResult.lastInsertRowid);

    const insertPain = db.prepare(
      `
      INSERT INTO pain_points (
        case_id,
        title,
        detail,
        frequency,
        affected_roles,
        workaround,
        priority_rank
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    );

    payload.pain_points.forEach((painPoint, index) => {
      insertPain.run(
        caseId,
        painPoint.title,
        painPoint.detail,
        painPoint.frequency,
        painPoint.affected_roles,
        painPoint.workaround,
        painPoint.priority_rank ?? index + 1,
      );
    });

    const insertAttachment = db.prepare(
      `
      INSERT INTO attachments (
        case_id,
        filename,
        filetype,
        stored_path,
        extracted_text,
        created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `,
    );

    payload.attachments.forEach((attachment) => {
      insertAttachment.run(
        caseId,
        attachment.filename,
        attachment.filetype,
        attachment.stored_path,
        attachment.extracted_text,
      );
    });

    const insertWebSource = db.prepare(
      `
      INSERT INTO web_sources (
        case_id,
        url,
        title,
        extracted_text,
        retrieved_at
      ) VALUES (?, ?, ?, ?, ?)
      `,
    );

    payload.web_research.sources.forEach((source) => {
      insertWebSource.run(
        caseId,
        source.url,
        source.title,
        source.extracted_text,
        source.retrieved_at,
      );
    });

    return caseId;
  });

  return tx(input);
}

export function touchCase(caseId: number): void {
  const db = getDb();
  db.prepare("UPDATE cases SET updated_at = datetime('now') WHERE id = ?").run(caseId);
}

export function saveReport(params: {
  caseId: number;
  markdown: string;
  promptVersion: string;
  modelUsed: string;
}): number {
  const db = getDb();
  const result = db
    .prepare(
      `
      INSERT INTO reports (
        case_id,
        markdown,
        created_at,
        prompt_version,
        model_used
      ) VALUES (?, ?, datetime('now'), ?, ?)
      `,
    )
    .run(params.caseId, params.markdown, params.promptVersion, params.modelUsed);

  touchCase(params.caseId);
  return Number(result.lastInsertRowid);
}

export function updateReport(reportId: number, markdown: string): void {
  const db = getDb();
  db.prepare("UPDATE reports SET markdown = ? WHERE id = ?").run(markdown, reportId);
}

export function getLatestReport(caseId: number): {
  id: number;
  markdown: string;
  created_at: string;
  prompt_version: string;
  model_used: string;
} | null {
  const db = getDb();
  return (
    (db
      .prepare(
        `
      SELECT id, markdown, created_at, prompt_version, model_used
      FROM reports
      WHERE case_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
      )
      .get(caseId) as {
      id: number;
      markdown: string;
      created_at: string;
      prompt_version: string;
      model_used: string;
    } | null) ?? null
  );
}

export function getCaseDetail(caseId: number): CaseDetail | null {
  const db = getDb();
  const found = db
    .prepare(
      `
      SELECT id, company_name, industry_type, company_size, ai_maturity, description_json, created_at, updated_at
      FROM cases
      WHERE id = ?
      LIMIT 1
      `,
    )
    .get(caseId) as
    | {
        id: number;
        company_name: string;
        industry_type: string;
        company_size: string;
        ai_maturity: string;
        description_json: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!found) {
    return null;
  }

  const painPoints = db
    .prepare(
      `
      SELECT id, title, detail, frequency, affected_roles, workaround, priority_rank
      FROM pain_points
      WHERE case_id = ?
      ORDER BY COALESCE(priority_rank, 999) ASC, id ASC
      `,
    )
    .all(caseId) as CaseDetail["pain_points"];

  const attachments = db
    .prepare(
      `
      SELECT id, filename, filetype, stored_path, extracted_text, created_at
      FROM attachments
      WHERE case_id = ?
      ORDER BY id ASC
      `,
    )
    .all(caseId) as CaseDetail["attachments"];

  const webSources = db
    .prepare(
      `
      SELECT id, url, title, extracted_text, retrieved_at
      FROM web_sources
      WHERE case_id = ?
      ORDER BY id ASC
      `,
    )
    .all(caseId) as CaseDetail["web_sources"];

  const reports = db
    .prepare(
      `
      SELECT id, markdown, created_at, prompt_version, model_used
      FROM reports
      WHERE case_id = ?
      ORDER BY created_at DESC, id DESC
      `,
    )
    .all(caseId) as CaseDetail["reports"];

  const graphPocs = db
    .prepare(
      `
      SELECT id, label, metadata_json
      FROM graph_nodes
      WHERE case_id = ? AND type = 'POC'
      ORDER BY id ASC
      `,
    )
    .all(caseId) as CaseDetail["graph_pocs"];

  return {
    ...found,
    pain_points: painPoints,
    attachments,
    web_sources: webSources,
    reports,
    graph_pocs: graphPocs,
  };
}

export function getCaseDescription<T = Record<string, unknown>>(caseId: number): T {
  const db = getDb();
  const row = db
    .prepare("SELECT description_json FROM cases WHERE id = ? LIMIT 1")
    .get(caseId) as { description_json: string } | undefined;

  if (!row) {
    throw new Error(`Case ${caseId} not found`);
  }

  return safeJsonParse<T>(row.description_json, {} as T);
}
