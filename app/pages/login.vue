<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const email = ref('')
const password = ref('')
const errorMsg = ref('')

// New State for Password Visibility
const showPassword = ref(false)

const handleLogin = async () => {
  errorMsg.value = '' 
  
  try {
    await auth.login(email.value, password.value)
  } catch (e: any) {
    errorMsg.value = e.message || 'Login failed.'
  }
}
</script>

<template>
  <div class="space-y-8">
    
    <div class="text-center">
      <h1 class="text-3xl font-bold text-white mb-2 tracking-tight">Welcome Back</h1>
      <p class="text-gray-400 text-sm">Sign in to access Client Base</p>
    </div>

    <form @submit.prevent="handleLogin" class="space-y-5">
      
      <div>
        <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Email</label>
        <div class="relative">
          <input 
            v-model="email"
            type="email" 
            required
            class="w-full bg-secondary border border-white/10 rounded-lg pl-4 pr-10 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            placeholder="admin@ops.com"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
              <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
            </svg>
          </span>
        </div>
      </div>

      <div>
        <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Password</label>
        <div class="relative">
          <input 
            v-model="password"
            :type="showPassword ? 'text' : 'password'" 
            required
            class="w-full bg-secondary border border-white/10 rounded-lg pl-4 pr-10 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            placeholder="••••••••"
          />
          <button 
            type="button"
            @click="showPassword = !showPassword"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors focus:outline-none"
          >
            <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745A10.029 10.029 0 0018 10c0-4.458-3.693-8.544-8-8.544-2.363 0-4.43.95-6.07 2.476L3.28 2.22zm4.183 4.183a6.83 6.83 0 00-2.35 4.965c.536 2.515 2.503 4.417 4.887 4.417 1.343 0 2.576-.615 3.45-1.57l-6-6zM8 10a2 2 0 102.828 2.828l-2.828-2.828z" clip-rule="evenodd" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="errorMsg" class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
        {{ errorMsg }}
      </div>

      <button 
        type="submit" 
        :disabled="auth.loading"
        class="w-full bg-primary hover:bg-[#3d34d9] text-white font-semibold py-3 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="auth.loading" class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Signing in...
        </span>
        <span v-else>Sign In</span>
      </button>
    </form>

    <div class="text-center space-y-3">
      <div>
        <a href="#" class="text-sm text-gray-500 hover:text-white transition-colors">
          Forgot your password?
        </a>
      </div>
      <div class="text-sm text-gray-500">
        Don't have an account? 
        <NuxtLink to="/signup" class="text-primary font-bold hover:text-white transition-colors">
          Sign up
        </NuxtLink>
      </div>
    </div>
    
  </div>
</template>