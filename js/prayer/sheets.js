import { openSheet, closeSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';
import { appState, render } from '../state.js';
import { insertPrayer, updatePrayerItems, deletePrayer } from './api.js';
import { getDetailLines, buildCompiledText } from './compile.js';

function replacePrayerInState(saved) {
  const list = appState.prayer.prayers;
  const idx = list.findIndex(p => p.id === saved.id);
  if (idx >= 0) list[idx] = saved;
  else list.push(saved);
}

// 작성(existing === null) / 수정(existing = 내 Prayer 행). 작성자는 항상 로그인한 본인.
export function openWriteSheet({ meeting, existing }) {
  const profile = appState.auth.profile;
  const isEdit = Boolean(existing);
  const html = `
    <div class="sheet-title">${escapeHtml(profile.nickname)}님의 기도제목</div>
    <div class="sheet-sub">${isEdit ? '내용을 수정해주세요' : '한 주간 나누고 싶은 기도제목을 적어주세요'}</div>
    <div id="itemsWrap"></div>
    <button type="button" class="add-item-btn" id="btnAddItem">＋ 기도제목 추가</button>
    <div class="save-row">
      ${isEdit ? '<button type="button" class="danger-btn" id="btnDelete">삭제</button>' : ''}
      <button type="button" class="save-btn" id="btnSave">저장하기</button>
    </div>
  `;
  const sheet = openSheet(html);
  const wrap = sheet.querySelector('#itemsWrap');

  // 편집 초안: [{ title, details: string[] }]
  const draftItems = existing
    ? existing.items.map(it => ({ title: it.title || '', details: getDetailLines(it) }))
    : [{ title: '', details: [] }];

  function paintItems() {
    wrap.innerHTML = draftItems.map((it, i) => `
      <div class="prayer-item-block" data-i="${i}">
        ${draftItems.length > 1 ? `<button type="button" class="remove-item" data-remove="${i}">✕</button>` : ''}
        <div class="idx">${i + 1}</div>
        <textarea rows="2" placeholder="기도제목을 적어주세요" data-title="${i}">${escapeHtml(it.title)}</textarea>
        <div class="detail-list">
          ${(it.details.length ? it.details : ['']).map((detail, di) => `
            <div class="detail-row">
              <textarea rows="2" placeholder="상세 내용" data-detail="${i}" data-detail-index="${di}">${escapeHtml(detail)}</textarea>
              <button type="button" class="detail-remove" data-remove-detail="${i}" data-detail-index="${di}">✕</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="add-detail-btn" data-add-detail="${i}">＋ 상세 내용 추가</button>
      </div>
    `).join('');

    wrap.querySelectorAll('[data-title]').forEach(t => {
      t.oninput = () => { draftItems[Number(t.dataset.title)].title = t.value; };
    });
    wrap.querySelectorAll('[data-detail]').forEach(t => {
      t.oninput = () => {
        const item = draftItems[Number(t.dataset.detail)];
        item.details[Number(t.dataset.detailIndex)] = t.value;
      };
    });
    wrap.querySelectorAll('[data-add-detail]').forEach(b => {
      b.onclick = () => {
        const item = draftItems[Number(b.dataset.addDetail)];
        if (item.details.length === 0) item.details.push(''); // 화면의 빈 첫 줄을 실제 항목으로
        item.details.push('');
        paintItems();
      };
    });
    wrap.querySelectorAll('[data-remove-detail]').forEach(b => {
      b.onclick = () => {
        const item = draftItems[Number(b.dataset.removeDetail)];
        item.details.splice(Number(b.dataset.detailIndex), 1);
        paintItems();
      };
    });
    wrap.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = () => {
        draftItems.splice(Number(b.dataset.remove), 1);
        paintItems();
      };
    });
  }

  paintItems();

  sheet.querySelector('#btnAddItem').onclick = () => {
    draftItems.push({ title: '', details: [] });
    paintItems();
  };

  sheet.querySelector('#btnSave').onclick = async () => {
    const cleaned = draftItems
      .map(it => ({
        title: it.title.trim(),
        detail: it.details.map(v => String(v || '').trim()).filter(Boolean).join('\n'),
      }))
      .filter(it => it.title.length > 0);

    if (cleaned.length === 0) {
      showToast('기도제목을 한 가지 이상 입력해주세요');
      return;
    }

    try {
      const saved = isEdit
        ? await updatePrayerItems(existing.id, cleaned)
        : await insertPrayer({
            meetingId: meeting.id,
            profileId: profile.id,
            legacyMemberId: profile.legacy_member_id,
            items: cleaned,
          });
      replacePrayerInState(saved);
      appState.prayer.collapsed[saved.id] = true;
      closeSheet();
      render();
      showToast(isEdit ? '✓ 기도제목을 수정했어요' : '✓ 기도제목을 나눴어요');
    } catch (error) {
      console.error(error);
      showToast('저장 중 오류가 발생했어요');
    }
  };

  const delBtn = sheet.querySelector('#btnDelete');
  if (delBtn) {
    delBtn.onclick = () => {
      closeSheet();
      setTimeout(() => openDeleteConfirm(existing), 260);
    };
  }
}

export function openDeleteConfirm(prayer) {
  const html = `
    <div class="confirm-box">
      <p>이번 주 내 기도제목을<br/>삭제할까요?</p>
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
      await deletePrayer(prayer.id);
      appState.prayer.prayers = appState.prayer.prayers.filter(p => p.id !== prayer.id);
      closeSheet();
      render();
      showToast('삭제되었어요');
    } catch (error) {
      console.error(error);
      showToast('삭제 중 오류가 발생했어요');
    }
  };
}

export function openPreviewSheet(meeting, cards) {
  const text = buildCompiledText(meeting, cards);
  const html = `
    <div class="sheet-title">전체 기도제목 미리보기</div>
    <div class="sheet-sub">카카오톡에 그대로 붙여넣을 수 있어요</div>
    <div class="preview-box">${escapeHtml(text)}</div>
    <button type="button" class="save-btn" id="btnDoCopy" style="margin-top:16px;">전체 기도제목 복사</button>
  `;
  const sheet = openSheet(html);
  sheet.querySelector('#btnDoCopy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    closeSheet();
    showToast('✓ 기도제목을 복사했어요');
  };
}
