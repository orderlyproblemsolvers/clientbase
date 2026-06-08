export const useUserProfile = () => {
  const auth     = useAuthStore()
  const supabase = useSupabaseClient()  // captured synchronously — always safe
  const user     = useSupabaseUser()    // captured synchronously — always safe

  const profile = computed(() => ({
    full_name:  auth.profile.full_name,
    role:       auth.profile.role,
    avatar_url: auth.profile.avatar_url,
    loading:    auth.profileLoading,
    fetched:    auth.profileFetched,
  }))

  const fetch = async () => {
    let userId = user.value?.id

    if (!userId) {
      // getUser() instead of getSession() — fixes the security warning
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id
    }

    if (userId) await auth.fetchProfile(supabase, userId)
  }

  const reset      = () => auth.resetProfile()
  const setProfile = (data: Parameters<typeof auth.setProfile>[0]) =>
    auth.setProfile(data)

  return { profile, fetch, reset, setProfile }
}