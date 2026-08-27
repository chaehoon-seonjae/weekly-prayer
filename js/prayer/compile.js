// 기도제목 항목 파싱과 전체 복사 텍스트 조립. 순수 함수.
import { fmtDate } from './meeting.js';

export function getDetailLines(item) {
  if (Array.isArray(item?.details)) {
    return item.details.map(v => String(v || '').trim()).filter(Boolean);
  }
  if (typeof item?.detail === 'string') {
    return item.detail.split(/\n+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

// cards: 표시 순서대로 [{ nickname, items: [{ title, detail }] }]
export function buildCompiledText(meeting, cards) {
  let out = `♥ 우리 순 기도제목 ♥\n${fmtDate(meeting.meeting_date)} ${meeting.meeting_number}번째 순모임\n`;
  cards.forEach(card => {
    out += `\n♥${card.nickname}\n`;
    card.items.forEach((it, i) => {
      out += `${i + 1}. ${it.title}\n`;
      getDetailLines(it).forEach(detail => { out += `- ${detail}\n`; });
    });
  });
  return out;
}
