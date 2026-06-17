<script setup lang="ts">
const { $md } = useNuxtApp()
const route   = useRoute()
const supabase = useSupabaseClient()
const user    = useSupabaseUser()

const projectId = computed(() => {
  const id = route.params.id
  if (!id || id === 'undefined' || id === 'null') return null
  return id
})

const loading     = ref(true)
const fetchError  = ref('')
const activeTab   = ref('secrets')
const projectData = ref(null)
const clientData  = ref(null)
const secrets     = ref([])
const files       = ref([])
const uploading   = ref(false)
const isDeleting  = ref(false)
const copiedSecretId = ref(null)

const showEditModal  = ref(false)
const savingEdit     = ref(false)
const editForm = ref({
  name: '', description: '', status: 'active',
  start_date: '', end_date: '', budget: '', currency: 'NGN',
})

const showSecretModal = ref(false)
const savingSecret = ref(false)
const newSecret = ref({ name: '', value: '' })

const isEditingNotes = ref(false)
const notesDraft     = ref('')
const isPreviewMode  = ref(false)
const savingNotes = ref(false)

const briefSubmission = ref(null)
const briefForm       = ref(null)

const reminderConfig = ref({
  enabled: false,
  frequency: 'weekly',
  custom_message: '',
  recipient_email: '',
})
const savingReminder = ref(false)
const reminderLogs = ref<any[]>([])
const loadingLogs = ref(false)
const testEmailSending = ref(false)
const testEmailResult = ref('')

// Toast
const toast = ref({ show: false, message: '', type: 'success' })
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toast.value = { show: true, message: msg, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
}

const shareToken = ref<string | null>(null)
const generatingShareLink = ref(false)
const copiedShareLink = ref(false)

// Delete confirmation modals
const showDeleteProjectConfirm = ref(false)
const showDeleteSecretConfirm = ref(false)
const deletingSecretId = ref<string | null>(null)
const showRevokeShareConfirm = ref(false)

