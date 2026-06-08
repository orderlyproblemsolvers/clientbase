<script setup lang="ts">

// ⚠️ All script logic remains exactly the same — no functional changes.
const { $md } = useNuxtApp()
const route   = useRoute()
const supabase = useSupabaseClient()
const user    = useSupabaseUser()

// ── Safe Reactive Route Parameter ─────────────────────────────────────────────
const projectId = computed(() => {
  const id = route.params.id
  if (!id || id === 'undefined' || id === 'null') return null
  return id
})

// ── State ─────────────────────────────────────────────────────────────────────
const loading     = ref(true)
const activeTab   = ref('secrets')
const projectData = ref(null)
const clientData  = ref(null)
const secrets     = ref([])
const files       = ref([])
const uploading   = ref(false)
const isDeleting  = ref(false)
const copiedSecretId = ref(null)

// Edit project
const showEditModal  = ref(false)
const savingEdit     = ref(false)
const editForm = ref({
  name: '', description: '', status: 'active',
  start_date: '', end_date: '', budget: '', currency: 'NGN',
})

// Secrets
const showSecretModal = ref(false)
const newSecret = ref({ name: '', value: '' })

// Notes
const isEditingNotes = ref(false)
const notesDraft     = ref('')
const isPreviewMode  = ref(false)

const briefSubmission = ref(null)
const briefForm       = ref(null)

// ── Share link ────────────────────────────────────────────────────────────────
const shareToken = ref<string | null>(null)
const generatingShareLink = ref(false)
const copiedShareLink = ref(false)

const generateShareLink = async () => {
  if (shareToken.value) return // already generated
  generatingShareLink.value = true
  try {
    let token: string | null = projectData.value?.share_token
    if (!token) {
      token = crypto.randomUUID()
      const { error } = await supabase
        .from('projects')
        .update({ share_token: token, updated_at: new Date().toISOString() })
        .eq('id', projectId.value)
      if (error) throw error
      projectData.value.share_token = token
    }
    shareToken.value = token
  } catch (e: any) {
    alert(e.message)
  } finally {
    generatingShareLink.value = false
  }
}

const copyShareLink = () => {
  if (!shareToken.value) return
  const url = `${window.location.origin}/view/${shareToken.value}`
  navigator.clipboard.writeText(url)
  copiedShareLink.value = true
  setTimeout(() => (copiedShareLink.value = false), 2000)
}

