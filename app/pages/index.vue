<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()

// ── State ─────────────────────────────────────────────────────────────────────
const loading     = ref(true)
const clients     = ref<any[]>([])
const searchQuery = ref('')
const showModal   = ref(false)
const creating    = ref(false)

// Dashboard data
const stats = ref({
  totalClients:   0,
  activeProjects: 0,
  outstandingNGN: 0,
  overdueCount:   0,
})
const overdueInvoices    = ref<any[]>([])
const upcomingMilestones = ref<any[]>([])
const tasksDueToday      = ref<any[]>([])
const recentInvoices     = ref<any[]>([])

// Add client form
const currentStep = ref(1)
const categories  = ['Educational', 'Fintech', 'Internal', 'Development', 'Personal']
const newClient   = ref({
  name: '', website: '', category: 'Development',
  contact_name: '', contact_email: '', contact_phone: '',
})

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredClients = computed(() => {
  if (!searchQuery.value) return clients.value
  const q = searchQuery.value.toLowerCase()
  return clients.value.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.website  && c.website.toLowerCase().includes(q))  ||
    (c.category && c.category.toLowerCase().includes(q))
  )
})

const canProceed = computed(() =>
  currentStep.value === 1 ? newClient.value.name.length > 0 : true
)

const today      = new Date()
const todayStr   = today.toISOString().split('T')[0]
const in7DaysStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
)

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchDashboard = async () => {
  loading.value = true
  try {
    const { data: clientData } = await supabase
      .from('clients').select('*').order('created_at', { ascending: false })
    clients.value = clientData || []
    stats.value.totalClients = clients.value.length

    const { count: projCount } = await supabase
      .from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active')
    stats.value.activeProjects = projCount || 0

    const { data: invoiceData } = await supabase
      .from('retainers')
      .select('id, title, amount, currency, status, due_date, invoice_number, clients(id, name), invoice_items(*)')
      .in('status', ['pending'])
      .order('due_date', { ascending: true })
    const allPending = invoiceData || []

    const getTotal = (r: any) => {
      if (r.invoice_items?.length)
        return r.invoice_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_rate), 0)
      return Number(r.amount)
    }

    stats.value.outstandingNGN = allPending
      .filter(r => r.currency === 'NGN')
      .reduce((s, r) => s + getTotal(r), 0)

    overdueInvoices.value = allPending
      .filter(r => r.due_date && r.due_date < todayStr).slice(0, 5)
    stats.value.overdueCount = overdueInvoices.value.length

    const { data: recentInv } = await supabase
      .from('retainers')
      .select('id, title, amount, currency, status, due_date, invoice_number, clients(id, name), invoice_items(*)')
      .order('created_at', { ascending: false }).limit(5)
    recentInvoices.value = recentInv || []

    const { data: milestoneData } = await supabase
      .from('milestones')
      .select('id, title, due_date, status, project_id, projects(id, name, clients(id, name))')
      .gte('due_date', todayStr).lte('due_date', in7DaysStr)
      .neq('status', 'complete').order('due_date', { ascending: true }).limit(6)
    upcomingMilestones.value = milestoneData || []

    const { data: taskData } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority, status, project_id, milestones(id, title, projects(id, name, clients(id, name)))')
      .lte('due_date', todayStr).neq('status', 'done')
      .order('due_date', { ascending: true }).limit(5)
    tasksDueToday.value = taskData || []

  } catch (e) {
    console.error('Dashboard fetch error:', e)
  } finally {
    loading.value = false
  }
}

// ── Add client ────────────────────────────────────────────────────────────────
const closeModal = () => {
  showModal.value = false
  setTimeout(() => {
    currentStep.value = 1
    newClient.value = {
      name: '', website: '', category: 'Development',
      contact_name: '', contact_email: '', contact_phone: '',
    }
  }, 300)
}

