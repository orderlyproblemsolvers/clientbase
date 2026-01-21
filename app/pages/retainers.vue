<script setup lang="ts">
const client = useSupabaseClient()
const loading = ref(true)

// --- State ---
const retainers = ref<any[]>([])
const clients = ref<any[]>([]) // For the dropdown in modal
const showModal = ref(false)

// Form State
const newRetainer = ref({
  client_id: '',
  title: '',
  amount: 0,
  currency: 'NGN',
  status: 'pending',
  start_date: '',
  end_date: ''
})

// --- Computed Stats ---
const totalRevenue = computed(() => {
  return retainers.value
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + Number(curr.amount), 0)
})

const pendingCount = computed(() => retainers.value.filter(r => r.status === 'pending').length)

// --- Actions ---
const fetchData = async () => {
  loading.value = true
  
  // 1. Fetch Retainers with Client Name
  const { data: rData } = await client
    .from('retainers')
    .select('*, clients(name)')
    .order('end_date', { ascending: false })
  
  retainers.value = rData || []

  // 2. Fetch Client List for Dropdown
  const { data: cData } = await client.from('clients').select('id, name').order('name')
  clients.value = cData || []
  
  loading.value = false
}

const createRetainer = async () => {
  if (!newRetainer.value.client_id || !newRetainer.value.amount) return
  
  const { error } = await client.from('retainers').insert(newRetainer.value)
  
  if (!error) {
    showModal.value = false
    // Reset form defaults
    newRetainer.value = { client_id: '', title: '', amount: 0, currency: 'NGN', status: 'pending', start_date: '', end_date: '' }
    fetchData()
  } else {
    alert(error.message)
  }
}

const updateStatus = async (id: string, status: string) => {
  await client.from('retainers').update({ status }).eq('id', id)
  fetchData() // Refresh to update stats
}

const deleteRetainer = async (id: string) => {
  if (!confirm('Delete this invoice record?')) return
  await client.from('retainers').delete().eq('id', id)
  fetchData()
}

// Utility for currency formatting
const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)
}

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div class="max-w-6xl mx-auto mb-10">
      <div class="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-white tracking-tight">Billing & Retainers</h1>
          <p class="text-gray-400 mt-1">Track monthly support contracts and project fees.</p>
        </div>
        <button 
          @click="showModal = true" 
          class="bg-primary hover:bg-[#3d34d9] text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          New Invoice
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-secondary/50 border border-white/5 p-6 rounded-2xl">
          <p class="text-gray-500 text-xs uppercase font-bold tracking-widest mb-2">Total Collected (YTD)</p>
          <p class="text-2xl font-bold text-white">{{ formatCurrency(totalRevenue, 'NGN') }}</p>
        </div>
        <div class="bg-secondary/50 border border-white/5 p-6 rounded-2xl">
          <p class="text-gray-500 text-xs uppercase font-bold tracking-widest mb-2">Pending Invoices</p>
          <p class="text-2xl font-bold text-orange-400">{{ pendingCount }}</p>
        </div>
        <div class="bg-secondary/50 border border-white/5 p-6 rounded-2xl">
          <p class="text-gray-500 text-xs uppercase font-bold tracking-widest mb-2">Active Clients</p>
          <p class="text-2xl font-bold text-primary">{{ new Set(retainers.map(r => r.client_id)).size }}</p>
        </div>
      </div>

      <div class="bg-secondary border border-white/5 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-white/5 text-gray-400 text-xs uppercase tracking-widest">
              <tr>
                <th class="p-5">Client / Description</th>
                <th class="p-5">Period</th>
                <th class="p-5">Amount</th>
                <th class="p-5">Status</th>
                <th class="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              <tr v-for="r in retainers" :key="r.id" class="hover:bg-white/5 transition-colors group">
                <td class="p-5">
                  <div class="font-bold text-white">{{ r.clients.name }}</div>
                  <div class="text-xs text-gray-500">{{ r.title }}</div>
                </td>
                <td class="p-5 text-sm text-gray-300">
                  {{ new Date(r.start_date).toLocaleDateString() }} — {{ new Date(r.end_date).toLocaleDateString() }}
                </td>
                <td class="p-5 font-mono text-white">
                  {{ formatCurrency(r.amount, r.currency) }}
                </td>
                <td class="p-5">
                  <span 
                    :class="{
                      'bg-green-500/10 text-green-400 border-green-500/20': r.status === 'paid',
                      'bg-orange-500/10 text-orange-400 border-orange-500/20': r.status === 'pending',
                      'bg-red-500/10 text-red-400 border-red-500/20': r.status === 'overdue'
                    }"
                    class="px-2 py-1 rounded text-[10px] uppercase font-bold border"
                  >
                    {{ r.status }}
                  </span>
                </td>
                <td class="p-5 text-right flex justify-end gap-2">
                  <button 
                    v-if="r.status !== 'paid'" 
                    @click="updateStatus(r.id, 'paid')" 
                    class="text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 px-3 py-1.5 rounded transition-colors"
                  >
                    Mark Paid
                  </button>
                  <button 
                    @click="deleteRetainer(r.id)" 
                    class="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors"
                    title="Delete"
                  >
                    <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="retainers.length === 0 && !loading">
                <td colspan="5" class="p-10 text-center text-gray-500">No invoices recorded yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-lg bg-secondary border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h2 class="text-xl font-bold text-white mb-6">Create New Invoice</h2>
        <form @submit.prevent="createRetainer" class="space-y-4">
          
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Client</label>
            <div class="relative">
              <select v-model="newRetainer.client_id" required class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                <option value="" disabled>Select a client</option>
                <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>

          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Description</label>
            <input v-model="newRetainer.title" type="text" placeholder="e.g. Q1 2026 Server Maintenance" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"/>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Amount</label>
              <input v-model="newRetainer.amount" type="number" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"/>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Status</label>
              <div class="relative">
                <select v-model="newRetainer.status" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Start Date</label>
              <input v-model="newRetainer.start_date" type="date" required class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"/>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">End Date</label>
              <input v-model="newRetainer.end_date" type="date" required class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"/>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button type="button" @click="showModal = false" class="flex-1 text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" class="flex-1 bg-primary text-white py-3 rounded-lg font-bold">Save Invoice</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>