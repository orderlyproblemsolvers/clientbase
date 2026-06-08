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

const hasActiveFilters = computed(() =>
  searchQuery.value || statusFilter.value !== 'all' || clientFilter.value !== 'all'
)

const statusCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const p of projects.value) {
    counts[p.status] = (counts[p.status] || 0) + 1
  }
  return counts
})

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = 'all'
  clientFilter.value = 'all'
}

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
const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  lead:     { label: 'Lead',     dot: 'bg-slate-400',   badge: 'text-slate-300  bg-slate-400/10  border-slate-400/20'  },
  proposal: { label: 'Proposal', dot: 'bg-blue-400',    badge: 'text-blue-300   bg-blue-400/10   border-blue-400/20'   },
  active:   { label: 'Active',   dot: 'bg-emerald-400', badge: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
  review:   { label: 'Review',   dot: 'bg-amber-400',   badge: 'text-amber-300  bg-amber-400/10  border-amber-400/20'  },
  complete: { label: 'Complete', dot: 'bg-violet-400',  badge: 'text-violet-300 bg-violet-400/10 border-violet-400/20' },
  archived: { label: 'Archived', dot: 'bg-slate-600',   badge: 'text-slate-500  bg-slate-500/10  border-slate-500/20'  },
}

const statusPipeline = ['lead', 'proposal', 'active', 'review', 'complete', 'archived']

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const formatBudget = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

const totalBudget = computed(() =>
  filtered.value.reduce((sum, p) => sum + (p.budget || 0), 0)
)

