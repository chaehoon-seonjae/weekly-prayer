import { supabase } from '../supabase.js';

// 인증 상태 변화의 단일 진입점. INITIAL_SESSION(구독 직후) / SIGNED_IN / SIGNED_OUT 등이 들어온다.
export function onAuthStateChange(handler) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // 콜백 안에서 동기적으로 supabase를 호출하면 교착될 수 있어 다음 틱으로 미룬다.
    setTimeout(() => handler(event, session), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithKakao() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