const generateShareLink = async () => {
  if (shareToken.value) return
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
    showToast('Share link generated!', 'success')
  } catch (e: any) {
    showToast(e.message, 'error')
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
  try {
    const { error } = await supabase
      .from('projects')
      .update({ share_token: null, updated_at: new Date().toISOString() })
      .eq('id', projectId.value)
    if (error) throw error
    projectData.value.share_token = null
    shareToken.value = null
    showRevokeShareConfirm.value = false
    showToast('Share link revoked', 'success')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const fetchData = async () => {
  if (!projectId.value) { loading.value = false; return }
  loading.value = true
  fetchError.value = ''
  try {
    const { data: pData, error: projError } = await supabase
      .from('projects')
      .select('*, clients(id, name, category, website)')
      .eq('id', projectId.value)
      .single()
    if (projError) throw projError
    projectData.value = pData
    clientData.value  = pData?.clients
    notesDraft.value  = pData?.notes || ''
    shareToken.value = pData?.share_token || null
    editForm.value = {
      name:        pData?.name        || '',
      description: pData?.description || '',
      status:      pData?.status      || 'active',
      start_date:  pData?.start_date  || '',
      end_date:    pData?.end_date    || '',
      budget:      pData?.budget      ? String(pData.budget) : '',
      currency:    pData?.currency    || 'NGN',
    }
    const sData = await $fetch('/api/secrets', { query: { project_id: projectId.value } })
    secrets.value = sData?.map((s) => ({ ...s, isRevealed: false })) || []
    const { data: fData } = await supabase
      .from('files').select('*').eq('project_id', projectId.value)
      .order('created_at', { ascending: false })
    files.value = fData || []
    if (pData?.onboarding_submission_id) {
      const { data: subData } = await supabase
        .from('onboarding_submissions')
        .select('*, onboarding_forms(id, title, fields, client_id)')
        .eq('id', pData.onboarding_submission_id)
        .single()
      briefSubmission.value = subData
      briefForm.value       = subData?.onboarding_forms
    }
  } catch (e: any) {
    console.error(e)
    fetchError.value = e.message || 'Failed to load project data.'
  } finally {
    loading.value = false
  }
}

const saveEdit = async () => {
  if (!projectId.value) return
  savingEdit.value = true
  try {
    const { error } = await supabase.from('projects').update({
      name: editForm.value.name,
      description: editForm.value.description || null,
      status: editForm.value.status,
      start_date: editForm.value.start_date  || null,
      end_date: editForm.value.end_date    || null,
      budget: editForm.value.budget ? parseFloat(editForm.value.budget) : null,
      currency: editForm.value.currency,
      updated_at:  new Date().toISOString(),
    }).eq('id', projectId.value)
    if (error) throw error
    showEditModal.value = false
    showToast('Project updated successfully')
    await fetchData()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    savingEdit.value = false
  }
}

const saveNotes = async () => {
  if (!projectId.value) return
  savingNotes.value = true
  try {
    const { error } = await supabase.from('projects').update({
      notes: notesDraft.value,
      updated_at: new Date().toISOString()
    }).eq('id', projectId.value)
    if (error) throw error
    projectData.value.notes = notesDraft.value
    isEditingNotes.value = false
    isPreviewMode.value  = false
    showToast('Notes saved')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    savingNotes.value = false
  }
}

const addSecret = async () => {
  if (!projectId.value) return
  if (!newSecret.value.name || !newSecret.value.value) {
    showToast('Both key name and value are required', 'error')
    return
  }
  savingSecret.value = true
  try {
    await $fetch('/api/secrets', {
      method: 'POST',
      body: { user_id: user.value.sub, client_id: clientData.value?.id || null, project_id: projectId.value, key_name: newSecret.value.name, value: newSecret.value.value }
    })
    showSecretModal.value = false
    newSecret.value = { name: '', value: '' }
    showToast('Secret added')
    await fetchData()
  } catch (e: any) {
    showToast(e.message || 'Error saving secret', 'error')
  } finally {
    savingSecret.value = false
  }
}

const requestDeleteSecret = (id: string) => {
  deletingSecretId.value = id
  showDeleteSecretConfirm.value = true
}

const confirmDeleteSecret = async () => {
  if (!deletingSecretId.value) return
  try {
    await $fetch('/api/secrets', { method: 'DELETE', query: { id: deletingSecretId.value } })
    showToast('Secret deleted')
    showDeleteSecretConfirm.value = false
    deletingSecretId.value = null
    await fetchData()
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const copyToClipboard = (text, id) => {
  navigator.clipboard.writeText(text)
  copiedSecretId.value = id
  setTimeout(() => (copiedSecretId.value = null), 2000)
}

const handleFileUpload = async (event) => {
  if (!projectId.value) return
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const ext = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${user.value?.id}/${projectId.value}/${fileName}`
    const { error: uploadError } = await supabase.storage.from('project_files').upload(filePath, file)
    if (uploadError) throw uploadError
    const { error: dbError } = await supabase.from('files').insert({
      project_id: projectId.value, file_name: file.name, file_path: filePath, file_type: file.type, client_id: clientData.value?.id || null,
    })
    if (dbError) throw dbError
    showToast('File uploaded')
    await fetchData()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    uploading.value = false
  }
}

const downloadFile = async (path) => {
  const { data } = await supabase.storage.from('project_files').createSignedUrl(path, 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

const deleteProject = async () => {
  if (!projectId.value) return
  isDeleting.value = true
  try {
    const { data: filesToDelete } = await supabase.from('files').select('file_path').eq('project_id', projectId.value)
    if (filesToDelete?.length) {
      await supabase.storage.from('project_files').remove(filesToDelete.map((f) => f.file_path))
    }
    await supabase.from('projects').delete().eq('id', projectId.value)
    showDeleteProjectConfirm.value = false
    return navigateTo(clientData.value ? `/clients/${clientData.value.id}` : '/')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    isDeleting.value = false
  }
}

const fetchReminderConfig = async () => {
  try {
    const { data } = await supabase.from('invoice_reminder_configs').select('*').eq('project_id', projectId.value).single()
    if (data) reminderConfig.value = data
  } catch (e: any) {
    showToast('Failed to load reminder config', 'error')
  }
}

const saveReminderConfig = async () => {
  savingReminder.value = true
  try {
    const { error } = await supabase.from('invoice_reminder_configs').upsert({
      project_id: projectId.value,
      enabled: reminderConfig.value.enabled,
      frequency: reminderConfig.value.frequency,
      custom_message: reminderConfig.value.custom_message,
      recipient_email: reminderConfig.value.recipient_email || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' })
    if (error) throw error
    showToast('Reminder settings saved!')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    savingReminder.value = false
  }
}

const fetchReminderLogs = async () => {
  loadingLogs.value = true
  try {
    const { data } = await supabase.from('invoice_reminder_logs').select('*').eq('project_id', projectId.value).order('sent_at', { ascending: false }).limit(20)
    reminderLogs.value = data || []
  } catch (e: any) {
    showToast('Failed to load reminder logs', 'error')
  } finally {
    loadingLogs.value = false
  }
}

const sendTestEmail = async () => {
  testEmailSending.value = true
  testEmailResult.value = ''
  try {
    await $fetch('/api/send-test-reminder', { method: 'POST', body: { project_id: projectId.value, recipient_email: reminderConfig.value.recipient_email } })
    testEmailResult.value = 'sent'
    showToast('Test email sent! Check your inbox.')
  } catch (e: any) {
    testEmailResult.value = 'failed'
    showToast(e.message || 'Failed to send test email', 'error')
  } finally {
    testEmailSending.value = false
  }
}

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
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
  { key: 'reminders',  label: 'Reminders',  icon: 'i-heroicons-bell-alert' },
]

const isSmallScreen = ref(false)
function onResize() { isSmallScreen.value = window.innerWidth < 640 }
onMounted(() => { onResize(); window.addEventListener('resize', onResize) })
onUnmounted(() => window.removeEventListener('resize', onResize))

const mobilePriorityKeys = ['secrets', 'notes', 'files', 'milestones']
const desktopPriorityKeys = ['secrets', 'notes', 'files', 'milestones', 'calendar']
const visiblePriorityTabs = computed(() => {
  const keys = isSmallScreen.value ? mobilePriorityKeys : desktopPriorityKeys
  return tabs.filter(t => keys.includes(t.key))
})
const overflowTabs = computed(() => tabs.filter(t => !visiblePriorityTabs.value.map(v => v.key).includes(t.key)))
const showOverflow = ref(false)

const switchTab = (key: string) => {
  activeTab.value = key
  showOverflow.value = false
}

const highlightedNotes = computed(() => {
  if (!notesDraft.value) return ''
  return $md.render(notesDraft.value)
})

watch(activeTab, (tab) => {
  if (tab === 'reminders') { fetchReminderConfig(); fetchReminderLogs() }
})

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Breadcrumb -->
    <nav class="flex flex-wrap items-center gap-1.5 text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
      <NuxtLink to="/" class="flex items-center gap-1.5 hover:text-slate-300 transition-colors duration-150">
        <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
        <span>Dashboard</span>
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <NuxtLink
        v-if="clientData"
        :to="`/clients/${clientData.id}`"
        class="hover:text-slate-300 transition-colors duration-150 truncate max-w-[120px]"
      >
        {{ clientData.name }}
      </NuxtLink>
      <UIcon v-if="clientData" name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <span class="text-slate-300 truncate max-w-[160px]">{{ projectData?.name || '…' }}</span>
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

    <!-- Global Fetch Error -->
    <div v-else-if="fetchError && !projectData" class="flex flex-col items-center py-20 text-center">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-10 h-10 text-red-400 mb-4" />
      <p class="text-white font-semibold mb-2">Failed to load project</p>
      <p class="text-slate-400 text-sm mb-4">{{ fetchError }}</p>
      <button @click="fetchData" class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90">Retry</button>
    </div>

    <div v-else-if="projectData" class="space-y-8">

      <!-- Hero Header (mobile) -->
      <div class="lg:hidden rounded-2xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent border border-white/6 p-5 space-y-5">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span class="text-primary font-bold text-lg tracking-tight">
              {{ projectData.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?' }}
            </span>
          </div>
          <div class="min-w-0">
            <h1 class="text-xl font-bold text-white tracking-tight truncate">{{ projectData.name }}</h1>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border mt-1"
                  :class="statusConfig[projectData.status]?.badge">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[projectData.status]?.dot"></span>
              {{ statusConfig[projectData.status]?.label }}
            </span>
            <NuxtLink v-if="clientData" :to="`/clients/${clientData.id}`" class="block mt-1 text-sm text-slate-400 hover:text-primary transition-colors">
              {{ clientData.name }}
            </NuxtLink>
          </div>
        </div>
        <p v-if="projectData.description" class="text-sm text-slate-400 leading-relaxed">{{ projectData.description }}</p>
        <div class="flex items-center gap-2 flex-wrap">
          <button v-if="!shareToken" @click="generateShareLink" :disabled="generatingShareLink"
                  class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all active:scale-[0.98] disabled:opacity-50">
            <UIcon v-if="generatingShareLink" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-heroicons-share" class="w-4 h-4" /> Share with Client
          </button>
          <template v-else>
            <button @click="copyShareLink" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary/10 border border-primary/20 active:scale-[0.98]">
              <UIcon :name="copiedShareLink ? 'i-heroicons-check' : 'i-heroicons-link'" class="w-4 h-4" /> {{ copiedShareLink ? 'Copied!' : 'Copy Link' }}
            </button>
            <button @click="showRevokeShareConfirm = true" class="p-2.5 rounded-xl text-slate-400 hover:text-red-400 bg-white/5 border border-white/6">
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </template>
          <button @click="showEditModal = true" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 border border-white/6 active:scale-[0.98]">
            <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" /> Edit
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
          <div class="flex items-center gap-2"><UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500">Start</p><p class="text-sm text-white">{{ projectData.start_date ? new Date(projectData.start_date).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '—' }}</p></div></div>
          <div class="flex items-center gap-2"><UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500">End</p><p class="text-sm text-white">{{ projectData.end_date ? new Date(projectData.end_date).toLocaleDateString() : '—' }}</p></div></div>
          <div class="flex items-center gap-2"><UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500">Budget</p><p class="text-sm text-white">{{ projectData.budget ? formatBudget(projectData.budget, projectData.currency) : '—' }}</p></div></div>
          <div class="flex items-center gap-2"><UIcon name="i-heroicons-currency-dollar" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500">Currency</p><p class="text-sm text-white">{{ projectData.currency }}</p></div></div>
        </div>
      </div>

      <!-- Hero Header (desktop) -->
      <div class="hidden lg:block relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent border border-white/6 p-6 md:p-8">
        <div class="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        <div class="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div class="flex items-start gap-5">
            <div class="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <span class="text-primary font-bold text-xl tracking-tight">{{ projectData.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?' }}</span>
            </div>
            <div class="space-y-3">
              <div>
                <div class="flex items-center gap-3 flex-wrap mb-2">
                  <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">{{ projectData.name }}</h1>
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border" :class="statusConfig[projectData.status]?.badge">
                    <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[projectData.status]?.dot"></span> {{ statusConfig[projectData.status]?.label }}
                  </span>
                </div>
                <NuxtLink v-if="clientData" :to="`/clients/${clientData.id}`" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors">
                  <UIcon name="i-heroicons-building-office-2" class="w-4 h-4" /> {{ clientData.name }}
                </NuxtLink>
              </div>
              <p v-if="projectData.description" class="text-slate-400 text-sm max-w-2xl leading-relaxed">{{ projectData.description }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0 lg:self-start">
            <button v-if="!shareToken" @click="generateShareLink" :disabled="generatingShareLink" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all active:scale-[0.98] disabled:opacity-50">
              <UIcon v-if="generatingShareLink" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" /> <UIcon v-else name="i-heroicons-share" class="w-4 h-4" /> <span class="hidden sm:inline">Share with Client</span>
            </button>
            <template v-else>
              <button @click="copyShareLink" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all active:scale-[0.98]">
                <UIcon :name="copiedShareLink ? 'i-heroicons-check' : 'i-heroicons-link'" class="w-4 h-4" /> <span class="hidden sm:inline">{{ copiedShareLink ? 'Copied!' : 'Copy Client Link' }}</span>
              </button>
              <button @click="showRevokeShareConfirm = true" class="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-red-400 bg-white/5 border border-white/6 transition-all">
                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </template>
            <button @click="showEditModal = true" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all active:scale-[0.98]">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" /> <span class="hidden sm:inline">Edit</span>
            </button>
          </div>
        </div>
        <div class="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
          <div class="flex items-center gap-3"><UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500 mb-0.5">Start</p><p class="text-sm text-white">{{ projectData.start_date ? new Date(projectData.start_date).toLocaleDateString() : '—' }}</p></div></div>
          <div class="flex items-center gap-3"><UIcon name="i-heroicons-calendar-days" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500 mb-0.5">End</p><p class="text-sm text-white">{{ projectData.end_date ? new Date(projectData.end_date).toLocaleDateString() : '—' }}</p></div></div>
          <div class="flex items-center gap-3"><UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500 mb-0.5">Budget</p><p class="text-sm text-white">{{ projectData.budget ? formatBudget(projectData.budget, projectData.currency) : '—' }}</p></div></div>
          <div class="flex items-center gap-3"><UIcon name="i-heroicons-currency-dollar" class="w-4 h-4 text-slate-400" /><div><p class="text-[10px] text-slate-500 mb-0.5">Currency</p><p class="text-sm text-white">{{ projectData.currency }}</p></div></div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1">
        <div class="flex items-center gap-1 overflow-hidden">
          <button
            v-for="tab in visiblePriorityTabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="[
              'py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 whitespace-nowrap',
              activeTab === tab.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
            ]"
          >
            <UIcon :name="tab.icon" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ tab.label }}</span>
          </button>
        </div>
        <div v-if="overflowTabs.length" class="relative">
          <button
            @click="showOverflow = !showOverflow"
            class="p-2 text-slate-400 hover:text-white transition-colors"
            :class="{ 'text-primary': showOverflow }"
          >
            <UIcon name="i-heroicons-ellipsis-vertical" class="w-5 h-5" />
          </button>
          <Transition name="fade">
            <div v-if="showOverflow" class="absolute right-0 mt-2 w-44 bg-[#0d1525] border border-white/8 rounded-2xl shadow-2xl py-1 z-30">
              <button v-for="tab in overflowTabs" :key="tab.key" @click="switchTab(tab.key)"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl">
                <UIcon :name="tab.icon" class="w-4 h-4" /> {{ tab.label }}
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Tab Content with transitions -->
      <div class="min-h-[400px]">
        <Transition name="tab-fade" mode="out-in">
          <!-- Secrets -->
          <div v-if="activeTab === 'secrets'" key="secrets" class="space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-white">Secrets</h2>
                <p class="text-xs text-slate-500 mt-0.5">Securely store API keys and tokens for this project.</p>
              </div>
              <button @click="showSecretModal = true" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                <UIcon name="i-heroicons-plus" class="w-4 h-4" /> Add Secret
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
                <div v-for="s in secrets" :key="s.id" class="px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center">
                  <div class="md:col-span-3 font-medium text-white text-sm flex items-center gap-2">
                    <UIcon name="i-heroicons-key" class="w-4 h-4 text-slate-500 shrink-0" />
                    <span class="truncate">{{ s.key_name }}</span>
                  </div>
                  <div class="md:col-span-7 w-full">
                    <button @click="s.isRevealed = !s.isRevealed" class="w-full text-left relative bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm focus:border-primary/40 focus:outline-none transition-all group">
                      <span :class="!s.isRevealed ? 'blur-sm select-none opacity-50' : 'opacity-100'" class="block transition-all duration-300 truncate font-mono">{{ s.isRevealed ? s.value : '••••••••••••••••••••••••' }}</span>
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">{{ s.isRevealed ? 'Hide' : 'Show' }}</span>
                    </button>
                  </div>
                  <div class="md:col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                    <button @click="copyToClipboard(s.value, s.id)" class="p-2 rounded-xl hover:bg-white/8 transition-colors flex items-center justify-center" :class="copiedSecretId === s.id ? 'text-emerald-400' : 'text-slate-400 hover:text-white'">
                      <UIcon :name="copiedSecretId === s.id ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-5 h-5" />
                      <span class="text-xs font-medium ml-2 md:hidden">{{ copiedSecretId === s.id ? 'Copied' : 'Copy' }}</span>
                    </button>
                    <button @click="requestDeleteSecret(s.id)" class="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors flex items-center justify-center">
                      <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                      <span class="text-xs font-medium ml-2 md:hidden">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div v-else-if="activeTab === 'notes'" key="notes" class="space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold text-white">Notes</h2>
                <p class="text-xs text-slate-500 mt-0.5">Markdown supported · project context & documentation</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <button v-if="!isEditingNotes" @click="isEditingNotes = true" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/8 border border-white/6 text-slate-400 hover:text-white transition-all">
                  <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" /> Edit
                </button>
                <template v-else>
                  <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/6">
                    <button @click="isPreviewMode = false" :class="!isPreviewMode ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'" class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">Write</button>
                    <button @click="isPreviewMode = true" :class="isPreviewMode ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'" class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">Preview</button>
                  </div>
                  <button @click="isEditingNotes = false" class="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors">Cancel</button>
                  <button @click="saveNotes" :disabled="savingNotes" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
                    <UIcon v-if="savingNotes" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                    <UIcon v-else name="i-heroicons-check" class="w-4 h-4" />
                    {{ savingNotes ? 'Saving...' : 'Save' }}
                  </button>
                </template>
              </div>
            </div>
            <div class="relative">
              <textarea v-if="isEditingNotes && !isPreviewMode" v-model="notesDraft" rows="18" class="w-full bg-white/[0.03] border border-white/6 rounded-2xl px-6 py-5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all leading-relaxed resize-y font-mono" placeholder="# Notes, credentials, deployment steps…"></textarea>
              <div v-else class="bg-white/[0.03] border border-white/6 rounded-2xl p-8 min-h-[400px]">
                <div v-if="notesDraft" class="prose prose-invert max-w-none prose-indigo leading-relaxed text-slate-300" v-html="highlightedNotes"></div>
                <div v-else class="flex flex-col items-center justify-center h-full py-20 text-slate-500">
                  <UIcon name="i-heroicons-pencil" class="w-12 h-12 opacity-20 mb-4" />
                  <p class="text-sm font-medium">No notes yet</p>
                  <p class="text-xs mt-1">Click "Edit" to add project documentation.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Files -->
          <div v-else-if="activeTab === 'files'" key="files" class="space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-white">Files</h2>
                <p class="text-xs text-slate-500 mt-0.5">Upload and manage project documents.</p>
              </div>
            </div>
            <div class="relative cursor-pointer group">
              <input type="file" @change="handleFileUpload" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" :disabled="uploading" />
              <div class="border-2 border-dashed border-white/8 rounded-2xl p-16 text-center hover:border-primary/30 hover:bg-white/[0.02] transition-all">
                <div v-if="uploading" class="flex flex-col items-center text-primary animate-pulse">
                  <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin mb-4" />
                  <span class="text-sm font-semibold">Uploading…</span>
                </div>
                <div v-else class="flex flex-col items-center gap-4 text-slate-500">
                  <div class="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-all">
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
              <div v-for="f in files" :key="f.id" class="flex items-center justify-between bg-white/[0.03] border border-white/6 rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all group">
                <div class="flex items-center gap-4 overflow-hidden">
                  <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-white truncate">{{ f.file_name }}</p>
                    <p class="text-[10px] text-slate-500 mt-0.5">{{ new Date(f.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) }}</p>
                  </div>
                </div>
                <button @click="downloadFile(f.file_path)" class="p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors shrink-0">
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-5 h-5" />
                </button>
              </div>
            </div>
            <div v-else-if="!uploading" class="text-center py-12">
              <p class="text-sm text-slate-500">No files uploaded yet for this project.</p>
            </div>
          </div>

          <!-- Milestones -->
          <div v-else-if="activeTab === 'milestones'" key="milestones" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-white mb-1">Milestones</h2>
              <p class="text-xs text-slate-500">Track key deliverables and deadlines.</p>
            </div>
            <ProjectMilestonesTab :project-id="projectId" />
          </div>

          <!-- Calendar -->
          <div v-else-if="activeTab === 'calendar'" key="calendar" class="space-y-5">
            <div>
              <h2 class="text-lg font-semibold text-white mb-1">Calendar</h2>
              <p class="text-xs text-slate-500">Visual timeline of project events.</p>
            </div>
            <CalendarView :project-id="projectId" />
          </div>

          <!-- Brief -->
          <div v-else-if="activeTab === 'brief'" key="brief" class="space-y-5">
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
              <NuxtLink :to="`/onboarding?client=${clientData?.id}`" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" /> Create Onboarding Form
              </NuxtLink>
            </div>
            <div v-else class="space-y-5">
              <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-base font-semibold text-white flex items-center gap-2">
                    <UIcon name="i-heroicons-clipboard-document-check" class="w-5 h-5 text-emerald-400" /> Client Brief
                  </h3>
                  <span class="text-xs text-slate-500">Submitted {{ new Date(briefSubmission.submitted_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) }}</span>
                </div>
                <p v-if="briefForm?.title" class="text-sm text-slate-400 mb-2">{{ briefForm.title }}</p>
                <p v-if="briefSubmission.submitter_name" class="text-xs text-slate-500">From: {{ briefSubmission.submitter_name }}<span v-if="briefSubmission.submitter_email"> · {{ briefSubmission.submitter_email }}</span></p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <template v-for="field in (briefForm?.fields || []).sort((a: any, b: any) => a.position - b.position)" :key="field.id">
                  <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-5" :class="field.type === 'textarea' ? 'md:col-span-2' : ''">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{{ field.label }}</p>
                    <template v-if="field.type === 'file' || field.type === 'url'">
                      <div v-if="Array.isArray(briefSubmission.responses[field.id]) && briefSubmission.responses[field.id].length" class="space-y-2">
                        <a v-for="(url, idx) in briefSubmission.responses[field.id]" :key="idx" :href="url" target="_blank" class="flex items-center gap-2 text-primary hover:text-white text-sm transition-colors truncate">
                          <UIcon name="i-heroicons-link" class="w-4 h-4 shrink-0" /> <span class="truncate">{{ url }}</span>
                        </a>
                      </div>
                      <a v-else-if="briefSubmission.responses[field.id]" :href="briefSubmission.responses[field.id]" target="_blank" class="flex items-center gap-2 text-primary hover:text-white text-sm transition-colors truncate">
                        <UIcon name="i-heroicons-link" class="w-4 h-4 shrink-0" /> <span class="truncate">{{ briefSubmission.responses[field.id] }}</span>
                      </a>
                      <p v-else class="text-sm text-slate-600 italic">—</p>
                    </template>
                    <p v-else class="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{{ briefSubmission.responses[field.id] || '—' }}</p>
                  </div>
                </template>
              </div>
              <div class="text-right">
                <NuxtLink v-if="briefForm?.id" :to="`/onboarding/${briefForm.id}`" class="text-xs text-slate-500 hover:text-primary transition-colors">View full form & submission →</NuxtLink>
              </div>
            </div>
          </div>

          <!-- Reminders -->
          <div v-else-if="activeTab === 'reminders'" key="reminders" class="space-y-6">
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6">
              <h3 class="text-base font-semibold text-white mb-4">Invoice Reminders</h3>
              <div class="space-y-4">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="reminderConfig.enabled" type="checkbox" class="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary" />
                  <span class="text-sm text-slate-300">Send automatic reminders for overdue invoices</span>
                </label>
                <div v-if="reminderConfig.enabled" class="space-y-4 pl-7">
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-400">Recipient Email (optional override)</label>
                    <input v-model="reminderConfig.recipient_email" type="email" placeholder="Leave blank to use client's email" class="w-full sm:w-64 bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-400">Frequency</label>
                    <div class="relative w-full sm:w-48">
                      <select v-model="reminderConfig.frequency" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer">
                        <option value="daily" class="bg-[#0d1525]">Daily</option>
                        <option value="weekly" class="bg-[#0d1525]">Weekly</option>
                        <option value="biweekly" class="bg-[#0d1525]">Every 2 Weeks</option>
                        <option value="monthly" class="bg-[#0d1525]">Monthly</option>
                      </select>
                      <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-semibold text-slate-400">Custom Message (optional)</label>
                    <textarea v-model="reminderConfig.custom_message" rows="3" placeholder="Add a personal note to the reminder email..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none"></textarea>
                  </div>
                  <div class="pt-2">
                    <button @click="sendTestEmail" :disabled="testEmailSending" class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/8 border border-white/6 text-slate-400 hover:text-white transition-all disabled:opacity-50">
                      <UIcon v-if="testEmailSending" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                      <UIcon v-else name="i-heroicons-envelope" class="w-4 h-4" />
                      {{ testEmailSending ? 'Sending...' : 'Send Test Email to Yourself' }}
                    </button>
                    <p v-if="testEmailResult" class="text-xs mt-2" :class="testEmailResult === 'sent' ? 'text-emerald-400' : 'text-red-400'">{{ testEmailResult === 'sent' ? 'Test email sent! Check your inbox.' : 'Failed to send test email.' }}</p>
                  </div>
                </div>
                <div class="pt-4 border-t border-white/5">
                  <button @click="saveReminderConfig" :disabled="savingReminder" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
                    <UIcon v-if="savingReminder" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                    <span v-else>Save Settings</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
              <div class="px-5 py-4 border-b border-white/5">
                <h3 class="text-sm font-semibold text-white">Recent Reminder Logs</h3>
              </div>
              <div v-if="loadingLogs" class="p-5 text-center text-sm text-slate-500">Loading logs...</div>
              <div v-else-if="reminderLogs.length === 0" class="p-5 text-center text-sm text-slate-500">
                <UIcon name="i-heroicons-inbox" class="w-6 h-6 mx-auto mb-2 text-slate-600" /> No reminders sent yet.
              </div>
              <div v-else class="divide-y divide-white/5">
                <div v-for="log in reminderLogs" :key="log.id" class="flex items-center justify-between px-5 py-3 text-sm">
                  <div class="min-w-0 flex-1">
                    <p class="text-white font-medium truncate">{{ log.sent_to }}</p>
                    <p class="text-xs text-slate-500">{{ new Date(log.sent_at).toLocaleString() }}</p>
                    <p v-if="log.error_message" class="text-xs text-red-400 mt-0.5">{{ log.error_message }}</p>
                  </div>
                  <span :class="log.status === 'sent' ? 'text-emerald-400' : 'text-red-400'" class="text-xs font-semibold shrink-0 ml-4">{{ log.status === 'sent' ? 'Sent' : 'Failed' }}</span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Danger Zone -->
      <section class="pt-8 border-t border-white/5">
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-1.5">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5" /> Danger Zone
        </p>
        <div class="bg-red-500/[0.04] border border-red-500/10 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p class="text-sm font-semibold text-white mb-0.5">Delete this project</p>
            <p class="text-xs text-slate-500 leading-relaxed">Permanently removes the project along with all secrets, files, and events. This action cannot be undone.</p>
          </div>
          <button @click="showDeleteProjectConfirm = true" :disabled="isDeleting" class="shrink-0 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98]">
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <template v-else><UIcon name="i-heroicons-trash" class="w-4 h-4" /> Delete Project</template>
          </button>
        </div>
      </section>
    </div>

    <!-- Add Secret Modal -->
    <ModalBase :open="showSecretModal" title="New Secret" :subtitle="`For ${projectData?.name}`" @close="showSecretModal = false">
      <form @submit.prevent="addSecret" class="space-y-5">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Key Name</label>
          <input v-model="newSecret.name" type="text" required placeholder="e.g. STRIPE_SECRET_KEY" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Value</label>
          <input v-model="newSecret.value" type="text" required placeholder="sk_test_..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 font-mono focus:border-primary/50 focus:outline-none" />
        </div>
      </form>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showSecretModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="addSecret" :disabled="savingSecret" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50">
            <UIcon v-if="savingSecret" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-heroicons-lock-closed" class="w-4 h-4" />
            {{ savingSecret ? 'Saving...' : 'Save Secret' }}
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Edit Project Modal -->
    <ModalBase :open="showEditModal" title="Edit Project" :subtitle="projectData?.name" @close="showEditModal = false">
      <form @submit.prevent="saveEdit" class="space-y-5">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Project Name</label>
          <input v-model="editForm.name" type="text" required class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Description</label>
          <textarea v-model="editForm.description" rows="3" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Status</label>
          <div class="relative">
            <select v-model="editForm.status" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer">
              <option value="lead">Lead</option>
              <option value="proposal">Proposal</option>
              <option value="active">Active</option>
              <option value="review">Review</option>
              <option value="complete">Complete</option>
              <option value="archived">Archived</option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Start Date</label>
            <input v-model="editForm.start_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">End Date</label>
            <input v-model="editForm.end_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none" />
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Budget</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <select v-model="editForm.currency" class="absolute left-3 top-1/2 -translate-y-1/2 bg-transparent text-xs font-semibold text-slate-400 focus:outline-none appearance-none cursor-pointer w-12 z-10">
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
              <input v-model="editForm.budget" type="number" min="0" step="1" placeholder="0" class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-14 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none" />
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showEditModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="saveEdit" :disabled="savingEdit" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
            <UIcon v-if="savingEdit" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <template v-else><UIcon name="i-heroicons-check" class="w-4 h-4" /> Save Changes</template>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Revoke Share Link Modal -->
    <ModalBase :open="showRevokeShareConfirm" title="Revoke Share Link" subtitle="The old link will stop working." @close="showRevokeShareConfirm = false">
      <p class="text-slate-400 text-sm">Anyone with the current link will lose access to this project.</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showRevokeShareConfirm = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="revokeShareLink" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all">Revoke</button>
        </div>
      </template>
    </ModalBase>

    <!-- Delete Secret Confirmation Modal -->
    <ModalBase :open="showDeleteSecretConfirm" title="Delete Secret" subtitle="This action cannot be undone." @close="showDeleteSecretConfirm = false">
      <p class="text-slate-400 text-sm">Are you sure you want to delete this secret?</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showDeleteSecretConfirm = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="confirmDeleteSecret" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all">Delete</button>
        </div>
      </template>
    </ModalBase>

    <!-- Delete Project Confirmation Modal -->
    <ModalBase :open="showDeleteProjectConfirm" title="Delete Project" subtitle="This action cannot be undone." @close="showDeleteProjectConfirm = false">
      <p class="text-slate-400 text-sm">Permanently removes the project along with all secrets, files, and events.</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showDeleteProjectConfirm = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="deleteProject" :disabled="isDeleting" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Delete Project</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Toast -->
    <Transition enter-active-class="transform ease-out duration-300 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'" />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
.tab-fade-enter-active,
.tab-fade-leave-active { transition: opacity 0.2s ease; }
.tab-fade-enter-from,
.tab-fade-leave-to { opacity: 0; }
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