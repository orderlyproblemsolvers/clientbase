<script setup lang="ts">
import { useOnboarding } from '~/composables/useOnboarding'

definePageMeta({ layout: false })

const route    = useRoute()
const supabase = useSupabaseClient()
const token    = route.params.token
const { acceptString } = useOnboarding()

// ── State ─────────────────────────────────────────────────────────────────────
const loading     = ref(true)
const formData    = ref<any>(null)
const ownerName   = ref('')
const answers     = ref<Record<string, any>>({})
const fileUploads = ref<Record<string, File[]>>({})
const linkInputs  = ref<Record<string, string>>({})
const submitting  = ref(false)
const done        = ref(false)
const error       = ref('')

// Init per field
const initAnswers = (fields: any[]) => {
  fields.forEach((f: any) => {
    answers.value[f.id]     = f.type === 'file' ? [] : ''
    fileUploads.value[f.id] = []
  })
}

// ── Fetch form ────────────────────────────────────────────────────────────────
const fetchForm = async () => {
  try {
    const { data, error: err } = await supabase
      .from('onboarding_forms')
      .select('*, profiles(full_name, organization, avatar_url)')
      .eq('token', token)
      .single()

    if (err || !data) {
      error.value = 'This form link is invalid or has expired.'
      return
    }

    if (data.status === 'completed') {
      error.value = 'This form has already been submitted.'
      return
    }

    formData.value = data
    
    // Prefer organization name, fallback to full name, then default
    ownerName.value = data.profiles?.organization || data.profiles?.full_name || 'Your service provider'

    // Init answers
    initAnswers(data.fields || [])
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// ── File Handlers ─────────────────────────────────────────────────────────────
const handleFileChange = (fieldId: string, event: any, maxFiles: number) => {
  const newFiles  = Array.from(event.target.files || []) as File[]
  const existing  = fileUploads.value[fieldId] || []
  const combined  = [...existing, ...newFiles].slice(0, maxFiles)
  fileUploads.value[fieldId] = combined
}

const removeFile = (fieldId: string, idx: number) => {
  fileUploads.value[fieldId].splice(idx, 1)
}

const addLink = (fieldId: string) => {
  const url = linkInputs.value[fieldId]?.trim()
  if (!url) return
  const existing = Array.isArray(answers.value[fieldId]) ? answers.value[fieldId] : []
  answers.value[fieldId] = [...existing, url]
  linkInputs.value[fieldId] = ''
}

// ── Submit ─────────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
  const fields = formData.value?.fields || []

  // Validate required
  for (const f of fields) {
    if (f.required) {
      const val = answers.value[f.id]
      const files = fileUploads.value[f.id] || []
      
      if (f.type === 'file') {
        if (!files.length && (!Array.isArray(val) || !val.length)) {
          error.value = `"${f.label}" is required`
          return
        }
      } else if (!val) {
        error.value = `"${f.label}" is required`
        return
      }
    }
  }

  submitting.value = true
  error.value = ''

  try {
    // Upload files for each file field
    for (const f of fields) {
      if (f.type !== 'file') continue
      
      const filesToUpload = fileUploads.value[f.id] || []
      const uploadedUrls: string[] = []
      
      for (const file of filesToUpload) {
        const ext  = file.name.split('.').pop()
        const path = `${token}/${f.id}/${Date.now()}_${file.name}`
        
        const { error: upErr } = await supabase.storage
          .from('onboarding-assets')
          .upload(path, file)
          
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('onboarding-assets')
            .getPublicUrl(path)
          uploadedUrls.push(urlData?.publicUrl || '')
        }
      }
      
      // Merge uploaded URLs with any pasted links
      const pastedLinks = Array.isArray(answers.value[f.id]) ? answers.value[f.id] : []
      answers.value[f.id] = [...uploadedUrls, ...pastedLinks].filter(Boolean)
    }

    // Submitter name/email from first matching fields
    const nameFieldId  = fields.find((f: any) => f.type === 'text'  && f.label.toLowerCase().includes('name'))?.id
    const emailFieldId = fields.find((f: any) => f.type === 'email')?.id
    
    const { error: subErr } = await supabase.from('onboarding_submissions').insert({
      form_id:         formData.value.id,
      responses:       answers.value,
      submitter_name:  nameFieldId  ? answers.value[nameFieldId]  : null,
      submitter_email: emailFieldId ? answers.value[emailFieldId] : null,
    })
    
    if (subErr) throw subErr

    // Update form status
    await supabase
      .from('onboarding_forms')
      .update({ status: 'completed' })
      .eq('id', formData.value.id)

    done.value = true
  } catch (e: any) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

onMounted(() => fetchForm())
</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-gray-500 text-sm">Loading form...</p>
      </div>
    </div>

    <div v-else-if="error && !formData" class="flex items-center justify-center min-h-screen">
      <div class="text-center max-w-sm">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500" />
        </div>
        <p class="text-gray-800 font-bold text-lg">Form Not Available</p>
        <p class="text-gray-500 text-sm mt-2">{{ error }}</p>
      </div>
    </div>

    <div v-else-if="done" class="flex items-center justify-center min-h-screen">
      <div class="text-center max-w-sm">
        <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <UIcon name="i-heroicons-check" class="w-10 h-10 text-green-600" />
        </div>
        <h1 class="text-gray-900 font-bold text-2xl mb-2">Thank You!</h1>
        <p class="text-gray-500">
          Your responses have been submitted. {{ ownerName }} will be in touch soon.
        </p>
      </div>
    </div>

    <div v-else-if="formData" class="max-w-2xl mx-auto px-4 py-12">

      <div class="mb-10">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-sm">
            {{ ownerName.charAt(0).toUpperCase() }}
          </div>
          <div>
            <p class="text-xs text-gray-500 font-medium">Brief for</p>
            <p class="text-gray-800 font-bold text-sm">{{ ownerName }}</p>
          </div>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ formData.title }}</h1>
        <p v-if="formData.description" class="text-gray-500 leading-relaxed">{{ formData.description }}</p>
      </div>

      <div class="space-y-6">
        <div
          v-for="field in (formData.fields || [])"
          :key="field.id"
        >
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            {{ field.label }}
            <span v-if="field.required" class="text-red-500 ml-1">*</span>
          </label>

          <textarea
            v-if="field.type === 'textarea'"
            v-model="answers[field.id]"
            :placeholder="field.placeholder || ''"
            rows="5"
            class="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none text-sm placeholder-gray-400 transition-all"
          ></textarea>

          <div v-else-if="field.type === 'select'" class="relative">
            <select
              v-model="answers[field.id]"
              class="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 appearance-none cursor-pointer text-sm"
            >
              <option value="">Select an option...</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          </div>

          <div v-else-if="field.type === 'file'">
            <label
              class="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-500 transition-colors bg-white"
            >
              <input
                type="file"
                class="hidden"
                :multiple="(field.maxFiles || 1) > 1"
                :accept="acceptString(field.acceptedTypes || [])"
                @change="handleFileChange(field.id, $event, field.maxFiles || 1)"
              />
              <UIcon name="i-heroicons-paper-clip" class="w-6 h-6 text-gray-400 mb-2" />
              <p class="text-sm text-gray-600 font-medium">
                {{ (fileUploads[field.id] || []).length > 0
                  ? `${fileUploads[field.id].length} file(s) selected`
                  : `Click to attach file${(field.maxFiles || 1) > 1 ? 's' : ''}` }}
              </p>
              <p class="text-xs text-gray-400 mt-1">
                Max {{ field.maxFiles || 1 }} file{{ (field.maxFiles || 1) !== 1 ? 's' : '' }}
                {{ field.acceptedTypes?.length ? `· ${field.acceptedTypes.join(', ')}` : '' }}
              </p>
            </label>
            
            <div v-if="(fileUploads[field.id] || []).length" class="mt-3 space-y-2">
              <div
                v-for="(file, idx) in fileUploads[field.id]"
                :key="idx"
                class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <UIcon name="i-heroicons-document" class="w-4 h-4 text-gray-400 shrink-0" />
                  <p class="text-sm text-gray-700 truncate">{{ file.name }}</p>
                </div>
                <button
                  type="button"
                  @click="removeFile(field.id, idx)"
                  class="text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div class="mt-3">
              <p class="text-xs text-gray-400 mb-1">Or paste a Google Drive / Dropbox link:</p>
              <input
                v-model="linkInputs[field.id]"
                type="url"
                placeholder="https://drive.google.com/..."
                class="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 text-sm placeholder-gray-400"
                @keydown.enter.prevent="addLink(field.id)"
              />
              <button
                v-if="linkInputs[field.id]"
                type="button"
                @click="addLink(field.id)"
                class="mt-2 text-xs font-bold text-gray-700 hover:text-gray-900"
              >
                + Add link
              </button>
            </div>
          </div>

          <input
            v-else
            v-model="answers[field.id]"
            :type="field.type"
            :placeholder="field.placeholder || ''"
            class="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent text-sm placeholder-gray-400 transition-all"
          />
        </div>
      </div>

      <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
        <p class="text-red-600 text-sm font-medium">{{ error }}</p>
      </div>

      <div class="mt-10">
        <button
          @click="handleSubmit"
          :disabled="submitting"
          class="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-2xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          <div v-if="submitting" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>{{ submitting ? 'Submitting...' : 'Submit' }}</span>
        </button>
      </div>

    </div>
  </div>
</template>