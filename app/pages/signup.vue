<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})

const client = useSupabaseClient()
const loading = ref(false)
const step = ref(1)
const errorMsg = ref('')
const successMsg = ref('')
const config = useRuntimeConfig()

const CLOUDINARY_CLOUD_NAME = config.public.CloudinaryCloudName
const CLOUDINARY_PRESET = config.public.CloudinaryPreset

// ── Form ──────────────────────────────────────────────────────────────────────
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

// ── Avatar ────────────────────────────────────────────────────────────────────
const avatarPreview = ref<string | null>(null)
const avatarUploading = ref(false)
const avatarDefaultOptions = [
  { seed: 'John',   url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John' },
  { seed: 'Jane',   url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jane' },
  { seed: 'Alex',   url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex' },
  { seed: 'Taylor', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor' }
]

// ── Validation ────────────────────────────────────────────────────────────────
const passwordValid = computed(() => {
  const p = form.value.password
  return p.length >= 8 && /\d/.test(p) && /[a-zA-Z]/.test(p)
})

const step1Valid = computed(() =>
  form.value.email.includes('@') &&
  passwordValid.value &&
  form.value.password === form.value.confirmPassword
)

const step2Valid = computed(() =>
  form.value.fullName.length >= 2 &&
  form.value.role.length > 0 &&
  form.value.phone.length >= 6
)

// ── Field‑level error helpers ─────────────────────────────────────────────────
const emailError = computed(() => {
  if (step.value !== 1 || !form.value.email) return ''
  if (!form.value.email.includes('@')) return 'Enter a valid email address.'
  return ''
})

const passwordError = computed(() => {
  if (step.value !== 1 || !form.value.password) return ''
  if (form.value.password.length < 8) return 'At least 8 characters.'
  if (!/[a-zA-Z]/.test(form.value.password) || !/\d/.test(form.value.password)) return 'Include a letter and a number.'
  return ''
})

const confirmError = computed(() => {
  if (step.value !== 1 || !form.value.confirmPassword) return ''
  if (form.value.password !== form.value.confirmPassword) return 'Passwords do not match.'
  return ''
})

const fullNameError = computed(() => {
  if (step.value !== 2 || !form.value.fullName) return ''
  return form.value.fullName.length < 2 ? 'Name must be at least 2 characters.' : ''
})

const phoneError = computed(() => {
  if (step.value !== 2 || !form.value.phone) return ''
  return form.value.phone.length < 6 ? 'Enter a valid phone number.' : ''
})

// ── Avatar upload ─────────────────────────────────────────────────────────────
const handleAvatarUpload = async (file: File) => {
  avatarUploading.value = true
  errorMsg.value = ''
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
  } catch (e: any) {
    errorMsg.value = e.message || 'Could not upload image. Please try another or skip.'
    avatarPreview.value = null   // reset preview if upload fails
  } finally {
    avatarUploading.value = false
  }
}

const handleFileSelect = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Validate file
  if (file.size > 5 * 1024 * 1024) {
    errorMsg.value = 'Image must be smaller than 5MB.'
    return
  }
  if (!file.type.startsWith('image/')) {
    errorMsg.value = 'Only image files are allowed.'
    return
  }

  // Show local preview immediately
  avatarPreview.value = URL.createObjectURL(file)
  await handleAvatarUpload(file)
}

const selectDefaultAvatar = (url: string) => {
  form.value.avatar_url = url
  avatarPreview.value = url
  errorMsg.value = ''
}

const skipAvatar = () => {
  form.value.avatar_url = null
  avatarPreview.value = null
  errorMsg.value = ''
  handleSignup()   // proceed directly to signup without avatar
}

// ── Step navigation ───────────────────────────────────────────────────────────
const nextStep = () => {
  errorMsg.value = ''
  if (!step1Valid.value) return
  step.value = 2
}

const nextToAvatar = () => {
  errorMsg.value = ''
  if (!step2Valid.value) return
  step.value = 3
}

const backToProfile = () => {
  step.value = 2
}

// ── Signup ────────────────────────────────────────────────────────────────────
const handleSignup = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true

  try {
    const { data, error } = await client.auth.signUp({
      email: form.value.email,
      password: form.value.password,
      options: {
        data: {
          full_name: form.value.fullName,
          role: form.value.role,
          phone: form.value.phone,
          organization: form.value.organization || 'Freelance',
          avatar_url: form.value.avatar_url
        }
      }
    })

    if (error) throw error

    // Persist avatar to profiles table as fallback
    if (form.value.avatar_url && data.user) {
      try {
        await client
          .from('profiles')
          .update({
            avatar_url: form.value.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.user.id)
      } catch (_) { /* ignore – trigger may handle it */ }
    }

    // Show success & redirect
    successMsg.value = 'Account created! Check your email to verify, then sign in.'
    setTimeout(() => navigateTo('/login'), 2500)
  } catch (e: any) {
    errorMsg.value = e.message || 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto space-y-6">
    <!-- Heading -->
    <div class="text-center">
      <h1 class="text-2xl font-bold text-white">Create your account</h1>
      <p class="text-sm text-slate-400 mt-1">Step {{ step }} of 3</p>
    </div>

    <!-- Step indicators -->
    <div class="flex justify-center gap-2">
      <div class="h-1.5 w-12 rounded-full transition-colors duration-300"
           :class="step >= 1 ? 'bg-primary' : 'bg-white/10'"></div>
      <div class="h-1.5 w-12 rounded-full transition-colors duration-300"
           :class="step >= 2 ? 'bg-primary' : 'bg-white/10'"></div>
      <div class="h-1.5 w-12 rounded-full transition-colors duration-300"
           :class="step >= 3 ? 'bg-primary' : 'bg-white/10'"></div>
    </div>

    <!-- Form card -->
    <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 md:p-8">
      <form @submit.prevent="
        step === 1 ? nextStep() : 
        step === 2 ? nextToAvatar() : 
        handleSignup()
      " class="space-y-5">

        <!-- ── STEP 1: Credentials ────────────────────────────────────────── -->
        <div v-if="step === 1" class="space-y-4">
          <div class="space-y-1.5">
            <label for="signup-email" class="text-xs font-semibold text-slate-400">Email</label>
            <input
              id="signup-email"
              v-model="form.email"
              type="email"
              placeholder="you@company.com"
              class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-150"
              :class="emailError ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
            />
            <p v-if="emailError" class="text-xs text-red-400">{{ emailError }}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="signup-password" class="text-xs font-semibold text-slate-400">Password</label>
              <input
                id="signup-password"
                v-model="form.password"
                type="password"
                placeholder="••••••••"
                class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-150"
                :class="passwordError ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
              />
              <p v-if="passwordError" class="text-xs text-red-400">{{ passwordError }}</p>
            </div>
            <div class="space-y-1.5">
              <label for="signup-confirm" class="text-xs font-semibold text-slate-400">Confirm</label>
              <input
                id="signup-confirm"
                v-model="form.confirmPassword"
                type="password"
                placeholder="••••••••"
                class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-150"
                :class="confirmError ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
              />
              <p v-if="confirmError" class="text-xs text-red-400">{{ confirmError }}</p>
            </div>
          </div>

          <!-- Password requirements -->
          <div class="bg-white/5 rounded-xl p-4 space-y-2 text-xs">
            <p class="font-semibold text-slate-500 uppercase tracking-wider">Requirements</p>
            <div class="flex items-center gap-2" :class="form.password.length >= 8 ? 'text-emerald-400' : 'text-slate-600'">
              <UIcon :name="form.password.length >= 8 ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'" class="w-4 h-4" />
              <span>At least 8 characters</span>
            </div>
            <div class="flex items-center gap-2" :class="(/[a-zA-Z]/.test(form.password) && /\d/.test(form.password)) ? 'text-emerald-400' : 'text-slate-600'">
              <UIcon :name="(/[a-zA-Z]/.test(form.password) && /\d/.test(form.password)) ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'" class="w-4 h-4" />
              <span>Letters &amp; numbers</span>
            </div>
            <div class="flex items-center gap-2" :class="form.password && form.password === form.confirmPassword ? 'text-emerald-400' : 'text-slate-600'">
              <UIcon :name="form.password && form.password === form.confirmPassword ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'" class="w-4 h-4" />
              <span>Passwords match</span>
            </div>
          </div>

          <button
            type="submit"
            :disabled="!step1Valid"
            class="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
          >
            Continue
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
          </button>
        </div>

        <!-- ── STEP 2: Profile ────────────────────────────────────────────── -->
        <div v-if="step === 2" class="space-y-4">
          <div class="space-y-1.5">
            <label for="signup-name" class="text-xs font-semibold text-slate-400">Full Name</label>
            <input
              id="signup-name"
              v-model="form.fullName"
              type="text"
              placeholder="Jane Doe"
              class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-150"
              :class="fullNameError ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
            />
            <p v-if="fullNameError" class="text-xs text-red-400">{{ fullNameError }}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="signup-role" class="text-xs font-semibold text-slate-400">Role</label>
              <select
                id="signup-role"
                v-model="form.role"
                class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150"
              >
                <option value="Developer">Developer</option>
                <option value="Designer">Designer</option>
                <option value="Manager">Manager</option>
                <option value="Consultant">Consultant</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label for="signup-org" class="text-xs font-semibold text-slate-400">Organization</label>
              <input
                id="signup-org"
                v-model="form.organization"
                type="text"
                placeholder="Optional"
                class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="signup-phone" class="text-xs font-semibold text-slate-400">Phone Number</label>
            <input
              id="signup-phone"
              v-model="form.phone"
              type="tel"
              placeholder="+234…"
              class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-150"
              :class="phoneError ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
            />
            <p v-if="phoneError" class="text-xs text-red-400">{{ phoneError }}</p>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="step = 1"
              class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all"
            >
              Back
            </button>
            <button
              type="submit"
              :disabled="!step2Valid"
              class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
            >
              Choose Avatar
              <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- ── STEP 3: Avatar ─────────────────────────────────────────────── -->
        <div v-if="step === 3" class="space-y-5">
          <!-- Preview -->
          <div class="flex justify-center">
            <div class="w-24 h-24 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center overflow-hidden">
              <img
                v-if="avatarPreview"
                :src="avatarPreview"
                alt="Avatar"
                class="w-full h-full object-cover"
              />
              <UIcon v-else name="i-heroicons-user" class="w-10 h-10 text-slate-600" />
            </div>
          </div>

          <!-- Upload -->
          <div class="space-y-1.5">
            <p class="text-xs font-semibold text-slate-400 text-center">Upload a picture</p>
            <div class="relative border-2 border-dashed border-white/8 rounded-2xl p-8 text-center hover:border-primary/30 hover:bg-white/[0.02] transition-all duration-150 cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                @change="handleFileSelect"
                :disabled="avatarUploading"
              />
              <UIcon
                v-if="avatarUploading"
                name="i-heroicons-arrow-path"
                class="w-8 h-8 mx-auto mb-3 animate-spin text-primary"
              />
              <UIcon
                v-else
                name="i-heroicons-cloud-arrow-up"
                class="w-8 h-8 mx-auto mb-3 text-slate-500 group-hover:text-primary transition-colors"
              />
              <p class="text-sm font-medium text-white">
                {{ avatarUploading ? 'Uploading…' : 'Click to upload' }}
              </p>
              <p class="text-xs text-slate-500 mt-1">PNG, JPG or GIF (max 5MB)</p>
            </div>
          </div>

          <!-- Defaults -->
          <div class="space-y-2">
            <p class="text-xs font-semibold text-slate-400 text-center">Or pick a default</p>
            <div class="grid grid-cols-4 gap-3">
              <button
                v-for="(avatar, index) in avatarDefaultOptions"
                :key="index"
                type="button"
                @click="selectDefaultAvatar(avatar.url)"
                class="aspect-square rounded-full overflow-hidden border-2 transition-all duration-150 hover:scale-105"
                :class="form.avatar_url === avatar.url
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-white/6 hover:border-white/10'"
              >
                <img :src="avatar.url" :alt="avatar.seed" class="w-full h-full object-cover bg-slate-800" />
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="backToProfile"
              class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              @click="skipAvatar"
              class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all"
            >
              Skip
            </button>
            <button
              type="submit"
              :disabled="loading || avatarUploading"
              class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
            >
              <UIcon v-if="loading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
              <span v-else>Complete Signup</span>
            </button>
          </div>
        </div>

      </form>
    </div>

    <!-- Error message -->
    <div v-if="errorMsg" class="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-sm text-red-400 text-center">
      {{ errorMsg }}
    </div>

    <!-- Success message -->
    <div v-if="successMsg" class="bg-emerald-400/5 border border-emerald-400/10 rounded-xl p-4 text-sm text-emerald-400 text-center">
      {{ successMsg }}
    </div>

    <!-- Footer link -->
    <p class="text-center text-sm text-slate-500">
      Already have an account?
      <NuxtLink to="/login" class="text-primary font-semibold hover:text-primary/80 transition-colors ml-1">Sign In</NuxtLink>
    </p>
  </div>
</template>