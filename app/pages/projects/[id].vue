<script setup lang="ts">
const { $md } = useNuxtApp()
const route   = useRoute()
const supabase = useSupabaseClient()
const user    = useSupabaseUser()
const projectId = route.params.id as string

// ── State ─────────────────────────────────────────────────────────────────────
const loading    = ref(true)
const activeTab  = ref('secrets')
const projectData = ref<any>(null)
const clientData  = ref<any>(null)
const secrets    = ref<any[]>([])
const files      = ref<any[]>([])
const uploading  = ref(false)
const isDeleting = ref(false)
const copiedSecretId = ref<string | null>(null)

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


// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    // Project + client join
    const { data: pData } = await supabase
      .from('projects')
      .select('*, clients(id, name, category, website)')
      .eq('id', projectId)
      .single()

    projectData.value = pData
    clientData.value  = pData?.clients
    notesDraft.value  = pData?.notes || ''

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
    const sData = await $fetch(`/api/secrets?project_id=${projectId}`)
    secrets.value = (sData as any[])?.map((s: any) => ({ ...s, isRevealed: false })) || []

    // Files
    const { data: fData } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    files.value = fData || []

  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Edit project ──────────────────────────────────────────────────────────────
const saveEdit = async () => {
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
      .eq('id', projectId)
    if (error) throw error
    showEditModal.value = false
    await fetchData()
  } catch (e: any) {
    alert('Error saving: ' + e.message)
  } finally {
    savingEdit.value = false
  }
}

