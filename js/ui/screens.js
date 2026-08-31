import { escapeHtml, setApp } from './dom.js';

export function renderLoading() {
  setApp(`
    <div class="week-header" style="opacity:.5"></div>
    <div class="cards" style="margin-top:20px;">
      ${[1, 2, 3].map(() => `
        <div class="skeleton">
          <div class="sk-line" style="width:30%"></div>
          <div class="sk-line" style="width:90%"></div>
          <div class="sk-line" style="width:70%"></div>
        </div>
      `).join('')}
    </div>
  `);
}

export function renderConnectionError(message) {
  setApp(`
    <div class="week-header">
      <div class="eyebrow">연결 상태</div>
      <h1>불러오지 못했어요</h1>
      <div class="date" style="margin-top:8px; line-height:1.6;">${escapeHtml(message)}</div>
    </div>
    <div class="empty-card">
      <div class="sun-icon">☁️</div>
      <div>네트워크 상태를 확인한 뒤 새로고침해 주세요.</div>
    </div>
  `);
}

export function renderProfilePending() {
  setApp(`
    <div class="empty-card" style="margin-top:40px;">
      <div class="sun-icon">🌤️</div>
      <div>프로필을 준비하고 있어요.<br/>잠시 후 새로고침해 주세요.</div>
    </div>
  `);
}
