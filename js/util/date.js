// 날짜 키 유틸. formatDateKey는 순수 함수(로컬 시간 기준), todayKey는 브라우저에서만 호출한다.
export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return formatDateKey(new Date());
}
