<script setup lang="ts">
const props = defineProps<{
  projectId?: string   // if provided, filters to this project only
}>()

const supabase = useSupabaseClient()

// ── State ─────────────────────────────────────────────────────────────────────
const loading      = ref(true)
const currentDate  = ref(new Date())
const selectedDay  = ref<string | null>(null)

// Raw data
const milestones = ref<any[]>([])
const tasks      = ref<any[]>([])
const projects   = ref<any[]>([])
const invoices   = ref<any[]>([])

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    // Milestones with due dates
    let mQuery = supabase
      .from('milestones')
      .select('id, title, due_date, status, project_id, projects(id, name, clients(id, name))')
      .not('due_date', 'is', null)
    if (props.projectId) mQuery = mQuery.eq('project_id', props.projectId)
    const { data: mData } = await mQuery
    milestones.value = mData || []

    // Tasks with due dates
    let tQuery = supabase
      .from('tasks')
      .select('id, title, due_date, status, priority, project_id, milestone_id, milestones(id, title, projects(id, name, clients(id, name)))')
      .not('due_date', 'is', null)
    if (props.projectId) tQuery = tQuery.eq('project_id', props.projectId)
    const { data: tData } = await tQuery
    tasks.value = tData || []

    // Projects with start or end dates
    let pQuery = supabase
      .from('projects')
      .select('id, name, start_date, end_date, clients(id, name)')
      .or('start_date.not.is.null,end_date.not.is.null')
    if (props.projectId) pQuery = pQuery.eq('id', props.projectId)
    const { data: pData } = await pQuery
    projects.value = pData || []

    // Invoices with due dates
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

// ── Normalised calendar items ─────────────────────────────────────────────────
interface CalendarItem {
  id:             string
  date:           string        // YYYY-MM-DD
  type:           'milestone' | 'task' | 'project_start' | 'project_end' | 'invoice_due'
  title:          string
  status:         string
  priority?:      string
  projectId?:     string
  projectName?:   string
  clientId?:      string
  clientName?:    string
  milestoneTitle?: string
  invoiceNumber?: string
  amount?:        number
  currency?:      string
}

const allItems = computed((): CalendarItem[] => {
  const items: CalendarItem[] = []

  // Milestones
  milestones.value.forEach(m => {
    items.push({
      id:          `milestone-${m.id}`,
      date:        m.due_date,
      type:        'milestone',
      title:       m.title,
      status:      m.status,
      projectId:   m.projects?.id,
      projectName: m.projects?.name,
      clientId:    m.projects?.clients?.id,
      clientName:  m.projects?.clients?.name,
    })
  })

  // Tasks
  tasks.value.forEach(t => {
    items.push({
      id:             `task-${t.id}`,
      date:           t.due_date,
      type:           'task',
      title:          t.title,
      status:         t.status,
      priority:       t.priority,
      projectId:      t.milestones?.projects?.id,
      projectName:    t.milestones?.projects?.name,
      clientId:       t.milestones?.projects?.clients?.id,
      clientName:     t.milestones?.projects?.clients?.name,
      milestoneTitle: t.milestones?.title,
    })
  })

  // Project start dates
  projects.value.forEach(p => {
    if (p.start_date) {
      items.push({
        id:          `project-start-${p.id}`,
        date:        p.start_date,
        type:        'project_start',
        title:       p.name,
        status:      'active',
        projectId:   p.id,
        projectName: p.name,
        clientId:    p.clients?.id,
        clientName:  p.clients?.name,
      })
    }
    if (p.end_date) {
      items.push({
        id:          `project-end-${p.id}`,
        date:        p.end_date,
        type:        'project_end',
        title:       p.name,
        status:      'active',
        projectId:   p.id,
        projectName: p.name,
        clientId:    p.clients?.id,
        clientName:  p.clients?.name,
      })
    }
  })

  // Invoice due dates
invoices.value.forEach(inv => {
  const total = inv.invoice_items?.length
    ? inv.invoice_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_rate), 0)
    : Number(inv.amount)

  items.push({
    id:            `invoice-${inv.id}`,
    date:          inv.due_date,
    type:          'invoice_due',
    title:         inv.clients?.name || inv.title,
    status:        inv.status,
    clientId:      inv.clients?.id,
    clientName:    inv.clients?.name,
    invoiceNumber: inv.invoice_number,
    amount:        total,
    currency:      inv.currency,
  })
})

  return items
})

