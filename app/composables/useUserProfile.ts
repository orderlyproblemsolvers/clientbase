// composables/useUserProfile.ts
export const useUserProfile = () => {
  const auth = useAuthStore()

  // Expose the same shape as before so nothing breaks
  const profile = computed(() => ({
    full_name:  auth.profile.full_name,
    role:       auth.profile.role,
    avatar_url: auth.profile.avatar_url,
    loading:    auth.profileLoading,
    fetched:    auth.profileFetched,
  }))

  // `fetch` kept for any page that still calls it manually
  const fetch = async () => {
    const user     = useSupabaseUser()
    const supabase = useSupabaseClient()

    let userId = user.value?.id

    if (!userId) {
      const { data } = await supabase.auth.getSession()
      userId = data.session?.user?.id
    }

    if (userId) await auth.fetchProfile(userId)
  }

  const reset      = ()       => auth.resetProfile()
  const setProfile = (data: Parameters<typeof auth.setProfile>[0]) =>
    auth.setProfile(data)

  return { profile, fetch, reset, setProfile }
}