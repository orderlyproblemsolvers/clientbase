<script setup lang="ts">
import { useOnboarding } from '~/composables/useOnboarding'

definePageMeta({ layout: false })

const route    = useRoute()
const supabase = useSupabaseClient()
const token    = route.params.token
const { acceptString } = useOnboarding()

const step        = ref(1)
const totalSteps  = ref(4)
const groupLabels = ref<string[]>([])

const loading     = ref(true)
const formData    = ref<any>(null)
const provider    = ref({ name: '', organization: '', avatar: '', brandColor: '#4d48e5' })
const answers     = ref<Record<string, any>>({})
const fileUploads = ref<Record<string, File[]>>({})
const linkInputs  = ref<Record<string, string>>({})
const submitting  = ref(false)
const done        = ref(false)
const error       = ref('')
const agreedToTerms = ref(false)

const initAnswers = (fields: any[]) => {
  fields.forEach((f: any) => {
    answers.value[f.id]     = f.type === 'file' ? [] : ''
    fileUploads.value[f.id] = []
    linkInputs.value[f.id]  = ''
  })
}

const groupFields = (fields: any[]) => {
  const contact: any[] = []
  const project: any[] = []
  const details: any[] = []
  const files: any[]   = []

  for (const f of fields) {
    const lbl = f.label.toLowerCase()
    if (lbl.includes('name') || lbl.includes('email') || lbl.includes('phone')) {
      contact.push(f)
    } else if (f.type === 'file') {
      files.push(f)
    } else {
      project.push(f)
    }
  }
  if (fields.length <= 5) {
    const nonFile = fields.filter(f => f.type !== 'file')
    const fileFields = fields.filter(f => f.type === 'file')
    return [[...nonFile], fileFields.length ? [...fileFields] : []]
  }
  return [contact, project, details, files].filter(g => g.length)
}

const groups = ref<any[][]>([])

