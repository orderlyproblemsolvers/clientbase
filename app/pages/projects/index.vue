<script setup lang="ts">
const supabase = useSupabaseClient()

// ── State ─────────────────────────────────────────────────────────────────────
const loading      = ref(true)
const projects     = ref<any[]>([])
const clients      = ref<any[]>([])
const searchQuery  = ref('')
const statusFilter = ref('all')
const clientFilter = ref('all')

// ── Computed ──────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  return projects.value.filter(p => {
    const matchSearch =
      !searchQuery.value ||
      p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchStatus =
      statusFilter.value === 'all' || p.status === statusFilter.value
    const matchClient =
      clientFilter.value === 'all' || p.client_id === clientFilter.value
    return matchSearch && matchStatus && matchClient
  })
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    const { data: pData } = await supabase
      .from('projects')
      .select('*, clients(id, name)')
      .order('created_at', { ascending: false })

    projects.value = pData || []

    const { data: cData } = await supabase
      .from('clients')
      .select('id, name')
      .order('name', { ascending: true })

    clients.value = cData || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
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

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const formatBudget = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Projects</h1>
        <p class="text-gray-400 mt-1 text-sm">All active and past projects across your clients.</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 mb-8">

      <!-- Search -->
      <div class="relative flex-1">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search projects..."
          class="w-full bg-secondary border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:border-primary focus:outline-none transition-colors"
        />
      </div>

      <!-- Status filter -->
      <div class="relative w-full md:w-44">
        <select
          v-model="statusFilter"
          class="w-full bg-secondary border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="lead">Lead</option>
          <option value="proposal">Proposal</option>
          <option value="active">Active</option>
          <option value="review">Review</option>
          <option value="complete">Complete</option>
          <option value="archived">Archived</option>
        </select>
        <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
      </div>

      <!-- Client filter -->
      <div class="relative w-full md:w-48">
        <select
          v-model="clientFilter"
          class="w-full bg-secondary border border-white/5 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer text-sm"
        >
          <option value="all">All Clients</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="h-44 rounded-2xl bg-secondary border border-white/5 animate-pulse"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="text-center py-20">
      <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
        <UIcon name="i-heroicons-folder-open" class="w-8 h-8 text-gray-600" />
      </div>
      <p class="text-gray-500 font-medium">No projects found</p>
      <p class="text-gray-600 text-sm mt-1">
        {{ searchQuery || statusFilter !== 'all' || clientFilter !== 'all'
          ? 'Try adjusting your filters'
          : 'Create a project from a client page to get started' }}
      </p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink
        v-for="p in filtered"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="group bg-secondary/40 hover:bg-secondary border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all block relative overflow-hidden"
      >
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div class="relative z-10">
          <!-- Top row -->
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

          <!-- Project name -->
          <h3 class="text-white font-bold text-lg mb-1 group-hover:text-primary transition-colors">
            {{ p.name }}
          </h3>

          <!-- Client -->
          <p class="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <UIcon name="i-heroicons-building-office-2" class="w-3 h-3" />
            {{ p.clients?.name || 'No client' }}
          </p>

          <!-- Description -->
          <p v-if="p.description" class="text-gray-500 text-xs line-clamp-2 mb-4">
            {{ p.description }}
          </p>

          <!-- Meta row -->
          <div class="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
            <span v-if="p.start_date" class="flex items-center gap-1">
              <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
              {{ formatDate(p.start_date) }}
            </span>
            <span v-if="p.budget" class="flex items-center gap-1">
              <UIcon name="i-heroicons-banknotes" class="w-3 h-3" />
              {{ formatBudget(p.budget, p.currency) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

  </div>
</template>