// Group items by date key
const itemsByDate = computed(() => {
  const map: Record<string, CalendarItem[]> = {}
  allItems.value.forEach(item => {
    if (!map[item.date]) map[item.date] = []
    map[item.date].push(item)
  })
  return map
})

// ── Calendar grid ─────────────────────────────────────────────────────────────
const calendarDays = computed(() => {
  const year       = currentDate.value.getFullYear()
  const month      = currentDate.value.getMonth()
  const firstDay   = new Date(year, month, 1)
  const lastDay    = new Date(year, month + 1, 0)
  const startPad   = firstDay.getDay()         // 0 = Sunday
  const days: { date: Date; currentMonth: boolean }[] = []

  // Pad from previous month
  for (let i = startPad - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), currentMonth: false })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), currentMonth: true })
  }

  // Pad to fill 42 cells (6 rows)
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), currentMonth: false })
  }

  return days
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const toKey = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const isToday    = (d: Date) => toKey(d) === toKey(new Date())
const isSelected = (d: Date) => toKey(d) === selectedDay.value

const monthLabel = computed(() =>
  currentDate.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const prevMonth = () => {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() - 1)
  currentDate.value = d
}

const nextMonth = () => {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() + 1)
  currentDate.value = d
}

const goToToday = () => {
  currentDate.value = new Date()
  selectedDay.value = toKey(new Date())
}

const selectDay = (date: Date) => {
  const key = toKey(date)
  selectedDay.value = selectedDay.value === key ? null : key
}

// ── Selected day panel ─────────────────────────────────────────────────────────
const selectedDayItems = computed(() =>
  selectedDay.value ? (itemsByDate.value[selectedDay.value] ?? []) : []
)

const selectedDayLabel = computed(() => {
  if (!selectedDay.value) return ''
  // Append T00:00:00 to avoid UTC date shifting
  return new Date(selectedDay.value + 'T00:00:00')
    .toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
})

// ── Visual config ─────────────────────────────────────────────────────────────
const dotClass = (item: CalendarItem): string => {
  if (item.type === 'milestone')     return 'bg-primary'
  if (item.type === 'project_start') return 'bg-green-400'
  if (item.type === 'project_end')   return 'bg-orange-400'
  if (item.type === 'task') {
    if (item.priority === 'high')    return 'bg-red-400'
    if (item.priority === 'medium')  return 'bg-yellow-400'
    return 'bg-gray-400'
  }
  if (item.type === 'invoice_due') {
  return item.status === 'overdue' ? 'bg-red-500' : 'bg-emerald-400'
}
  return 'bg-gray-500'
}

const chipClass = (item: CalendarItem): string => {
  if (item.type === 'milestone')     return 'bg-primary/15       text-primary     border border-primary/30'
  if (item.type === 'project_start') return 'bg-green-400/15    text-green-400   border border-green-400/30'
  if (item.type === 'project_end')   return 'bg-orange-400/15   text-orange-400  border border-orange-400/30'
  if (item.type === 'task') {
    if (item.priority === 'high')    return 'bg-red-400/15      text-red-400     border border-red-400/30'
    if (item.priority === 'medium')  return 'bg-yellow-400/15   text-yellow-400  border border-yellow-400/30'
    return                                  'bg-gray-400/15     text-gray-400    border border-gray-400/30'
  }
  if (item.type === 'invoice_due') {
  return item.status === 'overdue'
    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
    : 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
}
  return 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
}

const panelChipClass = (item: CalendarItem): string => {
  if (item.type === 'milestone')     return 'text-primary     bg-primary/10     border-primary/20'
  if (item.type === 'project_start') return 'text-green-400   bg-green-400/10   border-green-400/20'
  if (item.type === 'project_end')   return 'text-orange-400  bg-orange-400/10  border-orange-400/20'
  if (item.type === 'task') {
    if (item.priority === 'high')    return 'text-red-400     bg-red-400/10     border-red-400/20'
    if (item.priority === 'medium')  return 'text-yellow-400  bg-yellow-400/10  border-yellow-400/20'
    return                                  'text-gray-400    bg-gray-400/10    border-gray-400/20'
  }
  if (item.type === 'invoice_due') {
  return item.status === 'overdue'
    ? 'text-red-400 bg-red-400/10 border-red-400/20'
    : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
}
  return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
}

const itemIcon = (item: CalendarItem): string => {
  if (item.type === 'milestone')     return 'i-heroicons-flag'
  if (item.type === 'project_start') return 'i-heroicons-play-circle'
  if (item.type === 'project_end')   return 'i-heroicons-stop-circle'
  if (item.type === 'invoice_due') return 'i-heroicons-banknotes'
  return 'i-heroicons-check-circle'
}

