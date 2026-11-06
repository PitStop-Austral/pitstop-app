export const DRAG_START_THRESHOLD_PX = 6;
export const DISMISS_DISTANCE_RATIO = 0.25;
export const DISMISS_VELOCITY = 0.5;
export const NON_DISMISSIBLE_RESISTANCE = 0.3;

const VELOCITY_SAMPLE_WINDOW_MS = 100;

type VelocitySample = {
  y: number;
  t: number;
};

type ShouldDismissSheetInput = {
  offset: number;
  sheetHeight: number;
  velocity: number;
  dismissible: boolean;
};

type SheetContentTouchActionInput = {
  canScroll: boolean;
  isAtTop: boolean;
  isDesktop: boolean;
  supportsDirectionalPan: boolean;
};

export function dragOffset(deltaY: number, dismissible: boolean): number {
  const downwardOffset = Math.max(0, deltaY);
  return dismissible ? downwardOffset : downwardOffset * NON_DISMISSIBLE_RESISTANCE;
}

export function shouldDismissSheet({
  offset,
  sheetHeight,
  velocity,
  dismissible,
}: ShouldDismissSheetInput): boolean {
  if (!dismissible) return false;

  return offset > sheetHeight * DISMISS_DISTANCE_RATIO || velocity > DISMISS_VELOCITY;
}

export function sheetContentTouchAction({
  canScroll,
  isAtTop,
  isDesktop,
  supportsDirectionalPan,
}: SheetContentTouchActionInput): string {
  if (isDesktop) return '';
  if (!canScroll) return 'none';
  if (!isAtTop) return 'pan-y';
  return supportsDirectionalPan ? 'pan-down' : 'none';
}

export function releaseVelocity(samples: VelocitySample[]): number {
  if (samples.length < 2) return 0;

  const lastSample = samples.at(-1);
  if (!lastSample) return 0;

  const cutoff = lastSample.t - VELOCITY_SAMPLE_WINDOW_MS;
  const recentSamples = samples.filter((sample) => sample.t >= cutoff);
  if (recentSamples.length < 2) return 0;

  const firstSample = recentSamples[0];
  const elapsed = lastSample.t - firstSample.t;
  if (elapsed <= 0) return 0;

  return (lastSample.y - firstSample.y) / elapsed;
}