const createClient = async () => {
  if (!newClient.value.name) return
  creating.value = true
  try {
    const { error } = await supabase.from('clients').insert(newClient.value)
    if (error) throw error
    closeModal()
    await fetchDashboard()
  } catch (error: any) {
    alert('Error creating client: ' + error.message)
  } finally {
    creating.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCategoryColor = (cat: string) => ({
  'Educational': 'text-blue-300    bg-blue-400/10    border-blue-400/20',
  'Fintech':     'text-violet-300  bg-violet-400/10  border-violet-400/20',
  'Internal':    'text-orange-300  bg-orange-400/10  border-orange-400/20',
  'Personal':    'text-pink-300    bg-pink-400/10    border-pink-400/20',
})[cat] || 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'

const getCategoryIcon = (cat: string) => ({
  'Educational': 'i-heroicons-academic-cap',
  'Fintech':     'i-heroicons-banknotes',
  'Internal':    'i-heroicons-building-office',
  'Personal':    'i-heroicons-user',
})[cat] || 'i-heroicons-code-bracket'

const getInitials = (name: string) =>
  name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'

const fmt = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const daysFromNow = (d: string) => {
  const diff = new Date(d + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
  const days = Math.ceil(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0)   return `${Math.abs(days)}d overdue`
  return `in ${days}d`
}

const isOverdue = (d: string) =>
  Math.ceil((new Date(d + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) < 0

const isUrgent = (d: string) => {
  const days = Math.ceil((new Date(d + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  return days <= 2
}

const invoiceStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-400',   dot: 'bg-amber-400'   },
  paid:      { label: 'Paid',      color: 'text-emerald-400', dot: 'bg-emerald-400' },
  overdue:   { label: 'Overdue',   color: 'text-red-400',     dot: 'bg-red-400'     },
  cancelled: { label: 'Cancelled', color: 'text-slate-500',   dot: 'bg-slate-500'   },
}

const effectiveInvoiceStatus = (r: any) =>
  r.status === 'pending' && r.due_date && r.due_date < todayStr ? 'overdue' : r.status

const getInvoiceTotal = (r: any) => {
  if (r.invoice_items?.length)
    return r.invoice_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_rate), 0)
  return Number(r.amount)
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  high:   { label: 'High',   color: 'text-red-400    bg-red-400/10    border-red-400/20'    },
  medium: { label: 'Medium', color: 'text-amber-400  bg-amber-400/10  border-amber-400/20'  },
  low:    { label: 'Low',    color: 'text-slate-400  bg-slate-400/10  border-slate-400/20'  },
}

const milestoneStatusDot: Record<string, string> = {
  pending:     'bg-slate-400',
  in_progress: 'bg-blue-400',
  complete:    'bg-emerald-400',
}

onMounted(() => fetchDashboard())
</script>

<template>
  <div class="min-h-screen bg-base ">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div>
        <p class="text-xs font-medium text-slate-500 mb-1">{{ todayLabel }}</p>
        <h1 class="text-2xl font-bold text-white tracking-tight leading-none">
          {{ greeting }}<span class="text-slate-500">,</span>
          <span class="text-primary"> {{ user?.email?.split('@')[0] || 'there' }}</span>
        </h1>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <!-- Search -->
        <div class="relative flex-1 sm:w-56 sm:flex-none">
          <UIcon
            name="i-heroicons-magnifying-glass"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search clients…"
            aria-label="Search clients"
            class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/40 focus:outline-none transition-all duration-150"
          />
        </div>

        <!-- Add client CTA -->
        <button
          @click="showModal = true"
          class="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-150 active:scale-[0.98] shrink-0"
          aria-label="Add new client"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          <span>Add Client</span>
        </button>
      </div>
    </header>

    <!-- ── Loading skeleton ────────────────────────────────────────────────── -->
    <div v-if="loading" class="space-y-6" aria-label="Loading dashboard" aria-busy="true">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="h-24 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="lg:col-span-2 h-64 bg-white/5 animate-pulse rounded-2xl"></div>
        <div class="h-64 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-32 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
    </div>

    <template v-else>

      <!-- ── Stat cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

        <!-- Total clients -->
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-5 hover:bg-white/[0.05] transition-colors duration-150">
          <div class="flex items-start justify-between mb-3">
            <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <UIcon name="i-heroicons-users" class="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
          </div>
          <p class="text-2xl font-bold text-white tabular-nums">{{ stats.totalClients }}</p>
          <p class="text-[11px] font-medium text-slate-500 mt-1">Total Clients</p>
        </div>

        <!-- Active projects -->
        <NuxtLink
          to="/projects"
          class="bg-white/[0.03] border border-white/6 rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-150 group"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="w-8 h-8 rounded-xl bg-blue-400/10 flex items-center justify-center">
              <UIcon name="i-heroicons-folder-open" class="w-4 h-4 text-blue-400" aria-hidden="true" />
            </div>
            <UIcon name="i-heroicons-arrow-right" class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150" aria-hidden="true" />
          </div>
          <p class="text-2xl font-bold text-white tabular-nums">{{ stats.activeProjects }}</p>
          <p class="text-[11px] font-medium text-slate-500 mt-1">Active Projects</p>
        </NuxtLink>

        <!-- Outstanding -->
        <NuxtLink
          to="/retainers"
          class="bg-white/[0.03] border border-white/6 rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-150 group"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="w-8 h-8 rounded-xl bg-amber-400/10 flex items-center justify-center">
              <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-amber-400" aria-hidden="true" />
            </div>
            <UIcon name="i-heroicons-arrow-right" class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150" aria-hidden="true" />
          </div>
          <p class="text-xl font-bold text-amber-400 tabular-nums leading-tight">{{ fmt(stats.outstandingNGN) }}</p>
          <p class="text-[11px] font-medium text-slate-500 mt-1">Outstanding (NGN)</p>
        </NuxtLink>

        <!-- Overdue -->
        <NuxtLink
          to="/retainers"
          class="rounded-2xl p-5 transition-all duration-150 group"
          :class="stats.overdueCount > 0
            ? 'bg-red-500/[0.06] border border-red-500/15 hover:bg-red-500/10'
            : 'bg-white/[0.03] border border-white/6 hover:bg-white/[0.05]'"
        >
          <div class="flex items-start justify-between mb-3">
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center"
              :class="stats.overdueCount > 0 ? 'bg-red-400/15' : 'bg-slate-400/10'"
            >
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-4 h-4"
                :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'"
                aria-hidden="true"
              />
            </div>
            <UIcon name="i-heroicons-arrow-right" class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-150" aria-hidden="true" />
          </div>
          <p
            class="text-2xl font-bold tabular-nums"
            :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-white'"
          >{{ stats.overdueCount }}</p>
          <p class="text-[11px] font-medium text-slate-500 mt-1">Overdue Invoices</p>
        </NuxtLink>

      </div>

      <!-- ── Overdue alert banner ────────────────────────────────────────────── -->
      <div v-if="overdueInvoices.length > 0" class="mb-6">
        <div class="bg-red-500/[0.05] border border-red-500/15 rounded-2xl p-4">
          <div class="flex items-center gap-2.5 mb-3">
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <p class="text-red-400 text-xs font-semibold">
              {{ overdueInvoices.length }} overdue invoice{{ overdueInvoices.length !== 1 ? 's' : '' }} require attention
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <NuxtLink
              v-for="inv in overdueInvoices"
              :key="inv.id"
              to="/retainers"
              class="flex items-center justify-between bg-white/[0.03] hover:bg-red-500/[0.06] border border-white/5 hover:border-red-500/20 rounded-xl px-3.5 py-3 transition-all duration-150"
            >
              <div class="min-w-0">
                <p class="text-white text-sm font-semibold truncate">{{ inv.clients?.name }}</p>
                <p class="text-slate-500 text-xs truncate font-mono mt-0.5">{{ inv.invoice_number }}</p>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="text-red-400 font-semibold text-sm tabular-nums">{{ fmt(getInvoiceTotal(inv), inv.currency) }}</p>
                <p class="text-red-500/80 text-[10px] font-medium mt-0.5">{{ daysFromNow(inv.due_date) }}</p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- ── Main grid ───────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

        <!-- Left: Milestones + Tasks ────────────────────────────────────────── -->
        <div class="lg:col-span-2 space-y-5">

          <!-- Upcoming milestones -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UIcon name="i-heroicons-flag" class="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                </div>
                <h2 class="text-sm font-semibold text-white">Milestones</h2>
                <span class="text-[10px] text-slate-500 font-medium bg-white/5 px-1.5 py-0.5 rounded-md">Next 7 days</span>
              </div>
              <NuxtLink
                to="/calendar"
                class="text-xs text-slate-500 hover:text-primary transition-colors duration-150 font-medium flex items-center gap-1"
              >
                Calendar
                <UIcon name="i-heroicons-arrow-right" class="w-3 h-3" aria-hidden="true" />
              </NuxtLink>
            </div>

            <!-- Empty -->
            <div v-if="upcomingMilestones.length === 0" class="px-5 py-10 text-center">
              <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <UIcon name="i-heroicons-check-badge" class="w-5 h-5 text-slate-600" aria-hidden="true" />
              </div>
              <p class="text-sm font-medium text-slate-400">All clear for the week</p>
              <p class="text-xs text-slate-600 mt-1">No milestones due in the next 7 days.</p>
            </div>

            <!-- List -->
            <div v-else class="divide-y divide-white/[0.04]">
              <NuxtLink
                v-for="m in upcomingMilestones"
                :key="m.id"
                :to="`/projects/${m.project_id}`"
                class="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors duration-150 group"
              >
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="milestoneStatusDot[m.status] || 'bg-slate-400'"
                  aria-hidden="true"
                ></div>

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white group-hover:text-primary transition-colors duration-150 truncate">
                    {{ m.title }}
                  </p>
                  <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                    <UIcon name="i-heroicons-folder-open" class="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span class="truncate">{{ m.projects?.name }}</span>
                    <span v-if="m.projects?.clients?.name" class="text-slate-700 shrink-0">·</span>
                    <span v-if="m.projects?.clients?.name" class="truncate text-slate-600">{{ m.projects?.clients?.name }}</span>
                  </p>
                </div>

                <div class="shrink-0 text-right">
                  <span
                    class="text-xs font-semibold px-2 py-1 rounded-lg tabular-nums"
                    :class="isUrgent(m.due_date)
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-slate-400 bg-white/5'"
                  >
                    {{ daysFromNow(m.due_date) }}
                  </span>
                  <p class="text-[10px] text-slate-600 mt-1">{{ fmtDate(m.due_date) }}</p>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Tasks overdue or due today -->
          <div
            v-if="tasksDueToday.length > 0"
            class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden"
          >
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-amber-400/10 flex items-center justify-center">
                  <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                </div>
                <h2 class="text-sm font-semibold text-white">Tasks Due</h2>
              </div>
              <span class="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full tabular-nums">
                {{ tasksDueToday.length }}
              </span>
            </div>

            <div class="divide-y divide-white/[0.04]">
              <NuxtLink
                v-for="t in tasksDueToday"
                :key="t.id"
                :to="`/projects/${t.project_id}`"
                class="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors duration-150 group"
              >
                <!-- Checkbox visual -->
                <div
                  class="w-4 h-4 rounded border-2 shrink-0 transition-colors duration-150"
                  :class="isOverdue(t.due_date)
                    ? 'border-red-500/40 group-hover:border-red-400'
                    : 'border-slate-600 group-hover:border-primary'"
                  aria-hidden="true"
                ></div>

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white group-hover:text-primary transition-colors duration-150 truncate">
                    {{ t.title }}
                  </p>
                  <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                    <UIcon name="i-heroicons-flag" class="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span class="truncate">{{ t.milestones?.title }}</span>
                    <span class="text-slate-700 shrink-0">·</span>
                    <span class="truncate text-slate-600">{{ t.milestones?.projects?.name }}</span>
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                    :class="priorityConfig[t.priority]?.color || priorityConfig.low.color"
                  >
                    {{ priorityConfig[t.priority]?.label || t.priority }}
                  </span>
                  <span
                    class="text-xs font-semibold px-2 py-1 rounded-lg tabular-nums"
                    :class="isOverdue(t.due_date)
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-amber-400 bg-amber-400/10'"
                  >
                    {{ daysFromNow(t.due_date) }}
                  </span>
                </div>
              </NuxtLink>
            </div>
          </div>

        </div>

        <!-- Right: Invoices + Quick actions ─────────────────────────────────── -->
        <div class="space-y-5">

          <!-- Recent invoices -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UIcon name="i-heroicons-document-text" class="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                </div>
                <h2 class="text-sm font-semibold text-white">Invoices</h2>
              </div>
              <NuxtLink
                to="/retainers"
                class="text-xs text-slate-500 hover:text-primary transition-colors duration-150 font-medium flex items-center gap-1"
              >
                All
                <UIcon name="i-heroicons-arrow-right" class="w-3 h-3" aria-hidden="true" />
              </NuxtLink>
            </div>

            <div v-if="recentInvoices.length === 0" class="px-5 py-10 text-center">
              <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-slate-600" aria-hidden="true" />
              </div>
              <p class="text-sm font-medium text-slate-400 mb-3">No invoices yet</p>
              <NuxtLink
                to="/retainers"
                class="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Create your first invoice →
              </NuxtLink>
            </div>

            <div v-else class="divide-y divide-white/[0.04]">
              <NuxtLink
                v-for="inv in recentInvoices"
                :key="inv.id"
                to="/retainers"
                class="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors duration-150 group"
              >
                <!-- Client avatar -->
                <div class="w-8 h-8 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {{ getInitials(inv.clients?.name || '?') }}
                </div>

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white truncate group-hover:text-primary transition-colors duration-150">
                    {{ inv.clients?.name }}
                  </p>
                  <p class="text-[10px] text-slate-500 font-mono truncate mt-0.5">{{ inv.invoice_number }}</p>
                </div>

                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold text-white tabular-nums">
                    {{ fmt(getInvoiceTotal(inv), inv.currency) }}
                  </p>
                  <div class="flex items-center justify-end gap-1 mt-0.5">
                    <div
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.dot"
                      aria-hidden="true"
                    ></div>
                    <span
                      class="text-[10px] font-semibold"
                      :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.color"
                    >
                      {{ invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.label }}
                    </span>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3 px-1">Quick Actions</p>
            <nav class="space-y-0.5">
              <NuxtLink
                to="/retainers"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors duration-150 group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors duration-150">
                  <UIcon name="i-heroicons-document-plus" class="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-colors duration-150" aria-hidden="true" />
                </div>
                <span class="text-sm font-medium text-slate-400 group-hover:text-white transition-colors duration-150">Create Invoice</span>
              </NuxtLink>

              <NuxtLink
                to="/projects"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors duration-150 group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors duration-150">
                  <UIcon name="i-heroicons-folder-plus" class="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-colors duration-150" aria-hidden="true" />
                </div>
                <span class="text-sm font-medium text-slate-400 group-hover:text-white transition-colors duration-150">New Project</span>
              </NuxtLink>

              <NuxtLink
                to="/calendar"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors duration-150 group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors duration-150">
                  <UIcon name="i-heroicons-calendar-days" class="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-colors duration-150" aria-hidden="true" />
                </div>
                <span class="text-sm font-medium text-slate-400 group-hover:text-white transition-colors duration-150">View Calendar</span>
              </NuxtLink>

              <button
                @click="showModal = true"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors duration-150 group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors duration-150">
                  <UIcon name="i-heroicons-user-plus" class="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-colors duration-150" aria-hidden="true" />
                </div>
                <span class="text-sm font-medium text-slate-400 group-hover:text-white transition-colors duration-150">Add Client</span>
              </button>
            </nav>
          </div>

        </div>
      </div>

      <!-- ── All clients ─────────────────────────────────────────────────────── -->
      <section>
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-base font-semibold text-white">Clients</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ filteredClients.length }} of {{ clients.length }}
              <template v-if="searchQuery"> matching "{{ searchQuery }}"</template>
            </p>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="filteredClients.length === 0" class="border border-dashed border-white/8 rounded-2xl py-16 text-center">
          <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UIcon
              :name="searchQuery ? 'i-heroicons-magnifying-glass' : 'i-heroicons-user-plus'"
              class="w-6 h-6 text-slate-600"
              aria-hidden="true"
            />
          </div>
          <p class="text-sm font-medium text-slate-400 mb-1">
            {{ searchQuery ? 'No clients match your search' : 'No clients yet' }}
          </p>
          <p class="text-xs text-slate-600 mb-5">
            {{ searchQuery ? 'Try a different name, website, or category.' : 'Add your first client to get started.' }}
          </p>
          <button
            v-if="!searchQuery"
            @click="showModal = true"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" aria-hidden="true" />
            Add first client
          </button>
        </div>

        <!-- Client grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <NuxtLink
            v-for="c in filteredClients"
            :key="c.id"
            :to="`/clients/${c.id}`"
            class="group bg-white/[0.03] hover:bg-white/[0.055] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-200 block"
          >
            <div class="flex items-start justify-between mb-4">
              <!-- Initials avatar -->
              <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center font-bold text-sm text-primary group-hover:bg-primary/15 transition-colors duration-150">
                {{ getInitials(c.name) }}
              </div>

              <!-- Category badge -->
              <span
                class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border"
                :class="getCategoryColor(c.category)"
              >
                <UIcon :name="getCategoryIcon(c.category)" class="w-3 h-3" aria-hidden="true" />
                {{ c.category || 'Dev' }}
              </span>
            </div>

            <h3 class="text-sm font-semibold text-white group-hover:text-primary transition-colors duration-150 mb-1.5 leading-snug flex items-center gap-2">
              {{ c.name }}
              <UIcon
                name="i-heroicons-arrow-right"
                class="w-3.5 h-3.5 text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                aria-hidden="true"
              />
            </h3>

            <p v-if="c.website" class="text-xs text-slate-500 truncate flex items-center gap-1.5">
              <UIcon name="i-heroicons-globe-alt" class="w-3 h-3 shrink-0" aria-hidden="true" />
              {{ c.website.replace(/^https?:\/\//, '') }}
            </p>
            <p v-else class="text-xs text-slate-700 italic">No website</p>
          </NuxtLink>
        </div>
      </section>

    </template>

    <!-- ── Add Client Modal ───────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-client-title"
        >
          <!-- Scrim -->
          <div
            class="absolute inset-0 bg-black/70 backdrop-blur-sm"
            @click="closeModal"
            aria-hidden="true"
          ></div>

          <!-- Panel -->
          <div class="relative w-full sm:max-w-lg bg-[#0d1525] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">

            <!-- Mobile drag handle -->
            <div class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div class="w-10 h-1 rounded-full bg-white/10"></div>
            </div>

            <!-- Header -->
            <div class="flex items-start justify-between px-6 py-5 border-b border-white/5 shrink-0">
              <div>
                <h2 id="add-client-title" class="text-base font-bold text-white">Add New Client</h2>
                <p class="text-xs text-slate-500 mt-1">
                  Step {{ currentStep }} of 2 ·
                  <span class="text-primary font-medium">
                    {{ currentStep === 1 ? 'Company Profile' : 'Primary Contact' }}
                  </span>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <!-- Step dots -->
                <div class="flex items-center gap-1">
                  <div
                    class="h-1.5 rounded-full transition-all duration-300"
                    :class="currentStep >= 1 ? 'w-5 bg-primary' : 'w-1.5 bg-white/10'"
                  ></div>
                  <div
                    class="h-1.5 rounded-full transition-all duration-300"
                    :class="currentStep >= 2 ? 'w-5 bg-primary' : 'w-1.5 bg-white/10'"
                  ></div>
                </div>
                <button
                  @click="closeModal"
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all duration-150 ml-1"
                  aria-label="Close"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Form body -->
            <div class="overflow-y-auto flex-1 px-6 py-5">
              <form id="add-client-form" @submit.prevent="createClient">

                <!-- Step 1: Company Profile -->
                <div v-if="currentStep === 1" class="space-y-4">
                  <div class="space-y-1.5">
                    <label for="client-name" class="block text-xs font-semibold text-slate-400">
                      Client / Company Name <span class="text-red-400" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="client-name"
                      v-model="newClient.name"
                      type="text"
                      autofocus
                      required
                      placeholder="e.g. Acme Corp"
                      class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <label for="client-category" class="block text-xs font-semibold text-slate-400">Category</label>
                      <div class="relative">
                        <select
                          id="client-category"
                          v-model="newClient.category"
                          class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150"
                        >
                          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                        </select>
                        <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" aria-hidden="true" />
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <label for="client-website" class="block text-xs font-semibold text-slate-400">Website</label>
                      <input
                        id="client-website"
                        v-model="newClient.website"
                        type="url"
                        placeholder="https://…"
                        class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>

                <!-- Step 2: Contact -->
                <div v-if="currentStep === 2" class="space-y-4">
                  <!-- Client summary card -->
                  <div class="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 mb-5">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">
                      {{ getInitials(newClient.name) }}
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-white">{{ newClient.name }}</p>
                      <p class="text-xs text-slate-500">{{ newClient.category }}</p>
                    </div>
                  </div>

                  <div class="space-y-1.5">
                    <label for="contact-name" class="block text-xs font-semibold text-slate-400">Contact Name</label>
                    <input
                      id="contact-name"
                      v-model="newClient.contact_name"
                      type="text"
                      autofocus
                      placeholder="Jane Doe"
                      class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <label for="contact-email" class="block text-xs font-semibold text-slate-400">Email</label>
                      <input
                        id="contact-email"
                        v-model="newClient.contact_email"
                        type="email"
                        placeholder="jane@acme.com"
                        class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label for="contact-phone" class="block text-xs font-semibold text-slate-400">Phone</label>
                      <input
                        id="contact-phone"
                        v-model="newClient.contact_phone"
                        type="tel"
                        placeholder="+234…"
                        class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:bg-white/[0.06] focus:outline-none transition-all duration-150"
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
                @click="currentStep === 1 ? closeModal() : currentStep--"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150"
              >
                {{ currentStep === 1 ? 'Cancel' : 'Back' }}
              </button>

              <button
                v-if="currentStep === 1"
                type="button"
                @click="currentStep++"
                :disabled="!canProceed"
                class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
              >
                Continue
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                v-else
                type="submit"
                form="add-client-form"
                :disabled="creating"
                class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
              >
                <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" aria-hidden="true" />
                <template v-else>
                  <UIcon name="i-heroicons-user-plus" class="w-4 h-4" aria-hidden="true" />
                  Create Client
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
  transform: translateY(20px) scale(0.98);
}
@media (max-width: 639px) {
  .modal-enter-from .relative {
    transform: translateY(100%);
  }
}
</style>