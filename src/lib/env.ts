import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OLLAMA_HOST: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen3:latest"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text:latest"),
  DATABASE_PATH: z.string().optional(),
  FILE_STORAGE_DIR: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  DATABASE_PATH:
    parsed.data.DATABASE_PATH ?? `${process.cwd()}/data/industrial_attachment_pocs.db`,
  FILE_STORAGE_DIR: parsed.data.FILE_STORAGE_DIR ?? `${process.cwd()}/data/uploads`,
};
