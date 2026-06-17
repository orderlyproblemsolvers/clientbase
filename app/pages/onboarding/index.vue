<script setup lang="ts">
import { FORM_TEMPLATES, useOnboarding } from '~/composables/useOnboarding'

const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const route    = useRoute()

const loading     = ref(true)
const fetchError  = ref('')
const forms       = ref([])
const toast       = ref({ show: false, message: '', type: 'success' })

const showNewModal     = ref(false)
const creating         = ref(false)
const selectedTemplate = ref('')
const copyFromFormId   = ref('')
const newForm = ref({ title: '', description: '', client_id: '', project_id: '' })

const clients  = ref([])
const projects = ref([])
const showCopySection = ref(false)
const filterStatus = ref('all')

const showDeleteConfirm = ref(false)
const deletingFormId    = ref<string | null>(null)
const deletingForm      = ref(false)

const showToast = (msg, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const fetchData = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const { data, error } = await supabase
      .from('onboarding_forms')
      .select('*, clients(id, name), projects(id, name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    forms.value = data || []

    const { data: cData } = await supabase.from('clients').select('id, name').order('name')
    clients.value = cData || []

    const { data: pData } = await supabase.from('projects').select('id, name, client_id').order('name')
    projects.value = pData || []
  } catch (e: any) {
    fetchError.value = e.message || 'Could not load forms'
    showToast('Failed to load forms', 'error')
  } finally {
    loading.value = false
  }
}

const filteredForms = computed(() => {
  if (filterStatus.value === 'all') return forms.value
  return forms.value.filter(f => f.status === filterStatus.value)
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = { all: forms.value.length }
  forms.value.forEach(f => {
    counts[f.status] = (counts[f.status] || 0) + 1
  })
  return counts
})

const clientProjects = computed(() =>
  newForm.value.client_id
    ? projects.value.filter(p => p.client_id === newForm.value.client_id)
    : []
)

watch(selectedTemplate, (v) => { if (v) copyFromFormId.value = '' })
watch(copyFromFormId,   (v) => { if (v) selectedTemplate.value = '' })

const createForm = async () => {
  if (!newForm.value.title.trim())   return showToast('Form requires a title', 'error')
  if (!newForm.value.client_id)      return showToast('Select a client', 'error')

  creating.value = true
  try {
    let userId = user.value?.id
    if (!userId) {
      const { data } = await supabase.auth.getSession()
      userId = data.session?.user?.id
    }
    if (!userId) throw new Error('Authentication missing')

    const { templateFields, copyFields } = useOnboarding()
    let fields = []

    if (selectedTemplate.value) {
      fields = templateFields(selectedTemplate.value)
    } else if (copyFromFormId.value) {
      const src = forms.value.find(f => f.id === copyFromFormId.value)
      if (src?.fields) fields = copyFields(src.fields)
    }

    const { data: inserted, error } = await supabase
      .from('onboarding_forms')
      .insert({
        user_id:     userId,
        title:       newForm.value.title.trim(),
        description: newForm.value.description || null,
        client_id:   newForm.value.client_id,
        project_id:  newForm.value.project_id || null,
        fields,
        status:      'draft',
      })
      .select()
      .single()

    if (error) throw error

    showNewModal.value  = false
    showCopySection.value = false
    newForm.value       = { title: '', description: '', client_id: '', project_id: '' }
    selectedTemplate.value = ''
    copyFromFormId.value   = ''
    await navigateTo(`/onboarding/${inserted.id}`)
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    creating.value = false
  }
}

const requestDeleteForm = (id: string) => {
  deletingFormId.value = id
  showDeleteConfirm.value = true
}

const confirmDeleteForm = async () => {
  if (!deletingFormId.value) return
  deletingForm.value = true
  try {
    await supabase.from('onboarding_forms').delete().eq('id', deletingFormId.value)
    forms.value = forms.value.filter(f => f.id !== deletingFormId.value)
    showToast('Form deleted')
  } catch (e) {
    showToast(e.message, 'error')
  } finally {
    deletingForm.value = false
    showDeleteConfirm.value = false
    deletingFormId.value = null
  }
}

