export function jsonError(message: string, status = 400, details?: unknown): Response {
  return Response.json(
    {
      error: message,
      details,
    },
    { status },
  );
}
