<script setup lang="ts">
// ⚠️ Script remains exactly the same
const emit = defineEmits<{ (e: 'select', template: any): void }>()

const supabase = useSupabaseClient()
const user     = useSupabaseUser()

const loading   = ref(true)
const templates = ref<any[]>([])
const toast     = ref({ show: false, message: '', type: 'success' })

// Views: 'list' | 'create' | 'edit'
const view    = ref<'list' | 'create' | 'edit'>('list')
const editing = ref<any>(null)
const saving  = ref(false)

const PROJECT_TYPES = [
  'General', 'Retainer', 'Web Design', 'Web Development',
  'Mobile App', 'Branding', 'UI/UX Design', 'Copywriting',
  'SEO/Marketing', 'Consulting', 'Maintenance',
]

const blankForm = () => ({
  name:               '',
  project_type:       'General',
  description:        '',
  default_currency:   'NGN',
  line_items:         [{ description: '', quantity: 1, unit_rate: 0 }] as any[],
  payment_structure:  'one_time',
  payment_splits:     [
    { label: 'Deposit',       percentage: 50, due_offset_days: 0  },
    { label: 'Final Payment', percentage: 50, due_offset_days: 30 },
  ] as any[],
  recurring_interval: 'monthly',
  recurring_cycles:   3,
  default_notes:      '',
})

const form = ref(blankForm())

