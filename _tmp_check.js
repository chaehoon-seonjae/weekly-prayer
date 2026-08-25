
/* ============ 데이터 연결 설정 ============ */
const SUPABASE_URL = "https://jjubqeqqtvjvxlbnnuyt.supabase.co"; // 여기에 Project URL
const SUPABASE_KEY = "sb_publishable_vKXSP4T6JYQrZmSpdbf-zg_6msfRmgJ"; // 여기에 Publishable key
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

/* ============ 로컬 미연결 상태용 기본 구조 (기도제목 데모 데이터 없음) ============ */
const MEMBERS = ["지영","선재","세희","평화","종호","도희","예송","수람","유찬"];
const STORAGE_KEY = "prayer_app_state_v5";

function seedData(){
  const weeks = [
    { id:"w40", week_number:40, week_date:"2026-08-23" },
    { id:"w39", week_number:39, week_date:"2026-08-16" },
    { id:"w38", week_number:38, week_date:"2026-08-09" },
    { id:"w37", week_number:37, week_date:"2026-08-02" },
    { id:"w36", week_number:36, week_date:"2026-07-26" },
  ];
  const entries = {
    w40: {},
    w39: {},
    w38: {},
    w37: {},
    w36: {},
  };
  return { weeks, entries, currentWeek:"w38" };
}

function loadState(){
  // Prayer data must come from Supabase only. Do not restore demo prayer entries from LocalStorage.
  return seedData();
}
function saveState(){
  // UI state is intentionally not persisted as prayer data. Supabase is the source of truth.
}
let state = loadState();
state.currentView = state.currentView || "qt";
state.qtTab = state.qtTab || "my";
state.currentWeek = defaultMeetingId?.() || state.currentWeek;
state.qtMonth = state.qtMonth || new Date();
state.auth = state.auth || { user:null, session:null, profile:null, loginError:"" };
let collapsedCards = {}; // name -> bool
let editingMember = null; // 작성/수정 대상

/* ============ 렌더링 ============ */
const app = document.getElementById("app");

function currentWeekMeta(){ return state.weeks.find(w=>w.id===state.currentWeek); }
function currentEntries(){ return state.entries[state.currentWeek] || {}; }
function writtenCount(){ return Object.keys(currentEntries()).length; }
function isPastWeek(){
  const meta = currentWeekMeta();
  if(!meta) return false;
  return meta.week_date < mostRecentSundayISO();
}
function isFutureWeek(){
  const meta = currentWeekMeta();
  if(!meta) return false;
  return meta.week_date > mostRecentSundayISO();
}
function isLatestMeeting(){
  const meta = currentWeekMeta();
  if(!meta) return false;
  const sorted = sortedWeeksAsc();
  return meta.id === sorted[sorted.length - 1]?.id;
}
function fmtDate(d){
  const [y,m,day] = d.split("-");
  return `${y}.${m}.${day}`;
}

function shortDate(d){
  const [,m,day] = d.split("-");
  return `${m}/${day}`;
}
function mostRecentSundayISO(base=new Date()){
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() - d.getDay());
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function defaultMeetingId(){
  const sunday = mostRecentSundayISO();
  const candidates = [...state.weeks].filter(w=>w.week_date<=sunday).sort((a,b)=>b.week_date.localeCompare(a.week_date));
  return (candidates[0] || [...state.weeks].sort((a,b)=>b.week_date.localeCompare(a.week_date))[0])?.id;
}
function isCurrentMeeting(){ return state.currentWeek === defaultMeetingId(); }
function sortedWeeksAsc(){ return [...state.weeks].sort((a,b)=>a.week_date.localeCompare(b.week_date)); }
function adjacentMeeting(direction){
  const arr=sortedWeeksAsc(); const idx=arr.findIndex(w=>w.id===state.currentWeek);
  return arr[idx+direction] || null;
}

function render() {
  if (state.currentView === "qt") {
    if (state.qtTab === "feed") {
      renderFeedPage();
      return;
    }
    renderQtPage();
    return;
  }
  if (state.currentView === "my") {
    renderMyPage();
    return;
  }
  renderPrayerView();
}

