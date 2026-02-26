"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PocNode = {
  id: number;
  label: string;
  validated: boolean;
};

type CaseDetailClientProps = {
  caseId: number;
  initialMarkdown: string;
  pocs: PocNode[];
};

export function CaseDetailClient({
  caseId,
  initialMarkdown,
  pocs,
}: CaseDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [tone, setTone] = useState<"standard" | "critical">("critical");
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [streaming, setStreaming] = useState(false);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");

  const hasReport = useMemo(() => Boolean(markdown), [markdown]);

  async function regenerateReport(): Promise<void> {
    setError(null);
    setStatus("Regenerating report with stream...");
    setStreaming(true);
    setMarkdown("");

    try {
      const response = await fetch(`/api/cases/${caseId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tone }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to regenerate report");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setMarkdown(full);
      }

      setStatus("Completed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate report");
      setStatus("Failed");
    } finally {
      setStreaming(false);
    }
  }

  async function regeneratePitch(): Promise<void> {
    setError(null);
    setStatus("Regenerating pitch message...");
    setPitchLoading(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/pitch`, {
        method: "POST",
      });

      const payload = (await response.json()) as {
        markdown?: string;
        error?: string;
      };

      if (!response.ok || !payload.markdown) {
        throw new Error(payload.error ?? "Failed to regenerate pitch");
      }

      setMarkdown(payload.markdown);
      setStatus("Pitch updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate pitch");
      setStatus("Failed");
    } finally {
      setPitchLoading(false);
    }
  }

  async function toggleValidated(nodeId: number, validated: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/cases/${caseId}/poc/${nodeId}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ validated }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to update validation state");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation update failed");
    }
  }

  return (
    <section className="space-y-4">
      <div className="ops-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Generated Report</h2>
          <span className="status-pill">{status}</span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={tone}
            onChange={(event) => setTone(event.target.value as "standard" | "critical")}
          >
            <option value="critical">More critical</option>
            <option value="standard">Standard</option>
          </select>
          <button className="ops-btn" onClick={regenerateReport} disabled={streaming}>
            {streaming ? "Regenerating..." : "Regenerate entire report"}
          </button>
          <button className="ops-btn-secondary" onClick={regeneratePitch} disabled={pitchLoading || !hasReport}>
            {pitchLoading ? "Regenerating..." : "Regenerate pitch message"}
          </button>
          <button
            className="ops-btn-secondary"
            onClick={() => navigator.clipboard.writeText(markdown)}
            disabled={!hasReport}
          >
            Copy markdown
          </button>
          <a href={`/api/cases/${caseId}/export`} className="ops-btn-secondary">
            Export .md
          </a>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <article className="ops-card mt-3 p-4">
          <pre className="report-markdown text-sm">{markdown || "No report generated yet."}</pre>
        </article>
      </div>

      <div className="ops-card p-4">
        <h3 className="mb-3 text-base font-semibold">POC Validation Toggle</h3>
        <div className="space-y-2">
          {pocs.length === 0 ? (
            <p className="text-sm text-slate-600">No POC nodes parsed yet. Generate a report first.</p>
          ) : (
            pocs.map((poc) => (
              <div key={poc.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div>
                  <p className="font-semibold">{poc.label}</p>
                  <p className="text-xs text-slate-600">Relation: Company - VALIDATES - POC</p>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={poc.validated}
                    onChange={(event) => toggleValidated(poc.id, event.target.checked)}
                  />
                  <span>{poc.validated ? "Validated" : "Not validated"}</span>
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
