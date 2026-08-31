const MESSAGES = [
  ['Invalid login credentials', '이메일 또는 비밀번호가 올바르지 않아요'],
  ['User already registered', '이미 가입된 이메일이에요'],
  ['Email not confirmed', '이메일 인증을 완료해 주세요'],
];

export function mapAuthError(error) {
  const raw = typeof error === 'string' ? error : error?.message || '';
  const hit = MESSAGES.find(([en]) => raw.includes(en));
  if (hit) return hit[1];
  return raw || '로그인 중 문제가 발생했어요';
}
