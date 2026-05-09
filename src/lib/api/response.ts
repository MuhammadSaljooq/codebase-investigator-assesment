import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const API_VERSION = "v1";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INGEST_FAILED"
  | "ANSWER_FAILED"
  | "INTERNAL_ERROR";

export function newRequestId() {
  return crypto.randomUUID();
}

export function apiOk<T>(requestId: string, data: T, status = 200) {
  return NextResponse.json(
    {
      apiVersion: API_VERSION,
      requestId,
      data
    },
    { status }
  );
}

export function apiError(requestId: string, code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json(
    {
      apiVersion: API_VERSION,
      requestId,
      error: {
        code,
        message
      }
    },
    { status }
  );
}
