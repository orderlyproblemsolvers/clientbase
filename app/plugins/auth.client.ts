// plugins/auth.client.ts
export default defineNuxtPlugin(async () => {
  const supabase  = useSupabaseClient()
  const authStore = useAuthStore()

  // ── 1. Handle current session on page load / reload ──────────────────────
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await authStore.fetchProfile(session.user.id)
  }

  // ── 2. React to every future auth event for the lifetime of the app ──────
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // fetchProfile is guarded — won't double-fetch
        await authStore.fetchProfile(session.user.id)
      }
    } else if (event === 'SIGNED_OUT') {
      authStore.resetProfile()
    }
  })
})