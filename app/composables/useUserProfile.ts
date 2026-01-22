// composables/useUserProfile.ts
export const useUserProfile = () => {
  // We use useState to share this data across pages/components
  const profile = useState('user-profile', () => ({
    full_name: '',
    role: '',
    avatar_url: null as string | null,
    fetched: false,
    loading: false,
    error: null as string | null
  }))

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  // 🔥 NEW: Reset function to clear profile state
  const reset = () => {
    profile.value = {
      full_name: '',
      role: '',
      avatar_url: null,
      fetched: false,
      loading: false,
      error: null
    }
  }

  // Helper to fetch data from DB
  const fetch = async () => {
    if (!user.value) {
      reset() // Reset if no user
      return
    }

    profile.value.loading = true
    profile.value.error = null

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', user.value.id)
        .single()

      if (error) throw error

      if (data) {
        profile.value = {
          full_name: data.full_name || '',
          role: data.role || 'Team Member',
          avatar_url: data.avatar_url,
          fetched: true,
          loading: false,
          error: null
        }
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      profile.value = {
        ...profile.value,
        fetched: true, // Mark as fetched even on error to prevent infinite retries
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile'
      }
    }
  }

  // Refresh method - forces a fresh fetch
  const refresh = async () => {
    // Reset fetched flag to force re-fetch
    profile.value.fetched = false
    await fetch()
  }

  // Helper to update state manually (used by Settings page)
  const setProfile = (data: Partial<typeof profile.value>) => {
    profile.value = { ...profile.value, ...data }
  }

  // Watch for user changes and auto-fetch
  watch(user, (newUser, oldUser) => {
    console.log('User changed:', {
      oldId: oldUser?.id?.substring(0, 8),
      newId: newUser?.id?.substring(0, 8),
      fetched: profile.value.fetched
    })
    
    // 🔥 KEY FIX: Reset profile when user ID changes
    if (newUser?.id !== oldUser?.id) {
      if (newUser) {
        // User logged in or switched - reset and fetch fresh
        reset()
        fetch()
      } else {
        // User logged out - reset only
        reset()
      }
    } else if (!newUser && oldUser) {
      // User logged out (both null now)
      reset()
    }
  }, { immediate: true })

  // Optional: Add computed properties for convenience
  const isAuthenticated = computed(() => !!user.value)
  const hasProfile = computed(() => profile.value.fetched && !!profile.value.full_name)
  const isLoading = computed(() => profile.value.loading)

  return { 
    profile, 
    fetch, 
    refresh, 
    reset, // 🔥 Export reset function
    setProfile,
    isAuthenticated,
    hasProfile,
    isLoading
  }
}