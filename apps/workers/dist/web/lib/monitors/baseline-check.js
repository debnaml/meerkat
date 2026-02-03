import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 1_500_000; // ~1.5 MB safeguard
const HTML_CONTENT_TYPE = /text\/html|application\/xhtml\+xml/i;
export class BaselineCheckError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = "BaselineCheckError";
        this.code = code;
    }
}
const USER_AGENT = "MeerkatMonitor/0.1 (+https://meerkat.dev)";
export async function runBaselineCheck(input) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
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
    }
    catch {
        throw new BaselineCheckError("Unable to reach the URL. Please ensure it is publicly accessible.", "FETCH_FAILED");
    }
    finally {
        clearTimeout(timeout);
    }
    if (response.status < 200 || response.status >= 400) {
        throw new BaselineCheckError(`The page responded with status ${response.status}. Provide a reachable URL.`, "INVALID_STATUS");
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!HTML_CONTENT_TYPE.test(contentType)) {
        throw new BaselineCheckError("The URL must return HTML content (text/html).", "UNSUPPORTED_CONTENT");
    }
    const rawHtml = await response.text();
    const htmlBytes = Buffer.byteLength(rawHtml, "utf8");
    if (htmlBytes > MAX_HTML_BYTES) {
        throw new BaselineCheckError("HTML response is too large (over 1.5MB).", "HTML_TOO_LARGE");
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
function normalizeHtml(html, mode, selector) {
    const { document } = parseHTML(html);
    let target = document.body;
    if (mode === "section") {
        if (!selector || selector.trim().length === 0) {
            throw new BaselineCheckError("A CSS selector is required for section monitors.", "SELECTOR_REQUIRED");
        }
        target = document.querySelector(selector);
        if (!target) {
            throw new BaselineCheckError("The provided CSS selector was not found on the page.", "SELECTOR_NOT_FOUND");
        }
    }
    if (!target) {
        target = document.documentElement;
    }
    target.querySelectorAll("script, style, noscript, template").forEach((node) => node.remove());
    const textContent = target.textContent ?? "";
    return collapseWhitespace(textContent);
}
function collapseWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
