import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtDate, shortDate, mostRecentSundayISO, sortMeetingsAsc,
  defaultMeetingId, adjacentMeeting, classifyMeeting, headerLabel, navLabel,
} from '../js/prayer/meeting.js';

// 2026-08-23은 일요일. 2026-08-27(목)의 최근 일요일은 08-23.
const MEETINGS = [
  { id: 2, meeting_date: '2026-08-16', meeting_number: 39 },
  { id: 4, meeting_date: '2026-08-30', meeting_number: 41 },
  { id: 1, meeting_date: '2026-08-09', meeting_number: 38 },
  { id: 3, meeting_date: '2026-08-23', meeting_number: 40 },
];
const TODAY = '2026-08-27';

test('fmtDate / shortDate', () => {
  assert.equal(fmtDate('2026-08-09'), '2026.08.09');
  assert.equal(shortDate('2026-08-09'), '08/09');
});

test('mostRecentSundayISO: 평일은 직전 일요일, 일요일은 그 자신', () => {
  assert.equal(mostRecentSundayISO('2026-08-27'), '2026-08-23');
  assert.equal(mostRecentSundayISO('2026-08-23'), '2026-08-23');
  assert.equal(mostRecentSundayISO('2026-08-01'), '2026-07-26');
});

test('sortMeetingsAsc: 날짜 오름차순, 원본 불변', () => {
  const sorted = sortMeetingsAsc(MEETINGS);
  assert.deepEqual(sorted.map(m => m.id), [1, 2, 3, 4]);
  assert.equal(MEETINGS[0].id, 2);
});

test('defaultMeetingId: 최근 일요일 이하 중 가장 최근', () => {
  assert.equal(defaultMeetingId(MEETINGS, TODAY), 3);
  assert.equal(defaultMeetingId(MEETINGS, '2026-08-20'), 2);
});

test('defaultMeetingId: 전부 미래면 가장 최근 순모임, 빈 배열이면 null', () => {
  assert.equal(defaultMeetingId(MEETINGS, '2026-07-01'), 4);
  assert.equal(defaultMeetingId([], TODAY), null);
});

test('adjacentMeeting: 이전/다음, 끝이면 null, 모르는 id면 null', () => {
  assert.equal(adjacentMeeting(MEETINGS, 3, -1).id, 2);
  assert.equal(adjacentMeeting(MEETINGS, 3, 1).id, 4);
  assert.equal(adjacentMeeting(MEETINGS, 4, 1), null);
  assert.equal(adjacentMeeting(MEETINGS, 99, 1), null);
});

test('classifyMeeting: 현재/과거/미래·최신 판정', () => {
  const current = classifyMeeting(MEETINGS[3], MEETINGS, TODAY); // id 3
  assert.deepEqual(current, { isPast: false, isFuture: false, isLatest: false, isCurrent: true });
  const past = classifyMeeting(MEETINGS[0], MEETINGS, TODAY); // id 2
  assert.deepEqual(past, { isPast: true, isFuture: false, isLatest: false, isCurrent: false });
  const future = classifyMeeting(MEETINGS[1], MEETINGS, TODAY); // id 4
  assert.deepEqual(future, { isPast: false, isFuture: true, isLatest: true, isCurrent: false });
});

test('headerLabel / navLabel: 기존 우선순위 유지', () => {
  const current = { isPast: false, isFuture: false, isLatest: false, isCurrent: true };
  const past = { isPast: true, isFuture: false, isLatest: false, isCurrent: false };
  const latestFuture = { isPast: false, isFuture: true, isLatest: true, isCurrent: false };
  const futureNotLatest = { isPast: false, isFuture: true, isLatest: false, isCurrent: false };
  assert.equal(headerLabel(current), '이번 주 순모임');
  assert.equal(headerLabel(past), '지난 순모임');
  assert.equal(headerLabel(latestFuture), '마지막 순모임');
  assert.equal(headerLabel(futureNotLatest), '다음 순모임');
  assert.equal(navLabel(current), '이번 순모임');
  assert.equal(navLabel(past), '지난 순모임');
  assert.equal(navLabel(latestFuture), '마지막 순모임');
  assert.equal(navLabel(futureNotLatest), '다음 순모임');
});
