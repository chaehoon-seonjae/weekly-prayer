import { appState, resetState, registerPage, render, renderShell } from './state.js';
import { renderLoading, renderConnectionError, renderProfilePending } from './ui/screens.js';
import { onAuthStateChange } from './auth/session.js';
import { loadProfile, loadProfiles } from './auth/profile.js';
import { renderLoginPage } from './auth/loginPage.js';

// Phase 1 자리표시자. Phase 2(prayer)·3(qt)·Task 8(my)에서 실제 화면으로 교체한다.
function placeholderPage(title) {
  return () => renderShell(`
    <div class="qt-shell">
      <div class="qt-card">
        <div class="qt-card-title">${title}</div>
        <div class="qt-side-note">준비 중이에요.</div>
      </div>
    </div>
  `);
}

registerPage('qt', placeholderPage('QT'));
registerPage('prayer', placeholderPage('기도제목'));
registerPage('my', placeholderPage('MY'));

// 로그인 직후 1회: 프로필 확인 → bootstrap(공용 데이터 로드) → 첫 화면
async function onSignedIn(session) {
  // INITIAL_SESSION과 SIGNED_IN이 연달아 오거나 탭 포커스 복귀 시 SIGNED_IN이 다시 오므로,
  // 같은 사용자면 재진입하지 않는다. user는 await 전에 동기적으로 설정해 경쟁을 막는다.
  if (appState.auth.user?.id === session.user.id) return;
  appState.auth.user = session.user;
  try {
    const profile = await loadProfile(session.user.id);
    if (!profile) {
      renderProfilePending();
      return;
    }
    appState.auth.profile = profile;
    // bootstrap — Phase 2·3에서 meetings / prayers / qt_records 로드를 여기에 추가한다.
    appState.prayer.profiles = await loadProfiles();
    appState.view = 'qt';
    render();
  } catch (error) {
    console.error(error);
    renderConnectionError(error.message || '알 수 없는 오류');
  }
}

function onSignedOut() {
  resetState();
  renderLoginPage();
}

function init() {
  renderLoading();
  onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      if (session) onSignedIn(session);
      else renderLoginPage();
    } else if (event === 'SIGNED_OUT') {
      onSignedOut();
    }
    // TOKEN_REFRESHED, USER_UPDATED 등은 무시
  });
}

init();
