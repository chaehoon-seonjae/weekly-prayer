// 순모임 관련 순수 함수. 날짜는 'YYYY-MM-DD' 문자열, meeting = { id, meeting_date, meeting_number }.
import { formatDateKey } from '../util/date.js';

export function fmtDate(d) {
  const [y, m, day] = d.split('-');
  return `${y}.${m}.${day}`;
}

export function shortDate(d) {
  const [, m, day] = d.split('-');
  return `${m}/${day}`;
}

export function mostRecentSundayISO(todayKey) {
  const [y, m, d] = todayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - date.getDay());
  return formatDateKey(date);
}

export function sortMeetingsAsc(meetings) {
  return [...meetings].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
}

export function defaultMeetingId(meetings, todayKey) {
  if (!meetings.length) return null;
  const sunday = mostRecentSundayISO(todayKey);
  const desc = sortMeetingsAsc(meetings).reverse();
  return (desc.find(m => m.meeting_date <= sunday) || desc[0]).id;
}

export function adjacentMeeting(meetings, currentId, direction) {
  const arr = sortMeetingsAsc(meetings);
  const idx = arr.findIndex(m => m.id === currentId);
  if (idx < 0) return null;
  return arr[idx + direction] || null;
}

export function classifyMeeting(meeting, meetings, todayKey) {
  const sunday = mostRecentSundayISO(todayKey);
  const arr = sortMeetingsAsc(meetings);
  return {
    isPast: meeting.meeting_date < sunday,
    isFuture: meeting.meeting_date > sunday,
    isLatest: meeting.id === arr[arr.length - 1]?.id,
    isCurrent: meeting.id === defaultMeetingId(meetings, todayKey),
  };
}

// 상단 헤더 eyebrow (기존 prayer.js 우선순위: latest → future → past → current)
export function headerLabel(flags) {
  if (flags.isLatest) return '마지막 순모임';
  if (flags.isFuture) return '다음 순모임';
  if (flags.isPast) return '지난 순모임';
  return '이번 주 순모임';
}

// 이전/다음 스트립 중앙 라벨 (기존 우선순위: current → latest → future → past)
export function navLabel(flags) {
  if (flags.isCurrent) return '이번 순모임';
  if (flags.isLatest) return '마지막 순모임';
  if (flags.isFuture) return '다음 순모임';
  return '지난 순모임';
}
