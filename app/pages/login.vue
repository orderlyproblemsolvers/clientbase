<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const showPassword = ref(false)

const handleLogin = async () => {
  errorMsg.value = ''
  try {
    await auth.login(email.value, password.value)
  } catch (e: any) {
    errorMsg.value = e.message || 'Invalid email or password.'
  }
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto space-y-6">
    <!-- Heading -->
    <div class="text-center">
      <h1 class="text-2xl font-bold text-white">Welcome back</h1>
      <p class="text-sm text-slate-400 mt-1">Sign in to your ClientBase account</p>
    </div>

    <!-- Form card -->
    <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 md:p-8">
      <form @submit.prevent="handleLogin" class="space-y-5">

        <!-- Email -->
        <div class="space-y-1.5">
          <label for="login-email" class="text-xs font-semibold text-slate-400">Email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            placeholder="you@company.com"
            required
            class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150"
          />
        </div>

        <!-- Password -->
        <div class="space-y-1.5">
          <label for="login-password" class="text-xs font-semibold text-slate-400">Password</label>
          <div class="relative">
            <input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              required
              class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              aria-label="Toggle password visibility"
            >
              <UIcon
                :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                class="w-5 h-5"
              />
            </button>
          </div>
        </div>

        <!-- Error message -->
        <div
          v-if="errorMsg"
          class="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-sm text-red-400 text-center"
        >
          {{ errorMsg }}
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="auth.loading"
          class="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
        >
          <UIcon v-if="auth.loading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          <span>{{ auth.loading ? 'Signing in…' : 'Sign In' }}</span>
        </button>
      </form>
    </div>

    <!-- Footer links -->
    <div class="text-center space-y-3">
      <NuxtLink to="/forgot-password" class="text-sm text-slate-500 hover:text-white transition-colors">
        Forgot your password?
      </NuxtLink>
      <p class="text-sm text-slate-500">
        Don't have an account?
        <NuxtLink to="/signup" class="text-primary font-semibold hover:text-primary/80 transition-colors ml-1">
          Sign up
        </NuxtLink>
      </p>
    </div>
  </div>
</template>