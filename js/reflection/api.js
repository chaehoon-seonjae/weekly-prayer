import { supabase } from '../supabase.js';

// reflections SELECT는 전원 허용이므로 내 것만 보려면 명시적으로 profile_id 필터가 필요하다.
export async function loadMyReflections(profileId) {
  const { data, error } = await supabase
    .from('reflections')
    .select('id, reflection_date, content')
    .eq('profile_id', profileId)
    .order('reflection_date', { ascending: true });
  if (error) throw error;
  return data;
}

// INSERT는 RLS가 "본인 + 당일 qt_records 존재"를 강제한다(001 reflections_insert_self_after_qt).
export async function insertReflection(profileId, dateKey, content) {
  const { data, error } = await supabase
    .from('reflections')
    .insert({ profile_id: profileId, reflection_date: dateKey, content })
    .select('id, reflection_date, content')
    .single();
  if (error) throw error;
  return data;
}

export async function updateReflection(reflectionId, content) {
  const { data, error } = await supabase
    .from('reflections')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', reflectionId)
    .select('id, reflection_date, content')
    .single();
  if (error) throw error;
  return data;
}

// DELETE는 RLS가 본인 것만 허용하고(001 reflections_delete_self), 반응은 FK cascade로 함께 삭제된다.
export async function deleteReflection(reflectionId) {
  const { error } = await supabase
    .from('reflections')
    .delete()
    .eq('id', reflectionId);
  if (error) throw error;
}

// 전체 사용자 피드: 작성자 닉네임·프로필 이미지와 반응 행을 임베딩으로 함께 가져온다.
export async function loadFeed() {
  const { data, error } = await supabase
    .from('reflections')
    .select('id, profile_id, reflection_date, content, created_at, profiles(nickname, profile_image), reflection_reactions(profile_id, reaction_type)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addReaction(reflectionId, profileId, type) {
  const { error } = await supabase
    .from('reflection_reactions')
    .insert({ reflection_id: reflectionId, profile_id: profileId, reaction_type: type });
  if (error) throw error;
}

export async function removeReaction(reflectionId, profileId, type) {
  const { error } = await supabase
    .from('reflection_reactions')
    .delete()
    .eq('reflection_id', reflectionId)
    .eq('profile_id', profileId)
    .eq('reaction_type', type);
  if (error) throw error;
}
