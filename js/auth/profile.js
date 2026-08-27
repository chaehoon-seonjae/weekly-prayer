import { supabase } from '../supabase.js';

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
