<script setup lang="ts">
// 1. Import the shared composable
const { setProfile } = useUserProfile()

const client = useSupabaseClient()
const user = useSupabaseUser()
const config = useRuntimeConfig()

// --- CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = config.public.CloudinaryCloudName
const CLOUDINARY_PRESET = config.public.CloudinaryPreset

// --- STATE ---
const loading = ref(true)
const saving = ref(false)
const activeTab = ref('profile')
const avatarPreview = ref<string | null>(null)
const toast = ref({ show: false, message: '', type: 'success' })

const profile = ref({
  full_name: '',
  role: 'Developer',
  email: '',
  avatar_url: '' as string | null
})

const passwordForm = ref({ new_password: '', confirm_password: '' })
const themes = [
  { name: 'Ops Indigo',   hex: '#4d48e5' },
  { name: 'Cyber Blue',   hex: '#0ea5e9' },
  { name: 'Emerald',      hex: '#10b981' },
  { name: 'Orange Alert', hex: '#f97316' },
  { name: 'Crimson',      hex: '#ef4444' },
]
const activeTheme = ref('#4d48e5')

// --- HELPERS ---

const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

// 🔥 AGGRESSIVE ID RETRIEVAL (Kept from previous fix) 🔥
const getUserIdOrThrow = async () => {
  if (user.value?.id) return user.value.id
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user?.id) return sessionData.session.user.id
  const { data: userData } = await client.auth.getUser()
  if (userData.user?.id) return userData.user.id
  throw new Error("CRITICAL: User ID not found. You may be logged out.")
}

// --- ACTIONS ---

const fetchProfile = async () => {
  loading.value = true
  try {
    const userId = await getUserIdOrThrow()
    
    // Set email for display
    if (user.value?.email) profile.value.email = user.value.email
    
    // Load Theme
    if (process.client) {
      const savedColor = localStorage.getItem('ops-primary-color')
      if (savedColor) activeTheme.value = savedColor
    }

    const { data } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      
    if (data) {
      profile.value.full_name = data.full_name
      profile.value.role = data.role
      profile.value.avatar_url = data.avatar_url
      if (data.avatar_url) avatarPreview.value = data.avatar_url

      // 🔥 SYNC GLOBAL STATE
      setProfile({
        full_name: data.full_name,
        role: data.role,
        avatar_url: data.avatar_url
      })
    }
  } catch (e) {
    console.log('Fetch Profile Info:', e)
  }
  loading.value = false
}

// 2. Handle File Upload (Cloudinary + Auto-Save + Global Sync)
const handleAvatarChange = async (e: any) => {
  const file = e.target.files[0]
  if (!file) return
  
  avatarPreview.value = URL.createObjectURL(file)
  saving.value = true
  
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', CLOUDINARY_PRESET)

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
    
    const newAvatarUrl = data.secure_url
    profile.value.avatar_url = newAvatarUrl
    
    const userId = await getUserIdOrThrow() 

    const updates = {
      id: userId,
      avatar_url: newAvatarUrl,
      updated_at: new Date(),
      full_name: profile.value.full_name, 
      role: profile.value.role
    }

    const { error: dbError } = await client.from('profiles').upsert(updates)
    if (dbError) throw dbError

    // 🔥 SYNC GLOBAL STATE
    setProfile({ avatar_url: newAvatarUrl })

    showToast('Avatar saved successfully!', 'success')
    
  } catch (err: any) {
    showToast(err.message, 'error')
    avatarPreview.value = null 
  } finally {
    saving.value = false
  }
}

// 3. Update Profile Text
const updateProfile = async () => {
  saving.value = true
  try {
    const userId = await getUserIdOrThrow()

    const updates = {
      id: userId,
      full_name: profile.value.full_name,
      role: profile.value.role,
      avatar_url: profile.value.avatar_url,
      updated_at: new Date(),
    }

    const { error } = await client.from('profiles').upsert(updates)
    if (error) throw error
    
    // 🔥 SYNC GLOBAL STATE
    setProfile({
      full_name: profile.value.full_name,
      role: profile.value.role,
      avatar_url: profile.value.avatar_url
    })
    
    showToast('Profile updated successfully!')
  } catch (error: any) {
    showToast(error.message, 'error')
  } finally {
    saving.value = false
  }
}

// 4. Update Password
const updatePassword = async () => {
  // Basic validation
  if (passwordForm.value.new_password.length < 8) {
    return showToast("Password must be at least 8 characters.", 'error')
  }
  if (passwordForm.value.new_password !== passwordForm.value.confirm_password) {
    return showToast("Passwords do not match!", 'error')
  }
  
  saving.value = true
  const { error } = await client.auth.updateUser({ 
    password: passwordForm.value.new_password 
  })

  saving.value = false
  if (error) showToast(error.message, 'error')
  else {
    showToast("Password updated successfully!")
    passwordForm.value = { new_password: '', confirm_password: '' }
  }
}

// 5. Theme Logic
const setTheme = (hex: string) => {
  activeTheme.value = hex
  if (process.client) {
    document.documentElement.style.setProperty('--color-primary', hex)
    localStorage.setItem('ops-primary-color', hex)
  }
  showToast(`Theme changed to ${themes.find(t => t.hex === hex)?.name}`)
}

// 6. Sign Out Everywhere
const signOutEverywhere = async () => {
  if(!confirm("Are you sure? You will be logged out of all devices.")) return
  await client.auth.signOut({ scope: 'global' })
  navigateTo('/login')
}

onMounted(() => {
  fetchProfile()
})
</script>