const revokeShareLink = async () => {
  if (!confirm('Revoke the current share link? The old link will stop working.')) return
  try {
    const { error } = await supabase
      .from('projects')
      .update({ share_token: null, updated_at: new Date().toISOString() })
      .eq('id', projectId.value)
    if (error) throw error
    projectData.value.share_token = null
    shareToken.value = null
  } catch (e: any) {
    alert(e.message)
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  // Guard early if no valid projectId exists
  if (!projectId.value) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    // Project + client join
    const { data: pData } = await supabase
      .from('projects')
      .select('*, clients(id, name, category, website)')
      .eq('id', projectId.value)
      .single()

    projectData.value = pData
    clientData.value  = pData?.clients
    notesDraft.value  = pData?.notes || ''

    // Load existing share token
    shareToken.value = pData?.share_token || null

    // Populate edit form
    editForm.value = {
      name:        pData?.name        || '',
      description: pData?.description || '',
      status:      pData?.status      || 'active',
      start_date:  pData?.start_date  || '',
      end_date:    pData?.end_date    || '',
      budget:      pData?.budget      ? String(pData.budget) : '',
      currency:    pData?.currency    || 'NGN',
    }

    // Secrets (via encrypted server route)
    const sData = await $fetch('/api/secrets', {
  query: { project_id: projectId.value }
})
    secrets.value = sData?.map((s) => ({ ...s, isRevealed: false })) || []

    // Files
    const { data: fData } = await supabase
      .from('files')  
      .select('*')
      .eq('project_id', projectId.value)
      .order('created_at', { ascending: false })
    files.value = fData || []

    // Onboarding submission
    if (pData?.onboarding_submission_id) {
      const { data: subData } = await supabase
        .from('onboarding_submissions')
        .select('*, onboarding_forms(id, title, fields, client_id)')
        .eq('id', pData.onboarding_submission_id)
        .single()
      briefSubmission.value = subData
      briefForm.value       = subData?.onboarding_forms
    }

  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Edit project ──────────────────────────────────────────────────────────────
const saveEdit = async () => {
  if (!projectId.value) return
  savingEdit.value = true
  try {
    const { error } = await supabase
      .from('projects')
      .update({
        name: editForm.value.name,
        description: editForm.value.description || null,
        status: editForm.value.status,
        start_date: editForm.value.start_date  || null,
        end_date: editForm.value.end_date    || null,
        budget: editForm.value.budget ? parseFloat(editForm.value.budget) : null,
        currency: editForm.value.currency,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', projectId.value)
    if (error) throw error
    showEditModal.value = false
    await fetchData()
  } catch (e) {
    alert('Error saving: ' + e.message)
  } finally {
    savingEdit.value = false
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────
const saveNotes = async () => {
  if (!projectId.value) return
  try {
    const { error } = await supabase
      .from('projects')
      .update({ notes: notesDraft.value, updated_at: new Date().toISOString() })
      .eq('id', projectId.value)
    if (error) throw error
    projectData.value.notes = notesDraft.value
    isEditingNotes.value = false
    isPreviewMode.value  = false
  } catch (e) {
    alert('Save failed: ' + e.message)
  }
}


// ── Secrets ───────────────────────────────────────────────────────────────────
const addSecret = async () => {
  if (!projectId.value) {
    alert('Project ID missing')
    return
  }
  if (!newSecret.value.name || !newSecret.value.value) return

  
  try {
    await $fetch('/api/secrets', {
      method: 'POST',
      body: { 
        user_id:  user.value.sub,
        client_id: clientData.value?.id || null, 
        project_id: projectId.value, 
        key_name: newSecret.value.name, 
        value: newSecret.value.value 
      }
    })
    showSecretModal.value = false
    newSecret.value = { name: '', value: '' }
    await fetchData()
  } catch (e) {
    alert(e.message || 'Error saving secret')
  }
}

const deleteSecret = async (id) => {
  if (!confirm('Delete this secret?')) return
  await $fetch('/api/secrets', { 
  method: 'DELETE', 
  query: { id } 
})
  await fetchData()
}

const copyToClipboard = (text, id) => {
  navigator.clipboard.writeText(text)
  copiedSecretId.value = id
  setTimeout(() => (copiedSecretId.value = null), 2000)
}

// ── Files ─────────────────────────────────────────────────────────────────────
const handleFileUpload = async (event) => {
  if (!projectId.value) return
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const ext      = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${user.value?.id}/${projectId.value}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('project_files')
      .upload(filePath, file)
    if (uploadError) throw uploadError

    const { error: dbError } = await supabase.from('files').insert({
      project_id: projectId.value,
      file_name:  file.name,
      file_path:  filePath,
      file_type:  file.type,
      client_id:  clientData.value?.id || null,
    })
    if (dbError) throw dbError
    await fetchData()
  } catch (e) {
    alert(e.message)
  } finally {
    uploading.value = false
  }
}

const downloadFile = async (path) => {
  const { data } = await supabase.storage
    .from('project_files')
    .createSignedUrl(path, 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

// ── Delete project ────────────────────────────────────────────────────────────
const deleteProject = async () => {
  if (!projectId.value) return
  if (!confirm('Permanently delete this project and all its data?')) return
  isDeleting.value = true
  try {
    const { data: filesToDelete } = await supabase
      .from('files')
      .select('file_path')
      .eq('project_id', projectId.value)

    if (filesToDelete?.length) {
      await supabase.storage
        .from('project_files')
        .remove(filesToDelete.map((f) => f.file_path))
    }

    await supabase.from('projects').delete().eq('id', projectId.value)
    return navigateTo(clientData.value ? `/clients/${clientData.value.id}` : '/')
  } catch (e) {
    alert('Error: ' + e.message)
  } finally {
    isDeleting.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusConfig = {
  lead:     { label: 'Lead',     dot: 'bg-slate-400',   badge: 'text-slate-300  bg-slate-400/10  border-slate-400/20'  },
  proposal: { label: 'Proposal', dot: 'bg-blue-400',    badge: 'text-blue-300   bg-blue-400/10   border-blue-400/20'   },
  active:   { label: 'Active',   dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
  review:   { label: 'Review',   dot: 'bg-amber-400',   badge: 'text-amber-300  bg-amber-400/10  border-amber-400/20'  },
  complete: { label: 'Complete', dot: 'bg-violet-400',  badge: 'text-violet-300 bg-violet-400/10 border-violet-400/20' },
  archived: { label: 'Archived', dot: 'bg-slate-600',   badge: 'text-slate-500  bg-slate-600/10  border-slate-600/20'  },
}

const formatBudget = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)

const tabs = [
  { key: 'secrets',    label: 'Secrets',    icon: 'i-heroicons-key' },
  { key: 'notes',      label: 'Notes',      icon: 'i-heroicons-document-text' },
  { key: 'files',      label: 'Files',      icon: 'i-heroicons-folder-open' },
  { key: 'milestones', label: 'Milestones', icon: 'i-heroicons-flag' },
  { key: 'calendar',   label: 'Calendar',   icon: 'i-heroicons-calendar-days' },
  { key: 'brief',      label: 'Brief',      icon: 'i-heroicons-clipboard-document-list' },
]

const highlightedNotes = computed(() => {
  if (!notesDraft.value) return ''
  return $md.render(notesDraft.value)
})

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Breadcrumb -->
    <nav class="flex items-center gap-1.5 text-sm text-slate-500 mb-8" aria-label="Breadcrumb">
      <NuxtLink to="/" class="flex items-center gap-1.5 hover:text-slate-300 transition-colors duration-150">
        <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
        <span>Dashboard</span>
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <NuxtLink
        v-if="clientData"
        :to="`/clients/${clientData.id}`"
        class="hover:text-slate-300 transition-colors duration-150"
      >
        {{ clientData.name }}
      </NuxtLink>
      <UIcon v-if="clientData" name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <span class="text-slate-300 truncate max-w-48">{{ projectData?.name || '…' }}</span>
    </nav>

    <!-- Loading Skeleton -->
    <div v-if="loading && !projectData" class="space-y-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-white/5 animate-pulse"></div>
        <div class="space-y-2">
          <div class="h-8 w-56 bg-white/5 animate-pulse rounded-lg"></div>
          <div class="h-4 w-40 bg-white/5 animate-pulse rounded-lg"></div>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-24 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
      <div class="h-12 bg-white/5 animate-pulse rounded-2xl"></div>
      <div class="h-64 bg-white/5 animate-pulse rounded-2xl"></div>
    </div>

    <div v-else-if="projectData" class="space-y-8">

      <!-- ===== Hero Header ===== -->
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent border border-white/6 p-6 md:p-8">
        <!-- Background accent -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        
        <div class="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <!-- Left: Project identity -->
          <div class="flex items-start gap-5">
            <div class="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <span class="text-primary font-bold text-xl tracking-tight">
                {{ projectData.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?' }}
              </span>
            </div>

            <div class="space-y-3">
              <div>
                <div class="flex items-center gap-3 flex-wrap mb-2">
                  <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">
                    {{ projectData.name }}
                  </h1>
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                    :class="statusConfig[projectData.status]?.badge || statusConfig.active.badge"
                  >
                    <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[projectData.status]?.dot || 'bg-emerald-400'" aria-hidden="true"></span>
                    {{ statusConfig[projectData.status]?.label || projectData.status }}
                  </span>
                </div>

                <NuxtLink
                  v-if="clientData"
                  :to="`/clients/${clientData.id}`"
                  class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors duration-150"
                >
                  <UIcon name="i-heroicons-building-office-2" class="w-4 h-4" />
                  <span>{{ clientData.name }}</span>
                </NuxtLink>
              </div>

              <p v-if="projectData.description" class="text-slate-400 text-sm max-w-2xl leading-relaxed">
                {{ projectData.description }}
              </p>
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="flex items-center gap-2 shrink-0 lg:self-start">
            <button
              v-if="!shareToken"
              @click="generateShareLink"
              :disabled="generatingShareLink"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/6 hover:border-white/10 transition-all duration-150 active:scale-[0.98] shrink-0"
              aria-label="Generate client share link"
            >
              <UIcon v-if="generatingShareLink" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
              <UIcon v-else name="i-heroicons-share" class="w-4 h-4" />
              <span class="hidden sm:inline">Share with Client</span>
            </button>
            <template v-else>
              <button
                @click="copyShareLink"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/30 transition-all duration-150 active:scale-[0.98] shrink-0"
                aria-label="Copy client share link"
              >
                <UIcon :name="copiedShareLink ? 'i-heroicons-check' : 'i-heroicons-link'" class="w-4 h-4" />
                <span class="hidden sm:inline">{{ copiedShareLink ? 'Copied!' : 'Copy Client Link' }}</span>
              </button>
              <button
                @click="revokeShareLink"
                class="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/6 hover:border-red-500/20 transition-all duration-150 shrink-0"
                aria-label="Revoke share link"
                title="Revoke link"
              >
                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </template>
            <button
              @click="showEditModal = true"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/6 hover:border-white/10 transition-all duration-150 active:scale-[0.98] shrink-0"
              aria-label="Edit project"
            >
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              <span class="hidden sm:inline">Edit</span>
            </button>
          </div>
        </div>

        <!-- Meta Cards inline -->
        <div class="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-slate-400" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Start</p>
              <p class="text-sm font-medium text-white truncate">
                {{ projectData.start_date
                  ? new Date(projectData.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-slate-400" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">End</p>
              <p class="text-sm font-medium text-white truncate">
                {{ projectData.end_date
                  ? new Date(projectData.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-slate-400" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Budget</p>
              <p class="text-sm font-medium text-white truncate">
                {{ projectData.budget ? formatBudget(projectData.budget, projectData.currency) : '—' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-currency-dollar" class="w-4 h-4 text-slate-400" />
            </div>
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Currency</p>
              <p class="text-sm font-medium text-white">{{ projectData.currency }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Tabs ===== -->
      <div class="bg-white/5 p-1 rounded-xl flex gap-1 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="[
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 whitespace-nowrap',
            activeTab === tab.key
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          ]"
          :aria-label="tab.label"
          :aria-selected="activeTab === tab.key"
          role="tab"
        >
          <UIcon :name="tab.icon" class="w-4 h-4" />
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </button>
      </div>

      <!-- ===== Tab Content ===== -->
      <div class="min-h-[400px]">
        <!-- SECRETS TAB -->
        <div v-if="activeTab === 'secrets'" class="space-y-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-white">Secrets</h2>
              <p class="text-xs text-slate-500 mt-0.5">Securely store API keys and tokens for this project.</p>
            </div>
            <button
              @click="showSecretModal = true"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
              aria-label="Add new secret"
            >
              <UIcon name="i-heroicons-plus" class="w-4 h-4" />
              Add Secret
            </button>
          </div>

          <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
            <div v-if="secrets.length === 0" class="p-16 text-center">
              <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <UIcon name="i-heroicons-lock-closed" class="w-7 h-7 text-slate-600" />
              </div>
              <p class="text-sm font-semibold text-slate-300 mb-1">No secrets stored</p>
              <p class="text-xs text-slate-500 max-w-xs mx-auto">Add API keys, tokens, or other sensitive values for this project.</p>
            </div>

            <div v-else>
              <div class="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-white/5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5">
                <div class="col-span-3">Key Name</div>
                <div class="col-span-7">Value</div>
                <div class="col-span-2 text-right">Actions</div>
              </div>

              <div
                v-for="s in secrets"
                :key="s.id"
                class="px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors duration-150 flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center"
              >
                <div class="md:col-span-3 font-medium text-white text-sm flex items-center gap-2">
                  <UIcon name="i-heroicons-key" class="w-4 h-4 text-slate-500 shrink-0" />
                  <span class="truncate">{{ s.key_name }}</span>
                </div>

                <div class="md:col-span-7 w-full">
                  <button
                    @click="s.isRevealed = !s.isRevealed"
                    class="w-full text-left relative bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm focus:border-primary/40 focus:outline-none transition-all duration-150 group"
                    :aria-label="s.isRevealed ? 'Hide value' : 'Show value'"
                  >
                    <span
                      :class="!s.isRevealed ? 'blur-sm select-none opacity-50' : 'opacity-100'"
                      class="block transition-all duration-300 truncate font-mono"
                    >
                      {{ s.isRevealed ? s.value : '••••••••••••••••••••••••' }}
                    </span>
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                      {{ s.isRevealed ? 'Hide' : 'Show' }}
                    </span>
                  </button>
                </div>

                <div class="md:col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                  <button
                    @click="copyToClipboard(s.value, s.id)"
                    class="p-2 rounded-xl hover:bg-white/8 transition-colors duration-150 flex items-center justify-center"
                    :class="copiedSecretId === s.id ? 'text-emerald-400' : 'text-slate-400 hover:text-white'"
                    :aria-label="copiedSecretId === s.id ? 'Copied' : 'Copy to clipboard'"
                  >
                    <UIcon :name="copiedSecretId === s.id ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-5 h-5" />
                    <span class="text-xs font-medium ml-2 md:hidden">{{ copiedSecretId === s.id ? 'Copied' : 'Copy' }}</span>
                  </button>
                  <button
                    @click="deleteSecret(s.id)"
                    class="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors duration-150 flex items-center justify-center"
                    aria-label="Delete secret"
                  >
                    <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                    <span class="text-xs font-medium ml-2 md:hidden">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- NOTES TAB -->
        <div v-if="activeTab === 'notes'" class="space-y-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-white">Notes</h2>
              <p class="text-xs text-slate-500 mt-0.5">Markdown supported · project context & documentation</p>
            </div>
            <div class="flex gap-2">
              <button
                v-if="!isEditingNotes"
                @click="isEditingNotes = true"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/8 border border-white/6 text-slate-400 hover:text-white transition-all duration-150"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
                Edit
              </button>
              <template v-else>
                <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/6">
                  <button @click="isPreviewMode = false" :class="!isPreviewMode ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'" class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150">Write</button>
                  <button @click="isPreviewMode = true"  :class="isPreviewMode  ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'" class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150">Preview</button>
                </div>
                <button @click="isEditingNotes = false" class="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button @click="saveNotes" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]">
                  <UIcon name="i-heroicons-check" class="w-4 h-4" />
                  Save
                </button>
              </template>
            </div>
          </div>

          <div class="relative">
            <textarea
              v-if="isEditingNotes && !isPreviewMode"
              v-model="notesDraft"
              rows="18"
              class="w-full bg-white/[0.03] border border-white/6 rounded-2xl px-6 py-5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all duration-150 leading-relaxed resize-y font-mono"
              placeholder="# Notes, credentials, deployment steps…"
            ></textarea>

            <div v-else class="bg-white/[0.03] border border-white/6 rounded-2xl p-8 min-h-[400px]">
              <div
                v-if="notesDraft"
                class="prose prose-invert max-w-none prose-indigo leading-relaxed text-slate-300"
                v-html="highlightedNotes"
              ></div>
              <div v-else class="flex flex-col items-center justify-center h-full py-20 text-slate-500">
                <UIcon name="i-heroicons-pencil" class="w-12 h-12 opacity-20 mb-4" />
                <p class="text-sm font-medium">No notes yet</p>
                <p class="text-xs mt-1">Click "Edit" to add project documentation.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- FILES TAB -->
        <div v-if="activeTab === 'files'" class="space-y-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-white">Files</h2>
              <p class="text-xs text-slate-500 mt-0.5">Upload and manage project documents.</p>
            </div>
          </div>

          <div class="relative cursor-pointer group">
            <input
              type="file"
              @change="handleFileUpload"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              :disabled="uploading"
              aria-label="Upload a file"
            />
            <div class="border-2 border-dashed border-white/8 rounded-2xl p-16 text-center hover:border-primary/30 hover:bg-white/[0.02] transition-all duration-150">
              <div v-if="uploading" class="flex flex-col items-center text-primary animate-pulse">
                <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin mb-4" />
                <span class="text-sm font-semibold">Uploading…</span>
              </div>
              <div v-else class="flex flex-col items-center gap-4 text-slate-500">
                <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all duration-150">
                  <UIcon name="i-heroicons-cloud-arrow-up" class="w-8 h-8" />
                </div>
                <div>
                  <p class="text-white font-semibold text-base mb-1">Click or drag to upload</p>
                  <p class="text-xs uppercase tracking-wider">PDF, PNG, JPG (Max 5MB)</p>
                </div>
              </div>
            </div>
          </div>

          <div v-if="files.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="f in files"
              :key="f.id"
              class="flex items-center justify-between bg-white/[0.03] border border-white/6 rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-150 group"
            >
              <div class="flex items-center gap-4 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-white truncate">{{ f.file_name }}</p>
                  <p class="text-[10px] text-slate-500 mt-0.5">{{ new Date(f.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}</p>
                </div>
              </div>
              <button
                @click="downloadFile(f.file_path)"
                class="p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors duration-150 shrink-0"
                aria-label="Download file"
              >
                <UIcon name="i-heroicons-arrow-down-tray" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div v-else-if="!uploading" class="text-center py-12">
            <p class="text-sm text-slate-500">No files uploaded yet for this project.</p>
          </div>
        </div>

        <!-- MILESTONES TAB -->
        <div v-if="activeTab === 'milestones'" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-white mb-1">Milestones</h2>
            <p class="text-xs text-slate-500">Track key deliverables and deadlines.</p>
          </div>
          <ProjectMilestonesTab :project-id="projectId" />
        </div>

        <!-- CALENDAR TAB -->
        <div v-if="activeTab === 'calendar'" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-white mb-1">Calendar</h2>
            <p class="text-xs text-slate-500">Visual timeline of project events.</p>
          </div>
          <CalendarView :project-id="projectId" />
        </div>

        <!-- BRIEF TAB -->
        <div v-if="activeTab === 'brief'" class="space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-white mb-1">Client Brief</h2>
            <p class="text-xs text-slate-500">Onboarding submission linked to this project.</p>
          </div>

          <div v-if="!briefSubmission" class="border-2 border-dashed border-white/8 rounded-2xl py-16 text-center">
            <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <UIcon name="i-heroicons-clipboard-document-list" class="w-7 h-7 text-slate-600" />
            </div>
            <p class="text-sm font-semibold text-slate-300 mb-1">No onboarding brief linked</p>
            <p class="text-xs text-slate-500 mb-5">This project has no onboarding submission attached yet.</p>
            <NuxtLink
              :to="`/onboarding?client=${clientData?.id}`"
              class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
              Create Onboarding Form
            </NuxtLink>
          </div>

          <div v-else class="space-y-5">
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-base font-semibold text-white flex items-center gap-2">
                  <UIcon name="i-heroicons-clipboard-document-check" class="w-5 h-5 text-emerald-400" />
                  Client Brief
                </h3>
                <span class="text-xs text-slate-500">
                  Submitted {{ new Date(briefSubmission.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                </span>
              </div>
              <p v-if="briefForm?.title" class="text-sm text-slate-400 mb-2">{{ briefForm.title }}</p>
              <p v-if="briefSubmission.submitter_name" class="text-xs text-slate-500">
                From: {{ briefSubmission.submitter_name }}
                <span v-if="briefSubmission.submitter_email"> · {{ briefSubmission.submitter_email }}</span>
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <template v-for="field in (briefForm?.fields || []).sort((a: any, b: any) => a.position - b.position)" :key="field.id">
                <div
                  class="bg-white/[0.03] border border-white/6 rounded-2xl p-5"
                  :class="field.type === 'textarea' ? 'md:col-span-2' : ''"
                >
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{{ field.label }}</p>
                  <template v-if="field.type === 'file' || field.type === 'url'">
                    <div v-if="Array.isArray(briefSubmission.responses[field.id]) && briefSubmission.responses[field.id].length" class="space-y-2">
                      <a
                        v-for="(url, idx) in briefSubmission.responses[field.id]"
                        :key="idx"
                        :href="url"
                        target="_blank"
                        class="flex items-center gap-2 text-primary hover:text-white text-sm transition-colors truncate"
                      >
                        <UIcon name="i-heroicons-link" class="w-4 h-4 shrink-0" />
                        <span class="truncate">{{ url }}</span>
                      </a>
                    </div>
                    <a
                      v-else-if="briefSubmission.responses[field.id]"
                      :href="briefSubmission.responses[field.id]"
                      target="_blank"
                      class="flex items-center gap-2 text-primary hover:text-white text-sm transition-colors truncate"
                    >
                      <UIcon name="i-heroicons-link" class="w-4 h-4 shrink-0" />
                      <span class="truncate">{{ briefSubmission.responses[field.id] }}</span>
                    </a>
                    <p v-else class="text-sm text-slate-600 italic">—</p>
                  </template>
                  <p v-else class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {{ briefSubmission.responses[field.id] || '—' }}
                  </p>
                </div>
              </template>
            </div>

            <div class="text-right">
              <NuxtLink
                v-if="briefForm?.id"
                :to="`/onboarding/${briefForm.id}`"
                class="text-xs text-slate-500 hover:text-primary transition-colors"
              >
                View full form & submission →
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Danger Zone ===== -->
      <section class="pt-8 border-t border-white/5">
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-1.5">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5" aria-hidden="true" />
          Danger Zone
        </p>
        <div class="bg-red-500/[0.04] border border-red-500/10 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p class="text-sm font-semibold text-white mb-0.5">Delete this project</p>
            <p class="text-xs text-slate-500 leading-relaxed">
              Permanently removes the project along with all secrets, files, and events. This action cannot be undone.
            </p>
          </div>
          <button
            @click="deleteProject"
            :disabled="isDeleting"
            class="shrink-0 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
            aria-label="Delete project permanently"
          >
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <template v-else>
              <UIcon name="i-heroicons-trash" class="w-4 h-4" aria-hidden="true" />
              Delete Project
            </template>
          </button>
        </div>
      </section>
    </div>

    <!-- ===== Add Secret Modal ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showSecretModal"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="secret-modal-title"
        >
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showSecretModal = false" aria-hidden="true"></div>
          <div class="relative w-full sm:max-w-md bg-[#0d1525] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <div class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div class="w-10 h-1 rounded-full bg-white/10"></div>
            </div>
            <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h2 id="secret-modal-title" class="text-base font-bold text-white">New Secret</h2>
                <p class="text-xs text-slate-500 mt-0.5">For {{ projectData?.name }}</p>
              </div>
              <button @click="showSecretModal = false" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all" aria-label="Close modal">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-6 py-5">
              <form @submit.prevent="addSecret" class="space-y-5" id="new-secret-form">
                <div class="space-y-1.5">
                  <label for="secret-key" class="block text-xs font-semibold text-slate-400">Key Name</label>
                  <input id="secret-key" v-model="newSecret.name" type="text" required placeholder="e.g. STRIPE_SECRET_KEY" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>
                <div class="space-y-1.5">
                  <label for="secret-value" class="block text-xs font-semibold text-slate-400">Value</label>
                  <input id="secret-value" v-model="newSecret.value" type="text" required placeholder="sk_test_..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 font-mono focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>
              </form>
            </div>
            <div class="px-6 py-4 border-t border-white/5 shrink-0 flex gap-2.5">
              <button type="button" @click="showSecretModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
              <button type="submit" form="new-secret-form" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]">
                <UIcon name="i-heroicons-lock-closed" class="w-4 h-4" />
                Save Secret
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== Edit Project Modal ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showEditModal"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showEditModal = false" aria-hidden="true"></div>
          <div class="relative w-full sm:max-w-lg bg-[#0d1525] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <div class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div class="w-10 h-1 rounded-full bg-white/10"></div>
            </div>
            <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h2 id="edit-modal-title" class="text-base font-bold text-white">Edit Project</h2>
                <p class="text-xs text-slate-500 mt-0.5">{{ projectData?.name }}</p>
              </div>
              <button @click="showEditModal = false" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all" aria-label="Close modal">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-6 py-5">
              <form @submit.prevent="saveEdit" class="space-y-5" id="edit-project-form">
                <div class="space-y-1.5">
                  <label for="proj-name" class="block text-xs font-semibold text-slate-400">Project Name</label>
                  <input id="proj-name" v-model="editForm.name" type="text" required class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>
                <div class="space-y-1.5">
                  <label for="proj-desc" class="block text-xs font-semibold text-slate-400">Description</label>
                  <textarea id="proj-desc" v-model="editForm.description" rows="3" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150 resize-none"></textarea>
                </div>
                <div class="space-y-1.5">
                  <label for="proj-status" class="block text-xs font-semibold text-slate-400">Status</label>
                  <div class="relative">
                    <select id="proj-status" v-model="editForm.status" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                      <option class="bg-black text-white" value="lead">Lead</option>
                      <option class="bg-black text-white" value="proposal">Proposal</option>
                      <option class="bg-black text-white" value="active">Active</option>
                      <option class="bg-black text-white" value="review">Review</option>
                      <option class="bg-black text-white" value="complete">Complete</option>
                      <option class="bg-black text-white" value="archived">Archived</option>
                    </select>
                    <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <label for="proj-start" class="block text-xs font-semibold text-slate-400">Start Date</label>
                    <input id="proj-start" v-model="editForm.start_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
                  </div>
                  <div class="space-y-1.5">
                    <label for="proj-end" class="block text-xs font-semibold text-slate-400">End Date</label>
                    <input id="proj-end" v-model="editForm.end_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
                  </div>
                </div>
                <div class="space-y-1.5">
                  <label for="proj-budget" class="block text-xs font-semibold text-slate-400">Budget</label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <select v-model="editForm.currency" aria-label="Currency" class="absolute left-3 top-1/2 -translate-y-1/2 bg-transparent text-xs font-semibold text-slate-400 focus:outline-none appearance-none cursor-pointer w-12 z-10">
                        <option class="bg-black text-white" value="NGN">NGN</option>
                        <option class="bg-black text-white" value="USD">USD</option>
                        <option class="bg-black text-white" value="GBP">GBP</option>
                        <option class="bg-black text-white" value="EUR">EUR</option>
                      </select>
                      <input id="proj-budget" v-model="editForm.budget" type="number" min="0" step="1" placeholder="0" class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-14 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="px-6 py-4 border-t border-white/5 shrink-0 flex gap-2.5">
              <button type="button" @click="showEditModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
              <button type="submit" form="edit-project-form" :disabled="savingEdit" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]">
                <UIcon v-if="savingEdit" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                <template v-else>
                  <UIcon name="i-heroicons-check" class="w-4 h-4" />
                  Save Changes
                </template>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: translateY(24px) scale(0.98);
}
@media (max-width: 639px) {
  .modal-enter-from .relative {
    transform: translateY(100%);
  }
}

textarea::-webkit-scrollbar { width: 8px; }
textarea::-webkit-scrollbar-track { background: transparent; }
textarea::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
textarea::-webkit-scrollbar-thumb:hover { background: #475569; }

:deep(.prose) { color: #cbd5e1; }
:deep(.prose h1), :deep(.prose h2), :deep(.prose h3) { color: white; font-weight: 700; }
:deep(.prose code) { background: #1e293b; color: #818cf8; padding: 0.2em 0.4em; border-radius: 4px; }
:deep(.prose pre) { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
:deep(.prose a) { color: #818cf8; }
:deep(.prose blockquote) { border-left-color: #818cf8; color: #94a3b8; }
</style>