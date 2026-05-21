import { TextDecoder, TextEncoder } from "util";

import fetch, { Request, Response } from "node-fetch";
import { beforeAll } from "vitest";

// Simple in-memory localStorage stub for Node test environment
function makeLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

beforeAll(() => {
  // @ts-ignore
  globalThis.fetch = fetch;
  // @ts-ignore
  globalThis.Request = Request;
  // @ts-ignore
  globalThis.Response = Response;
  globalThis.TextEncoder = TextEncoder;
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder;
  if (typeof globalThis.localStorage === "undefined") {
    // @ts-ignore
    globalThis.localStorage = makeLocalStorage();
  }
});
