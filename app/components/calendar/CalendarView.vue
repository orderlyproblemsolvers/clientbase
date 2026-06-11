<template>
  <div class="animate-in fade-in duration-300">
    <!-- ===== Month Navigation ===== -->
    <div class="flex items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-2">
        <button
          @click="prevMonth"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-slate-400 hover:text-white transition-all duration-150 border border-white/[0.06] active:scale-95"
          aria-label="Previous month"
        >
          <UIcon name="i-heroicons-chevron-left" class="w-5 h-5" />
        </button>
        <h2 class="text-base font-semibold text-white w-44 text-center tracking-tight">
          {{ monthLabel }}
        </h2>
        <button
          @click="nextMonth"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-slate-400 hover:text-white transition-all duration-150 border border-white/[0.06] active:scale-95"
          aria-label="Next month"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5" />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <!-- Heatmap toggle -->
        <button
          @click="showHeatmap = !showHeatmap"
          class="h-10 px-4 rounded-xl text-xs font-medium tracking-wide transition-all duration-150 active:scale-95 flex items-center gap-2"
          :class="showHeatmap
            ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
            : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06] hover:bg-white/[0.07]'"
          :aria-label="showHeatmap ? 'Hide heatmap' : 'Show heatmap'"
        >
          <UIcon name="i-heroicons-fire" class="w-4 h-4" />
          <span class="hidden sm:inline">Heatmap</span>
        </button>

        <button
          @click="goToToday"
          class="h-10 px-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 hover:text-white border border-white/[0.06] text-xs font-medium tracking-wide transition-all duration-150 active:scale-95"
        >
          Today
        </button>
      </div>
    </div>

    <!-- ===== Legend ===== -->
    <div class="flex items-center gap-x-4 gap-y-2 mb-6 flex-wrap pb-4 border-b border-white/[0.04] overflow-x-auto">
      <!-- Item-type legend -->
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-blue-400"></span> Milestone
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-rose-400"></span> Task (High)
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-amber-400"></span> Task (Med)
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-slate-400"></span> Task (Low)
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Project Start
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-violet-400"></span> Project End
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Invoice Due
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-rose-500"></span> Invoice Overdue
      </div>

      <!-- Separator -->
      <div class="w-px h-4 bg-white/10 hidden sm:block"></div>

      <!-- Heatmap legend -->
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"></span>
        Light (0‑2)
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30"></span>
        Medium (3‑5)
      </div>
      <div class="flex items-center gap-2 text-[11px] text-slate-500 font-medium whitespace-nowrap">
        <span class="w-3 h-3 rounded bg-rose-500/20 border border-rose-500/30"></span>
        Heavy (6+)
      </div>
    </div>

    <!-- ===== Calendar + Sidebar (responsive flex) ===== -->
    <div class="flex flex-col xl:flex-row gap-6 items-start">
      <!-- Calendar Grid (flex-1) -->
      <div class="flex-1 min-w-0 w-full">
        <!-- Loading skeleton -->
        <div v-if="loading" class="grid grid-cols-7 gap-1">
          <div
            v-for="i in 42"
            :key="i"
            class="h-20 sm:h-24 lg:h-28 bg-white/[0.02] border border-white/[0.04] animate-pulse rounded-xl"
          ></div>
        </div>

        <template v-else>
          <!-- Day names -->
          <div class="grid grid-cols-7 mb-2">
            <div
              v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
              :key="day"
              class="py-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500"
            >
              <span class="hidden sm:inline">{{ day }}</span>
              <span class="sm:hidden">{{ day.charAt(0) }}</span>
            </div>
          </div>

          <!-- Calendar Cells -->
          <div class="grid grid-cols-7 gap-1 bg-white/[0.01] p-1 rounded-2xl border border-white/[0.04]">
            <div
              v-for="(day, idx) in calendarDays"
              :key="idx"
              @click="selectDay(day.date)"
              class="relative flex flex-col justify-between rounded-xl p-1.5 sm:p-2 cursor-pointer transition-all duration-150 group select-none border min-h-[70px] sm:min-h-[90px] lg:min-h-[105px]"
              :class="[
                // Heatmap background (takes precedence if enabled)
                showHeatmap ? workloadClass(day.date) : '',
                // Current month vs out-of-month
                day.currentMonth ? '' : 'opacity-50',
                // Selected / today overrides
                isSelected(day.date) ? '!bg-primary/[0.04] ring-1 ring-primary/40 border-primary/30' : '',
                isToday(day.date) ? '!border-primary/50' : '',
                // Border and hover
                !isSelected(day.date) && !isToday(day.date) ? 'border-white/[0.04]' : '',
                day.currentMonth && !isSelected(day.date) ? 'hover:bg-white/[0.05]' : 'hover:opacity-70'
              ]"
            >
              <!-- Date number -->
              <div class="flex justify-between items-start mb-1">
                <span
                  class="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors"
                  :class="[
                    isToday(day.date)
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : day.currentMonth
                        ? 'text-slate-200 group-hover:text-white'
                        : 'text-slate-600',
                  ]"
                >
                  {{ day.date.getDate() }}
                </span>

                <div
                  v-if="(itemsByDate[toKey(day.date)] || []).length > 3"
                  class="w-1.5 h-1.5 rounded-full bg-slate-500 opacity-60 mt-1"
                ></div>
              </div>

              <!-- Event chips (compact) -->
              <div class="space-y-0.5 flex-1 flex flex-col justify-end">
                <template v-for="(item, i) in (itemsByDate[toKey(day.date)] || [])" :key="item.id">
                  <div
                    v-if="i < 3"
                    class="flex items-center gap-1 px-1 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium truncate border transition-all duration-100"
                    :class="chipClass(item)"
                  >
                    <span class="w-1 h-1 rounded-full shrink-0" :class="dotClass(item)"></span>
                    <span class="truncate" :class="{ 'line-through opacity-40': statusDoneClass(item) }">
                      {{ item.title }}
                    </span>
                  </div>
                </template>

                <div
                  v-if="(itemsByDate[toKey(day.date)] || []).length > 3"
                  class="text-[8px] sm:text-[9px] text-slate-500 font-semibold px-1 mt-0.5"
                >
                  +{{ (itemsByDate[toKey(day.date)] || []).length - 3 }} more
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Selected Day Panel (unchanged) -->
      <!-- Selected Day Panel (inline sidebar / below on mobile) -->
      <Transition name="panel">
        <div
          v-if="selectedDay"
          class="w-full xl:w-80 shrink-0 bg-white/[0.03] border border-white/6 rounded-2xl p-5 self-start"
        >
          <!-- Header -->
          <div class="flex items-start justify-between mb-4 pb-3 border-b border-white/5">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Selected Date</p>
              <h3 class="text-white font-semibold text-sm">{{ selectedDayLabel }}</h3>
            </div>
            <button
              @click="selectedDay = null"
              class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all"
              aria-label="Dismiss panel"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Items list -->
          <div
            v-if="selectedDayItems.length === 0"
            class="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2"
          >
            <UIcon name="i-heroicons-calendar" class="w-6 h-6 text-slate-600" />
            <p>No activities on this day.</p>
          </div>

          <div v-else class="space-y-3 max-h-[60vh] xl:max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
            <div
              v-for="item in selectedDayItems"
              :key="item.id"
              class="bg-white/[0.03] border border-white/6 rounded-xl p-4 hover:border-white/10 transition-all duration-150"
            >
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase border"
                  :class="panelChipClass(item)"
                >
                  <UIcon :name="itemIcon(item)" class="w-3 h-3 shrink-0" />
                  {{ typeLabel(item) }}
                </span>
              </div>

              <p
                class="text-sm font-medium mb-2"
                :class="[statusDoneClass(item) ? 'line-through text-slate-500' : 'text-white']"
              >
                {{ item.title }}
              </p>

              <p v-if="item.milestoneTitle" class="text-xs text-slate-500 mb-2 flex items-center gap-1.5 bg-white/[0.02] px-2 py-1 rounded-lg border border-white/[0.02]">
                <UIcon name="i-heroicons-flag" class="w-3 h-3 text-slate-400" />
                <span class="truncate">{{ item.milestoneTitle }}</span>
              </p>

              <div v-if="item.projectName || item.clientName" class="flex items-center gap-x-2 gap-y-1 mt-2 flex-wrap text-xs">
                <NuxtLink
                  v-if="item.projectId"
                  :to="`/projects/${item.projectId}`"
                  class="text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                  @click.stop
                >
                  <UIcon name="i-heroicons-folder-open" class="w-3 h-3 text-slate-500" />
                  <span class="truncate max-w-[120px]">{{ item.projectName }}</span>
                </NuxtLink>
                <span v-if="item.projectName && item.clientName" class="text-slate-600">·</span>
                <NuxtLink
                  v-if="item.clientId"
                  :to="`/clients/${item.clientId}`"
                  class="text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                  @click.stop
                >
                  <UIcon name="i-heroicons-building-office-2" class="w-3 h-3 text-slate-500" />
                  <span class="truncate max-w-[120px]">{{ item.clientName }}</span>
                </NuxtLink>
              </div>

              <div v-if="item.type === 'invoice_due' && item.amount" class="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span class="text-[10px] text-slate-500 flex items-center gap-1">
                  <UIcon name="i-heroicons-paper-clip" class="w-3 h-3" />
                  {{ item.invoiceNumber }}
                </span>
                <span class="font-mono text-xs font-semibold" :class="item.status === 'overdue' ? 'text-rose-400' : 'text-emerald-400'">
                  {{ new Intl.NumberFormat('en-NG', { style: 'currency', currency: item.currency || 'NGN', maximumFractionDigits: 0 }).format(item.amount) }}
                </span>
              </div>

              <div
                v-if="statusDoneClass(item)"
                class="mt-2 flex items-center gap-1 text-[10px] text-emerald-400 font-medium"
              >
                <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5" />
                Completed
              </div>
            </div>
          </div>

          <!-- Footer count -->
          <div class="mt-4 pt-3 border-t border-white/5 text-center text-[10px] text-slate-500 font-medium">
            {{ selectedDayItems.length }} event{{ selectedDayItems.length !== 1 ? 's' : '' }}
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  projectId: { type: String, default: null }
})

