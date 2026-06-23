<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const supabase = useSupabaseClient()
const id = route.params.id as string

const loading = ref(true)
const invoice = ref<any>(null)
const sender = ref<any>(null)          // fetched from profiles

const fetchInvoice = async () => {
  try {
    const { data, error } = await supabase
      .from('retainers')
      .select('*, clients(id, name, contact_name, contact_email, contact_phone, website), projects(id, name), invoice_items(*), invoice_payment_schedule(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    invoice.value = data

    // Fetch the user (sender) profile
    if (data.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, organization, avatar_url')
        .eq('id', data.user_id)
        .single()
      sender.value = profile
    }
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
  pending:   'Payment Due',
  paid:      'Paid',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
}

const statusBadgeClasses: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 ring-amber-600/20',
  paid:      'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  overdue:   'bg-rose-100 text-rose-700 ring-rose-600/20',
  cancelled: 'bg-slate-100 text-slate-700 ring-slate-600/20',
}

const senderName = computed(() =>
  sender.value?.full_name || 'Freelancer'
)
const senderOrg = computed(() =>
  sender.value?.organization || ''
)

const verificationUrl = computed(() =>
  `${window.location.origin}/verify/invoice/${invoice.value?.invoice_number}`
)

const printPage = () => {
  if (process.client) window.print()
}

const closePage = () => {
  if (process.client) window.close()
}

onMounted(() => fetchInvoice())
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans print:bg-white print:py-0 print:px-0">

    <div class="no-print fixed top-6 right-6 flex gap-3 z-50">
      <button
        @click="printPage"
        class="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-slate-900/20 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
      >
        <UIcon name="i-heroicons-printer" class="w-4 h-4" />
        Print / PDF
      </button>
      <button
        @click="closePage"
        class="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-slate-200"
      >
        Close
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center min-h-[80vh]">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-slate-400 animate-spin" />
        <span class="text-slate-500 font-medium">Loading invoice...</span>
      </div>
    </div>

    <div v-else-if="invoice" class="max-w-4xl mx-auto bg-white shadow-xl shadow-slate-200/50 rounded-3xl p-8 sm:p-12 print:shadow-none print:rounded-none print:p-0 print:max-w-none">

      <div class="flex flex-col sm:flex-row justify-between items-start gap-8 mb-10">
        <div class="flex flex-col">
          <NuxtImg
            src="/img/clientbase-main-min-no-bg.svg"
            alt="ClientBase"
            class="h-12 w-auto object-contain mb-6"
          />
          <h1 class="text-xl font-bold text-slate-900 tracking-tight">
            {{ senderOrg || senderName }}
          </h1>
          <p v-if="senderOrg && senderName" class="text-slate-500 text-sm mt-1">{{ senderName }}</p>
          <p class="text-xs font-medium text-slate-400 mt-2 uppercase tracking-wider">via ClientBase</p>
        </div>

        <div class="text-left sm:text-right flex flex-col sm:items-end">
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset mb-4"
            :class="statusBadgeClasses[invoice.status] || statusBadgeClasses['pending']"
          >
            {{ statusLabel[invoice.status] || 'Invoice' }}
          </span>
          <h2 class="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-1">Invoice Number</h2>
          <p class="text-slate-900 font-mono font-bold text-2xl tracking-tight">{{ invoice.invoice_number }}</p>
        </div>
      </div>

      <div class="bg-slate-50/80 rounded-2xl p-6 sm:p-8 mb-12 grid grid-cols-1 md:grid-cols-2 gap-8 border border-slate-100">
        <div>
          <h3 class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Billed To</h3>
          <p class="font-bold text-slate-900 text-lg mb-1">{{ invoice.clients?.name }}</p>
          <p v-if="invoice.clients?.contact_name" class="text-slate-600">{{ invoice.clients.contact_name }}</p>
          <div class="mt-3 space-y-1">
            <a v-if="invoice.clients?.contact_email" :href="`mailto:${invoice.clients.contact_email}`" class="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4" />
              {{ invoice.clients.contact_email }}
            </a>
            <p v-if="invoice.clients?.contact_phone" class="text-slate-500 text-sm flex items-center gap-2">
              <UIcon name="i-heroicons-phone" class="w-4 h-4" />
              {{ invoice.clients.contact_phone }}
            </p>
          </div>
        </div>

        <div class="space-y-4 md:text-right flex flex-col md:items-end justify-center">
          <div class="grid grid-cols-2 md:grid-cols-1 gap-x-4 gap-y-4 w-full md:w-auto">
            <div v-if="invoice.start_date" class="flex flex-col md:items-end">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Issue Date</span>
              <span class="text-slate-900 font-medium mt-1">{{ formatDate(invoice.start_date) }}</span>
            </div>
            <div v-if="invoice.due_date" class="flex flex-col md:items-end">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Due Date</span>
              <span class="font-semibold mt-1" :class="invoice.status === 'overdue' ? 'text-rose-600' : 'text-slate-900'">
                {{ formatDate(invoice.due_date) }}
              </span>
            </div>
            <div v-if="invoice.projects?.name" class="flex flex-col md:items-end col-span-2 md:col-span-1">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Project</span>
              <span class="text-slate-900 font-medium mt-1">{{ invoice.projects.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-8 pl-1">
        <h3 class="text-slate-900 font-bold text-xl">{{ invoice.title }}</h3>
        <p v-if="invoice.start_date && invoice.end_date" class="text-slate-500 text-sm mt-2 flex items-center gap-2">
          <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
          {{ formatDate(invoice.start_date) }} — {{ formatDate(invoice.end_date) }}
        </p>
      </div>

      <div v-if="invoice.invoice_items?.length" class="mb-12 overflow-x-auto">
        <table class="w-full text-left min-w-[600px]">
          <thead>
            <tr class="bg-slate-50/50 border-y border-slate-200">
              <th class="py-4 px-4 text-xs font-bold uppercase tracking-widest text-slate-500 rounded-l-lg">Description</th>
              <th class="py-4 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Qty</th>
              <th class="py-4 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Rate</th>
              <th class="py-4 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500 rounded-r-lg">Amount</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in invoice.invoice_items" :key="item.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="py-5 px-4 text-slate-900 font-medium">{{ item.description }}</td>
              <td class="py-5 px-4 text-right text-slate-600">{{ item.quantity }}</td>
              <td class="py-5 px-4 text-right text-slate-600 font-mono">{{ formatCurrency(item.unit_rate, invoice.currency) }}</td>
              <td class="py-5 px-4 text-right text-slate-900 font-mono font-semibold">{{ formatCurrency(item.quantity * item.unit_rate, invoice.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="invoice.invoice_payment_schedule?.length" class="mb-12">
        <h3 class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 pl-1">Payment Schedule</h3>
        <div class="overflow-x-auto border border-slate-200 rounded-xl">
          <table class="w-full min-w-[600px]">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="py-3 px-4 text-left text-xs font-bold uppercase tracking-widest text-slate-500">Installment</th>
                <th class="py-3 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">%</th>
                <th class="py-3 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Due</th>
                <th class="py-3 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Amount</th>
                <th class="py-3 px-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr 
                v-for="inst in invoice.invoice_payment_schedule.sort((a: any, b: any) => a.position - b.position)" 
                :key="inst.id"
              >
                <td class="py-3 px-4 text-slate-900 font-medium">{{ inst.label }}</td>
                <td class="py-3 px-4 text-right text-slate-500">{{ inst.percentage }}%</td>
                <td class="py-3 px-4 text-right text-slate-500">{{ inst.due_date ? formatDate(inst.due_date) : '—' }}</td>
                <td class="py-3 px-4 text-right font-mono font-semibold text-slate-900">{{ formatCurrency(inst.amount, invoice.currency) }}</td>
                <td class="py-3 px-4 text-right">
                  <span
                    class="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wider"
                    :class="inst.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                  >
                    {{ inst.status === 'paid' ? 'Paid' : 'Pending' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex justify-end mb-12 pl-1">
        <div class="w-full sm:w-80 bg-slate-50 rounded-2xl p-6 border border-slate-100">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-bold uppercase tracking-widest text-slate-500">Total Due</span>
            <span class="text-3xl font-black text-slate-900 font-mono tracking-tight">{{ formatCurrency(invoiceTotal, invoice.currency) }}</span>
          </div>
          <div v-if="invoice.status === 'paid'" class="flex justify-between items-center pt-4 mt-4 border-t border-slate-200 text-emerald-600">
            <span class="font-semibold text-sm flex items-center gap-1.5">
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
              Paid {{ invoice.paid_at ? formatDate(invoice.paid_at.split('T')[0]) : '' }}
            </span>
            <span class="font-bold font-mono">{{ formatCurrency(invoiceTotal, invoice.currency) }}</span>
          </div>
        </div>
      </div>

      <div v-if="invoice.notes" class="mb-10 pl-1">
        <h3 class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Notes</h3>
        <p class="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{{ invoice.notes }}</p>
      </div>

      <div v-if="invoice.payment_link && invoice.status !== 'paid'" class="no-print bg-slate-900 rounded-2xl p-8 text-center mb-10 shadow-xl shadow-slate-900/10">
        <h3 class="text-white font-semibold text-lg mb-2">Pay online securely</h3>
        <p class="text-slate-400 text-sm mb-6">Complete your payment using our secure processing partner.</p>
        <a
          :href="invoice.payment_link"
          target="_blank"
          class="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-8 py-3.5 rounded-xl text-sm hover:bg-slate-50 transition-colors focus:ring-4 focus:ring-slate-500"
        >
          Proceed to Payment
          <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
        </a>
        <div class="mt-4 flex justify-center text-slate-500">
          <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 mr-1.5" />
          <span class="text-xs">Secure SSL Encrypted Connection</span>
        </div>
      </div>

      <div class="mt-16 pt-8 border-t border-slate-200 text-center space-y-4">
        <div class="flex items-center justify-center gap-2 text-sm text-slate-500">
          <UIcon name="i-heroicons-shield-check-solid" class="w-5 h-5 text-emerald-500" />
          <span>
            <strong class="text-slate-700 font-semibold">Authentic invoice</strong> issued by {{ senderOrg || senderName }}
          </span>
        </div>
        <p class="text-slate-400 text-xs font-medium uppercase tracking-widest">
          Powered by ClientBase
        </p>
      </div>

    </div>
  </div>
</template>

<style>
@media print {
  .no-print { display: none !important; }
  body { 
    background: white !important; 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact; 
  }
  @page { margin: 15mm; }
}
</style>