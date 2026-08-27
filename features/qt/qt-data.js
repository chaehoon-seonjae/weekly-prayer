(function () {
  window.QT = window.QT || {};

  const FALLBACK_SUPABASE_URL = 'https://jjubqeqqtvjvxlbnnuyt.supabase.co';
  const FALLBACK_SUPABASE_KEY = 'sb_publishable_vKXSP4T6JYQrZmSpdbf-zg_6msfRmgJ';

  function readLocalStorageData(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) ?? fallback;
    } catch (error) {
      console.error(error);
      return fallback;
    }
  }

  function writeLocalStorageData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSupabaseClient() {
    if (!window.supabase) return null;
    if (!window.__qtSupabaseClient) {
      window.__qtSupabaseClient = window.supabase.createClient(FALLBACK_SUPABASE_URL, FALLBACK_SUPABASE_KEY);
    }
    return window.__qtSupabaseClient;
  }

  async function getCurrentProfile() {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return null;

    const existingProfile = window.appState?.auth?.profile;
    if (existingProfile && existingProfile.auth_user_id === user.id) {
      return existingProfile;
    }

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      const { data: created, error: insertError } = await client
        .from('profiles')
        .insert({
          auth_user_id: user.id,
          nickname: user.email?.split('@')[0] || '사용자',
          profile_image: null
        })
        .select()
        .single();

      if (insertError) throw insertError;
      window.appState.auth.profile = created;
      return created;
    }

    window.appState.auth.profile = data;
    return data;
  }

  function getQtRecordsLocal() {
    return readLocalStorageData('weekly-prayer-qt-records', []);
  }

  function getQtReflectionsLocal() {
    return readLocalStorageData('weekly-prayer-qt-reflections', []);
  }

  function getQtReactionsLocal() {
    return readLocalStorageData('weekly-prayer-qt-reactions', {});
  }

  async function getQtRecords() {
    const client = getSupabaseClient();
    const profile = await getCurrentProfile();
    if (!client || !profile) return getQtRecordsLocal();

    const { data, error } = await client
      .from('qt_records')
      .select('*')
      .eq('user_id', profile.id)
      .order('qt_date', { ascending: true });

    if (error) throw error;
    return (data || []).map(item => ({ id: item.id, date: item.qt_date, created_at: item.created_at }));
  }

  async function saveQtRecords(records) {
    const client = getSupabaseClient();
    const profile = await getCurrentProfile();
    writeLocalStorageData('weekly-prayer-qt-records', records);

    if (!client || !profile) return;

    const rows = records.map(item => ({
      user_id: profile.id,
      qt_date: item.date || item.qt_date
    }));

    if (!rows.length) return;

    const { error } = await client
      .from('qt_records')
      .upsert(rows, { onConflict: 'user_id,qt_date' });

    if (error) throw error;
  }

  async function getQtReflections() {
    const client = getSupabaseClient();
    const profile = await getCurrentProfile();
    if (!client || !profile) return getQtReflectionsLocal();

    const { data, error } = await client
      .from('qt_reflections')
      .select('id, content, created_at, user_id, qt_record_id, qt_records(qt_date)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      date: item.qt_records?.qt_date || item.date,
      content: item.content || '',
      created_at: item.created_at,
      user: 'me'
    }));
  }

  async function saveQtReflections(list) {
    const client = getSupabaseClient();
    const profile = await getCurrentProfile();
    writeLocalStorageData('weekly-prayer-qt-reflections', list);

    if (!client || !profile) return;

    const rows = [];
    for (const item of list) {
      const dateKey = item.date || item.qt_date;
      if (!dateKey) continue;

      let qtRecord = null;
      const { data: recordData, error: recordError } = await client
        .from('qt_records')
        .select('id')
        .eq('user_id', profile.id)
        .eq('qt_date', dateKey)
        .maybeSingle();

      if (recordError) throw recordError;

      if (recordData) {
        qtRecord = recordData;
      } else {
        const { data: inserted, error: insertError } = await client
          .from('qt_records')
          .upsert({ user_id: profile.id, qt_date: dateKey }, { onConflict: 'user_id,qt_date' })
          .select()
          .single();

        if (insertError) throw insertError;
        qtRecord = inserted;
      }

      rows.push({
        qt_record_id: qtRecord.id,
        user_id: profile.id,
        content: item.content || '',
        updated_at: new Date().toISOString()
      });
    }

    if (!rows.length) return;

    const { error } = await client
      .from('qt_reflections')
      .upsert(rows, { onConflict: 'qt_record_id' });

    if (error) throw error;
  }

  async function getQtReactions() {
    const client = getSupabaseClient();
    const profile = await getCurrentProfile();
    if (!client || !profile) return getQtReactionsLocal();

    const { data, error } = await client
      .from('reflection_reactions')
      .select('*')
      .eq('user_id', profile.id);

    if (error) throw error;

    return (data || []).reduce((acc, item) => {
      acc[`${item.reflection_id}:${item.reaction_type}`] = { created_at: item.created_at };
      return acc;
    }, {});
  }

  async function saveQtReactions(data) {
    const client = getSupabaseClient();
    const profile = await getCurrentProfile();
    writeLocalStorageData('weekly-prayer-qt-reactions', data);

    if (!client || !profile) return;

    const entries = Object.entries(data || {});
    if (!entries.length) return;

    for (const [reactionKey, value] of entries) {
      const [reflectionId, reactionType] = reactionKey.split(':');
      if (!reflectionId || !reactionType) continue;

      const { data: current, error: findError } = await client
        .from('reflection_reactions')
        .select('id')
        .eq('reflection_id', reflectionId)
        .eq('user_id', profile.id)
        .eq('reaction_type', reactionType)
        .maybeSingle();

      if (findError) throw findError;

      if (value && !current) {
        const { error } = await client
          .from('reflection_reactions')
          .insert({ reflection_id: reflectionId, user_id: profile.id, reaction_type: reactionType });
        if (error) throw error;
      }

      if (!value && current) {
        const { error } = await client
          .from('reflection_reactions')
          .delete()
          .eq('id', current.id);
        if (error) throw error;
      }
    }
  }

  window.QT.Data = {
    FALLBACK_SUPABASE_URL,
    FALLBACK_SUPABASE_KEY,
    getSupabaseClient,
    getCurrentProfile,
    getQtRecordsLocal,
    getQtReflectionsLocal,
    getQtReactionsLocal,
    getQtRecords,
    saveQtRecords,
    getQtReflections,
    saveQtReflections,
    getQtReactions,
    saveQtReactions
  };
})();
