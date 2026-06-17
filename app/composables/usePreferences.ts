// composables/usePreferences.ts
export const usePreferences = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const prefs = ref<Record<string, any>>({})

  const fetchPreferences = async () => {
    if (!user.value?.sub) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.value.sub)
        .single()
      if (error) throw error
      prefs.value = data?.preferences || {}
    } catch (e) {
      console.error('[preferences] Fetch failed:', e)
    }
  }

  const savePreferences = async (newPrefs?: Record<string, any>) => {
    if (!user.value?.sub) return
    const merged = newPrefs ? { ...prefs.value, ...newPrefs } : prefs.value
    try {
      await supabase
        .from('profiles')
        .update({ preferences: merged, updated_at: new Date().toISOString() })
        .eq('id', user.value.sub)
      prefs.value = merged
    } catch (e) {
      console.error('[preferences] Save failed:', e)
    }
  }

  const setPreference = async (key: string, value: any) => {
    prefs.value = { ...prefs.value, [key]: value }
    await savePreferences()
  }

  // Initial fetch if user is already loaded
  if (process.client && user.value?.id) {
    fetchPreferences()
  }

  // Re-fetch on login
  watch(() => user.value?.id, (newId) => {
    if (newId) fetchPreferences()
    else prefs.value = {}
  })

  return {
    prefs: readonly(prefs),
    fetchPreferences,
    savePreferences,
    setPreference,
  }
}