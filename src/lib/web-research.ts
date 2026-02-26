import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

import { getDb } from "@/lib/db";
import { chatCompletion } from "@/lib/ollama";
import { loadPrompt } from "@/lib/prompts";
import { normalizeWhitespace } from "@/lib/utils";

export type ResearchBudget = "low" | "medium";

export type FetchedSource = {
  url: string;
  title: string;
  extracted_text: string;
  retrieved_at: string;
  cached: boolean;
};

function normalizeUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

function fromHtml(url: string, html: string): { title: string; text: string } {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  if (parsed?.textContent) {
    return {
      title: parsed.title?.trim() || dom.window.document.title || url,
      text: normalizeWhitespace(parsed.textContent),
    };
  }

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || url;
  const bodyText = normalizeWhitespace(
    $("main").text() || $("article").text() || $("body").text() || "",
  );

  return {
    title,
    text: bodyText,
  };
}

async function summariseIfNeeded(text: string, budget: ResearchBudget): Promise<string> {
  const lowCap = 12_000;
  if (budget === "low") {
    return text.slice(0, lowCap);
  }

  const mediumCap = 24_000;
  const candidate = text.slice(0, mediumCap);

  if (candidate.length < 8_000) {
    return candidate;
  }

  const prompt = loadPrompt("research_summarise.md");
  const summary = await chatCompletion({
    messages: [
      { role: "system", content: "You compress research text while preserving factual fidelity." },
      {
        role: "user",
        content: `${prompt}\n\nSource text:\n${candidate}`,
      },
    ],
    temperature: 0.1,
  });

  return summary;
}

async function fetchSource(url: string, budget: ResearchBudget): Promise<FetchedSource> {
  const db = getDb();
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    throw new Error("Empty URL detected");
  }

  const cached = db
    .prepare("SELECT url, title, extracted_text, retrieved_at FROM web_cache WHERE url = ? LIMIT 1")
    .get(normalizedUrl) as
    | { url: string; title: string; extracted_text: string; retrieved_at: string }
    | undefined;

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const response = await fetch(normalizedUrl, {
    headers: {
      "User-Agent": "IndustrialAttachmentPOCs/1.0 (+local research fetcher)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${normalizedUrl}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const parsed = fromHtml(normalizedUrl, html);

  const extracted = await summariseIfNeeded(parsed.text, budget);
  const retrievedAt = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO web_cache (url, title, extracted_text, retrieved_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      extracted_text = excluded.extracted_text,
      retrieved_at = excluded.retrieved_at
    `,
  ).run(normalizedUrl, parsed.title, extracted, retrievedAt);

  return {
    url: normalizedUrl,
    title: parsed.title,
    extracted_text: extracted,
    retrieved_at: retrievedAt,
    cached: false,
  };
}

export async function fetchResearchBatch(
  urls: string[],
  budget: ResearchBudget,
): Promise<FetchedSource[]> {
  const uniqueUrls = [...new Set(urls.map((url) => normalizeUrl(url)).filter(Boolean))].slice(0, 5);

  const output: FetchedSource[] = [];
  for (const url of uniqueUrls) {
    const item = await fetchSource(url, budget);
    output.push(item);
  }

  return output;
}
