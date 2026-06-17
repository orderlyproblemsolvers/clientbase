<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()

// ── State ─────────────────────────────────────────────────────────────────────
const loading     = ref(true)
const fetchError  = ref('')
const clients     = ref<any[]>([])
const searchQuery = ref('')
const showEngagementModal = ref(false)

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
  fetchError.value = ''
  try {
    const { data: clientData } = await supabase
      .from('clients').select('*').order('created_at', { ascending: false })
    clients.value = clientData || []
    stats.value.totalClients = clients.value.length

    const { count: projCount } = await supabase
      .from('projects').select('*', { count: 'exact', head: true }).eq('status', 'active')
    stats.value.activeProjects = projCount || 0

    // ✅ Now fetching BOTH pending and overdue invoices
    const { data: invoiceData } = await supabase
      .from('retainers')
      .select('id, title, amount, currency, status, due_date, invoice_number, clients(id, name), invoice_items(*)')
      .in('status', ['pending', 'overdue'])   // <-- changed: includes overdue
      .order('due_date', { ascending: true })
    const unpaid = invoiceData || []

    const getTotal = (r: any) => {
      if (r.invoice_items?.length)
        return r.invoice_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_rate), 0)
      return Number(r.amount)
    }

    // Outstanding NGN = sum of all unpaid (pending + overdue) in NGN
    stats.value.outstandingNGN = unpaid
      .filter(r => r.currency === 'NGN')
      .reduce((s, r) => s + getTotal(r), 0)

    // Overdue list – includes DB‑marked overdue OR pending with due date past
    const overdue = unpaid.filter(r =>
      r.status === 'overdue' || (r.status === 'pending' && r.due_date && r.due_date < todayStr)
    )
    overdueInvoices.value = overdue.slice(0, 5)
    stats.value.overdueCount = overdue.length

    // Recent invoices (unchanged – still shows latest 5 regardless of status)
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

  } catch (e: any) {
    console.error('Dashboard fetch error:', e)
    fetchError.value = e.message || 'Failed to load dashboard data.'
  } finally {
    loading.value = false
  }
}

