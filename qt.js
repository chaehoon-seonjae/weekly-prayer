(function () {
  function getQtRecords() {
    try {
      const raw = localStorage.getItem('weekly-prayer-qt-records');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function saveQtRecords(records) {
    localStorage.setItem('weekly-prayer-qt-records', JSON.stringify(records));
  }

  function getQtReflections() {
    try {
      const raw = localStorage.getItem('weekly-prayer-qt-reflections');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function saveQtReflections(list) {
    localStorage.setItem('weekly-prayer-qt-reflections', JSON.stringify(list));
  }

  function getQtReactions() {
    try {
      const raw = localStorage.getItem('weekly-prayer-qt-reactions');
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  function saveQtReactions(data) {
    localStorage.setItem('weekly-prayer-qt-reactions', JSON.stringify(data));
  }

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getDateFromKey(dateKey) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function getCurrentStreak(records) {
    const unique = [...new Set(records.map(r => r.date))].sort();
    const set = new Set(unique);
    let cursor = new Date();
    let streak = 0;
    while (set.has(formatDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function getLongestStreak(records) {
    const unique = [...new Set(records.map(r => r.date))].sort();
    if (!unique.length) return 0;
    let longest = 1;
    let run = 1;
    for (let i = 1; i < unique.length; i += 1) {
      const prev = getDateFromKey(unique[i - 1]);
      const curr = getDateFromKey(unique[i]);
      const diff = Math.round((curr - prev) / 86400000);
      if (diff === 1) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 1;
      }
    }
    return longest;
  }

  function getQtProgress(total) {
    const thresholds = [
      { max: 6, stage: '씨앗', next: 7 },
      { max: 19, stage: '새싹', next: 20 },
      { max: 49, stage: '어린 식물', next: 50 },
      { max: 99, stage: '작은 나무', next: 100 },
      { max: 199, stage: '나무', next: 200 },
      { max: Infinity, stage: '풍성한 나무', next: null }
    ];

    for (let i = 0; i < thresholds.length; i += 1) {
      const item = thresholds[i];
      if (total <= item.max) {
        const previous = i === 0 ? 0 : thresholds[i - 1].max + 1;
        const currentRangeMin = previous;
        const currentRangeMax = item.max;
        const remaining = item.next ? Math.max(0, item.next - total) : 0;
        return {
          currentStage: item.stage,
          stageIndex: i,
          currentRangeMin,
          currentRangeMax,
          currentRangeLabel: `${currentRangeMin} ~ ${currentRangeMax}회`,
          remaining,
          progress: item.next ? Math.min(100, Math.max(0, (total - currentRangeMin) / (item.next - currentRangeMin) * 100)) : 100,
          nextStage: item.next ? `다음 단계까지 ${remaining}번` : '최고 단계예요'
        };
      }
    }

    return { currentStage: '풍성한 나무', stageIndex: 5, currentRangeMin: 200, currentRangeMax: Infinity, currentRangeLabel: '200회 이상', remaining: 0, progress: 100, nextStage: '최고 단계예요' };
  }

  function getQtPlantStage(total) {
    if (total >= 200) return { name: '풍성한 나무', icon: '🌳', range: '200회 이상' };
    if (total >= 100) return { name: '나무', icon: '🌿', range: '100 ~ 199회' };
    if (total >= 50) return { name: '작은 나무', icon: '🌱', range: '50 ~ 99회' };
    if (total >= 20) return { name: '어린 식물', icon: '🌿', range: '20 ~ 49회' };
    if (total >= 7) return { name: '새싹', icon: '🌱', range: '7 ~ 19회' };
    return { name: '씨앗', icon: '🌱', range: '0 ~ 6회' };
  }

  function getQtDaysForMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(start.getDate() - ((first.getDay() + 6) % 7));
    const rows = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i += 1) {
      rows.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return rows;
  }

  function getQtSummary() {
    const records = getQtRecords();
    const unique = [...new Set(records.map(r => r.date))];
    return {
      total: unique.length,
      currentStreak: getCurrentStreak(records),
      longestStreak: getLongestStreak(records),
      doneToday: unique.includes(formatDateKey(new Date()))
    };
  }

  function renderFeedPage() {
    const items = getQtReflections().filter(item => item.content && item.content.trim()).slice().reverse();
    const reactions = getQtReactions();

    document.getElementById('app').innerHTML = `
      <div class="qt-shell">
        <div class="qt-header">
          <div class="qt-main-tabs">
            <button class="qt-tab ${window.appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
            <button class="qt-tab ${window.appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
          </div>
          <div class="qt-hero" style="margin-top:14px;">
            <div class="qt-hero-title">오늘의 묵상 <strong>☀️</strong></div>
            <div class="qt-plant-badge">🌤️</div>
          </div>
        </div>
        <div class="feed-list">
          ${items.length === 0
            ? '<div class="qt-card"><div class="qt-side-note">아직 나눠진 묵상이 없어요. 오늘의 QT를 완료하고 첫 한마디를 남겨보세요.</div></div>'
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

  function openQtGrowthSheet() {
    const summary = getQtSummary();
    const total = summary.total;
    const stage = getQtPlantStage(total);
    const progress = getQtProgress(total);
    const html = `
      <div class="sheet-title">${stage.name}</div>
      <div class="sheet-sub">말씀과 함께 자라고 있어요</div>
      <div style="text-align:center; padding:12px 0 18px; font-size:52px;">${stage.icon}</div>
      <div style="display:grid; gap:12px; margin-top:8px;">
        <div style="display:flex; justify-content:space-between; padding:10px 12px; background:#f5f9ff; border-radius:12px;"><span>현재 연속</span><strong>${summary.currentStreak}일</strong></div>
        <div style="display:flex; justify-content:space-between; padding:10px 12px; background:#f5f9ff; border-radius:12px;"><span>최장 연속</span><strong>${summary.longestStreak}일</strong></div>
        <div style="display:flex; justify-content:space-between; padding:10px 12px; background:#f5f9ff; border-radius:12px;"><span>함께한 날</span><strong>${total}일</strong></div>
      </div>
      <div style="margin-top:18px; padding-top:18px; border-top:1px solid #edf1f5;">
        <div style="font-size:13px; color:#5c6b7a; margin-bottom:8px;">다음 성장까지 ${progress.remaining || 0}번</div>
        <div style="height:10px; background:#edf3f8; border-radius:999px; overflow:hidden;">
          <div style="height:100%; width:${Math.min(100, progress.progress)}%; background:linear-gradient(90deg,#9dd6b3,#7ab8d9); border-radius:999px;"></div>
        </div>
        <div style="margin-top:10px; text-align:center; font-size:13px; color:#5c6b7a;">${stage.icon} → ${progress.currentStage}</div>
      </div>
    `;
    window.openSheet ? window.openSheet(html) : null;
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
        window.render();
      };
    });

    const completeButton = document.querySelector('[data-qt-complete]');
    if (completeButton) {
      completeButton.onclick = () => {
        const today = formatDateKey(new Date());
        const records = getQtRecords();
        if (records.some(r => r.date === today)) {
          window.showToast('오늘 QT는 이미 완료했어요.');
          return;
        }
        records.push({ date: today, created_at: new Date().toISOString() });
        saveQtRecords(records);

        const refList = getQtReflections();
        const exists = refList.some(item => item.date === today);
        if (!exists) {
          refList.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date: today, content: '', created_at: new Date().toISOString(), user: 'me' });
          saveQtReflections(refList);
        }

        window.showToast('✓ 오늘 QT를 완료했어요');
        window.render();
      };
    }

    const reflectionSaveButton = document.querySelector('[data-qt-save-reflection]');
    if (reflectionSaveButton) {
      reflectionSaveButton.onclick = () => {
        const input = document.getElementById('qtReflectionInput');
        if (!input) return;
        const value = input.value.trim();
        const today = formatDateKey(new Date());
        const list = getQtReflections();
        const existingIndex = list.findIndex(item => item.date === today);
        if (existingIndex >= 0) {
          list[existingIndex].content = value;
        } else {
          list.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date: today, content: value, created_at: new Date().toISOString(), user: 'me' });
        }
        saveQtReflections(list);
        if (!value) {
          window.showToast('묵상을 한 줄 남겨주세요.');
          return;
        }
        window.showToast('묵상을 저장했어요.');
      };
    }

    const reactionButtons = document.querySelectorAll('[data-reflection-reaction]');
    reactionButtons.forEach(button => {
      button.onclick = () => {
        const key = button.dataset.reflectionReaction;
        const reactions = getQtReactions();
        if (reactions[key]) {
          delete reactions[key];
        } else {
          reactions[key] = { created_at: new Date().toISOString() };
        }
        saveQtReactions(reactions);
        renderFeedPage();
      };
    });

    const plantButton = document.querySelector('[data-plant-detail]');
    if (plantButton) {
      plantButton.onclick = () => openQtGrowthSheet();
    }
  }

  function renderQtPage() {
    const summary = getQtSummary();
    const total = summary.total;
    const stage = getQtPlantStage(total);
    const records = getQtRecords();
    const completionSet = new Set(records.map(item => item.date));
    const monthDate = new Date(window.appState.qtMonth);
    const monthDays = getQtDaysForMonth(monthDate);
    const todayKey = formatDateKey(new Date());

    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const htmlDays = monthDays.map(date => {
      const key = formatDateKey(date);
      const isCurrentMonth = date.getMonth() === monthDate.getMonth();
      const isToday = key === todayKey;
      const isFuture = date > new Date(todayKey + 'T00:00:00');
      const done = completionSet.has(key);
      const classNames = ['calendar-day'];
      if (!isCurrentMonth) classNames.push('muted');
      if (isToday) classNames.push('today');
      if (done) classNames.push('completed');
      const body = done
        ? '<span class="day-mark">🌿</span>'
        : `<span class="day-number">${date.getDate()}</span>`;
      const disabled = isFuture ? 'pointer-events:none; opacity:0.7;' : '';
      return `<div class="${classNames.join(' ')}" style="${disabled}">${body}</div>`;
    }).join('');

    const isDoneToday = completionSet.has(todayKey);
    const reflectionText = getQtReflections().find(item => item.date === todayKey)?.content || '';
    const reflectionVisible = isDoneToday ? 'visible' : '';

    document.getElementById('app').innerHTML = `
      <div class="qt-shell">
        <div class="qt-header">
          <div class="qt-main-tabs">
            <button class="qt-tab ${window.appState.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
            <button class="qt-tab ${window.appState.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
          </div>
          <div class="qt-hero">
            <div class="qt-hero-title">말씀과 함께한 날 <strong>${total}일</strong></div>
            <button type="button" class="qt-plant-badge" data-plant-detail style="border:none; cursor:pointer;">${stage.icon}</button>
          </div>
        </div>

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

        <div class="qt-card">
          <div class="qt-card-title">오늘의 QT</div>
          ${isDoneToday ? `
            <button class="qt-check-btn done" type="button" disabled>✓ 오늘 QT를 완료했어요</button>
            <div class="qt-side-note">오늘도 말씀과 함께했어요.</div>
          ` : `
            <button class="qt-check-btn" type="button" data-qt-complete>☀️ 오늘 QT 완료 체크</button>
            <div class="qt-side-note">오늘도 말씀과 함께해볼까요?</div>
          `}
          <div class="qt-reflection-box ${reflectionVisible}">
            <div style="font-weight:800; margin-bottom:10px;">오늘의 묵상</div>
            <textarea id="qtReflectionInput" placeholder="오늘 말씀을 통해 받은 마음이 있나요?">${window.escapeHtml(reflectionText)}</textarea>
            <button type="button" data-qt-save-reflection>묵상 나누기</button>
          </div>
        </div>
      </div>
      ${window.renderBottomNav()}
    `;

    window.bindGlobalNavigation();
    bindQtEvents();
  }

  window.renderQtPage = renderQtPage;
  window.renderFeedPage = renderFeedPage;
  window.getQtRecords = getQtRecords;
  window.getQtReflections = getQtReflections;
  window.getQtSummary = getQtSummary;
})();
