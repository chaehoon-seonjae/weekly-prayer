import { appState, resetState, registerPage, render, renderShell } from './state.js';
import { renderLoading, renderConnectionError, renderProfilePending } from './ui/screens.js';
import { onAuthStateChange } from './auth/session.js';
import { loadProfile, loadProfiles, renderMyPage } from './auth/profile.js';
import { renderLoginPage } from './auth/loginPage.js';
import { todayKey } from './util/date.js';
import { loadMeetings, loadPrayers } from './prayer/api.js';
import { defaultMeetingId } from './prayer/meeting.js';
import { renderPrayerPage } from './prayer/page.js';
import { renderQtView } from './qt/page.js';
import { loadMyQtRecords } from './qt/api.js';
import { loadMyReflections } from './reflection/api.js';

registerPage('qt', renderQtView);
registerPage('prayer', renderPrayerPage);
registerPage('my', renderMyPage);

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
    // bootstrap — 공용 데이터 1회 로드
    const [profiles, meetings, prayers, qtRecords, myReflections] = await Promise.all([
      loadProfiles(), loadMeetings(), loadPrayers(), loadMyQtRecords(), loadMyReflections(profile.id),
    ]);
    appState.prayer.profiles = profiles;
    appState.prayer.meetings = meetings;
    appState.prayer.prayers = prayers;
    appState.prayer.currentMeetingId = defaultMeetingId(meetings, todayKey());
    appState.qt.records = qtRecords;
    appState.qt.myReflections = myReflections;
    appState.view = 'qt';
    render();
  } catch (error) {
    console.error(error);
    appState.auth.user = null; // 재진입 가드를 풀어 다음 SIGNED_IN에서 다시 시도할 수 있게 한다
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
