import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dragOffset,
  NON_DISMISSIBLE_RESISTANCE,
  releaseVelocity,
  sheetContentTouchAction,
  shouldDismissSheet,
} from './sheet-drag.ts';

test('drag offset never moves the sheet upward', () => {
  assert.equal(dragOffset(-20, true), 0);
  assert.equal(dragOffset(0, true), 0);
  assert.equal(dragOffset(20, true), 20);
});

test('drag offset adds resistance when the sheet cannot be dismissed', () => {
  assert.equal(dragOffset(100, false), 100 * NON_DISMISSIBLE_RESISTANCE);
});

test('sheet dismisses after passing a quarter of its height', () => {
  assert.equal(
    shouldDismissSheet({
      offset: 260,
      sheetHeight: 1000,
      velocity: 0,
      dismissible: true,
    }),
    true,
  );
  assert.equal(
    shouldDismissSheet({
      offset: 240,
      sheetHeight: 1000,
      velocity: 0,
      dismissible: true,
    }),
    false,
  );
});

test('sheet dismisses after a fast downward swipe', () => {
  assert.equal(
    shouldDismissSheet({
      offset: 100,
      sheetHeight: 1000,
      velocity: 0.6,
      dismissible: true,
    }),
    true,
  );
});

test('sheet never dismisses when dismissal is disabled', () => {
  assert.equal(
    shouldDismissSheet({
      offset: 1000,
      sheetHeight: 1000,
      velocity: 2,
      dismissible: false,
    }),
    false,
  );
});

test('content touch action keeps native scroll after leaving the top', () => {
  assert.equal(
    sheetContentTouchAction({
      canScroll: true,
      isAtTop: false,
      isDesktop: false,
      supportsDirectionalPan: false,
    }),
    'pan-y',
  );
});

test('content touch action reserves downward drags at the top', () => {
  assert.equal(
    sheetContentTouchAction({
      canScroll: true,
      isAtTop: true,
      isDesktop: false,
      supportsDirectionalPan: true,
    }),
    'pan-down',
  );
  assert.equal(
    sheetContentTouchAction({
      canScroll: true,
      isAtTop: true,
      isDesktop: false,
      supportsDirectionalPan: false,
    }),
    'none',
  );
});

test('content touch action disables panning when unnecessary and leaves desktop unchanged', () => {
  assert.equal(
    sheetContentTouchAction({
      canScroll: false,
      isAtTop: true,
      isDesktop: false,
      supportsDirectionalPan: true,
    }),
    'none',
  );
  assert.equal(
    sheetContentTouchAction({
      canScroll: true,
      isAtTop: true,
      isDesktop: true,
      supportsDirectionalPan: true,
    }),
    '',
  );
});

test('release velocity uses only samples from the last 100 milliseconds', () => {
  assert.equal(
    releaseVelocity([
      { y: 0, t: 0 },
      { y: 20, t: 100 },
      { y: 80, t: 200 },
    ]),
    0.6,
  );
});

test('release velocity is zero with fewer than two recent samples', () => {
  assert.equal(releaseVelocity([{ y: 20, t: 100 }]), 0);
  assert.equal(
    releaseVelocity([
      { y: 0, t: 0 },
      { y: 20, t: 101 },
    ]),
    0,
  );
});
