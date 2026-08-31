import { appState, render, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { todayKey } from '../util/date.js';
import { incrementPrayed } from './api.js';
import { getDetailLines } from './compile.js';
import { adjacentMeeting, classifyMeeting, headerLabel, navLabel, fmtDate, shortDate } from './meeting.js';
import { openWriteSheet, openPreviewSheet } from './sheets.js';

function prayedKey(meetingId, prayerId) {
  return `prayed:${meetingId}:${prayerId}`;
}

export function renderPrayerPage() {
  const { meetings, prayers, profiles, currentMeetingId, collapsed } = appState.prayer;
  const myProfileId = appState.auth.profile.id;
  const meeting = meetings.find(m => m.id === currentMeetingId);

  if (!meeting) {
    renderShell(`
      <div class="empty-card" style="margin-top:40px;">
        <div class="sun-icon">☁️</div>
        <div>등록된 순모임이 없어요.</div>
      </div>
    `);
    return;
  }

  const flags = classifyMeeting(meeting, meetings, todayKey());
  const meetingPrayers = prayers.filter(p => p.meeting_id === meeting.id);
  // profiles 순서(display_order → nickname)대로 카드 구성. 자리표시자 프로필도 분모에 포함.
  const cards = profiles
    .map(profile => ({ profile, prayer: meetingPrayers.find(p => p.profile_id === profile.id) }))
    .filter(c => c.prayer);
  const total = profiles.length;
  const done = cards.length;
  const allDone = total > 0 && done === total;
  const mine = meetingPrayers.find(p => p.profile_id === myProfileId) || null;
  const canWrite = !flags.isPast;

  let dotsHtml = '';
  for (let i = 0; i < total; i += 1) {
    dotsHtml += `<span class="dot ${i < done ? 'filled' : ''}"></span>`;
  }

  const headerHtml = `
    <div class="week-header">
      <div class="eyebrow">${headerLabel(flags)}</div>
      <h1 class="mono">${meeting.meeting_number}번째 순모임</h1>
      <div class="date mono">${fmtDate(meeting.meeting_date)}</div>
      <div class="progress-row">
        <div class="dots">${dotsHtml}</div>
        <div class="progress-text mono">${done} / ${total} 작성 완료</div>
      </div>
      ${allDone ? '<div class="complete-banner">☀️ 이번 주 기도제목이 모두 모였어요</div>' : ''}
    </div>
  `;

  const prev = adjacentMeeting(meetings, meeting.id, -1);
  const next = adjacentMeeting(meetings, meeting.id, 1);
  const stripHtml = `
    <div class="meeting-nav">
      <div class="nav-side ${prev ? '' : 'disabled'}" data-direction="-1">
        <span class="nav-arrow">‹</span>
        <span class="nav-date">${prev ? shortDate(prev.meeting_date) : ''}</span>
      </div>
      <div class="nav-center">
        <div class="label">${navLabel(flags)}</div>
        <div class="date">${shortDate(meeting.meeting_date)}</div>
        <div class="line"></div>
      </div>
      <div class="nav-side next ${next ? '' : 'disabled'}" data-direction="1">
        <span class="nav-date">${next ? shortDate(next.meeting_date) : ''}</span>
        <span class="nav-arrow">›</span>
      </div>
    </div>
  `;

  let ctaHtml = '';
  if (canWrite) {
    ctaHtml = mine
      ? '<button type="button" class="cta-btn" disabled>✓ 이번 주 기도제목을 나눴어요</button>'
      : '<button type="button" class="cta-btn" id="btnWrite">＋ 이번 주 기도제목 나누기</button>';
    if (!allDone) {
      ctaHtml += `<div class="nudge">아직 <b>${total - done}명</b>이 기도제목을 준비 중이에요. 천천히 나눠주셔도 괜찮아요 🌤️</div>`;
    }
  }

  let cardsHtml = '';
  if (done === 0) {
    cardsHtml = `
      <div class="empty-card">
        <div class="sun-icon">🌤️</div>
        <div>아직 아무도 기도제목을 나누지 않았어요.<br/>가장 먼저 나눠보는 건 어떨까요?</div>
      </div>`;
  } else {
    cardsHtml = '<div class="cards">' + cards.map(({ profile, prayer }) => {
      const items = Array.isArray(prayer.items) ? prayer.items : [];
      const isCollapsed = collapsed[prayer.id] !== false && items.length > 3;
      const hasPrayed = Boolean(localStorage.getItem(prayedKey(meeting.id, prayer.id)));
      const isMine = prayer.profile_id === myProfileId;
      return `
        <div class="card ${isCollapsed ? 'collapsed' : ''}" data-prayer="${prayer.id}">
          <div class="card-top">
            <div class="card-name">${escapeHtml(profile.nickname)}</div>
            ${canWrite && isMine ? `<button type="button" class="kebab" data-edit="${prayer.id}">⋯</button>` : ''}
          </div>
          <div class="item-list">
            ${items.map((it, i) => `
              <div class="item">
                <div class="item-title" data-idx="${i + 1}">${escapeHtml(it.title)}</div>
                ${getDetailLines(it).map(detail => `<div class="item-detail">${escapeHtml(detail)}</div>`).join('')}
              </div>
            `).join('')}
          </div>
          ${items.length > 3 ? `<span class="more-toggle" data-toggle="${prayer.id}">${isCollapsed ? '더보기' : '접기'}</span>` : ''}
          <div class="card-bottom">
            <button type="button" class="pray-btn ${hasPrayed ? 'done' : ''}" data-pray="${prayer.id}">
              <span class="glow"></span>
              🙏 ${hasPrayed ? '함께 기도했어요' : '기도했어요'} <span class="count mono">· ${prayer.prayed_count || 0}</span>
            </button>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  const copyBarHtml = canWrite ? `
    <div class="copy-bar">
      <div class="copy-bar-inner">
        <button type="button" class="copy-btn ${allDone ? 'ready' : ''}" id="btnCopyAll">
          ${allDone ? '전체 기도제목 복사' : `지금까지 작성된 ${done}명 기도제목 복사`}
        </button>
      </div>
    </div>
  ` : '';

  renderShell(headerHtml + stripHtml + ctaHtml + cardsHtml + copyBarHtml);
  bindPrayerEvents({ meeting, meetings, mine, cards });
}

function bindPrayerEvents({ meeting, meetings, mine, cards }) {
  document.querySelectorAll('.nav-side[data-direction]').forEach(el => {
    if (el.classList.contains('disabled')) return;
    el.onclick = () => {
      const target = adjacentMeeting(meetings, meeting.id, Number(el.dataset.direction));
      if (target) {
        appState.prayer.currentMeetingId = target.id;
        render();
      }
    };
  });

  const btnWrite = document.getElementById('btnWrite');
  if (btnWrite) btnWrite.onclick = () => openWriteSheet({ meeting, existing: null });

  document.querySelectorAll('[data-edit]').forEach(el => {
    el.onclick = () => {
      if (mine && String(mine.id) === el.dataset.edit) openWriteSheet({ meeting, existing: mine });
    };
  });

  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.onclick = () => {
      const id = Number(el.dataset.toggle);
      // 기본값(undefined)은 '접힘'. 접힘이면 펼치고, 펼침이면 접는다.
      const isCollapsed = appState.prayer.collapsed[id] !== false;
      appState.prayer.collapsed[id] = !isCollapsed;
      render();
    };
  });

  document.querySelectorAll('[data-pray]').forEach(el => {
    el.onclick = async () => {
      const id = Number(el.dataset.pray);
      try {
        const nextCount = await incrementPrayed(id);
        const prayer = appState.prayer.prayers.find(p => p.id === id);
        if (prayer) prayer.prayed_count = nextCount;
        localStorage.setItem(prayedKey(meeting.id, id), '1');
        const glow = el.querySelector('.glow');
        if (glow) glow.classList.add('play');
        el.classList.add('done');
        el.innerHTML = `<span class="glow"></span> 🙏 함께 기도했어요 <span class="count mono">· ${nextCount}</span>`;
        setTimeout(() => render(), 550);
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
      }
    };
  });

  const btnCopy = document.getElementById('btnCopyAll');
  if (btnCopy) {
    btnCopy.onclick = () => openPreviewSheet(
      meeting,
      cards.map(({ profile, prayer }) => ({ nickname: profile.nickname, items: prayer.items || [] })),
    );
  }
}
