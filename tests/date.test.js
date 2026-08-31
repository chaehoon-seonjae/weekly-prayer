import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateKey } from '../js/util/date.js';

test('formatDateKey: 월·일을 두 자리로 채운다', () => {
  assert.equal(formatDateKey(new Date(2026, 7, 5)), '2026-08-05');
});

test('formatDateKey: 연말·연초 경계', () => {
  assert.equal(formatDateKey(new Date(2026, 0, 31)), '2026-01-31');
  assert.equal(formatDateKey(new Date(2025, 11, 1)), '2025-12-01');
});
