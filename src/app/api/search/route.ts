import { z } from "zod";

import { graphRagSearch } from "@/lib/graphrag";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const SearchSchema = z.object({
  query: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const payload = SearchSchema.parse(body);

    const result = await graphRagSearch(payload.query);
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid search payload", 400, error.flatten());
    }

    return jsonError("GraphRAG search failed", 500, String(error));
  }
}
