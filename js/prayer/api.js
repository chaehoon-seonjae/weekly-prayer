import { supabase } from '../supabase.js';

export async function loadMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, meeting_date, meeting_number')
    .order('meeting_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadPrayers() {
  const { data, error } = await supabase
    .from('prayers')
    .select('id, meeting_id, profile_id, member_id, items, prayed_count, updated_at');
  if (error) throw error;
  return data;
}

// 새 기도제목. unique(meeting_id, profile_id)는 003에서 생기므로 upsert 대신 insert.
// member_id는 옛 프론트 호환용(legacy_member_id, 없으면 null).
export async function insertPrayer({ meetingId, profileId, legacyMemberId, items }) {
  const { data, error } = await supabase
    .from('prayers')
    .insert({
      meeting_id: meetingId,
      profile_id: profileId,
      member_id: legacyMemberId ?? null,
      items,
      prayed_count: 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePrayerItems(prayerId, items) {
  const { data, error } = await supabase
    .from('prayers')
    .update({ items, updated_at: new Date().toISOString() })
    .eq('id', prayerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePrayer(prayerId) {
  const { error } = await supabase.from('prayers').delete().eq('id', prayerId);
  if (error) throw error;
}

// "기도했어요": 타인 행의 prayed_count를 올리는 유일한 경로(security definer RPC). 새 값을 반환한다.
export async function incrementPrayed(prayerId) {
  const { data, error } = await supabase.rpc('increment_prayed', { p_prayer_id: prayerId });
  if (error) throw error;
  return data;
}
