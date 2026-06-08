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
  <div class="min-h-screen bg-base font-sans">
    <!-- ===== Welcome Banner (compact) ===== -->
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
          <button @click="showModal = true" class="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] shrink-0">
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            Add Client
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Loading Skeleton ===== -->
    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-24 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
      <div class="h-20 bg-white/5 animate-pulse rounded-2xl"></div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 h-64 bg-white/5 animate-pulse rounded-2xl"></div>
        <div class="h-64 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>
    </div>

    <template v-else>
      <!-- ===== Stat Cards ===== -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- Clients stat -->
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/5 transition-colors">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UIcon name="i-heroicons-users" class="w-5 h-5 text-primary" />
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clients</span>
          </div>
          <p class="text-3xl font-bold text-white">{{ stats.totalClients }}</p>
        </div>
        <!-- Active Projects stat -->
        <NuxtLink to="/projects" class="bg-white/[0.03] border border-white/6 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/5 hover:border-white/10 transition-all group">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-2xl bg-blue-400/10 flex items-center justify-center">
              <UIcon name="i-heroicons-folder-open" class="w-5 h-5 text-blue-400" />
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Projects</span>
          </div>
          <p class="text-3xl font-bold text-white">{{ stats.activeProjects }}</p>
        </NuxtLink>
        <!-- Outstanding stat -->
        <NuxtLink to="/retainers" class="bg-white/[0.03] border border-white/6 rounded-2xl p-5 flex flex-col justify-between hover:bg-white/5 hover:border-white/10 transition-all group">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-2xl bg-amber-400/10 flex items-center justify-center">
              <UIcon name="i-heroicons-banknotes" class="w-5 h-5 text-amber-400" />
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Outstanding</span>
          </div>
          <p class="text-xl font-bold text-amber-400 truncate">{{ fmt(stats.outstandingNGN) }}</p>
        </NuxtLink>
        <!-- Overdue stat -->
        <NuxtLink to="/retainers" class="rounded-2xl p-5 flex flex-col justify-between transition-all"
          :class="stats.overdueCount > 0 ? 'bg-red-500/6 border border-red-500/15 hover:bg-red-500/10' : 'bg-white/[0.03] border border-white/6 hover:bg-white/5'">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center"
              :class="stats.overdueCount > 0 ? 'bg-red-400/15' : 'bg-slate-400/10'">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5"
                :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'" />
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overdue</span>
          </div>
          <p class="text-3xl font-bold" :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-white'">{{ stats.overdueCount }}</p>
        </NuxtLink>
      </div>

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
          <button @click="showModal = true" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
            <div class="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
              <UIcon name="i-heroicons-user-plus" class="w-5 h-5 text-slate-400 group-hover:text-primary" />
            </div>
            <span class="text-[11px] font-semibold text-slate-400 group-hover:text-white">Client</span>
          </button>
          <NuxtLink to="/calendar" class="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
            <div class="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
              <UIcon name="i-heroicons-calendar-days" class="w-5 h-5 text-slate-400 group-hover:text-primary" />
            </div>
            <span class="text-[11px] font-semibold text-slate-400 group-hover:text-white">Calendar</span>
          </NuxtLink>
        </div>
      </div>

      <!-- ===== Main Content: Activity + Client Spotlight ===== -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- Left: Activity Feed (2 cols) -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Overdue Alert -->
          <div v-if="overdueInvoices.length" class="bg-red-500/5 border border-red-500/10 rounded-2xl p-5">
            <div class="flex items-center gap-2 mb-4">
              <span class="relative flex h-2.5 w-2.5 shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <h3 class="text-sm font-bold text-red-400 uppercase tracking-wider">Overdue Invoices</h3>
              <span class="text-xs font-bold text-red-400/70 bg-red-400/10 px-2 py-0.5 rounded-full">{{ overdueInvoices.length }}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <NuxtLink v-for="inv in overdueInvoices" :key="inv.id" to="/retainers" class="flex items-center justify-between bg-white/5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl p-3 transition-all">
                <div>
                  <p class="text-sm font-semibold text-white">{{ inv.clients?.name }}</p>
                  <p class="text-xs text-slate-500 font-mono">{{ inv.invoice_number }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-bold text-red-400">{{ fmt(getInvoiceTotal(inv), inv.currency) }}</p>
                  <p class="text-[11px] text-red-400/80">{{ daysFromNow(inv.due_date) }}</p>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Tasks Due Today -->
          <div v-if="tasksDueToday.length" class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <h3 class="text-sm font-bold text-white">Due Today</h3>
                <span class="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">{{ tasksDueToday.length }}</span>
              </div>
            </div>
            <div class="divide-y divide-white/[0.04]">
              <NuxtLink v-for="t in tasksDueToday" :key="t.id" :to="`/projects/${t.project_id}`" class="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group">
                <div class="w-4 h-4 rounded border-2 shrink-0" :class="isOverdue(t.due_date) ? 'border-red-500/40 group-hover:border-red-400' : 'border-slate-600 group-hover:border-primary'"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{{ t.title }}</p>
                  <p class="text-xs text-slate-500 mt-0.5 truncate">{{ t.milestones?.projects?.name }}</p>
                </div>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md border" :class="priorityConfig[t.priority]?.color || priorityConfig.low.color">
                  {{ priorityConfig[t.priority]?.label || t.priority }}
                </span>
              </NuxtLink>
            </div>
          </div>

          <!-- Upcoming Milestones -->
          <div v-if="upcomingMilestones.length" class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                <h3 class="text-sm font-bold text-white">Upcoming Milestones</h3>
                <span class="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">{{ upcomingMilestones.length }}</span>
              </div>
              <NuxtLink to="/calendar" class="text-xs text-slate-500 hover:text-primary transition-colors font-medium">Full calendar →</NuxtLink>
            </div>
            <div class="divide-y divide-white/[0.04]">
              <NuxtLink v-for="m in upcomingMilestones" :key="m.id" :to="`/projects/${m.project_id}`" class="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group">
                <div class="w-2 h-2 rounded-full shrink-0" :class="milestoneStatusDot[m.status] || 'bg-slate-400'"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{{ m.title }}</p>
                  <p class="text-xs text-slate-500 mt-0.5 truncate">{{ m.projects?.name }} · {{ m.projects?.clients?.name }}</p>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-xs font-semibold px-2 py-1 rounded-lg" :class="isUrgent(m.due_date) ? 'text-red-400 bg-red-400/10' : 'text-slate-400 bg-white/5'">{{ daysFromNow(m.due_date) }}</span>
                  <p class="text-[10px] text-slate-600 mt-1">{{ fmtDate(m.due_date) }}</p>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- All caught up state -->
          <div v-if="!overdueInvoices.length && !tasksDueToday.length && !upcomingMilestones.length" class="bg-white/[0.03] border border-dashed border-white/8 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
            <div class="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center mb-4">
              <UIcon name="i-heroicons-check-badge" class="w-8 h-8 text-emerald-400" />
            </div>
            <p class="text-lg font-bold text-white mb-1">You're all caught up</p>
            <p class="text-sm text-slate-500">No overdue invoices, tasks, or upcoming milestones.</p>
          </div>
        </div>

<!-- Right column: only Recent Invoices (no Client Spotlight) -->
<div class="space-y-5">
  <!-- Recent Invoices -->
  <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
    <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <UIcon name="i-heroicons-receipt-percent" class="w-4 h-4 text-primary" />
        Recent Invoices
      </h3>
      <NuxtLink to="/retainers" class="text-xs text-slate-500 hover:text-primary transition-colors font-medium">All →</NuxtLink>
    </div>
    <div v-if="!recentInvoices.length" class="px-5 py-8 text-center text-sm text-slate-500">
      No invoices yet.
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
            <span class="text-[10px] font-medium" :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.color">
              {{ invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.label }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</div>
      </div>

      <!-- ===== All Clients (full directory) ===== -->
      <section v-if="clients.length">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-white">All Clients</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ filteredClients.length }}<template v-if="searchQuery"> matching "{{ searchQuery }}"</template><template v-else> total</template>
            </p>
          </div>
        </div>

        <!-- Empty search state -->
        <div v-if="filteredClients.length === 0" class="border border-dashed border-white/8 rounded-2xl py-16 text-center">
          <UIcon name="i-heroicons-magnifying-glass" class="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p class="text-base font-semibold text-white mb-1">No matching clients</p>
          <p class="text-sm text-slate-500">Try a different search term.</p>
        </div>

        <!-- Client grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <NuxtLink v-for="c in filteredClients" :key="c.id" :to="`/clients/${c.id}`" class="group relative bg-white/[0.03] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5">
            <div class="flex items-start justify-between mb-4">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center font-bold text-lg text-primary group-hover:bg-primary/15 transition-colors">
                {{ getInitials(c.name) }}
              </div>
              <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border" :class="getCategoryColor(c.category)">
                <UIcon :name="getCategoryIcon(c.category)" class="w-3 h-3" />
                {{ c.category || 'Dev' }}
              </span>
            </div>
            <h3 class="text-base font-bold text-white group-hover:text-primary transition-colors mb-2 flex items-center gap-2">
              {{ c.name }}
              <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h3>
            <p v-if="c.website" class="text-xs text-slate-500 truncate flex items-center gap-1.5">
              <UIcon name="i-heroicons-globe-alt" class="w-3 h-3 shrink-0" />
              {{ c.website.replace(/^https?:\/\//, '') }}
            </p>
            <p v-else class="text-xs text-slate-700 italic">No website</p>
          </NuxtLink>
        </div>
      </section>
    </template>

    <!-- ===== Add Client Modal ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="add-client-title">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal"></div>
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
                  <span class="text-primary font-medium">{{ currentStep === 1 ? 'Company Profile' : 'Primary Contact' }}</span>
                </p>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                  <div class="h-1.5 rounded-full transition-all duration-300" :class="currentStep >= 1 ? 'w-5 bg-primary' : 'w-1.5 bg-white/10'"></div>
                  <div class="h-1.5 rounded-full transition-all duration-300" :class="currentStep >= 2 ? 'w-5 bg-primary' : 'w-1.5 bg-white/10'"></div>
                </div>
                <button @click="closeModal" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all ml-1" aria-label="Close">
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                </button>
              </div>
            </div>
            <!-- Form body -->
            <div class="overflow-y-auto flex-1 px-6 py-5">
              <form id="add-client-form" @submit.prevent="createClient">
                <div v-if="currentStep === 1" class="space-y-4">
                  <div class="space-y-1.5">
                    <label for="client-name" class="block text-xs font-semibold text-slate-400">Client / Company Name <span class="text-red-400">*</span></label>
                    <input id="client-name" v-model="newClient.name" type="text" autofocus required placeholder="e.g. Acme Corp" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <label for="client-category" class="block text-xs font-semibold text-slate-400">Category</label>
                      <div class="relative">
                        <select id="client-category" v-model="newClient.category" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all">
                          <option class="bg-black text-white" v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                        </select>
                        <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <label for="client-website" class="block text-xs font-semibold text-slate-400">Website</label>
                      <input id="client-website" v-model="newClient.website" type="url" placeholder="https://…" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all" />
                    </div>
                  </div>
                </div>
                <div v-if="currentStep === 2" class="space-y-4">
                  <div class="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl px-4 py-3 mb-5">
                    <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">{{ getInitials(newClient.name) }}</div>
                    <div>
                      <p class="text-sm font-semibold text-white">{{ newClient.name }}</p>
                      <p class="text-xs text-slate-500">{{ newClient.category }}</p>
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <label for="contact-name" class="block text-xs font-semibold text-slate-400">Contact Name</label>
                    <input id="contact-name" v-model="newClient.contact_name" type="text" autofocus placeholder="Jane Doe" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <label for="contact-email" class="block text-xs font-semibold text-slate-400">Email</label>
                      <input id="contact-email" v-model="newClient.contact_email" type="email" placeholder="jane@acme.com" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all" />
                    </div>
                    <div class="space-y-1.5">
                      <label for="contact-phone" class="block text-xs font-semibold text-slate-400">Phone</label>
                      <input id="contact-phone" v-model="newClient.contact_phone" type="tel" placeholder="+234…" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all" />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <!-- Footer -->
            <div class="px-6 py-4 border-t border-white/5 shrink-0 flex gap-2.5">
              <button type="button" @click="currentStep === 1 ? closeModal() : currentStep--" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">
                {{ currentStep === 1 ? 'Cancel' : 'Back' }}
              </button>
              <button v-if="currentStep === 1" type="button" @click="currentStep++" :disabled="!canProceed" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                Continue
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
              </button>
              <button v-else type="submit" form="add-client-form" :disabled="creating" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
                <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                <template v-else>
                  <UIcon name="i-heroicons-user-plus" class="w-4 h-4" />
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
.modal-leave-to { opacity: 0; }
.modal-enter-from .relative { transform: translateY(20px) scale(0.98); }
@media (max-width: 639px) {
  .modal-enter-from .relative { transform: translateY(100%); }
}
</style>