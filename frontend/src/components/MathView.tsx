import React from "react";

/**
 * Parses mathematical text into formatted React nodes with:
 * - Subscripts: m_A, v_B, k_eff, F_net, v₀, q₁ -> m<sub>A</sub>, v<sub>B</sub>, etc.
 * - Superscripts / Powers: x^2, m/s², r², v₀² -> x<sup>2</sup>, m/s<sup>2</sup>, etc.
 * - Primes: v_A', v_B', v' -> v′<sub>A</sub>, v′
 * - Units & Symbols: m/s², N/m, etc.
 */
export function formatMathText(text: string): React.ReactNode {
  if (!text) return null;

  const normalized = text.replace(/m\/s\^2/g, "m/s²");

  // Regex tokens:
  // 1: Unit m/s²
  // 2, 3, 4: Variable with subscript & optional prime: ([A-Za-z]|θ|μ|π|ÿ)_([A-Za-z0-9]+)(['′])?
  // 5, 6: Variable with prime: ([A-Za-z]|θ|μ|π|ÿ)(['′])
  // 7, 8: Power with caret: ([A-Za-z0-9\)\]]|θ|μ|π)\^([A-Za-z0-9]+)
  // 9, 10: Unicode power: ([A-Za-z0-9\)\]]|θ|μ|π)([²³⁴⁵⁶⁷⁸⁹])
  // 11, 12: Unicode subscript: ([A-Za-z]|θ|μ|π)([₀₁₂₃₄₅₆₇₈₉])
  const regex = /(m\/s²)|(?:([A-Za-z]|θ|μ|π|ÿ)_([A-Za-z0-9]+)(['′])?)|(?:([A-Za-z]|θ|μ|π|ÿ)(['′]))|(?:([A-Za-z0-9\)\]]|θ|μ|π)\^([A-Za-z0-9]+))|(?:([A-Za-z0-9\)\]]|θ|μ|π)([²³⁴⁵⁶⁷⁸⁹]))|(?:([A-Za-z]|θ|μ|π)([₀₁₂₃₄₅₆₇₈₉]))/g;

  const tokens: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const supMap: Record<string, string> = {
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
  };

  const subMap: Record<string, string> = {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9",
  };

  while ((match = regex.exec(normalized)) !== null) {
    const matchStart = match.index;
    if (matchStart > lastIndex) {
      tokens.push(normalized.substring(lastIndex, matchStart));
    }
    lastIndex = regex.lastIndex;

    const [
      ,
      unitMs2,
      varWithSub,
      subVal,
      primeOnSub,
      varWithPrime,
      ,
      caretBase,
      caretSup,
      uniBase,
      uniSup,
      uniSubBase,
      uniSub,
    ] = match;

    if (unitMs2) {
      tokens.push(
        <span key={`ms2-${matchStart}`} style={{ whiteSpace: "nowrap" }}>
          m/s<sup style={{ fontSize: "0.76em", verticalAlign: "super" }}>2</sup>
        </span>
      );
    } else if (varWithSub) {
      tokens.push(
        <span key={`vsub-${matchStart}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          <i style={{ fontStyle: "italic", fontFamily: '"Times New Roman", Times, serif' }}>
            {varWithSub}
          </i>
          {primeOnSub && <span style={{ fontStyle: "normal" }}>′</span>}
          <sub
            style={{
              fontSize: "0.74em",
              verticalAlign: "sub",
              fontStyle: "normal",
              marginLeft: "1px",
            }}
          >
            {subVal}
          </sub>
        </span>
      );
    } else if (varWithPrime) {
      tokens.push(
        <span key={`vprime-${matchStart}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          <i style={{ fontStyle: "italic", fontFamily: '"Times New Roman", Times, serif' }}>
            {varWithPrime}
          </i>
          <span style={{ fontStyle: "normal" }}>′</span>
        </span>
      );
    } else if (caretBase) {
      tokens.push(
        <span key={`caret-${matchStart}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {caretBase}
          <sup style={{ fontSize: "0.76em", verticalAlign: "super" }}>{caretSup}</sup>
        </span>
      );
    } else if (uniBase) {
      tokens.push(
        <span key={`uni-${matchStart}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {uniBase}
          <sup style={{ fontSize: "0.76em", verticalAlign: "super" }}>
            {supMap[uniSup] || uniSup}
          </sup>
        </span>
      );
    } else if (uniSubBase) {
      tokens.push(
        <span key={`unisub-${matchStart}`} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          <i style={{ fontStyle: "italic", fontFamily: '"Times New Roman", Times, serif' }}>
            {uniSubBase}
          </i>
          <sub
            style={{
              fontSize: "0.74em",
              verticalAlign: "sub",
              fontStyle: "normal",
              marginLeft: "1px",
            }}
          >
            {subMap[uniSub] || uniSub}
          </sub>
        </span>
      );
    }
  }

  if (lastIndex < normalized.length) {
    tokens.push(normalized.substring(lastIndex));
  }

  return <>{tokens}</>;
}

export function MathView({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={style}>
      {formatMathText(text)}
    </span>
  );
}
