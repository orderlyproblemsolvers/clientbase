// stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loading: false,
  }),
  actions: {
    async login(email: string, password: string) {
      const supabase = useSupabaseClient()
      const user = useSupabaseUser() // <--- 1. Get the user composable
      
      this.loading = true
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        
        // <--- 2. THE FIX: Manually update the user state immediately
        if (data.user) {
            user.value = data.user
        }
        
        // 3. Now it is safe to redirect
        return navigateTo('/')
        
      } catch (error: any) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      const supabase = useSupabaseClient()
      const user = useSupabaseUser()
      
      await supabase.auth.signOut()
      
      // Optional: Clear user state manually on logout too for instant UI updates
      user.value = null
      
      return navigateTo('/login')
    }
  }
})