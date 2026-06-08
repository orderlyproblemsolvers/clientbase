export default defineNuxtPlugin(async () => {
  const supabase = useSupabaseClient()
  const auth     = useAuthStore()

  // getUser() contacts the Supabase server to validate — no cookie trust issue
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await auth.fetchProfile(supabase, user.id)

  // supabase is already captured — safe to use in this async callback
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      await auth.fetchProfile(supabase, session.user.id)
    } else if (event === 'SIGNED_OUT') {
      auth.resetProfile()
    }
  })
})