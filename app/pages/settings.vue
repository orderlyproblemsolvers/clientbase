<script setup lang="ts">
const client = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(false)

// --- State ---
const activeTab = ref('profile') // 'profile' | 'appearance' | 'security'
const profile = ref({
  full_name: '',
  role: 'Developer',
  email: ''
})

const passwordForm = ref({
  new_password: '',
  confirm_password: ''
})

// Theme Colors
const themes = [
  { name: 'Ops Indigo', hex: '#4d48e5' },
  { name: 'Cyber Blue', hex: '#0ea5e9' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Orange Alert', hex: '#f97316' },
  { name: 'Crimson', hex: '#ef4444' },
]
const activeTheme = ref('#4d48e5')

// --- Actions ---

// 1. Fetch Profile
const fetchProfile = async () => {
  loading.value = true
  profile.value.email = user.value?.email || ''
  
  const { data } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.value?.id)
    .single()
    
  if (data) {
    profile.value.full_name = data.full_name
    profile.value.role = data.role
  }
  
  // Load Theme from LocalStorage
  if (process.client) {
    const savedColor = localStorage.getItem('ops-primary-color')
    if (savedColor) {
      activeTheme.value = savedColor
    }
  }
  
  loading.value = false
}

// 2. Update Profile
const updateProfile = async () => {
  loading.value = true
  try {
    const updates = {
      id: user.value?.id,
      full_name: profile.value.full_name,
      role: profile.value.role,
      updated_at: new Date(),
    }

    const { error } = await client.from('profiles').upsert(updates)
    if (error) throw error
    alert('Profile updated successfully!')
  } catch (error: any) {
    alert(error.message)
  } finally {
    loading.value = false
  }
}

// 3. Update Password
const updatePassword = async () => {
  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) {
    return alert("Passwords do not match!")
  }
  
  const { error } = await client.auth.updateUser({ 
    password: passwordForm.value.new_password 
  })

  if (error) alert(error.message)
  else {
    alert("Password updated!")
    passwordForm.value = { new_password: '', confirm_password: '' }
  }
}

// 4. Change Theme (CSS Variables)
const setTheme = (hex: string) => {
  activeTheme.value = hex
  if (process.client) {
    // This updates the variable we defined in main.css
    document.documentElement.style.setProperty('--color-primary', hex)
    localStorage.setItem('ops-primary-color', hex)
  }
}

onMounted(() => {
  fetchProfile()
})
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-white mb-2">Settings</h1>
      <p class="text-gray-400 mb-8">Manage your account and preferences.</p>

      <div class="flex gap-8 border-b border-white/5 mb-8">
        <button 
          @click="activeTab = 'profile'"
          :class="activeTab === 'profile' ? 'text-white border-primary' : 'text-gray-500 border-transparent'"
          class="pb-3 border-b-2 font-medium transition-all"
        >
          My Profile
        </button>
        <button 
          @click="activeTab = 'appearance'"
          :class="activeTab === 'appearance' ? 'text-white border-primary' : 'text-gray-500 border-transparent'"
          class="pb-3 border-b-2 font-medium transition-all"
        >
          Appearance
        </button>
        <button 
          @click="activeTab = 'security'"
          :class="activeTab === 'security' ? 'text-white border-primary' : 'text-gray-500 border-transparent'"
          class="pb-3 border-b-2 font-medium transition-all"
        >
          Security
        </button>
      </div>

      <div v-if="activeTab === 'profile'" class="bg-secondary/40 border border-white/5 rounded-2xl p-8 max-w-2xl">
        <div class="flex items-center gap-6 mb-8">
          <div class="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-white shadow-xl">
            {{ profile.email.charAt(0).toUpperCase() }}
          </div>
          <div>
            <h3 class="text-white font-bold text-lg">{{ profile.email }}</h3>
            <p class="text-gray-500 text-sm">Member since 2026</p>
          </div>
        </div>

        <form @submit.prevent="updateProfile" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Full Name</label>
              <input v-model="profile.full_name" type="text" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Role / Title</label>
              <input v-model="profile.role" type="text" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div class="flex justify-end">
            <button type="submit" :disabled="loading" class="bg-primary hover:opacity-90 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50">
              {{ loading ? 'Saving...' : 'Save Profile' }}
            </button>
          </div>
        </form>
      </div>

      <div v-if="activeTab === 'appearance'" class="bg-secondary/40 border border-white/5 rounded-2xl p-8 max-w-2xl">
        <h3 class="text-white font-bold text-lg mb-6">Interface Color</h3>
        <p class="text-gray-400 text-sm mb-6">Choose an accent color for buttons, links, and highlights.</p>
        
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-4">
          <button 
            v-for="t in themes" 
            :key="t.hex"
            @click="setTheme(t.hex)"
            class="group relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
            :class="activeTheme === t.hex ? 'bg-white/10 border-white' : 'bg-base border-white/5 hover:border-white/20'"
          >
            <div 
              class="w-10 h-10 rounded-full shadow-lg"
              :style="{ backgroundColor: t.hex }"
            ></div>
            <span class="text-xs font-medium" :class="activeTheme === t.hex ? 'text-white' : 'text-gray-500'">{{ t.name }}</span>
            
            <div v-if="activeTheme === t.hex" class="absolute top-2 right-2 text-white">
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
            </div>
          </button>
        </div>

        <div class="mt-8 p-4 bg-base rounded-lg border border-white/5">
          <p class="text-xs text-gray-500 uppercase font-bold mb-2">Preview</p>
          <div class="flex gap-4 items-center">
            <button class="bg-primary text-white px-4 py-2 rounded-lg font-bold">Primary Button</button>
            <span class="text-primary font-bold">Accent Text</span>
            <div class="w-6 h-6 rounded-full border-2 border-primary"></div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'security'" class="bg-secondary/40 border border-white/5 rounded-2xl p-8 max-w-2xl">
        <h3 class="text-white font-bold text-lg mb-6">Change Password</h3>
        <form @submit.prevent="updatePassword" class="space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">New Password</label>
            <input v-model="passwordForm.new_password" type="password" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Confirm Password</label>
            <input v-model="passwordForm.confirm_password" type="password" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none" />
          </div>
          <div class="flex justify-end">
             <button type="submit" class="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg font-bold transition-all">
              Update Password
            </button>
          </div>
        </form>
      </div>

    </div>
  </div>
</template>