const supabase = useSupabaseClient()

const loading = ref(true)
const currentDate = ref(new Date())
const selectedDay = ref(null)
const showHeatmap = ref(true)   // <-- toggle state

const milestones = ref([])
const tasks = ref([])
const projects = ref([])
const invoices = ref([])

// ── Data fetching (unchanged) ─────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    let mQuery = supabase
      .from('milestones')
      .select('id, title, due_date, status, project_id, projects(id, name, clients(id, name))')
      .not('due_date', 'is', null)
    if (props.projectId) mQuery = mQuery.eq('project_id', props.projectId)
    const { data: mData } = await mQuery
    milestones.value = mData || []

    let tQuery = supabase
      .from('tasks')
      .select('id, title, due_date, status, priority, project_id, milestone_id, milestones(id, title, projects(id, name, clients(id, name)))')
      .not('due_date', 'is', null)
    if (props.projectId) tQuery = tQuery.eq('project_id', props.projectId)
    const { data: tData } = await tQuery
    tasks.value = tData || []

    let pQuery = supabase
      .from('projects')
      .select('id, name, start_date, end_date, clients(id, name)')
      .or('start_date.not.is.null,end_date.not.is.null')
    if (props.projectId) pQuery = pQuery.eq('id', props.projectId)
    const { data: pData } = await pQuery
    projects.value = pData || []

    let iQuery = supabase
      .from('retainers')
      .select('id, title, invoice_number, amount, currency, status, due_date, clients(id, name), invoice_items(*)')
      .not('due_date', 'is', null)
      .in('status', ['pending', 'overdue'])
    if (props.projectId) iQuery = iQuery.eq('project_id', props.projectId)
    const { data: iData } = await iQuery
    invoices.value = iData || []

  } catch (e) {
    console.error('Calendar fetch error:', e)
  } finally {
    loading.value = false
  }
}

