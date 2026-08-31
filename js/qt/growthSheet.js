import { appState } from '../state.js';
import { openSheet } from '../ui/sheet.js';
import { todayKey } from '../util/date.js';
import { getTotal, getCurrentStreak, getLongestStreak } from './streak.js';
import { getProgress } from './growth.js';

export function openQtGrowthSheet() {
  const dates = appState.qt.records.map(r => r.qt_date);
  const total = getTotal(dates);
  const { stage, next, remaining, percent } = getProgress(total);
  const currentStreak = getCurrentStreak(dates, todayKey());
  const longestStreak = getLongestStreak(dates);

  const html = `
    <div class="growth-sheet">
      <div class="growth-hero">
        <div class="growth-sun"></div>
        <div class="growth-sparkle sparkle-1">✦</div>
        <div class="growth-sparkle sparkle-2">✦</div>
        <div class="growth-plant">
          <img src="${stage.image}" alt="${stage.name}" class="growth-plant-image">
        </div>
        <h2 class="growth-title">${stage.name}</h2>
        <p class="growth-description">말씀과 함께 자라고 있어요</p>
      </div>

      ${next ? `
        <div class="growth-progress-section">
          <div class="growth-next-title">${stage.name}에서 <strong>${next.name}</strong>으로 🌿</div>
          <div class="growth-progress-track">
            <div class="growth-progress-fill" style="width:${percent}%"></div>
          </div>
          <div class="growth-progress-meta">
            <span>${total}번 함께했어요</span>
            <strong>다음 성장까지 ${remaining}번</strong>
          </div>
        </div>
      ` : `
        <div class="growth-complete">🌳 풍성하게 자라고 있어요</div>
      `}

      <div class="growth-stats">
        <div class="growth-stat">
          <div class="growth-stat-icon">🔥</div>
          <strong>${currentStreak}일</strong>
          <span>현재 연속</span>
        </div>
        <div class="growth-stat main">
          <div class="growth-stat-icon">☀️</div>
          <strong>${total}일</strong>
          <span>함께한 날</span>
        </div>
        <div class="growth-stat">
          <div class="growth-stat-icon">🏅</div>
          <strong>${longestStreak}일</strong>
          <span>최장 연속</span>
        </div>
      </div>

      <div class="growth-message">오늘도 한 걸음 자라고 있어요 🌱</div>
    </div>
  `;
  openSheet(html);
}
