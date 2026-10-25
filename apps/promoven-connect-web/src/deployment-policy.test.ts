import { describe, expect, it } from "vitest";
import { validateLocalEnvironment, validateRemoteEnvironment } from "./deployment-policy";

describe("remote deployment isolation", () => {
  it("tolerates platform metadata without treating it as app configuration", () => {
    expect(validateRemoteEnvironment({ VERCEL_ENV: "preview", VITE_CONNECT_ENV: "preview", VITE_VERCEL_URL: "platform-metadata.example" })).toBe("preview");
  });
  it.each(["preview", "production"])("accepts unavailable %s without a backend", target => {
    expect(validateRemoteEnvironment({ VERCEL_ENV: target, VITE_CONNECT_ENV: target })).toBe(target);
  });
  it.each([undefined, "local", "development"])("rejects an unapproved deployment target %s", target => {
    expect(() => validateRemoteEnvironment({ VERCEL_ENV: target, VITE_CONNECT_ENV: target })).toThrow();
  });
  it("rejects cross-environment configuration", () => {
    expect(() => validateRemoteEnvironment({ VERCEL_ENV: "production", VITE_CONNECT_ENV: "preview" })).toThrow();
  });
  it.each([
    ["VITE_CONNECT_SUPABASE_URL", "http://127.0.0.1:56321"],
    ["VITE_CONNECT_SUPABASE_URL", "https://unapproved.example"],
    ["VITE_CONNECT_FUNCTIONS_URL", "http://127.0.0.1:56410"],
    ["VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY", "public-but-unapproved"],
    ["VITE_SERVICE_ROLE", "secret-canary-never-log"],
    ["VITE_OTHER_APP_URL", "https://unrelated.example"],
  ])("rejects %s without leaking its value", (key, value) => {
    try {
      validateRemoteEnvironment({ VERCEL_ENV: "preview", VITE_CONNECT_ENV: "preview", [key]: value });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("não aceita");
      expect(String(error)).not.toContain(value);
    }
  });
});

describe("local backend boundary", () => {
  it("preserves loopback local access", () => {
    expect(() => validateLocalEnvironment({ VITE_CONNECT_ENV: "local" }, "127.0.0.1")).not.toThrow();
  });
  it.each(["preview", "production", undefined])("rejects backend activation in %s", target => {
    expect(() => validateLocalEnvironment({ VITE_CONNECT_ENV: target }, "127.0.0.1")).toThrow();
  });
  it("rejects a local bundle accidentally published remotely", () => {
    expect(() => validateLocalEnvironment({ VITE_CONNECT_ENV: "local" }, "connect.example")).toThrow();
  });
});