const fetchForm = async () => {
  try {
    const { data, error: err } = await supabase
      .from('onboarding_forms')
      .select('*, profiles(full_name, organization, avatar_url, preferences)')
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
    const prof = data.profiles || {}
    provider.value = {
      name:         prof.full_name || 'Your service provider',
      organization: prof.organization || '',
      avatar:       prof.avatar_url || '',
      brandColor:   prof.preferences?.brand_color || '#4d48e5',
    }

    document.documentElement.style.setProperty('--brand-color', provider.value.brandColor)

    initAnswers(data.fields || [])

    groups.value = groupFields(data.fields || [])
    totalSteps.value = 2 + groups.value.length
    groupLabels.value = groups.value.map((g, idx) => {
      if (idx === 0) return 'About You'
      if (idx === groups.value.length - 1 && g[0]?.type === 'file') return 'Attachments'
      return 'Your Project'
    })

  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const currentGroupIndex = computed(() => step.value - 2)
const currentGroup = computed(() => groups.value[currentGroupIndex.value] || [])
const isWelcomeStep = computed(() => step.value === 1)
const isReviewStep   = computed(() => step.value === totalSteps.value - 1)
const isDoneStep     = computed(() => step.value === totalSteps.value)

const nextStep = () => {
  if (isWelcomeStep.value) { step.value = 2; return }
  if (isReviewStep.value) {
    if (!agreedToTerms.value) {
      error.value = 'You must agree to the Terms of Use before submitting.'
      return
    }
    handleSubmit()
    return
  }
  if (!validateCurrentGroup()) return
  step.value++
}

const prevStep = () => {
  if (step.value > 1) step.value--
}

const validateCurrentGroup = (): boolean => {
  for (const f of currentGroup.value) {
    if (f.required) {
      const val = answers.value[f.id]
      const files = fileUploads.value[f.id] || []
      if (f.type === 'file') {
        if (!files.length && (!Array.isArray(val) || !val.length)) {
          error.value = `"${f.label}" is required.`
          return false
        }
      } else if (!val) {
        error.value = `"${f.label}" is required.`
        return false
      }
    }
  }
  error.value = ''
  return true
}

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

const handleSubmit = async () => {
  const allFields = formData.value?.fields || []
  for (const f of allFields) {
    if (f.required) {
      const val = answers.value[f.id]
      const files = fileUploads.value[f.id] || []
      if (f.type === 'file') {
        if (!files.length && (!Array.isArray(val) || !val.length)) {
          error.value = `"${f.label}" is required.`
          step.value = groups.value.findIndex(g => g.includes(f)) + 2
          return
        }
      } else if (!val) {
        error.value = `"${f.label}" is required.`
        step.value = groups.value.findIndex(g => g.includes(f)) + 2
        return
      }
    }
  }

  submitting.value = true
  error.value = ''

  try {
    for (const f of allFields) {
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

      const pastedLinks = Array.isArray(answers.value[f.id]) ? answers.value[f.id] : []
      answers.value[f.id] = [...uploadedUrls, ...pastedLinks].filter(Boolean)
    }

    const nameFieldId  = allFields.find((f: any) => f.type === 'text' && f.label.toLowerCase().includes('name'))?.id
    const emailFieldId = allFields.find((f: any) => f.type === 'email')?.id

    const { error: subErr } = await supabase.from('onboarding_submissions').insert({
      form_id:         formData.value.id,
      responses:       answers.value,
      submitter_name:  nameFieldId  ? answers.value[nameFieldId]  : null,
      submitter_email: emailFieldId ? answers.value[emailFieldId] : null,
    })
    if (subErr) throw subErr

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
  <div class="min-h-screen bg-gray-50 font-sans flex flex-col">

    <div class="flex-1">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <div class="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-gray-500 text-sm">Loading form...</p>
        </div>
      </div>

      <!-- Error (no form) -->
      <div v-else-if="error && !formData" class="flex items-center justify-center min-h-screen">
        <div class="text-center max-w-sm">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500" />
          </div>
          <p class="text-gray-800 font-bold text-lg">Form Not Available</p>
          <p class="text-gray-500 text-sm mt-2">{{ error }}</p>
        </div>
      </div>

      <!-- Done -->
      <div v-else-if="done" class="flex items-center justify-center min-h-screen px-4">
        <div class="text-center max-w-md">
          <div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <UIcon name="i-heroicons-check" class="w-12 h-12 text-green-600" />
          </div>
          <h1 class="text-gray-900 font-bold text-2xl mb-2">Thank You!</h1>
          <p class="text-gray-500 text-lg">
            Your responses have been submitted. {{ provider.organization || provider.name }} will review them and get back to you soon.
          </p>
          <p class="text-gray-400 text-sm mt-4">If you have any questions, reach out directly.</p>
        </div>
      </div>

      <!-- Journey -->
      <div v-else-if="formData" class="max-w-2xl mx-auto px-4 py-10">
        <!-- Provider card -->
        <div v-if="!isDoneStep" class="flex items-center gap-4 mb-8">
          <div class="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            <img v-if="provider.avatar" :src="provider.avatar" class="w-full h-full object-cover" />
            <UIcon v-else name="i-heroicons-building-office" class="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <p class="text-xs text-gray-500 font-medium">Brief for</p>
            <p class="text-gray-900 font-bold">{{ provider.organization || provider.name }}</p>
          </div>
        </div>

        <!-- Progress bar -->
        <div v-if="!isDoneStep && !isWelcomeStep" class="mb-6">
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{{ groupLabels[currentGroupIndex] || '' }}</span>
            <span>{{ step - 1 }} of {{ totalSteps - 1 }}</span>
          </div>
          <div class="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :style="{ width: `${((step - 1) / (totalSteps - 1)) * 100}%`, backgroundColor: provider.brandColor }"
            ></div>
          </div>
        </div>

        <!-- Step 1: Welcome -->
        <div v-if="isWelcomeStep" class="text-center">
          <h1 class="text-3xl font-bold text-gray-900 mb-4">{{ formData.title }}</h1>
          <p v-if="formData.description" class="text-gray-500 mb-8">{{ formData.description }}</p>
          <p class="text-gray-600 text-sm mb-12">
            This brief helps {{ provider.organization || provider.name }} understand your needs. It takes about {{ totalSteps - 1 }} minutes.
          </p>
          <button
            @click="nextStep"
            class="w-full py-4 rounded-2xl font-bold text-white text-lg shadow-lg transition-all hover:opacity-90"
            :style="{ backgroundColor: provider.brandColor }"
          >
            Get Started
          </button>
        </div>

        <!-- Step 2..N: Field groups -->
        <div v-else-if="currentGroup.length" class="space-y-6">
          <div v-for="field in currentGroup" :key="field.id">
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">
              {{ field.label }}
              <span v-if="field.required" class="text-red-500">*</span>
            </label>

            <textarea
              v-if="field.type === 'textarea'"
              v-model="answers[field.id]"
              :placeholder="field.placeholder || ''"
              rows="4"
              class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] resize-none placeholder-gray-400 transition-all"
            ></textarea>

            <div v-else-if="field.type === 'select'" class="relative">
              <select
                v-model="answers[field.id]"
                class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] appearance-none cursor-pointer"
              >
                <option value="">Select an option...</option>
                <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            </div>

            <div v-else-if="field.type === 'file'">
              <label
                class="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[var(--brand-color)] transition-colors bg-white"
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
                  <span v-if="field.acceptedTypes?.length">· {{ field.acceptedTypes.join(', ') }}</span>
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
                  <button @click="removeFile(field.id, idx)" class="text-gray-400 hover:text-red-500">
                    <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div class="mt-3">
                <p class="text-xs text-gray-400 mb-1">Or paste a Google Drive / Dropbox link:</p>
                <div class="flex gap-2">
                  <input
                    v-model="linkInputs[field.id]"
                    type="url"
                    placeholder="https://drive.google.com/..."
                    class="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] placeholder-gray-400"
                    @keydown.enter.prevent="addLink(field.id)"
                  />
                  <button
                    v-if="linkInputs[field.id]"
                    @click="addLink(field.id)"
                    class="px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                    :style="{ backgroundColor: provider.brandColor }"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <input
              v-else
              v-model="answers[field.id]"
              :type="field.type"
              :placeholder="field.placeholder || ''"
              class="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-color)] placeholder-gray-400 transition-all"
            />
          </div>

          <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {{ error }}
          </div>
        </div>

        <!-- Review step -->
        <div v-else-if="isReviewStep" class="space-y-6">
          <h2 class="text-xl font-bold text-gray-900">Review Your Brief</h2>
          <p class="text-gray-500 text-sm">Double-check everything before submitting.</p>
          <div
            v-for="field in (formData.fields || [])"
            :key="field.id"
            class="bg-white rounded-xl border border-gray-200 p-4"
          >
            <p class="text-xs font-semibold text-gray-500 uppercase mb-1">{{ field.label }}</p>
            <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ answers[field.id] || '—' }}</p>
            <button
              @click="step = groups.findIndex(g => g.includes(field)) + 2"
              class="text-xs font-medium mt-2 hover:underline"
              :style="{ color: provider.brandColor }"
            >
              Edit
            </button>
          </div>

          <!-- Terms of use checkbox -->
          <div class="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              v-model="agreedToTerms"
              class="mt-0.5 w-4 h-4 rounded border-gray-300 text-[var(--brand-color)] focus:ring-[var(--brand-color)]"
            />
            <div>
              <label for="terms" class="text-sm text-gray-700">
                I agree to the <a href="/terms" target="_blank" class="underline" :style="{ color: provider.brandColor }">Terms of Use</a> and understand that my responses will be shared with {{ provider.organization || provider.name }}.
              </label>
            </div>
          </div>

          <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{{ error }}</div>
        </div>

        <!-- Navigation -->
        <div v-if="!isWelcomeStep && !isDoneStep" class="mt-10 flex gap-3">
          <button
            @click="prevStep"
            class="px-5 py-3 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all"
          >
            Back
          </button>
          <button
            @click="nextStep"
            :disabled="submitting"
            class="flex-1 py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            :style="{ backgroundColor: provider.brandColor }"
          >
            <div v-if="submitting" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span v-if="isReviewStep">{{ submitting ? 'Submitting...' : 'Confirm & Submit' }}</span>
            <span v-else>{{ submitting ? 'Submitting...' : 'Continue' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer v-if="!loading" class="border-t border-gray-200 bg-white py-4">
      <div class="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 px-4">
        <div class="flex items-center gap-2">
          <span>Powered by</span>
          <a href="/" target="_blank" class="hover:opacity-80 transition-opacity">
            <img src="/img/clientbaselogo.png" alt="ClientBase" class="h-16 w-auto" />
          </a>
        </div>
        <div>
          <a href="/terms" target="_blank" class="hover:text-gray-500 transition-colors">Terms of Use</a>
          <span class="mx-2">·</span>
          <a href="/privacy" target="_blank" class="hover:text-gray-500 transition-colors">Privacy Policy</a>
        </div>
      </div>
    </footer>

  </div>
</template>