<script setup lang="ts">
import { useQuickEngagementParser } from '~/composables/useQuickEngagementParser'

const emit = defineEmits(['close', 'created'])
const props = defineProps<{ clientId?: string }>()

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const config = useRuntimeConfig()

// ── Tabs ──────────────────────────────────────────────────────────────────────
const mode = ref<'manual' | 'prompt' | 'markdown'>('manual')

// ── State ────────────────────────────────────────────────────────────────────
const creating = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const fieldErrors = ref<Record<string, string>>({})

// Logo upload
const logoPreview = ref<string | null>(null)
const logoUploading = ref(false)

// Editable fields (always visible)
const editable = ref({
  client_name: '',
  contact_email: '',
  contact_phone: '',
  client_website: '',
  client_category: 'Development',
  client_logo_url: null as string | null,
  project_name: '',
  project_description: '',
  project_budget: null as number | null,
  project_currency: 'NGN',
  project_start_date: '',
  project_end_date: '',
})

const categories = [
  'Development', 'Web Design', 'Web Development', 'Mobile App',
  'UI/UX Design', 'Branding', 'Copywriting', 'SEO/Marketing',
  'Consulting', 'Maintenance', 'Fintech', 'Educational',
  'Internal', 'Personal', 'Other',
]

// ── Logo upload ──────────────────────────────────────────────────────────────
const handleLogoUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { errorMsg.value = 'Logo must be smaller than 5MB'; return }
  if (!file.type.startsWith('image/')) { errorMsg.value = 'Only image files are allowed'; return }
  logoPreview.value = URL.createObjectURL(file)
  logoUploading.value = true
  errorMsg.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', config.public.CloudinaryPreset)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${config.public.CloudinaryCloudName}/image/upload`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Upload failed')
    editable.value.client_logo_url = data.secure_url
  } catch (e: any) {
    errorMsg.value = e.message || 'Logo upload failed'
    logoPreview.value = null
  } finally { logoUploading.value = false }
}

const removeLogo = () => {
  editable.value.client_logo_url = null
  logoPreview.value = null
}

// ── Pre‑fill client name if clientId provided ───────────────────────────────
if (props.clientId) {
  supabase.from('clients').select('name').eq('id', props.clientId).single().then(({ data }) => {
    if (data) editable.value.client_name = data.name
  })
}

// ── Markdown parsing ─────────────────────────────────────────────────────────
const markdownText = ref('')

const handleMarkdownFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const content = await file.text()
  markdownText.value = content
  parseMarkdown(content)
}

