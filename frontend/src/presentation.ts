export type PresentationOverlay = "controls" | "history" | "results" | null;

export function togglePresentationOverlay(
  current: PresentationOverlay,
  requested: Exclude<PresentationOverlay, null>,
): PresentationOverlay {
  return current === requested ? null : requested;
}

export function dismissPresentationOverlay(): null {
  return null;
}