function renderPrayerView(){
  const meta = currentWeekMeta();
  const entries = currentEntries();
  const names = Object.keys(entries);
  const total = MEMBERS.length;
  const done = names.length;
  const allDone = done === total;
  const unwritten = MEMBERS.filter(m=>!entries[m]);

  let dotsHtml = "";
  for(let i=0;i<total;i++){ dotsHtml += `<span class="dot ${i<done?'filled':''}"></span>`; }

  const headerHtml = `
    <div class="week-header">
      <div class="eyebrow">${isLatestMeeting() ? "마지막 순모임" : isFutureWeek() ? "다음 순모임" : isPastWeek() ? "지난 순모임" : "이번 주 순모임"}</div>
      <h1 class="mono">${meta.week_number}번째 순모임</h1>
      <div class="date mono">${fmtDate(meta.week_date)}</div>
      <div class="progress-row">
        <div class="dots">${dotsHtml}</div>
        <div class="progress-text mono">${done} / ${total} 작성 완료</div>
      </div>
      ${allDone ? `<div class="complete-banner">☀️ 이번 주 기도제목이 모두 모였어요</div>` : ``}
    </div>
  `;

  const prev = adjacentMeeting(-1);
  const next = adjacentMeeting(1);
  const stripHtml = `
    <div class="meeting-nav">
      <div class="nav-side ${prev?'':'disabled'}" id="prevMeeting" data-direction="-1">
        <span class="nav-arrow">‹</span>
        <span class="nav-date">${prev ? shortDate(prev.week_date) : ''}</span>
      </div>
      <div class="nav-center">
        <div class="label">${isCurrentMeeting() ? '이번 순모임' : isLatestMeeting() ? '마지막 순모임' : isFutureWeek() ? '다음 순모임' : '지난 순모임'}</div>
        <div class="date">${shortDate(meta.week_date)}</div>
        <div class="line"></div>
      </div>
      <div class="nav-side next ${next?'':'disabled'}" id="nextMeeting" data-direction="1">
        <span class="nav-date">${next ? shortDate(next.week_date) : ''}</span>
        <span class="nav-arrow">›</span>
      </div>
    </div>
  `;

  let ctaHtml = "";
  if(!isPastWeek()){
    ctaHtml = allDone
      ? `<button class="cta-btn" disabled>✓ 이번 주 기도제목 작성 완료</button>`
      : `<button class="cta-btn" id="btnWrite">＋ 이번 주 기도제목 나누기</button>`;
    if(!allDone && unwritten.length>0){
      ctaHtml += `<div class="nudge">아직 <b>${unwritten.length}명</b>이 기도제목을 준비 중이에요. 천천히 나눠주셔도 괜찮아요 🌤️</div>`;
    }
  }

  let cardsHtml = "";
  if(done===0){
    cardsHtml = `
      <div class="empty-card">
        <div class="sun-icon">🌤️</div>
        <div>아직 아무도 기도제목을 나누지 않았어요.<br/>가장 먼저 나눠보는 건 어떨까요?</div>
      </div>`;
  } else {
    cardsHtml = `<div class="cards">` + names.map(name=>{
      const e = entries[name];
      const collapsed = collapsedCards[name] !== false && e.items.length > 3;
      const hasPrayedBefore = !!localStorage.getItem(`prayed:${state.currentWeek}:${name}`);
      return `
        <div class="card ${collapsed?'collapsed':''}" data-name="${name}">
          <div class="card-top">
            <div class="card-name">${name}</div>
            ${!isPastWeek() ? `<button class="kebab" data-edit="${name}">⋯</button>` : ``}
          </div>
          <div class="item-list">
            ${e.items.map((it,i)=>`
              <div class="item">
                <div class="item-title" data-idx="${i+1}">${escapeHtml(it.title)}</div>
                ${getDetailLines(it).map(detail=>`<div class="item-detail">${escapeHtml(detail)}</div>`).join("")}
              </div>
            `).join("")}
          </div>
          ${e.items.length>3 ? `<span class="more-toggle" data-toggle="${name}">${collapsed?'더보기':'접기'}</span>` : ``}
          <div class="card-bottom">
            <button class="pray-btn ${hasPrayedBefore ? 'done' : ''}" data-pray="${name}">
              <span class="glow"></span>
              🙏 ${hasPrayedBefore ? '함께 기도했어요' : '기도했어요'} <span class="count mono">· ${e.prayed}</span>
            </button>
          </div>
        </div>
      `;
    }).join("") + `</div>`;
  }

  const copyBarHtml = !isPastWeek() ? `
    <div class="copy-bar">
      <div class="copy-bar-inner">
        <button class="copy-btn ${allDone?'ready':''}" id="btnCopyAll">
          ${allDone ? "전체 기도제목 복사" : `지금까지 작성된 ${done}명 기도제목 복사`}
        </button>
      </div>
    </div>
  ` : "";

  app.innerHTML = headerHtml + stripHtml + (USE_SUPABASE ? `` : `<div class="nudge"><b>데모 모드</b> · Supabase URL과 Publishable key를 넣으면 공용 DB 모드로 전환됩니다.</div>`) + ctaHtml + cardsHtml + copyBarHtml + renderBottomNav();
  bindGlobalNavigation();
  bindHomeEvents();
}