const parseMarkdown = (md: string) => {
  errorMsg.value = ''
  successMsg.value = ''
  fieldErrors.value = {}

  const lines = md.split('\n').map(l => l.trim())
  let currentSection: 'none' | 'client' | 'project' = 'none'

  for (const line of lines) {
    if (line.startsWith('# ') && /client/i.test(line)) {
      currentSection = 'client'
      const name = line.replace(/# Client:?\s*/i, '').trim()
      if (name) editable.value.client_name = name
      continue
    }
    if (line.startsWith('# ') && /project/i.test(line)) {
      currentSection = 'project'
      const name = line.replace(/# Project:?\s*/i, '').trim()
      if (name) editable.value.project_name = name
      continue
    }
    if (line.startsWith('## ') || line.startsWith('### ') || line === '') continue

    const keyVal = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (!keyVal) continue

    const key = keyVal[1].trim().toLowerCase()
    const value = keyVal[2].trim()

    const setField = (section: 'client' | 'project') => {
      if (section === 'client') {
        switch (key) {
          case 'email': case 'contact_email': editable.value.contact_email = value; break
          case 'phone': case 'contact_phone': editable.value.contact_phone = value; break
          case 'website': editable.value.client_website = value; break
          case 'category': editable.value.client_category = value; break
        }
      } else {
        switch (key) {
          case 'name': editable.value.project_name = value; break
          case 'description': editable.value.project_description = value; break
          case 'budget':
            const parts = value.split(' ')
            const amount = parseFloat(parts[0])
            if (!isNaN(amount)) editable.value.project_budget = amount
            if (parts[1]) editable.value.project_currency = parts[1].toUpperCase()
            break
          case 'start_date': editable.value.project_start_date = value; break
          case 'end_date': editable.value.project_end_date = value; break
        }
      }
    }

    if (currentSection !== 'none') {
      setField(currentSection)
    } else {
      // Legacy flat format – apply to both sections where possible
      setField('client')
      setField('project')
    }
  }

  successMsg.value = 'Markdown data loaded!'
  setTimeout(() => { successMsg.value = '' }, 3000)
}

// ── Prompt parsing (debounced) ───────────────────────────────────────────────
const promptText = ref('')
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

watch(promptText, (newVal) => {
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  if (newVal.trim().length > 3) {
    debounceTimer.value = setTimeout(() => {
      const result = useQuickEngagementParser(newVal)
      if (result) {
        editable.value.client_name = props.clientId ? editable.value.client_name : result.client_name || ''
        editable.value.client_website = result.client_website || ''
        editable.value.client_category = result.client_category || 'Development'
        editable.value.project_name = result.project_name || (result.client_name ? `${result.client_name} Project` : '')
        editable.value.project_description = result.project_description || ''
        editable.value.project_budget = result.budget || null
        editable.value.project_currency = result.currency || 'NGN'
        editable.value.project_start_date = result.start_date || ''
        editable.value.project_end_date = result.end_date || ''
        successMsg.value = 'Parsed! Review the fields below.'
        setTimeout(() => { successMsg.value = '' }, 2000)
      }
    }, 400)
  }
})

// ── Claude Skill copy (hidden in Markdown tab) ──────────────────────────────
const showClaudeSkill = ref(false)

const CLAUDE_SKILL_MD = `---
name: clientbase-engagement
description: >
  Creates a structured engagement Markdown file for ClientBase import. Use when
  the user asks to set up a new client, create a project, onboard a client, start
  an engagement, track a new project, add a client to ClientBase, or mentions
  client names with budgets, deadlines, or project details — even if they don't
  say "engagement" or "ClientBase" explicitly.
---
# ClientBase Engagement Creator
… (full skill truncated for brevity, same as original)`

const copyClaudePrompt = () => {
  navigator.clipboard.writeText(CLAUDE_SKILL_MD).then(() => {
    successMsg.value = 'Claude Skill copied! Save as SKILL.md'
    setTimeout(() => { successMsg.value = '' }, 3000)
  }).catch(() => errorMsg.value = 'Failed to copy')
}

// ── User ID ──────────────────────────────────────────────────────────────────
const getUserId = async (): Promise<string> => {
  if (user.value?.id) return user.value.id
  const { data } = await supabase.auth.getUser()
  if (data.user?.id) return data.user.id
  throw new Error('Not authenticated')
}

// ── Validation & Submit ──────────────────────────────────────────────────────
const validateForm = (): boolean => {
  fieldErrors.value = {}
  let valid = true
  if (!props.clientId && !editable.value.client_name.trim()) {
    fieldErrors.value.client_name = 'Client name is required'
    valid = false
  }
  if (!editable.value.project_name.trim()) {
    fieldErrors.value.project_name = 'Project name is required'
    valid = false
  }
  if (editable.value.contact_email && !editable.value.contact_email.includes('@')) {
    fieldErrors.value.contact_email = 'Invalid email'
    valid = false
  }
  return valid
}

const handleCreate = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  if (!validateForm()) return

  creating.value = true
  try {
    const userId = await getUserId()
    let clientId = props.clientId || null

    if (!clientId && editable.value.client_name) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', editable.value.client_name).maybeSingle()
      if (existing) clientId = existing.id
      else {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: editable.value.client_name,
            website: editable.value.client_website || null,
            category: editable.value.client_category,
            contact_email: editable.value.contact_email || null,
            contact_phone: editable.value.contact_phone || null,
            logo_url: editable.value.client_logo_url || null,
          })
          .select('id').single()
        if (clientError) throw clientError
        clientId = newClient.id
      }
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        client_id: clientId,
        user_id: userId,
        name: editable.value.project_name || 'Untitled Project',
        description: editable.value.project_description || null,
        budget: editable.value.project_budget || null,
        currency: editable.value.project_currency,
        start_date: editable.value.project_start_date || null,
        end_date: editable.value.project_end_date || null,
        status: 'lead',
      })
      .select('id').single()
    if (projectError) throw projectError

    successMsg.value = 'Engagement created!'
    setTimeout(() => {
      emit('created', { projectId: project.id })
      emit('close')
    }, 1500)
  } catch (e: any) {
    errorMsg.value = e.message || 'Something went wrong.'
  } finally { creating.value = false }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="w-full max-w-2xl bg-[#0d1525] border border-white/8 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h2 class="text-lg font-bold text-white">New Engagement</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            {{ mode === 'prompt' ? 'Describe the engagement in plain English.' : mode === 'markdown' ? 'Import a Markdown file.' : 'Fill in the details below.' }}
            <span v-if="props.clientId" class="text-primary ml-2">Client pre‑filled.</span>
          </p>
        </div>
        <button @click="emit('close')" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8">
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-5">
        <!-- ===== Mode Tabs ===== -->
        <div class="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit">
          <button
            v-for="m in (['manual', 'prompt', 'markdown'] as const)"
            :key="m"
            @click="mode = m"
            :class="mode === m ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          >
            {{ m === 'manual' ? 'Manual' : m === 'prompt' ? 'Prompt' : 'Markdown' }}
          </button>
        </div>

        <!-- ===== Import Area (Prompt / Markdown) ===== -->
        <Transition name="tab-fade" mode="out-in">
          <div v-if="mode === 'prompt'" key="prompt" class="space-y-2">
            <label class="block text-xs font-semibold text-slate-400">What do you need to set up?</label>
            <textarea v-model="promptText" rows="4" placeholder="e.g., Build a website for Acme Corp, ₦500k, due July 30" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none" />
            <p class="text-[10px] text-slate-500">The fields below will update automatically.</p>
          </div>

          <div v-else-if="mode === 'markdown'" key="markdown" class="space-y-3">
            <div class="relative border-2 border-dashed border-white/8 rounded-2xl p-6 text-center hover:border-primary/30 transition-all cursor-pointer">
              <input type="file" accept=".md" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" @change="handleMarkdownFile" />
              <UIcon name="i-heroicons-document-text" class="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <p class="text-sm text-white font-semibold">Upload Markdown file</p>
              <p class="text-xs text-slate-500 mt-1">Or paste below</p>
            </div>
            <textarea v-model="markdownText" placeholder="Paste markdown here…" rows="4" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none" @input="parseMarkdown(markdownText)" />
            <button
              type="button"
              @click="showClaudeSkill = !showClaudeSkill"
              class="text-xs text-slate-500 hover:text-primary transition-colors"
            >
              Need a Claude Skill to generate this file?
            </button>
            <div v-if="showClaudeSkill" class="bg-white/2 border border-white/6 rounded-xl p-4">
              <p class="text-xs text-slate-400 mb-2">Copy the markdown below and save as <code>SKILL.md</code> in your Claude skills folder.</p>
              <pre class="text-xs text-slate-500 whitespace-pre-wrap max-h-40 overflow-y-auto">{{ CLAUDE_SKILL_MD }}</pre>
              <button @click="copyClaudePrompt" class="mt-3 w-full py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/6 text-xs font-semibold text-slate-400 hover:text-white transition-all">
                <UIcon name="i-heroicons-clipboard-document" class="w-4 h-4 inline mr-1" /> Copy Skill
              </button>
            </div>
          </div>
        </Transition>

        <!-- ===== Editable Fields (always visible) ===== -->
        <div class="space-y-5">
          <h3 class="text-sm font-semibold text-white flex items-center gap-2">
            <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-primary" />
            Details
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Client section (hidden if clientId provided) -->
            <div v-if="!props.clientId" class="space-y-3">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Client</p>
              <div>
                <input v-model="editable.client_name" placeholder="Client name *" class="w-full bg-white/4 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none" :class="fieldErrors.client_name ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'" />
                <p v-if="fieldErrors.client_name" class="text-xs text-red-400 mt-1">{{ fieldErrors.client_name }}</p>
              </div>
              <div>
                <input v-model="editable.contact_email" placeholder="Contact email (optional)" type="email" class="w-full bg-white/4 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none" :class="fieldErrors.contact_email ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'" />
                <p v-if="fieldErrors.contact_email" class="text-xs text-red-400 mt-1">{{ fieldErrors.contact_email }}</p>
              </div>
              <input v-model="editable.contact_phone" placeholder="Contact phone (optional)" type="tel" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
              <input v-model="editable.client_website" placeholder="Website (optional)" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
              <div class="relative">
                <select v-model="editable.client_category" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer">
                  <option v-for="cat in categories" :key="cat" :value="cat" class="bg-[#0d1525] text-white">{{ cat }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-400 mb-1.5">Logo (optional)</p>
                <div class="flex items-center gap-3">
                  <div class="relative group cursor-pointer shrink-0">
                    <div class="w-12 h-12 rounded-xl bg-white/4 border border-white/8 flex items-center justify-center overflow-hidden">
                      <img v-if="logoPreview" :src="logoPreview" class="w-full h-full object-cover" />
                      <UIcon v-else name="i-heroicons-photo" class="w-5 h-5 text-slate-500" />
                    </div>
                    <input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" @change="handleLogoUpload" :disabled="logoUploading" />
                  </div>
                  <button v-if="logoPreview" @click="removeLogo" class="text-xs text-red-400 hover:text-red-300">Remove</button>
                  <UIcon v-if="logoUploading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-primary" />
                </div>
              </div>
            </div>

            <!-- Project section -->
            <div :class="props.clientId ? 'md:col-span-2' : ''">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Project</p>
              <div class="space-y-3">
                <div>
                  <input v-model="editable.project_name" placeholder="Project name *" class="w-full bg-white/4 border rounded-xl px-4 py-3 text-sm text-white focus:outline-none" :class="fieldErrors.project_name ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'" />
                  <p v-if="fieldErrors.project_name" class="text-xs text-red-400 mt-1">{{ fieldErrors.project_name }}</p>
                </div>
                <textarea v-model="editable.project_description" placeholder="Description (optional)" rows="2" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none" />
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <select v-model="editable.project_currency" class="absolute left-3 top-1/2 -translate-y-1/2 bg-transparent text-xs font-semibold text-slate-400 focus:outline-none appearance-none cursor-pointer w-12 z-10">
                      <option value="NGN" class="bg-[#0d1525] text-white">NGN</option>
                      <option value="USD" class="bg-[#0d1525] text-white">USD</option>
                      <option value="GBP" class="bg-[#0d1525] text-white">GBP</option>
                      <option value="EUR" class="bg-[#0d1525] text-white">EUR</option>
                    </select>
                    <input v-model.number="editable.project_budget" type="number" placeholder="Budget" class="w-full bg-white/4 border border-white/8 rounded-xl pl-14 pr-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <input v-model="editable.project_start_date" type="date" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
                  <input v-model="editable.project_end_date" type="date" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Feedback banners -->
        <Transition name="banner">
          <div v-if="errorMsg" class="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-sm text-red-400 flex items-start gap-3">
            <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 shrink-0 mt-0.5" />
            <span>{{ errorMsg }}</span>
          </div>
        </Transition>
        <Transition name="banner">
          <div v-if="successMsg" class="bg-emerald-400/5 border border-emerald-400/10 rounded-xl p-4 text-sm text-emerald-400 flex items-start gap-3">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 shrink-0 mt-0.5" />
            <span>{{ successMsg }}</span>
          </div>
        </Transition>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-white/5 shrink-0 flex gap-3">
        <button @click="emit('close')" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
        <button
          @click="handleCreate"
          :disabled="creating"
          class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
        >
          <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          <span v-else>Create Engagement</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.banner-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.banner-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>