// ── All items composition (unchanged) ─────────────────────────────────────────
const allItems = computed(() => {
  // ... identical to original ...
  const items = []
  milestones.value.forEach(m => {
    items.push({
      id: `milestone-${m.id}`, date: m.due_date, type: 'milestone', title: m.title, status: m.status,
      projectId: m.projects?.id, projectName: m.projects?.name,
      clientId: m.projects?.clients?.id, clientName: m.projects?.clients?.name
    })
  })
  tasks.value.forEach(t => {
    items.push({
      id: `task-${t.id}`, date: t.due_date, type: 'task', title: t.title, status: t.status, priority: t.priority,
      projectId: t.milestones?.projects?.id, projectName: t.milestones?.projects?.name,
      clientId: t.milestones?.projects?.clients?.id, clientName: t.milestones?.projects?.clients?.name,
      milestoneTitle: t.milestones?.title
    })
  })
  projects.value.forEach(p => {
    if (p.start_date) {
      items.push({
        id: `project-start-${p.id}`, date: p.start_date, type: 'project_start', title: p.name, status: 'active',
        projectId: p.id, projectName: p.name, clientId: p.clients?.id, clientName: p.clients?.name
      })
    }
    if (p.end_date) {
      items.push({
        id: `project-end-${p.id}`, date: p.end_date, type: 'project_end', title: p.name, status: 'active',
        projectId: p.id, projectName: p.name, clientId: p.clients?.id, clientName: p.clients?.name
      })
    }
  })
  invoices.value.forEach(inv => {
    const total = inv.invoice_items?.length
      ? inv.invoice_items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_rate), 0)
      : Number(inv.amount)
    items.push({
      id: `invoice-${inv.id}`, date: inv.due_date, type: 'invoice_due', title: inv.clients?.name || inv.title,
      status: inv.status, clientId: inv.clients?.id, clientName: inv.clients?.name,
      invoiceNumber: inv.invoice_number, amount: total, currency: inv.currency
    })
  })
  return items
})

