// stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
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
        
        // IMPORTANT: Do NOT manually set user.value
        // Let Supabase's reactive system handle it naturally
        // This ensures all watchers trigger correctly
        
        // Wait a moment for Supabase to update its internal state
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Now it is safe to redirect
        return navigateTo('/')
        
      } catch (error: any) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      const supabase = useSupabaseClient()
      
      // Get the profile reset function BEFORE logout
      const { reset: resetProfile } = useUserProfile()
      
      // Reset profile immediately (this clears the old avatar)
      resetProfile()
      
      // Now sign out
      await supabase.auth.signOut()
      
      // Give it a moment for the auth system to update
      await new Promise(resolve => setTimeout(resolve, 50))
      
      return navigateTo('/login')
    }
  }
})