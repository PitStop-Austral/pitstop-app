import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import {
  DRAG_START_THRESHOLD_PX,
  dragOffset,
  releaseVelocity,
  sheetContentTouchAction,
  shouldDismissSheet,
} from '@/components/sheet-drag';

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';
const RELEASE_TRANSITION = 'transform 200ms var(--ease-pitstop)';
const RELEASE_FALLBACK_MS = 220;

type UseSheetDragInput = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  dismissible: boolean;
  onDismiss: () => void;
};

type DragGesture = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  offset: number;
  samples: Array<{ y: number; t: number }>;
  source: 'handle' | 'content';
  mode: 'pending' | 'dragging' | 'scrolling';
};

export function useSheetDrag({
  dialogRef,
  contentRef,
  dismissible,
  onDismiss,
}: UseSheetDragInput): void {
  const dismissibleRef = useRef(dismissible);
  const onDismissRef = useRef(onDismiss);
  dismissibleRef.current = dismissible;
  onDismissRef.current = onDismiss;

  // Content can become scrollable after async data or validation changes render. Keep the browser's
  // gesture policy in sync without rebuilding the pointer listeners on every component render.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    content.style.touchAction = sheetContentTouchAction({
      canScroll: content.scrollHeight > content.clientHeight,
      isAtTop: content.scrollTop <= 0,
      isDesktop: window.matchMedia(DESKTOP_MEDIA_QUERY).matches,
      supportsDirectionalPan: window.CSS?.supports('touch-action', 'pan-down') ?? false,
    });
  });

  useEffect(() => {
    const dialogElement = dialogRef.current;
    const contentElement = contentRef.current;
    if (!dialogElement || !contentElement) return;

    const dialog: HTMLDialogElement = dialogElement;
    const content: HTMLDivElement = contentElement;

    const desktopQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const supportsDirectionalPan = window.CSS?.supports('touch-action', 'pan-down') ?? false;
    let gesture: DragGesture | null = null;
    let isSettling = false;
    let listenersRegistered = false;
    let releaseFallback: number | undefined;
    let suppressClick = false;
    let suppressClickReset: number | undefined;
    let transitionEndHandler: ((event: TransitionEvent) => void) | undefined;

    function clearReleaseWait(): void {
      if (releaseFallback !== undefined) {
        window.clearTimeout(releaseFallback);
        releaseFallback = undefined;
      }
      if (transitionEndHandler) {
        dialog.removeEventListener('transitionend', transitionEndHandler);
        transitionEndHandler = undefined;
      }
    }

    function clearClickSuppression(): void {
      suppressClick = false;
      if (suppressClickReset !== undefined) {
        window.clearTimeout(suppressClickReset);
        suppressClickReset = undefined;
      }
    }

    function releasePointerCapture(): void {
      if (!gesture || !dialog.hasPointerCapture(gesture.pointerId)) return;
      dialog.releasePointerCapture(gesture.pointerId);
    }

    function resetDialogStyles(): void {
      dialog.style.removeProperty('transform');
      dialog.style.removeProperty('transition');
      dialog.style.removeProperty('will-change');
    }

    function resetInteraction(): void {
      releasePointerCapture();
      gesture = null;
      isSettling = false;
      clearReleaseWait();
      resetDialogStyles();
    }

    function waitForReleaseTransition(onComplete: () => void): void {
      let completed = false;
      const completeOnce = (): void => {
        if (completed) return;
        completed = true;
        clearReleaseWait();
        onComplete();
      };

      transitionEndHandler = (event) => {
        if (event.target === dialog && event.propertyName === 'transform') completeOnce();
      };
      dialog.addEventListener('transitionend', transitionEndHandler);
      releaseFallback = window.setTimeout(completeOnce, RELEASE_FALLBACK_MS);
    }

    function settle(dismiss: boolean): void {
      isSettling = true;
      const reducedMotion = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
      dialog.style.transition = reducedMotion ? 'none' : RELEASE_TRANSITION;
      dialog.style.transform = dismiss ? 'translateY(100%)' : 'translateY(0)';

      const complete = (): void => {
        isSettling = false;
        if (dismiss) {
          onDismissRef.current();
          return;
        }
        resetDialogStyles();
      };

      if (reducedMotion) {
        complete();
        return;
      }
      waitForReleaseTransition(complete);
    }

    function getGestureSource(target: EventTarget | null): DragGesture['source'] | null {
      if (!(target instanceof Element)) return null;
      if (target.closest('[data-sheet-drag-handle]')) return 'handle';
      if (content.contains(target) && content.scrollTop <= 0) return 'content';
      return null;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (
        desktopQuery.matches ||
        !dialog.open ||
        isSettling ||
        gesture ||
        !event.isPrimary ||
        event.button !== 0
      ) {
        return;
      }

      const source = getGestureSource(event.target);
      if (!source) return;

      gesture = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: content.scrollTop,
        offset: 0,
        samples: [{ y: event.clientY, t: event.timeStamp }],
        source,
        mode: 'pending',
      };
    }

    function handlePointerMove(event: PointerEvent): void {
      if (!gesture || event.pointerId !== gesture.pointerId) return;

      const deltaY = event.clientY - gesture.startY;
      if (gesture.mode === 'pending') {
        if (gesture.source === 'content' && deltaY < -DRAG_START_THRESHOLD_PX) {
          if (supportsDirectionalPan) {
            gesture = null;
            return;
          }

          gesture.mode = 'scrolling';
          dialog.setPointerCapture(event.pointerId);
        } else if (deltaY > DRAG_START_THRESHOLD_PX) {
          gesture.mode = 'dragging';
          dialog.setPointerCapture(event.pointerId);
          dialog.style.transition = 'none';
          dialog.style.willChange = 'transform';
        } else {
          return;
        }
      }

      if (gesture.mode === 'scrolling') {
        event.preventDefault();
        content.scrollTop = gesture.startScrollTop - deltaY;
        return;
      }

      event.preventDefault();
      gesture.offset = dragOffset(deltaY, dismissibleRef.current);
      gesture.samples.push({ y: event.clientY, t: event.timeStamp });
      const sampleCutoff = event.timeStamp - 100;
      gesture.samples = gesture.samples.filter((sample) => sample.t >= sampleCutoff);
      dialog.style.transform = `translateY(${gesture.offset}px)`;
    }

    function handlePointerRelease(event: PointerEvent): void {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (gesture.mode === 'pending') {
        gesture = null;
        return;
      }

      event.preventDefault();
      suppressClick = true;
      suppressClickReset = window.setTimeout(clearClickSuppression, 0);

      if (gesture.mode === 'scrolling') {
        releasePointerCapture();
        gesture = null;
        return;
      }

      gesture.samples.push({ y: event.clientY, t: event.timeStamp });
      const dismiss = shouldDismissSheet({
        offset: gesture.offset,
        sheetHeight: dialog.getBoundingClientRect().height,
        velocity: releaseVelocity(gesture.samples),
        dismissible: dismissibleRef.current,
      });

      releasePointerCapture();
      gesture = null;
      settle(dismiss);
    }

    function handleClick(event: MouseEvent): void {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearClickSuppression();
    }

    function handleDialogClose(): void {
      resetInteraction();
      clearClickSuppression();
    }

    function syncContentTouchAction(): void {
      content.style.touchAction = sheetContentTouchAction({
        canScroll: content.scrollHeight > content.clientHeight,
        isAtTop: content.scrollTop <= 0,
        isDesktop: desktopQuery.matches,
        supportsDirectionalPan,
      });
    }

    function registerListeners(): void {
      if (listenersRegistered) return;
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointermove', handlePointerMove);
      dialog.addEventListener('pointerup', handlePointerRelease);
      dialog.addEventListener('pointercancel', handlePointerRelease);
      dialog.addEventListener('click', handleClick, true);
      dialog.addEventListener('close', handleDialogClose);
      listenersRegistered = true;
    }

    function unregisterListeners(): void {
      if (!listenersRegistered) return;
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointermove', handlePointerMove);
      dialog.removeEventListener('pointerup', handlePointerRelease);
      dialog.removeEventListener('pointercancel', handlePointerRelease);
      dialog.removeEventListener('click', handleClick, true);
      dialog.removeEventListener('close', handleDialogClose);
      listenersRegistered = false;
    }

    function syncListeners(): void {
      syncContentTouchAction();
      if (desktopQuery.matches) {
        unregisterListeners();
        resetInteraction();
        clearClickSuppression();
        return;
      }
      registerListeners();
    }

    syncListeners();
    content.addEventListener('scroll', syncContentTouchAction);
    desktopQuery.addEventListener('change', syncListeners);

    return () => {
      desktopQuery.removeEventListener('change', syncListeners);
      content.removeEventListener('scroll', syncContentTouchAction);
      unregisterListeners();
      resetInteraction();
      clearClickSuppression();
      content.style.removeProperty('touch-action');
    };
  }, [contentRef, dialogRef]);
}
