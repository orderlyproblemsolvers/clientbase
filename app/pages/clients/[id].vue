<script setup lang="ts">
const route = useRoute()
const client = useSupabaseClient()
const user = useSupabaseUser()
const clientId = route.params.id as string

// ── State ────────────────────────────────────────────────────────────────────
const loading       = ref(true)
const clientData    = ref<any>(null)
const projects      = ref<any[]>([])
const isDeleting    = ref(false)
const isSavingNotes = ref(false)
const notesDirty    = ref(false)
const notesValue    = ref('')

// Add project modal
const showAddProject  = ref(false)
const creatingProject = ref(false)
const newProject = ref({
  name:        '',
  description: '',
  status:      'active',
  start_date:  '',
  end_date:    '',
  budget:      '',
  currency:    'NGN',
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    const { data: cData } = await client
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    clientData.value = cData
    notesValue.value = cData?.notes || ''
    notesDirty.value = false

    const { data: pData } = await client
      .from('projects')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    projects.value = pData || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Create project ────────────────────────────────────────────────────────────
const createProject = async () => {
  if (!newProject.value.name.trim()) return
  creatingProject.value = true
  try {
    let userId = user.value?.id
    if (!userId) {
      const { data } = await client.auth.getSession()
      userId = data.session?.user?.id
    }
    if (!userId) throw new Error('Not authenticated — please refresh and try again')

    const { error } = await client.from('projects').insert({
      client_id:   clientId,
      user_id:     userId,
      name:        newProject.value.name.trim(),
      description: newProject.value.description || null,
      status:      newProject.value.status,
      start_date:  newProject.value.start_date || null,
      end_date:    newProject.value.end_date   || null,
      budget:      newProject.value.budget ? parseFloat(newProject.value.budget) : null,
      currency:    newProject.value.currency,
    })
    if (error) throw error

    showAddProject.value = false
    newProject.value = { name: '', description: '', status: 'active', start_date: '', end_date: '', budget: '', currency: 'NGN' }
    await fetchData()
  } catch (e: any) {
    alert('Error creating project: ' + e.message)
  } finally {
    creatingProject.value = false
  }
}

// ── Client notes ──────────────────────────────────────────────────────────────
const saveNotes = async () => {
  isSavingNotes.value = true
  try {
    const { error } = await client
      .from('clients')
      .update({ notes: notesValue.value })
      .eq('id', clientId)
    if (error) throw error
    clientData.value.notes = notesValue.value
    notesDirty.value = false
  } catch (e: any) {
    alert('Failed to save notes: ' + e.message)
  } finally {
    isSavingNotes.value = false
  }
}

// ── Delete client ─────────────────────────────────────────────────────────────
const deleteClient = async () => {
  if (!confirm('Permanently delete this client and all associated projects and data?')) return
  isDeleting.value = true
  try {
    await client.from('clients').delete().eq('id', clientId)
    return navigateTo('/')
  } catch (e: any) {
    alert('Error: ' + e.message)
  } finally {
    isDeleting.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  lead:     { label: 'Lead',     dot: 'bg-slate-400',   badge: 'text-slate-300  bg-slate-400/10  border-slate-400/20'  },
  proposal: { label: 'Proposal', dot: 'bg-blue-400',    badge: 'text-blue-300   bg-blue-400/10   border-blue-400/20'   },
  active:   { label: 'Active',   dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
  review:   { label: 'Review',   dot: 'bg-amber-400',   badge: 'text-amber-300  bg-amber-400/10  border-amber-400/20'  },
  complete: { label: 'Complete', dot: 'bg-violet-400',  badge: 'text-violet-300 bg-violet-400/10 border-violet-400/20' },
  archived: { label: 'Archived', dot: 'bg-slate-600',   badge: 'text-slate-500  bg-slate-600/10  border-slate-600/20'  },
}

const formatBudget = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

const getInitials = (name: string) =>
  name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'

const activeProjects = computed(() => projects.value.filter(p => p.status === 'active').length)
const totalBudget = computed(() =>
  projects.value.reduce((sum, p) => sum + (p.budget || 0), 0)
)

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base ">

    <!-- ── Breadcrumb ──────────────────────────────────────────────────────── -->
    <nav class="flex items-center gap-1.5 text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
      <NuxtLink
        to="/"
        class="flex items-center gap-1.5 hover:text-slate-300 transition-colors duration-150"
      >
        <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
        <span>Dashboard</span>
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <span class="text-slate-300 truncate max-w-48">{{ clientData?.name || '…' }}</span>
    </nav>

    <!-- ── Skeleton loading ────────────────────────────────────────────────── -->
    <div v-if="loading && !clientData" class="space-y-8">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-white/5 animate-pulse"></div>
        <div class="space-y-2">
          <div class="h-7 w-48 bg-white/5 animate-pulse rounded-lg"></div>
          <div class="h-4 w-32 bg-white/5 animate-pulse rounded-lg"></div>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-20 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-36 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
    </div>

    <!-- ── Main content ────────────────────────────────────────────────────── -->
    <div v-else-if="clientData" class="space-y-10">

      <!-- ── Client header ───────────────────────────────────────────────── -->
      <header class="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div class="flex items-center gap-4">
          <!-- Avatar -->
          <div class="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span class="text-primary font-bold text-lg tracking-tight">{{ getInitials(clientData.name) }}</span>
          </div>

          <div>
            <div class="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 class="text-2xl font-bold text-white tracking-tight leading-none">
                {{ clientData.name }}
              </h1>
              <span
                v-if="clientData.category"
                class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white/5 border border-white/8 px-2 py-0.5 rounded-md"
              >
                {{ clientData.category }}
              </span>
            </div>

            <div class="flex items-center gap-3 flex-wrap mt-1.5">
              <a
                v-if="clientData.website"
                :href="clientData.website"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary transition-colors duration-150 group"
              >
                <UIcon name="i-heroicons-globe-alt" class="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span class="truncate max-w-48">{{ clientData.website.replace(/^https?:\/\//, '') }}</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Header actions -->
        <div class="flex items-center gap-2 shrink-0">
          <NuxtLink
            :to="`/onboarding?new=1&client=${clientId}`"
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 hover:border-white/10 transition-all duration-150"
          >
            <UIcon name="i-heroicons-clipboard-document-list" class="w-4 h-4" />
            <span class="hidden sm:inline">Onboarding</span>
          </NuxtLink>
          <button
            @click="showAddProject = true"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-150 active:scale-[0.98]"
            aria-label="New project"
          >
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            New Project
          </button>
        </div>
      </header>

      <!-- ── Stats row ───────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <!-- Contact -->
        <div
          v-if="clientData.contact_name"
          class="col-span-2 sm:col-span-1 bg-white/3 border border-white/6 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors duration-150"
        >
          <div class="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-user" class="w-4 h-4 text-slate-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Contact</p>
            <p class="text-sm font-medium text-white truncate">{{ clientData.contact_name }}</p>
          </div>
        </div>

        <!-- Email -->
        <div
          v-if="clientData.contact_email"
          class="col-span-2 sm:col-span-1 bg-white/3 border border-white/6 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors duration-150"
        >
          <div class="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-slate-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Email</p>
            <a
              :href="`mailto:${clientData.contact_email}`"
              class="text-sm font-medium text-primary hover:text-primary/80 transition-colors truncate block"
            >
              {{ clientData.contact_email }}
            </a>
          </div>
        </div>

        <!-- Phone -->
        <div
          v-if="clientData.contact_phone"
          class="col-span-2 sm:col-span-1 bg-white/3 border border-white/6 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors duration-150"
        >
          <div class="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-phone" class="w-4 h-4 text-slate-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Phone</p>
            <a
              :href="`tel:${clientData.contact_phone}`"
              class="text-sm font-medium text-white hover:text-primary transition-colors truncate block"
            >
              {{ clientData.contact_phone }}
            </a>
          </div>
        </div>

        <!-- Active projects stat -->
        <div class="bg-white/3 border border-white/6 rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:bg-white/5 transition-colors duration-150">
          <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-folder-open" class="w-4 h-4 text-primary" />
          </div>
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Active</p>
            <p class="text-sm font-bold text-white tabular-nums">
              {{ activeProjects }}<span class="text-slate-500 font-normal">/{{ projects.length }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- ── Projects section ────────────────────────────────────────────── -->
      <section>
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-base font-semibold text-white">Projects</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ projects.length }} project{{ projects.length !== 1 ? 's' : '' }}
              <template v-if="totalBudget > 0">
                · {{ formatBudget(totalBudget, projects[0]?.currency || 'NGN') }} total budget
              </template>
            </p>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="projects.length === 0"
          class="border border-dashed border-white/8 rounded-2xl p-12 text-center"
        >
          <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-folder-plus" class="w-6 h-6 text-slate-500" />
          </div>
          <p class="text-sm font-medium text-slate-300 mb-1">No projects yet</p>
          <p class="text-xs text-slate-500 mb-5 max-w-xs mx-auto">
            Start tracking work for {{ clientData.name }} by creating the first project.
          </p>
          <button
            @click="showAddProject = true"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
            Create first project
          </button>
        </div>

        <!-- Project cards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <NuxtLink
            v-for="p in projects"
            :key="p.id"
            :to="`/projects/${p.id}`"
            class="group bg-white/3 hover:bg-white/5.5 border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-200 block"
          >
            <!-- Top row: status + arrow -->
            <div class="flex items-center justify-between mb-4">
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
                :class="statusConfig[p.status]?.badge || statusConfig.active.badge"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="statusConfig[p.status]?.dot || 'bg-emerald-400'"
                  aria-hidden="true"
                ></span>
                {{ statusConfig[p.status]?.label || p.status }}
              </span>
              <UIcon
                name="i-heroicons-arrow-right"
                class="w-4 h-4 text-slate-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200"
                aria-hidden="true"
              />
            </div>

            <!-- Name -->
            <h3 class="text-sm font-semibold text-white group-hover:text-primary transition-colors duration-150 mb-1.5 leading-snug">
              {{ p.name }}
            </h3>

            <!-- Description -->
            <p v-if="p.description" class="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
              {{ p.description }}
            </p>

            <!-- Divider -->
            <div class="border-t border-white/5 pt-3 mt-auto flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
              <span v-if="p.start_date" class="flex items-center gap-1.5">
                <UIcon name="i-heroicons-calendar-days" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {{ new Date(p.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </span>
              <span v-if="p.budget" class="flex items-center gap-1.5 font-medium text-slate-400 tabular-nums">
                <UIcon name="i-heroicons-banknotes" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {{ formatBudget(p.budget, p.currency) }}
              </span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- ── Client notes ────────────────────────────────────────────────── -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">Notes</h2>
            <p class="text-xs text-slate-500 mt-0.5">Context, preferences, and communication notes</p>
          </div>
          <button
            @click="saveNotes"
            :disabled="isSavingNotes || !notesDirty"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            :class="notesDirty
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-white/5 text-slate-500 border border-white/6 cursor-default'"
          >
            <UIcon
              v-if="isSavingNotes"
              name="i-heroicons-arrow-path"
              class="w-3.5 h-3.5 animate-spin"
            />
            <UIcon v-else name="i-heroicons-check" class="w-3.5 h-3.5" />
            {{ isSavingNotes ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <textarea
          v-model="notesValue"
          @input="notesDirty = true"
          rows="6"
          placeholder="Add notes about this client — context, preferences, communication style, key decisions…"
          class="w-full bg-white/3 border border-white/6 rounded-2xl px-5 py-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all duration-150 leading-relaxed resize-y"
        ></textarea>
      </section>

      <!-- ── Danger zone ─────────────────────────────────────────────────── -->
      <section class="pt-8 border-t border-white/5">
        <p class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-1.5">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5" aria-hidden="true" />
          Danger Zone
        </p>
        <div class="bg-red-500/4 border border-red-500/10 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p class="text-sm font-semibold text-white mb-0.5">Delete this client</p>
            <p class="text-xs text-slate-500 leading-relaxed">
              Permanently removes {{ clientData.name }} along with all projects, files, and data. This action cannot be undone.
            </p>
          </div>
          <button
            @click="deleteClient"
            :disabled="isDeleting"
            class="shrink-0 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
            aria-label="Delete client permanently"
          >
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <template v-else>
              <UIcon name="i-heroicons-trash" class="w-4 h-4" aria-hidden="true" />
              Delete Client
            </template>
          </button>
        </div>
      </section>
    </div>

    <!-- ── Add Project Modal ───────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showAddProject"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <!-- Scrim -->
          <div
            class="absolute inset-0 bg-black/70 backdrop-blur-sm"
            @click="showAddProject = false"
            aria-hidden="true"
          ></div>

          <!-- Panel -->
          <div class="relative w-full sm:max-w-lg bg-[#0d1525] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">

            <!-- Drag indicator (mobile) -->
            <div class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div class="w-10 h-1 rounded-full bg-white/10"></div>
            </div>

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
              <div>
                <h2 id="modal-title" class="text-base font-bold text-white">New Project</h2>
                <p class="text-xs text-slate-500 mt-0.5">For {{ clientData?.name }}</p>
              </div>
              <button
                @click="showAddProject = false"
                class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all duration-150"
                aria-label="Close modal"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>

            <!-- Scrollable form body -->
            <div class="overflow-y-auto flex-1 px-6 py-5">
              <form @submit.prevent="createProject" class="space-y-5" id="new-project-form">

                <!-- Name -->
                <div class="space-y-1.5">
                  <label for="proj-name" class="block text-xs font-semibold text-slate-400">
                    Project Name <span class="text-red-400" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="proj-name"
                    v-model="newProject.name"
                    type="text"
                    autofocus
                    required
                    placeholder="e.g. Website Redesign"
                    class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
                  />
                </div>

                <!-- Description -->
                <div class="space-y-1.5">
                  <label for="proj-desc" class="block text-xs font-semibold text-slate-400">Description</label>
                  <textarea
                    id="proj-desc"
                    v-model="newProject.description"
                    rows="3"
                    placeholder="Brief description of the project scope…"
                    class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150 resize-none leading-relaxed"
                  ></textarea>
                </div>

                <!-- Status -->
                <div class="space-y-1.5">
                  <label for="proj-status" class="block text-xs font-semibold text-slate-400">Status</label>
                  <div class="relative">
                    <select
                      id="proj-status"
                      v-model="newProject.status"
                      class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150"
                    >
                      <option value="lead">Lead</option>
                      <option value="proposal">Proposal</option>
                      <option value="active">Active</option>
                      <option value="review">In Review</option>
                      <option value="complete">Complete</option>
                      <option value="archived">Archived</option>
                    </select>
                    <UIcon
                      name="i-heroicons-chevron-up-down"
                      class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <!-- Dates -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <label for="proj-start" class="block text-xs font-semibold text-slate-400">Start Date</label>
                    <input
                      id="proj-start"
                      v-model="newProject.start_date"
                      type="date"
                      class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label for="proj-end" class="block text-xs font-semibold text-slate-400">End Date</label>
                    <input
                      id="proj-end"
                      v-model="newProject.end_date"
                      type="date"
                      class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150"
                    />
                  </div>
                </div>

                <!-- Budget + Currency -->
                <div class="space-y-1.5">
                  <label for="proj-budget" class="block text-xs font-semibold text-slate-400">Budget</label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <select
                        v-model="newProject.currency"
                        aria-label="Currency"
                        class="absolute left-3 top-1/2 -translate-y-1/2 bg-transparent text-xs font-semibold text-slate-400 focus:outline-none appearance-none cursor-pointer w-12 z-10"
                      >
                        <option value="NGN">NGN</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                      </select>
                      <input
                        id="proj-budget"
                        v-model="newProject.budget"
                        type="number"
                        placeholder="0"
                        min="0"
                        step="1"
                        class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-14 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>

              </form>
            </div>

            <!-- Footer actions -->
            <div class="px-6 py-4 border-t border-white/5 shrink-0 flex gap-2.5">
              <button
                type="button"
                @click="showAddProject = false"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-project-form"
                :disabled="creatingProject || !newProject.name.trim()"
                class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
              >
                <UIcon v-if="creatingProject" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                <template v-else>
                  <UIcon name="i-heroicons-folder-plus" class="w-4 h-4" />
                  Create Project
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
</style>