const statusConfig = {
  draft:     { label: 'Draft',     dot: 'bg-slate-400',   badge: 'text-slate-300  bg-slate-400/10  border-slate-400/20'  },
  sent:      { label: 'Sent',     dot: 'bg-blue-400',    badge: 'text-blue-300   bg-blue-400/10   border-blue-400/20'   },
  completed: { label: 'Completed', dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
}

const copyLink = (token) => {
  const url = `${window.location.origin}/brief/${token}`
  navigator.clipboard.writeText(url)
  showToast('Client link copied')
}

onMounted(async () => {
  await fetchData()
  if (route.query.new === '1' && route.query.client) {
    newForm.value.client_id = route.query.client
    showNewModal.value = true
  }
})
</script>

<template>
  <div class="min-h-screen bg-base font-sans">
    <!-- Hero Header -->
    <div class="relative mb-8 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-white/6 p-5 md:p-6">
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <UIcon name="i-heroicons-clipboard-document-list" class="w-8 h-8 text-primary" />
            Client Onboarding
          </h1>
          <p class="text-slate-400 mt-2 text-sm max-w-lg">
            Deploy structured intake forms to collect client requirements, briefs, and legal details.
          </p>
        </div>
        <button
          @click="showNewModal = true"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98] shrink-0"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          New Form
        </button>
      </div>

      <!-- Status filter chips -->
      <div v-if="forms.length > 0" class="flex gap-2 mt-5 pt-5 border-t border-white/5 overflow-x-auto">
        <button
          @click="filterStatus = 'all'"
          class="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5"
          :class="filterStatus === 'all'
            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
            : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10 hover:text-white'"
        >
          All
          <span class="opacity-60 tabular-nums">{{ statusCounts.all || 0 }}</span>
        </button>
        <button
          v-for="s in ['draft', 'sent', 'completed']"
          :key="s"
          @click="filterStatus = s"
          class="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-2"
          :class="filterStatus === s
            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
            : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10 hover:text-white'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[s]?.dot"></span>
          {{ statusConfig[s]?.label }}
          <span v-if="statusCounts[s]" class="opacity-60 tabular-nums">{{ statusCounts[s] }}</span>
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="fetchError && !loading" class="text-center py-20">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-10 h-10 text-red-400 mx-auto mb-4" />
      <p class="text-white font-medium mb-2">Failed to load forms</p>
      <p class="text-slate-400 text-sm mb-4">{{ fetchError }}</p>
      <button @click="fetchData" class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">Retry</button>
    </div>

    <!-- Loading / Empty / Grid -->
    <div v-else>
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="i in 6" :key="i" class="h-48 bg-white/[0.03] border border-white/6 rounded-2xl animate-pulse"></div>
      </div>

      <div v-else-if="forms.length === 0" class="text-center py-20 border border-dashed border-white/8 rounded-2xl">
        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-6 h-6 text-slate-600" />
        </div>
        <p class="text-sm font-medium text-slate-300 mb-1">No onboarding forms yet</p>
        <p class="text-xs text-slate-500 mb-5 max-w-xs mx-auto">
          Create specialized onboarding frameworks to streamline early-stage client communications.
        </p>
        <button
          @click="showNewModal = true"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
          Create first form
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-if="filteredForms.length === 0" class="col-span-full text-center py-16 border border-dashed border-white/8 rounded-2xl">
          <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-funnel" class="w-6 h-6 text-slate-600" />
          </div>
          <p class="text-sm font-medium text-slate-300 mb-1">No forms match this filter</p>
          <p class="text-xs text-slate-500 mb-5">Try selecting a different status.</p>
          <button @click="filterStatus = 'all'" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
            Show all forms
          </button>
        </div>

        <div
          v-for="f in filteredForms"
          :key="f.id"
          class="bg-white/[0.03] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-200 group flex flex-col justify-between hover:bg-white/[0.055]"
        >
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border" :class="statusConfig[f.status]?.badge">
                <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[f.status]?.dot"></span>
                {{ statusConfig[f.status]?.label }}
              </span>
              <div class="flex items-center gap-0.5">
                <button v-if="f.status !== 'draft'" @click="copyLink(f.token)" class="p-1.5 rounded-xl text-slate-400 hover:text-primary hover:bg-white/8 transition-colors" title="Copy link">
                  <UIcon name="i-heroicons-link" class="w-4 h-4" />
                </button>
                <button @click="requestDeleteForm(f.id)" class="p-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                  <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <NuxtLink :to="`/onboarding/${f.id}`" class="block group-hover:translate-x-0.5 transition-transform">
              <h3 class="text-sm font-semibold text-white mb-1 group-hover:text-primary transition-colors truncate">
                {{ f.title }}
              </h3>
            </NuxtLink>

            <p v-if="f.description" class="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
              {{ f.description }}
            </p>
          </div>

          <div>
            <div class="flex items-center gap-3 text-[11px] text-slate-500 border-t border-white/5 pt-3 flex-wrap">
              <span v-if="f.clients?.name" class="flex items-center gap-1 max-w-[140px] truncate">
                <UIcon name="i-heroicons-building-office-2" class="w-3.5 h-3.5 shrink-0" />
                {{ f.clients.name }}
              </span>
              <span v-if="f.projects?.name" class="flex items-center gap-1 max-w-[140px] truncate">
                <UIcon name="i-heroicons-folder-open" class="w-3.5 h-3.5 shrink-0" />
                {{ f.projects.name }}
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-rectangle-stack" class="w-3.5 h-3.5" />
                {{ Array.isArray(f.fields) ? f.fields.length : 0 }} fields
              </span>
            </div>

            <NuxtLink
              :to="`/onboarding/${f.id}`"
              class="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/8 text-slate-400 hover:text-white text-xs font-semibold transition-all border border-white/6"
            >
              <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
              Open Editor
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- New Form Modal -->
    <ModalBase :open="showNewModal" title="New Onboarding Form" subtitle="Collect a client brief before starting a project" @close="showNewModal = false">
      <div class="space-y-5">
        <!-- Client -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Client <span class="text-red-400">*</span></label>
          <div class="relative">
            <select v-model="newForm.client_id" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
              <option value="" disabled>Select a client…</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
          </div>
          <p v-if="clients.length === 0" class="text-[10px] text-amber-400/80 mt-1.5 flex items-center gap-1">
            <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5" />
            No clients yet — <NuxtLink to="/" class="underline underline-offset-2 hover:text-amber-300">add one first</NuxtLink>
          </p>
        </div>

        <!-- Title -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Form title <span class="text-red-400">*</span></label>
          <input v-model="newForm.title" type="text" placeholder="e.g. Website Brief, Brand Identity Brief…" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
        </div>

        <!-- Project link (optional) -->
        <div v-if="clientProjects.length > 0" class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Link to a project <span class="text-slate-500 font-normal ml-1">— optional</span></label>
          <div class="relative">
            <select v-model="newForm.project_id" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
              <option value="">No project — assign later</option>
              <option v-for="p in clientProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        <!-- Description -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Description <span class="text-slate-500 font-normal ml-1">— optional</span></label>
          <textarea v-model="newForm.description" rows="2" placeholder="A short note your client will see at the top of the form…" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none transition-all duration-150 leading-relaxed"></textarea>
        </div>

        <!-- Copy from existing -->
        <div v-if="forms.length > 0" class="border border-white/6 rounded-xl overflow-hidden">
          <button type="button" @click="showCopySection = !showCopySection" class="w-full flex items-center justify-between px-4 py-3 text-xs text-slate-400 hover:text-white hover:bg-white/[0.03] transition-all">
            <span class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-duplicate" class="w-3.5 h-3.5" />
              Copy fields from a previous form
            </span>
            <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 transition-transform duration-200" :class="showCopySection ? 'rotate-180' : ''" />
          </button>
          <div v-if="showCopySection" class="px-4 pb-4 border-t border-white/5 pt-4">
            <div class="relative">
              <select v-model="copyFromFormId" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option value="">Pick a form to copy from…</option>
                <option v-for="f in forms" :key="f.id" :value="f.id">{{ f.title }} — {{ f.clients?.name || 'No client' }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
            <p class="text-[10px] text-slate-600 mt-1.5">Only the fields are copied — not the responses.</p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showNewModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="createForm" :disabled="creating || !newForm.title.trim() || !newForm.client_id" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
            <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <template v-else>
              <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
              Create Form
            </template>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Delete Confirmation Modal -->
    <ModalBase :open="showDeleteConfirm" title="Delete Form" subtitle="This action cannot be undone." @close="showDeleteConfirm = false">
      <p class="text-slate-400 text-sm">Are you sure you want to delete this form and all its submissions?</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showDeleteConfirm = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="confirmDeleteForm" :disabled="deletingForm" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            <UIcon v-if="deletingForm" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Delete</span>
          </button>
        </div>
      </template>
    </ModalBase>

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
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'" />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ModalBase already provides modal transitions */
</style>