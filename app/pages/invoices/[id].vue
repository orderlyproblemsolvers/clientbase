<script setup lang="ts">
definePageMeta({ layout: false })   // No sidebar — clean print page

const route    = useRoute()
const supabase = useSupabaseClient()
const id       = route.params.id as string

const loading = ref(true)
const invoice = ref<any>(null)

const fetchInvoice = async () => {
  try {
    const { data, error } = await supabase
      .from('retainers')
.select('*, clients(id, name, contact_name, contact_email, contact_phone, website), projects(id, name), invoice_items(*), invoice_payment_schedule(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    invoice.value = data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const formatCurrency = (amount: number, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)

const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric'
  })

const invoiceTotal = computed(() => {
  if (!invoice.value) return 0
  if (invoice.value.invoice_items?.length) {
    return invoice.value.invoice_items.reduce(
      (sum: number, i: any) => sum + Number(i.quantity) * Number(i.unit_rate), 0
    )
  }
  return Number(invoice.value.amount)
})

const statusLabel: Record<string, string> = {
  pending:   'PAYMENT DUE',
  paid:      'PAID',
  overdue:   'OVERDUE',
  cancelled: 'CANCELLED',
}

const printPage = () => {
  if (process.client) window.print()
}

const closePage = () => {
  if (process.client) window.close()
}

onMounted(() => fetchInvoice())
</script>

<template>
  <div class="min-h-screen bg-white ">

    <!-- Print button — hidden when printing -->
    <div class="no-print fixed top-4 right-4 flex gap-2 z-50">
      <button
        @click="printPage"
        class="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-colors"
      >
        <UIcon name="i-heroicons-printer" class="w-4 h-4" />
        Print / Save PDF
      </button>
      <button
        @click="closePage"
        class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
      >
        Close
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-gray-400 text-sm">Loading invoice...</div>
    </div>

    <!-- Invoice document -->
    <div v-else-if="invoice" class="max-w-3xl mx-auto p-10 print:p-0 print:max-w-none">

      <!-- Header -->
      <div class="flex justify-between items-start mb-12">
        <div>
          <div class="w-10 h-10  rounded-lg flex items-center justify-center mb-3">
            <NuxtImg
              src="/img/clientbaselogo-min.png"
              alt="clientbase logo"
              class="w-32 h-32 rounded-md object-cover"
          />
          </div>
          <p class="font-bold text-gray-900 text-lg">ClientBase</p>
        </div>
        <div class="text-right">
          <p
            class="text-3xl font-black tracking-tight mb-1"
            :class="{
              'text-orange-500': invoice.status === 'pending',
              'text-green-600':  invoice.status === 'paid',
              'text-red-500':    invoice.status === 'overdue',
              'text-gray-400':   invoice.status === 'cancelled',
            }"
          >
            {{ statusLabel[invoice.status] || 'INVOICE' }}
          </p>
          <p class="text-gray-900 font-mono font-bold text-lg">{{ invoice.invoice_number }}</p>
        </div>
      </div>

      <!-- Bill to + Dates -->
      <div class="grid grid-cols-2 gap-8 mb-12 pb-8 border-b border-gray-200">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Bill To</p>
          <p class="font-bold text-gray-900 text-lg">{{ invoice.clients?.name }}</p>
          <p v-if="invoice.clients?.contact_name" class="text-gray-600 text-sm mt-0.5">{{ invoice.clients.contact_name }}</p>
          <a v-if="invoice.clients?.contact_email" :href="`mailto:${invoice.clients.contact_email}`" class="text-gray-500 text-sm block mt-0.5">{{ invoice.clients.contact_email }}</a>
          <p v-if="invoice.clients?.contact_phone" class="text-gray-500 text-sm mt-0.5">{{ invoice.clients.contact_phone }}</p>
        </div>

        <div class="text-right space-y-2">
          <div v-if="invoice.start_date">
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Issue Date</p>
            <p class="text-gray-900 font-medium">{{ formatDate(invoice.start_date) }}</p>
          </div>
          <div v-if="invoice.due_date">
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Due Date</p>
            <p class="font-semibold" :class="invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'">
              {{ formatDate(invoice.due_date) }}
            </p>
          </div>
          <div v-if="invoice.projects?.name">
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Project</p>
            <p class="text-gray-900 font-medium">{{ invoice.projects.name }}</p>
          </div>
        </div>
      </div>

      <!-- Invoice description -->
      <div class="mb-8">
        <p class="text-gray-900 font-semibold text-lg">{{ invoice.title }}</p>
        <p v-if="invoice.start_date && invoice.end_date" class="text-gray-500 text-sm mt-1">
          Period: {{ formatDate(invoice.start_date) }} — {{ formatDate(invoice.end_date) }}
        </p>
      </div>

      <!-- Line items table -->
      <div v-if="invoice.invoice_items?.length" class="mb-8">
        <table class="w-full">
          <thead>
            <tr class="border-b-2 border-gray-900">
              <th class="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 pb-3">Description</th>
              <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 pb-3">Qty</th>
              <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 pb-3">Rate</th>
              <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-500 pb-3">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in invoice.invoice_items" :key="item.id">
              <td class="py-4 text-gray-900 font-medium">{{ item.description }}</td>
              <td class="py-4 text-right text-gray-600">{{ item.quantity }}</td>
              <td class="py-4 text-right text-gray-600 font-mono">{{ formatCurrency(item.unit_rate, invoice.currency) }}</td>
              <td class="py-4 text-right text-gray-900 font-mono font-semibold">{{ formatCurrency(item.quantity * item.unit_rate, invoice.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payment schedule (add between line items and total) -->
<div v-if="invoice.invoice_payment_schedule?.length" class="mb-8">
  <h3 class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Payment Schedule</h3>
  <table class="w-full">
    <thead>
      <tr class="border-b border-gray-200">
        <th class="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">Installment</th>
        <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">%</th>
        <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">Due</th>
        <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">Amount</th>
        <th class="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pb-3">Status</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
      <tr
        v-for="inst in invoice.invoice_payment_schedule.sort((a: any, b: any) => a.position - b.position)"
        :key="inst.id"
      >
        <td class="py-3 text-gray-900 font-medium">{{ inst.label }}</td>
        <td class="py-3 text-right text-gray-500">{{ inst.percentage }}%</td>
        <td class="py-3 text-right text-gray-500">{{ inst.due_date ? formatDate(inst.due_date) : '—' }}</td>
        <td class="py-3 text-right font-mono font-semibold text-gray-900">{{ formatCurrency(inst.amount, invoice.currency) }}</td>
        <td class="py-3 text-right">
          <span
            class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
            :class="inst.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'"
          >
            {{ inst.status === 'paid' ? 'Paid' : 'Pending' }}
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</div>

      <!-- Total -->
      <div class="flex justify-end mb-10">
        <div class="w-72">
          <div class="flex justify-between items-center py-4 border-t-2 border-gray-900">
            <p class="font-black text-gray-900 text-lg uppercase tracking-wide">Total Due</p>
            <p class="font-black text-gray-900 text-2xl font-mono">{{ formatCurrency(invoiceTotal, invoice.currency) }}</p>
          </div>
          <div v-if="invoice.status === 'paid'" class="flex justify-between items-center py-2 text-green-600">
            <p class="font-bold text-sm">Paid {{ invoice.paid_at ? formatDate(invoice.paid_at.split('T')[0]) : '' }}</p>
            <p class="font-bold font-mono">{{ formatCurrency(invoiceTotal, invoice.currency) }}</p>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="invoice.notes" class="bg-gray-50 rounded-2xl p-6 mb-8">
        <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Notes</p>
        <p class="text-gray-700 text-sm leading-relaxed">{{ invoice.notes }}</p>
      </div>

      <!-- Payment link -->
      <div v-if="invoice.payment_link && invoice.status !== 'paid'" class="bg-gray-900 rounded-2xl p-6 text-center mb-8">
        <p class="text-gray-400 text-sm mb-3">Pay online securely</p>
        <a
          :href="invoice.payment_link"
          target="_blank"
          class="inline-block bg-white text-gray-900 font-bold px-8 py-3 rounded-xl text-sm hover:bg-gray-100 transition-colors"
        >
          Pay Now →
        </a>
        <p class="text-gray-600 text-xs mt-3 font-mono break-all">{{ invoice.payment_link }}</p>
      </div>

      <!-- Footer -->
      <div class="border-t border-gray-200 pt-8 text-center">
        <p class="text-gray-400 text-xs">Thank you for your business.</p>
        <p class="text-gray-300 text-xs mt-1">Generated by ClientBase · Orderly Problem Solvers</p>
      </div>

    </div>
  </div>
</template>

<style>
@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  @page { margin: 20mm; }
}
</style>