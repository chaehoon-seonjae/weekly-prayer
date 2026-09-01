import { appState, render, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { openSheet, closeSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { loadFeed, addReaction, removeReaction, deleteReflection } from './api.js';

function shellHtml(bodyHtml) {
  return `
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

      <div class="feed-section-title">오늘의 묵상 <span>☀️</span></div>

      <div class="feed-list">${bodyHtml}</div>
    </div>
  `;
}

function bindTabEvents() {
  document.querySelectorAll('[data-qt-tab]').forEach(button => {
    button.onclick = () => {
      appState.qtTab = button.dataset.qtTab;
      render();
    };
  });
}

export async function renderFeedPage() {
  renderShell(shellHtml('<div class="dp-note">묵상을 불러오고 있어요…</div>'));
  bindTabEvents();

  let items;
  try {
    items = await loadFeed();
  } catch (error) {
    console.error(error);
    if (appState.view !== 'qt' || appState.qtTab !== 'feed') return; // 다른 화면으로 이동했으면 덮어쓰지 않는다
    renderShell(shellHtml('<div class="dp-note">묵상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>'));
    bindTabEvents();
    return;
  }
  if (appState.view !== 'qt' || appState.qtTab !== 'feed') return; // 다른 화면으로 이동했으면 덮어쓰지 않는다

  appState.feed.items = items;
  const myProfileId = appState.auth.profile.id;

  const listHtml = items.length === 0
    ? '<div class="dp-note">아직 나눠진 묵상이 없어요. 오늘 말씀을 통해 받은 마음을 첫 번째로 나눠보세요.</div>'
    : items.map(item => {
        const nickname = item.profiles?.nickname || '순원';
        const reactions = item.reflection_reactions || [];
        const graceCount = reactions.filter(r => r.reaction_type === 'grace').length;
        const prayCount = reactions.filter(r => r.reaction_type === 'pray').length;
        const hasGrace = reactions.some(r => r.reaction_type === 'grace' && r.profile_id === myProfileId);
        const hasPray = reactions.some(r => r.reaction_type === 'pray' && r.profile_id === myProfileId);
        const isMine = item.profile_id === myProfileId;
        return `
          <div class="feed-card">
            <div class="feed-top">
              <div class="feed-avatar">${escapeHtml(nickname.slice(0, 1))}</div>
              <div class="feed-meta">
                <div class="feed-name">${escapeHtml(nickname)}</div>
                <div class="feed-date">${escapeHtml(item.reflection_date)}</div>
              </div>
              ${isMine ? `<button class="feed-delete" type="button" data-reflection-delete="${item.id}">삭제</button>` : ''}
            </div>
            <div class="feed-content">${escapeHtml(item.content)}</div>
            <div class="feed-actions">
              <button class="feed-action ${hasGrace ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:grace">🙏 은혜받았어요 ${graceCount}</button>
              <button class="feed-action ${hasPray ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:pray">🤍 함께 기도해요 ${prayCount}</button>
            </div>
          </div>
        `;
      }).join('');

  renderShell(shellHtml(listHtml));
  bindTabEvents();
  bindReactionEvents();
  bindDeleteEvents();
}

function bindDeleteEvents() {
  document.querySelectorAll('[data-reflection-delete]').forEach(button => {
    button.onclick = () => openDeleteConfirmSheet(button.dataset.reflectionDelete);
  });
}

function openDeleteConfirmSheet(reflectionId) {
  const html = `
    <div class="confirm-box">
      <p>이 묵상을 삭제할까요?<br/>받은 반응도 함께 사라져요.</p>
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel" id="btnCancel">취소</button>
        <button type="button" class="confirm-delete" id="btnConfirmDelete">삭제하기</button>
      </div>
    </div>
  `;
  const sheet = openSheet(html);
  sheet.querySelector('#btnCancel').onclick = closeSheet;
  sheet.querySelector('#btnConfirmDelete').onclick = async () => {
    try {
      await deleteReflection(reflectionId);
      // 나의 QT 탭이 부팅 시 캐시(appState.qt.myReflections)를 읽으므로 함께 갱신한다.
      appState.qt.myReflections = appState.qt.myReflections.filter(r => String(r.id) !== reflectionId);
      closeSheet();
      showToast('삭제되었어요');
      await renderFeedPage();
    } catch (error) {
      console.error(error);
      showToast('삭제 중 오류가 발생했어요');
    }
  };
}

function bindReactionEvents() {
  document.querySelectorAll('[data-reflection-reaction]').forEach(button => {
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      const [reflectionId, type] = button.dataset.reflectionReaction.split(':');
      const myProfileId = appState.auth.profile.id;
      const item = appState.feed.items.find(i => String(i.id) === reflectionId);
      const has = (item?.reflection_reactions || []).some(
        r => r.reaction_type === type && r.profile_id === myProfileId,
      );
      try {
        if (has) await removeReaction(reflectionId, myProfileId, type);
        else await addReaction(reflectionId, myProfileId, type);
        await renderFeedPage();
      } catch (error) {
        console.error(error);
        showToast('저장 중 오류가 발생했어요');
        button.disabled = false;
      }
    };
  });
}