const activeCount = computed(() =>
  projects.value.filter(p => p.status === 'active').length
)

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">
    <!-- ===== Hero Header ===== -->
    <div class="relative mb-8 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-white/6 p-5 md:p-6">
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <UIcon name="i-heroicons-folder-open" class="w-8 h-8 text-primary" />
            Projects
          </h1>
          <p class="text-slate-400 mt-2 text-sm">
            {{ projects.length }} project{{ projects.length !== 1 ? 's' : '' }} across {{ clients.length }} client{{ clients.length !== 1 ? 's' : '' }}
          </p>
        </div>
      </div>

      <!-- Status filter chips (inside hero card) -->
      <div v-if="!loading && projects.length > 0" class="flex gap-2 mt-5 pt-5 border-t border-white/5 overflow-x-auto">
        <button
          @click="statusFilter = 'all'"
          class="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5"
          :class="statusFilter === 'all'
            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
            : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10 hover:text-white'"
        >
          All
          <span class="opacity-60 tabular-nums">{{ projects.length }}</span>
        </button>
        <button
          v-for="key in statusPipeline.filter(s => statusCounts[s])"
          :key="key"
          @click="statusFilter = statusFilter === key ? 'all' : key"
          class="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-2"
          :class="statusFilter === key
            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
            : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10 hover:text-white'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[key].dot" aria-hidden="true"></span>
          {{ statusConfig[key].label }}
          <span class="opacity-60 tabular-nums">{{ statusCounts[key] }}</span>
        </button>
      </div>
    </div>

    <!-- ===== Filter Bar ===== -->
    <div class="flex flex-col sm:flex-row gap-2.5 mb-6">
      <!-- Search -->
      <div class="relative flex-1">
        <UIcon
          name="i-heroicons-magnifying-glass"
          class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none"
          aria-hidden="true"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search by name or description…"
          aria-label="Search projects"
          class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/40 focus:outline-none transition-all duration-150"
        />
      </div>

      <!-- Client filter -->
      <div class="relative sm:w-44">
        <select
          v-model="clientFilter"
          aria-label="Filter by client"
          class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-primary/40 focus:outline-none appearance-none cursor-pointer transition-all duration-150 pr-8"
        >
          <option class="bg-black text-white" value="all">All Clients</option>
          <option class="bg-black text-white" v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" aria-hidden="true" />
      </div>

      <!-- Clear filters -->
      <Transition name="fade">
        <button
          v-if="hasActiveFilters"
          @click="clearFilters"
          class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150 shrink-0"
          aria-label="Clear all filters"
        >
          <UIcon name="i-heroicons-x-mark" class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">Clear</span>
        </button>
      </Transition>
    </div>

    <!-- Results meta -->
    <div v-if="!loading && hasActiveFilters && projects.length > 0" class="flex items-center justify-between mb-4">
      <p class="text-xs text-slate-500">
        Showing <span class="text-white font-semibold">{{ filtered.length }}</span> of {{ projects.length }} projects
        <template v-if="totalBudget > 0">
          · <span class="text-white font-semibold">{{ formatBudget(totalBudget, 'NGN') }}</span> total budget
        </template>
      </p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="h-44 rounded-2xl bg-white/5 animate-pulse"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="border border-dashed border-white/8 rounded-2xl py-16 text-center">
      <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
        <UIcon
          :name="hasActiveFilters ? 'i-heroicons-funnel' : 'i-heroicons-folder-plus'"
          class="w-6 h-6 text-slate-600"
          aria-hidden="true"
        />
      </div>
      <p class="text-sm font-medium text-slate-300 mb-1">
        {{ hasActiveFilters ? 'No projects match your filters' : 'No projects yet' }}
      </p>
      <p class="text-xs text-slate-600 mb-5 max-w-xs mx-auto">
        {{ hasActiveFilters
          ? 'Try adjusting the search or client filter.'
          : 'Projects are created from a client page. Open a client and add their first project.' }}
      </p>
      <button
        v-if="hasActiveFilters"
        @click="clearFilters"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" aria-hidden="true" />
        Clear filters
      </button>
      <NuxtLink
        v-else
        to="/"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" aria-hidden="true" />
        Go to Clients
      </NuxtLink>
    </div>

    <!-- Project grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="p in filtered"
        :key="p.id"
        :to="`/projects/${p.id}`"
        class="group bg-white/[0.03] hover:bg-white/[0.055] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-200 block flex flex-col"
      >
        <!-- Status badge + arrow -->
        <div class="flex items-center justify-between mb-3.5">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
            :class="statusConfig[p.status]?.badge || statusConfig.active.badge"
          >
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
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

        <!-- Project name -->
        <h3 class="text-sm font-semibold text-white group-hover:text-primary transition-colors duration-150 mb-1 leading-snug">
          {{ p.name }}
        </h3>

        <!-- Client -->
        <p class="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
          <UIcon name="i-heroicons-building-office-2" class="w-3.5 h-3.5 shrink-0 text-slate-600" aria-hidden="true" />
          <NuxtLink
            :to="`/clients/${p.clients?.id}`"
            class="hover:text-primary transition-colors duration-150 truncate"
            @click.stop
          >
            {{ p.clients?.name || 'No client' }}
          </NuxtLink>
        </p>

        <!-- Description -->
        <p v-if="p.description" class="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed flex-1">
          {{ p.description }}
        </p>
        <div v-else class="flex-1"></div>

        <!-- Footer meta -->
        <div class="flex items-center gap-3 pt-3 border-t border-white/5 text-[11px] text-slate-500 flex-wrap mt-auto">
          <span v-if="p.start_date" class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-calendar-days" class="w-3.5 h-3.5" aria-hidden="true" />
            {{ formatDate(p.start_date) }}
          </span>
          <span v-if="p.budget" class="flex items-center gap-1.5 font-medium text-slate-400 tabular-nums">
            <UIcon name="i-heroicons-banknotes" class="w-3.5 h-3.5" aria-hidden="true" />
            {{ formatBudget(p.budget, p.currency) }}
          </span>
          <span v-if="p.end_date && !p.budget && !p.start_date" class="flex items-center gap-1.5">
            <UIcon name="i-heroicons-flag" class="w-3.5 h-3.5" aria-hidden="true" />
            Due {{ formatDate(p.end_date) }}
          </span>
        </div>
      </NuxtLink>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>