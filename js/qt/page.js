import { appState, render, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { todayKey, parseDateKey, formatDateKey } from '../util/date.js';
import { getMonthGrid } from './calendar.js';
import { getTotal } from './streak.js';
import { getStage } from './growth.js';
import { insertQtRecord } from './api.js';
import { insertReflection, updateReflection } from '../reflection/api.js';
import { openQtGrowthSheet } from './growthSheet.js';
import { renderFeedPage } from '../reflection/feed.js';

function recordDates() {
  return appState.qt.records.map(r => r.qt_date);
}

function reflectionByDate(dateKey) {
  return appState.qt.myReflections.find(r => r.reflection_date === dateKey) || null;
}

// 'qt' 뷰 진입점: 탭에 따라 나의 QT / 묵상 나눔 분기
export function renderQtView() {
  if (appState.qtTab === 'feed') {
    renderFeedPage();
    return;
  }
  renderQtPage();
}

export function renderQtPage() {
  const today = todayKey();
  const completionSet = new Set(recordDates());
  const total = getTotal(recordDates());
  const stage = getStage(total);
  const monthDate = new Date(appState.qt.month);
  const cells = getMonthGrid(monthDate.getFullYear(), monthDate.getMonth());
  const calState = appState.qt.calendar;
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  const htmlDays = cells.map(date => {
    const key = formatDateKey(date);
    const isCurrentMonth = date.getMonth() === monthDate.getMonth();
    const isToday = key === today;
    const isFuture = key > today;
    const done = completionSet.has(key);
    const isRevealedOrOpen = calState.revealed === key || calState.open === key;

    const classNames = ['calendar-day'];
    if (!isCurrentMonth) classNames.push('muted');
    if (isToday) classNames.push('today');
    if (done && !isToday) classNames.push('completed');
    if (!isFuture) classNames.push('clickable');

    const inner = (done && !isRevealedOrOpen && !isToday)
      ? '<span class="day-circle">🌿</span>'
      : `<span class="day-circle">${date.getDate()}</span>`;

    return `
      <div class="${classNames.join(' ')}"
           style="${isFuture ? 'pointer-events:none; opacity:0.7;' : ''}"
           ${isFuture ? '' : `data-calendar-day="${key}"`}>
        ${inner}
      </div>
    `;
  }).join('');

  const selectedKey = calState.open || calState.revealed;
  let selectedSummary = '';
  if (selectedKey) {
    const d = parseDateKey(selectedKey);
    const selectedDone = completionSet.has(selectedKey);
    selectedSummary = `
      <div class="qt-selected-date-wrap">
        <div class="qt-selected-date">
          <span class="qt-selected-label">선택한 날짜</span>
          <strong>${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일</strong>
          <span class="qt-selected-badge ${selectedDone ? 'done' : 'pending'}">${selectedDone ? 'QT 완료' : '미완료'}</span>
        </div>
      </div>
    `;
  }

  renderShell(`
    <div class="qt-shell">
      <div class="qt-topbar">
        <div style="width:30px;"></div>
        <div class="qt-topbar-title">QT</div>
        <div style="width:30px;"></div>
      </div>

      <div class="qt-main-tabs">
        <button class="qt-tab ${appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
        <button class="qt-tab ${appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
      </div>

      <button type="button" class="qt-banner" data-plant-detail>
        <span class="badge">${stage.icon}</span>
        <span class="text">말씀과 함께한 날 <strong>${total}일</strong></span>
        <span class="chevron">›</span>
      </button>

      <div class="qt-calendar-card">
        <div class="calendar-header">
          <button type="button" data-month="prev">‹</button>
          <div>${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월</div>
          <button type="button" data-month="next">›</button>
        </div>
        <div class="calendar-grid">
          ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
          ${htmlDays}
        </div>
      </div>

      ${selectedSummary}

      <div class="detail-panel" id="detailPanel"></div>
    </div>
  `);

  bindQtPageEvents();
  paintDetailPanel();
}

function paintDetailPanel() {
  const panel = document.getElementById('detailPanel');
  if (!panel) return;

  const today = todayKey();
  const calState = appState.qt.calendar;
  const completionSet = new Set(recordDates());
  const isDoneToday = completionSet.has(today);
  const selectedKey = calState.open || calState.revealed;

  const completeButtonHtml = (dateKey) => `
    <div class="dp-note">오늘도 말씀과 함께해볼까요?</div>
    <button class="qt-check-btn" type="button" data-qt-complete data-qt-date="${dateKey}">
      <span class="check-icon"></span>
      <span>QT 완료하기</span>
    </button>
  `;

  const reflectionWriteHtml = (dateKey, content) => `
    <div class="dp-note"><strong>오늘도 말씀과 함께했어요. 🌿</strong> 받은 마음을 짧게 남겨보세요.</div>
    <div class="reflection-write">
      <textarea id="qtReflectionInput" placeholder="오늘 말씀을 통해 받은 마음이 있나요?">${escapeHtml(content)}</textarea>
      <button type="button" class="save-btn" data-qt-save-reflection data-qt-date="${dateKey}">묵상 나누기</button>
    </div>
  `;

  // 오늘은 항상 작성/수정 UI(내용 미리 채움) — 스펙 §8의 '묵상 수정'은 오늘 날짜에 한해 허용.
  // 과거 완료일은 읽기 전용(묵상이 있으면 읽기 카드, 없으면 안내 문구). 협업자 기본 화면 동작과 동일.
  let html;
  if (selectedKey) {
    const selectedDone = completionSet.has(selectedKey);
    const isSelectedToday = selectedKey === today;
    const content = reflectionByDate(selectedKey)?.content || '';

    if (!selectedDone) {
      html = isSelectedToday
        ? completeButtonHtml(selectedKey)
        : '<div class="dp-note">남겨진 QT 기록이 없어요.</div>';
    } else if (isSelectedToday) {
      html = reflectionWriteHtml(selectedKey, content);
    } else if (content) {
      const d = parseDateKey(selectedKey);
      html = `
        <div class="reflection-read">
          <div class="rp-date">${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 묵상</div>
          <div class="rp-content">${escapeHtml(content)}</div>
        </div>
      `;
    } else {
      html = '<div class="dp-note">이 날도 말씀과 함께했어요. 🌿</div>';
    }
  } else if (!isDoneToday) {
    html = completeButtonHtml(today);
  } else {
    html = reflectionWriteHtml(today, reflectionByDate(today)?.content || '');
  }

  panel.innerHTML = html;
  bindDetailPanelEvents();
}

function bindQtPageEvents() {
  document.querySelectorAll('[data-qt-tab]').forEach(button => {
    button.onclick = () => {
      appState.qtTab = button.dataset.qtTab;
      render();
    };
  });

  document.querySelectorAll('[data-month]').forEach(button => {
    button.onclick = () => {
      const next = new Date(appState.qt.month);
      next.setMonth(next.getMonth() + (button.dataset.month === 'next' ? 1 : -1));
      appState.qt.month = next;
      appState.qt.calendar = { revealed: null, open: null };
      render();
    };
  });

  document.querySelectorAll('[data-calendar-day]').forEach(cell => {
    cell.onclick = () => {
      const dateKey = cell.dataset.calendarDay;
      if (dateKey > todayKey()) return;
      appState.qt.calendar.revealed = dateKey;
      appState.qt.calendar.open = dateKey;
      render();
    };
  });

  const plantButton = document.querySelector('[data-plant-detail]');
  if (plantButton) plantButton.onclick = () => openQtGrowthSheet();
}

function bindDetailPanelEvents() {
  const completeButton = document.querySelector('[data-qt-complete]');
  if (completeButton) {
    completeButton.onclick = async () => {
      if (completeButton.disabled) return;
      completeButton.disabled = true;
      const targetDate = completeButton.dataset.qtDate;
      const today = todayKey();
      try {
        if (targetDate !== today) {
          showToast('QT 기록은 오늘의 걸음부터 남길 수 있어요.');
          return;
        }
        if (recordDates().includes(today)) {
          showToast('오늘의 QT 기록은 이미 남겨졌어요.');
          return;
        }
        const row = await insertQtRecord(appState.auth.profile.id, today);
        appState.qt.records.push(row);
        appState.qt.calendar.open = today;
        appState.qt.calendar.revealed = today;
        showToast('오늘도 말씀과 함께했어요 🌿');
        render();
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
      } finally {
        completeButton.disabled = false;
      }
    };
  }

  const saveButton = document.querySelector('[data-qt-save-reflection]');
  if (saveButton) {
    saveButton.onclick = async () => {
      if (saveButton.disabled) return;
      saveButton.disabled = true;
      const input = document.getElementById('qtReflectionInput');
      const value = input ? input.value.trim() : '';
      const targetDate = saveButton.dataset.qtDate;
      const today = todayKey();
      try {
        if (!value) {
          showToast('묵상을 한 줄 남겨주세요.');
          return;
        }
        if (targetDate !== today) {
          showToast('묵상은 오늘의 기록에 남길 수 있어요.');
          return;
        }
        const existing = reflectionByDate(today);
        const saved = existing
          ? await updateReflection(existing.id, value)
          : await insertReflection(appState.auth.profile.id, today, value);
        const list = appState.qt.myReflections;
        const idx = list.findIndex(r => r.id === saved.id);
        if (idx >= 0) list[idx] = saved;
        else list.push(saved);
        appState.qt.calendar.open = today;
        appState.qt.calendar.revealed = today;
        showToast('오늘의 묵상을 나눴어요 ☀️');
        render();
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
      } finally {
        saveButton.disabled = false;
      }
    };
  }
}
