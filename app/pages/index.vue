<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()

// ── State ─────────────────────────────────────────────────────────────────────
const loading    = ref(true)
const clients    = ref<any[]>([])
const searchQuery = ref('')
const showModal  = ref(false)
const creating   = ref(false)

// Dashboard data
const stats = ref({
  totalClients:    0,
  activeProjects:  0,
  outstandingNGN:  0,
  overdueCount:    0,
})
const overdueInvoices   = ref<any[]>([])
const upcomingMilestones = ref<any[]>([])
const tasksDueToday      = ref<any[]>([])
const recentInvoices     = ref<any[]>([])

// Add client form (unchanged from original)
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
    (c.website   && c.website.toLowerCase().includes(q))   ||
    (c.category  && c.category.toLowerCase().includes(q))
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
    // Clients
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    clients.value = clientData || []
    stats.value.totalClients = clients.value.length

    // Active projects count
    const { count: projCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
    stats.value.activeProjects = projCount || 0

    // Invoices — outstanding + overdue
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
      .filter(r => r.due_date && r.due_date < todayStr)
      .slice(0, 5)

    stats.value.overdueCount = overdueInvoices.value.length

    // Recent invoices (last 5 regardless of status)
    const { data: recentInv } = await supabase
      .from('retainers')
      .select('id, title, amount, currency, status, due_date, invoice_number, clients(id, name), invoice_items(*)')
      .order('created_at', { ascending: false })
      .limit(5)
    recentInvoices.value = recentInv || []

    // Milestones due in next 7 days (not complete)
    const { data: milestoneData } = await supabase
      .from('milestones')
      .select('id, title, due_date, status, project_id, projects(id, name, clients(id, name))')
      .gte('due_date', todayStr)
      .lte('due_date', in7DaysStr)
      .neq('status', 'complete')
      .order('due_date', { ascending: true })
      .limit(6)
    upcomingMilestones.value = milestoneData || []

    // Tasks due today or overdue (not done)
    const { data: taskData } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority, status, project_id, milestones(id, title, projects(id, name, clients(id, name)))')
      .lte('due_date', todayStr)
      .neq('status', 'done')
      .order('due_date', { ascending: true })
      .limit(5)
    tasksDueToday.value = taskData || []

  } catch (e) {
    console.error('Dashboard fetch error:', e)
  } finally {
    loading.value = false
  }
}

// ── Add client (unchanged from original) ─────────────────────────────────────
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
const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'Educational': return 'i-heroicons-academic-cap'
    case 'Fintech':     return 'i-heroicons-banknotes'
    case 'Internal':    return 'i-heroicons-building-office'
    case 'Personal':    return 'i-heroicons-user'
    default:            return 'i-heroicons-code-bracket'
  }
}

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

const isUrgent = (d: string) => {
  const days = Math.ceil((new Date(d + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
  return days <= 2
}

const invoiceStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',   color: 'text-orange-400', dot: 'bg-orange-400' },
  paid:      { label: 'Paid',      color: 'text-green-400',  dot: 'bg-green-400'  },
  overdue:   { label: 'Overdue',   color: 'text-red-400',    dot: 'bg-red-400'    },
  cancelled: { label: 'Cancelled', color: 'text-gray-500',   dot: 'bg-gray-500'   },
}

const effectiveInvoiceStatus = (r: any) =>
  r.status === 'pending' && r.due_date && r.due_date < todayStr ? 'overdue' : r.status

const getInvoiceTotal = (r: any) => {
  if (r.invoice_items?.length)
    return r.invoice_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_rate), 0)
  return Number(r.amount)
}

const priorityColor: Record<string, string> = {
  high:   'text-red-400    bg-red-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  low:    'text-gray-400   bg-gray-400/10',
}

const milestoneStatusDot: Record<string, string> = {
  pending:     'bg-gray-400',
  in_progress: 'bg-blue-400',
  complete:    'bg-green-400',
}