const typeLabel = (item: CalendarItem): string => {
  if (item.type === 'milestone')     return 'Milestone'
  if (item.type === 'project_start') return 'Project Start'
  if (item.type === 'project_end')   return 'Project End'
  if (item.type === 'task') {
    const p = item.priority ?? 'low'
    return `Task · ${p.charAt(0).toUpperCase() + p.slice(1)} priority`
  }
  if (item.type === 'invoice_due') return item.status === 'overdue' ? 'Invoice — Overdue' : 'Invoice Due'
  return ''
}

const statusDoneClass = (item: CalendarItem) =>
  item.status === 'done' || item.status === 'complete' || item.status === 'paid'

onMounted(() => fetchData())
</script>

<template>
  <div class="animate-in fade-in duration-300">

    <!-- ── Calendar header ───────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button
          @click="prevMonth"
          class="p-2 rounded-lg bg-secondary/60 hover:bg-secondary text-gray-400 hover:text-white transition-colors border border-white/5"
        >
          <UIcon name="i-heroicons-chevron-left" class="w-4 h-4" />
        </button>
        <h2 class="text-lg font-bold text-white w-48 text-center">{{ monthLabel }}</h2>
        <button
          @click="nextMonth"
          class="p-2 rounded-lg bg-secondary/60 hover:bg-secondary text-gray-400 hover:text-white transition-colors border border-white/5"
        >
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4" />
        </button>
      </div>
      <button
        @click="goToToday"
        class="px-4 py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-gray-400 hover:text-white border border-white/5 text-xs font-bold uppercase tracking-wide transition-colors"
      >
        Today
      </button>
    </div>

    <!-- ── Legend ────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-4 mb-4 flex-wrap">
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
        <span class="w-2 h-2 rounded-full bg-primary"></span> Milestone
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
        <span class="w-2 h-2 rounded-full bg-red-400"></span> Task (High)
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
        <span class="w-2 h-2 rounded-full bg-yellow-400"></span> Task (Med)
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
        <span class="w-2 h-2 rounded-full bg-gray-400"></span> Task (Low)
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
        <span class="w-2 h-2 rounded-full bg-green-400"></span> Project Start
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
        <span class="w-2 h-2 rounded-full bg-orange-400"></span> Project End
      </div>
      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
  <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Invoice Due
</div>
<div class="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wide">
  <span class="w-2 h-2 rounded-full bg-red-500"></span> Invoice Overdue
