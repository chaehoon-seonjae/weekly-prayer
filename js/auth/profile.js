import { supabase } from '../supabase.js';
import { appState, renderShell } from '../state.js';
import { escapeHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { signOut } from './session.js';

export async function loadProfile(authUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('nickname', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateNickname(profileId, nickname) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ nickname, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function renderMyPage() {
  const { user, profile } = appState.auth;
  const name = profile?.nickname || '여러분';
  const avatar = profile?.profile_image
    ? `<img src="${escapeHtml(profile.profile_image)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />`
    : `<div class="my-avatar">${escapeHtml(name.slice(0, 1))}</div>`;
  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '정보 없음';

  renderShell(`
    <div class="qt-shell">
      <div class="my-card">
        <div class="my-header">
          ${avatar}
          <div>
            <div class="my-name">${escapeHtml(name)}</div>
            <div class="my-sub">${escapeHtml(user?.email || '카카오 계정')}</div>
          </div>
        </div>
        <div class="field-row">
          <label class="text-muted" for="profileNickname">닉네임</label>
          <input id="profileNickname" value="${escapeHtml(profile?.nickname || '')}" maxlength="20" placeholder="닉네임을 입력해 주세요" />
          <button type="button" data-update-profile>닉네임 수정</button>
        </div>
        <div class="text-muted" style="margin-top:14px;">가입일: ${joined}</div>
        <button type="button" class="logout-btn" data-logout>로그아웃</button>
      </div>
    </div>
  `);
  bindMyEvents();
}

function bindMyEvents() {
  const updateButton = document.querySelector('[data-update-profile]');
  if (updateButton) {
    updateButton.onclick = async () => {
      const nickname = document.getElementById('profileNickname')?.value.trim();
      if (!nickname) {
        showToast('닉네임을 입력해 주세요.');
        return;
      }
      try {
        appState.auth.profile = await updateNickname(appState.auth.profile.id, nickname);
        renderMyPage();
        showToast('닉네임이 수정되었어요.');
      } catch (error) {
        console.error(error);
        showToast('닉네임 수정에 실패했어요.');
      }
    };
  }

  const logoutButton = document.querySelector('[data-logout]');
  if (logoutButton) {
    logoutButton.onclick = async () => {
      try {
        await signOut();
        // 화면 전환은 SIGNED_OUT 이벤트(main.js)가 담당
        showToast('로그아웃 되었어요.');
      } catch (error) {
        console.error(error);
        showToast('로그아웃에 실패했어요.');
      }
    };
  }
}
