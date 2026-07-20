import { describe, it, expect } from "vitest";
import { parseJsonBody, BodyTooLargeError, MalformedBodyError } from "../lib/body-limit";

function fakeRequest(body: string, contentLength?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (contentLength !== undefined) headers.set("Content-Length", contentLength);
  return new Request("http://localhost/test", {
    method: "POST",
    headers,
    body,
  });
}

describe("parseJsonBody", () => {
  it("parses valid JSON within limit", async () => {
    const data = { name: "Alice", age: 30 };
    const req = fakeRequest(JSON.stringify(data));
    const result = await parseJsonBody<typeof data>(req, 1024);
    expect(result).toEqual(data);
  });

  it("rejects body exceeding byte limit", async () => {
    const bigBody = JSON.stringify({ data: "x".repeat(200) });
    const req = fakeRequest(bigBody);
    await expect(parseJsonBody(req, 50)).rejects.toThrow(BodyTooLargeError);
  });

  it("fast-rejects via Content-Length header", async () => {
    const req = fakeRequest("{}", "999999");
    await expect(parseJsonBody(req, 1024)).rejects.toThrow(BodyTooLargeError);
  });

  it("rejects malformed JSON", async () => {
    const req = fakeRequest("not json {{{");
    await expect(parseJsonBody(req, 1024)).rejects.toThrow(MalformedBodyError);
  });

  it("rejects empty body as malformed JSON", async () => {
    const req = fakeRequest("");
    await expect(parseJsonBody(req, 1024)).rejects.toThrow(MalformedBodyError);
  });

  it("handles UTF-8 multi-byte characters correctly", async () => {
    // "é" is 2 bytes in UTF-8, body = {"x":"ééé"} = ~16 bytes
    const body = JSON.stringify({ x: "ééé" });
    const byteLen = new TextEncoder().encode(body).byteLength;
    // Should fail if limit is less than byte length
    await expect(parseJsonBody(fakeRequest(body), byteLen - 1)).rejects.toThrow(BodyTooLargeError);
    // Should pass if limit equals byte length
    const result = await parseJsonBody(fakeRequest(body), byteLen);
    expect(result).toEqual({ x: "ééé" });
  });

  it("uses default 1MB limit when no maxBytes provided", async () => {
    const req = fakeRequest(JSON.stringify({ ok: true }));
    const result = await parseJsonBody(req);
    expect(result).toEqual({ ok: true });
  });
});
