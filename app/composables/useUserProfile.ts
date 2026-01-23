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
    
    // Start by trying the reactive user object
    let userId = user.value?.id

    // If that fails (is null, undefined, or the string "undefined"), try Plan B
    if (!userId || typeof userId !== 'string' || userId === 'undefined') {
       const { data } = await supabase.auth.getSession()
       
       if (data.session?.user?.id) {
         userId = data.session.user.id
       } else {
         return
       }
    }

    // --- STANDARD GUARDS ---

    // Don't fetch if already busy
    if (profile.value.loading) return

    // Don't fetch if we already have data (remove this line if you want to force refresh)
    if (profile.value.fetched && profile.value.full_name) return

    // --- FETCH EXECUTION ---

    profile.value.loading = true

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', userId) // <--- uses the recovered userId variable
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