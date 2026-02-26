import { z } from "zod";

export const CompanySizeSchema = z.enum(["1-10", "11-50", "51-200", "200+"]);
export const AiMaturitySchema = z.enum(["AI-curious", "Non-AI", "Unsure"]);
export const RevenueModelSchema = z.enum([
  "Project-based",
  "Subscription",
  "Retail/Transactions",
  "Service contracts",
  "Mixed",
  "Other",
]);
export const DataAccessSchema = z.enum(["easy", "moderate", "hard"]);
export const DataSensitivitySchema = z.enum(["low", "medium", "high"]);
export const ToneSchema = z.enum(["standard", "critical"]);
export const ResearchBudgetSchema = z.enum(["low", "medium"]);

export const PainPointSchema = z.object({
  title: z.string().min(1, "Pain point title is required"),
  detail: z.string().min(1, "Pain point detail is required"),
  frequency: z.string().min(1, "Frequency is required"),
  affected_roles: z.string().min(1, "Affected roles are required"),
  workaround: z.string().min(1, "Current workaround is required"),
  priority_rank: z.number().int().min(1).max(10).optional(),
});

export const AttachmentInputSchema = z.object({
  filename: z.string().min(1),
  filetype: z.string().min(1),
  stored_path: z.string().min(1),
  extracted_text: z.string().min(1),
});

export const WebSourceInputSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  extracted_text: z.string().min(1),
  retrieved_at: z.string().min(1),
});

export const CaseInputSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  industry_type: z.string().min(1, "Industry is required"),
  industry_other: z.string().default(""),
  company_size: CompanySizeSchema,
  ai_maturity: AiMaturitySchema,
  what_they_do: z.string().min(1, "Company description is required"),
  revenue_model: RevenueModelSchema,
  revenue_model_other: z.string().default(""),
  tools_used: z.array(z.string()).default([]),
  data_types: z.array(z.string()).default([]),
  data_access_level: DataAccessSchema,
  data_sensitivity: DataSensitivitySchema,
  pain_points: z.array(PainPointSchema).min(1, "At least one pain point is required"),
  top_3_priorities: z.array(z.number().int().min(0)).max(3).default([]),
  observations: z.string().default(""),
  meeting_notes: z.string().default(""),
  attachments: z.array(AttachmentInputSchema).default([]),
  web_research: z
    .object({
      budget: ResearchBudgetSchema.default("low"),
      sources: z.array(WebSourceInputSchema).default([]),
    })
    .default({ budget: "low", sources: [] }),
  tone: ToneSchema.default("critical"),
});

export type PainPointInput = z.infer<typeof PainPointSchema>;
export type AttachmentInput = z.infer<typeof AttachmentInputSchema>;
export type WebSourceInput = z.infer<typeof WebSourceInputSchema>;
export type CaseInput = z.infer<typeof CaseInputSchema>;

export type CaseSummary = {
  id: number;
  company_name: string;
  industry_type: string;
  company_size: string;
  ai_maturity: string;
  created_at: string;
  updated_at: string;
  latest_report_at: string | null;
};

export type CaseDetail = {
  id: number;
  company_name: string;
  industry_type: string;
  company_size: string;
  ai_maturity: string;
  description_json: string;
  created_at: string;
  updated_at: string;
  pain_points: Array<{
    id: number;
    title: string;
    detail: string;
    frequency: string;
    affected_roles: string;
    workaround: string;
    priority_rank: number | null;
  }>;
  attachments: Array<{
    id: number;
    filename: string;
    filetype: string;
    stored_path: string;
    extracted_text: string;
    created_at: string;
  }>;
  web_sources: Array<{
    id: number;
    url: string;
    title: string;
    extracted_text: string;
    retrieved_at: string;
  }>;
  reports: Array<{
    id: number;
    markdown: string;
    created_at: string;
    prompt_version: string;
    model_used: string;
  }>;
  graph_pocs: Array<{
    id: number;
    label: string;
    metadata_json: string;
  }>;
};
