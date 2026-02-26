import { getCaseDetail, listCases } from "@/lib/cases";
import { getDb } from "@/lib/db";
import { chatCompletion, embedText } from "@/lib/ollama";
import { chunkText, cosineSimilarity, safeJsonParse } from "@/lib/utils";

type NodeType = "Company" | "PainPoint" | "Tool" | "POC";

type SearchMatch = {
  chunk_id: number;
  case_id: number;
  text: string;
  score: number;
  source_type: string;
  source_id: number | null;
};

function upsertNode(type: NodeType, label: string, caseId: number, metadata: object): number {
  const db = getDb();

  db.prepare(
    `
    INSERT INTO graph_nodes (type, label, case_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(type, label, case_id)
    DO UPDATE SET metadata_json = excluded.metadata_json
    `,
  ).run(type, label, caseId, JSON.stringify(metadata));

  const row = db
    .prepare(
      "SELECT id FROM graph_nodes WHERE type = ? AND label = ? AND case_id = ? LIMIT 1",
    )
    .get(type, label, caseId) as { id: number } | undefined;

  if (!row) {
    throw new Error(`Failed to upsert graph node ${type}:${label}`);
  }

  return row.id;
}

function upsertEdge(fromNodeId: number, toNodeId: number, relation: string, caseId: number): void {
  const db = getDb();
  const exists = db
    .prepare(
      `
      SELECT id
      FROM graph_edges
      WHERE from_node_id = ? AND to_node_id = ? AND relation = ? AND case_id = ?
      LIMIT 1
      `,
    )
    .get(fromNodeId, toNodeId, relation, caseId) as { id: number } | undefined;

  if (!exists) {
    db.prepare(
      `
      INSERT INTO graph_edges (from_node_id, to_node_id, relation, case_id)
      VALUES (?, ?, ?, ?)
      `,
    ).run(fromNodeId, toNodeId, relation, caseId);
  }
}