onMounted(() => fetchDashboard())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <p class="text-gray-500 text-sm font-medium">{{ todayLabel }}</p>
        <h1 class="text-3xl font-bold text-white tracking-tight mt-0.5">{{ greeting }} 👋</h1>
      </div>
      <div class="flex items-center gap-3 w-full md:w-auto">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          size="md"
          variant="outline"
          placeholder="Search clients..."
          class="bg-secondary text-white w-full md:w-64"
        />
        <UButton
          @click="showModal = true"
          class="bg-primary hover:bg-primary/80 text-white active:scale-95 shrink-0"
          leading-icon="i-heroicons-plus"
        >
          <span class="hidden md:inline">Add Client</span>
        </UButton>
      </div>
    </div>

    <!-- ── Loading skeleton ─────────────────────────────────────────────────── -->
    <div v-if="loading" class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="h-28 bg-secondary/50 animate-pulse rounded-2xl"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 h-64 bg-secondary/50 animate-pulse rounded-2xl"></div>
        <div class="h-64 bg-secondary/50 animate-pulse rounded-2xl"></div>
      </div>
    </div>

    <template v-else>

      <!-- ── Stat cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

        <!-- Total clients -->
        <NuxtLink to="/clients" class="bg-secondary/50 border border-white/5 p-5 rounded-2xl relative overflow-hidden hover:bg-secondary/80 transition-colors group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UIcon name="i-heroicons-users" class="w-16 h-16 text-primary" />
          </div>
          <p class="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Total Clients</p>
          <p class="text-3xl font-bold text-white">{{ stats.totalClients }}</p>
        </NuxtLink>

        <!-- Active projects -->
        <NuxtLink to="/projects" class="bg-secondary/50 border border-white/5 p-5 rounded-2xl relative overflow-hidden hover:bg-secondary/80 transition-colors group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UIcon name="i-heroicons-folder-open" class="w-16 h-16 text-blue-400" />
          </div>
          <p class="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Active Projects</p>
          <p class="text-3xl font-bold text-white">{{ stats.activeProjects }}</p>
        </NuxtLink>

        <!-- Outstanding -->
        <NuxtLink to="/retainers" class="bg-secondary/50 border border-white/5 p-5 rounded-2xl relative overflow-hidden hover:bg-secondary/80 transition-colors group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UIcon name="i-heroicons-banknotes" class="w-16 h-16 text-orange-400" />
          </div>
          <p class="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Outstanding (NGN)</p>
          <p class="text-2xl font-bold text-orange-400">{{ fmt(stats.outstandingNGN) }}</p>
        </NuxtLink>

        <!-- Overdue invoices -->
        <NuxtLink to="/retainers" class="bg-secondary/50 border border-white/5 p-5 rounded-2xl relative overflow-hidden hover:bg-secondary/80 transition-colors group" :class="stats.overdueCount > 0 ? 'border-red-500/20' : ''">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 text-red-400" />
          </div>
          <p class="text-[10px] uppercase font-bold tracking-widest mb-2" :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-gray-500'">Overdue Invoices</p>
          <p class="text-3xl font-bold" :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-white'">{{ stats.overdueCount }}</p>
        </NuxtLink>

      </div>

      <!-- ── Overdue alert banner ─────────────────────────────────────────────── -->
      <div v-if="overdueInvoices.length > 0" class="mb-6">
        <div class="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <p class="text-red-400 text-xs font-bold uppercase tracking-widest">
              {{ overdueInvoices.length }} overdue invoice{{ overdueInvoices.length !== 1 ? 's' : '' }} — action needed
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NuxtLink
              v-for="inv in overdueInvoices"
              :key="inv.id"
              to="/retainers"
              class="flex items-center justify-between bg-red-500/5 border border-red-500/10 hover:border-red-500/30 rounded-xl px-4 py-3 transition-colors group"
            >
              <div class="min-w-0">
                <p class="text-white font-semibold text-sm truncate">{{ inv.clients?.name }}</p>
                <p class="text-gray-500 text-xs truncate">{{ inv.invoice_number }} · {{ inv.title }}</p>
              </div>
              <div class="text-right shrink-0 ml-3">
                <p class="text-red-400 font-mono font-bold text-sm">{{ fmt(getInvoiceTotal(inv), inv.currency) }}</p>
                <p class="text-red-500 text-[10px] font-medium">{{ daysFromNow(inv.due_date) }}</p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- ── Main grid ───────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        <!-- Left column: Milestones + Tasks -->
        <div class="lg:col-span-2 space-y-6">

          <!-- Upcoming milestones -->
          <div class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 class="text-white font-bold flex items-center gap-2">
                <UIcon name="i-heroicons-flag" class="w-4 h-4 text-primary" />
                Milestones — Next 7 Days
              </h2>
              <NuxtLink to="/calendar" class="text-[10px] text-gray-500 hover:text-primary transition-colors font-bold uppercase tracking-wide">
                View Calendar →
              </NuxtLink>
            </div>

            <!-- Empty -->
            <div v-if="upcomingMilestones.length === 0" class="px-5 py-10 text-center">
              <UIcon name="i-heroicons-check-badge" class="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p class="text-gray-500 text-sm font-medium">No milestones due in the next 7 days</p>
              <p class="text-gray-600 text-xs mt-1">You're clear for the week.</p>
            </div>

            <!-- List -->
            <div v-else class="divide-y divide-white/5">
              <NuxtLink
                v-for="m in upcomingMilestones"
                :key="m.id"
                :to="`/projects/${m.project_id}`"
                class="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
              >
                <!-- Status dot -->
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                  :class="milestoneStatusDot[m.status] || 'bg-gray-400'"
                ></div>

                <!-- Details -->
                <div class="flex-1 min-w-0">
                  <p class="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {{ m.title }}
                  </p>
                  <p class="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5">
                    <UIcon name="i-heroicons-folder-open" class="w-3 h-3" />
                    {{ m.projects?.name }}
                    <span v-if="m.projects?.clients?.name" class="text-gray-600">·</span>
                    <UIcon v-if="m.projects?.clients?.name" name="i-heroicons-building-office-2" class="w-3 h-3" />
                    {{ m.projects?.clients?.name }}
                  </p>
                </div>

                <!-- Due -->
                <div class="shrink-0 text-right">
                  <span
                    class="text-xs font-bold px-2 py-1 rounded-lg"
                    :class="isUrgent(m.due_date)
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-gray-400 bg-white/5'"
                  >
                    {{ daysFromNow(m.due_date) }}
                  </span>
                  <p class="text-[10px] text-gray-600 mt-1">{{ fmtDate(m.due_date) }}</p>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Tasks due today / overdue -->
          <div v-if="tasksDueToday.length > 0" class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 class="text-white font-bold flex items-center gap-2">
                <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-orange-400" />
                Tasks Overdue or Due Today
              </h2>
              <span class="text-xs text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded-full">
                {{ tasksDueToday.length }}
              </span>
            </div>
            <div class="divide-y divide-white/5">
              <NuxtLink
                v-for="t in tasksDueToday"
                :key="t.id"
                :to="`/projects/${t.project_id}`"
                class="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
              >
                <div class="w-4 h-4 rounded border-2 border-gray-600 shrink-0 group-hover:border-primary transition-colors"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {{ t.title }}
                  </p>
                  <p class="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5">
                    <UIcon name="i-heroicons-flag" class="w-3 h-3" />
                    {{ t.milestones?.title }}
                    <span class="text-gray-600">·</span>
                    {{ t.milestones?.projects?.name }}
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                    :class="priorityColor[t.priority] || priorityColor.low"
                  >
                    {{ t.priority }}
                  </span>
                  <span
                    class="text-xs font-bold px-2 py-1 rounded-lg"
                    :class="t.due_date < todayStr
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-orange-400 bg-orange-400/10'"
                  >
                    {{ daysFromNow(t.due_date) }}
                  </span>
                </div>
              </NuxtLink>
            </div>
          </div>

        </div>

        <!-- Right column: Recent invoices -->
        <div class="space-y-6">

          <div class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 class="text-white font-bold flex items-center gap-2">
                <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-primary" />
                Recent Invoices
              </h2>
              <NuxtLink to="/retainers" class="text-[10px] text-gray-500 hover:text-primary transition-colors font-bold uppercase tracking-wide">
                All →
              </NuxtLink>
            </div>

            <div v-if="recentInvoices.length === 0" class="px-5 py-10 text-center">
              <UIcon name="i-heroicons-document-text" class="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p class="text-gray-500 text-sm">No invoices yet</p>
              <NuxtLink to="/retainers" class="text-primary text-xs font-bold mt-2 inline-block hover:text-white transition-colors">
                Create first invoice →
              </NuxtLink>
            </div>

            <div v-else class="divide-y divide-white/5">
              <NuxtLink
                v-for="inv in recentInvoices"
                :key="inv.id"
                to="/retainers"
                class="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
              >
                <!-- Client initial -->
                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {{ inv.clients?.name?.charAt(0) || '?' }}
                </div>

                <!-- Details -->
                <div class="flex-1 min-w-0">
                  <p class="text-white text-xs font-semibold truncate">{{ inv.clients?.name }}</p>
                  <p class="text-gray-500 text-[10px] truncate font-mono">{{ inv.invoice_number }}</p>
                </div>

                <!-- Amount + status -->
                <div class="shrink-0 text-right">
                  <p class="text-white font-mono font-semibold text-xs">
                    {{ fmt(getInvoiceTotal(inv), inv.currency) }}
                  </p>
                  <div class="flex items-center justify-end gap-1 mt-0.5">
                    <div
                      class="w-1.5 h-1.5 rounded-full"
                      :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.dot"
                    ></div>
                    <span
                      class="text-[10px] font-bold"
                      :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.color"
                    >
                      {{ invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.label }}
                    </span>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Quick links -->
          <div class="bg-secondary/40 border border-white/5 rounded-2xl p-4">
            <p class="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-3">Quick Actions</p>
            <div class="space-y-2">
              <NuxtLink
                to="/retainers"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-gray-400 hover:text-white group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  <UIcon name="i-heroicons-document-plus" class="w-3.5 h-3.5" />
                </div>
                <span class="text-sm font-medium">Create Invoice</span>
              </NuxtLink>
              <NuxtLink
                to="/projects"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-gray-400 hover:text-white group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  <UIcon name="i-heroicons-folder-plus" class="w-3.5 h-3.5" />
                </div>
                <span class="text-sm font-medium">New Project</span>
              </NuxtLink>
              <NuxtLink
                to="/calendar"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-gray-400 hover:text-white group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  <UIcon name="i-heroicons-calendar-days" class="w-3.5 h-3.5" />
                </div>
                <span class="text-sm font-medium">View Calendar</span>
              </NuxtLink>
              <button
                @click="showModal = true"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-gray-400 hover:text-white group"
              >
                <div class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  <UIcon name="i-heroicons-user-plus" class="w-3.5 h-3.5" />
                </div>
                <span class="text-sm font-medium">Add Client</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Client grid ─────────────────────────────────────────────────────── -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-white font-bold flex items-center gap-2">
          <UIcon name="i-heroicons-users" class="w-4 h-4 text-gray-400" />
          All Clients
          <span class="text-gray-600 text-sm font-normal">({{ filteredClients.length }})</span>
        </h2>
      </div>

      <!-- Empty clients -->
      <div v-if="filteredClients.length === 0" class="text-center py-20">
        <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 text-gray-600" />
        </div>
        <p class="text-gray-500">{{ searchQuery ? 'No clients match your search' : 'No clients yet' }}</p>
        <button v-if="!searchQuery" @click="showModal = true" class="text-primary hover:text-white text-sm font-bold mt-3 transition-colors">
          + Add your first client
        </button>
      </div>

      <!-- Client grid (kept from original, clean) -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <NuxtLink
          v-for="c in filteredClients"
          :key="c.id"
          :to="`/clients/${c.id}`"
          class="group bg-secondary/40 hover:bg-secondary border border-white/5 hover:border-white/10 transition-all rounded-2xl p-5 cursor-pointer block relative overflow-hidden"
        >
          <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div class="relative z-10 flex items-start justify-between mb-5">
            <div class="w-11 h-11 rounded-xl bg-base flex items-center justify-center text-lg font-bold text-white border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-300">
              {{ c.name.charAt(0).toUpperCase() }}
            </div>

            <span
              class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border tracking-wider flex items-center gap-1.5"
              :class="{
                'bg-blue-500/10    text-blue-400    border-blue-500/20':    c.category === 'Educational',
                'bg-purple-500/10  text-purple-400  border-purple-500/20':  c.category === 'Fintech',
                'bg-orange-500/10  text-orange-400  border-orange-500/20':  c.category === 'Internal',
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': !c.category || c.category === 'Development',
                'bg-pink-500/10    text-pink-400    border-pink-500/20':    c.category === 'Personal',
              }"
            >
              <UIcon :name="getCategoryIcon(c.category)" class="w-3 h-3" />
              {{ c.category || 'Dev' }}
            </span>
          </div>

          <div class="relative z-10">
            <h3 class="text-base font-bold text-white mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
              {{ c.name }}
              <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
            </h3>
            <p class="text-xs text-gray-500 truncate flex items-center gap-1.5">
              <UIcon name="i-heroicons-globe-alt" class="w-3 h-3" />
              {{ c.website || 'No website linked' }}
            </p>
          </div>
        </NuxtLink>
      </div>

    </template>

    <!-- ── Add Client Modal (unchanged from original) ────────────────────────── -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="closeModal" class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"></div>

      <div class="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">

        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="text-xl font-bold text-white">Add New Client</h2>
            <p class="text-xs text-gray-500 mt-1">
              Step {{ currentStep }} of 2:
              <span class="text-primary font-medium">{{ currentStep === 1 ? 'Company Profile' : 'Primary Contact' }}</span>
            </p>
          </div>
          <div class="flex gap-1.5">
            <div :class="currentStep >= 1 ? 'bg-primary w-6' : 'bg-white/10 w-2'" class="h-1.5 rounded-full transition-all duration-300"></div>
            <div :class="currentStep >= 2 ? 'bg-primary w-6' : 'bg-white/10 w-2'" class="h-1.5 rounded-full transition-all duration-300"></div>
          </div>
        </div>

        <form @submit.prevent="createClient" class="min-h-50 flex flex-col justify-between">

          <!-- Step 1 -->
          <div v-if="currentStep === 1" class="space-y-5 animate-in slide-in-from-right-8 fade-in duration-300">
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Client Name <span class="text-red-500">*</span></label>
              <div class="relative">
                <UIcon name="i-heroicons-building-office-2" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input v-model="newClient.name" type="text" autofocus required class="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary placeholder-gray-700 transition-colors" placeholder="e.g. Acme Corp" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Category</label>
                <div class="relative">
                  <select v-model="newClient.category" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer transition-colors">
                    <option v-for="cat in categories" :key="cat" :value="cat" class="bg-secondary text-gray-300">{{ cat }}</option>
                  </select>
                  <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Website</label>
                <input v-model="newClient.website" type="url" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary placeholder-gray-700 transition-colors" placeholder="https://..." />
              </div>
            </div>
          </div>

          <!-- Step 2 -->
          <div v-if="currentStep === 2" class="space-y-5 animate-in slide-in-from-right-8 fade-in duration-300">
            <div class="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-4 flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-base flex items-center justify-center text-lg font-bold text-white border border-white/5">
                {{ newClient.name.charAt(0).toUpperCase() }}
              </div>
              <div>
                <p class="text-white font-bold text-sm">{{ newClient.name }}</p>
                <p class="text-xs text-gray-500">{{ newClient.category }}</p>
              </div>
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Contact Name</label>
              <input v-model="newClient.contact_name" type="text" autofocus placeholder="Jane Doe" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Email</label>
                <input v-model="newClient.contact_email" type="email" placeholder="jane@acme.com" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors" />
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Phone</label>
                <input v-model="newClient.contact_phone" type="tel" placeholder="+234..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors" />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-8 mt-4 border-t border-white/5">
            <button type="button" @click="currentStep === 1 ? closeModal() : currentStep--" class="px-6 py-3 rounded-lg text-gray-400 hover:text-white transition-colors font-medium text-sm">
              {{ currentStep === 1 ? 'Cancel' : 'Back' }}
            </button>
            <button v-if="currentStep === 1" type="button" @click="currentStep++" :disabled="!canProceed" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white px-4 py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
              Next Step
              <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
            </button>
            <button v-else type="submit" :disabled="creating" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white px-4 py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
              <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
              <span v-else>Create Client</span>
            </button>
          </div>

        </form>
      </div>
    </div>

  </div>
</template>