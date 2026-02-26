import fs from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

export function loadPrompt(fileName: string): string {
  if (cache.has(fileName)) {
    return cache.get(fileName)!;
  }

  const promptPath = path.join(process.cwd(), "prompts", fileName);
  const content = fs.readFileSync(promptPath, "utf8");
  cache.set(fileName, content);
  return content;
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{{${key}}}`, value);
  }, template);
}
