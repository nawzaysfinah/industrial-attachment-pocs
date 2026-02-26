"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CaseInputSchema, type CaseInput } from "@/lib/types";

const TOTAL_STEPS = 7;

const INDUSTRIES = [
  "Manufacturing",
  "Retail",
  "Logistics",
  "F&B",
  "Construction",
  "Healthcare",
  "Education",
  "Services",
  "Other",
] as const;

const TOOL_CHOICES = [
  "Excel",
  "Google Sheets",
  "Xero",
  "WhatsApp",
  "Shopify",
  "Custom CRM",
  "Email",
  "Slack",
  "POS system",
] as const;

const DATA_TYPES = [
  "invoices",
  "chat logs",
  "photos",
  "pdfs",
  "spreadsheets",
  "forms",
  "SOP docs",
] as const;

const EMPTY_PAIN = {
  title: "",
  detail: "",
  frequency: "",
  affected_roles: "",
  workaround: "",
  priority_rank: 1,
};

const INITIAL_STATE: CaseInput = {
  company_name: "",
  industry_type: "Manufacturing",
  industry_other: "",
  company_size: "11-50",
  ai_maturity: "AI-curious",
  what_they_do: "",
  revenue_model: "Project-based",
  revenue_model_other: "",
  tools_used: [],
  data_types: [],
  data_access_level: "moderate",
  data_sensitivity: "medium",
  pain_points: [{ ...EMPTY_PAIN }],
  top_3_priorities: [],
  observations: "",
  meeting_notes: "",
  attachments: [],
  web_research: {
    budget: "low",
    sources: [],
  },
  tone: "critical",
};

