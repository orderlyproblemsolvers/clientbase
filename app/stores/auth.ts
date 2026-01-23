// stores/auth.ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loading: false,
  }),
  actions: {
    async login(email: string, password: string) {
      const supabase = useSupabaseClient()
      const user = useSupabaseUser()
      
      this.loading = true
      
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
        
        // --- THE CLEANER FIX ---
        // Instead of forcing the value, we politely wait for 
        // Nuxt's reactivity system to catch up with Supabase.
        
        if (!user.value) {
          await new Promise<void>((resolve) => {
            const unwatch = watch(user, (val) => {
              if (val) {
                unwatch() // Stop watching once we have the user
                resolve()
              }
            })
          })
        }
        
        // Now we know for a fact the Middleware will pass
        return navigateTo('/')
        
      } catch (error: any) {
        throw error
      } finally {
        this.loading = false
      }
    },

    async logout() {
      const supabase = useSupabaseClient()
      const { reset: resetProfile } = useUserProfile()
      
      resetProfile()
      await supabase.auth.signOut()
      return navigateTo('/login')
    }
  }
})