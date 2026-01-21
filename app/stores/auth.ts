// stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,
    loading: false,
  }),
  actions: {
    async login(email: string, password: string) {
      const supabase = useSupabaseClient()
      this.loading = true
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        
        // Supabase auto-updates the user state, so we just redirect
        return navigateTo('/')
      } catch (error: any) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      const supabase = useSupabaseClient()
      await supabase.auth.signOut()
      return navigateTo('/login')
    }
  }
})