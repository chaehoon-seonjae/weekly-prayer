(function () {
  const MEMBERS = ['지영', '선재', '세희', '평화', '종호', '도희', '예송', '수람', '유찬'];
  const SUPABASE_URL = 'https://jjubqeqqtvjvxlbnnuyt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_vKXSP4T6JYQrZmSpdbf-zg_6msfRmgJ';
  const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

  function sortedWeeksAsc() {
    return [...window.appState.weeks].sort((a, b) => a.week_date.localeCompare(b.week_date));
  }

  function mostRecentSundayISO(base = new Date()) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() - d.getDay());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isPastWeek() {
    const meta = window.currentWeekMeta();
    return meta && meta.week_date < mostRecentSundayISO();
  }

  function isFutureWeek() {
    const meta = window.currentWeekMeta();
    return meta && meta.week_date > mostRecentSundayISO();
  }

  function isLatestMeeting() {
    const meta = window.currentWeekMeta();
    if (!meta) return false;
    const arr = sortedWeeksAsc();
    return meta.id === arr[arr.length - 1]?.id;
  }

  function fmtDate(d) {
    const [y, m, day] = d.split('-');
    return `${y}.${m}.${day}`;
  }

  function shortDate(d) {
    const [, m, day] = d.split('-');
    return `${m}/${day}`;
  }

  function adjacentMeeting(direction) {
    const arr = sortedWeeksAsc();
    const idx = arr.findIndex(w => w.id === window.appState.currentWeek);
    return arr[idx + direction] || null;
  }

  function defaultMeetingId() {
    const sunday = mostRecentSundayISO();
    const candidates = [...window.appState.weeks].filter(w => w.week_date <= sunday).sort((a, b) => b.week_date.localeCompare(a.week_date));
    return (candidates[0] || [...window.appState.weeks].sort((a, b) => b.week_date.localeCompare(a.week_date))[0])?.id;
  }

  function isCurrentMeeting() {
    return window.appState.currentWeek === defaultMeetingId();
  }

  function renderPrayerView() {
    const meta = window.currentWeekMeta();
    const entries = window.currentEntries();
    const names = Object.keys(entries);
    const total = MEMBERS.length;
    const done = names.length;
    const allDone = done === total;
    const unwritten = MEMBERS.filter(m => !entries[m]);

    let dotsHtml = '';
    for (let i = 0; i < total; i += 1) {
      dotsHtml += `<span class="dot ${i < done ? 'filled' : ''}"></span>`;
    }

    const headerHtml = `
      <div class="week-header">
        <div class="eyebrow">${isLatestMeeting() ? '마지막 순모임' : isFutureWeek() ? '다음 순모임' : isPastWeek() ? '지난 순모임' : '이번 주 순모임'}</div>
        <h1 class="mono">${meta.week_number}번째 순모임</h1>
        <div class="date mono">${fmtDate(meta.week_date)}</div>
        <div class="progress-row">
          <div class="dots">${dotsHtml}</div>
          <div class="progress-text mono">${done} / ${total} 작성 완료</div>
        </div>
        ${allDone ? '<div class="complete-banner">☀️ 이번 주 기도제목이 모두 모였어요</div>' : ''}
      </div>
    `;

    const prev = adjacentMeeting(-1);
    const next = adjacentMeeting(1);
    const stripHtml = `
      <div class="meeting-nav">
        <div class="nav-side ${prev ? '' : 'disabled'}" id="prevMeeting" data-direction="-1">
          <span class="nav-arrow">‹</span>
          <span class="nav-date">${prev ? shortDate(prev.week_date) : ''}</span>
        </div>
        <div class="nav-center">
          <div class="label">${isCurrentMeeting() ? '이번 순모임' : isLatestMeeting() ? '마지막 순모임' : isFutureWeek() ? '다음 순모임' : '지난 순모임'}</div>
          <div class="date">${shortDate(meta.week_date)}</div>
          <div class="line"></div>
        </div>
        <div class="nav-side next ${next ? '' : 'disabled'}" id="nextMeeting" data-direction="1">
          <span class="nav-date">${next ? shortDate(next.week_date) : ''}</span>
          <span class="nav-arrow">›</span>
        </div>
      </div>
    `;

    let ctaHtml = '';
    if (!isPastWeek()) {
      ctaHtml = allDone
        ? '<button class="cta-btn" disabled>✓ 이번 주 기도제목 작성 완료</button>'
        : '<button class="cta-btn" id="btnWrite">＋ 이번 주 기도제목 나누기</button>';
      if (!allDone && unwritten.length > 0) {
        ctaHtml += `<div class="nudge">아직 <b>${unwritten.length}명</b>이 기도제목을 준비 중이에요. 천천히 나눠주셔도 괜찮아요 🌤️</div>`;
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
      cardsHtml = '<div class="cards">' + names.map(name => {
        const e = entries[name];
        const collapsed = window.appState.collapsedCards[name] !== false && e.items.length > 3;
        const hasPrayedBefore = !!localStorage.getItem(`prayed:${window.appState.currentWeek}:${name}`);
        return `
          <div class="card ${collapsed ? 'collapsed' : ''}" data-name="${name}">
            <div class="card-top">
              <div class="card-name">${name}</div>
              ${!isPastWeek() ? `<button class="kebab" data-edit="${name}">⋯</button>` : ''}
            </div>
            <div class="item-list">
              ${e.items.map((it, i) => `
                <div class="item">
                  <div class="item-title" data-idx="${i + 1}">${window.escapeHtml(it.title)}</div>
                  ${window.getDetailLines(it).map(detail => `<div class="item-detail">${window.escapeHtml(detail)}</div>`).join('')}
                </div>
              `).join('')}
            </div>
            ${e.items.length > 3 ? `<span class="more-toggle" data-toggle="${name}">${collapsed ? '더보기' : '접기'}</span>` : ''}
            <div class="card-bottom">
              <button class="pray-btn ${hasPrayedBefore ? 'done' : ''}" data-pray="${name}">
                <span class="glow"></span>
                🙏 ${hasPrayedBefore ? '함께 기도했어요' : '기도했어요'} <span class="count mono">· ${e.prayed}</span>
              </button>
            </div>
          </div>
        `;
      }).join('') + '</div>';
    }

    const copyBarHtml = !isPastWeek() ? `
      <div class="copy-bar">
        <div class="copy-bar-inner">
          <button class="copy-btn ${allDone ? 'ready' : ''}" id="btnCopyAll">
            ${allDone ? '전체 기도제목 복사' : `지금까지 작성된 ${done}명 기도제목 복사`}
          </button>
        </div>
      </div>
    ` : '';

    document.getElementById('app').innerHTML = headerHtml + stripHtml + (USE_SUPABASE ? '' : '<div class="nudge"><b>데모 모드</b> · Supabase URL과 Publishable key를 넣으면 공용 DB 모드로 전환됩니다.</div>') + ctaHtml + cardsHtml + copyBarHtml + window.renderBottomNav();
    window.bindGlobalNavigation();
    bindHomeEvents();
  }

  function buildCompiledText() {
    const meta = window.currentWeekMeta();
    const entries = window.currentEntries();
    let out = `♥ 우리 순 기도제목 ♥\n${fmtDate(meta.week_date)} ${meta.week_number}번째 순모임\n`;
    MEMBERS.forEach(name => {
      if (!entries[name]) return;
      out += `\n♥${name}\n`;
      entries[name].items.forEach((it, i) => {
        out += `${i + 1}. ${it.title}\n`;
        window.getDetailLines(it).forEach(detail => { out += `- ${detail}\n`; });
      });
    });
    return out;
  }

  function openPreviewSheet() {
    const text = buildCompiledText();
    const html = `
      <div class="sheet-title">전체 기도제목 미리보기</div>
      <div class="sheet-sub">카카오톡에 그대로 붙여넣을 수 있어요</div>
      <div class="preview-box">${window.escapeHtml(text)}</div>
      <button class="save-btn" id="btnDoCopy" style="margin-top:16px;">전체 기도제목 복사</button>
    `;
    const sheet = openSheet(html);
    sheet.querySelector('#btnDoCopy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      closeSheet();
      window.showToast('✓ 기도제목을 복사했어요');
    };
  }

  function openDeleteConfirm(name) {
    const html = `
      <div class="confirm-box">
        <p><b>${name}</b>님의 이번 주 기도제목을<br/>삭제할까요?</p>
        <div class="confirm-actions">
          <button class="confirm-cancel" id="btnCancel">취소</button>
          <button class="confirm-delete" id="btnConfirmDelete">삭제하기</button>
        </div>
      </div>
    `;
    const sheet = openSheet(html);
    sheet.querySelector('#btnCancel').onclick = closeSheet;
    sheet.querySelector('#btnConfirmDelete').onclick = async () => {
      const entry = window.appState.entries[window.appState.currentWeek][name];
      if (USE_SUPABASE && window.__db && entry?.id) {
        const { error } = await window.__db.from('prayers').delete().eq('id', entry.id);
        if (error) {
          console.error(error);
          window.showToast('삭제 중 오류가 발생했어요');
          return;
        }
      }
      delete window.appState.entries[window.appState.currentWeek][name];
      closeSheet();
      window.render();
      window.showToast('삭제되었어요');
    };
  }

  function renderWriteSheet(name, isEdit) {
    const html = `
      <div class="sheet-title">${name}님의 기도제목</div>
      <div class="sheet-sub">${isEdit ? '내용을 수정해주세요' : '한 주간 나누고 싶은 기도제목을 적어주세요'}</div>
      <div id="itemsWrap"></div>
      <button class="add-item-btn" id="btnAddItem">＋ 기도제목 추가</button>
      <div class="save-row">
        ${isEdit ? '<button class="danger-btn" id="btnDelete">삭제</button>' : ''}
        <button class="save-btn" id="btnSave">저장하기</button>
      </div>
    `;
    const sheet = openSheet(html);
    const wrap = sheet.querySelector('#itemsWrap');
    let draftItems = [];

    const existing = window.currentEntries()[name];
    draftItems = existing ? JSON.parse(JSON.stringify(existing.items)).map(it => ({ title: it.title || '', detail: it.detail || '', details: window.getDetailLines(it), showDetail: window.getDetailLines(it).length > 0 })) : [{ title: '', detail: '', details: [], showDetail: false }];

    function paintItems() {
      wrap.innerHTML = draftItems.map((it, i) => `
        <div class="prayer-item-block" data-i="${i}">
          ${draftItems.length > 1 ? `<button class="remove-item" data-remove="${i}">✕</button>` : ''}
          <div class="idx">${i + 1}</div>
          <textarea rows="2" placeholder="기도제목을 적어주세요" data-title="${i}">${it.title}</textarea>
          <div class="detail-list" data-detail-list="${i}">
            ${(it.details && it.details.length ? it.details : (it.detail ? [it.detail] : [''])).map((detail, di) => `
              <div class="detail-row" data-detail-row="${di}">
                <textarea rows="2" placeholder="상세 내용" data-detail="${i}" data-detail-index="${di}">${detail}</textarea>
                <button class="detail-remove" data-remove-detail="${i}" data-detail-index="${di}">✕</button>
              </div>
            `).join('')}
          </div>
          <button class="add-detail-btn" data-add-detail="${i}">＋ 상세 내용 추가</button>
        </div>
      `).join('');

      wrap.querySelectorAll('[data-title]').forEach(t => {
        t.oninput = () => draftItems[t.dataset.title].title = t.value;
      });
      wrap.querySelectorAll('[data-detail]').forEach(t => {
        t.oninput = () => {
          const item = draftItems[t.dataset.detail];
          const idx = Number(t.dataset.detailIndex || 0);
          item.details = item.details || [];
          item.details[idx] = t.value;
          item.details = item.details.filter((v, i) => i < item.details.length && (v || i === idx));
          item.detail = item.details.join('\n');
        };
      });
      wrap.querySelectorAll('[data-add-detail]').forEach(b => {
        b.onclick = () => {
          const item = draftItems[b.dataset.addDetail];
          item.details = item.details || [];
          item.details.push('');
          paintItems();
        };
      });
      wrap.querySelectorAll('[data-remove-detail]').forEach(b => {
        b.onclick = () => {
          const item = draftItems[b.dataset.removeDetail];
          const idx = Number(b.dataset.detailIndex || 0);
          item.details = (item.details || []).filter((_, i) => i !== idx);
          item.detail = item.details.join('\n');
          paintItems();
        };
      });
      wrap.querySelectorAll('[data-remove]').forEach(b => {
        b.onclick = () => {
          draftItems.splice(b.dataset.remove, 1);
          paintItems();
        };
      });
    }

    paintItems();

    sheet.querySelector('#btnAddItem').onclick = () => {
      draftItems.push({ title: '', detail: '', details: [], showDetail: false });
      paintItems();
    };

    sheet.querySelector('#btnSave').onclick = async () => {
      const cleaned = draftItems.map(it => {
        const details = (it.details || []).map(v => String(v || '').trim()).filter(Boolean);
        return { title: (it.title || '').trim(), detail: details.join('\n') };
      }).filter(it => it.title.length > 0);

      if (cleaned.length === 0) {
        window.showToast('기도제목을 한 가지 이상 입력해주세요');
        return;
      }

      const prev = window.currentEntries()[name];
      const prevPrayed = (prev && prev.prayed) || 0;
      let savedEntry = { items: cleaned, prayed: prevPrayed };

      if (USE_SUPABASE && window.__db) {
        const member = (window.__members || []).find(m => m.name === name);
        if (!member) {
          window.showToast('순원 정보를 찾을 수 없어요');
          return;
        }
        const payload = { meeting_id: Number(window.appState.currentWeek), member_id: member.id, items: cleaned, prayed_count: prevPrayed, updated_at: new Date().toISOString() };
        const { data, error } = await window.__db.from('prayers').upsert(payload, { onConflict: 'meeting_id,member_id' }).select().single();
        if (error) {
          console.error(error);
          window.showToast('저장 중 오류가 발생했어요');
          return;
        }
        savedEntry = { id: data.id, items: data.items || cleaned, prayed: data.prayed_count || 0, member_id: data.member_id };
      }

      if (!window.appState.entries[window.appState.currentWeek]) window.appState.entries[window.appState.currentWeek] = {};
      window.appState.entries[window.appState.currentWeek][name] = savedEntry;
      closeSheet();
      window.appState.collapsedCards[name] = true;
      window.render();
      window.showToast(isEdit ? '✓ 기도제목을 수정했어요' : '✓ 기도제목을 나눴어요');
    };

    const delBtn = sheet.querySelector('#btnDelete');
    if (delBtn) {
      delBtn.onclick = () => {
        closeSheet();
        setTimeout(() => openDeleteConfirm(name), 260);
      };
    }
  }

  function openMemberSheet() {
    const entries = window.currentEntries();
    const html = `
      <div class="sheet-title">누구의 기도제목을 나눌까요?</div>
      <div class="sheet-sub">이름을 선택해주세요</div>
      <div class="member-grid">
        ${MEMBERS.map(m => {
          const done = !!entries[m];
          return `<div class="member-chip ${done ? 'done' : ''}" data-member="${m}">${m}${done ? '<span class="check">✓ 작성 완료</span>' : ''}</div>`;
        }).join('')}
      </div>
    `;
    const sheet = openSheet(html);
    sheet.querySelectorAll('.member-chip:not(.done)').forEach(el => {
      el.onclick = () => {
        closeSheet();
        setTimeout(() => openWriteSheet(el.dataset.member, false), 260);
      };
    });
  }

  function openSheet(html) {
    const overlay = document.getElementById('overlay');
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.id = 'activeSheet';
    sheet.innerHTML = '<div class="sheet-handle"></div>' + html;
    document.body.appendChild(sheet);
    overlay.classList.add('show');
    requestAnimationFrame(() => sheet.classList.add('show'));
    overlay.onclick = closeSheet;
    return sheet;
  }

  function closeSheet() {
    const overlay = document.getElementById('overlay');
    const sheet = document.getElementById('activeSheet');
    overlay.classList.remove('show');
    if (sheet) {
      sheet.classList.remove('show');
      setTimeout(() => sheet.remove(), 250);
    }
  }

  function bindHomeEvents() {
    document.querySelectorAll('.nav-side[data-direction]').forEach(el => {
      if (el.classList.contains('disabled')) return;
      const direction = Number(el.dataset.direction);
      el.onclick = () => {
        const nextWeek = adjacentMeeting(direction);
        if (nextWeek) {
          window.appState.currentWeek = nextWeek.id;
          window.render();
        }
      };
    });

    const btnWrite = document.getElementById('btnWrite');
    if (btnWrite) btnWrite.onclick = () => openMemberSheet();

    document.querySelectorAll('[data-toggle]').forEach(el => {
      el.onclick = () => {
        const name = el.dataset.toggle;
        window.appState.collapsedCards[name] = !window.appState.collapsedCards[name];
        window.render();
      };
    });

    document.querySelectorAll('[data-pray]').forEach(el => {
      el.onclick = async () => {
        const name = el.dataset.pray;
        const entry = window.appState.entries[window.appState.currentWeek][name];
        const nextCount = (entry.prayed || 0) + 1;
        if (USE_SUPABASE && window.__db && entry.id) {
          const { error } = await window.__db.from('prayers').update({ prayed_count: nextCount }).eq('id', entry.id);
          if (error) {
            console.error(error);
            window.showToast('저장 중 오류가 발생했어요');
            return;
          }
        }
        localStorage.setItem(`prayed:${window.appState.currentWeek}:${name}`, '1');
        entry.prayed = nextCount;
        const glow = el.querySelector('.glow');
        if (glow) glow.classList.add('play');
        el.classList.add('done');
        el.innerHTML = `<span class="glow"></span> 🙏 함께 기도했어요 <span class="count mono">· ${nextCount}</span>`;
        setTimeout(() => window.render(), 550);
      };
    });

    document.querySelectorAll('[data-edit]').forEach(el => {
      el.onclick = () => openWriteSheet(el.dataset.edit, true);
    });

    const btnCopy = document.getElementById('btnCopyAll');
    if (btnCopy) btnCopy.onclick = () => openPreviewSheet();
  }

  window.renderPrayerView = renderPrayerView;
  window.bindHomeEvents = bindHomeEvents;
  window.openSheet = openSheet;
  window.closeSheet = closeSheet;
  window.openMemberSheet = openMemberSheet;
  window.openWriteSheet = function (name, isEdit) {
    renderWriteSheet(name, isEdit);
  };
})();
