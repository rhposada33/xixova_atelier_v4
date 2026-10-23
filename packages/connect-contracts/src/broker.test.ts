import { describe, expect, it } from "vitest";
import { parseBrokerProfile } from "./broker";

const valid = { displayName: "Corretora Exemplo", professionalEmail: "Broker@Test.Local", professionalPhone: "11999990000", creciNumber: "12345-sp", creciState: "sp" };
describe("broker profile", () => {
  it("normalizes verified identity fields for server review", () => {
    expect(parseBrokerProfile(valid)).toMatchObject({ professionalEmail: "broker@test.local", creciNumber: "12345-SP", creciState: "SP" });
  });
  it("rejects privilege fields", () => { expect(() => parseBrokerProfile({ ...valid, verificationStatus: "verified" })).toThrow(); });
  it("rejects malformed registration", () => { expect(() => parseBrokerProfile({ ...valid, creciNumber: "?" })).toThrow(); });
});