export function NewCaseWizard(): React.JSX.Element {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CaseInput>(INITIAL_STATE);
  const [customTool, setCustomTool] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState("");
  const [caseId, setCaseId] = useState<number | null>(null);

  const canGoNext = useMemo(() => {
    if (step === 1) {
      return Boolean(form.company_name.trim()) && Boolean(form.industry_type.trim());
    }

    if (step === 2) {
      return Boolean(form.what_they_do.trim());
    }

    if (step === 4) {
      return form.pain_points.length > 0 && form.pain_points.every((point) => point.title && point.detail);
    }

    return true;
  }, [form, step]);

  function setField<K extends keyof CaseInput>(key: K, value: CaseInput[K]): void {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function updatePainPoint(index: number, patch: Partial<CaseInput["pain_points"][number]>): void {
    setForm((previous) => ({
      ...previous,
      pain_points: previous.pain_points.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function movePain(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= form.pain_points.length) {
      return;
    }

    const clone = [...form.pain_points];
    const current = clone[index];
    clone[index] = clone[target];
    clone[target] = current;

    setForm((previous) => ({
      ...previous,
      pain_points: clone,
      top_3_priorities: [],
    }));
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setUploadingFiles(true);
    setError(null);

    try {
      const uploaded: CaseInput["attachments"] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/uploads/extract", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as {
          filename?: string;
          filetype?: string;
          stored_path?: string;
          extracted_text?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? `Upload failed for ${file.name}`);
        }

        uploaded.push({
          filename: payload.filename || file.name,
          filetype: payload.filetype || file.type || "text/plain",
          stored_path: payload.stored_path || "",
          extracted_text: payload.extracted_text || "",
        });
      }

      setForm((previous) => ({
        ...previous,
        attachments: [...previous.attachments, ...uploaded],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "File upload failed");
    } finally {
      setUploadingFiles(false);
    }
  }

  async function fetchResearch(): Promise<void> {
    const urls = urlInput
      .split(/\n|,/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (urls.length === 0) {
      setError("Paste at least one URL before fetching research.");
      return;
    }

    setLoadingResearch(true);
    setError(null);

    try {
      const response = await fetch("/api/research/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls,
          budget: form.web_research.budget,
        }),
      });

      const payload = (await response.json()) as {
        sources?: CaseInput["web_research"]["sources"];
        error?: string;
      };

      if (!response.ok || !payload.sources) {
        throw new Error(payload.error ?? "Failed to fetch research.");
      }

      setForm((previous) => ({
        ...previous,
        web_research: {
          ...previous.web_research,
          sources: payload.sources || [],
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research fetch failed");
    } finally {
      setLoadingResearch(false);
    }
  }

  async function generateReport(): Promise<void> {
    setGenerating(true);
    setError(null);
    setReport("");
    setProgress("Validating case payload...");

    try {
      const payload = CaseInputSchema.parse(form);
      setProgress("Saving case and indexing GraphRAG artifacts...");

      const response = await fetch("/api/cases/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const caseHeader = response.headers.get("x-case-id");
      if (caseHeader) {
        setCaseId(Number(caseHeader));
      }

      if (!response.ok || !response.body) {
        const maybeError = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(maybeError.error ?? "Report generation failed");
      }

      setProgress("Generating consultant report with Ollama stream...");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let generated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        generated += chunk;
        setReport(generated);
      }

      setProgress("Completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setProgress("Failed");
    } finally {
      setGenerating(false);
    }
  }

  function toggleTool(tool: string): void {
    setForm((previous) => {
      const has = previous.tools_used.includes(tool);
      return {
        ...previous,
        tools_used: has
          ? previous.tools_used.filter((item) => item !== tool)
          : [...previous.tools_used, tool],
      };
    });
  }

  function toggleDataType(dataType: string): void {
    setForm((previous) => {
      const has = previous.data_types.includes(dataType);
      return {
        ...previous,
        data_types: has
          ? previous.data_types.filter((item) => item !== dataType)
          : [...previous.data_types, dataType],
      };
    });
  }

  return (
    <div className="space-y-5">
      <header className="ops-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Industrial Attachment POCs Wizard</h1>
          <span className="status-pill">
            Step {step} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-teal-600 transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </header>

      <section className="ops-card p-5 fade-in">
        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 1: Basic Company Identity</h2>
            <label className="block space-y-1">
              <span>Company name *</span>
              <input
                value={form.company_name}
                onChange={(event) => setField("company_name", event.target.value)}
              />
            </label>

            <label className="block space-y-1">
              <span>Industry type</span>
              <select
                value={form.industry_type}
                onChange={(event) => setField("industry_type", event.target.value)}
              >
                {INDUSTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            {form.industry_type === "Other" ? (
              <label className="block space-y-1">
                <span>Other industry</span>
                <input
                  value={form.industry_other}
                  onChange={(event) => setField("industry_other", event.target.value)}
                />
              </label>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span>Company size</span>
                <select
                  value={form.company_size}
                  onChange={(event) => setField("company_size", event.target.value as CaseInput["company_size"])}
                >
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </label>

              <label className="space-y-1">
                <span>AI maturity</span>
                <select
                  value={form.ai_maturity}
                  onChange={(event) => setField("ai_maturity", event.target.value as CaseInput["ai_maturity"])}
                >
                  <option value="AI-curious">AI-curious</option>
                  <option value="Non-AI">Non-AI</option>
                  <option value="Unsure">Unsure</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 2: Company Description</h2>
            <label className="block space-y-1">
              <span>What they do *</span>
              <textarea
                rows={7}
                value={form.what_they_do}
                onChange={(event) => setField("what_they_do", event.target.value)}
                placeholder="Guidance: core products/services, customer profile, key workflows, bottlenecks"
              />
            </label>

            <label className="block space-y-1">
              <span>Revenue model</span>
              <select
                value={form.revenue_model}
                onChange={(event) => setField("revenue_model", event.target.value as CaseInput["revenue_model"])}
              >
                <option>Project-based</option>
                <option>Subscription</option>
                <option>Retail/Transactions</option>
                <option>Service contracts</option>
                <option>Mixed</option>
                <option>Other</option>
              </select>
            </label>

            {form.revenue_model === "Other" ? (
              <label className="block space-y-1">
                <span>Other revenue model</span>
                <input
                  value={form.revenue_model_other}
                  onChange={(event) => setField("revenue_model_other", event.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 3: Tools + Data Reality</h2>

            <div>
              <p className="mb-2 text-sm text-slate-600">Select tools used</p>
              <div className="grid gap-2 md:grid-cols-3">
                {TOOL_CHOICES.map((tool) => {
                  const active = form.tools_used.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className={`rounded-md border px-3 py-2 text-left ${
                        active
                          ? "border-teal-600 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={customTool}
                onChange={(event) => setCustomTool(event.target.value)}
                placeholder="Add custom tool"
                className="flex-1"
              />
              <button
                type="button"
                className="ops-btn-secondary"
                onClick={() => {
                  if (!customTool.trim()) {
                    return;
                  }
                  if (!form.tools_used.includes(customTool.trim())) {
                    setField("tools_used", [...form.tools_used, customTool.trim()]);
                  }
                  setCustomTool("");
                }}
              >
                Add
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm text-slate-600">Data types available</p>
              <div className="grid gap-2 md:grid-cols-3">
                {DATA_TYPES.map((type) => {
                  const active = form.data_types.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleDataType(type)}
                      className={`rounded-md border px-3 py-2 text-left ${
                        active
                          ? "border-teal-600 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span>Data access level</span>
                <select
                  value={form.data_access_level}
                  onChange={(event) =>
                    setField("data_access_level", event.target.value as CaseInput["data_access_level"])
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="moderate">Moderate</option>
                  <option value="hard">Hard</option>
                </select>
              </label>

              <label className="space-y-1">
                <span>Data sensitivity</span>
                <select
                  value={form.data_sensitivity}
                  onChange={(event) =>
                    setField("data_sensitivity", event.target.value as CaseInput["data_sensitivity"])
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 4: Pain Points</h2>
            {form.pain_points.map((point, index) => (
              <article key={`pain-${index}`} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <strong>Pain #{index + 1}</strong>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="ops-btn-secondary"
                      onClick={() => movePain(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="ops-btn-secondary"
                      onClick={() => movePain(index, 1)}
                      disabled={index === form.pain_points.length - 1}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="ops-btn-secondary"
                      onClick={() => {
                        if (form.pain_points.length === 1) {
                          return;
                        }
                        setForm((previous) => ({
                          ...previous,
                          pain_points: previous.pain_points.filter((_, i) => i !== index),
                          top_3_priorities: previous.top_3_priorities.filter((i) => i !== index),
                        }));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  <input
                    placeholder="Title"
                    value={point.title}
                    onChange={(event) => updatePainPoint(index, { title: event.target.value })}
                  />
                  <textarea
                    rows={3}
                    placeholder="Detail"
                    value={point.detail}
                    onChange={(event) => updatePainPoint(index, { detail: event.target.value })}
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      placeholder="Frequency"
                      value={point.frequency}
                      onChange={(event) => updatePainPoint(index, { frequency: event.target.value })}
                    />
                    <input
                      placeholder="Who suffers"
                      value={point.affected_roles}
                      onChange={(event) =>
                        updatePainPoint(index, { affected_roles: event.target.value })
                      }
                    />
                    <input
                      placeholder="Current workaround"
                      value={point.workaround}
                      onChange={(event) => updatePainPoint(index, { workaround: event.target.value })}
                    />
                  </div>
                </div>
              </article>
            ))}

            <button
              type="button"
              className="ops-btn-secondary"
              onClick={() =>
                setForm((previous) => ({
                  ...previous,
                  pain_points: [...previous.pain_points, { ...EMPTY_PAIN }],
                }))
              }
            >
              + Add pain point
            </button>

            <div className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold">Top 3 Priorities</h3>
              <p className="mb-3 text-sm text-slate-600">Tick up to 3 pain points as priorities.</p>
              <div className="space-y-2">
                {form.pain_points.map((point, index) => {
                  const active = form.top_3_priorities.includes(index);
                  return (
                    <label key={`priority-${index}`} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(event) => {
                          setForm((previous) => {
                            if (event.target.checked) {
                              const next = [...previous.top_3_priorities, index].slice(0, 3);
                              return { ...previous, top_3_priorities: next };
                            }

                            return {
                              ...previous,
                              top_3_priorities: previous.top_3_priorities.filter((id) => id !== index),
                            };
                          });
                        }}
                      />
                      <span>{point.title || `Pain #${index + 1}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 5: Observations & Ethnographic Notes</h2>

            <label className="block space-y-1">
              <span>Observations</span>
              <textarea
                rows={5}
                value={form.observations}
                onChange={(event) => setField("observations", event.target.value)}
                placeholder="What you saw on-site: bottlenecks, repetitive tasks, workarounds"
              />
            </label>

            <label className="block space-y-1">
              <span>Meeting notes (optional)</span>
              <textarea
                rows={5}
                value={form.meeting_notes}
                onChange={(event) => setField("meeting_notes", event.target.value)}
                placeholder="Paste meeting notes"
              />
            </label>

            <div>
              <p className="mb-2">Upload ethnographic notes (PDF, DOCX, TXT/MD)</p>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                multiple
                onChange={handleFileUpload}
              />
              <p className="mt-2 text-xs text-slate-600">
                {uploadingFiles ? "Extracting text..." : `${form.attachments.length} file(s) extracted`}
              </p>
            </div>

            {form.attachments.length > 0 ? (
              <div className="space-y-3">
                {form.attachments.map((item, index) => (
                  <article key={`${item.filename}-${index}`} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <strong>{item.filename}</strong>
                      <button
                        type="button"
                        className="ops-btn-secondary"
                        onClick={() =>
                          setForm((previous) => ({
                            ...previous,
                            attachments: previous.attachments.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <p className="line-clamp-4 text-sm text-slate-700">{item.extracted_text}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 6: Optional Web Research</h2>

            <label className="block space-y-1">
              <span>Research budget</span>
              <select
                value={form.web_research.budget}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    web_research: {
                      ...previous.web_research,
                      budget: event.target.value as "low" | "medium",
                    },
                  }))
                }
              >
                <option value="low">Low (lighter extraction)</option>
                <option value="medium">Medium (deeper but summarized)</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span>URL list (1-5)</span>
              <textarea
                rows={5}
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="Paste one URL per line"
              />
            </label>

            <button type="button" className="ops-btn" onClick={fetchResearch} disabled={loadingResearch}>
              {loadingResearch ? "Fetching..." : "Fetch + Extract"}
            </button>

            {form.web_research.sources.length > 0 ? (
              <div className="space-y-3">
                {form.web_research.sources.map((source) => (
                  <article key={source.url} className="rounded-md border border-slate-200 p-3">
                    <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-teal-700">
                      {source.title}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">{source.url}</p>
                    <p className="mt-2 line-clamp-4 text-sm">{source.extracted_text}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 7 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 7: Generate Report</h2>

            <label className="block space-y-1">
              <span>Tone</span>
              <select
                value={form.tone}
                onChange={(event) => setField("tone", event.target.value as CaseInput["tone"])}
              >
                <option value="critical">More critical (default)</option>
                <option value="standard">Standard</option>
              </select>
            </label>

            <button type="button" className="ops-btn" onClick={generateReport} disabled={generating}>
              {generating ? "Generating..." : "Generate"}
            </button>

            <p className="text-sm text-slate-600">Progress: {progress}</p>

            {report ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="ops-btn-secondary"
                    onClick={() => navigator.clipboard.writeText(report)}
                  >
                    Copy markdown
                  </button>
                  {caseId ? (
                    <a href={`/api/cases/${caseId}/export`} className="ops-btn-secondary">
                      Export .md
                    </a>
                  ) : null}
                  {caseId ? (
                    <Link href={`/cases/${caseId}`} className="ops-btn-secondary">
                      Open case detail
                    </Link>
                  ) : null}
                </div>

                <article className="ops-card p-4">
                  <pre className="report-markdown text-sm">{report}</pre>
                </article>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={() => setStep((previous) => Math.max(1, previous - 1))}
            disabled={step === 1 || generating}
          >
            Back
          </button>

          <button
            type="button"
            className="ops-btn"
            onClick={() => setStep((previous) => Math.min(TOTAL_STEPS, previous + 1))}
            disabled={step === TOTAL_STEPS || !canGoNext || generating}
          >
            Next
          </button>
        </div>

        <Link href="/" className="ops-btn-secondary">
          Return to Dashboard
        </Link>
      </footer>
    </div>
  );
}
