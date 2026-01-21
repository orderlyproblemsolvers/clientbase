<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const client = useSupabaseClient()
const loading = ref(false)
const step = ref(1) // 1 = Credentials, 2 = Profile
const errorMsg = ref('')

// --- Form State ---
const form = ref({
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  role: 'Developer',
  phone: '',
  organization: ''
})

// --- Validation Logic ---
const passwordValid = computed(() => {
  const p = form.value.password
  // At least 8 chars + contains a number + contains a letter
  return p.length >= 8 && /\d/.test(p) && /[a-zA-Z]/.test(p)
})

const step1Valid = computed(() => {
  return form.value.email.includes('@') && 
         passwordValid.value && 
         form.value.password === form.value.confirmPassword
})

const step2Valid = computed(() => {
  return form.value.fullName.length > 2 && 
         form.value.role.length > 2 && 
         form.value.phone.length > 5
})

// --- Actions ---

const nextStep = () => {
  errorMsg.value = ''
  if (!step1Valid.value) {
    errorMsg.value = "Please check your password requirements."
    return
  }
  step.value = 2
}

const handleSignup = async () => {
  errorMsg.value = ''
  loading.value = true

  try {
    // 1. Sign Up & Send Metadata
    const { data, error } = await client.auth.signUp({
      email: form.value.email,
      password: form.value.password,
      options: {
        // This data block is what the SQL Trigger reads
        data: {
          full_name: form.value.fullName,
          role: form.value.role,
          phone: form.value.phone,
          organization: form.value.organization || 'Freelance'
        }
      }
    })

    if (error) throw error

    // 2. Success Logic
    // Even if identity is null (due to enumeration protection), we assume success to guide user
    alert("Account created! Please check your email to verify your account.")
    navigateTo('/login')

  } catch (e: any) {
    console.error(e)
    errorMsg.value = e.message || "Registration failed. Please try again."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-white mb-2 tracking-tight">Join Client Base</h1>
      <p class="text-gray-400 text-sm">Step {{ step }} of 2: {{ step === 1 ? 'Account Security' : 'Your Profile' }}</p>
      
      <div class="flex gap-2 justify-center mt-4">
        <div class="h-1 w-8 rounded-full transition-colors" :class="step >= 1 ? 'bg-primary' : 'bg-white/10'"></div>
        <div class="h-1 w-8 rounded-full transition-colors" :class="step >= 2 ? 'bg-primary' : 'bg-white/10'"></div>
      </div>
    </div>

    <form @submit.prevent="step === 1 ? nextStep() : handleSignup()" class="space-y-5">
      
      <div v-if="step === 1" class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
        
        <div>
          <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Email Address</label>
          <div class="relative">
            <input 
              v-model="form.email"
              type="email" 
              required
              class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Password</label>
            <input 
              v-model="form.password"
              type="password" 
              required
              class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Confirm</label>
            <input 
              v-model="form.confirmPassword"
              type="password" 
              required
              class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div class="bg-white/5 p-4 rounded-lg text-xs space-y-2">
          <p class="font-bold text-gray-400 uppercase">Requirements:</p>
          <div class="flex items-center gap-2" :class="form.password.length >= 8 ? 'text-green-400' : 'text-gray-500'">
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span>At least 8 characters</span>
          </div>
          <div class="flex items-center gap-2" :class="(/[a-zA-Z]/.test(form.password) && /\d/.test(form.password)) ? 'text-green-400' : 'text-gray-500'">
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span>Alphanumeric (Letters & Numbers)</span>
          </div>
          <div class="flex items-center gap-2" :class="form.password === form.confirmPassword && form.password.length > 0 ? 'text-green-400' : 'text-gray-500'">
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            <span>Passwords match</span>
          </div>
        </div>

        <button 
          type="button" 
          @click="nextStep"
          :disabled="!step1Valid"
          class="w-full bg-primary hover:bg-[#3d34d9] text-white font-bold py-3 rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
        >
          Next Step &rarr;
        </button>
      </div>

      <div v-if="step === 2" class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
        
        <div>
          <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Full Name</label>
          <input 
            v-model="form.fullName"
            type="text" 
            required
            class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
            placeholder="John Doe"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Role</label>
            <select v-model="form.role" class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
              <option value="Developer">Developer</option>
              <option value="Designer">Designer</option>
              <option value="Manager">Manager</option>
              <option value="Consultant">Consultant</option>
            </select>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Organization</label>
            <input 
              v-model="form.organization"
              type="text" 
              class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
              placeholder="OPS (Optional)"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs uppercase font-bold text-gray-500 mb-2 tracking-wider">Phone Number</label>
          <input 
            v-model="form.phone"
            type="tel" 
            required
            class="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
            placeholder="+234..."
          />
        </div>

        <div class="flex gap-3 pt-4">
          <button 
            type="button" 
            @click="step = 1"
            class="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <button 
            type="submit" 
            :disabled="loading || !step2Valid"
            class="flex-[2] bg-primary hover:bg-[#3d34d9] text-white font-bold py-3 rounded-lg shadow-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2"
          >
            <UIcon v-if="loading" name="i-heroicons-arrow-path" class="animate-spin w-5 h-5" />
            <span>{{ loading ? 'Creating Account...' : 'Complete Signup' }}</span>
          </button>
        </div>
      </div>

    </form>

    <div v-if="errorMsg" class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center animate-in shake">
      {{ errorMsg }}
    </div>

    <div class="text-center pt-4 border-t border-white/5">
      <p class="text-sm text-gray-500">
        Already have an account? 
        <NuxtLink to="/login" class="text-primary font-bold hover:text-white transition-colors">Sign In</NuxtLink>
      </p>
    </div>

  </div>
</template>