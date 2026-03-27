import { maskQaseToken } from "../lib/qaseTokenMask";

describe("maskQaseToken", () => {
  it("returns null when token is empty", () => {
    expect(maskQaseToken("")).toBeNull();
    expect(maskQaseToken(null)).toBeNull();
  });

  it("keeps only the last 4 characters visible", () => {
    expect(maskQaseToken("abcdefghijkl")).toBe("********ijkl");
  });
});
