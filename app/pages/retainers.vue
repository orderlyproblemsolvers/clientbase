<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()

const loading      = ref(true)
const fetchError   = ref('')
const retainers    = ref<any[]>([])
const clients      = ref<any[]>([])
const projects     = ref<any[]>([])
const searchQuery  = ref('')
const filterStatus = ref('all')
const toast        = ref({ show: false, message: '', type: 'success' })

const showCreateModal   = ref(false)
const showDetailModal   = ref(false)
const showTemplatePanel = ref(false)
const selectedInvoice   = ref<any>(null)
const saving            = ref(false)

const showDeleteConfirm = ref(false)
const deletingInvoiceId = ref<string | null>(null)
const deletingInvoice   = ref(false)

const useLineItems = ref(true)
const lineItems    = ref([{ description: '', quantity: 1, unit_rate: 0 }])

const paymentStructure = ref<'one_time' | 'split' | 'recurring'>('one_time')
const paymentSplits    = ref([
  { label: 'Deposit',       percentage: 50, due_offset_days: 0  },
  { label: 'Final Payment', percentage: 50, due_offset_days: 30 },
])
const recurringInterval = ref('monthly')
const recurringCycles   = ref(3)

const form = ref({
  client_id:    '',
  project_id:   '',
  title:        '',
  amount:       0,
  currency:     'NGN',
  status:       'pending',
  start_date:   new Date().toISOString().split('T')[0],
  end_date:     '',
  due_date:     '',
  notes:        '',
  payment_link: '',
  template_id:  '' as string | null,
})

const fieldErrors = ref<Record<string, string>>({})

const clearFieldError = (field: string) => {
  if (fieldErrors.value[field]) {
    delete fieldErrors.value[field]
    fieldErrors.value = { ...fieldErrors.value }
  }
}

