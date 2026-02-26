import Link from "next/link";
import { notFound } from "next/navigation";

import { getCaseDetail } from "@/lib/cases";
import { safeJsonParse } from "@/lib/utils";

import { CaseDetailClient } from "@/components/case-detail-client";

export const runtime = "nodejs";

export default async function CaseDetailPage(
  props: {
    params: Promise<{ id: string }>;
  },
): Promise<React.JSX.Element> {
  const params = await props.params;
  const caseId = Number(params.id);

  if (Number.isNaN(caseId)) {
    notFound();
  }

  const detail = getCaseDetail(caseId);
  if (!detail) {
    notFound();
  }

  const description = safeJsonParse<Record<string, unknown>>(detail.description_json, {});
  const latestReport = detail.reports[0]?.markdown || "";

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <header className="ops-card p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{detail.company_name}</h1>
          <Link href="/" className="ops-btn-secondary">
            Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-4">
          <p>
            <strong>Industry:</strong> {detail.industry_type}
          </p>
          <p>
            <strong>Company size:</strong> {detail.company_size}
          </p>
          <p>
            <strong>AI maturity:</strong> {detail.ai_maturity}
          </p>
          <p>
            <strong>Updated:</strong> {new Date(detail.updated_at).toLocaleString()}
          </p>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <article className="ops-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Captured Inputs</h2>
          <div className="space-y-3 text-sm">
            <p>
              <strong>What they do:</strong> {String(description.what_they_do || "-")}
            </p>
            <p>
              <strong>Revenue model:</strong> {String(description.revenue_model || "-")}
            </p>
            <p>
              <strong>Tools:</strong> {Array.isArray(description.tools_used) ? description.tools_used.join(", ") : "-"}
            </p>
            <p>
              <strong>Data types:</strong> {Array.isArray(description.data_types) ? description.data_types.join(", ") : "-"}
            </p>
            <p>
              <strong>Data access:</strong> {String(description.data_access_level || "-")}
            </p>
            <p>
              <strong>Data sensitivity:</strong> {String(description.data_sensitivity || "-")}
            </p>
            <p>
              <strong>Observations:</strong> {String(description.observations || "-")}
            </p>
          </div>

          <h3 className="mt-5 mb-2 font-semibold">Pain points</h3>
          <div className="space-y-2">
            {detail.pain_points.map((pain) => (
              <div key={pain.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="font-semibold">{pain.title}</p>
                <p className="text-slate-600">{pain.detail}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Frequency: {pain.frequency} | Roles: {pain.affected_roles}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="ops-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Attachments & Sources</h2>

          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Attachments</h3>
          <div className="space-y-2">
            {detail.attachments.length === 0 ? (
              <p className="text-sm text-slate-600">No attachments.</p>
            ) : (
              detail.attachments.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">[{`attachment_${item.id}`}] {item.filename}</p>
                  <p className="mt-1 line-clamp-3 text-slate-600">{item.extracted_text}</p>
                </div>
              ))
            )}
          </div>

          <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Web sources</h3>
          <div className="space-y-2">
            {detail.web_sources.length === 0 ? (
              <p className="text-sm text-slate-600">No web sources.</p>
            ) : (
              detail.web_sources.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-teal-700">
                    [{`source_${item.id}`}] {item.title}
                  </a>
                  <p className="mt-1 line-clamp-3 text-slate-600">{item.extracted_text}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <CaseDetailClient
        caseId={detail.id}
        initialMarkdown={latestReport}
        pocs={detail.graph_pocs.map((node) => {
          const metadata = safeJsonParse<{ validated?: boolean }>(node.metadata_json, {});
          return {
            id: node.id,
            label: node.label,
            validated: Boolean(metadata.validated),
          };
        })}
      />
    </main>
  );
}