const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const getUserId = async () => {
  let id = user.value?.id
  if (!id) {
    const { data } = await supabase.auth.getSession()
    id = data.session?.user?.id
  }
  if (!id) throw new Error('Not authenticated')
  return id
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchTemplates = async () => {
  loading.value = true
  try {
    const { data } = await supabase
      .from('invoice_templates')
      .select('*')
      .order('created_at', { ascending: false })
    templates.value = data || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Line item helpers ─────────────────────────────────────────────────────────
const addLineItem = () =>
  form.value.line_items.push({ description: '', quantity: 1, unit_rate: 0 })

const removeLineItem = (i: number) => {
  if (form.value.line_items.length > 1) form.value.line_items.splice(i, 1)
}

// ── Split helpers ─────────────────────────────────────────────────────────────
const addSplit = () =>
  form.value.payment_splits.push({ label: 'Payment', percentage: 0, due_offset_days: 0 })

const removeSplit = (i: number) => {
  if (form.value.payment_splits.length > 1) form.value.payment_splits.splice(i, 1)
}

const splitsTotal = computed(() =>
  form.value.payment_splits.reduce((s: number, p: any) => s + Number(p.percentage || 0), 0)
)

// ── Save ──────────────────────────────────────────────────────────────────────
const saveTemplate = async () => {
  if (!form.value.name.trim()) return
  if (form.value.payment_structure === 'split' && splitsTotal.value !== 100) {
    showToast('Split percentages must add up to 100%', 'error')
    return
  }
  saving.value = true
  try {
    const userId = await getUserId()
    const payload = {
      user_id:            userId,
      name:               form.value.name.trim(),
      project_type:       form.value.project_type,
      description:        form.value.description || null,
      default_currency:   form.value.default_currency,
      line_items:         form.value.line_items.filter((i: any) => i.description.trim()),
      payment_structure:  form.value.payment_structure,
      payment_splits:     form.value.payment_structure === 'split'     ? form.value.payment_splits    : [],
      recurring_interval: form.value.payment_structure === 'recurring' ? form.value.recurring_interval : null,
      recurring_cycles:   form.value.payment_structure === 'recurring' ? form.value.recurring_cycles   : null,
      default_notes:      form.value.default_notes || null,
    }

    if (view.value === 'edit' && editing.value) {
      const { error } = await supabase
        .from('invoice_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.value.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('invoice_templates').insert(payload)
      if (error) throw error
    }

    showToast(view.value === 'edit' ? 'Template updated!' : 'Template saved!')
    view.value = 'list'
    editing.value = null
    form.value = blankForm()
    await fetchTemplates()
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

const openEdit = (t: any) => {
  editing.value = t
  form.value = {
    name:               t.name,
    project_type:       t.project_type,
    description:        t.description || '',
    default_currency:   t.default_currency,
    line_items:         t.line_items?.length ? t.line_items : [{ description: '', quantity: 1, unit_rate: 0 }],
    payment_structure:  t.payment_structure,
    payment_splits:     t.payment_splits?.length ? t.payment_splits : [
      { label: 'Deposit', percentage: 50, due_offset_days: 0 },
      { label: 'Final Payment', percentage: 50, due_offset_days: 30 },
    ],
    recurring_interval: t.recurring_interval || 'monthly',
    recurring_cycles:   t.recurring_cycles   || 3,
    default_notes:      t.default_notes || '',
  }
  view.value = 'edit'
}

const deleteTemplate = async (id: string) => {
  if (!confirm('Delete this template?')) return
  try {
    const { error } = await supabase.from('invoice_templates').delete().eq('id', id)
    if (error) throw error
    templates.value = templates.value.filter(t => t.id !== id)
    showToast('Template deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const selectTemplate = (t: any) => emit('select', t)

const projectTypeIcon: Record<string, string> = {
  'Retainer':        'i-heroicons-arrow-path',
  'Web Design':      'i-heroicons-paint-brush',
  'Web Development': 'i-heroicons-code-bracket',
  'Mobile App':      'i-heroicons-device-phone-mobile',
  'Branding':        'i-heroicons-sparkles',
  'UI/UX Design':    'i-heroicons-cursor-arrow-ripple',
  'Consulting':      'i-heroicons-chat-bubble-left-right',
  'Maintenance':     'i-heroicons-wrench-screwdriver',
}

const getIcon = (type: string) =>
  projectTypeIcon[type] || 'i-heroicons-document-text'

const structureLabel: Record<string, string> = {
  one_time:  'One-time',
  split:     'Split payments',
  recurring: 'Recurring',
}

onMounted(() => fetchTemplates())
</script>

<template>
  <div class="flex flex-col h-full">

    <!-- ── List view ────────────────────────────────────────────────────── -->
    <div v-if="view === 'list'" class="flex flex-col h-full">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-base font-semibold text-white">Invoice Templates</h3>
          <p class="text-xs text-slate-500 mt-0.5">Reusable templates per project type.</p>
        </div>
        <button
          @click="form = blankForm(); view = 'create'"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          New
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 bg-white/5 animate-pulse rounded-2xl"></div>
      </div>

      <!-- Empty -->
      <div v-else-if="templates.length === 0" class="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/8 rounded-2xl">
        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-document-duplicate" class="w-6 h-6 text-slate-600" />
        </div>
        <p class="text-sm font-medium text-slate-300 mb-1">No templates yet</p>
        <p class="text-xs text-slate-500 mb-5">Create a template to speed up invoice creation.</p>
        <button
          @click="form = blankForm(); view = 'create'"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
          Create first template
        </button>
      </div>

      <!-- Template cards -->
      <div v-else class="space-y-3 overflow-y-auto flex-1">
        <div
          v-for="t in templates"
          :key="t.id"
          class="bg-white/[0.03] border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-150"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                <UIcon :name="getIcon(t.project_type)" class="w-4 h-4 text-primary" />
              </div>
              <div>
                <p class="text-sm font-semibold text-white">{{ t.name }}</p>
                <p class="text-xs text-slate-500 mt-0.5">
                  {{ t.project_type }} · {{ structureLabel[t.payment_structure] }}
                  <span v-if="t.line_items?.length"> · {{ t.line_items.length }} line item{{ t.line_items.length !== 1 ? 's' : '' }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button
                @click="openEdit(t)"
                class="p-1.5 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors duration-150"
                aria-label="Edit template"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
              </button>
              <button
                @click="deleteTemplate(t.id)"
                class="p-1.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors duration-150"
                aria-label="Delete template"
              >
                <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            @click="selectTemplate(t)"
            class="w-full text-center py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all duration-150 border border-primary/20"
          >
            Use Template →
          </button>
        </div>
      </div>
    </div>

    <!-- ── Create / Edit form ────────────────────────────────────────────── -->
    <div v-else class="flex flex-col h-full">
      <div class="flex items-center gap-3 mb-5">
        <button
          @click="view = 'list'; editing = null"
          class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all duration-150"
          aria-label="Back to templates"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
        </button>
        <div>
          <h3 class="text-base font-semibold text-white">{{ view === 'edit' ? 'Edit Template' : 'New Template' }}</h3>
          <p class="text-xs text-slate-500 mt-0.5">Set defaults for invoice creation</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto space-y-5">

        <!-- Name + Type -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="template-name" class="block text-xs font-semibold text-slate-400">Template Name <span class="text-red-400">*</span></label>
            <input id="template-name" v-model="form.name" type="text" placeholder="e.g. Retainer Basic" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
          <div class="space-y-1.5">
            <label for="template-type" class="block text-xs font-semibold text-slate-400">Project Type</label>
            <div class="relative">
              <select id="template-type" v-model="form.project_type" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option v-for="t in PROJECT_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        <!-- Currency -->
        <div class="w-32 space-y-1.5">
          <label for="template-currency" class="block text-xs font-semibold text-slate-400">Default Currency</label>
          <div class="relative">
            <select id="template-currency" v-model="form.default_currency" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
            <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        <!-- Line items -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-2">Default Line Items</label>
          <div class="space-y-2">
            <div v-for="(item, idx) in form.line_items" :key="idx" class="flex gap-2 items-center">
              <input
                v-model="item.description"
                type="text"
                placeholder="e.g. Monthly support"
                class="flex-1 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150"
              />
              <input
                v-model.number="item.quantity"
                type="number"
                min="1"
                class="w-16 bg-white/[0.04] border border-white/8 rounded-xl px-2 py-2.5 text-sm text-white text-center focus:border-primary/50 focus:outline-none transition-all duration-150"
              />
              <button
                type="button"
                @click="removeLineItem(idx)"
                :disabled="form.line_items.length === 1"
                class="p-2 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-20"
                aria-label="Remove line item"
              >
                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            type="button"
            @click="addLineItem"
            class="text-xs font-semibold text-primary hover:text-white transition-colors mt-2 flex items-center gap-1"
          >
            <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
            Add item
          </button>
        </div>

        <!-- Payment structure -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-2">Payment Structure</label>
          <div class="bg-white/5 p-1 rounded-xl grid grid-cols-3 gap-1">
            <button
              type="button"
              v-for="s in ['one_time', 'split', 'recurring']"
              :key="s"
              @click="form.payment_structure = s"
              class="py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150"
              :class="form.payment_structure === s
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'"
            >
              {{ s === 'one_time' ? 'One-time' : s === 'split' ? 'Split' : 'Recurring' }}
            </button>
          </div>
        </div>

        <!-- Split config -->
        <div v-if="form.payment_structure === 'split'" class="space-y-3 bg-white/[0.03] rounded-2xl p-4 border border-white/6">
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment Splits</p>
            <span
              class="text-[10px] font-semibold"
              :class="splitsTotal === 100 ? 'text-emerald-400' : 'text-amber-400'"
            >
              {{ splitsTotal }}% / 100%
            </span>
          </div>

          <div v-for="(split, idx) in form.payment_splits" :key="idx" class="grid grid-cols-12 gap-2 items-center">
            <input
              v-model="split.label"
              type="text"
              placeholder="Label"
              class="col-span-4 bg-white/[0.04] border border-white/8 rounded-xl px-2.5 py-2 text-xs text-white focus:border-primary/50 focus:outline-none placeholder-slate-600 transition-all duration-150"
            />
            <div class="col-span-3 relative">
              <input
                v-model.number="split.percentage"
                type="number"
                min="1"
                max="100"
                class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-2.5 py-2 text-xs text-white text-right focus:border-primary/50 focus:outline-none transition-all duration-150 pr-5"
              />
              <span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">%</span>
            </div>
            <div class="col-span-4 relative">
              <input
                v-model.number="split.due_offset_days"
                type="number"
                min="0"
                class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-2.5 py-2 text-xs text-white focus:border-primary/50 focus:outline-none placeholder-slate-600 transition-all duration-150"
                placeholder="+days"
              />
            </div>
            <button
              type="button"
              @click="removeSplit(idx)"
              :disabled="form.payment_splits.length === 1"
              class="col-span-1 flex justify-center text-slate-600 hover:text-red-400 transition-colors disabled:opacity-20"
              aria-label="Remove split"
            >
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </div>
          <p class="text-[10px] text-slate-600">+days = due offset from invoice issue date</p>
          <button type="button" @click="addSplit" class="text-xs font-semibold text-primary hover:text-white transition-colors flex items-center gap-1">
            <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
            Add split
          </button>
        </div>

        <!-- Recurring config -->
        <div v-if="form.payment_structure === 'recurring'" class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Interval</label>
            <div class="relative">
              <select v-model="form.recurring_interval" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Cycles</label>
            <input v-model.number="form.recurring_cycles" type="number" min="1" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
        </div>

        <!-- Notes -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Default Notes</label>
          <textarea v-model="form.default_notes" rows="3" placeholder="Bank details, payment terms..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none transition-all duration-150"></textarea>
        </div>
      </div>

      <!-- Save -->
      <div class="pt-5 border-t border-white/5 mt-5">
        <button
          @click="saveTemplate"
          :disabled="saving || !form.name.trim()"
          class="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
        >
          <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          <span v-else>{{ view === 'edit' ? 'Save Changes' : 'Save Template' }}</span>
        </button>
      </div>
    </div>

    <!-- Toast -->
    <Transition enter-active-class="transform ease-out duration-300 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="toast.show" class="fixed bottom-4 left-4 z-50">
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'" />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>

  </div>
</template>