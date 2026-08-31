// QT 연속·누적 계산. 순수 함수 — dates는 'YYYY-MM-DD' 문자열 배열, "오늘"은 인자로 받는다.
import { formatDateKey, parseDateKey } from '../util/date.js';

export function getTotal(dates) {
  return new Set(dates).size;
}

export function getCurrentStreak(dates, todayKey) {
  const set = new Set(dates);
  const cursor = parseDateKey(todayKey);
  let streak = 0;
  while (set.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getLongestStreak(dates) {
  const unique = [...new Set(dates)].sort();
  if (!unique.length) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const diff = Math.round((parseDateKey(unique[i]) - parseDateKey(unique[i - 1])) / 86400000);
    if (diff === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}
