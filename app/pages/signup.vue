<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const client = useSupabaseClient()
const loading = ref(false)
const step = ref(1) // 1 = Credentials, 2 = Profile, 3 = Avatar
const errorMsg = ref('')
const config = useRuntimeConfig()

// --- CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = config.public.CloudinaryCloudName
const CLOUDINARY_PRESET = config.public.CloudinaryPreset

// --- Form State ---
const form = ref({
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  role: 'Developer',
  phone: '',
  organization: '',
  avatar_url: null as string | null
})

// --- Avatar State ---
const avatarPreview = ref<string | null>(null)
const avatarUploading = ref(false)
const avatarDefaultOptions = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor'
]

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

// --- Avatar Functions ---

// Handle file upload to Cloudinary
const handleAvatarUpload = async (file: File) => {
  avatarUploading.value = true
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
    
    form.value.avatar_url = data.secure_url
    avatarPreview.value = data.secure_url
    return data.secure_url
  } catch (error: any) {
    console.error('Avatar upload failed:', error)
    errorMsg.value = 'Failed to upload avatar. Please try another image or skip.'
    throw error
  } finally {
    avatarUploading.value = false
  }
}

// Handle file selection
const handleFileSelect = async (e: any) => {
  const file = e.target.files[0]
  if (!file) return
  
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    errorMsg.value = 'File size must be less than 5MB'
    return
  }
  
  // Check file type
  if (!file.type.startsWith('image/')) {
    errorMsg.value = 'Please select an image file'
    return
  }
  
  // Show preview
  avatarPreview.value = URL.createObjectURL(file)
  
  // Upload to Cloudinary
  try {
    await handleAvatarUpload(file)
  } catch {
    // Error already handled in handleAvatarUpload
  }
}

// Select default avatar
const selectDefaultAvatar = (url: string) => {
  form.value.avatar_url = url
  avatarPreview.value = url
  errorMsg.value = '' // Clear any previous errors
}

// Skip avatar (use default from Supabase)
const skipAvatar = () => {
  form.value.avatar_url = null
  avatarPreview.value = null
  step.value = 4 // Go to final step
}

// --- Step Navigation ---

const nextStep = () => {
  errorMsg.value = ''
  if (!step1Valid.value) {
    errorMsg.value = "Please check your password requirements."
    return
  }
  step.value = 2
}

const nextToAvatar = () => {
  errorMsg.value = ''
  if (!step2Valid.value) {
    errorMsg.value = "Please complete all profile fields."
    return
  }
  step.value = 3
}

const backToProfile = () => {
  step.value = 2
}

// --- Signup Action ---

