import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Z0-9_-]{1,32}$/.test(code)
    ? code
    : undefined;
}

export function internalServerError(scope: string, error: unknown): NextResponse {
  const requestId = randomUUID();
  console.error(JSON.stringify({
    level: "error",
    scope,
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: safeErrorCode(error),
  }));
  return NextResponse.json(
    { error: "服务器暂时无法处理请求", requestId },
    { status: 500 },
  );
}
