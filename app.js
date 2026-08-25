(function () {
  const MEMBERS = ['지영', '선재', '세희', '평화', '종호', '도희', '예송', '수람', '유찬'];
  const SUPABASE_URL = 'https://jjubqeqqtvjvxlbnnuyt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_vKXSP4T6JYQrZmSpdbf-zg_6msfRmgJ';
  const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

  window.appState = {
    currentView: 'qt',
    qtTab: 'my',
    currentWeek: 'w38',
    qtMonth: new Date(),
    auth: { user: null, session: null, profile: null, loginError: '' },
    weeks: [
      { id: 'w40', week_number: 40, week_date: '2026-08-23' },
      { id: 'w39', week_number: 39, week_date: '2026-08-16' },
      { id: 'w38', week_number: 38, week_date: '2026-08-09' },
      { id: 'w37', week_number: 37, week_date: '2026-08-02' },
      { id: 'w36', week_number: 36, week_date: '2026-07-26' }
    ],
    entries: { w40: {}, w39: {}, w38: {}, w37: {}, w36: {} },
    collapsedCards: {}
  };

  window.escapeHtml = function (value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  window.getDetailLines = function (item) {
    if (Array.isArray(item?.details)) {
      return item.details.map(v => String(v || '').trim()).filter(Boolean);
    }
    if (typeof item?.detail === 'string') {
      return item.detail.split(/\n+/).map(v => v.trim()).filter(Boolean);
    }
    return [];
  };

  window.currentWeekMeta = function () {
    return window.appState.weeks.find(w => w.id === window.appState.currentWeek);
  };

  window.currentEntries = function () {
    return window.appState.entries[window.appState.currentWeek] || {};
  };

  window.render = function () {
    if (window.appState.currentView === 'qt') {
      if (window.appState.qtTab === 'feed') {
        if (typeof window.renderFeedPage === 'function') {
          window.renderFeedPage();
        }
      } else if (typeof window.renderQtPage === 'function') {
        window.renderQtPage();
      }
      return;
    }

    if (window.appState.currentView === 'my') {
      if (typeof window.renderMyPage === 'function') {
        window.renderMyPage();
      }
      return;
    }

    if (typeof window.renderPrayerView === 'function') {
      window.renderPrayerView();
    }
  };

  window.renderBottomNav = function () {
    const items = [
      { key: 'qt', label: 'QT', icon: '🌱' },
      { key: 'prayer', label: '기도제목', icon: '🙏' },
      { key: 'my', label: 'MY', icon: '👤' }
    ];

    return `
      <nav class="app-nav">
        ${items.map(item => `
          <button class="${window.appState.currentView === item.key ? 'active' : ''}" data-nav="${item.key}">
            <span class="icon">${item.icon}</span>
            <span>${item.label}</span>
          </button>
        `).join('')}
      </nav>
    `;
  };

  window.bindGlobalNavigation = function () {
    document.querySelectorAll('[data-nav]').forEach(button => {
      button.onclick = () => {
        const nextView = button.dataset.nav;
        window.appState.currentView = nextView;
        if (nextView === 'qt') {
          window.appState.qtTab = window.appState.qtTab || 'my';
        }
        window.render();
      };
    });
  };

  window.showToast = function (msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1800);
  };

  function defaultMeetingId() {
    const sunday = mostRecentSundayISO();
    const choices = window.appState.weeks.filter(w => w.week_date <= sunday).sort((a, b) => b.week_date.localeCompare(a.week_date));
    return (choices[0] || [...window.appState.weeks].sort((a, b) => b.week_date.localeCompare(a.week_date))[0])?.id;
  }

  function mostRecentSundayISO(base = new Date()) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() - d.getDay());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  window.defaultMeetingId = defaultMeetingId;

  function ensureSupabaseClient() {
    if (!window.supabase) return null;
    if (!window.__supabaseClient) {
      window.__supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return window.__supabaseClient;
  }

  async function loadUserProfile(userId) {
    const client = ensureSupabaseClient();
    if (!client || !userId) return null;
    const { data, error } = await client.from('profiles').select('*').eq('auth_user_id', userId).maybeSingle();
    if (error) throw error;
    window.appState.auth.profile = data || null;
    return data;
  }

  async function ensureProfileForUser(user) {
    const client = ensureSupabaseClient();
    if (!client || !user) return null;
    const nickname = user.email?.split('@')[0] || '새 친구';
    const { data, error } = await client.from('profiles').upsert({ auth_user_id: user.id, nickname, profile_image: null, created_at: new Date().toISOString() }, { onConflict: 'auth_user_id' }).select().single();
    if (error) throw error;
    window.appState.auth.profile = data;
    return data;
  }

  function renderMyPage() {
    const user = window.appState.auth.user;
    const profile = window.appState.auth.profile || {};
    const name = profile.nickname || user?.email?.split('@')[0] || '여러분';

    let content = `
      <div class="qt-shell">
        <div class="my-card">
          <div class="my-header">
            <div class="my-avatar">${name.slice(0, 1)}</div>
            <div>
              <div class="my-name">${window.escapeHtml(name)}</div>
              <div class="my-sub">${user ? '로그인 상태' : '로그인해 주세요'}</div>
            </div>
          </div>
    `;

    if (user) {
      content += `
        <div class="field-row">
          <label class="text-muted">닉네임</label>
          <input id="profileNickname" value="${window.escapeHtml(profile.nickname || '')}" placeholder="닉네임을 입력해주세요" />
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

    if (window.appState.auth.loginError) {
      content += `<div class="error-block">${window.escapeHtml(window.appState.auth.loginError)}</div>`;
    }

    content += `</div></div>${window.renderBottomNav()}`;
    document.getElementById('app').innerHTML = content;
    window.bindGlobalNavigation();
    bindMyEvents();
  }

  function bindMyEvents() {
    const authSubmitButtons = document.querySelectorAll('[data-auth-submit]');
    authSubmitButtons.forEach(button => {
      button.onclick = async () => {
        const action = button.dataset.authSubmit;
        const email = document.getElementById('authEmail')?.value.trim();
        const password = document.getElementById('authPassword')?.value;
        if (!email || !password) {
          window.appState.auth.loginError = '이메일과 비밀번호를 입력해주세요.';
          window.renderMyPage();
          return;
        }

        window.appState.auth.loginError = '';
        try {
          const client = ensureSupabaseClient();
          if (!client) {
            window.appState.auth.loginError = 'Supabase 연결 정보가 없어서 로그인할 수 없습니다.';
            window.renderMyPage();
            return;
          }

          if (action === 'signup') {
            const { data, error } = await client.auth.signUp({ email, password });
            if (error) throw error;
            window.appState.auth.user = data.user;
            window.appState.auth.session = data.session;
            await ensureProfileForUser(data.user);
            window.appState.currentView = 'qt';
            window.render();
            window.showToast('회원가입 완료! QT를 시작해볼까요?');
          } else {
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.appState.auth.user = data.user;
            window.appState.auth.session = data.session;
            await loadUserProfile(data.user.id);
            window.appState.currentView = 'qt';
            window.render();
            window.showToast('로그인 되었습니다.');
          }
        } catch (error) {
          console.error(error);
          window.appState.auth.loginError = error.message || '로그인 중 문제가 발생했습니다.';
          window.renderMyPage();
        }
      };
    });

    const logoutButton = document.querySelector('[data-logout]');
    if (logoutButton) {
      logoutButton.onclick = async () => {
        const client = ensureSupabaseClient();
        if (client) await client.auth.signOut();
        window.appState.auth.user = null;
        window.appState.auth.session = null;
        window.appState.auth.profile = null;
        window.appState.currentView = 'my';
        window.render();
        window.showToast('로그아웃 되었습니다.');
      };
    }

    const updateProfileButton = document.querySelector('[data-update-profile]');
    if (updateProfileButton) {
      updateProfileButton.onclick = async () => {
        const nickname = document.getElementById('profileNickname')?.value.trim();
        if (!nickname) {
          window.showToast('닉네임을 입력해주세요.');
          return;
        }
        const client = ensureSupabaseClient();
        if (!client || !window.appState.auth.user) {
          window.showToast('로그인 상태에서만 닉네임 수정이 가능합니다.');
          return;
        }
        try {
          const { error } = await client.from('profiles').upsert({ auth_user_id: window.appState.auth.user.id, nickname, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' });
          if (error) throw error;
          window.appState.auth.profile = { ...window.appState.auth.profile, nickname };
          window.renderMyPage();
          window.showToast('닉네임이 수정되었어요.');
        } catch (error) {
          window.showToast(error.message || '닉네임 수정에 실패했어요.');
        }
      };
    }
  }

  window.renderMyPage = renderMyPage;
  window.bindMyEvents = bindMyEvents;
  window.ensureSupabaseClient = ensureSupabaseClient;
  window.loadUserProfile = loadUserProfile;
  window.ensureProfileForUser = ensureProfileForUser;

  function initApp() {
    const app = document.getElementById('app');
    if (!app) return;
    window.appState.currentWeek = defaultMeetingId();
    window.render();
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
