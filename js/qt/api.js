import { supabase } from '../supabase.js';

// RLS(qt_records_select_self)가 본인 행만 돌려주므로 클라이언트 필터가 필요 없다.
export async function loadMyQtRecords() {
  const { data, error } = await supabase
    .from('qt_records')
    .select('id, qt_date')
    .order('qt_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertQtRecord(profileId, dateKey) {
  const { data, error } = await supabase
    .from('qt_records')
    .insert({ profile_id: profileId, qt_date: dateKey })
    .select('id, qt_date')
    .single();
  if (error) throw error;
  return data;
}