function renderBottomNav(){
  const items = [
    { key: "qt", label: "QT", icon: "🌱" },
    { key: "prayer", label: "기도제목", icon: "🙏" },
    { key: "my", label: "MY", icon: "👤" }
  ];
  return `
    <nav class="app-nav">
      ${items.map(item => `
        <button class="${state.currentView === item.key ? 'active' : ''}" data-nav="${item.key}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function getQtRecords(){
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

function saveQtRecords(records){
  localStorage.setItem('weekly-prayer-qt-records', JSON.stringify(records));
}

function getQtReflections(){
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

function saveQtReflections(list){
  localStorage.setItem('weekly-prayer-qt-reflections', JSON.stringify(list));
}

function getQtReactions(){
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

function saveQtReactions(data){
  localStorage.setItem('weekly-prayer-qt-reactions', JSON.stringify(data));
}

function formatDateKey(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateFromKey(dateKey){
  const [y, m, d] = String(dateKey).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getCurrentStreak(records){
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

function getLongestStreak(records){
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

function getQtProgress(total){
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

function getQtDayMap(){
  const map = {};
  getQtRecords().forEach(item => { map[item.date] = item; });
  return map;
}

function getQtSummary(){
  const records = getQtRecords();
  const unique = [...new Set(records.map(r => r.date))];
  return {
    total: unique.length,
    currentStreak: getCurrentStreak(records),
    longestStreak: getLongestStreak(records),
    doneToday: unique.includes(formatDateKey(new Date()))
  };
}

function formatMonthLabel(date){
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getQtDaysForMonth(date){
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - ((first.getDay() + 6) % 7));
  const rows = [];
  const cursor = new Date(start);
  for (let i = 0; i < 42; i++) {
    rows.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function getQtCompletionSet(){
  return new Set(getQtRecords().map(item => item.date));
}

function isQtDoneOn(dateKey){
  return getQtCompletionSet().has(dateKey);
}

function getCurrentQtSummary(){
  const records = getQtRecords();
  const today = formatDateKey(new Date());
  const total = records.length;
  const doneToday = records.some(item => item.date === today);
  return { total, doneToday };
}

function getPlantStage(total) {
  if (total >= 200) return { name: '풍성한 나무', icon: '🌳', range: '200회 이상' };
  if (total >= 100) return { name: '나무', icon: '🌿', range: '100 ~ 199회' };
  if (total >= 50) return { name: '작은 나무', icon: '🌱', range: '50 ~ 99회' };
  if (total >= 20) return { name: '어린 식물', icon: '🌿', range: '20 ~ 49회' };
  if (total >= 7) return { name: '새싹', icon: '🌱', range: '7 ~ 19회' };
  return { name: '씨앗', icon: '🌱', range: '0 ~ 6회' };
}

function renderQtPage(){
  const summary = getQtSummary();
  const total = summary.total;
  const stage = getQtPlantStage(total);
  const records = getQtRecords();
  const completionSet = new Set(records.map(item => item.date));
  const monthDate = new Date(state.qtMonth);
  const monthDays = getQtDaysForMonth(monthDate);
  const todayKey = formatDateKey(new Date());
  const plantProgress = getQtProgress(total);

  const weekdays = ['일','월','화','수','목','금','토'];
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
    if (!isCurrentMonth) classNames.push('muted');
    const body = done ? '<span style="position:relative; z-index:1;">●</span>' : (isToday ? '<span style="position:relative; z-index:1;">•</span>' : date.getDate());
    const disabled = isFuture ? 'pointer-events:none; opacity:0.7;' : '';
    return `<div class="${classNames.join(' ')}" style="${disabled}">${body}</div>`;
  }).join('');

  const isDoneToday = completionSet.has(todayKey);
  const reflectionText = getQtReflections().find(item => item.date === todayKey)?.content || '';
  const reflectionVisible = isDoneToday ? 'visible' : '';

  app.innerHTML = `
    <div class="qt-shell">
      <div class="qt-header">
        <div class="qt-main-tabs">
          <button class="qt-tab ${state.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
          <button class="qt-tab ${state.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
        </div>
        <div class="qt-hero">
          <div class="qt-hero-title">말씀과 함께한 날 <strong>${total}일</strong></div>
          <button type="button" class="qt-plant-badge" data-plant-detail style="border:none; cursor:pointer;">${stage.icon}</button>
        </div>
      </div>

      <div class="qt-calendar-card">
        <div class="calendar-header">
          <button type="button" data-month="prev">‹</button>
          <div>${formatMonthLabel(monthDate)}</div>
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
          <textarea id="qtReflectionInput" placeholder="오늘 말씀을 통해 받은 마음이 있나요?">${escapeHtml(reflectionText)}</textarea>
          <button type="button" data-qt-save-reflection>묵상 나누기</button>
        </div>
      </div>
    </div>
    ${renderBottomNav()}
  `;

  bindQtEvents();
}

function renderMyPage(){
  const user = state.auth.user;
  const profile = state.auth.profile || {};
  const name = profile.nickname || user?.email?.split('@')[0] || '여러분';

  let content = `
    <div class="qt-shell">
      <div class="my-card">
        <div class="my-header">
          <div class="my-avatar">${name.slice(0,1)}</div>
          <div>
            <div class="my-name">${escapeHtml(name)}</div>
            <div class="my-sub">${user ? '로그인 상태' : '로그인해 주세요'}</div>
          </div>
        </div>
  `;

  if (user) {
    content += `
      <div class="field-row">
        <label class="text-muted">닉네임</label>
        <input id="profileNickname" value="${escapeHtml(profile.nickname || '')}" placeholder="닉네임을 입력해주세요" />
        <button type="button" data-update-profile>닉네임 수정</button>
      </div>
      <div class="text-muted" style="margin-top:14px;">가입일: ${user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '정보 없음'}</div>
      <button type="button" class="logout-btn" data-logout>로그아웃</button>
    `;
  } else {
    content += `
      <div class="auth-card" style="margin-top:0; padding:0; background:transparent; box-shadow:none; border:none;">
        <div class="field-row">
          <input id="authEmail" type="email" placeholder="이메일" />
          <input id="authPassword" type="password" placeholder="비밀번호" />
          <button type="button" data-auth-submit="signup">회원가입</button>
          <button type="button" data-auth-submit="login" style="background:linear-gradient(180deg,#d9efe0,#bfe7c9); color:#235436;">로그인</button>
        </div>
      </div>
    `;
  }

  if (state.auth.loginError) {
    content += `<div class="error-block">${escapeHtml(state.auth.loginError)}</div>`;
  }

  content += `</div></div>${renderBottomNav()}`;
  app.innerHTML = content;
  bindGlobalNavigation();
  bindMyEvents();
}

function renderFeedPage(){
  const items = getQtReflections()
    .filter(item => item.content && item.content.trim())
    .slice()
    .reverse();

  const reactions = getQtReactions();

  app.innerHTML = `
    <div class="qt-shell">
      <div class="qt-header">
        <div class="qt-main-tabs">
          <button class="qt-tab ${state.qtTab === 'my' ? 'active' : ''}" data-qt-tab="my">나의 QT</button>
          <button class="qt-tab ${state.qtTab === 'feed' ? 'active' : ''}" data-qt-tab="feed">묵상 나눔</button>
        </div>
        <div class="qt-hero" style="margin-top:14px;">
          <div class="qt-hero-title">오늘의 묵상 <strong>☀️</strong></div>
          <div class="qt-plant-badge">🌤️</div>
        </div>
      </div>
      <div class="feed-list">
        ${items.length === 0 ? '<div class="qt-card"><div class="qt-side-note">아직 나눠진 묵상이 없어요. 오늘의 QT를 완료하고 첫 한마디를 남겨보세요.</div></div>' : items.map(item => {
          const reactionKey = `${item.id}`;
          const graceCount = Object.keys(reactions).filter(key => key.startsWith(`${item.id}:grace`)).length;
          const prayCount = Object.keys(reactions).filter(key => key.startsWith(`${item.id}:pray`)).length;
          const hasGrace = Boolean(reactions[`${item.id}:grace`]);
          const hasPray = Boolean(reactions[`${item.id}:pray`]);
          return `
            <div class="feed-card">
              <div class="feed-top">
                <div class="feed-avatar">${(item.user || '나').slice(0,1)}</div>
                <div class="feed-meta">
                  <div class="feed-name">${escapeHtml(item.user || '나')}</div>
                  <div class="feed-date">${item.date || '오늘'}</div>
                </div>
              </div>
              <div class="feed-content">${escapeHtml(item.content)}</div>
              <div class="feed-actions">
                <button class="feed-action ${hasGrace ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:grace">🙏 은혜받았어요 ${graceCount}</button>
                <button class="feed-action ${hasPray ? 'active' : ''}" type="button" data-reflection-reaction="${item.id}:pray">🤍 함께 기도해요 ${prayCount}</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ${renderBottomNav()}
  `;
  bindGlobalNavigation();
  bindQtEvents();
}

function bindGlobalNavigation(){
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.onclick = () => {
      const nextView = button.dataset.nav;
      state.currentView = nextView;
      if (nextView === 'qt') {
        state.qtTab = state.qtTab || 'my';
      }
      render();
    };
  });
}

function bindQtEvents(){
  document.querySelectorAll('[data-month]').forEach(button => {
    button.onclick = () => {
      const next = new Date(state.qtMonth);
      next.setMonth(next.getMonth() + (button.dataset.month === 'next' ? 1 : -1));
      state.qtMonth = next;
      render();
    };
  });

  document.querySelectorAll('[data-qt-tab]').forEach(button => {
    button.onclick = () => {
      state.qtTab = button.dataset.qtTab;
      state.currentView = 'qt';
      render();
    };
  });

  const completeButton = document.querySelector('[data-qt-complete]');
  if (completeButton) {
    completeButton.onclick = () => {
      const today = formatDateKey(new Date());
      const records = getQtRecords();
      if (records.some(r => r.date === today)) {
        showToast('오늘 QT는 이미 완료했어요.');
        return;
      }
      records.push({ date: today, created_at: new Date().toISOString() });
      saveQtRecords(records);
      const reflectionList = getQtReflections();
      const exists = reflectionList.some(item => item.date === today);
      if (!exists) {
        reflectionList.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date: today, content: '', created_at: new Date().toISOString(), user: 'me' });
        saveQtReflections(reflectionList);
      }
      showToast('✓ 오늘 QT를 완료했어요');
      render();
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
        showToast('묵상을 한 줄 남겨주세요.');
        return;
      }
      showToast('묵상을 저장했어요.');
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

function openQtGrowthSheet(){
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
  const sheet = openSheet(html);
  sheet.querySelector('.sheet-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function bindMyEvents(){
  const authSubmitButtons = document.querySelectorAll('[data-auth-submit]');
  authSubmitButtons.forEach(button => {
    button.onclick = async () => {
      const action = button.dataset.authSubmit;
      const email = document.getElementById('authEmail')?.value.trim();
      const password = document.getElementById('authPassword')?.value;
      if (!email || !password) {
        state.auth.loginError = '이메일과 비밀번호를 입력해주세요.';
        renderMyPage();
        return;
      }
      state.auth.loginError = '';
      try {
        const client = ensureSupabaseClient();
        if (!client) {
          state.auth.loginError = 'Supabase 연결 정보가 없어서 로그인할 수 없습니다.';
          renderMyPage();
          return;
        }
        if (action === 'signup') {
          const { data, error } = await client.auth.signUp({ email, password });
          if (error) throw error;
          state.auth.user = data.user;
          state.auth.session = data.session;
          await ensureProfileForUser(data.user);
          state.currentView = 'qt';
          render();
          showToast('회원가입 완료! QT를 시작해볼까요?');
        } else {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          state.auth.user = data.user;
          state.auth.session = data.session;
          await loadUserProfile(data.user.id);
          state.currentView = 'qt';
          render();
          showToast('로그인 되었습니다.');
        }
      } catch (error) {
        console.error(error);
        state.auth.loginError = error.message || '로그인 중 문제가 발생했습니다.';
        renderMyPage();
      }
    };
  });

  const logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      const client = ensureSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
      state.auth.user = null;
      state.auth.session = null;
      state.auth.profile = null;
      state.currentView = 'my';
      render();
      showToast('로그아웃 되었습니다.');
    };
  }

  const updateProfileButton = document.querySelector('[data-update-profile]');
  if (updateProfileButton) {
    updateProfileButton.onclick = async () => {
      const nickname = document.getElementById('profileNickname')?.value.trim();
      if (!nickname) {
        showToast('닉네임을 입력해주세요.');
        return;
      }
      const client = ensureSupabaseClient();
      if (!client || !state.auth.user) {
        showToast('로그인 상태에서만 닉네임 수정이 가능합니다.');
        return;
      }
      try {
        const { error } = await client.from('profiles').upsert({ auth_user_id: state.auth.user.id, nickname, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' });
        if (error) throw error;
        state.auth.profile = { ...state.auth.profile, nickname };
        renderMyPage();
        showToast('닉네임이 수정되었어요.');
      } catch (error) {
        showToast(error.message || '닉네임 수정에 실패했어요.');
      }
    };
  }
}

function ensureSupabaseClient(){
  if (!USE_SUPABASE || !window.supabase) return null;
  if (!window.__supabaseClient) {
    window.__supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return window.__supabaseClient;
}

async function loadUserProfile(userId){
  const client = ensureSupabaseClient();
  if (!client || !userId) return null;
  const { data, error } = await client.from('profiles').select('*').eq('auth_user_id', userId).maybeSingle();
  if (error) throw error;
  state.auth.profile = data || null;
  return data;
}

async function ensureProfileForUser(user){
  const client = ensureSupabaseClient();
  if (!client || !user) return null;
  const nickname = user.email?.split('@')[0] || '새 친구';
  const { data, error } = await client.from('profiles').upsert({
    auth_user_id: user.id,
    nickname,
    profile_image: null,
    created_at: new Date().toISOString()
  }, { onConflict: 'auth_user_id' }).select().single();
  if (error) throw error;
  state.auth.profile = data;
  return data;
}

function escapeHtml(s){
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function getDetailLines(item){
  if(Array.isArray(item?.details)){
    return item.details.map(v=>String(v||"").trim()).filter(Boolean);
  }
  if(typeof item?.detail === "string"){
    return item.detail.split(/\n+/).map(v=>v.trim()).filter(Boolean);
  }
  return [];
}

function bindHomeEvents(){
  const prevBtn = document.getElementById("prevMeeting");
  const nextBtn = document.getElementById("nextMeeting");
  document.querySelectorAll(".nav-side[data-direction]").forEach(el=>{
    if(el.classList.contains('disabled')) return;
    const direction = Number(el.dataset.direction);
    el.onclick = ()=>{
      const nextWeek = adjacentMeeting(direction);
      if(nextWeek){ state.currentWeek = nextWeek.id; render(); }
    };
  });
  const btnWrite = document.getElementById("btnWrite");
  if(btnWrite) btnWrite.onclick = ()=> openMemberSheet();

  document.querySelectorAll("[data-toggle]").forEach(el=>{
    el.onclick = ()=>{
      const name = el.dataset.toggle;
      collapsedCards[name] = !collapsedCards[name];
      render();
    };
  });

  document.querySelectorAll("[data-pray]").forEach(el=>{
    el.onclick = async ()=>{
      const name = el.dataset.pray;
      const entry = state.entries[state.currentWeek][name];
      const nextCount = (entry.prayed || 0) + 1;
      if(USE_SUPABASE && window.__db && entry.id){
        const {error} = await window.__db.from("prayers").update({prayed_count:nextCount}).eq("id", entry.id);
        if(error){ console.error(error); showToast("저장 중 오류가 발생했어요"); return; }
      }
      localStorage.setItem(`prayed:${state.currentWeek}:${name}`, "1");
      entry.prayed = nextCount;
      if(!USE_SUPABASE) saveState();
      const glow = el.querySelector(".glow");
      glow.classList.add("play");
      el.classList.add("done");
      el.innerHTML = `<span class="glow"></span> 🙏 함께 기도했어요 <span class="count mono">· ${nextCount}</span>`;
      setTimeout(()=>render(), 550);
    };
  });

  document.querySelectorAll("[data-edit]").forEach(el=>{
    el.onclick = ()=> openWriteSheet(el.dataset.edit, true);
  });

  const btnCopy = document.getElementById("btnCopyAll");
  if(btnCopy) btnCopy.onclick = ()=> openPreviewSheet();
}

/* ============ 시트(모달) 공통 ============ */
const overlay = document.getElementById("overlay");
function openSheet(html){
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.id = "activeSheet";
  sheet.innerHTML = `<div class="sheet-handle"></div>` + html;
  document.body.appendChild(sheet);
  overlay.classList.add("show");
  requestAnimationFrame(()=> sheet.classList.add("show"));
  overlay.onclick = closeSheet;
  return sheet;
}
function closeSheet(){
  const sheet = document.getElementById("activeSheet");
  overlay.classList.remove("show");
  if(sheet){ sheet.classList.remove("show"); setTimeout(()=>sheet.remove(), 250); }
}
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 1800);
}

/* ---- 작성자 선택 ---- */
function openMemberSheet(){
  const entries = currentEntries();
  const html = `
    <div class="sheet-title">누구의 기도제목을 나눌까요?</div>
    <div class="sheet-sub">이름을 선택해주세요</div>
    <div class="member-grid">
      ${MEMBERS.map(m=>{
        const done = !!entries[m];
        return `<div class="member-chip ${done?'done':''}" data-member="${m}">
          ${m}${done?'<span class="check">✓ 작성 완료</span>':''}
        </div>`;
      }).join("")}
    </div>
  `;
  const sheet = openSheet(html);
  sheet.querySelectorAll(".member-chip:not(.done)").forEach(el=>{
    el.onclick = ()=>{ closeSheet(); setTimeout(()=> openWriteSheet(el.dataset.member,false), 260); };
  });
}

/* ---- 작성/수정 폼 ---- */
let draftItems = [];
function openWriteSheet(name, isEdit){
  editingMember = name;
  const entries = currentEntries();
  const existing = entries[name];
  draftItems = existing ? JSON.parse(JSON.stringify(existing.items)).map(it=>({
    title: it.title || "",
    detail: it.detail || "",
    details: getDetailLines(it),
    showDetail: getDetailLines(it).length > 0
  })) : [{title:"",detail:"",details:[],showDetail:false}];
  renderWriteSheet(name, isEdit);
}
function renderWriteSheet(name, isEdit){
  const html = `
    <div class="sheet-title">${name}님의 기도제목</div>
    <div class="sheet-sub">${isEdit? "내용을 수정해주세요" : "한 주간 나누고 싶은 기도제목을 적어주세요"}</div>
    <div id="itemsWrap"></div>
    <button class="add-item-btn" id="btnAddItem">＋ 기도제목 추가</button>
    <div class="save-row">
      ${isEdit ? `<button class="danger-btn" id="btnDelete">삭제</button>` : ``}
      <button class="save-btn" id="btnSave">저장하기</button>
    </div>
  `;
  const sheet = openSheet(html);
  const wrap = sheet.querySelector("#itemsWrap");

  function paintItems(){
    wrap.innerHTML = draftItems.map((it,i)=>`
      <div class="prayer-item-block" data-i="${i}">
        ${draftItems.length>1 ? `<button class="remove-item" data-remove="${i}">✕</button>` : ``}
        <div class="idx">${i+1}</div>
        <textarea rows="2" placeholder="기도제목을 적어주세요" data-title="${i}">${it.title}</textarea>
        <div class="detail-list" data-detail-list="${i}">
          ${(it.details && it.details.length ? it.details : (it.detail ? [it.detail] : [""])).map((detail, di)=>`
            <div class="detail-row" data-detail-row="${di}">
              <textarea rows="2" placeholder="상세 내용" data-detail="${i}" data-detail-index="${di}">${detail}</textarea>
              <button class="detail-remove" data-remove-detail="${i}" data-detail-index="${di}">✕</button>
            </div>
          `).join("")}
        </div>
        <button class="add-detail-btn" data-add-detail="${i}">＋ 상세 내용 추가</button>
      </div>
    `).join("");

    wrap.querySelectorAll("[data-title]").forEach(t=>{
      t.oninput = ()=> draftItems[t.dataset.title].title = t.value;
    });
    wrap.querySelectorAll("[data-detail]").forEach(t=>{
      t.oninput = ()=> {
        const item = draftItems[t.dataset.detail];
        const idx = Number(t.dataset.detailIndex || 0);
        const value = t.value;
        item.details = (item.details || []);
        item.details[idx] = value;
        item.details = item.details.filter((v, i)=> i < item.details.length && (v || i === idx));
        item.detail = item.details.join("\n");
      };
    });
    wrap.querySelectorAll("[data-add-detail]").forEach(b=>{
      b.onclick = ()=>{
        const item = draftItems[b.dataset.addDetail];
        item.details = item.details || [];
        item.details.push("");
        item.showDetail = true;
        paintItems();
      };
    });
    wrap.querySelectorAll("[data-remove-detail]").forEach(b=>{
      b.onclick = ()=>{
        const item = draftItems[b.dataset.removeDetail];
        const idx = Number(b.dataset.detailIndex || 0);
        item.details = (item.details || []).filter((_, i)=> i !== idx);
        if(item.details.length === 0) item.details = [];
        item.detail = item.details.join("\n");
        paintItems();
      };
    });
    wrap.querySelectorAll("[data-remove]").forEach(b=>{
      b.onclick = ()=>{ draftItems.splice(b.dataset.remove,1); paintItems(); };
    });
  }
  paintItems();

  sheet.querySelector("#btnAddItem").onclick = ()=>{
    draftItems.push({title:"",detail:"",showDetail:false});
    paintItems();
  };

  sheet.querySelector("#btnSave").onclick = async ()=>{
    const cleaned = draftItems
      .map(it=>{
        const details = (it.details || []).map(v=>String(v||"").trim()).filter(Boolean);
        return {title:(it.title||"").trim(), detail:details.join("\n")};
      })
      .filter(it=>it.title.length>0);
    if(cleaned.length===0){ showToast("기도제목을 한 가지 이상 입력해주세요"); return; }
    const prev = currentEntries()[name];
    const prevPrayed = (prev && prev.prayed) || 0;
    let savedEntry = { items:cleaned, prayed:prevPrayed };
    if(USE_SUPABASE && window.__db){
      const member = (window.__members || []).find(m=>m.name===name);
      if(!member){ showToast("순원 정보를 찾을 수 없어요"); return; }
      const payload = { meeting_id:Number(state.currentWeek), member_id:member.id, items:cleaned, prayed_count:prevPrayed, updated_at:new Date().toISOString() };
      const {data,error} = await window.__db.from("prayers").upsert(payload,{onConflict:"meeting_id,member_id"}).select().single();
      if(error){ console.error(error); showToast("저장 중 오류가 발생했어요"); return; }
      savedEntry = {id:data.id, items:data.items||cleaned, prayed:data.prayed_count||0, member_id:data.member_id};
    }
    if(!state.entries[state.currentWeek]) state.entries[state.currentWeek] = {};
    state.entries[state.currentWeek][name] = savedEntry;
    if(!USE_SUPABASE) saveState();
    closeSheet();
    collapsedCards[name] = true;
    render();
    showToast(isEdit ? "✓ 기도제목을 수정했어요" : "✓ 기도제목을 나눴어요");
    setTimeout(()=>{
      const card = document.querySelector(`.card[data-name="${name}"]`);
      if(card){ card.classList.add("highlight"); card.scrollIntoView({behavior:"smooth", block:"center"}); setTimeout(()=>card.classList.remove("highlight"), 1600); }
    }, 100);
  };

  const delBtn = sheet.querySelector("#btnDelete");
  if(delBtn){
    delBtn.onclick = ()=>{
      closeSheet();
      setTimeout(()=> openDeleteConfirm(name), 260);
    };
  }
}

function openDeleteConfirm(name){
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
  sheet.querySelector("#btnCancel").onclick = closeSheet;
  sheet.querySelector("#btnConfirmDelete").onclick = async ()=>{
    const entry = state.entries[state.currentWeek][name];
    if(USE_SUPABASE && window.__db && entry?.id){
      const {error} = await window.__db.from("prayers").delete().eq("id", entry.id);
      if(error){ console.error(error); showToast("삭제 중 오류가 발생했어요"); return; }
    }
    delete state.entries[state.currentWeek][name];
    if(!USE_SUPABASE) saveState();
    closeSheet();
    render();
    showToast("삭제되었어요");
  };
}

/* ---- 전체 취합 미리보기 ---- */
function buildCompiledText(){
  const meta = currentWeekMeta();
  const entries = currentEntries();
  let out = `♥ 우리 순 기도제목 ♥\n${fmtDate(meta.week_date)} ${meta.week_number}번째 순모임\n`;
  MEMBERS.forEach(name=>{
    if(!entries[name]) return;
    out += `\n♥${name}\n`;
    entries[name].items.forEach((it,i)=>{
      out += `${i+1}. ${it.title}\n`;
      getDetailLines(it).forEach(detail=>{ out += `- ${detail}\n`; });
    });
  });
  return out;
}
function openPreviewSheet(){
  const text = buildCompiledText();
  const html = `
    <div class="sheet-title">전체 기도제목 미리보기</div>
    <div class="sheet-sub">카카오톡에 그대로 붙여넣을 수 있어요</div>
    <div class="preview-box">${escapeHtml(text)}</div>
    <button class="save-btn" id="btnDoCopy" style="margin-top:16px;">전체 기도제목 복사</button>
  `;
  const sheet = openSheet(html);
  sheet.querySelector("#btnDoCopy").onclick = async ()=>{
    try{
      await navigator.clipboard.writeText(text);
    }catch(e){
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    closeSheet();
    showToast("✓ 기도제목을 복사했어요");
  };
}

/* ============ Supabase 연결 (값 입력 시 자동 사용) ============ */
async function loadFromSupabase(){
  if(!USE_SUPABASE) return false;
  const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const [{data:members,error:me},{data:meetings,error:mt},{data:prayers,error:pr}] = await Promise.all([
    client.from("members").select("id,name,display_order").order("display_order"),
    client.from("meetings").select("id,meeting_date,meeting_number").order("meeting_date",{ascending:false}),
    client.from("prayers").select("id,meeting_id,member_id,items,prayed_count")
  ]);
  if(me||mt||pr){
    const err = me || mt || pr;
    console.error(err);
    throw new Error(err?.message || "Supabase 조회 중 오류가 발생했습니다.");
  }
  window.__db = client; window.__members = members;
  const memberById = Object.fromEntries(members.map(m=>[m.id,m.name]));
  state.weeks = meetings.map(m=>({id:String(m.id),week_number:m.meeting_number,week_date:m.meeting_date}));
  state.entries = {};
  state.weeks.forEach(w=>state.entries[w.id]={});
  prayers.forEach(p=>{ const name=memberById[p.member_id]; if(name && state.entries[String(p.meeting_id)]) state.entries[String(p.meeting_id)][name]={id:p.id,items:p.items||[],prayed:p.prayed_count||0,member_id:p.member_id}; });
  state.currentWeek = defaultMeetingId();
  return true;
}

function renderConnectionError(message){
  app.innerHTML = `
    <div class="week-header">
      <div class="eyebrow">연결 상태</div>
      <h1>기도제목을 불러오지 못했어요</h1>
      <div class="date" style="margin-top:8px; line-height:1.6;">${escapeHtml(message)}</div>
    </div>
    <div class="empty-card">
      <div class="sun-icon">☁️</div>
      <div>Supabase 연결 정보를 확인한 뒤 새로고침해주세요.<br/>연결이 정상화되기 전에는 데모 데이터를 표시하지 않습니다.</div>
    </div>`;
}

/* ============ 초기 로딩 상태 연출 ============ */
function renderLoading(){
  app.innerHTML = `
    <div class="week-header" style="opacity:.5"></div>
    <div class="cards" style="margin-top:20px;">
      ${[1,2,3].map(()=>`
        <div class="skeleton">
          <div class="sk-line" style="width:30%"></div>
          <div class="sk-line" style="width:90%"></div>
          <div class="sk-line" style="width:70%"></div>
        </div>
      `).join("")}
    </div>
  `;
}

renderLoading();
(async()=>{
  if(!USE_SUPABASE){
    renderConnectionError("HTML 안의 SUPABASE_URL과 SUPABASE_KEY가 비어 있습니다.");
    return;
  }
  try{
    await loadFromSupabase();
    render();
  }catch(err){
    renderConnectionError(err?.message || "Supabase 연결을 확인해주세요.");
  }
})();
