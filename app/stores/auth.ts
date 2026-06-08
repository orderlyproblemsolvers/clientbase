import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
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

  getters: {
    displayName(state): string {
      if (state.profile.full_name) return state.profile.full_name
      const user = useSupabaseUser()
      return user.value?.user_metadata?.full_name || user.value?.email || 'User'
    },
    displayRole(state): string {
      return state.profile.role || 'Team Member'
    },
    displayInitial(): string {
      return this.displayName.charAt(0).toUpperCase() || 'U'
    },
  },

  actions: {
    // supabase is now passed in — no composable calls inside the action
    async fetchProfile(supabase: ReturnType<typeof useSupabaseClient>, userId: string) {
      if (this.profileLoading) return
      if (this.profileFetched) return

      this.profileLoading = true
      try {
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
      } finally {
        this.profileLoading = false
      }
    },

    setProfile(data: Partial<typeof this.profile>) {
      this.profile = { ...this.profile, ...data }
    },

    resetProfile() {
      this.profile        = { full_name: '', role: '', avatar_url: null }
      this.profileFetched = false
      this.profileLoading = false
    },

    async login(email: string, password: string) {
      const supabase = useSupabaseClient()
      const user     = useSupabaseUser()
      this.loading   = true

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        if (!user.value) {
          await new Promise<void>((resolve) => {
            const stop = watch(user, (val) => { if (val) { stop(); resolve() } })
          })
        }
        return navigateTo('/')
      } catch (err: any) {
        throw err
      } finally {
        this.loading = false
      }
    },

    async logout() {
      const supabase = useSupabaseClient()
      this.resetProfile()
      await supabase.auth.signOut()
      return navigateTo('/login')
    },
  },
})