<template>
  <div class="min-h-screen bg-base font-sans p-4 md:p-8">
    
    <div class="max-w-6xl mx-auto mb-8">
      <h1 class="text-2xl font-bold text-white tracking-tight">Settings</h1>
      <p class="text-slate-400 mt-1">Manage your account preferences and security.</p>
    </div>

    <div class="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
      
      <!-- Sidebar navigation -->
      <aside class="w-full lg:w-64 flex-shrink-0">
        <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 bg-white/5 p-1 rounded-xl">
          <button 
            @click="activeTab = 'profile'"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold text-sm whitespace-nowrap',
              activeTab === 'profile'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            ]"
          >
            <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
            My Profile
          </button>
          
          <button 
            @click="activeTab = 'appearance'"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold text-sm whitespace-nowrap',
              activeTab === 'appearance'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            ]"
          >
            <UIcon name="i-heroicons-paint-brush" class="w-5 h-5" />
            Appearance
          </button>

          <button 
            @click="activeTab = 'security'"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold text-sm whitespace-nowrap',
              activeTab === 'security'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            ]"
          >
            <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
            Security
          </button>
        </nav>
      </aside>

      <!-- Main content area -->
      <main class="flex-1 min-w-0">
        
        <div v-if="loading" class="animate-pulse space-y-6 max-w-2xl">
           <div class="flex items-center gap-4">
             <div class="w-20 h-20 bg-white/5 rounded-full"></div>
             <div class="space-y-2">
               <div class="h-4 w-40 bg-white/5 rounded"></div>
               <div class="h-3 w-24 bg-white/5 rounded"></div>
             </div>
           </div>
           <div class="h-12 w-full bg-white/5 rounded-xl"></div>
           <div class="h-12 w-full bg-white/5 rounded-xl"></div>
        </div>

        <!-- PROFILE TAB -->
        <div v-else-if="activeTab === 'profile'" class="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <!-- Avatar section -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <div class="relative group cursor-pointer shrink-0">
              <div 
                class="w-24 h-24 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-3xl font-bold text-primary overflow-hidden"
              >
                <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
                <span v-else>{{ profile.email.charAt(0).toUpperCase() }}</span>
              </div>
              
              <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <UIcon name="i-heroicons-camera" class="w-8 h-8 text-white" />
              </div>
              
              <input type="file" @change="handleAvatarChange" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            
            <div class="text-center sm:text-left">
              <h3 class="text-white font-semibold text-lg">{{ profile.email }}</h3>
              <p class="text-slate-500 text-sm mb-3">Allowed: JPG, GIF or PNG. Max size 5MB.</p>
              <span class="px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white/5 border border-white/6">{{ profile.role || 'Team Member' }}</span>
            </div>
          </div>

          <!-- Personal information -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6">
            <h3 class="text-base font-semibold text-white mb-6 flex items-center gap-2">
              <UIcon name="i-heroicons-identification" class="w-5 h-5 text-slate-400" />
              Personal Information
            </h3>
            <form @submit.prevent="updateProfile" class="space-y-5">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-slate-400">Full Name</label>
                  <input v-model="profile.full_name" type="text" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-slate-400">Role / Title</label>
                  <input v-model="profile.role" type="text" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>
              </div>
              <div class="flex justify-end pt-4 border-t border-white/5">
                <button type="submit" :disabled="saving" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98] disabled:opacity-50">
                  <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- APPEARANCE TAB -->
        <div v-else-if="activeTab === 'appearance'" class="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6">
            <h3 class="text-base font-semibold text-white mb-2">Interface Theme</h3>
            <p class="text-slate-400 text-sm mb-6">Select your preferred accent color for the dashboard.</p>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <button 
                v-for="t in themes" 
                :key="t.hex"
                @click="setTheme(t.hex)"
                class="group relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-105"
                :class="activeTheme === t.hex ? 'bg-white/[0.05] border-primary shadow-lg shadow-primary/10' : 'bg-white/[0.03] border-white/6 hover:border-white/10'"
              >
                <div 
                  class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform group-hover:rotate-12"
                  :style="{ backgroundColor: t.hex }"
                >
                   <UIcon v-if="activeTheme === t.hex" name="i-heroicons-check" class="w-6 h-6 text-white" />
                </div>
                <span class="text-xs font-semibold" :class="activeTheme === t.hex ? 'text-white' : 'text-slate-500'">{{ t.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- SECURITY TAB -->
        <div v-else-if="activeTab === 'security'" class="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <!-- Change Password -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6">
            <h3 class="text-base font-semibold text-white mb-6 flex items-center gap-2">
               <UIcon name="i-heroicons-key" class="w-5 h-5 text-slate-400" />
               Change Password
            </h3>
            <form @submit.prevent="updatePassword" class="space-y-5">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-slate-400">New Password</label>
                  <input v-model="passwordForm.new_password" type="password" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-slate-400">Confirm Password</label>
                  <div class="relative">
                    <input v-model="passwordForm.confirm_password" type="password" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
                    <div v-if="passwordForm.confirm_password" class="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <UIcon v-if="passwordForm.new_password === passwordForm.confirm_password" name="i-heroicons-check-circle" class="w-5 h-5 text-emerald-400" />
                      <UIcon v-else name="i-heroicons-exclamation-circle" class="w-5 h-5 text-red-400" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end pt-4 border-t border-white/5">
                 <button type="submit" :disabled="saving" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150">
                  Update Password
                </button>
              </div>
            </form>
          </div>

          <!-- Logout of all devices -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <h3 class="text-sm font-semibold text-white">Log out of all devices</h3>
                <p class="text-slate-500 text-xs mt-1">This will sign you out of all active sessions except this one.</p>
             </div>
             <button @click="signOutEverywhere" class="shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150">
               Log Out All
             </button>
          </div>

        </div>

      </main>
    </div>

    <!-- Toast -->
    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div 
          class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border"
          :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'"
        >
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'" />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>

  </div>
</template>