// ── Quick Engagement callback ─────────────────────────────────────────────────
const handleEngagementCreated = async (result: { projectId?: string; formId?: string }) => {
  await fetchDashboard()
  if (result.projectId) {
    navigateTo(`/projects/${result.projectId}`)
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
  <div class="min-h-screen bg-base font-sans">
    <!-- ===== Error banner ===== -->
    <Transition name="banner">
      <div v-if="fetchError" class="mb-6 bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-sm text-red-400 flex items-start gap-3">
        <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p class="font-medium mb-1">Dashboard data could not be loaded.</p>
          <p class="text-xs opacity-80">{{ fetchError }}</p>
          <button @click="fetchDashboard" class="mt-2 text-xs font-semibold text-primary hover:text-white transition-colors">
            Retry
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== Welcome Banner + Inline Stats ===== -->
    <div class="relative mb-6 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-white/6 p-5 md:p-6">
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">{{ todayLabel }}</p>
          <h1 class="text-xl md:text-2xl font-bold text-white">
            {{ greeting }}, <span class="text-primary">{{ user?.email?.split('@')[0] || 'there' }}</span>
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative w-full md:w-56">
            <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input v-model="searchQuery" type="search" placeholder="Search clients…" class="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/40 focus:outline-none transition-all" />
          </div>
          <button @click="showEngagementModal = true" class="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] shrink-0">
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            New Engagement
          </button>
        </div>
      </div>

      <!-- Compact stats row (inside banner) -->
      <div class="mt-5 pt-5 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-users" class="w-4 h-4 text-primary" />
          <span class="text-xs text-slate-400">Clients <span class="text-white font-semibold ml-1">{{ stats.totalClients }}</span></span>
        </div>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-folder-open" class="w-4 h-4 text-blue-400" />
          <span class="text-xs text-slate-400">Active <span class="text-white font-semibold ml-1">{{ stats.activeProjects }}</span></span>
        </div>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-amber-400" />
          <span class="text-xs text-slate-400">Outstanding <span class="text-amber-400 font-semibold ml-1">{{ fmt(stats.outstandingNGN) }}</span></span>
        </div>
        <div class="flex items-center gap-2" :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
          <span class="text-xs">Overdue <span class="font-semibold ml-1">{{ stats.overdueCount }}</span></span>
        </div>
      </div>
    </div>

    <!-- ===== Loading Skeleton ===== -->
    <div v-if="loading" class="space-y-6">
      <div class="h-20 bg-white/5 animate-pulse rounded-2xl"></div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 h-64 bg-white/5 animate-pulse rounded-2xl"></div>
        <div class="h-64 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
      <div class="h-48 bg-white/5 animate-pulse rounded-2xl"></div>
    </div>

    <Transition name="fade" mode="out-in">
      <div v-if="!loading" key="loaded">
        <!-- ===== Quick Actions Bar ===== -->
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4 mb-6">
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3 px-1">Quick Actions</p>
          <div class="grid grid-cols-4 gap-2">
            <NuxtLink to="/retainers" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
              <div class="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-slate-400 group-hover:text-primary" />
              </div>
              <span class="text-[11px] font-semibold text-slate-400 group-hover:text-white">Invoice</span>
            </NuxtLink>
            <NuxtLink to="/projects" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
              <div class="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                <UIcon name="i-heroicons-folder-plus" class="w-5 h-5 text-slate-400 group-hover:text-primary" />
              </div>
              <span class="text-[11px] font-semibold text-slate-400 group-hover:text-white">Project</span>
            </NuxtLink>
            <button @click="showEngagementModal = true" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
              <div class="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                <UIcon name="i-heroicons-user-plus" class="w-5 h-5 text-slate-400 group-hover:text-primary" />
              </div>
              <span class="text-[11px] font-semibold text-slate-400 group-hover:text-white">Engagement</span>
            </button>
            <NuxtLink to="/calendar" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
              <div class="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                <UIcon name="i-heroicons-calendar-days" class="w-5 h-5 text-slate-400 group-hover:text-primary" />
              </div>
              <span class="text-[11px] font-semibold text-slate-400 group-hover:text-white">Calendar</span>
            </NuxtLink>
          </div>
        </div>

        <!-- ===== Main Content: Milestones, Overdue/Tasks, Invoices ===== -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div class="lg:col-span-2 space-y-6">
            <!-- Upcoming Milestones -->
            <div v-if="upcomingMilestones.length" class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
              <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div class="flex items-center gap-2">
                  <div class="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                  <h3 class="text-base font-bold text-white">Upcoming Milestones</h3>
                  <span class="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">{{ upcomingMilestones.length }}</span>
                </div>
                <NuxtLink to="/calendar" class="text-xs text-slate-500 hover:text-primary transition-colors font-medium">Full calendar →</NuxtLink>
              </div>
              <div class="divide-y divide-white/[0.04]">
                <NuxtLink v-for="m in upcomingMilestones" :key="m.id" :to="`/projects/${m.project_id}`" class="flex items-center gap-5 px-5 py-4 hover:bg-white/[0.03] transition-colors group">
                  <div class="w-2 h-2 rounded-full shrink-0" :class="milestoneStatusDot[m.status] || 'bg-slate-400'"></div>
                  <div class="flex-1 min-w-0">
                    <p class="text-base font-semibold text-white group-hover:text-primary transition-colors truncate">{{ m.title }}</p>
                    <div class="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <UIcon name="i-heroicons-folder-open" class="w-3.5 h-3.5 shrink-0" />
                      <span class="truncate">{{ m.projects?.name }}</span>
                      <span v-if="m.projects?.clients?.name" class="text-slate-600">·</span>
                      <span v-if="m.projects?.clients?.name" class="truncate">{{ m.projects?.clients?.name }}</span>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-lg" :class="isUrgent(m.due_date) ? 'text-red-400 bg-red-400/10' : 'text-slate-400 bg-white/5'">{{ daysFromNow(m.due_date) }}</span>
                    <p class="text-[10px] text-slate-600 mt-1">{{ fmtDate(m.due_date) }}</p>
                  </div>
                </NuxtLink>
              </div>
            </div>

            <!-- Overdue Invoices + Tasks Due Today -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Overdue Invoices -->
              <div v-if="overdueInvoices.length" class="bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
                <div class="flex items-center gap-2 mb-3">
                  <span class="relative flex h-2.5 w-2.5 shrink-0">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <h3 class="text-sm font-bold text-red-400 uppercase tracking-wider">Overdue</h3>
                  <span class="text-xs font-bold text-red-400/70 bg-red-400/10 px-2 py-0.5 rounded-full">{{ overdueInvoices.length }}</span>
                </div>
                <div class="space-y-2">
                  <NuxtLink v-for="inv in overdueInvoices" :key="inv.id" to="/retainers" class="flex items-center justify-between bg-white/5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl p-3 transition-all">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-white truncate">{{ inv.clients?.name }}</p>
                      <p class="text-xs text-slate-500 font-mono">{{ inv.invoice_number }}</p>
                    </div>
                    <div class="text-right shrink-0 ml-3">
                      <p class="text-sm font-bold text-red-400">{{ fmt(getInvoiceTotal(inv), inv.currency) }}</p>
                      <p class="text-[11px] text-red-400/80">{{ daysFromNow(inv.due_date) }}</p>
                    </div>
                  </NuxtLink>
                </div>
              </div>

              <!-- Tasks Due Today -->
              <div v-if="tasksDueToday.length" class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div class="flex items-center gap-2">
                    <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                    <h3 class="text-sm font-bold text-white">Due Today</h3>
                    <span class="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">{{ tasksDueToday.length }}</span>
                  </div>
                </div>
                <div class="divide-y divide-white/[0.04]">
                  <NuxtLink v-for="t in tasksDueToday" :key="t.id" :to="`/projects/${t.project_id}`" class="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                    <div class="w-4 h-4 rounded border-2 shrink-0" :class="isOverdue(t.due_date) ? 'border-red-500/40 group-hover:border-red-400' : 'border-slate-600 group-hover:border-primary'"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{{ t.title }}</p>
                      <p class="text-xs text-slate-500 mt-0.5 truncate">{{ t.milestones?.projects?.name }}</p>
                    </div>
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md border" :class="priorityConfig[t.priority]?.color || priorityConfig.low.color">{{ priorityConfig[t.priority]?.label || t.priority }}</span>
                  </NuxtLink>
                </div>
              </div>
            </div>

            <!-- All caught up -->
            <div v-if="!overdueInvoices.length && !tasksDueToday.length && !upcomingMilestones.length" class="bg-white/[0.03] border border-dashed border-white/8 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
              <div class="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center mb-4">
                <UIcon name="i-heroicons-check-badge" class="w-8 h-8 text-emerald-400" />
              </div>
              <p class="text-lg font-bold text-white mb-1">All clear!</p>
              <p class="text-sm text-slate-500">Nothing overdue, no tasks due today, and no upcoming milestones. Enjoy the calm.</p>
            </div>
          </div>

          <!-- Right: Recent Invoices -->
          <div class="space-y-5">
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
              <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                  <UIcon name="i-heroicons-receipt-percent" class="w-4 h-4 text-primary" />
                  Recent Invoices
                </h3>
                <NuxtLink to="/retainers" class="text-xs text-slate-500 hover:text-primary transition-colors font-medium">All →</NuxtLink>
              </div>
              <div v-if="!recentInvoices.length" class="px-5 py-8 text-center">
                <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p class="text-sm text-slate-500">No invoices yet.</p>
              </div>
              <div v-else class="divide-y divide-white/[0.04]">
                <NuxtLink v-for="inv in recentInvoices" :key="inv.id" to="/retainers" class="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
                  <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0 border border-primary/10">
                    {{ getInitials(inv.clients?.name || '?') }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate">{{ inv.clients?.name }}</p>
                    <p class="text-[11px] text-slate-500 font-mono truncate">{{ inv.invoice_number }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm font-semibold text-white">{{ fmt(getInvoiceTotal(inv), inv.currency) }}</p>
                    <div class="flex items-center justify-end gap-1 mt-0.5">
                      <div class="w-1.5 h-1.5 rounded-full" :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.dot"></div>
                      <span class="text-[10px] font-medium" :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.color">{{ invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.label }}</span>
                    </div>
                  </div>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== Clients Table ===== -->
        <section v-if="clients.length" class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold text-white">All Clients</h2>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ filteredClients.length }}<template v-if="searchQuery"> matching "{{ searchQuery }}"</template><template v-else> total</template>
              </p>
            </div>
          </div>

          <div v-if="filteredClients.length === 0" class="border border-dashed border-white/8 rounded-2xl py-16 text-center">
            <UIcon name="i-heroicons-magnifying-glass" class="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p class="text-base font-semibold text-white mb-1">No matching clients</p>
            <p class="text-sm text-slate-500">Try a different search term.</p>
          </div>

          <div v-else class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left whitespace-nowrap min-w-[600px]">
                <thead class="bg-white/5 text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-white/5">
                  <tr>
                    <th class="px-4 sm:px-5 py-4">Logo</th>
                    <th class="px-4 sm:px-5 py-4">Name</th>
                    <th class="px-4 sm:px-5 py-4 hidden sm:table-cell">Category</th>
                    <th class="px-4 sm:px-5 py-4 hidden md:table-cell">Website</th>
                    <th class="px-4 sm:px-5 py-4 hidden md:table-cell">Contact</th>
                    <th class="px-4 sm:px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr v-for="c in filteredClients" :key="c.id" class="hover:bg-white/[0.03] transition-colors group">
                    <td class="px-4 sm:px-5 py-4">
                      <div class="w-9 h-9 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center overflow-hidden">
                        <img v-if="c.logo_url" :src="c.logo_url" :alt="c.name" class="w-full h-full object-cover" />
                        <span v-else class="text-primary font-bold text-xs">{{ getInitials(c.name) }}</span>
                      </div>
                    </td>
                    <td class="px-4 sm:px-5 py-4">
                      <NuxtLink :to="`/clients/${c.id}`" class="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate block max-w-[180px]">{{ c.name }}</NuxtLink>
                    </td>
                    <td class="px-4 sm:px-5 py-4 hidden sm:table-cell">
                      <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border" :class="getCategoryColor(c.category)">
                        <UIcon :name="getCategoryIcon(c.category)" class="w-3 h-3" />
                        {{ c.category || 'Dev' }}
                      </span>
                    </td>
                    <td class="px-4 sm:px-5 py-4 hidden md:table-cell">
                      <a v-if="c.website" :href="c.website" target="_blank" class="text-xs text-slate-400 hover:text-primary transition-colors truncate block max-w-[180px]">{{ c.website.replace(/^https?:\/\//, '') }}</a>
                      <span v-else class="text-xs text-slate-600">—</span>
                    </td>
                    <td class="px-4 sm:px-5 py-4 hidden md:table-cell">
                      <div class="flex flex-col text-xs text-slate-400 gap-0.5">
                        <span v-if="c.contact_email" class="truncate max-w-[160px]">{{ c.contact_email }}</span>
                        <span v-if="c.contact_phone" class="truncate max-w-[160px]">{{ c.contact_phone }}</span>
                        <span v-if="!c.contact_email && !c.contact_phone" class="text-slate-600">—</span>
                      </div>
                    </td>
                    <td class="px-4 sm:px-5 py-4 text-right">
                      <NuxtLink :to="`/clients/${c.id}`" class="text-xs font-semibold text-primary hover:text-white transition-colors">View →</NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </Transition>

    <!-- ===== Quick Engagement Modal ===== -->
    <QuickEngagementModal
      v-if="showEngagementModal"
      @close="showEngagementModal = false"
      @created="handleEngagementCreated"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.banner-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>