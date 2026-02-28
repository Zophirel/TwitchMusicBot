import { describe, expect, it } from "vitest";
import { parseSongsPlay } from "../src/parse.js";

describe("parseSongsPlay", () => {
  it("ignores other messages", () => {
    expect(parseSongsPlay("hello world")).toEqual({ type: "ignore" });
  });

  it("rejects empty query", () => {
    expect(parseSongsPlay("!songsplay").type).toBe("invalid");
  });

  it("accepts valid query", () => {
    const result = parseSongsPlay("!songsplay Never Gonna Give You Up");
    expect(result).toEqual({ type: "ok", query: "Never Gonna Give You Up" });
  });

  it("trims and respects max length", () => {
    const query = "a".repeat(81);
    const result = parseSongsPlay(`!songsplay ${query}`);
    expect(result.type).toBe("invalid");
  });
});
