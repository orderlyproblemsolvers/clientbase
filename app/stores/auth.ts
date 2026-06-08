// stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {

  // ── State ─────────────────────────────────────────────────────────────────
  state: () => ({
    loading:        false,

    profile: {
      full_name:  '',
      role:       '',
      avatar_url: null as string | null,
    },

    profileLoading: false,
    profileFetched: false,
  }),

  // ── Getters ───────────────────────────────────────────────────────────────
  getters: {
    displayName(state): string {
      if (state.profile.full_name) return state.profile.full_name
      const user = useSupabaseUser()
      return user.value?.user_metadata?.full_name
          || user.value?.email
          || 'User'
    },

    displayRole(state): string {
      return state.profile.role || 'Team Member'
    },

    displayInitial(): string {
      return this.displayName.charAt(0).toUpperCase() || 'U'
    },
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {

    // Called by the plugin — never called from a component or layout
    async fetchProfile(userId: string) {
      if (this.profileLoading) return
      if (this.profileFetched) return

      this.profileLoading = true

      try {
        const supabase = useSupabaseClient()

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_url')
          .eq('id', userId)
          .single()

        if (error) throw error

        if (data) {
          this.profile = {
            full_name:  data.full_name  || '',
            role:       data.role       || 'Team Member',
            avatar_url: data.avatar_url || null,
          }
          this.profileFetched = true
        }
      } catch (e: any) {
        console.error('[auth] Profile fetch failed:', e.message)
        // Don't set profileFetched = true — the plugin will retry on next
        // SIGNED_IN / TOKEN_REFRESHED event if the session is still valid.
      } finally {
        this.profileLoading = false
      }
    },

    // Called by Settings page after saving
    setProfile(data: Partial<typeof this.profile>) {
      this.profile = { ...this.profile, ...data }
    },

    // Called by plugin on SIGNED_OUT
    resetProfile() {
      this.profile        = { full_name: '', role: '', avatar_url: null }
      this.profileFetched = false
      this.profileLoading = false
    },

    // ── Login ──────────────────────────────────────────────────────────────
    async login(email: string, password: string) {
      const supabase = useSupabaseClient()
      const user     = useSupabaseUser()

      this.loading = true

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        // Wait for the reactive user ref to populate before navigating.
        // The plugin's onAuthStateChange will fetch the profile in parallel.
        if (!user.value) {
          await new Promise<void>((resolve) => {
            const stop = watch(user, (val) => {
              if (val) { stop(); resolve() }
            })
          })
        }

        return navigateTo('/')
      } catch (err: any) {
        throw err
      } finally {
        this.loading = false
      }
    },

    // ── Logout ─────────────────────────────────────────────────────────────
    async logout() {
      const supabase = useSupabaseClient()
      this.resetProfile()
      await supabase.auth.signOut()
      return navigateTo('/login')
    },
  },
})