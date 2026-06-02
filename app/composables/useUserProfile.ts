// composables/useUserProfile.ts
export const useUserProfile = () => {
  // Global State
  const profile = useState('user-profile', () => ({
    full_name: '',
    role: '',
    avatar_url: null as string | null,
    fetched: false,
    loading: false
  }))

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  // 1. Fetch Logic
  const fetch = async () => {
    // --- 🛡️ ID RECOVERY LOGIC 🛡️ ---
    let userId = user.value?.id

    if (!userId || typeof userId !== 'string' || userId === 'undefined') {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.id) {
        userId = data.session.user.id
      } else {
        // No session, don't attempt fetch
        return
      }
    }

    // --- GUARDS ---
    if (profile.value.loading) return
    if (profile.value.fetched && profile.value.full_name) return

    // --- SAFETY TIMEOUT (prevents infinite spinner) ---
    const SAFETY_TIMEOUT = 8000  // 8 seconds
    let timer: ReturnType<typeof setTimeout> | null = null

    profile.value.loading = true

    try {
      timer = setTimeout(() => {
        console.warn('Profile fetch timed out — resetting loading')
        profile.value.loading = false
      }, SAFETY_TIMEOUT)

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (data) {
        profile.value = {
          full_name: data.full_name || '',
          role: data.role || 'Team Member',
          avatar_url: data.avatar_url,
          fetched: true,
          loading: false
        }
      }
    } catch (e: any) {
      console.error('❌ Profile fetch failed:', e.message)
    } finally {
      if (timer) clearTimeout(timer)
      profile.value.loading = false
    }
  }

  // 2. Reset
  const reset = () => {
    profile.value = {
      full_name: '',
      role: '',
      avatar_url: null,
      fetched: false,
      loading: false
    }
  }

  // 3. Setter (for Settings page)
  const setProfile = (data: Partial<typeof profile.value>) => {
    profile.value = { ...profile.value, ...data }
  }

  return { profile, fetch, reset, setProfile }
}