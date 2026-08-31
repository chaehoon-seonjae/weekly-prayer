import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateKey } from '../js/util/date.js';
import { getTotal, getCurrentStreak, getLongestStreak } from '../js/qt/streak.js';

test('parseDateKey: 로컬 자정 Date로 파싱한다', () => {
  const d = parseDateKey('2026-08-31');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 31);
  assert.equal(d.getHours(), 0);
});

test('getTotal: 중복 날짜는 한 번만 센다', () => {
  assert.equal(getTotal(['2026-08-30', '2026-08-30', '2026-08-31']), 2);
  assert.equal(getTotal([]), 0);
});

test('getCurrentStreak: 오늘부터 거꾸로 연속한 날 수', () => {
  const dates = ['2026-08-29', '2026-08-30', '2026-08-31'];
  assert.equal(getCurrentStreak(dates, '2026-08-31'), 3);
});

test('getCurrentStreak: 오늘 기록이 없으면 0', () => {
  assert.equal(getCurrentStreak(['2026-08-29', '2026-08-30'], '2026-08-31'), 0);
});

test('getCurrentStreak: 월 경계를 넘는 연속', () => {
  assert.equal(getCurrentStreak(['2026-08-31', '2026-09-01'], '2026-09-01'), 2);
});

test('getLongestStreak: 끊긴 구간이 있으면 가장 긴 연속', () => {
  assert.equal(getLongestStreak(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10', '2026-08-11']), 3);
  assert.equal(getLongestStreak([]), 0);
  assert.equal(getLongestStreak(['2026-08-01']), 1);
});
