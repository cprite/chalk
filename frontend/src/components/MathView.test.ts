import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MathView } from "./MathView";

describe("formatMathText & MathView", () => {
  it("formats subscripts and primes for 1D collision formula", () => {
    const raw = "1D Linear Momentum: m_A·v_A + m_B·v_B = m_A·v_A' + m_B·v_B'";
    const html = renderToString(MathView({ text: raw }));
    
    expect(html).toContain("1D Linear Momentum: ");
    expect(html).toContain("<sub");
    expect(html).toContain(">A</sub>");
    expect(html).toContain(">B</sub>");
    expect(html).toContain("′");
  });

  it("formats subscripts for values readout line without breaking English text", () => {
    const raw = "m_A = 3 kg (v_A = 3 m/s) · m_B = 1 kg (v_B = 1 m/s) · Resulting: v_A' = 2.00 m/s, v_B' = 4.00 m/s (e = 1)";
    const html = renderToString(MathView({ text: raw }));
    expect(html).toContain(">A</sub>");
    expect(html).toContain(">B</sub>");
    expect(html).toContain("Resulting: ");
    expect(html).toContain("3 kg");
  });

  it("formats powers like m/s² and x^2 and Unicode", () => {
    const raw = "Mass: 1 kg · a = 3.50 m/s² · r² · θ₀²";
    const html = renderToString(MathView({ text: raw }));
    expect(html).toContain("<sup");
    expect(html).toContain(">2</sup>");
    expect(html).toContain(">0</sub>");
  });

  it("formats spring equations", () => {
    const raw = "Live 120Hz Verlet Integrator: m·ÿ + k_eff·y = 0 (3 springs in parallel)";
    const html = renderToString(MathView({ text: raw }));
    expect(html).toContain("Verlet Integrator: ");
    expect(html).toContain(">eff</sub>");
    expect(html).toContain("3 springs in parallel");
  });
});
