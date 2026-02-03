import { createHash } from "node:crypto";

import { parseHTML } from "linkedom";

import type { MonitorMode } from "./constants";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000; // ~1.5 MB safeguard

const HTML_CONTENT_TYPE = /text\/html|application\/xhtml\+xml/i;

export type BaselineCheckErrorCode =
  | "FETCH_FAILED"
  | "INVALID_STATUS"
  | "UNSUPPORTED_CONTENT"
  | "HTML_TOO_LARGE"
  | "SELECTOR_REQUIRED"
  | "SELECTOR_NOT_FOUND";

export class BaselineCheckError extends Error {
  code: BaselineCheckErrorCode;

  constructor(message: string, code: BaselineCheckErrorCode) {
    super(message);
    this.name = "BaselineCheckError";
    this.code = code;
  }
}

export interface BaselineCheckInput {
  url: string;
  mode: MonitorMode;
  selector?: string | null;
}

export interface BaselineCheckResult {
  normalizedText: string;
  contentHash: string;
  httpStatus: number;
  finalUrl: string;
  htmlBytes: number;
  textBytes: number;
  fetchedAt: string;
}

const USER_AGENT = "MeerkatMonitor/0.1 (+https://meerkat.dev)";

export async function runBaselineCheck(input: BaselineCheckInput): Promise<BaselineCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(input.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
  } catch {
    throw new BaselineCheckError(
      "Unable to reach the URL. Please ensure it is publicly accessible.",
      "FETCH_FAILED"
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status < 200 || response.status >= 400) {
    throw new BaselineCheckError(
      `The page responded with status ${response.status}. Provide a reachable URL.`,
      "INVALID_STATUS"
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!HTML_CONTENT_TYPE.test(contentType)) {
    throw new BaselineCheckError(
      "The URL must return HTML content (text/html).",
      "UNSUPPORTED_CONTENT"
    );
  }

  const rawHtml = await response.text();
  const htmlBytes = Buffer.byteLength(rawHtml, "utf8");
  if (htmlBytes > MAX_HTML_BYTES) {
    throw new BaselineCheckError(
      "HTML response is too large (over 1.5MB).",
      "HTML_TOO_LARGE"
    );
  }

  const normalizedText = normalizeHtml(rawHtml, input.mode, input.selector);
  const textBytes = Buffer.byteLength(normalizedText, "utf8");
  const contentHash = createHash("sha256").update(normalizedText).digest("hex");
  const fetchedAt = new Date().toISOString();

  return {
    normalizedText,
    contentHash,
    httpStatus: response.status,
    finalUrl: response.url,
    htmlBytes,
    textBytes,
    fetchedAt,
  };
}

function normalizeHtml(html: string, mode: MonitorMode, selector?: string | null) {
  const { document } = parseHTML(html);
  let target: Element | null = document.body;

  if (mode === "section") {
    if (!selector || selector.trim().length === 0) {
      throw new BaselineCheckError("A CSS selector is required for section monitors.", "SELECTOR_REQUIRED");
    }
    target = document.querySelector(selector);
    if (!target) {
      throw new BaselineCheckError(
        "The provided CSS selector was not found on the page.",
        "SELECTOR_NOT_FOUND"
      );
    }
  }

  if (!target) {
    target = document.documentElement;
  }

  target.querySelectorAll("script, style, noscript, template").forEach((node) => node.remove());

  const textContent = target.textContent ?? "";
  return collapseWhitespace(textContent);
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
