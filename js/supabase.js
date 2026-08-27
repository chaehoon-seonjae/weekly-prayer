// Supabase 클라이언트 단일 생성. URL/Key는 이 파일에만 둔다. (Publishable key — 클라이언트 노출 허용)
const SUPABASE_URL = 'https://jjubqeqqtvjvxlbnnuyt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vKXSP4T6JYQrZmSpdbf-zg_6msfRmgJ';

if (!window.supabase) {
  throw new Error('supabase-js가 로드되지 않았습니다. index.html의 CDN <script>를 확인해 주세요.');
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
