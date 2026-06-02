<template>
  <div class="min-h-screen  animate-in fade-in duration-300">

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-5 border-b border-white/[0.04]">
      <div>
        <h1 class="text-2xl font-semibold text-white tracking-tight flex items-center gap-2.5">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-6 h-6 text-indigo-400" />
          Client Onboarding
        </h1>
        <p class="text-slate-400 mt-1 text-xs tracking-wide">
          Deploy structured intake forms to collect client requirements, briefs, and legal details.
        </p>
      </div>
      <button
        @click="showNewModal = true"
        class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        New Form
      </button>
    </div>

    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="i in 3" :key="i" class="h-48 bg-white/[0.02] border border-white/[0.04] rounded-xl animate-pulse"></div>
    </div>

    <div v-else-if="forms.length === 0" class="text-center py-20 border border-dashed border-white/[0.06] rounded-xl bg-white/[0.01]">
      <div class="w-12 h-12 bg-white/[0.03] border border-white/[0.06] rounded-lg flex items-center justify-center mx-auto mb-4">
        <UIcon name="i-heroicons-clipboard-document-list" class="w-5 h-5 text-slate-500" />
      </div>
      <p class="text-white font-medium text-sm">No onboarding profiles found</p>
      <p class="text-slate-500 text-xs mt-1 mb-5 max-w-xs mx-auto">Create specialized onboarding frameworks to streamline early-stage client communications.</p>
      <button @click="showNewModal = true" class="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors">
        + Provision initial entry form
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="f in forms"
        :key="f.id"
        class="bg-white/[0.01] border border-white/[0.05] hover:border-white/[0.12] rounded-xl p-5 transition-all group flex flex-col justify-between"
      >
        <div>
          <div class="flex items-center justify-between mb-4">
            <span
              class="px-2 py-0.5 rounded text-[10px] tracking-wider uppercase font-semibold border flex items-center gap-1.5"
              :class="statusConfig[f.status]?.color"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[f.status]?.dot"></span>
              {{ statusConfig[f.status]?.label }}
            </span>
            <div class="flex items-center gap-0.5">
              <button
                v-if="f.status !== 'draft'"
                @click="copyLink(f.token)"
                class="p-1.5 rounded text-slate-400 hover:text-indigo-400 hover:bg-white/[0.04] transition-colors"
                title="Copy pipeline URL"
              >
                <UIcon name="i-heroicons-link" class="w-4 h-4" />
              </button>
              <button
                @click="deleteForm(f.id)"
                class="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Purge form profile"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <NuxtLink :to="`/onboarding/${f.id}`" class="block group-hover:translate-x-0.5 transition-transform">
            <h3 class="text-white font-medium text-sm mb-1 group-hover:text-indigo-400 transition-colors truncate">
              {{ f.title }}
            </h3>
          </NuxtLink>

          <p v-if="f.description" class="text-slate-400 text-xs line-clamp-2 mb-4 leading-relaxed">
            {{ f.description }}
          </p>
        </div>

        <div>
          <div class="flex items-center gap-3 text-[10px] text-slate-500 border-t border-white/[0.04] pt-3 flex-wrap">
            <span v-if="f.clients?.name" class="flex items-center gap-1 max-w-[120px] truncate">
              <UIcon name="i-heroicons-building-office-2" class="w-3.5 h-3.5 opacity-70 shrink-0" />
              {{ f.clients.name }}
            </span>
            <span v-if="f.projects?.name" class="flex items-center gap-1 max-w-[120px] truncate">
              <UIcon name="i-heroicons-folder-open" class="w-3.5 h-3.5 opacity-70 shrink-0" />
              {{ f.projects.name }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-heroicons-rectangle-stack" class="w-3.5 h-3.5 opacity-70" />
              {{ Array.isArray(f.fields) ? f.fields.length : 0 }} metrics
            </span>
          </div>

          <NuxtLink
            :to="`/onboarding/${f.id}`"
            class="mt-4 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 hover:text-white text-xs font-medium transition-all border border-white/[0.04]"
          >
            <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
            Open Editor Architecture
          </NuxtLink>
        </div>
      </div>
    </div>

<!-- ── New Form Modal ─────────────────────────────────────────────────────── -->
<div v-if="showNewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div @click="showNewModal = false" class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

  <div class="relative w-full max-w-md bg-[#0e121e] border border-white/[0.08] rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
      <div>
        <h2 class="text-sm font-semibold text-white">New Onboarding Form</h2>
        <p class="text-[11px] text-slate-500 mt-0.5">Collect a client brief before starting a project</p>
      </div>
      <button
        @click="showNewModal = false"
        class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all"
      >
        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="px-5 py-5 space-y-4">

      <!-- Client — required, always first -->
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1.5">
          Client
          <span class="text-indigo-400 ml-0.5">*</span>
        </label>
        <div class="relative">
          <select
            v-model="newForm.client_id"
            class="w-full bg-white/[0.03] border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none appearance-none cursor-pointer transition-colors"
            :class="newForm.client_id
              ? 'border-white/[0.10] focus:border-indigo-500/60'
              : 'border-white/[0.06] focus:border-indigo-500/60'"
          >
            <option value="" disabled class="bg-[#0e121e]">Select a client…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id" class="bg-[#0e121e]">
              {{ c.name }}
            </option>
          </select>
          <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
        </div>
        <p v-if="clients.length === 0" class="text-[11px] text-amber-400/80 mt-1.5 flex items-center gap-1">
          <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5" />
          No clients yet — <NuxtLink to="/" class="underline underline-offset-2">add one first</NuxtLink>
        </p>
      </div>

      <!-- Form title — required -->
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1.5">
          Form title
          <span class="text-indigo-400 ml-0.5">*</span>
        </label>
        <input
          v-model="newForm.title"
          type="text"
          placeholder="e.g. Website Brief, Brand Identity Brief…"
          class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors"
        />
      </div>

      <!-- Project link — optional, only shown when client has projects -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
      >
        <div v-if="clientProjects.length > 0">
          <label class="block text-xs font-medium text-slate-300 mb-1.5">
            Link to a project
            <span class="text-slate-500 font-normal ml-1">— optional</span>
          </label>
          <div class="relative">
            <select
              v-model="newForm.project_id"
              class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none appearance-none cursor-pointer transition-colors"
            >
              <option value="" class="bg-[#0e121e]">No project — I'll assign it later</option>
              <option v-for="p in clientProjects" :key="p.id" :value="p.id" class="bg-[#0e121e]">
                {{ p.name }}
              </option>
            </select>
            <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
          </div>
          <p class="text-[11px] text-slate-500 mt-1.5">
            If none, a new project is created when the form is submitted.
          </p>
        </div>
      </Transition>

      <!-- Description — optional -->
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1.5">
          Description
          <span class="text-slate-500 font-normal ml-1">— optional</span>
        </label>
        <textarea
          v-model="newForm.description"
          rows="2"
          placeholder="A short note your client will see at the top of the form…"
          class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none resize-none transition-colors leading-relaxed"
        ></textarea>
      </div>

      <!-- Copy from existing — optional, collapsed by default -->
      <div v-if="forms.length > 0" class="border border-white/[0.05] rounded-lg overflow-hidden">
        <button
          type="button"
          @click="showCopySection = !showCopySection"
          class="w-full flex items-center justify-between px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.03] transition-all"
        >
          <span class="flex items-center gap-2">
            <UIcon name="i-heroicons-document-duplicate" class="w-3.5 h-3.5" />
            Copy fields from a previous form
          </span>
          <UIcon
            name="i-heroicons-chevron-down"
            class="w-3.5 h-3.5 transition-transform duration-200"
            :class="showCopySection ? 'rotate-180' : ''"
          />
        </button>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
        >
          <div v-if="showCopySection" class="px-3 pb-3 border-t border-white/[0.05] pt-3">
            <div class="relative">
              <select
                v-model="copyFromFormId"
                class="w-full bg-white/[0.03] border border-white/[0.06] focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none appearance-none cursor-pointer transition-colors"
              >
                <option value="" class="bg-[#0e121e]">Pick a form to copy from…</option>
                <option v-for="f in forms" :key="f.id" :value="f.id" class="bg-[#0e121e]">
                  {{ f.title }} — {{ f.clients?.name || 'No client' }}
                </option>
              </select>
              <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5 pointer-events-none" />
            </div>
            <p class="text-[11px] text-slate-500 mt-1.5">Only the fields are copied — not the responses.</p>
          </div>
        </Transition>
      </div>

    </div>

    <!-- Footer -->
    <div class="px-5 pb-5 flex items-center gap-2.5">
      <button
        type="button"
        @click="showNewModal = false"
        class="flex-1 py-2.5 rounded-lg border border-white/[0.07] text-slate-400 hover:text-white hover:border-white/[0.14] text-xs font-medium transition-all"
      >
        Cancel
      </button>
      <button
        @click="createForm"
        :disabled="creating || !newForm.title.trim() || !newForm.client_id"
        class="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/30"
      >
        <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
        <UIcon v-else name="i-heroicons-arrow-right" class="w-3.5 h-3.5" />
        {{ creating ? 'Creating…' : 'Create Form' }}
      </button>
    </div>

  </div>
</div>

    <Transition 
      enter-active-class="transform ease-out duration-200 transition" 
      enter-from-class="translate-y-2 opacity-0" 
      enter-to-class="translate-y-0 opacity-100" 
      leave-active-class="transition ease-in duration-100" 
      leave-from-class="opacity-100" 
      leave-to-class="opacity-0"
    >
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg shadow-xl border bg-[#0c101b]" :class="toast.type === 'success' ? 'border-emerald-500/30' : 'border-rose-500/30'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-4 h-4" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-rose-400'" />
          <span class="font-medium text-xs text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { FORM_TEMPLATES, useOnboarding } from '~/composables/useOnboarding'

const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const route    = useRoute()

const loading = ref(true)
const forms   = ref([])
const toast   = ref({ show: false, message: '', type: 'success' })

const showNewModal     = ref(false)
const creating         = ref(false)
const selectedTemplate = ref('')       // built-in template target identifier
const copyFromFormId   = ref('')       // existing layout baseline ID target
const newForm = ref({ title: '', description: '', client_id: '', project_id: '' })

const clients  = ref([])
const projects = ref([])
const showCopySection = ref(false)

const showToast = (msg, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const fetchData = async () => {
  loading.value = true
  try {
    const { data } = await supabase
      .from('onboarding_forms')
      .select('*, clients(id, name), projects(id, name)')
      .order('created_at', { ascending: false })
    forms.value = data || []

    const { data: cData } = await supabase.from('clients').select('id, name').order('name')
    clients.value = cData || []

    const { data: pData } = await supabase.from('projects').select('id, name, client_id').order('name')
    projects.value = pData || []
  } catch (e) { 
    console.error(e) 
  } finally { 
    loading.value = false 
  }
}

const clientProjects = computed(() =>
  newForm.value.client_id
    ? projects.value.filter(p => p.client_id === newForm.value.client_id)
    : []
)

// Structural Mutual Exclusion Watches
watch(selectedTemplate, (v) => { if (v) copyFromFormId.value = '' })
watch(copyFromFormId,   (v) => { if (v) selectedTemplate.value = '' })

const createForm = async () => {
  if (!newForm.value.title.trim())   return showToast('Form mapping requires descriptive title', 'error')
  if (!newForm.value.client_id)      return showToast('Target structural client definition required', 'error')

  creating.value = true
  try {
    let userId = user.value?.id
    if (!userId) {
      const { data } = await supabase.auth.getSession()
      userId = data.session?.user?.id
    }
    if (!userId) throw new Error('Authentication parameters missing')

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

const deleteForm = async (id) => {
  if (!confirm('Confirm definitive removal of this initialization vector?')) return
  try {
    await supabase.from('onboarding_forms').delete().eq('id', id)
    forms.value = forms.value.filter(f => f.id !== id)
    showToast('Onboarding profile purged successfully')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

const statusConfig = {
  draft:     { label: 'Draft',     color: 'text-slate-400  bg-slate-400/10  border-slate-500/20',  dot: 'bg-slate-400' },
  sent:      { label: 'Dispatched', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-500/20', dot: 'bg-indigo-400' },
  completed: { label: 'Finalized',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20', dot: 'bg-emerald-400' },
}

const copyLink = (token) => {
  const url = `${window.location.origin}/brief/${token}`
  navigator.clipboard.writeText(url)
  showToast('Access pipeline URL mapped to clipboard')
}

onMounted(async () => {
  await fetchData()
  
  if (route.query.new === '1' && route.query.client) {
    newForm.value.client_id = route.query.client
    showNewModal.value = true
  }
})
</script>