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

const notifications = ref({ marketing: false, security: true, updates: true })
const passwordForm = ref({ new_password: '', confirm_password: '' })
const themes = [
  { name: 'Ops Indigo', hex: '#4d48e5' },
  { name: 'Cyber Blue', hex: '#0ea5e9' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Orange Alert', hex: '#f97316' },
  { name: 'Crimson', hex: '#ef4444' },
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
      // Update Local Form State
      profile.value.full_name = data.full_name
      profile.value.role = data.role
      profile.value.avatar_url = data.avatar_url
      if (data.avatar_url) avatarPreview.value = data.avatar_url

      // 🔥 SYNC GLOBAL STATE (So sidebar updates if it was empty)
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
    // A. Upload to Cloudinary
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
    
    // B. Save to DB Immediately
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

    // 🔥 SYNC GLOBAL STATE (Update Sidebar Avatar Instantly)
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
    
    // 🔥 SYNC GLOBAL STATE (Update Sidebar Name/Role Instantly)
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
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div class="max-w-6xl mx-auto mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">Settings</h1>
      <p class="text-gray-400 mt-1">Manage your account preferences and security.</p>
    </div>

    <div class="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
      
      <aside class="w-full lg:w-64 flex-shrink-0">
        <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
          <button 
            @click="activeTab = 'profile'"
            :class="activeTab === 'profile' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm whitespace-nowrap"
          >
            <UIcon name="i-heroicons-user-circle" class="w-5 h-5" />
            My Profile
          </button>
          
          <button 
            @click="activeTab = 'appearance'"
            :class="activeTab === 'appearance' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm whitespace-nowrap"
          >
            <UIcon name="i-heroicons-paint-brush" class="w-5 h-5" />
            Appearance
          </button>

          <button 
            @click="activeTab = 'notifications'"
            :class="activeTab === 'notifications' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm whitespace-nowrap"
          >
            <UIcon name="i-heroicons-bell" class="w-5 h-5" />
            Notifications
          </button>

          <div class="h-px bg-white/10 my-2 hidden lg:block"></div>

          <button 
            @click="activeTab = 'security'"
            :class="activeTab === 'security' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
            class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm whitespace-nowrap"
          >
            <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
            Security
          </button>
        </nav>
      </aside>

      <main class="flex-1 min-w-0">
        
        <div v-if="loading" class="animate-pulse space-y-6 max-w-2xl">
           <div class="flex items-center gap-4">
             <div class="w-20 h-20 bg-secondary rounded-full"></div>
             <div class="space-y-2">
               <div class="h-4 w-40 bg-secondary rounded"></div>
               <div class="h-3 w-24 bg-secondary rounded"></div>
             </div>
           </div>
           <div class="h-12 w-full bg-secondary rounded-lg"></div>
           <div class="h-12 w-full bg-secondary rounded-lg"></div>
        </div>

        <div v-else-if="activeTab === 'profile'" class="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <div class="bg-secondary/40 border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <div class="relative group cursor-pointer">
              <div 
                class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-white shadow-2xl overflow-hidden border-4 border-secondary"
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
              <h3 class="text-white font-bold text-lg">{{ profile.email }}</h3>
              <p class="text-gray-500 text-sm mb-3">Allowed: JPG, GIF or PNG. Max size 5MB.</p>
              <div class="flex gap-2 justify-center sm:justify-start">
                 <span class="px-2 py-1 bg-white/5 rounded text-[10px] uppercase font-bold text-gray-400">Owner</span>
                 <span class="px-2 py-1 bg-white/5 rounded text-[10px] uppercase font-bold text-gray-400">Pro Plan</span>
              </div>
            </div>
          </div>

          <div class="bg-secondary/40 border border-white/5 rounded-2xl p-8">
            <h3 class="text-white font-bold mb-6 flex items-center gap-2">
              <UIcon name="i-heroicons-identification" class="w-5 h-5 text-gray-400" />
              Personal Information
            </h3>
            <form @submit.prevent="updateProfile" class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Full Name</label>
                  <input v-model="profile.full_name" type="text" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors" />
                </div>
                <div>
                  <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Role / Title</label>
                  <input v-model="profile.role" type="text" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors" />
                </div>
              </div>
              <div class="flex justify-end pt-4 border-t border-white/5">
                <button type="submit" :disabled="saving" class="bg-primary hover:bg-[#3d34d9] text-white px-8 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20">
                  <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div v-else-if="activeTab === 'appearance'" class="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          <div class="bg-secondary/40 border border-white/5 rounded-2xl p-8">
            <h3 class="text-white font-bold text-lg mb-2">Interface Theme</h3>
            <p class="text-gray-400 text-sm mb-6">Select your preferred accent color for the dashboard.</p>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <button 
                v-for="t in themes" 
                :key="t.hex"
                @click="setTheme(t.hex)"
                class="group relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-105"
                :class="activeTheme === t.hex ? 'bg-white/10 border-primary shadow-lg shadow-primary/10' : 'bg-base border-white/5 hover:border-white/20'"
              >
                <div 
                  class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform group-hover:rotate-12"
                  :style="{ backgroundColor: t.hex }"
                >
                   <UIcon v-if="activeTheme === t.hex" name="i-heroicons-check" class="w-6 h-6 text-white" />
                </div>
                <span class="text-xs font-bold" :class="activeTheme === t.hex ? 'text-white' : 'text-gray-500'">{{ t.name }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'notifications'" class="max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
           <div class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden">
             <div class="p-6 border-b border-white/5 flex items-center justify-between">
               <div>
                 <h3 class="text-white font-bold text-sm">Marketing Emails</h3>
                 <p class="text-gray-500 text-xs">Receive news, updates, and featured content.</p>
               </div>
               <button @click="notifications.marketing = !notifications.marketing" class="w-12 h-6 rounded-full relative transition-colors" :class="notifications.marketing ? 'bg-primary' : 'bg-white/10'">
                 <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" :class="notifications.marketing ? 'left-7' : 'left-1'"></div>
               </button>
             </div>
             <div class="p-6 border-b border-white/5 flex items-center justify-between">
               <div>
                 <h3 class="text-white font-bold text-sm">Security Alerts</h3>
                 <p class="text-gray-500 text-xs">Get notified about logins and password changes.</p>
               </div>
               <button @click="notifications.security = !notifications.security" class="w-12 h-6 rounded-full relative transition-colors" :class="notifications.security ? 'bg-primary' : 'bg-white/10'">
                 <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" :class="notifications.security ? 'left-7' : 'left-1'"></div>
               </button>
             </div>
             <div class="p-6 flex items-center justify-between">
               <div>
                 <h3 class="text-white font-bold text-sm">Project Updates</h3>
                 <p class="text-gray-500 text-xs">Weekly summaries of your client's progress.</p>
               </div>
               <button @click="notifications.updates = !notifications.updates" class="w-12 h-6 rounded-full relative transition-colors" :class="notifications.updates ? 'bg-primary' : 'bg-white/10'">
                 <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" :class="notifications.updates ? 'left-7' : 'left-1'"></div>
               </button>
             </div>
           </div>
        </div>

        <div v-else-if="activeTab === 'security'" class="max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <div class="bg-secondary/40 border border-white/5 rounded-2xl p-8">
            <h3 class="text-white font-bold text-lg mb-6 flex items-center gap-2">
               <UIcon name="i-heroicons-key" class="w-5 h-5 text-gray-400" />
               Change Password
            </h3>
            <form @submit.prevent="updatePassword" class="space-y-4">
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">New Password</label>
                <input v-model="passwordForm.new_password" type="password" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors" />
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Confirm Password</label>
                <div class="relative">
                  <input v-model="passwordForm.confirm_password" type="password" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors" />
                  <div v-if="passwordForm.confirm_password" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <UIcon v-if="passwordForm.new_password === passwordForm.confirm_password" name="i-heroicons-check-circle" class="w-5 h-5 text-green-500" />
                    <UIcon v-else name="i-heroicons-exclamation-circle" class="w-5 h-5 text-red-500" />
                  </div>
                </div>
              </div>
              <div class="flex justify-end pt-2">
                 <button type="submit" :disabled="saving" class="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50">
                  Update Password
                </button>
              </div>
            </form>
          </div>

          <div class="bg-secondary/40 border border-white/5 rounded-2xl p-8 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div>
                <h3 class="text-white font-bold text-sm">Log out of all devices</h3>
                <p class="text-gray-500 text-xs mt-1">This will sign you out of all active sessions except this one.</p>
             </div>
             <button @click="signOutEverywhere" class="text-white border border-white/10 hover:bg-white/5 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
               Log Out All
             </button>
          </div>

          <div class="bg-red-500/5 border border-red-500/10 rounded-2xl p-8">
             <h3 class="text-red-500 font-bold text-sm mb-2">Danger Zone</h3>
             <p class="text-gray-400 text-xs mb-6">Once you delete your account, there is no going back. Please be certain.</p>
             <div class="flex justify-end">
               <button class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-red-500/20">
                 Delete Account
               </button>
             </div>
          </div>
        </div>

      </main>
    </div>

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
          class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border"
          :class="toast.type === 'success' ? 'bg-[#0f172a] border-green-500/50 text-green-400' : 'bg-[#0f172a] border-red-500/50 text-red-400'"
        >
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" />
          <span class="font-bold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>

  </div>
</template>