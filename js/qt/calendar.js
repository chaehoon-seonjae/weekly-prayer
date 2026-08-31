// 월 달력 42칸 생성. 순수 함수.
// 원본 features/qt/qt-core.js의 (getDay()+6)%7 는 월요일 시작이라 요일 헤더('일'부터)와 어긋나던 버그 —
// 스펙 Ruling대로 일요일 시작으로 통일한다.
export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const cells = [];
  const cursor = new Date(start);
  for (let i = 0; i < 42; i += 1) {
    cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}
