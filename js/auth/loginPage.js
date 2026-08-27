import { escapeHtml, setApp } from '../ui/dom.js';
import { mapAuthError } from './errors.js';
import { signInWithEmail, signUpWithEmail, signInWithKakao } from './session.js';

export function renderLoginPage(message = '', isError = true) {
  setApp(`
    <div class="qt-shell">
      <div class="auth-card">
        <div class="my-header">
          <div class="my-avatar">🌱</div>
          <div>
            <div class="my-name">QT &amp; Prayer</div>
            <div class="my-sub">로그인하고 순모임과 함께해요</div>
          </div>
        </div>
        <div class="field-row">
          <input id="authEmail" type="email" placeholder="이메일" autocomplete="email" />
          <input id="authPassword" type="password" placeholder="비밀번호" autocomplete="current-password" />
          <button type="button" data-auth="login">로그인</button>
          <button type="button" data-auth="signup" style="background:linear-gradient(180deg,#d9efe0,#bfe7c9); color:#235436;">회원가입</button>
          <button type="button" data-auth="kakao" style="background:#FEE500; color:#191919;">카카오로 시작하기</button>
        </div>
        ${message ? `<div class="${isError ? 'error-block' : 'nudge'}">${escapeHtml(message)}</div>` : ''}
      </div>
    </div>
  `);
  bindLoginEvents();
}

function readForm() {
  return {
    email: document.getElementById('authEmail')?.value.trim() || '',
    password: document.getElementById('authPassword')?.value || '',
  };
}

function bindLoginEvents() {
  document.querySelectorAll('[data-auth]').forEach(button => {
    button.onclick = async () => {
      const action = button.dataset.auth;
      try {
        if (action === 'kakao') {
          await signInWithKakao();
          return; // 리다이렉트됨
        }
        const { email, password } = readForm();
        if (!email || !password) {
          renderLoginPage('이메일과 비밀번호를 입력해 주세요.');
          return;
        }
        if (action === 'signup') {
          const { session } = await signUpWithEmail(email, password);
          if (!session) {
            renderLoginPage('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.', false);
          }
          // session이 있으면 SIGNED_IN 이벤트가 화면을 전환한다.
          return;
        }
        await signInWithEmail(email, password);
        // 성공 시 SIGNED_IN 이벤트가 화면을 전환한다.
      } catch (error) {
        console.error(error);
        renderLoginPage(mapAuthError(error));
      }
    };
  });
}
