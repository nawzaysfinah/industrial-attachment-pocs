"use client";

import Link from "next/link";
import { useState } from "react";

type SearchResponse = {
  answer: string;
  relatedCases: Array<{
    case_id: number;
    company_name: string;
    score: number;
    pains: string[];
    pocs: Array<{ label: string; validated: boolean }>;
  }>;
};

export function DashboardSearch(): React.JSX.Element {
  const [query, setQuery] = useState(
    "Show me similar pains from other SMEs and what POCs we proposed",
  );
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(): Promise<void> {
    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const payload = (await response.json()) as SearchResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed");
      }

      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ops-card p-5 fade-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Cross-Case GraphRAG Search</h2>
        <span className="status-pill">query to vector to graph expansion</span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          className="w-full"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask: similar pains, proposed POCs, and what patterns repeat"
        />
        <button className="ops-btn md:w-44" onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <div className="mt-5 grid gap-4 md:grid-cols-[2fr_1fr]">
          <article className="ops-card bg-white/80 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
              Answer
            </h3>
            <pre className="report-markdown text-sm">{result.answer}</pre>
          </article>

          <aside className="ops-card bg-white/80 p-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
              Related Cases
            </h3>
            <div className="space-y-3">
              {result.relatedCases.map((item) => (
                <div key={item.case_id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/cases/${item.case_id}`}
                      className="font-semibold text-teal-700 hover:underline"
                    >
                      {item.company_name}
                    </Link>
                    <span className="font-mono text-xs text-slate-500">
                      {item.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {item.pains.slice(0, 2).join("; ") || "No pain labels"}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
