import assert from 'node:assert/strict';
import test from 'node:test';

import { areaPath, linePath, monthTicks, xScale, yBounds, yScale } from './mileage-chart.ts';

test('rounds the y axis to whole thousands around the first and last km', () => {
  assert.deepEqual(
    yBounds([
      { date: '2025-11-05', mileage: 36800 },
      { date: '2026-11-02', mileage: 48250 },
    ]),
    { min: 36000, max: 49000 },
  );
});

test('opens a 1.000 km range when there is a single flat value', () => {
  const bounds = yBounds([{ date: '2025-11-05', mileage: 52000 }]);
  assert.deepEqual(bounds, { min: 52000, max: 53000 });
  assert.equal(yScale(bounds)(52000), 100);
});

test('maps dates and km to percentages', () => {
  const x = xScale('2026-01-01', '2026-01-11');
  assert.equal(x('2026-01-01'), 0);
  assert.equal(x('2026-01-06'), 50);
  assert.equal(yScale({ min: 0, max: 1000 })(250), 75);
});

test('draws a step line that stays flat until today, and closes the area under it', () => {
  const coords = [
    { x: 0, y: 80 },
    { x: 40, y: 50 },
  ];
  assert.equal(linePath(coords), 'M 0 80 H 40 V 50 H 100');
  assert.equal(areaPath(coords), 'M 0 80 H 40 V 50 H 100 V 100 H 0 Z');
});

test('labels mar, jun, sep and dic inside the period, leaving room for "hoy"', () => {
  assert.deepEqual(
    monthTicks('2025-11-05', '2026-11-05').map((tick) => tick.label),
    ['dic', 'mar', 'jun', 'sep'],
  );
  // 1 dic is ~98% of the way to 3 dic, where it would overlap "hoy".
  assert.deepEqual(
    monthTicks('2025-12-03', '2026-12-03').map((tick) => tick.label),
    ['mar', 'jun', 'sep'],
  );
});
