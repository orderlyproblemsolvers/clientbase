<script setup lang="ts">
const props = defineProps<{ projectId: string }>()

const supabase = useSupabaseClient()
const user     = useSupabaseUser()

// ── State ─────────────────────────────────────────────────────────────────────
const loading    = ref(true)
const milestones = ref<any[]>([])
const expanded   = ref<Set<string>>(new Set())

// Add milestone
const showAddMilestone  = ref(false)
const savingMilestone   = ref(false)
const newMilestone = ref({ title: '', description: '', due_date: '', status: 'pending' })

// Add task — keyed by milestone id
const newTaskTitle = ref<Record<string, string>>({})
const addingTask   = ref<Record<string, boolean>>({})

// Edit milestone
const editingMilestone = ref<any>(null)
const savingEdit       = ref(false)

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchMilestones = async () => {
  loading.value = true
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
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────
const getUserId = async (): Promise<string> => {
  let id = user.value?.id
  if (!id) {
    const { data } = await supabase.auth.getSession()
    id = data.session?.user?.id
  }
  if (!id) throw new Error('Not authenticated')
  return id
}

// ── Milestone CRUD ─────────────────────────────────────────────────────────────
const createMilestone = async () => {
  if (!newMilestone.value.title.trim()) return
  savingMilestone.value = true
  try {
    const userId = await getUserId()
    const position = milestones.value.length

    const { error } = await supabase.from('milestones').insert({
      project_id:  props.projectId,
      user_id:     userId,
      title:       newMilestone.value.title.trim(),
      description: newMilestone.value.description || null,
      due_date:    newMilestone.value.due_date     || null,
      status:      newMilestone.value.status,
      position,
    })
    if (error) throw error

    showAddMilestone.value = false
    newMilestone.value = { title: '', description: '', due_date: '', status: 'pending' }
    await fetchMilestones()
  } catch (e: any) {
    alert('Error creating milestone: ' + e.message)
  } finally {
    savingMilestone.value = false
  }
}

const openEditMilestone = (m: any) => {
  editingMilestone.value = {
    id:          m.id,
    title:       m.title,
    description: m.description || '',
    due_date:    m.due_date    || '',
    status:      m.status,
  }
}

const saveEditMilestone = async () => {
  if (!editingMilestone.value) return
  savingEdit.value = true
  try {
    const { error } = await supabase
      .from('milestones')
      .update({
        title:       editingMilestone.value.title,
        description: editingMilestone.value.description || null,
        due_date:    editingMilestone.value.due_date    || null,
        status:      editingMilestone.value.status,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', editingMilestone.value.id)
    if (error) throw error
    editingMilestone.value = null
    await fetchMilestones()
  } catch (e: any) {
    alert('Error saving: ' + e.message)
  } finally {
    savingEdit.value = false
  }
}

const deleteMilestone = async (id: string) => {
  if (!confirm('Delete this milestone and all its tasks?')) return
  try {
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (error) throw error
    await fetchMilestones()
  } catch (e: any) {
    alert(e.message)
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
      project_id:   props.projectId,
      user_id:      userId,
      title,
    })
    if (error) throw error
    newTaskTitle.value[milestoneId] = ''
    await fetchMilestones()
  } catch (e: any) {
    alert('Error adding task: ' + e.message)
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

    // Auto-update milestone status based on tasks
    const milestone = milestones.value.find(m => m.id === task.milestone_id)
    if (milestone) {
      const total    = milestone.tasks.length
      const done     = milestone.tasks.filter((t: any) => t.status === 'done').length
      const newStatus =
        done === 0     ? 'pending'
        : done < total ? 'in_progress'
        : 'complete'

      if (newStatus !== milestone.status) {
        await supabase
          .from('milestones')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', milestone.id)
        milestone.status = newStatus
      }
    }
  } catch (e) {
    console.error(e)
  }
}

const cycleTaskPriority = async (task: any) => {
  const next =
    task.priority === 'low'    ? 'medium'
    : task.priority === 'medium' ? 'high'
    : 'low'
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ priority: next, updated_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) throw error
    task.priority = next
  } catch (e) {
    console.error(e)
  }
}

const deleteTask = async (taskId: string, milestoneId: string) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) throw error
    const m = milestones.value.find(m => m.id === milestoneId)
    if (m) m.tasks = m.tasks.filter((t: any) => t.id !== taskId)
  } catch (e: any) {
    alert(e.message)
  }
}

