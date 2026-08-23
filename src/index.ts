/**
 * scrapiq-node — dependency-free TypeScript client for the Scrapiq API.
 *
 * Turns any URL into clean markdown or structured JSON for LLM/RAG pipelines.
 * Uses only the global `fetch` (Node 18+), zero runtime dependencies.
 */

export type ExtractFormat = "json" | "text" | "markdown";

export interface ExtractOptions {
  /** Output format. "json" = structured extraction, "text" = plain text, "markdown" = clean markdown. Default: "json". */
  format?: ExtractFormat;
  /** Optional JSON schema describing fields to extract (format="json" only). */
  schema?: Record<string, unknown>;
  /** Include page metadata (title, description, author, date) in the response. Default: true. */
  includeMetadata?: boolean;
  /** AbortSignal for request cancellation. */
  signal?: AbortSignal;
}

export interface PageMetadata {
  title?: string | null;
  description?: string | null;
  author?: string | null;
  published_date?: string | null;
  language?: string | null;
  canonical_url?: string | null;
  word_count?: number | null;
}

export interface ExtractResponse {
  url: string;
  format: ExtractFormat;
  /** Structured data extracted according to the schema (format="json"). */
  data?: Record<string, unknown> | null;
  /** Cleaned text or markdown content (format="text" | "markdown"). */
  content?: string | null;
  metadata?: PageMetadata | null;
  cached: boolean;
  extraction_time_ms: number;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  cache_size: number;
}

export class ScrapiqError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
  ) {
    super(message);
    this.name = "ScrapiqError";
  }
}

export interface ScrapiqClientOptions {
  /** Base URL of the Scrapiq API. Default: https://scrapiq.io */
  baseUrl?: string;
  /** Optional API key (for future authenticated hosted plans). Sent as Bearer token if set. */
  apiKey?: string;
  /** Default request timeout in ms. Default: 30000. */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://scrapiq.io";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Minimal Scrapiq client.
 *
 * ```ts
 * import { Scrapiq } from "scrapiq-node";
 *
 * const client = new Scrapiq();
 * const page = await client.extract("https://example.com", { format: "markdown" });
 * console.log(page.content);
 * ```
 */
export class Scrapiq {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: ScrapiqClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Extract clean content or structured data from a URL. */
  async extract(url: string, options: ExtractOptions = {}): Promise<ExtractResponse> {
    const payload: Record<string, unknown> = {
      url,
      format: options.format ?? "json",
      include_metadata: options.includeMetadata ?? true,
    };
    if (options.schema !== undefined) {
      payload.schema = options.schema;
    }
    return this.request<ExtractResponse>("/v1/extract", {
      method: "POST",
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  }

  /** Convenience: fetch a URL as clean markdown. */
  async markdown(url: string, options: Omit<ExtractOptions, "format"> = {}): Promise<ExtractResponse> {
    return this.extract(url, { ...options, format: "markdown" });
  }

  /** Convenience: fetch a URL as clean plain text. */
  async text(url: string, options: Omit<ExtractOptions, "format"> = {}): Promise<ExtractResponse> {
    return this.extract(url, { ...options, format: "text" });
  }

  /** Health check. */
  async health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health", { signal });
  }

  private async request<T>(path: string, init: RequestInit & { signal?: AbortSignal }): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = init.signal ?? controller.signal;
    if (init.signal) {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "scrapiq-node/0.1.0",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
        signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const reason = err instanceof Error ? err.message : String(err);
      throw new ScrapiqError(`Request failed: ${reason}`);
    }
    clearTimeout(timeout);

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      let detail: unknown = undefined;
      if (body && typeof body === "object" && "detail" in body) {
        detail = (body as { detail: unknown }).detail;
      }
      const message =
        detail === undefined || detail === null
          ? `HTTP ${res.status}`
          : typeof detail === "string"
            ? detail
            : JSON.stringify(detail);
      throw new ScrapiqError(message, res.status, path);
    }
    return body as T;
  }
}

export default Scrapiq;
