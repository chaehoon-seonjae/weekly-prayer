(function () {
  window.QT = window.QT || {};

  const Core = window.QT.Core;
  const Data = window.QT.Data;

  function ensureCalendarState() {
    if (!window.appState.qtCalendarState) {
      window.appState.qtCalendarState = { revealed: null, open: null };
    }
    return window.appState.qtCalendarState;
  }

  function getActiveQtDateKey() {
    const calState = ensureCalendarState();
    return calState.open || calState.revealed || Core.formatDateKey(new Date());
  }

  function renderDetailPanel(todayKey, isDoneToday, records = Data.getQtRecordsLocal(), reflections = Data.getQtReflectionsLocal()) {
    const calState = ensureCalendarState();
    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    const selectedKey = calState.open || calState.revealed || todayKey;
    const selectedDone = records.some(item => item.date === selectedKey);
    const dateLabel = Core.getDateFromKey(selectedKey);

    if (calState.open) {
      if (!selectedDone) {
        panel.innerHTML = `
          <div class="dp-note">${dateLabel.getFullYear()}년 ${dateLabel.getMonth() + 1}월 ${dateLabel.getDate()}일은 아직 QT를 완료하지 않았어요.</div>
          <button class="qt-check-btn" type="button" data-qt-complete data-qt-date="${selectedKey}"><span class="check-icon"></span><span>QT 완료하기</span></button>
        `;
        return;
      }

      const record = reflections.find(item => item.date === selectedKey);
      const content = record && record.content ? record.content : '';

      if (content) {
        panel.innerHTML = `
          <div class="reflection-read">
            <div class="rp-date">${dateLabel.getFullYear()}년 ${dateLabel.getMonth() + 1}월 ${dateLabel.getDate()}일 묵상</div>
            <div class="rp-content">${window.escapeHtml(content)}</div>
          </div>
        `;
        return;
      }

      panel.innerHTML = `
        <div class="dp-note"><strong>${dateLabel.getMonth() + 1}월 ${dateLabel.getDate()}일 QT를 완료했어요.</strong> 받은 마음을 짧게 남겨보세요.</div>
        <div class="reflection-write">
          <textarea id="qtReflectionInput" placeholder="오늘 말씀을 통해 받은 마음이 있나요?">${window.escapeHtml(content)}</textarea>
          <button type="button" class="save-btn" data-qt-save-reflection data-qt-date="${selectedKey}">묵상 나누기</button>
        </div>
      `;
      return;
    }

    if (calState.revealed && !calState.open) {
      if (!selectedDone) {
        panel.innerHTML = `
          <div class="dp-note">${dateLabel.getFullYear()}년 ${dateLabel.getMonth() + 1}월 ${dateLabel.getDate()}일은 아직 QT를 완료하지 않았어요.</div>
          <button class="qt-check-btn" type="button" data-qt-complete data-qt-date="${selectedKey}"><span class="check-icon"></span><span>QT 완료하기</span></button>
        `;
        return;
      }
      panel.innerHTML = '';
      return;
    }

    if (!isDoneToday) {
      panel.innerHTML = `
        <div class="dp-note">오늘도 말씀과 함께해볼까요?</div>
        <button class="qt-check-btn" type="button" data-qt-complete data-qt-date="${todayKey}"><span class="check-icon"></span><span>QT 완료하기</span></button>
      `;
      return;
    }

    const reflectionText = reflections.find(item => item.date === todayKey)?.content || '';
    panel.innerHTML = `
      <div class="dp-note"><strong>오늘 QT를 완료했어요.</strong> 받은 마음을 짧게 남겨보세요.</div>
      <div class="reflection-write">
        <textarea id="qtReflectionInput" placeholder="오늘 말씀을 통해 받은 마음이 있나요?">${window.escapeHtml(reflectionText)}</textarea>
        <button type="button" class="save-btn" data-qt-save-reflection data-qt-date="${todayKey}">묵상 나누기</button>
      </div>
    `;
  }

  function bindQtEvents() {
    document.querySelectorAll('[data-qt-tab]').forEach(button => {
      button.onclick = () => {
        window.appState.qtTab = button.dataset.qtTab;
        window.appState.currentView = 'qt';
        window.render();
      };
    });

    document.querySelectorAll('[data-month]').forEach(button => {
      button.onclick = () => {
        const next = new Date(window.appState.qtMonth);
        next.setMonth(next.getMonth() + (button.dataset.month === 'next' ? 1 : -1));
        window.appState.qtMonth = next;
        window.appState.qtCalendarState = { revealed: null, open: null };
        window.render();
      };
    });

    document.querySelectorAll('[data-calendar-day]').forEach(cell => {
      cell.onclick = () => {
        const dateKey = cell.dataset.calendarDay;
        const todayKey = Core.formatDateKey(new Date());
        if (dateKey > todayKey) return;

        const calState = ensureCalendarState();
        if (calState.open === dateKey) {
          calState.open = null;
          calState.revealed = null;
        } else if (calState.revealed === dateKey) {
          calState.open = dateKey;
        } else {
          calState.revealed = dateKey;
          calState.open = null;
        }
        window.render();
      };
    });

    const completeButton = document.querySelector('[data-qt-complete]');
    if (completeButton) {
      completeButton.onclick = async () => {
        const targetDate = completeButton.dataset.qtDate || getActiveQtDateKey();
        const records = await Data.getQtRecords();
        if (records.some(r => r.date === targetDate)) {
          window.showToast('이미 완료한 날이에요.');
          return;
        }

        records.push({ date: targetDate, created_at: new Date().toISOString() });
        await Data.saveQtRecords(records);

        const reflections = await Data.getQtReflections();
        const exists = reflections.some(item => item.date === targetDate);
        if (!exists) {
          reflections.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            date: targetDate,
            content: '',
            created_at: new Date().toISOString(),
            user: 'me'
          });
          await Data.saveQtReflections(reflections);
        }

        const calState = ensureCalendarState();
        calState.open = targetDate;
        calState.revealed = targetDate;

        window.showToast('QT를 완료했어요');
        window.render();
      };
    }

    const reflectionSaveButton = document.querySelector('[data-qt-save-reflection]');
    if (reflectionSaveButton) {
      reflectionSaveButton.onclick = async () => {
        const input = document.getElementById('qtReflectionInput');
        if (!input) return;

        const value = input.value.trim();
        const targetDate = reflectionSaveButton.dataset.qtDate || getActiveQtDateKey();
        const list = await Data.getQtReflections();
        const existingIndex = list.findIndex(item => item.date === targetDate);

        if (existingIndex >= 0) {
          list[existingIndex].content = value;
        } else {
          list.push({
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            date: targetDate,
            content: value,
            created_at: new Date().toISOString(),
            user: 'me'
          });
        }

        await Data.saveQtReflections(list);

        if (!value) {
          window.showToast('묵상을 한 줄 남겨주세요.');
          return;
        }

        const calState = ensureCalendarState();
        calState.open = targetDate;
        calState.revealed = targetDate;

        window.showToast('묵상을 저장했어요.');
        window.render();
      };
    }

    const reactionButtons = document.querySelectorAll('[data-reflection-reaction]');
    reactionButtons.forEach(button => {
      button.onclick = async () => {
        const key = button.dataset.reflectionReaction;
        const reactions = await Data.getQtReactions();

        if (reactions[key]) {
          delete reactions[key];
        } else {
          reactions[key] = { created_at: new Date().toISOString() };
        }

        await Data.saveQtReactions(reactions);
        await renderFeedPage();
      };
    });

    const plantButton = document.querySelector('[data-plant-detail]');
    if (plantButton) {
      plantButton.onclick = async () => openQtGrowthSheet();
    }
  }

  async function renderFeedPage() {
    const items = (await Data.getQtReflections()).filter(item => item.content && item.content.trim()).slice().reverse();
    const reactions = await Data.getQtReactions();

    document.getElementById('app').innerHTML = `
      <div class="qt-shell">
        <div class="qt-topbar">
          <div style="width:30px;"></div>
          <div class="qt-topbar-title">QT</div>
          <div style="width:30px;"></div>
        </div>
        <div class="qt-main-tabs">
          <button class="qt-tab ${window.appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
          <button class="qt-tab ${window.appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
        </div>
        <div class="feed-section-title">오늘의 묵상 <span>☀️</span></div>
        <div class="feed-list">
          ${items.length === 0
            ? '<div class="dp-note">아직 나눠진 묵상이 없어요. 오늘의 QT를 완료하고 첫 한마디를 남겨보세요.</div>'
            : items.map(item => {
              const graceCount = Object.keys(reactions).filter(key => key.startsWith(`${item.id}:grace`)).length;
              const prayCount = Object.keys(reactions).filter(key => key.startsWith(`${item.id}:pray`)).length;
              const hasGrace = Boolean(reactions[`${item.id}:grace`]);
              const hasPray = Boolean(reactions[`${item.id}:pray`]);
              return `
                <div class="feed-card">
                  <div class="feed-top">
                    <div class="feed-avatar">${(item.user || '나').slice(0, 1)}</div>
                    <div class="feed-meta">
                      <div class="feed-name">${window.escapeHtml(item.user || '나')}</div>
                      <div class="feed-date">${item.date || '오늘'}</div>
                    </div>
                  </div>
                  <div class="feed-content">${window.escapeHtml(item.content)}</div>
                  <div class="feed-actions">
                    <button class="feed-action ${hasGrace ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:grace">🙏 은혜받았어요 ${graceCount}</button>
                    <button class="feed-action ${hasPray ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:pray">🤍 함께 기도해요 ${prayCount}</button>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      </div>
      ${window.renderBottomNav()}
    `;

    window.bindGlobalNavigation();
    bindQtEvents();
  }

  async function openQtGrowthSheet() {
    const records = await Data.getQtRecords();
    const summary = Core.getQtSummary(records);
    const total = summary.total;
    const stage = Core.getQtPlantStage(total);
    const progress = Core.getQtProgress(total);

    const html = `
      <button type="button" class="sheet-close" data-sheet-close aria-label="닫기">✕</button>
      <div style="text-align:center; padding:8px 0 4px;">
        <div style="font-size:44px; line-height:1;">${stage.icon}</div>
      </div>
      <div class="sheet-title" style="text-align:center;">${stage.name}</div>
      <div class="sheet-sub" style="text-align:center;">말씀과 함께 자라고 있어요</div>
      <div style="display:grid; gap:8px; margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--sky-tint); border-radius:12px; font-size:13px;"><span>현재 연속</span><strong>${summary.currentStreak}일</strong></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--sky-tint); border-radius:12px; font-size:13px;"><span>최장 연속</span><strong>${summary.longestStreak}일</strong></div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--sky-tint); border-radius:12px; font-size:13px;"><span>함께한 날</span><strong>${total}일</strong></div>
      </div>
      <div style="margin-top:18px; font-size:13px; color:var(--slate);">다음 성장까지 ${progress.remaining || 0}번</div>
    `;

    if (window.openSheet) {
      window.openSheet(html);
    }
  }

  async function renderQtPage() {
    const records = await Data.getQtRecords();
    const reflections = await Data.getQtReflections();
    const summary = Core.getQtSummary(records);
    const total = summary.total;
    const stage = Core.getQtPlantStage(total);
    const completionSet = new Set(records.map(item => item.date));
    const monthDate = new Date(window.appState.qtMonth);
    const monthDays = Core.getQtDaysForMonth(monthDate);
    const todayKey = Core.formatDateKey(new Date());
    const calState = ensureCalendarState();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

    const htmlDays = monthDays.map(date => {
      const key = Core.formatDateKey(date);
      const isCurrentMonth = date.getMonth() === monthDate.getMonth();
      const isToday = key === todayKey;
      const isFuture = date > new Date(todayKey + 'T00:00:00');
      const isClickable = !isFuture;
      const done = completionSet.has(key);
      const isRevealedOrOpen = calState.revealed === key || calState.open === key;

      const classNames = ['calendar-day'];
      if (!isCurrentMonth) classNames.push('muted');
      if (isToday) classNames.push('today');
      if (done) classNames.push('completed');
      if (isClickable) classNames.push('clickable');

      let inner;
      if (done && !isRevealedOrOpen && !isToday) {
        inner = '<span class="day-circle">🌿</span>';
      } else {
        inner = `<span class="day-circle">${date.getDate()}</span>`;
      }

      const attrs = [];
      if (isClickable) attrs.push(`data-calendar-day="${key}"`);
      const disabled = isFuture ? 'pointer-events:none; opacity:0.7;' : '';

      return `<div class="${classNames.join(' ')}" style="${disabled}" ${attrs.join(' ')}>${inner}</div>`;
    }).join('');

    const isDoneToday = completionSet.has(todayKey);

    document.getElementById('app').innerHTML = `
      <div class="qt-shell">
        <div class="qt-topbar">
          <div style="width:30px;"></div>
          <div class="qt-topbar-title">QT</div>
          <div style="width:30px;"></div>
        </div>

        <div class="qt-main-tabs">
          <button class="qt-tab ${window.appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
          <button class="qt-tab ${window.appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
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

        <div class="detail-panel" id="detailPanel"></div>
      </div>
      ${window.renderBottomNav()}
    `;

    window.bindGlobalNavigation();
    bindQtEvents();
    renderDetailPanel(todayKey, isDoneToday, records, reflections);
    bindQtEvents();
  }

  window.QT.Render = {
    ensureCalendarState,
    getActiveQtDateKey,
    renderDetailPanel,
    bindQtEvents,
    renderFeedPage,
    openQtGrowthSheet,
    renderQtPage
  };

  window.renderQtPage = renderQtPage;
  window.renderFeedPage = renderFeedPage;
  window.getQtRecords = Data.getQtRecords;
  window.getQtReflections = Data.getQtReflections;
  window.getQtSummary = (records) => Core.getQtSummary(records || Data.getQtRecordsLocal());
})();