// ── Expand toggle ─────────────────────────────────────────────────────────────
const toggleExpand = (id: string) => {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

// ── Computed helpers ──────────────────────────────────────────────────────────
const taskProgress = (m: any) => {
  if (!m.tasks?.length) return { done: 0, total: 0, pct: 0 }
  const done  = m.tasks.filter((t: any) => t.status === 'done').length
  const total = m.tasks.length
  return { done, total, pct: Math.round((done / total) * 100) }
}

const milestoneStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending:     { label: 'Pending',     color: 'text-gray-400  bg-gray-400/10  border-gray-400/20',  dot: 'bg-gray-400'  },
  in_progress: { label: 'In Progress', color: 'text-blue-400  bg-blue-400/10  border-blue-400/20',  dot: 'bg-blue-400'  },
  complete:    { label: 'Complete',    color: 'text-green-400 bg-green-400/10 border-green-400/20', dot: 'bg-green-400' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-gray-500   bg-gray-500/10'   },
  medium: { label: 'Med',    color: 'text-yellow-400 bg-yellow-400/10' },
  high:   { label: 'High',   color: 'text-red-400    bg-red-400/10'    },
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
  <div class="animate-in fade-in duration-300">

    <!-- Header row -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-white font-bold">Milestones</h3>
        <!-- Overall progress -->
        <div v-if="overallProgress" class="flex items-center gap-3 mt-1">
          <div class="w-40 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-500"
              :style="{ width: overallProgress.pct + '%' }"
            ></div>
          </div>
          <span class="text-xs text-gray-500 font-medium">
            {{ overallProgress.done }}/{{ overallProgress.total }} tasks done
          </span>
        </div>
      </div>
      <button
        @click="showAddMilestone = true"
        class="bg-primary hover:bg-[#3d34d9] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        Add Milestone
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-secondary/50 animate-pulse rounded-2xl"></div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="milestones.length === 0"
      class="border-2 border-dashed border-white/5 rounded-2xl p-12 text-center"
    >
      <div class="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
        <UIcon name="i-heroicons-flag" class="w-7 h-7 text-gray-600" />
      </div>
      <p class="text-gray-500 font-medium mb-1">No milestones yet</p>
      <p class="text-gray-600 text-sm mb-4">
        Break the project into checkpoints. Each milestone can hold multiple tasks.
      </p>
      <button
        @click="showAddMilestone = true"
        class="text-primary hover:text-white text-sm font-bold transition-colors"
      >
        + Add first milestone
      </button>
    </div>

    <!-- Milestone list -->
    <div v-else class="space-y-3">
      <div
        v-for="m in milestones"
        :key="m.id"
        class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden transition-all"
        :class="expanded.has(m.id) ? 'border-white/10' : ''"
      >

        <!-- Milestone header -->
        <div
          class="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
          @click="toggleExpand(m.id)"
        >
          <!-- Status dot -->
          <div
            class="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-secondary/40 transition-colors"
            :class="milestoneStatusConfig[m.status]?.dot || 'bg-gray-400'"
            :style="{ '--tw-ring-color': 'transparent' }"
          ></div>

          <!-- Title + meta -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-white font-semibold text-sm">{{ m.title }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border"
                :class="milestoneStatusConfig[m.status]?.color"
              >
                {{ milestoneStatusConfig[m.status]?.label }}
              </span>
              <span v-if="m.due_date" class="text-[10px] text-gray-500 flex items-center gap-1">
                <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                {{ new Date(m.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </span>
            </div>

            <!-- Progress bar -->
            <div v-if="m.tasks?.length" class="flex items-center gap-2 mt-2">
              <div class="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="taskProgress(m).pct === 100 ? 'bg-green-400' : 'bg-primary'"
                  :style="{ width: taskProgress(m).pct + '%' }"
                ></div>
              </div>
              <span class="text-[10px] text-gray-500">
                {{ taskProgress(m).done }}/{{ taskProgress(m).total }}
              </span>
            </div>
            <p v-else class="text-[10px] text-gray-600 mt-1">No tasks yet</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 shrink-0" @click.stop>
            <button
              @click="openEditMilestone(m)"
              class="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              title="Edit milestone"
            >
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
            </button>
            <button
              @click="deleteMilestone(m.id)"
              class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete milestone"
            >
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            </button>
            <UIcon
              name="i-heroicons-chevron-down"
              class="w-4 h-4 text-gray-600 ml-1 transition-transform duration-200"
              :class="expanded.has(m.id) ? 'rotate-180' : ''"
            />
          </div>
        </div>

        <!-- Task list (expanded) -->
        <div v-if="expanded.has(m.id)" class="border-t border-white/5">

          <!-- Task items -->
          <div v-if="m.tasks?.length" class="divide-y divide-white/5">
            <div
              v-for="t in m.tasks"
              :key="t.id"
              class="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group"
            >
              <!-- Checkbox -->
              <button
                @click="toggleTask(t)"
                class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                :class="t.status === 'done'
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-600 hover:border-primary'"
              >
                <UIcon v-if="t.status === 'done'" name="i-heroicons-check" class="w-3 h-3 text-white" />
              </button>

              <!-- Title -->
              <span
                class="flex-1 text-sm transition-colors"
                :class="t.status === 'done' ? 'line-through text-gray-600' : 'text-gray-300'"
              >
                {{ t.title }}
              </span>

              <!-- Priority badge (click to cycle) -->
              <button
                @click="cycleTaskPriority(t)"
                class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-all opacity-60 hover:opacity-100"
                :class="priorityConfig[t.priority]?.color"
                :title="`Priority: ${t.priority} — click to change`"
              >
                {{ priorityConfig[t.priority]?.label }}
              </button>

              <!-- Delete -->
              <button
                @click="deleteTask(t.id, m.id)"
                class="p-1 rounded text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Add task input -->
          <div class="px-4 py-3 flex items-center gap-3">
            <div class="w-5 h-5 rounded border-2 border-white/10 shrink-0"></div>
            <input
              v-model="newTaskTitle[m.id]"
              type="text"
              placeholder="Add a task..."
              class="flex-1 bg-transparent text-sm text-gray-400 placeholder-gray-700 focus:outline-none focus:text-white transition-colors"
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
    </div>

    <!-- ── Add Milestone Modal ─────────────────────────────────────────────── -->
    <div v-if="showAddMilestone" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showAddMilestone = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">

        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <UIcon name="i-heroicons-flag" class="w-5 h-5 text-primary" />
            New Milestone
          </h2>
          <button @click="showAddMilestone = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>

        <form @submit.prevent="createMilestone" class="space-y-4">
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Title <span class="text-red-500">*</span></label>
            <input
              v-model="newMilestone.title"
              type="text"
              autofocus
              required
              placeholder="e.g. Design complete, API integrated"
              class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors"
            />
          </div>

          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Description</label>
            <textarea
              v-model="newMilestone.description"
              rows="2"
              placeholder="What does completing this milestone mean?"
              class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 transition-colors resize-none text-sm"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Due Date</label>
              <input
                v-model="newMilestone.due_date"
                type="date"
                class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
              <div class="relative">
                <select
                  v-model="newMilestone.status"
                  class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              @click="showAddMilestone = false"
              class="px-6 py-3 rounded-lg text-gray-400 hover:text-white transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="savingMilestone || !newMilestone.title.trim()"
              class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              <UIcon v-if="savingMilestone" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
              <span v-else>Create Milestone</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Edit Milestone Modal ────────────────────────────────────────────── -->
    <div v-if="editingMilestone" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="editingMilestone = null" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">

        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white">Edit Milestone</h2>
          <button @click="editingMilestone = null" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>

        <form @submit.prevent="saveEditMilestone" class="space-y-4">
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Title</label>
            <input
              v-model="editingMilestone.title"
              type="text"
              required
              class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Description</label>
            <textarea
              v-model="editingMilestone.description"
              rows="2"
              class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors resize-none text-sm"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Due Date</label>
              <input
                v-model="editingMilestone.due_date"
                type="date"
                class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none text-sm"
              />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status</label>
              <div class="relative">
                <select
                  v-model="editingMilestone.status"
                  class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              @click="editingMilestone = null"
              class="px-6 py-3 rounded-lg text-gray-400 hover:text-white transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="savingEdit"
              class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              <UIcon v-if="savingEdit" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
              <span v-else>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>