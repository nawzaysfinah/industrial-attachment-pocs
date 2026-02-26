import Link from "next/link";

import { listCases } from "@/lib/cases";
import { graphCoverageSummary } from "@/lib/graphrag";

import { DashboardSearch } from "@/components/dashboard-search";

export const runtime = "nodejs";

export default function DashboardPage(): React.JSX.Element {
  const cases = listCases();
  const coverage = graphCoverageSummary();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <section className="ops-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-teal-700">
              Industrial Attachment POCs
            </p>
            <h1 className="text-3xl font-semibold">Local-first SME POC Workbench</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ollama-powered report generation, source-cited research, and GraphRAG cross-case retrieval.
            </p>
          </div>
          <Link href="/cases/new" className="ops-btn">
            + New Case
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cases</p>
            <p className="text-2xl font-semibold">{coverage.cases}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Graph chunks</p>
            <p className="text-2xl font-semibold">{coverage.chunks}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">LLM runtime</p>
            <p className="text-sm font-mono">qwen3:latest (local Ollama)</p>
          </div>
        </div>
      </section>

      <DashboardSearch />

      <section className="ops-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Case Records</h2>
          <span className="status-pill">SQLite-backed</span>
        </div>

        {cases.length === 0 ? (
          <p className="text-sm text-slate-600">No cases yet. Start with your first company profile.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2">Company</th>
                  <th className="px-2 py-2">Industry</th>
                  <th className="px-2 py-2">Size</th>
                  <th className="px-2 py-2">AI maturity</th>
                  <th className="px-2 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium">
                      <Link href={`/cases/${item.id}`} className="text-teal-700 hover:underline">
                        {item.company_name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{item.industry_type}</td>
                    <td className="px-2 py-2">{item.company_size}</td>
                    <td className="px-2 py-2">{item.ai_maturity}</td>
                    <td className="px-2 py-2">{new Date(item.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
