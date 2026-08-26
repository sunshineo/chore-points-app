import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

function safeErrorCode(error: unknown): string | undefined {
  try {
    if (!error || typeof error !== "object") return undefined;
    const code = Reflect.get(error, "code");
    return typeof code === "string" && /^[A-Z0-9_-]{1,32}$/.test(code)
      ? code
      : undefined;
  } catch {
    return undefined;
  }
}

function trustedErrorName(error: unknown): "Error" | "UnknownError" {
  try {
    return error instanceof Error ? "Error" : "UnknownError";
  } catch {
    return "UnknownError";
  }
}

export function internalServerError(scope: string, error: unknown): NextResponse {
  const requestId = randomUUID();
  console.error(JSON.stringify({
    level: "error",
    scope,
    requestId,
    errorName: trustedErrorName(error),
    errorCode: safeErrorCode(error),
  }));
  return NextResponse.json(
    { error: "服务器暂时无法处理请求", requestId },
    { status: 500 },
  );
}
