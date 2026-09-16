import { createContext, useContext } from 'react';
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
