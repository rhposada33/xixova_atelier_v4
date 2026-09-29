import { describe, expect, it } from "vitest";
import { isStagingEnvironment } from "./appEnvironment";

describe("ambiente da aplicação", () => {
  it("exibe homologação somente no ambiente staging", () => {
    expect(isStagingEnvironment("staging")).toBe(true);
    expect(isStagingEnvironment("production")).toBe(false);
  });
});
