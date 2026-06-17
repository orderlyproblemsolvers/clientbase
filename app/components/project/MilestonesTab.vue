<script setup lang="ts">
const props = defineProps<{ projectId: string }>()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// ── Toast ────────────────────────────────────────────────────────────────────
const toast = ref({ show: false, message: '', type: 'success' })
let toastTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  toast.value = { show: true, message: msg, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, 3500)
}

// ── State ─────────────────────────────────────────────────────────────────────
const loading = ref(true)
const fetchError = ref('')
const milestones = ref<any[]>([])
const expanded = ref<Set<string>>(new Set())

const showAddMilestone = ref(false)
const savingMilestone = ref(false)
const newMilestone = ref({ title: '', description: '', due_date: '', status: 'pending' })

const newTaskTitle = ref<Record<string, string>>({})
const addingTask = ref<Record<string, boolean>>({})

const editingMilestone = ref<any>(null)
const savingEdit = ref(false)

const confirmDeleteMilestoneId = ref<string | null>(null)
const confirmDeleteTaskId = ref<string | null>(null)
const confirmDeleteTaskMilestoneId = ref<string | null>(null)
const deletingMilestone = ref(false)
const deletingTask = ref(false)

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchMilestones = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*, tasks(*)')
      .eq('project_id', props.projectId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    milestones.value = (data || []).map(m => ({
      ...m,
      tasks: (m.tasks || []).sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    }))
  } catch (e: any) {
    fetchError.value = e.message || 'Could not load milestones.'
  } finally {
    loading.value = false
  }
}

const getUserId = async (): Promise<string> => {
  let id = user.value?.id
  if (!id) {
    const { data } = await supabase.auth.getSession()
    id = data.session?.user?.id
  }
  if (!id) throw new Error('Not authenticated')
  return id
}

// ── Milestone CRUD ────────────────────────────────────────────────────────────
const createMilestone = async () => {
  if (!newMilestone.value.title.trim()) return
  savingMilestone.value = true
  try {
    const userId = await getUserId()
    const position = milestones.value.length
    const { error } = await supabase.from('milestones').insert({
      project_id: props.projectId,
      user_id: userId,
      title: newMilestone.value.title.trim(),
      description: newMilestone.value.description || null,
      due_date: newMilestone.value.due_date || null,
      status: newMilestone.value.status,
      position,
    })
    if (error) throw error
    showAddMilestone.value = false
    newMilestone.value = { title: '', description: '', due_date: '', status: 'pending' }
    showToast('Milestone created!')
    await fetchMilestones()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    savingMilestone.value = false
  }
}

const openEditMilestone = (m: any) => {
  editingMilestone.value = {
    id: m.id,
    title: m.title,
    description: m.description || '',
    due_date: m.due_date || '',
    status: m.status,
  }
}