const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const fmt = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const generateInvoiceNumber = (count: number) =>
  `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

const getUserId = async () => {
  let id = user.value?.id
  if (!id) {
    const { data } = await supabase.auth.getSession()
    id = data.session?.user?.id
  }
  if (!id) throw new Error('Not authenticated')
  return id
}

const lineItemsTotal = computed(() =>
  lineItems.value.reduce((s, i) => s + i.quantity * i.unit_rate, 0)
)

const invoiceTotal = computed(() =>
  useLineItems.value ? lineItemsTotal.value : form.value.amount
)

const splitsTotal = computed(() =>
  paymentSplits.value.reduce((s, p) => s + Number(p.percentage || 0), 0)
)

const clientProjects = computed(() =>
  form.value.client_id
    ? projects.value.filter(p => p.client_id === form.value.client_id)
    : []
)

const isOverdue = (r: any) =>
  r.status === 'overdue' || (r.status === 'pending' && r.due_date && new Date(r.due_date) < new Date())

const effectiveStatus = (r: any) => isOverdue(r) ? 'overdue' : r.status

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-400/10  text-amber-400  border-amber-400/20',  dot: 'bg-amber-400'  },
  paid:      { label: 'Paid',      color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20', dot: 'bg-emerald-400' },
  overdue:   { label: 'Overdue',   color: 'bg-red-500/10    text-red-400    border-red-500/20',    dot: 'bg-red-400'    },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/10   text-slate-400   border-slate-500/20',   dot: 'bg-slate-400'   },
}

const structureLabel: Record<string, string> = {
  one_time:  'One-time',
  split:     'Split',
  recurring: 'Recurring',
}

const stats = computed(() => {
  if (!retainers.value.length) return { revenue: 0, outstanding: 0, overdueCount: 0, activeClients: 0 }
  const paid    = retainers.value.filter(r => r.status === 'paid')
  const unpaid  = retainers.value.filter(r => r.status === 'pending' || r.status === 'overdue')
  const overdue = retainers.value.filter(r => isOverdue(r))
  return {
    revenue:       paid.reduce((s, r) => s + getTotal(r), 0),
    outstanding:   unpaid.reduce((s, r) => s + getTotal(r), 0),
    overdueCount:  overdue.length,
    activeClients: new Set(retainers.value.map(r => r.client_id)).size,
  }
})

const filtered = computed(() => {
  if (!Array.isArray(retainers.value)) return []
  const q = searchQuery.value.toLowerCase()
  return retainers.value.filter(r => {
    const matchSearch = !q || r.clients?.name?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.invoice_number?.toLowerCase().includes(q)
    const matchStatus = filterStatus.value === 'all' || effectiveStatus(r) === filterStatus.value
    return matchSearch && matchStatus
  })
})

const getTotal = (r: any): number => {
  if (r.invoice_items?.length)
    return r.invoice_items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_rate), 0)
  return Number(r.amount)
}

const addLineItem  = () => lineItems.value.push({ description: '', quantity: 1, unit_rate: 0 })
const removeLineItem = (i: number) => { if (lineItems.value.length > 1) lineItems.value.splice(i, 1) }
const addSplit     = () => paymentSplits.value.push({ label: 'Payment', percentage: 0, due_offset_days: 0 })
const removeSplit  = (i: number) => { if (paymentSplits.value.length > 1) paymentSplits.value.splice(i, 1) }

const applyTemplate = (template: any) => {
  form.value.currency    = template.default_currency
  form.value.notes       = template.default_notes || ''
  form.value.template_id = template.id
  paymentStructure.value = template.payment_structure

  if (template.line_items?.length) {
    useLineItems.value = true
    lineItems.value = template.line_items.map((i: any) => ({
      description: i.description,
      quantity:    i.quantity || 1,
      unit_rate:   i.unit_rate || 0,
    }))
  }

  if (template.payment_structure === 'split' && template.payment_splits?.length) {
    paymentSplits.value = template.payment_splits.map((s: any) => ({ ...s }))
  }

  if (template.payment_structure === 'recurring') {
    recurringInterval.value = template.recurring_interval || 'monthly'
    recurringCycles.value   = template.recurring_cycles   || 3
  }

  showTemplatePanel.value = false
  showCreateModal.value   = true
  showToast(`Template "${template.name}" applied`)
}

const fetchData = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const { data: rData, error } = await supabase
      .from('retainers')
      .select('*, clients(id, name), projects(id, name), invoice_items(*), invoice_payment_schedule(*)')
      .order('created_at', { ascending: false })
    if (error) throw error
    retainers.value = rData || []

    const { data: cData } = await supabase.from('clients').select('id, name').order('name')
    clients.value = cData || []

    const { data: pData } = await supabase.from('projects').select('id, name, client_id').order('name')
    projects.value = pData || []
  } catch (e: any) {
    fetchError.value = e.message || 'Failed to load data'
    showToast('Failed to load data', 'error')
  } finally {
    loading.value = false
  }
}

const validateForm = (): boolean => {
  fieldErrors.value = {}
  let valid = true

  if (!form.value.client_id) {
    fieldErrors.value.client_id = 'Select a client'
    valid = false
  }

  if (useLineItems.value) {
    if (lineItems.value.every(i => !i.description.trim())) {
      fieldErrors.value.lineItems = 'Add at least one line item with a description'
      valid = false
    }
    lineItems.value.forEach((item, idx) => {
      if (!item.description.trim()) {
        fieldErrors.value[`line_${idx}_desc`] = 'Required'
        valid = false
      }
      if (!item.quantity || item.quantity <= 0) {
        fieldErrors.value[`line_${idx}_qty`] = 'Min 0.01'
        valid = false
      }
      if (!item.unit_rate && item.unit_rate !== 0) {
        fieldErrors.value[`line_${idx}_rate`] = 'Required'
        valid = false
      }
    })
  } else {
    if (!form.value.amount || form.value.amount <= 0) {
      fieldErrors.value.amount = 'Enter a valid amount'
      valid = false
    }
  }

  if (paymentStructure.value === 'split' && splitsTotal.value !== 100) {
    fieldErrors.value.splits = 'Split percentages must total 100%'
    valid = false
  }

  if (paymentStructure.value === 'recurring' && !form.value.end_date) {
    fieldErrors.value.end_date = 'Period end is required for recurring invoices'
    valid = false
  }

  return valid
}

const createInvoice = async () => {
  if (!validateForm()) return

  saving.value = true
  try {
    const total         = invoiceTotal.value
    const invoiceNumber = generateInvoiceNumber(retainers.value.length)

    let safeEndDate = form.value.end_date || null
    if (!safeEndDate && paymentStructure.value !== 'recurring') {
      safeEndDate = form.value.start_date
    }

    const { data: inserted, error } = await supabase
      .from('retainers')
      .insert({
        client_id:          form.value.client_id,
        project_id:         form.value.project_id  || null,
        title:              form.value.title        || `Invoice ${invoiceNumber}`,
        amount:             total,
        currency:           form.value.currency,
        status:             form.value.status,
        start_date:         form.value.start_date,
        end_date:           safeEndDate,
        due_date:           form.value.due_date     || null,
        notes:              form.value.notes        || null,
        payment_link:       form.value.payment_link || null,
        invoice_number:     invoiceNumber,
        payment_structure:  paymentStructure.value,
        recurring_interval: paymentStructure.value === 'recurring' ? recurringInterval.value : null,
        recurring_cycles:   paymentStructure.value === 'recurring' ? recurringCycles.value   : null,
        template_id:        form.value.template_id  || null,
        user_id:            await getUserId(),
      })
      .select()
      .single()

    if (error) throw error

    if (useLineItems.value && inserted) {
      const valid = lineItems.value.filter(i => i.description.trim())
      if (valid.length) {
        await supabase.from('invoice_items').insert(
          valid.map(i => ({ retainer_id: inserted.id, ...i }))
        )
      }
    }

    if (paymentStructure.value === 'split' && inserted && form.value.start_date) {
      const issueDate = new Date(form.value.start_date + 'T00:00:00')
      const scheduleRows = paymentSplits.value.map((s, idx) => {
        const due = new Date(issueDate)
        due.setDate(due.getDate() + (s.due_offset_days || 0))
        return {
          retainer_id: inserted.id,
          label:       s.label,
          amount:      Math.round((s.percentage / 100) * total * 100) / 100,
          percentage:  s.percentage,
          due_date:    due.toISOString().split('T')[0],
          status:      'pending',
          position:    idx,
        }
      })
      await supabase.from('invoice_payment_schedule').insert(scheduleRows)
    }

    showCreateModal.value = false
    resetForm()
    await fetchData()
    showToast('Invoice created!')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  form.value = {
    client_id: '', project_id: '', title: '', amount: 0, currency: 'NGN',
    status: 'pending', start_date: new Date().toISOString().split('T')[0],
    end_date: '', due_date: '', notes: '', payment_link: '', template_id: null,
  }
  lineItems.value        = [{ description: '', quantity: 1, unit_rate: 0 }]
  paymentStructure.value = 'one_time'
  paymentSplits.value    = [
    { label: 'Deposit', percentage: 50, due_offset_days: 0 },
    { label: 'Final Payment', percentage: 50, due_offset_days: 30 },
  ]
  recurringInterval.value = 'monthly'
  recurringCycles.value   = 3
  useLineItems.value      = true
  fieldErrors.value       = {}
}

const updateStatus = async (id: string, status: string) => {
  const idx = retainers.value.findIndex(r => r.id === id)
  if (idx === -1) return
  const prev = retainers.value[idx].status
  retainers.value[idx].status = status
  try {
    const updates: any = { status }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    const { error } = await supabase.from('retainers').update(updates).eq('id', id)
    if (error) throw error
    if (selectedInvoice.value?.id === id) {
      selectedInvoice.value.status  = status
      if (status === 'paid') selectedInvoice.value.paid_at = updates.paid_at
    }
    showToast('Status updated!')
  } catch {
    retainers.value[idx].status = prev
    showToast('Failed to update', 'error')
  }
}

const markInstallmentPaid = async (installment: any) => {
  try {
    const paidAt = new Date().toISOString()
    const { error } = await supabase
      .from('invoice_payment_schedule')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('id', installment.id)
    if (error) throw error
    installment.status  = 'paid'
    installment.paid_at = paidAt

    const all = selectedInvoice.value.invoice_payment_schedule
    if (all && all.every((i: any) => i.status === 'paid')) {
      await updateStatus(selectedInvoice.value.id, 'paid')
    }
    showToast('Installment marked paid!')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const requestDeleteInvoice = (id: string) => {
  deletingInvoiceId.value = id
  showDeleteConfirm.value = true
}

const confirmDeleteInvoice = async () => {
  if (!deletingInvoiceId.value) return
  deletingInvoice.value = true
  try {
    const { error } = await supabase.from('retainers').delete().eq('id', deletingInvoiceId.value)
    if (error) throw error
    retainers.value = retainers.value.filter(r => r.id !== deletingInvoiceId.value)
    if (showDetailModal.value) showDetailModal.value = false
    showToast('Invoice deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    deletingInvoice.value = false
    showDeleteConfirm.value = false
    deletingInvoiceId.value = null
  }
}

const openDetail      = (r: any) => { selectedInvoice.value = r; showDetailModal.value = true }
const openPrintView   = (id: string) => window.open(`/invoices/${id}`, '_blank')

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">
    <Transition name="banner">
      <div v-if="fetchError" class="mb-6 bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-sm text-red-400 flex items-start gap-3">
        <UIcon name="i-heroicons-exclamation-circle" class="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p class="font-medium mb-1">Failed to load billing data.</p>
          <p class="text-xs opacity-80">{{ fetchError }}</p>
          <button @click="fetchData" class="mt-2 text-xs font-semibold text-primary hover:text-white transition-colors">Retry</button>
        </div>
      </div>
    </Transition>

    <div class="relative mb-8 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-white/6 p-5 md:p-6">
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <UIcon name="i-heroicons-banknotes" class="w-8 h-8 text-primary" />
            Billing & Retainers
          </h1>
          <p class="text-slate-400 mt-2 text-sm max-w-lg">Manage invoices, retainers, and payment schedules.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="showTemplatePanel = true"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150"
          >
            <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4" />
            Templates
          </button>
          <button
            @click="resetForm(); showCreateModal = true"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
          >
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/5">
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-400/10 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Revenue</p>
            <p class="text-sm sm:text-lg font-bold text-white tabular-nums truncate">{{ fmt(stats.revenue) }}</p>
          </div>
        </div>
        <button @click="filterStatus = 'pending'" class="flex items-center gap-2 sm:gap-3 text-left hover:opacity-80 transition-opacity">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-clock" class="w-4 h-4 text-amber-400" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Outstanding</p>
            <p class="text-sm sm:text-lg font-bold text-amber-400 tabular-nums truncate">{{ fmt(stats.outstanding) }}</p>
          </div>
        </button>
        <button @click="filterStatus = 'overdue'" class="flex items-center gap-2 sm:gap-3 text-left hover:opacity-80 transition-opacity">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
               :class="stats.overdueCount > 0 ? 'bg-red-400/15' : 'bg-slate-400/10'">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4"
                   :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Overdue</p>
            <p class="text-sm sm:text-lg font-bold tabular-nums" :class="stats.overdueCount > 0 ? 'text-red-400' : 'text-white'">{{ stats.overdueCount }}</p>
          </div>
        </button>
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="i-heroicons-users" class="w-4 h-4 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Active Clients</p>
            <p class="text-sm sm:text-lg font-bold text-primary tabular-nums">{{ stats.activeClients }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col md:flex-row gap-3 mb-6">
      <div class="relative flex-1">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
        <input v-model="searchQuery" type="search" placeholder="Search by client, description, or invoice number..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/40 focus:outline-none transition-all duration-150" />
      </div>
      <div class="bg-white/5 p-1 rounded-xl flex gap-1 overflow-x-auto">
        <button v-for="s in ['all', 'pending', 'paid', 'overdue', 'cancelled']" :key="s" @click="filterStatus = s" class="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150 whitespace-nowrap" :class="filterStatus === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'">{{ s }}</button>
      </div>
    </div>

    <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left whitespace-nowrap min-w-[700px]">
          <thead class="bg-white/5 text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-white/5">
            <tr>
              <th class="p-4 sm:p-5">Invoice</th>
              <th class="p-4 sm:p-5">Client / Project</th>
              <th class="p-4 sm:p-5 hidden md:table-cell">Structure</th>
              <th class="p-4 sm:p-5">Due</th>
              <th class="p-4 sm:p-5">Amount</th>
              <th class="p-4 sm:p-5">Status</th>
              <th class="p-4 sm:p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <template v-if="loading">
              <tr v-for="i in 5" :key="i" class="animate-pulse">
                <td class="p-4 sm:p-5"><div class="h-4 w-24 bg-white/5 rounded"></div></td>
                <td class="p-4 sm:p-5"><div class="h-4 w-32 bg-white/5 rounded mb-1"></div><div class="h-3 w-20 bg-white/5 rounded"></div></td>
                <td class="p-4 sm:p-5 hidden md:table-cell"><div class="h-4 w-16 bg-white/5 rounded"></div></td>
                <td class="p-4 sm:p-5"><div class="h-4 w-20 bg-white/5 rounded"></div></td>
                <td class="p-4 sm:p-5"><div class="h-4 w-16 bg-white/5 rounded"></div></td>
                <td class="p-4 sm:p-5"><div class="h-6 w-16 bg-white/5 rounded-full"></div></td>
                <td class="p-4 sm:p-5 text-right"><div class="h-8 w-16 bg-white/5 rounded inline-block"></div></td>
              </tr>
            </template>

            <tr v-else-if="filtered.length === 0">
              <td colspan="7" class="py-20 text-center">
                <div class="flex flex-col items-center">
                  <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <UIcon name="i-heroicons-document-magnifying-glass" class="w-6 h-6 text-slate-600" />
                  </div>
                  <p class="text-sm font-medium text-slate-300 mb-1">No invoices found</p>
                  <p class="text-xs text-slate-500 mb-5">Create an invoice or adjust your filters.</p>
                  <button @click="resetForm(); showCreateModal = true" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                    <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
                    Create Invoice
                  </button>
                </div>
              </td>
            </tr>

            <tr v-else v-for="r in filtered" :key="r.id" class="hover:bg-white/[0.03] transition-colors duration-150 group cursor-pointer" @click="openDetail(r)">
              <td class="p-4 sm:p-5">
                <p class="text-white font-mono font-bold text-sm">{{ r.invoice_number || '—' }}</p>
                <p class="text-slate-500 text-xs mt-0.5 max-w-[140px] truncate">{{ r.title }}</p>
              </td>
              <td class="p-4 sm:p-5">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">{{ r.clients?.name?.charAt(0) || '?' }}</div>
                  <div class="min-w-0">
                    <p class="text-white font-medium text-sm truncate">{{ r.clients?.name || 'Unknown' }}</p>
                    <p v-if="r.projects?.name" class="text-slate-500 text-xs flex items-center gap-1"><UIcon name="i-heroicons-folder-open" class="w-3 h-3" />{{ r.projects.name }}</p>
                  </div>
                </div>
              </td>
              <td class="p-4 sm:p-5 hidden md:table-cell">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-white/[0.03] border-white/6 text-slate-400">{{ structureLabel[r.payment_structure || 'one_time'] }}</span>
              </td>
              <td class="p-4 sm:p-5">
                <span v-if="r.due_date" class="text-sm" :class="isOverdue(r) ? 'text-red-400 font-semibold' : 'text-slate-400'">{{ fmtDate(r.due_date) }}</span>
                <span v-else class="text-slate-600 text-sm">—</span>
              </td>
              <td class="p-4 sm:p-5 font-mono text-white font-medium tabular-nums">{{ fmt(getTotal(r), r.currency) }}</td>
              <td class="p-4 sm:p-5">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border" :class="statusConfig[effectiveStatus(r)]?.color">
                  <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[effectiveStatus(r)]?.dot" aria-hidden="true"></span>
                  {{ statusConfig[effectiveStatus(r)]?.label }}
                </span>
              </td>
              <td class="p-4 sm:p-5 text-right" @click.stop>
                <div class="flex justify-end items-center gap-2 duration-150">
                  <button @click="openPrintView(r.id)" class="p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors" title="Print"><UIcon name="i-heroicons-printer" class="w-4 h-4" /></button>
                  <button v-if="r.status !== 'paid'" @click="updateStatus(r.id, 'paid')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 hover:text-white transition-all border border-emerald-400/20">Mark Paid</button>
                  <button @click="requestDeleteInvoice(r.id)" class="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors" title="Delete"><UIcon name="i-heroicons-trash" class="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ModalBase :open="showTemplatePanel" title="Invoice Templates" @close="showTemplatePanel = false">
      <InvoiceTemplateManager @select="applyTemplate" />
    </ModalBase>

    <ModalBase :open="showDetailModal && !!selectedInvoice" :title="selectedInvoice?.invoice_number || 'Invoice'" :subtitle="selectedInvoice?.title" @close="showDetailModal = false">
      <template v-if="selectedInvoice">
        <div class="space-y-6">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border" :class="statusConfig[effectiveStatus(selectedInvoice)]?.color">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[effectiveStatus(selectedInvoice)]?.dot" />
              {{ statusConfig[effectiveStatus(selectedInvoice)]?.label }}
            </span>
            <div v-if="selectedInvoice.status !== 'paid'" class="flex gap-2">
              <button @click="updateStatus(selectedInvoice.id, 'paid')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 hover:text-white transition-all border border-emerald-400/20">Mark Paid</button>
              <button @click="updateStatus(selectedInvoice.id, 'cancelled')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-400/10 hover:bg-slate-400/20 text-slate-400 transition-all border border-slate-400/20">Cancel</button>
            </div>
            <p v-else class="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
              Paid {{ selectedInvoice.paid_at ? fmtDate(selectedInvoice.paid_at.split('T')[0]) : '' }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Client</p>
              <p class="text-white font-semibold text-sm">{{ selectedInvoice.clients?.name }}</p>
            </div>
            <div v-if="selectedInvoice.projects?.name" class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Project</p>
              <p class="text-white font-semibold text-sm">{{ selectedInvoice.projects.name }}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div v-if="selectedInvoice.start_date" class="bg-white/[0.03] border border-white/6 rounded-2xl p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Issue</p>
              <p class="text-white text-sm font-medium">{{ fmtDate(selectedInvoice.start_date) }}</p>
            </div>
            <div v-if="selectedInvoice.due_date" class="bg-white/[0.03] border border-white/6 rounded-2xl p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Due</p>
              <p class="text-sm font-medium" :class="isOverdue(selectedInvoice) ? 'text-red-400' : 'text-white'">{{ fmtDate(selectedInvoice.due_date) }}</p>
            </div>
            <div v-if="selectedInvoice.end_date" class="bg-white/[0.03] border border-white/6 rounded-2xl p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Period End</p>
              <p class="text-white text-sm font-medium">{{ fmtDate(selectedInvoice.end_date) }}</p>
            </div>
          </div>

          <div v-if="selectedInvoice.payment_structure === 'recurring'" class="bg-primary/5 border border-primary/10 rounded-2xl p-4">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Recurring Schedule</p>
            <p class="text-white text-sm font-medium capitalize">
              {{ selectedInvoice.recurring_interval }} · {{ selectedInvoice.recurring_cycles }} cycles
            </p>
          </div>

          <div v-if="selectedInvoice.invoice_payment_schedule?.length">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Payment Schedule</p>
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden divide-y divide-white/5">
              <div
                v-for="installment in selectedInvoice.invoice_payment_schedule.sort((a: any, b: any) => a.position - b.position)"
                :key="installment.id"
                class="flex items-center justify-between p-4"
              >
                <div>
                  <div class="flex items-center gap-2 mb-0.5">
                    <div class="w-2 h-2 rounded-full" :class="installment.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'"></div>
                    <p class="text-white text-sm font-semibold">{{ installment.label }}</p>
                  </div>
                  <p class="text-slate-500 text-xs">
                    {{ installment.percentage }}% ·
                    <span v-if="installment.due_date">Due {{ fmtDate(installment.due_date) }}</span>
                  </p>
                  <p v-if="installment.paid_at" class="text-emerald-400 text-[10px] mt-0.5 font-medium">
                    Paid {{ fmtDate(installment.paid_at.split('T')[0]) }}
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <p class="font-mono font-bold text-white tabular-nums">{{ fmt(installment.amount, selectedInvoice.currency) }}</p>
                  <button
                    v-if="installment.status !== 'paid'"
                    @click="markInstallmentPaid(installment)"
                    class="text-[10px] font-semibold bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 hover:text-white px-2.5 py-1.5 rounded-xl transition-all border border-emerald-400/20"
                  >
                    Mark Paid
                  </button>
                  <UIcon v-else name="i-heroicons-check-circle" class="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedInvoice.invoice_items?.length">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Line Items</p>
            <div class="bg-white/[0.03] border border-white/6 rounded-2xl overflow-hidden">
              <div class="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-white/5">
                <div class="col-span-6">Description</div>
                <div class="col-span-2 text-right">Qty</div>
                <div class="col-span-2 text-right">Rate</div>
                <div class="col-span-2 text-right">Total</div>
              </div>
              <div v-for="item in selectedInvoice.invoice_items" :key="item.id" class="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-white/5 last:border-0">
                <div class="col-span-6 text-slate-300">{{ item.description }}</div>
                <div class="col-span-2 text-right text-slate-400 tabular-nums">{{ item.quantity }}</div>
                <div class="col-span-2 text-right text-slate-400 font-mono tabular-nums">{{ fmt(item.unit_rate, selectedInvoice.currency) }}</div>
                <div class="col-span-2 text-right text-white font-mono font-medium tabular-nums">{{ fmt(item.quantity * item.unit_rate, selectedInvoice.currency) }}</div>
              </div>
              <div class="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5">
                <div class="col-span-10 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider pr-4">Total</div>
                <div class="col-span-2 text-right font-mono font-bold text-white text-base tabular-nums">{{ fmt(getTotal(selectedInvoice), selectedInvoice.currency) }}</div>
              </div>
            </div>
          </div>
          <div v-else class="flex items-center justify-between bg-white/[0.03] border border-white/6 rounded-2xl p-4">
            <p class="text-slate-400 font-medium text-sm">Amount</p>
            <p class="text-white font-mono font-bold text-xl tabular-nums">{{ fmt(selectedInvoice.amount, selectedInvoice.currency) }}</p>
          </div>

          <div v-if="selectedInvoice.notes" class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Notes</p>
            <p class="text-slate-300 text-sm leading-relaxed">{{ selectedInvoice.notes }}</p>
          </div>

          <div v-if="selectedInvoice.payment_link" class="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-2xl p-4">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Payment Link</p>
              <p class="text-primary text-xs truncate max-w-xs">{{ selectedInvoice.payment_link }}</p>
            </div>
            <a :href="selectedInvoice.payment_link" target="_blank" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white transition-all">Open</a>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-between">
          <button @click="openPrintView(selectedInvoice?.id)" class="text-xs text-slate-500 hover:text-white transition-colors">Print / PDF</button>
          <button @click="requestDeleteInvoice(selectedInvoice?.id)" class="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
        </div>
      </template>
    </ModalBase>

    <ModalBase :open="showCreateModal" title="Create Invoice" subtitle="Issue a new retainer or one‑time invoice" @close="showCreateModal = false; resetForm()">
      <form @submit.prevent="createInvoice" class="space-y-5">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Client <span class="text-red-400">*</span></label>
            <div class="relative">
              <select
                v-model="form.client_id"
                required
                class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none appearance-none cursor-pointer transition-all duration-150"
                :class="fieldErrors.client_id ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
                @change="clearFieldError('client_id')"
              >
                <option class="bg-[#0d1525] text-white" value="" disabled>Choose...</option>
                <option class="bg-[#0d1525] text-white" v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
            <p v-if="fieldErrors.client_id" class="text-xs text-red-400 mt-1">{{ fieldErrors.client_id }}</p>
          </div>
          <div v-if="clientProjects.length" class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Project</label>
            <div class="relative">
              <select v-model="form.project_id" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option class="bg-[#0d1525] text-white" value="">None</option>
                <option class="bg-[#0d1525] text-white" v-for="p in clientProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Title</label>
          <input v-model="form.title" type="text" placeholder="e.g. Q2 2026 Monthly Retainer" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
        </div>

        <div class="flex items-center gap-2">
          <button type="button" @click="useLineItems = true" class="flex-1 py-2 rounded-lg text-xs font-semibold transition-all border" :class="useLineItems ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">Line Items</button>
          <button type="button" @click="useLineItems = false" class="flex-1 py-2 rounded-lg text-xs font-semibold transition-all border" :class="!useLineItems ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">Flat Amount</button>
        </div>

        <div v-if="useLineItems" class="space-y-2">
          <div class="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-1">
            <div class="col-span-6">Description</div>
            <div class="col-span-2 text-center">Qty</div>
            <div class="col-span-3 text-right">Rate</div>
          </div>
          <div v-for="(item, idx) in lineItems" :key="idx" class="grid grid-cols-12 gap-2 items-center">
            <div class="col-span-6">
              <input
                v-model="item.description"
                type="text"
                placeholder="Description"
                class="w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all duration-150"
                :class="fieldErrors[`line_${idx}_desc`] ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
                @input="clearFieldError(`line_${idx}_desc`)"
              />
              <p v-if="fieldErrors[`line_${idx}_desc`]" class="text-xs text-red-400 mt-0.5">{{ fieldErrors[`line_${idx}_desc`] }}</p>
            </div>
            <div class="col-span-2">
              <input
                v-model.number="item.quantity"
                type="number"
                min="0.01"
                step="0.01"
                class="w-full bg-white/[0.04] border rounded-xl px-2 py-2.5 text-sm text-white text-center focus:outline-none transition-all duration-150"
                :class="fieldErrors[`line_${idx}_qty`] ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
                @input="clearFieldError(`line_${idx}_qty`)"
              />
              <p v-if="fieldErrors[`line_${idx}_qty`]" class="text-xs text-red-400 mt-0.5">{{ fieldErrors[`line_${idx}_qty`] }}</p>
            </div>
            <div class="col-span-3">
              <input
                v-model.number="item.unit_rate"
                type="number"
                min="0"
                step="0.01"
                class="w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-sm text-white text-right focus:outline-none font-mono transition-all duration-150"
                :class="fieldErrors[`line_${idx}_rate`] ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
                @input="clearFieldError(`line_${idx}_rate`)"
              />
              <p v-if="fieldErrors[`line_${idx}_rate`]" class="text-xs text-red-400 mt-0.5">{{ fieldErrors[`line_${idx}_rate`] }}</p>
            </div>
            <button type="button" @click="removeLineItem(idx)" :disabled="lineItems.length === 1" class="col-span-1 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors disabled:opacity-20">
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </div>
          <p v-if="fieldErrors.lineItems" class="text-xs text-red-400">{{ fieldErrors.lineItems }}</p>
          <button type="button" @click="addLineItem" class="text-xs font-semibold text-primary hover:text-white transition-colors flex items-center gap-1 mt-1">
            <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />Add line item
          </button>
          <div class="flex justify-between items-center pt-3 border-t border-white/5">
            <p class="text-slate-400 text-sm font-medium">Total</p>
            <p class="text-white font-mono font-bold text-lg tabular-nums">{{ fmt(lineItemsTotal, form.currency) }}</p>
          </div>
        </div>

        <div v-else class="grid grid-cols-3 gap-3">
          <div class="col-span-2 space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Amount</label>
            <input
              v-model.number="form.amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none font-mono transition-all duration-150"
              :class="fieldErrors.amount ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
              @input="clearFieldError('amount')"
            />
            <p v-if="fieldErrors.amount" class="text-xs text-red-400 mt-1">{{ fieldErrors.amount }}</p>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Currency</label>
            <div class="relative">
              <select v-model="form.currency" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option class="bg-[#0d1525] text-white" value="NGN">NGN</option>
                <option class="bg-[#0d1525] text-white" value="USD">USD</option>
                <option class="bg-[#0d1525] text-white" value="GBP">GBP</option>
                <option class="bg-[#0d1525] text-white" value="EUR">EUR</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Payment Structure</label>
          <div class="bg-white/5 p-1 rounded-xl grid grid-cols-3 gap-1">
            <button type="button" v-for="s in ['one_time', 'split', 'recurring']" :key="s" @click="paymentStructure = s as any" class="py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all duration-150" :class="paymentStructure === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'">
              {{ s === 'one_time' ? 'One-time' : s === 'split' ? 'Split' : 'Recurring' }}
            </button>
          </div>
        </div>

        <div v-if="paymentStructure === 'split'" class="space-y-3 bg-white/[0.03] rounded-2xl p-4 border border-white/6">
          <div class="flex items-center justify-between">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment Splits</p>
            <span class="text-[10px] font-semibold" :class="splitsTotal === 100 ? 'text-emerald-400' : 'text-amber-400'">{{ splitsTotal }}% / 100%</span>
          </div>
          <p class="text-[10px] text-slate-600">Amounts calculated from total. Due dates offset from issue date.</p>
          <div v-for="(split, idx) in paymentSplits" :key="idx" class="grid grid-cols-12 gap-2 items-center">
            <input v-model="split.label" type="text" placeholder="Label" class="col-span-4 bg-white/[0.04] border border-white/8 rounded-xl px-2.5 py-2 text-xs text-white focus:border-primary/50 focus:outline-none placeholder-slate-600 transition-all duration-150" />
            <div class="col-span-3 relative">
              <input v-model.number="split.percentage" type="number" min="1" max="100" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-2.5 py-2 text-xs text-white text-right focus:border-primary/50 focus:outline-none transition-all duration-150 pr-5" />
              <span class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">%</span>
            </div>
            <div class="col-span-4 relative">
              <input v-model.number="split.due_offset_days" type="number" min="0" placeholder="+days" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-2.5 py-2 text-xs text-white focus:border-primary/50 focus:outline-none placeholder-slate-600 transition-all duration-150" />
            </div>
            <button type="button" @click="removeSplit(idx)" :disabled="paymentSplits.length === 1" class="col-span-1 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors disabled:opacity-20">
              <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
            </button>
          </div>
          <p v-if="fieldErrors.splits" class="text-xs text-red-400">{{ fieldErrors.splits }}</p>
          <button type="button" @click="addSplit" class="text-xs font-semibold text-primary hover:text-white transition-colors flex items-center gap-1">
            <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />Add split
          </button>
          <div v-if="invoiceTotal > 0" class="border-t border-white/5 pt-3 space-y-1">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Preview</p>
            <div v-for="(split, idx) in paymentSplits" :key="idx" class="flex justify-between text-xs text-slate-400">
              <span>{{ split.label }}</span>
              <span class="font-mono tabular-nums">{{ fmt(Math.round((split.percentage / 100) * invoiceTotal * 100) / 100, form.currency) }}</span>
            </div>
          </div>
        </div>

        <div v-if="paymentStructure === 'recurring'" class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Interval</label>
            <div class="relative">
              <select v-model="recurringInterval" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                <option class="bg-[#0d1525] text-white" value="weekly">Weekly</option>
                <option class="bg-[#0d1525] text-white" value="monthly">Monthly</option>
                <option class="bg-[#0d1525] text-white" value="quarterly">Quarterly</option>
                <option class="bg-[#0d1525] text-white" value="yearly">Yearly</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Cycles</label>
            <input v-model.number="recurringCycles" type="number" min="1" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Issue Date</label>
            <input v-model="form.start_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Due Date</label>
            <input v-model="form.due_date" type="date" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-3 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">
              Period End
              <span v-if="paymentStructure === 'recurring'" class="text-red-400">*</span>
              <span v-else class="text-slate-600 font-normal">— optional</span>
            </label>
            <input
              v-model="form.end_date"
              type="date"
              class="w-full bg-white/[0.04] border rounded-xl px-3 py-3 text-sm text-white focus:outline-none transition-all duration-150"
              :class="fieldErrors.end_date ? 'border-red-500/50' : 'border-white/8 focus:border-primary/50'"
              @input="clearFieldError('end_date')"
            />
            <p v-if="fieldErrors.end_date" class="text-xs text-red-400 mt-1">{{ fieldErrors.end_date }}</p>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Paystack / Payment Link</label>
          <input v-model="form.payment_link" type="url" placeholder="https://paystack.com/pay/..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Notes</label>
          <textarea v-model="form.notes" rows="2" placeholder="Bank details, payment terms..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none transition-all duration-150"></textarea>
        </div>

        <div class="flex gap-3 pt-4 border-t border-white/5">
          <button type="button" @click="showCreateModal = false; resetForm()" class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150">Cancel</button>
          <button type="submit" :disabled="saving" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]">
            <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            {{ saving ? 'Creating...' : 'Create Invoice' }}
          </button>
        </div>
      </form>
    </ModalBase>

    <ModalBase :open="showDeleteConfirm" title="Delete Invoice" subtitle="This action cannot be undone." @close="showDeleteConfirm = false">
      <p class="text-slate-400 text-sm">Are you sure you want to permanently delete this invoice?</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showDeleteConfirm = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="confirmDeleteInvoice" :disabled="deletingInvoice" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            <UIcon v-if="deletingInvoice" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Delete</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <Transition enter-active-class="transform ease-out duration-300 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-[100]">
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'" />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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