const handleSignup = async () => {
  errorMsg.value = ''
  loading.value = true

  try {
    // 1. Sign Up with all metadata including avatar
    const { data, error } = await client.auth.signUp({
      email: form.value.email,
      password: form.value.password,
      options: {
        data: {
          full_name: form.value.fullName,
          role: form.value.role,
          phone: form.value.phone,
          organization: form.value.organization || 'Freelance',
          avatar_url: form.value.avatar_url // Include avatar in signup metadata
        }
      }
    })

    if (error) throw error

    // 2. If we have an avatar URL, also update the profile record directly
    // (This ensures avatar is set even if the trigger doesn't pick it up)
    if (form.value.avatar_url && data.user) {
      try {
        await client
          .from('profiles')
          .update({
            avatar_url: form.value.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.user.id)
      } catch (profileError) {
        console.log('Note: Avatar not set in profiles table yet (trigger will handle it)', profileError)
      }
    }

    // 3. Success Logic
    alert("Account created! Please check your email to verify your account.")
    navigateTo('/login')

  } catch (e: any) {
    console.error(e)
    errorMsg.value = e.message || "Registration failed. Please try again."
  } finally {
    loading.value = false
  }
}

// Quick signup without avatar
const quickSignup = async () => {
  errorMsg.value = ''
  loading.value = true
  
  try {
    const { error } = await client.auth.signUp({
      email: form.value.email,
      password: form.value.password,
      options: {
        data: {
          full_name: form.value.fullName,
          role: form.value.role,
          phone: form.value.phone,
          organization: form.value.organization || 'Freelance'
        }
      }
    })

    if (error) throw error
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
      <p class="text-gray-400 text-sm">Step {{ step }} of {{ step === 4 ? '3' : '3' }}: {{ 
        step === 1 ? 'Account Security' : 
        step === 2 ? 'Your Profile' : 
        'Avatar Setup' 
      }}</p>
      
      <div class="flex gap-2 justify-center mt-4">
        <div class="h-1 w-8 rounded-full transition-colors" :class="step >= 1 ? 'bg-primary' : 'bg-white/10'"></div>
        <div class="h-1 w-8 rounded-full transition-colors" :class="step >= 2 ? 'bg-primary' : 'bg-white/10'"></div>
        <div class="h-1 w-8 rounded-full transition-colors" :class="step >= 3 ? 'bg-primary' : 'bg-white/10'"></div>
      </div>
    </div>

    <form @submit.prevent="
      step === 1 ? nextStep() : 
      step === 2 ? nextToAvatar() : 
      step === 3 ? handleSignup() : 
      null
    " class="space-y-5">
      
      <!-- STEP 1: Credentials -->
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
          Next: Profile Details &rarr;
        </button>
      </div>

      <!-- STEP 2: Profile Details -->
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
            class="flex-[2] bg-primary hover:bg-[#3d34d9] text-white font-bold py-3 rounded-lg shadow-lg transition-all disabled:opacity-50"
          >
            Next: Choose Avatar &rarr;
          </button>
        </div>
      </div>

      <!-- STEP 3: Avatar Setup -->
      <div v-if="step === 3" class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
        
        <div class="text-center mb-4">
          <p class="text-gray-400 text-sm mb-4">Choose a profile picture. You can upload your own or select a default.</p>
          
          <!-- Current Selection Preview -->
          <div class="flex justify-center mb-6">
            <div class="relative group">
              <div class="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-white shadow-2xl overflow-hidden border-4 border-secondary">
                <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
                <span v-else>{{ form.fullName.charAt(0).toUpperCase() }}</span>
              </div>
            </div>
          </div>

          <!-- Upload Option -->
          <div class="mb-6">
            <label class="block text-xs uppercase font-bold text-gray-500 mb-3 tracking-wider">Upload Your Photo</label>
            <div class="relative border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <input 
                type="file" 
                @change="handleFileSelect" 
                accept="image/*" 
                class="absolute inset-0 opacity-0 cursor-pointer"
                :disabled="avatarUploading"
              />
              <UIcon v-if="avatarUploading" name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
              <UIcon v-else name="i-heroicons-cloud-arrow-up" class="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p class="text-sm font-medium text-white">{{ avatarUploading ? 'Uploading...' : 'Click to upload' }}</p>
              <p class="text-xs text-gray-500 mt-1">PNG, JPG or GIF up to 5MB</p>
            </div>
          </div>

          <!-- Default Avatars -->
          <div class="mb-6">
            <label class="block text-xs uppercase font-bold text-gray-500 mb-3 tracking-wider">Or Choose a Default</label>
            <div class="grid grid-cols-4 gap-3">
              <button
                v-for="(avatar, index) in avatarDefaultOptions"
                :key="index"
                type="button"
                @click="selectDefaultAvatar(avatar)"
                class="aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105"
                :class="form.avatar_url === avatar ? 'border-primary ring-2 ring-primary/50' : 'border-white/10'"
              >
                <img :src="avatar" alt="Default avatar" class="w-full h-full object-cover bg-gray-800" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex gap-3 pt-4">
          <button 
            type="button" 
            @click="backToProfile"
            class="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-lg transition-colors"
          >
            &larr; Back
          </button>
          <button 
            type="button" 
            @click="skipAvatar"
            class="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Skip for now
          </button>
          <button 
            type="submit" 
            :disabled="loading || avatarUploading"
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
      <p v-if="step === 1" class="text-xs text-gray-600 mt-2">
        Want to skip avatar setup? 
        <button @click="step = 2; step2Valid = true" class="text-primary hover:text-white underline transition-colors">Skip to profile</button>
      </p>
    </div>

  </div>
</template>