const saveEditMilestone = async () => {
  if (!editingMilestone.value) return
  savingEdit.value = true
  try {
    const { error } = await supabase
      .from('milestones')
      .update({
        title: editingMilestone.value.title,
        description: editingMilestone.value.description || null,
        due_date: editingMilestone.value.due_date || null,
        status: editingMilestone.value.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingMilestone.value.id)
    if (error) throw error
    editingMilestone.value = null
    showToast('Milestone updated!')
    await fetchMilestones()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    savingEdit.value = false
  }
}

const requestDeleteMilestone = (id: string) => {
  confirmDeleteMilestoneId.value = id
}
const confirmDeleteMilestone = async () => {
  if (!confirmDeleteMilestoneId.value) return
  deletingMilestone.value = true
  try {
    const { error } = await supabase.from('milestones').delete().eq('id', confirmDeleteMilestoneId.value)
    if (error) throw error
    showToast('Milestone deleted')
    confirmDeleteMilestoneId.value = null
    await fetchMilestones()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    deletingMilestone.value = false
  }
}

// ── Task CRUD ─────────────────────────────────────────────────────────────────
const addTask = async (milestoneId: string) => {
  const title = (newTaskTitle.value[milestoneId] || '').trim()
  if (!title) return
  addingTask.value[milestoneId] = true
  try {
    const userId = await getUserId()
    const { error } = await supabase.from('tasks').insert({
      milestone_id: milestoneId,
      project_id: props.projectId,
      user_id: userId,
      title,
    })
    if (error) throw error
    newTaskTitle.value[milestoneId] = ''
    showToast('Task added')
    await fetchMilestones()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    addingTask.value[milestoneId] = false
  }
}

const toggleTask = async (task: any) => {
  const next = task.status === 'done' ? 'todo' : 'done'
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) throw error
    task.status = next
    const milestone = milestones.value.find(m => m.id === task.milestone_id)
    if (milestone) {
      const total = milestone.tasks.length
      const done = milestone.tasks.filter((t: any) => t.status === 'done').length
      const newStatus = done === 0 ? 'pending' : done < total ? 'in_progress' : 'complete'
      if (newStatus !== milestone.status) {
        await supabase
          .from('milestones')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', milestone.id)
        milestone.status = newStatus
      }
    }
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const cycleTaskPriority = async (task: any) => {
  const next = task.priority === 'low' ? 'medium' : task.priority === 'medium' ? 'high' : 'low'
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ priority: next, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) throw error
    task.priority = next
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const requestDeleteTask = (taskId: string, milestoneId: string) => {
  confirmDeleteTaskId.value = taskId
  confirmDeleteTaskMilestoneId.value = milestoneId
}
const confirmDeleteTask = async () => {
  if (!confirmDeleteTaskId.value || !confirmDeleteTaskMilestoneId.value) return
  deletingTask.value = true
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', confirmDeleteTaskId.value)
    if (error) throw error
    const m = milestones.value.find(m => m.id === confirmDeleteTaskMilestoneId.value)
    if (m) m.tasks = m.tasks.filter((t: any) => t.id !== confirmDeleteTaskId.value)
    showToast('Task deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    confirmDeleteTaskId.value = null
    confirmDeleteTaskMilestoneId.value = null
    deletingTask.value = false
  }
}

const toggleExpand = (id: string) => {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

const taskProgress = (m: any) => {
  if (!m.tasks?.length) return { done: 0, total: 0, pct: 0 }
  const done = m.tasks.filter((t: any) => t.status === 'done').length
  const total = m.tasks.length
  return { done, total, pct: Math.round((done / total) * 100) }
}

const milestoneStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: 'Pending', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', dot: 'bg-blue-400' },
  complete: { label: 'Complete', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-slate-400 bg-slate-400/10' },
  medium: { label: 'Med', color: 'text-amber-400 bg-amber-400/10' },
  high: { label: 'High', color: 'text-rose-400 bg-rose-400/10' },
}

const overallProgress = computed(() => {
  const allTasks = milestones.value.flatMap(m => m.tasks || [])
  if (!allTasks.length) return null
  const done = allTasks.filter((t: any) => t.status === 'done').length
  return { done, total: allTasks.length, pct: Math.round((done / allTasks.length) * 100) }
})

onMounted(() => fetchMilestones())
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-white font-bold">Milestones</h3>
        <div v-if="overallProgress" class="flex items-center gap-3 mt-1">
          <div class="w-40 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-500"
              :style="{ width: overallProgress.pct + '%' }"
            />
          </div>
          <span class="text-xs text-slate-500 font-medium">
            {{ overallProgress.done }}/{{ overallProgress.total }} tasks done
          </span>
        </div>
      </div>
      <button
        @click="showAddMilestone = true"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        Add Milestone
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-white/[0.03] border border-white/6 animate-pulse rounded-2xl" />
    </div>

    <!-- Error state -->
    <div v-else-if="fetchError" class="text-center py-12">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-10 h-10 text-red-400 mx-auto mb-4" />
      <p class="text-white font-medium mb-2">Failed to load milestones</p>
      <p class="text-slate-400 text-sm mb-4">{{ fetchError }}</p>
      <button
        @click="fetchMilestones"
        class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="milestones.length === 0" class="border-2 border-dashed border-white/6 rounded-2xl p-12 text-center">
      <div class="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
        <UIcon name="i-heroicons-flag" class="w-7 h-7 text-slate-600" />
      </div>
      <p class="text-slate-500 font-medium mb-1">No milestones yet</p>
      <p class="text-slate-600 text-sm mb-4">Break the project into checkpoints. Each milestone can hold multiple tasks.</p>
      <button
        @click="showAddMilestone = true"
        class="text-primary hover:text-white text-sm font-bold transition-colors"
      >
        + Add first milestone
      </button>
    </div>

    <!-- Milestone list -->
    <div v-else class="space-y-3">
      <TransitionGroup name="list">
        <div
          v-for="m in milestones"
          :key="m.id"
          class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden transition-all"
          :class="expanded.has(m.id) ? 'border-white/10' : ''"
        >
          <!-- Milestone header -->
          <div
            class="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
            @click="toggleExpand(m.id)"
          >
            <div
              class="w-3 h-3 rounded-full shrink-0"
              :class="milestoneStatusConfig[m.status]?.dot || 'bg-slate-400'"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="text-white font-semibold text-sm">{{ m.title }}</span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border"
                  :class="milestoneStatusConfig[m.status]?.color"
                >
                  {{ milestoneStatusConfig[m.status]?.label }}
                </span>
                <span v-if="m.due_date" class="text-[10px] text-slate-500 flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                  {{ new Date(m.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                </span>
              </div>
              <div v-if="m.tasks?.length" class="flex items-center gap-2 mt-2">
                <div class="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="taskProgress(m).pct === 100 ? 'bg-emerald-400' : 'bg-primary'"
                    :style="{ width: taskProgress(m).pct + '%' }"
                  />
                </div>
                <span class="text-[10px] text-slate-500">
                  {{ taskProgress(m).done }}/{{ taskProgress(m).total }}
                </span>
              </div>
              <p v-else class="text-[10px] text-slate-600 mt-1">No tasks yet</p>
            </div>
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <button
                @click="openEditMilestone(m)"
                class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
                title="Edit milestone"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              </button>
              <button
                @click="requestDeleteMilestone(m.id)"
                class="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete milestone"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
              <UIcon
                name="i-heroicons-chevron-down"
                class="w-4 h-4 text-slate-600 ml-1 transition-transform duration-200"
                :class="expanded.has(m.id) ? 'rotate-180' : ''"
              />
            </div>
          </div>

          <!-- Task list (expanded) -->
          <div v-if="expanded.has(m.id)" class="border-t border-white/6">
            <div v-if="m.tasks?.length" class="divide-y divide-white/5">
              <div
                v-for="t in m.tasks"
                :key="t.id"
                class="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group"
              >
                <button
                  @click="toggleTask(t)"
                  class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                  :class="t.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-primary'"
                >
                  <UIcon v-if="t.status === 'done'" name="i-heroicons-check" class="w-3 h-3 text-white" />
                </button>
                <span
                  class="flex-1 text-sm transition-colors"
                  :class="t.status === 'done' ? 'line-through text-slate-600' : 'text-slate-300'"
                >
                  {{ t.title }}
                </span>
                <button
                  @click="cycleTaskPriority(t)"
                  class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all opacity-60 hover:opacity-100"
                  :class="priorityConfig[t.priority]?.color"
                  :title="`Priority: ${t.priority}`"
                >
                  {{ priorityConfig[t.priority]?.label }}
                </button>
                <button
                  @click="requestDeleteTask(t.id, m.id)"
                  class="p-1 rounded text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <!-- Add task input -->
            <div class="px-4 py-3 flex items-center gap-3">
              <div class="w-5 h-5 rounded border-2 border-white/10 shrink-0" />
              <input
                v-model="newTaskTitle[m.id]"
                type="text"
                placeholder="Add a task..."
                class="flex-1 bg-transparent text-sm text-slate-400 placeholder-slate-600 focus:outline-none focus:text-white transition-colors"
                @keydown.enter="addTask(m.id)"
                @keydown.escape="newTaskTitle[m.id] = ''"
              />
              <button
                v-if="newTaskTitle[m.id]?.trim()"
                @click="addTask(m.id)"
                :disabled="addingTask[m.id]"
                class="text-[10px] font-bold text-primary hover:text-white transition-colors uppercase tracking-wide disabled:opacity-50"
              >
                {{ addingTask[m.id] ? 'Adding...' : 'Add ↵' }}
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Modals (Add, Edit, Confirmations) remain exactly the same -->
    <ModalBase :open="showAddMilestone" title="New Milestone" subtitle="Define a project checkpoint" @close="showAddMilestone = false">
      <form @submit.prevent="createMilestone" class="space-y-5">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Title <span class="text-red-400">*</span></label>
          <input v-model="newMilestone.title" type="text" required autofocus placeholder="e.g. Design complete, API integrated" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Description</label>
          <textarea v-model="newMilestone.description" rows="2" placeholder="What does completing this milestone mean?" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none transition-all duration-150" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Due Date</label>
            <input v-model="newMilestone.due_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Status</label>
            <div class="relative">
              <select v-model="newMilestone.status" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showAddMilestone = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="createMilestone" :disabled="savingMilestone || !newMilestone.title.trim()" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
            <UIcon v-if="savingMilestone" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Create Milestone</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <ModalBase :open="!!editingMilestone" title="Edit Milestone" @close="editingMilestone = null">
      <form v-if="editingMilestone" @submit.prevent="saveEditMilestone" class="space-y-5">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Title</label>
          <input v-model="editingMilestone.title" type="text" required class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Description</label>
          <textarea v-model="editingMilestone.description" rows="2" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none transition-all duration-150" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Due Date</label>
            <input v-model="editingMilestone.due_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Status</label>
            <div class="relative">
              <select v-model="editingMilestone.status" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="editingMilestone = null" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="saveEditMilestone" :disabled="savingEdit" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
            <UIcon v-if="savingEdit" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Save Changes</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Delete Confirmation Modals unchanged -->
    <ModalBase :open="!!confirmDeleteMilestoneId" title="Delete Milestone" subtitle="This action cannot be undone." @close="confirmDeleteMilestoneId = null">
      <p class="text-slate-400 text-sm">All tasks inside this milestone will also be deleted.</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="confirmDeleteMilestoneId = null" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="confirmDeleteMilestone" :disabled="deletingMilestone" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            <UIcon v-if="deletingMilestone" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Delete Milestone</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <ModalBase :open="!!confirmDeleteTaskId" title="Delete Task" subtitle="This action cannot be undone." @close="confirmDeleteTaskId = null">
      <p class="text-slate-400 text-sm">Are you sure you want to delete this task?</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="confirmDeleteTaskId = null" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="confirmDeleteTask" :disabled="deletingTask" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            <UIcon v-if="deletingTask" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Delete Task</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Toast -->
    <Transition
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border"
          :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'"
        >
          <UIcon
            :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
            class="w-5 h-5"
            :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'"
          />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>