const itemsByDate = computed(() => {
  const map = {}
  allItems.value.forEach(item => {
    if (!map[item.date]) map[item.date] = []
    map[item.date].push(item)
  })
  return map
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const days = []
  for (let i = startPad - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), currentMonth: false })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), currentMonth: true })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), currentMonth: false })
  }
  return days
})

const toKey = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const isToday = (d) => toKey(d) === toKey(new Date())
const isSelected = (d) => toKey(d) === selectedDay.value

const monthLabel = computed(() =>
  currentDate.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const prevMonth = () => { const d = new Date(currentDate.value); d.setMonth(d.getMonth() - 1); currentDate.value = d }
const nextMonth = () => { const d = new Date(currentDate.value); d.setMonth(d.getMonth() + 1); currentDate.value = d }
const goToToday = () => { currentDate.value = new Date(); selectedDay.value = toKey(new Date()) }
const selectDay = (date) => { const key = toKey(date); selectedDay.value = selectedDay.value === key ? null : key }

const selectedDayItems = computed(() =>
  selectedDay.value ? (itemsByDate.value[selectedDay.value] ?? []) : []
)

const selectedDayLabel = computed(() => {
  if (!selectedDay.value) return ''
  return new Date(selectedDay.value + 'T00:00:00')
    .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
})

// ── Workload heatmap function ─────────────────────────────────────────────────
const workloadClass = (date) => {
  const key = toKey(date)
  const count = (itemsByDate.value[key] || []).length
  if (count === 0) return ''
  if (count <= 2) return '!bg-emerald-500/10 !border-emerald-500/20'
  if (count <= 5) return '!bg-amber-500/10 !border-amber-500/20'
  return '!bg-rose-500/10 !border-rose-500/20'
}

// ── Chip / dot / panel helpers (unchanged) ───────────────────────────────────
const dotClass = (item) => { /* ... same as before ... */
  if (item.type === 'milestone') return 'bg-blue-400'
  if (item.type === 'project_start') return 'bg-emerald-400'
  if (item.type === 'project_end') return 'bg-violet-400'
  if (item.type === 'task') {
    if (item.priority === 'high') return 'bg-rose-400'
    if (item.priority === 'medium') return 'bg-amber-400'
    return 'bg-slate-400'
  }
  if (item.type === 'invoice_due') {
    return item.status === 'overdue' ? 'bg-rose-400' : 'bg-emerald-400'
  }
  return 'bg-slate-500'
}

const chipClass = (item) => {
  if (item.type === 'milestone') return 'bg-blue-500/5 text-blue-400 border-blue-500/10'
  if (item.type === 'project_start') return 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
  if (item.type === 'project_end') return 'bg-violet-500/5 text-violet-400 border-violet-500/10'
  if (item.type === 'task') {
    if (item.priority === 'high') return 'bg-rose-500/5 text-rose-400 border-rose-500/15'
    if (item.priority === 'medium') return 'bg-amber-500/5 text-amber-400 border-amber-500/15'
    return 'bg-slate-500/5 text-slate-400 border-slate-500/10'
  }
  if (item.type === 'invoice_due') {
    return item.status === 'overdue'
      ? 'bg-rose-500/5 text-rose-400 border-rose-500/15'
      : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/15'
  }
  return 'bg-slate-500/5 text-slate-400 border-slate-500/10'
}

const panelChipClass = (item) => {
  if (item.type === 'milestone') return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  if (item.type === 'project_start') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (item.type === 'project_end') return 'text-violet-400 bg-violet-500/10 border-violet-500/20'
  if (item.type === 'task') {
    if (item.priority === 'high') return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    if (item.priority === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  }
  if (item.type === 'invoice_due') {
    return item.status === 'overdue'
      ? 'text-rose-400 bg-rose-400/10 border-rose-400/20'
      : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
  }
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
}

const itemIcon = (item) => {
  if (item.type === 'milestone') return 'i-heroicons-flag'
  if (item.type === 'project_start') return 'i-heroicons-play-circle'
  if (item.type === 'project_end') return 'i-heroicons-stop-circle'
  if (item.type === 'invoice_due') return 'i-heroicons-banknotes'
  return 'i-heroicons-check-circle'
}

const typeLabel = (item) => {
  if (item.type === 'milestone') return 'Milestone'
  if (item.type === 'project_start') return 'Project Start'
  if (item.type === 'project_end') return 'Project End'
  if (item.type === 'task') {
    const p = item.priority || 'low'
    return `Task · ${p.charAt(0).toUpperCase() + p.slice(1)} Priority`
  }
  if (item.type === 'invoice_due') return item.status === 'overdue' ? 'Invoice — Overdue' : 'Invoice Due'
  return ''
}

const statusDoneClass = (item) =>
  item.status === 'done' || item.status === 'complete' || item.status === 'paid'

onMounted(() => fetchData())
</script>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}
</style>