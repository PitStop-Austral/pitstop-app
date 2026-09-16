import { createContext, useContext, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * A native `<dialog open>` is promoted to the browser's top layer, which renders above
 * any portaled content appended to `document.body` (e.g. Select/DropdownMenu popups) —
 * making it invisible and unclickable. Portal-based popups rendered inside a `Dialog` or
 * `BottomSheet` must target this container instead of the default `document.body` to
 * inherit the dialog's top-layer stacking.
 */
const DialogContainerContext = createContext<RefObject<HTMLDialogElement | null> | undefined>(
  undefined,
);

export const DialogContainerProvider = DialogContainerContext.Provider;

export function useDialogContainer() {
  return useContext(DialogContainerContext);
}

// Module-level so nested dialogs (e.g. a confirm sheet opened from another modal) don't
// unlock the background while an outer one is still open.
let scrollLockCount = 0;
let savedScrollTop = 0;

function lockBackgroundScroll() {
  if (scrollLockCount === 0) {
    const container = document.getElementById('app-scroll');
    if (container) {
      savedScrollTop = container.scrollTop;
      container.style.overflow = 'hidden';
    }
    // A modal `<dialog>` is `position: fixed` in the top layer, so its scroll chain skips
    // `#app-scroll` entirely and ends at the root — which iOS makes scrollable once the keyboard
    // opens. `touch-action` intersection stops at the first scrolling ancestor, so this blocks
    // drags on the backdrop and the sheet's own chrome without touching its inner scroller.
    document.body.style.touchAction = 'none';
  }
  scrollLockCount++;
}

function unlockBackgroundScroll() {
  scrollLockCount--;
  if (scrollLockCount === 0) {
    const container = document.getElementById('app-scroll');
    if (container) {
      container.style.overflow = '';
      container.scrollTop = savedScrollTop;
    }
    document.body.style.touchAction = '';
  }
}

/**
 * Drives a native `<dialog>` from an `open` boolean and locks the app shell's scroll container
 * while it's open — `showModal()` alone doesn't stop the content behind it from being dragged
 * on iOS.
 */
export function useNativeDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    lockBackgroundScroll();
    return unlockBackgroundScroll;
  }, [open]);

  return ref;
}
