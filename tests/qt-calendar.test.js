import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMonthGrid } from '../js/qt/calendar.js';
import { formatDateKey } from '../js/util/date.js';

test('42칸이며 첫 칸은 일요일이다', () => {
  const grid = getMonthGrid(2026, 7); // 2026년 8월 (8/1은 토요일)
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getDay(), 0);
  assert.equal(formatDateKey(grid[0]), '2026-07-26'); // 8/1 직전 일요일
});

test('1일이 일요일인 달은 1일부터 시작한다', () => {
  const grid = getMonthGrid(2026, 10); // 2026년 11월 (11/1은 일요일)
  assert.equal(formatDateKey(grid[0]), '2026-11-01');
  assert.equal(formatDateKey(grid[41]), '2026-12-12');
});
