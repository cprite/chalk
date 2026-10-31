import { describe, expect, it } from "vitest";
import { startsWithWord } from "./App";

describe("startsWithWord", () => {
  it("handles Russian and English", () => {
    expect(startsWithWord("Я думаю тяжёлый быстрее", "думаю|я думаю")).toBe(true);
    expect(startsWithWord("I think it is faster", "i think")).toBe(true);
    expect(startsWithWord("Запусти", "запусти")).toBe(true);
    expect(startsWithWord("Запустить ракету на Луну", "запусти")).toBe(false);
    expect(startsWithWord("running shoes", "run")).toBe(false);
  });
});