</div>
    </div>

    <div class="flex flex-col xl:flex-row gap-6">

      <!-- ── Calendar grid ──────────────────────────────────────────────── -->
      <div class="flex-1 min-w-0">

        <!-- Loading -->
        <div v-if="loading" class="grid grid-cols-7 gap-1">
          <div
            v-for="i in 42" :key="i"
            class="h-24 bg-secondary/50 animate-pulse rounded-lg"
          ></div>
        </div>

        <template v-else>
          <!-- Weekday headers -->
          <div class="grid grid-cols-7 mb-1">
            <div
              v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
              :key="day"
              class="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-600"
            >
              {{ day }}
            </div>
          </div>

          <!-- Day cells -->
          <div class="grid grid-cols-7 gap-1">
            <div
              v-for="(day, idx) in calendarDays"
              :key="idx"
              @click="selectDay(day.date)"
              class="min-h-[96px] rounded-xl p-1.5 cursor-pointer transition-all relative group"
              :class="[
                day.currentMonth ? 'bg-secondary/30 hover:bg-secondary/60' : 'bg-secondary/10 hover:bg-secondary/30',
                isSelected(day.date) ? 'ring-2 ring-primary ring-offset-1 ring-offset-base bg-secondary/60' : '',
                isToday(day.date) ? 'border border-primary/40' : 'border border-transparent',
              ]"
            >
              <!-- Day number -->
              <div
                class="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1 transition-colors"
                :class="[
                  isToday(day.date)
                    ? 'bg-primary text-white'
                    : day.currentMonth
                      ? 'text-gray-300'
                      : 'text-gray-700',
                ]"
              >
                {{ day.date.getDate() }}
              </div>

              <!-- Item chips (max 3) -->
              <div class="space-y-0.5">
                <template v-for="(item, i) in (itemsByDate[toKey(day.date)] || [])" :key="item.id">
                  <div
                    v-if="i < 3"
                    class="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium truncate"
                    :class="chipClass(item)"
                  >
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="dotClass(item)"></span>
                    <span class="truncate" :class="{ 'line-through opacity-50': statusDoneClass(item) }">
                      {{ item.title }}
                    </span>
                  </div>
                </template>

                <!-- +N more indicator -->
                <div
                  v-if="(itemsByDate[toKey(day.date)] || []).length > 3"
                  class="text-[9px] text-gray-500 font-bold px-1"
                >
                  +{{ (itemsByDate[toKey(day.date)] || []).length - 3 }} more
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Day detail panel ───────────────────────────────────────────── -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-x-4"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-4"
      >
        <div
          v-if="selectedDay"
          class="w-full xl:w-80 shrink-0 bg-secondary/40 border border-white/5 rounded-2xl p-5 self-start sticky top-4"
        >
          <!-- Panel header -->
          <div class="flex items-start justify-between mb-4">
            <div>
              <p class="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1">Selected</p>
              <h3 class="text-white font-bold text-sm leading-snug">{{ selectedDayLabel }}</h3>
            </div>
            <button
              @click="selectedDay = null"
              class="text-gray-600 hover:text-white transition-colors p-1"
            >
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </div>

          <!-- No items -->
          <div
            v-if="selectedDayItems.length === 0"
            class="py-8 text-center text-gray-600 text-sm italic"
          >
            Nothing scheduled for this day.
          </div>

          <!-- Item cards -->
          <div v-else class="space-y-3">
            <div
              v-for="item in selectedDayItems"
              :key="item.id"
              class="bg-base/60 border border-white/5 rounded-xl p-3 hover:border-white/10 transition-colors"
            >
              <!-- Type + priority badge -->
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border"
                  :class="panelChipClass(item)"
                >
                  <UIcon :name="itemIcon(item)" class="w-3 h-3" />
                  {{ typeLabel(item) }}
                </span>
              </div>

              <!-- Title -->
              <p
                class="text-sm font-semibold mb-1 leading-snug"
                :class="[
                  statusDoneClass(item) ? 'line-through text-gray-600' : 'text-white',
                ]"
              >
                {{ item.title }}
              </p>

              <!-- Milestone (for tasks) -->
              <p v-if="item.milestoneTitle" class="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                <UIcon name="i-heroicons-flag" class="w-3 h-3" />
                {{ item.milestoneTitle }}
              </p>

              <!-- Project + Client -->
              <div v-if="item.projectName || item.clientName" class="flex items-center gap-1.5 mt-2 flex-wrap">
                <NuxtLink
                  v-if="item.projectId"
                  :to="`/projects/${item.projectId}`"
                  class="text-[10px] text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
                  @click.stop
                >
                  <UIcon name="i-heroicons-folder-open" class="w-3 h-3" />
                  {{ item.projectName }}
                </NuxtLink>
                <span v-if="item.projectName && item.clientName" class="text-gray-700 text-[10px]">·</span>
                <NuxtLink
                  v-if="item.clientId"
                  :to="`/clients/${item.clientId}`"
                  class="text-[10px] text-gray-500 hover:text-primary transition-colors flex items-center gap-1"
                  @click.stop
                >
                  <UIcon name="i-heroicons-building-office-2" class="w-3 h-3" />
                  {{ item.clientName }}
                </NuxtLink>
              </div>

              <!-- Invoice amount -->
<div v-if="item.type === 'invoice_due' && item.amount" class="mt-2 flex items-center justify-between">
  <span class="text-[10px] text-gray-500 flex items-center gap-1">
    <UIcon name="i-heroicons-banknotes" class="w-3 h-3" />
    {{ item.invoiceNumber }}
  </span>
  <span class="font-mono font-bold text-xs" :class="item.status === 'overdue' ? 'text-red-400' : 'text-emerald-400'">
    {{ new Intl.NumberFormat('en-NG', { style: 'currency', currency: item.currency || 'NGN', maximumFractionDigits: 0 }).format(item.amount) }}
  </span>
</div>

              <!-- Done state -->
              <div
                v-if="statusDoneClass(item)"
                class="mt-2 flex items-center gap-1 text-[10px] text-green-400 font-medium"
              >
                <UIcon name="i-heroicons-check-circle" class="w-3 h-3" />
                Completed
              </div>
            </div>
          </div>

          <!-- Item count -->
          <p class="text-[10px] text-gray-600 font-medium mt-4 text-center">
            {{ selectedDayItems.length }} item{{ selectedDayItems.length !== 1 ? 's' : '' }} on this day
          </p>
        </div>
      </Transition>

    </div>
  </div>
</template>