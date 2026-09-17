# scrapiq-node

Dependency-free TypeScript client for [Scrapiq](https://github.com/NG-PR0JECT/scrapiq) — the open-source API that turns any URL into clean markdown or structured JSON for LLM/RAG pipelines.

Zero runtime dependencies (uses the global `fetch`, Node 18+). Ships ESM + TypeScript types.

## Install

Not on npm yet, so install from this repo:

```bash
npm install github:NG-PR0JECT/scrapiq-node
```

The build runs on install (`prepare` -> `tsc`), so `dist/` exists by the time your import resolves.

## Quick start

```ts
import { Scrapiq } from "scrapiq-node";

const client = new Scrapiq(); // defaults to https://scrapiq.io

// Clean markdown for RAG ingestion
const page = await client.markdown("https://en.wikipedia.org/wiki/Large_language_model");
console.log(page.content); // clean markdown, no nav/boilerplate

// Structured JSON against a schema
const product = await client.extract("https://example.com/products/1", {
  format: "json",
  schema: {
    title: { type: "string" },
    price: { type: "number" },
    description: { type: "string" },
  },
});
console.log(product.data);
```

## API

### `new Scrapiq(options?)`

| Option      | Default           | Description                                  |
| ----------- | ----------------- | -------------------------------------------- |
| `baseUrl`   | `https://scrapiq.io` | API base URL (use your self-hosted instance) |
| `apiKey`    | —                 | Reserved for future authenticated plans      |
| `timeoutMs` | `30000`           | Request timeout                              |

### `client.extract(url, options?)`

| Option            | Default | Description                                          |
| ----------------- | ------- | ---------------------------------------------------- |
| `format`          | `"json"` | `"json"` \| `"text"` \| `"markdown"`                |
| `schema`          | —       | JSON schema for structured extraction (`format="json"`) |
| `includeMetadata` | `true`  | Include page metadata (title, description, author…)  |
| `signal`          | —       | AbortSignal for cancellation                         |

Also: `client.text(url)` and `client.markdown(url)` convenience wrappers, and `client.health()`.

Errors are thrown as `ScrapiqError` with `status` and `message` from the API.

## Self-hosting

Point the client at your own instance:

```ts
const client = new Scrapiq({ baseUrl: "http://localhost:8001" });
```

```bash
docker run -d -p 8001:8001 ghcr.io/ng-pr0ject/scrapiq  # see main repo for the image
```

## License

MIT
