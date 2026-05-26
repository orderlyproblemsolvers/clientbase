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
    // Mirror the same ID recovery pattern from useUserProfile.ts
    let userId = user.value?.id
    if (!userId) {
      const { data } = await client.auth.getSession()
      userId = data.session?.user?.id
    }
    if (!userId) throw new Error('Not authenticated — please refresh and try again')

    const { error } = await client.from('projects').insert({
      client_id:   clientId,
      user_id:     userId,            // ← now guaranteed to be a real UUID
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
const statusConfig: Record<string, { label: string; color: string }> = {
  lead:     { label: 'Lead',     color: 'text-gray-400  bg-gray-400/10  border-gray-400/20'  },
  proposal: { label: 'Proposal', color: 'text-blue-400  bg-blue-400/10  border-blue-400/20'  },
  active:   { label: 'Active',   color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  review:   { label: 'Review',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  complete: { label: 'Complete', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  archived: { label: 'Archived', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20'   },
}

const formatBudget = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Breadcrumb -->
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8">
      <NuxtLink to="/" class="hover:text-primary transition-colors flex items-center gap-1">
        <UIcon name="i-heroicons-home" class="w-4 h-4" />
        Dashboard
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3 h-3 text-gray-600" />
      <span class="text-gray-300 font-medium">{{ clientData?.name || 'Loading...' }}</span>
    </nav>

    <!-- Loading -->
    <div v-if="loading && !clientData" class="space-y-6">
      <div class="h-10 w-64 bg-secondary/50 animate-pulse rounded-lg"></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-24 bg-secondary/50 animate-pulse rounded-xl"></div>
      </div>
    </div>

    <div v-else-if="clientData">

      <!-- Client Header -->
      <header class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/5 pb-6 gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
            {{ clientData.name }}
          </h1>
          <div class="flex items-center gap-3 flex-wrap">
            <span class="bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <UIcon name="i-heroicons-tag" class="w-3 h-3" />
              {{ clientData.category || 'General' }}
            </span>
            <a
              v-if="clientData.website"
              :href="clientData.website"
              target="_blank"
              class="flex items-center gap-1 text-primary hover:text-white transition-colors text-sm font-medium"
            >
              <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
              {{ clientData.website }}
            </a>
          </div>
        </div>
      </header>

      <!-- Contact Cards -->
      <div v-if="clientData.contact_name" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div class="bg-secondary/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          <div class="p-3 bg-base rounded-lg text-gray-400">
            <UIcon name="i-heroicons-user" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Contact Person</p>
            <p class="text-white text-sm font-medium">{{ clientData.contact_name }}</p>
          </div>
        </div>

        <div v-if="clientData.contact_email" class="bg-secondary/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          <div class="p-3 bg-base rounded-lg text-gray-400">
            <UIcon name="i-heroicons-envelope" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Email</p>
            <a :href="`mailto:${clientData.contact_email}`" class="text-primary text-sm font-medium hover:underline">
              {{ clientData.contact_email }}
            </a>
          </div>
        </div>

        <div v-if="clientData.contact_phone" class="bg-secondary/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          <div class="p-3 bg-base rounded-lg text-gray-400">
            <UIcon name="i-heroicons-phone" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Phone</p>
            <a :href="`tel:${clientData.contact_phone}`" class="text-white text-sm font-medium hover:text-primary transition-colors">
              {{ clientData.contact_phone }}
            </a>
          </div>
        </div>
      </div>

      <!-- ── Projects Section ────────────────────────────────────────────── -->
      <section class="mb-12">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-bold text-white">Projects</h2>
            <p class="text-xs text-gray-500 mt-0.5">
              {{ projects.length }} project{{ projects.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <button
            @click="showAddProject = true"
            class="bg-primary hover:bg-[#3d34d9] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            New Project
          </button>
        </div>

        <!-- Empty state -->
        <div
          v-if="projects.length === 0"
          class="border-2 border-dashed border-white/5 rounded-2xl p-12 text-center"
        >
          <div class="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-folder-open" class="w-7 h-7 text-gray-600" />
          </div>
          <p class="text-gray-500 font-medium mb-1">No projects yet</p>
          <p class="text-gray-600 text-sm mb-4">Create your first project to start tracking work for {{ clientData.name }}.</p>
          <button
            @click="showAddProject = true"
            class="text-primary hover:text-white text-sm font-bold transition-colors"
          >
            + Create first project
          </button>
        </div>

        <!-- Project cards -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="p in projects"
            :key="p.id"
            :to="`/projects/${p.id}`"
            class="group bg-secondary/40 hover:bg-secondary border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all block relative overflow-hidden"
          >
            <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div class="relative z-10">
              <!-- Status badge -->
              <div class="flex items-start justify-between mb-4">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border"
                  :class="statusConfig[p.status]?.color || statusConfig.active.color"
                >
                  {{ statusConfig[p.status]?.label || p.status }}
                </span>
                <UIcon
                  name="i-heroicons-arrow-right"
                  class="w-4 h-4 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                />
              </div>

              <!-- Name -->
              <h3 class="text-white font-bold text-base mb-1 group-hover:text-primary transition-colors">
                {{ p.name }}
              </h3>

              <!-- Description -->
              <p v-if="p.description" class="text-gray-500 text-xs line-clamp-2 mb-4">
                {{ p.description }}
              </p>

              <!-- Meta -->
              <div class="flex items-center gap-3 text-[10px] text-gray-500 mt-3 flex-wrap">
                <span v-if="p.start_date" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                  {{ new Date(p.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                </span>
                <span v-if="p.budget" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-banknotes" class="w-3 h-3" />
                  {{ formatBudget(p.budget, p.currency) }}
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- ── Client Notes Section ────────────────────────────────────────── -->
      <section class="mb-12">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-gray-400" />
            Client Notes
          </h2>
          <button
            @click="saveNotes"
            :disabled="isSavingNotes"
            class="bg-white/5 hover:bg-white/10 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <UIcon v-if="isSavingNotes" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
            <UIcon v-else name="i-heroicons-check" class="w-3.5 h-3.5" />
            Save
          </button>
        </div>
        <textarea
          v-model="notesValue"
          rows="6"
          placeholder="General notes about this client — context, preferences, communication style..."
          class="w-full bg-secondary/40 border border-white/5 rounded-2xl p-6 text-gray-300 text-sm focus:outline-none focus:border-primary/50 transition-all leading-relaxed resize-y placeholder-gray-700"
        ></textarea>
      </section>

      <!-- ── Danger Zone ─────────────────────────────────────────────────── -->
      <div class="mt-8 pt-8 border-t border-white/5">
        <h3 class="text-red-500 font-bold mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
          Danger Zone
        </h3>
        <div class="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-red-500/10 transition-colors">
          <div>
            <p class="text-white font-medium">Delete Client</p>
            <p class="text-gray-500 text-sm">Deletes the client and all projects, files, and data. Cannot be undone.</p>
          </div>
          <button
            @click="deleteClient"
            :disabled="isDeleting"
            class="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
            <span v-else>Delete Client</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── Add Project Modal ─────────────────────────────────────────────── -->
    <div v-if="showAddProject" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showAddProject = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">

        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white">New Project</h2>
          <button @click="showAddProject = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>

        <form @submit.prevent="createProject" class="space-y-4">

          <!-- Name -->
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Project Name <span class="text-red-500">*</span></label>
            <input
              v-model="newProject.name"
              type="text"
              autofocus
              required
              placeholder="e.g. Website Redesign"
              class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Description</label>
            <textarea
              v-model="newProject.description"
              rows="3"
              placeholder="Brief description of the project scope..."
              class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors resize-none text-sm"
            ></textarea>
          </div>

          <!-- Status -->
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
            <div class="relative">
              <select
                v-model="newProject.status"
                class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer"
              >
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

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Start Date</label>
              <input
                v-model="newProject.start_date"
                type="date"
                class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">End Date</label>
              <input
                v-model="newProject.end_date"
                type="date"
                class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none text-sm"
              />
            </div>
          </div>

          <!-- Budget -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Budget</label>
              <input
                v-model="newProject.budget"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors"
              />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Currency</label>
              <div class="relative">
                <select
                  v-model="newProject.currency"
                  class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              @click="showAddProject = false"
              class="px-6 py-3 rounded-lg text-gray-400 hover:text-white transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creatingProject || !newProject.name.trim()"
              class="flex-1 bg-primary hover:bg-[#3d34d9] text-white px-4 py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              <UIcon v-if="creatingProject" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
              <span v-else>Create Project</span>
            </button>
          </div>

        </form>
      </div>
    </div>

  </div>
</template>