async function insertChunks(params: {
  caseId: number;
  sourceType: "attachment" | "web" | "manual";
  sourceId: number | null;
  text: string;
}): Promise<number> {
  const db = getDb();
  const chunks = chunkText(params.text, 3200, 320);

  let inserted = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    try {
      const embedding = await embedText(chunks[i]);
      db.prepare(
        `
        INSERT INTO text_chunks (
          case_id,
          source_type,
          source_id,
          chunk_index,
          text,
          embedding_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        params.caseId,
        params.sourceType,
        params.sourceId,
        i,
        chunks[i],
        JSON.stringify(embedding),
      );
      inserted += 1;
    } catch (error) {
      console.error("Embedding failed for chunk:", error);
    }
  }

  return inserted;
}

export async function ingestCaseGraph(caseId: number): Promise<{
  chunksInserted: number;
}> {
  const detail = getCaseDetail(caseId);
  if (!detail) {
    throw new Error(`Case ${caseId} not found`);
  }

  const db = getDb();
  const description = safeJsonParse<Record<string, unknown>>(detail.description_json, {});
  const tools = Array.isArray(description.tools_used)
    ? (description.tools_used as string[])
    : [];

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM graph_edges WHERE case_id = ?").run(caseId);
    db.prepare("DELETE FROM graph_nodes WHERE case_id = ? AND type != 'POC'").run(caseId);
    db.prepare("DELETE FROM text_chunks WHERE case_id = ?").run(caseId);
  });
  tx();

  const companyNodeId = upsertNode("Company", detail.company_name, caseId, {
    industry_type: detail.industry_type,
    company_size: detail.company_size,
    ai_maturity: detail.ai_maturity,
  });

  const toolNodeIds = new Map<string, number>();
  for (const tool of tools) {
    const label = String(tool).trim();
    if (!label) {
      continue;
    }

    const toolNodeId = upsertNode("Tool", label, caseId, {});
    toolNodeIds.set(label.toLowerCase(), toolNodeId);
    upsertEdge(companyNodeId, toolNodeId, "USES_TOOL", caseId);
  }

  for (const pain of detail.pain_points) {
    const painNodeId = upsertNode("PainPoint", pain.title, caseId, {
      detail: pain.detail,
      frequency: pain.frequency,
      affected_roles: pain.affected_roles,
      workaround: pain.workaround,
      priority_rank: pain.priority_rank,
    });

    upsertEdge(companyNodeId, painNodeId, "HAS_PAIN", caseId);

    const needle = `${pain.title} ${pain.detail} ${pain.workaround}`.toLowerCase();
    for (const [toolName, toolNodeId] of toolNodeIds.entries()) {
      if (needle.includes(toolName)) {
        upsertEdge(painNodeId, toolNodeId, "MANIFESTS_IN", caseId);
      }
    }
  }

  let chunksInserted = 0;

  const manualEntries = [
    `${detail.company_name} operates in ${detail.industry_type}.`,
    String(description.what_they_do ?? ""),
    String(description.observations ?? ""),
    String(description.meeting_notes ?? ""),
    ...detail.pain_points.map(
      (pain) =>
        `${pain.title}. Detail: ${pain.detail}. Frequency: ${pain.frequency}. Workaround: ${pain.workaround}.`,
    ),
    ...detail.reports.slice(0, 1).map((report) => report.markdown),
  ].filter(Boolean);

  for (const entry of manualEntries) {
    chunksInserted += await insertChunks({
      caseId,
      sourceType: "manual",
      sourceId: null,
      text: entry,
    });
  }

  for (const attachment of detail.attachments) {
    chunksInserted += await insertChunks({
      caseId,
      sourceType: "attachment",
      sourceId: attachment.id,
      text: attachment.extracted_text,
    });
  }

  for (const source of detail.web_sources) {
    chunksInserted += await insertChunks({
      caseId,
      sourceType: "web",
      sourceId: source.id,
      text: source.extracted_text,
    });
  }

  return { chunksInserted };
}

export function extractPocTitles(markdown: string): string[] {
  const pocSectionMatch = markdown.match(/## 3\. POC Design \(top 1-2 only\)([\s\S]*?)(?=\n## 4\.)/i);
  const section = pocSectionMatch?.[1] ?? "";

  const headingTitles = Array.from(section.matchAll(/###\s+(.+)/g)).map((match) =>
    match[1].trim(),
  );

  if (headingTitles.length > 0) {
    return [...new Set(headingTitles)].slice(0, 2);
  }

  const boldTitles = Array.from(section.matchAll(/\*\*(.+?)\*\*/g)).map((match) =>
    match[1].trim(),
  );

  return [...new Set(boldTitles)].slice(0, 2);
}

export function syncPocNodes(caseId: number, markdown: string): Array<{ id: number; label: string }> {
  const db = getDb();
  const titles = extractPocTitles(markdown);

  const existing = db
    .prepare("SELECT id, label, metadata_json FROM graph_nodes WHERE case_id = ? AND type = 'POC'")
    .all(caseId) as Array<{ id: number; label: string; metadata_json: string }>;

  const existingMap = new Map<string, { id: number; validated: boolean }>();
  for (const row of existing) {
    const metadata = safeJsonParse<{ validated?: boolean }>(row.metadata_json, {});
    existingMap.set(row.label, { id: row.id, validated: Boolean(metadata.validated) });
  }

  const companyRow = db
    .prepare("SELECT id FROM graph_nodes WHERE case_id = ? AND type = 'Company' LIMIT 1")
    .get(caseId) as { id: number } | undefined;

  if (!companyRow) {
    throw new Error("Company node missing. Ingest graph before syncing POC nodes.");
  }

  const titleSet = new Set(titles);
  const tx = db.transaction(() => {
    db.prepare(
      `
      DELETE FROM graph_edges
      WHERE case_id = ?
        AND relation = 'VALIDATES'
      `,
    ).run(caseId);

    for (const row of existing) {
      if (!titleSet.has(row.label)) {
        db.prepare("DELETE FROM graph_nodes WHERE id = ?").run(row.id);
      }
    }
  });
  tx();

  const output: Array<{ id: number; label: string }> = [];

  for (const title of titles) {
    const previous = existingMap.get(title);
    const pocNodeId = upsertNode("POC", title, caseId, {
      validated: previous?.validated ?? false,
      updated_at: new Date().toISOString(),
    });

    upsertEdge(companyRow.id, pocNodeId, "VALIDATES", caseId);
    output.push({ id: pocNodeId, label: title });
  }

  return output;
}

export function setPocValidated(caseId: number, nodeId: number, validated: boolean): void {
  const db = getDb();
  const row = db
    .prepare("SELECT metadata_json FROM graph_nodes WHERE id = ? AND case_id = ? AND type = 'POC' LIMIT 1")
    .get(nodeId, caseId) as { metadata_json: string } | undefined;

  if (!row) {
    throw new Error("POC node not found.");
  }

  const metadata = safeJsonParse<Record<string, unknown>>(row.metadata_json, {});
  metadata.validated = validated;
  metadata.updated_at = new Date().toISOString();

  db.prepare("UPDATE graph_nodes SET metadata_json = ? WHERE id = ?").run(
    JSON.stringify(metadata),
    nodeId,
  );
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export async function graphRagSearch(query: string): Promise<{
  answer: string;
  relatedCases: Array<{
    case_id: number;
    company_name: string;
    score: number;
    pains: string[];
    pocs: Array<{ label: string; validated: boolean }>;
  }>;
  topMatches: SearchMatch[];
}> {
  const q = query.trim();
  if (!q) {
    return {
      answer: "Please enter a search query.",
      relatedCases: [],
      topMatches: [],
    };
  }

  const queryEmbedding = await embedText(q);
  const db = getDb();

  const chunks = db
    .prepare(
      `
      SELECT id, case_id, source_type, source_id, text, embedding_json
      FROM text_chunks
      `,
    )
    .all() as Array<{
    id: number;
    case_id: number;
    source_type: string;
    source_id: number | null;
    text: string;
    embedding_json: string;
  }>;

  const matches: SearchMatch[] = chunks
    .map((chunk) => {
      const embedding = safeJsonParse<number[]>(chunk.embedding_json, []);
      return {
        chunk_id: chunk.id,
        case_id: chunk.case_id,
        text: chunk.text,
        source_type: chunk.source_type,
        source_id: chunk.source_id,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (matches.length === 0) {
    return {
      answer: "No relevant context found yet. Add more cases or regenerate embeddings.",
      relatedCases: [],
      topMatches: [],
    };
  }

  const tokens = tokenizeQuery(q);
  const caseScores = new Map<number, number>();

  for (const match of matches) {
    const previous = caseScores.get(match.case_id) ?? 0;
    caseScores.set(match.case_id, Math.max(previous, match.score));
  }

  const summaries = Array.from(caseScores.entries()).map(([caseId, baseScore]) => {
    const company = db
      .prepare("SELECT company_name FROM cases WHERE id = ? LIMIT 1")
      .get(caseId) as { company_name: string } | undefined;

    const pains = db
      .prepare("SELECT label FROM graph_nodes WHERE case_id = ? AND type = 'PainPoint' ORDER BY id ASC")
      .all(caseId) as Array<{ label: string }>;

    const tools = db
      .prepare("SELECT label FROM graph_nodes WHERE case_id = ? AND type = 'Tool' ORDER BY id ASC")
      .all(caseId) as Array<{ label: string }>;

    const pocs = db
      .prepare(
        "SELECT label, metadata_json FROM graph_nodes WHERE case_id = ? AND type = 'POC' ORDER BY id ASC",
      )
      .all(caseId) as Array<{ label: string; metadata_json: string }>;

    const labels = [...pains.map((item) => item.label), ...tools.map((item) => item.label)];
    const keywordBoost = tokens.reduce((sum, token) => {
      return labels.some((label) => label.toLowerCase().includes(token)) ? sum + 0.02 : sum;
    }, 0);

    return {
      case_id: caseId,
      company_name: company?.company_name ?? `Case ${caseId}`,
      score: Math.min(1, baseScore + keywordBoost),
      pains: pains.map((item) => item.label),
      tools: tools.map((item) => item.label),
      pocs: pocs.map((item) => {
        const metadata = safeJsonParse<{ validated?: boolean }>(item.metadata_json, {});
        return {
          label: item.label,
          validated: Boolean(metadata.validated),
        };
      }),
    };
  });

  const relatedCases = summaries.sort((a, b) => b.score - a.score).slice(0, 5);

  const contextPack = [
    "Top matching chunks:",
    ...matches.map(
      (item, idx) =>
        `${idx + 1}. [case_${item.case_id}|chunk_${item.chunk_id}|score_${item.score.toFixed(3)}] ${item.text}`,
    ),
    "",
    "Related graph summaries:",
    ...relatedCases.map((entry) => {
      return [
        `- case_${entry.case_id} (${entry.company_name}) score=${entry.score.toFixed(3)}`,
        `  pains: ${entry.pains.join("; ") || "none"}`,
        `  tools: ${entry.tools.join("; ") || "none"}`,
        `  pocs: ${entry.pocs.map((poc) => `${poc.label} [validated=${poc.validated}]`).join("; ") || "none"}`,
      ].join("\n");
    }),
  ].join("\n");

  const answer = await chatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You answer cross-case retrieval queries for SME POC design. Be concise and structured. Do not invent data outside provided context.",
      },
      {
        role: "user",
        content: [
          `Query: ${q}`,
          "",
          contextPack,
          "",
          "Return markdown with sections:",
          "## Similar Pains",
          "## Proposed POCs Seen",
          "## Pattern Insights",
          "## Practical Next Moves",
        ].join("\n"),
      },
    ],
    temperature: 0.2,
  });

  return {
    answer,
    relatedCases: relatedCases.map((entry) => ({
      case_id: entry.case_id,
      company_name: entry.company_name,
      score: entry.score,
      pains: entry.pains,
      pocs: entry.pocs,
    })),
    topMatches: matches,
  };
}

export function listCasePocNodes(caseId: number): Array<{
  id: number;
  label: string;
  validated: boolean;
}> {
  const detail = getCaseDetail(caseId);
  if (!detail) {
    return [];
  }

  return detail.graph_pocs.map((node) => {
    const metadata = safeJsonParse<{ validated?: boolean }>(node.metadata_json, {});
    return {
      id: node.id,
      label: node.label,
      validated: Boolean(metadata.validated),
    };
  });
}

export function graphCoverageSummary(): {
  cases: number;
  chunks: number;
} {
  const db = getDb();
  const caseCount = listCases().length;
  const row = db.prepare("SELECT COUNT(*) as count FROM text_chunks").get() as { count: number };

  return {
    cases: caseCount,
    chunks: row.count,
  };
}