// ── Notes ─────────────────────────────────────────────────────────────────────
const saveNotes = async () => {
  try {
    const { error } = await supabase
      .from('projects')
      .update({ notes: notesDraft.value, updated_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) throw error
    projectData.value.notes = notesDraft.value
    isEditingNotes.value = false
    isPreviewMode.value  = false
  } catch (e: any) {
    alert('Save failed: ' + e.message)
  }
}

// ── Secrets ───────────────────────────────────────────────────────────────────
const addSecret = async () => {
  if (!newSecret.value.name || !newSecret.value.value) return
  try {
    await $fetch('/api/secrets', {
      method: 'POST',
      body: { project_id: projectId, key_name: newSecret.value.name, value: newSecret.value.value },
    })
    showSecretModal.value = false
    newSecret.value = { name: '', value: '' }
    await fetchData()
  } catch (e: any) {
    alert(e.message || 'Error saving secret')
  }
}

const deleteSecret = async (id: string) => {
  if (!confirm('Delete this secret?')) return
  await $fetch(`/api/secrets?id=${id}`, { method: 'DELETE' })
  await fetchData()
}

const copyToClipboard = (text: string, id: string) => {
  navigator.clipboard.writeText(text)
  copiedSecretId.value = id
  setTimeout(() => (copiedSecretId.value = null), 2000)
}

// ── Files ─────────────────────────────────────────────────────────────────────
const handleFileUpload = async (event: any) => {
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const ext      = file.name.split('.').pop()
    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${user.value?.id}/${projectId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('project_files')
      .upload(filePath, file)
    if (uploadError) throw uploadError

    const { error: dbError } = await supabase.from('files').insert({
      project_id: projectId,
      file_name:  file.name,
      file_path:  filePath,
      file_type:  file.type,
      client_id:  clientData.value?.id || null,
    })
    if (dbError) throw dbError
    await fetchData()
  } catch (e: any) {
    alert(e.message)
  } finally {
    uploading.value = false
  }
}

const downloadFile = async (path: string) => {
  const { data } = await supabase.storage
    .from('project_files')
    .createSignedUrl(path, 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

// ── Delete project ────────────────────────────────────────────────────────────
const deleteProject = async () => {
  if (!confirm('Permanently delete this project and all its data?')) return
  isDeleting.value = true
  try {
    const { data: filesToDelete } = await supabase
      .from('files')
      .select('file_path')
      .eq('project_id', projectId)

    if (filesToDelete?.length) {
      await supabase.storage
        .from('project_files')
        .remove(filesToDelete.map((f: any) => f.file_path))
    }

    await supabase.from('projects').delete().eq('id', projectId)
    return navigateTo(clientData.value ? `/clients/${clientData.value.id}` : '/')
  } catch (e: any) {
    alert('Error: ' + e.message)
  } finally {
    isDeleting.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  lead:     { label: 'Lead',     color: 'text-gray-400  bg-gray-400/10  border-gray-400/20'  },
  proposal: { label: 'Proposal', color: 'text-blue-400  bg-blue-400/10  border-blue-400/20'  },
  active:   { label: 'Active',   color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  review:   { label: 'Review',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  complete: { label: 'Complete', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  archived: { label: 'Archived', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20'   },
}

const highlightedNotes = computed(() => {
  if (!notesDraft.value) return ''
  return $md.render(notesDraft.value)
})

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8 flex-wrap">
      <NuxtLink to="/" class="hover:text-primary transition-colors flex items-center gap-1">
        <UIcon name="i-heroicons-home" class="w-4 h-4" />
        Dashboard
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3 h-3 text-gray-600" />
      <NuxtLink
        v-if="clientData"
        :to="`/clients/${clientData.id}`"
        class="hover:text-primary transition-colors"
      >
        {{ clientData.name }}
      </NuxtLink>
      <UIcon v-if="clientData" name="i-heroicons-chevron-right" class="w-3 h-3 text-gray-600" />
      <span class="text-gray-300 font-medium">{{ projectData?.name || 'Loading...' }}</span>
    </nav>

    <!-- Loading -->
    <div v-if="loading && !projectData" class="space-y-6">
      <div class="h-10 w-64 bg-secondary/50 animate-pulse rounded-lg"></div>
      <div class="h-24 bg-secondary/50 animate-pulse rounded-xl"></div>
    </div>

    <div v-else-if="projectData">

      <!-- Project Header -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/5 pb-6 gap-4">
        <div>
          <!-- Client name link -->
          <NuxtLink
            v-if="clientData"
            :to="`/clients/${clientData.id}`"
            class="text-xs text-gray-500 hover:text-primary transition-colors mb-2 flex items-center gap-1 uppercase font-bold tracking-wider"
          >
            <UIcon name="i-heroicons-building-office-2" class="w-3.5 h-3.5" />
            {{ clientData.name }}
          </NuxtLink>

          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {{ projectData.name }}
            </h1>
            <span
              class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border"
              :class="statusConfig[projectData.status]?.color || statusConfig.active.color"
            >
              {{ statusConfig[projectData.status]?.label || projectData.status }}
            </span>
          </div>

          <p v-if="projectData.description" class="text-gray-400 text-sm mt-2 max-w-xl">
            {{ projectData.description }}
          </p>
        </div>

        <!-- Edit button -->
        <button
          @click="showEditModal = true"
          class="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-white/5 hover:border-white/10"
        >
          <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
          Edit Project
        </button>
      </header>

      <!-- Project Meta Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div class="bg-secondary/40 border border-white/5 rounded-xl p-4">
          <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Start Date</p>
          <p class="text-white text-sm font-medium">
            {{ projectData.start_date
              ? new Date(projectData.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : '—' }}
          </p>
        </div>
        <div class="bg-secondary/40 border border-white/5 rounded-xl p-4">
          <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">End Date</p>
          <p class="text-white text-sm font-medium">
            {{ projectData.end_date
              ? new Date(projectData.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : '—' }}
          </p>
        </div>
        <div class="bg-secondary/40 border border-white/5 rounded-xl p-4">
          <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Budget</p>
          <p class="text-white text-sm font-medium">
            {{ projectData.budget
              ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: projectData.currency }).format(projectData.budget)
              : '—' }}
          </p>
        </div>
        <div class="bg-secondary/40 border border-white/5 rounded-xl p-4">
          <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Currency</p>
          <p class="text-white text-sm font-medium">{{ projectData.currency }}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-secondary/30 p-1 rounded-xl flex gap-1 mb-8 overflow-x-auto border border-white/5 max-w-2xl">
        <button
          v-for="tab in ['secrets', 'notes', 'files', 'milestones', 'calendar']"
          :key="tab"
          @click="activeTab = tab"
          :class="activeTab === tab
            ? 'bg-primary text-white shadow-lg'
            : 'text-gray-400 hover:text-white hover:bg-white/5'"
          class="flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all capitalize flex items-center justify-center gap-2 whitespace-nowrap"
        >
<UIcon v-if="tab === 'secrets'"    name="i-heroicons-key"           class="w-4 h-4" />
<UIcon v-if="tab === 'notes'"      name="i-heroicons-document-text" class="w-4 h-4" />
<UIcon v-if="tab === 'files'"      name="i-heroicons-folder-open"   class="w-4 h-4" />
<UIcon v-if="tab === 'milestones'" name="i-heroicons-flag"          class="w-4 h-4" />
<UIcon v-if="tab === 'calendar'"   name="i-heroicons-calendar-days" class="w-4 h-4" />
          {{ tab }}
        </button>
      </div>

      <!-- ── SECRETS TAB ──────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'secrets'" class="animate-in fade-in duration-300">
        <div class="flex justify-end mb-4">
          <button
            @click="showSecretModal = true"
            class="bg-primary hover:bg-[#3d34d9] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            <UIcon name="i-heroicons-plus" class="w-5 h-5" />
            Add Secret
          </button>
        </div>

        <div class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden">
          <div v-if="secrets.length === 0" class="p-12 text-center flex flex-col items-center justify-center text-gray-500">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <UIcon name="i-heroicons-lock-closed" class="w-6 h-6 opacity-50" />
            </div>
            <p>No secrets stored for this project yet.</p>
          </div>

          <div v-else>
            <div class="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/5">
              <div class="col-span-3">Key Name</div>
              <div class="col-span-7">Value</div>
              <div class="col-span-2 text-right">Actions</div>
            </div>

            <div
              v-for="s in secrets"
              :key="s.id"
              class="p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center"
            >
              <div class="md:col-span-3 font-medium text-white w-full flex justify-between md:justify-start items-center">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-key" class="w-4 h-4 text-gray-500" />
                  {{ s.key_name }}
                </div>
              </div>

              <div class="md:col-span-7 w-full font-mono text-sm">
                <button
                  @click="s.isRevealed = !s.isRevealed"
                  class="w-full text-left relative bg-base px-3 py-2.5 rounded-lg border border-white/5 hover:border-primary/50 transition-colors group"
                >
                  <span
                    :class="!s.isRevealed ? 'blur-sm select-none opacity-50' : 'opacity-100'"
                    class="block transition-all duration-300 truncate"
                  >
                    {{ s.isRevealed ? s.value : '••••••••••••••••••••••••' }}
                  </span>
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                    {{ s.isRevealed ? 'Hide' : 'Show' }}
                  </span>
                </button>
              </div>

              <div class="md:col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                <button
                  @click="copyToClipboard(s.value, s.id)"
                  class="flex-1 md:flex-none py-2 md:p-2 bg-white/5 md:bg-transparent rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                  :class="copiedSecretId === s.id ? 'text-green-400' : 'text-gray-400 hover:text-white'"
                >
                  <UIcon :name="copiedSecretId === s.id ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-5 h-5" />
                  <span class="text-xs font-bold md:hidden">{{ copiedSecretId === s.id ? 'Copied' : 'Copy' }}</span>
                </button>
                <button
                  @click="deleteSecret(s.id)"
                  class="flex-1 md:flex-none py-2 md:p-2 bg-white/5 md:bg-transparent rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                  <span class="text-xs font-bold md:hidden">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── NOTES TAB ────────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'notes'" class="space-y-6 animate-in fade-in duration-300">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-secondary/40 p-2 pl-4 rounded-xl border border-white/5 gap-4">
          <div class="flex items-center gap-4">
            <h3 class="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary" />
              Project Notes
            </h3>
            <div v-if="isEditingNotes" class="flex items-center gap-1 bg-base p-1 rounded-lg border border-white/5">
              <button @click="isPreviewMode = false" :class="!isPreviewMode ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'" class="px-3 py-1 text-xs rounded-md transition-all font-medium">Write</button>
              <button @click="isPreviewMode = true"  :class="isPreviewMode  ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'" class="px-3 py-1 text-xs rounded-md transition-all font-medium">Preview</button>
            </div>
          </div>
          <div class="flex gap-2 w-full sm:w-auto">
            <button v-if="!isEditingNotes" @click="isEditingNotes = true" class="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm transition-all w-full sm:w-auto flex items-center justify-center gap-2 font-medium">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              Edit Notes
            </button>
            <template v-else>
              <button @click="isEditingNotes = false" class="text-gray-400 hover:text-white text-sm px-3 font-medium transition-colors">Cancel</button>
              <button @click="saveNotes" class="bg-primary hover:bg-[#3d34d9] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
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
            class="w-full bg-secondary border border-white/10 rounded-2xl p-8 text-gray-300 font-mono text-sm min-h-[500px] focus:outline-none focus:border-primary/50 transition-all leading-relaxed resize-y"
            placeholder="# Notes, credentials, deployment steps..."
          ></textarea>

          <div v-else class="bg-secondary/20 border border-white/5 rounded-2xl p-8 min-h-[500px]">
            <div
              v-if="notesDraft"
              class="prose prose-invert max-w-none prose-indigo leading-relaxed text-gray-300"
              v-html="highlightedNotes"
            ></div>
            <div v-else class="flex flex-col items-center justify-center h-full py-20 text-gray-600 italic">
              <UIcon name="i-heroicons-pencil" class="w-12 h-12 opacity-20 mb-2" />
              No notes yet.
            </div>
          </div>
        </div>
      </div>

      <!-- ── FILES TAB ────────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'files'" class="animate-in fade-in duration-300">
        <div class="mb-8 p-10 border-2 border-dashed border-white/10 rounded-2xl text-center hover:border-primary/50 hover:bg-white/[0.02] transition-all group relative cursor-pointer">
          <input type="file" @change="handleFileUpload" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" :disabled="uploading" />
          <div v-if="uploading" class="text-primary flex flex-col items-center animate-pulse">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mb-2" />
            <span class="font-bold">Uploading...</span>
          </div>
          <div v-else class="flex flex-col items-center gap-2 text-gray-500 group-hover:text-gray-300">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
              <UIcon name="i-heroicons-cloud-arrow-up" class="w-6 h-6" />
            </div>
            <p class="text-white font-medium">Click or Drag to Upload</p>
            <p class="text-xs uppercase tracking-widest opacity-60">PDF, PNG, JPG (Max 5MB)</p>
          </div>
        </div>

        <div v-if="files.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="f in files"
            :key="f.id"
            class="flex items-center justify-between p-4 bg-secondary/60 border border-white/5 rounded-xl group hover:border-white/20 transition-all"
          >
            <div class="flex items-center gap-4 overflow-hidden">
              <div class="p-3 bg-base rounded-lg text-primary">
                <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
              </div>
              <div class="overflow-hidden">
                <p class="text-white text-sm font-medium truncate">{{ f.file_name }}</p>
                <p class="text-[10px] text-gray-500 uppercase font-bold">{{ new Date(f.created_at).toLocaleDateString() }}</p>
              </div>
            </div>
            <button
              @click="downloadFile(f.file_path)"
              class="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors"
            >
              <UIcon name="i-heroicons-arrow-down-tray" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div v-else-if="!uploading" class="text-center text-gray-600 py-10 italic">
          No files uploaded for this project yet.
        </div>
      </div>

 <!-- ── MILESTONES TAB ─────────────────────────────────────────────────── -->
<div v-if="activeTab === 'milestones'" class="animate-in fade-in duration-300">
  <ProjectMilestonesTab :project-id="projectId" />
</div>

<!-- ── CALENDAR TAB ──────────────────────────────────────────────────── -->
<div v-if="activeTab === 'calendar'" class="animate-in fade-in duration-300">
  <CalendarView :project-id="projectId" />
</div>

      <!-- ── Danger Zone ─────────────────────────────────────────────────── -->
      <div class="mt-24 pt-8 border-t border-white/5">
        <h3 class="text-red-500 font-bold mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
          Danger Zone
        </h3>
        <div class="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-red-500/10 transition-colors">
          <div>
            <p class="text-white font-medium">Delete Project</p>
            <p class="text-gray-500 text-sm">Permanently deletes all secrets, files, and events for this project.</p>
          </div>
          <button
            @click="deleteProject"
            :disabled="isDeleting"
            class="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
            <span v-else>Delete Project</span>
          </button>
        </div>
      </div>

    </div>

    <!-- ── Add Secret Modal ──────────────────────────────────────────────── -->
    <div v-if="showSecretModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showSecretModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <UIcon name="i-heroicons-lock-closed" class="w-5 h-5 text-primary" />
            New Secret
          </h2>
          <button @click="showSecretModal = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        <form @submit.prevent="addSecret" class="space-y-4">
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Key Name</label>
            <input v-model="newSecret.name" type="text" placeholder="e.g. STRIPE_SECRET_KEY" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Value</label>
            <input v-model="newSecret.value" type="text" placeholder="sk_test_..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 font-mono text-sm" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" @click="showSecretModal = false" class="flex-1 py-3 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
            <button type="submit" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-lg font-bold shadow-lg transition-all">Save Secret</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Edit Project Modal ────────────────────────────────────────────── -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showEditModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white">Edit Project</h2>
          <button @click="showEditModal = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        <form @submit.prevent="saveEdit" class="space-y-4">
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Name</label>
            <input v-model="editForm.name" type="text" required class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Description</label>
            <textarea v-model="editForm.description" rows="3" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none resize-none text-sm"></textarea>
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
            <div class="relative">
              <select v-model="editForm.status" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                <option value="lead">Lead</option>
                <option value="proposal">Proposal</option>
                <option value="active">Active</option>
                <option value="review">Review</option>
                <option value="complete">Complete</option>
                <option value="archived">Archived</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Start Date</label>
              <input v-model="editForm.start_date" type="date" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none text-sm" />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">End Date</label>
              <input v-model="editForm.end_date" type="date" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none text-sm" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Budget</label>
              <input v-model="editForm.budget" type="number" min="0" step="0.01" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Currency</label>
              <div class="relative">
                <select v-model="editForm.currency" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>
          <div class="flex gap-3 pt-4 border-t border-white/5">
            <button type="button" @click="showEditModal = false" class="px-6 py-3 rounded-lg text-gray-400 hover:text-white transition-colors font-medium text-sm">Cancel</button>
            <button type="submit" :disabled="savingEdit" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white px-4 py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              <UIcon v-if="savingEdit" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped>
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