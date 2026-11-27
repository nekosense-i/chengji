 const teacherPreferenceKeys = new Set([
  'gk2_display_defaults_v1','gk2_diagnostic_view','gk2_entry_mode_default_v1','gk2_entry_quickfill_default_v1'
 ]);
 const isTeacherPreference = (storage,key)=>storage===nativeLocal && !!window.gk2TeacherWorkspaceId && teacherPreferenceKeys.has(key);
 const teacherPrefix = prefix+'teacher-preferences:'+window.gk2TeacherWorkspaceId+':';
 const preferenceKey = (storage,key)=> (isTeacherPreference(storage,key) ? teacherPrefix : prefix)+key;
 const pendingKey = teacherPrefix+'pending';
 const pendingPreferences = ()=>JSON.parse(nativeLocal.getItem(pendingKey)||'{}');
 function writePreference(storage,key,value) {
  storage.setItem(preferenceKey(storage,key),String(value));
  if (!isTeacherPreference(storage,key)) return;
  const pending = {...pendingPreferences(),[key]:String(value)};
  nativeLocal.setItem(pendingKey,JSON.stringify(pending));
  window.dispatchEvent(new Event('gk2-teacher-preference-changed'));
 }
 if (window.gk2TeacherWorkspaceId) window.gk2TeacherPreferenceStorage = {
  pending:pendingPreferences,
  accept(sent,values) {
   const pending=pendingPreferences();
   for (const [key,value] of Object.entries(sent)) if (pending[key]===value) delete pending[key];
   for (const [key,value] of Object.entries(values)) {
    if (teacherPreferenceKeys.has(key) && !Object.hasOwn(pending,key)) nativeLocal.setItem(teacherPrefix+key,value);
   }
   nativeLocal.setItem(pendingKey,JSON.stringify(pending));
  }
 };
