<script setup lang="ts">
const client = useSupabaseClient()

// --- State ---
const loading = ref(true)
// Initialize as empty array to prevent immediate render errors
const retainers = ref<any[]>([]) 
const clients = ref<any[]>([])
const showModal = ref(false)
const searchQuery = ref('')
const filterStatus = ref('all') // 'all', 'pending', 'paid', 'overdue'

// Toast State
const toast = ref({ show: false, message: '', type: 'success' })

// Form State
const saving = ref(false)
const newRetainer = ref({
  client_id: '',
  title: '',
  amount: 0,
  currency: 'NGN',
  status: 'pending',
  start_date: new Date().toISOString().split('T')[0], // Default to today
  end_date: ''
})

// --- Computed Logic ---

const filteredRetainers = computed(() => {
  // Safe check: ensure it's an array before filtering
  if (!Array.isArray(retainers.value)) return []

  return retainers.value.filter(r => {
    const matchesSearch = 
      r.clients?.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
      r.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    const matchesStatus = filterStatus.value === 'all' || r.status === filterStatus.value
    
    return matchesSearch && matchesStatus
  })
})

const totalRevenue = computed(() => {
  if (!Array.isArray(retainers.value)) return 0
  return retainers.value
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + Number(curr.amount), 0)
})

const pendingCount = computed(() => {
  if (!Array.isArray(retainers.value)) return 0
  return retainers.value.filter(r => r.status === 'pending').length
})

const activeClientsCount = computed(() => {
  // 🔥 FIX: Prevent crash if retainers is null
  if (!Array.isArray(retainers.value)) return 0
  return new Set(retainers.value.map(r => r.client_id)).size
})

// --- Actions ---

const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const fetchData = async () => {
  loading.value = true
  try {
    // 1. Fetch Retainers with Client Name
    const { data: rData, error: rError } = await client
      .from('retainers')
      .select('*, clients(name)')
      .order('end_date', { ascending: false })
    
    if (rError) throw rError
    
    // 🔥 FIX: Default to empty array if data is null
    retainers.value = rData || []

    // 2. Fetch Client List for Dropdown
    const { data: cData, error: cError } = await client
      .from('clients')
      .select('id, name')
      .order('name')
      
    if (cError) throw cError
    clients.value = cData || []
  } catch (e: any) {
    console.error('Fetch Error:', e)
    showToast('Failed to load data', 'error')
    retainers.value = [] // Fallback to safe state
  } finally {
    loading.value = false
  }
}

const createRetainer = async () => {
  if (!newRetainer.value.client_id || !newRetainer.value.amount) return
  
  saving.value = true
  try {
    const { error } = await client.from('retainers').insert(newRetainer.value)
    if (error) throw error

    showModal.value = false
    // Reset form
    newRetainer.value = { 
      client_id: '', title: '', amount: 0, currency: 'NGN', status: 'pending', 
      start_date: new Date().toISOString().split('T')[0], end_date: '' 
    }
    await fetchData()
    showToast('Invoice created successfully!')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

const updateStatus = async (id: string, status: string) => {
  // Optimistic Update
  const originalIndex = retainers.value.findIndex(r => r.id === id)
  if (originalIndex === -1) return
  
  const originalStatus = retainers.value[originalIndex].status
  retainers.value[originalIndex].status = status

  try {
    const { error } = await client.from('retainers').update({ status }).eq('id', id)
    if (error) throw error
    showToast('Status updated!')
  } catch (e) {
    retainers.value[originalIndex].status = originalStatus // Revert
    showToast('Failed to update status', 'error')
  }
}

const deleteRetainer = async (id: string) => {
  if (!confirm('Delete this invoice record permanently?')) return
  
  try {
    const { error } = await client.from('retainers').delete().eq('id', id)
    if (error) throw error
    
    retainers.value = retainers.value.filter(r => r.id !== id)
    showToast('Invoice deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)
}

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div class="max-w-6xl mx-auto mb-8">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <UIcon name="i-heroicons-banknotes" class="w-8 h-8 text-primary" />
             Billing & Retainers
          </h1>
          <p class="text-gray-400 mt-2 text-sm max-w-lg">Manage monthly support contracts, project fees, and track your revenue stream.</p>
        </div>
        <button 
          @click="showModal = true" 
          class="bg-primary hover:bg-[#3d34d9] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group"
        >
          <div class="bg-white/20 p-1 rounded-full group-hover:scale-110 transition-transform">
             <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          </div>
          Create Invoice
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-secondary/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <UIcon name="i-heroicons-currency-dollar" class="w-24 h-24 text-green-500" />
          </div>
          <p class="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Total Revenue (YTD)</p>
          <p class="text-3xl font-bold text-white tracking-tight">{{ formatCurrency(totalRevenue, 'NGN') }}</p>
        </div>

        <button @click="filterStatus = 'pending'" class="bg-secondary/50 border border-white/5 p-6 rounded-2xl text-left hover:bg-white/5 transition-all relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
             <UIcon name="i-heroicons-clock" class="w-24 h-24 text-orange-500" />
          </div>
          <p class="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2 group-hover:text-orange-400 transition-colors">Pending Invoices</p>
          <p class="text-3xl font-bold text-orange-400">{{ pendingCount }}</p>
        </button>

        <div class="bg-secondary/50 border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
             <UIcon name="i-heroicons-users" class="w-24 h-24 text-primary" />
          </div>
          <p class="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Active Clients</p>
          <p class="text-3xl font-bold text-primary">{{ activeClientsCount }}</p>
        </div>
      </div>

      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <div class="relative flex-1">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search clients or descriptions..." 
            class="w-full bg-secondary border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        <div class="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <button 
            v-for="status in ['all', 'pending', 'paid', 'overdue']" 
            :key="status"
            @click="filterStatus = status"
            class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap"
            :class="filterStatus === status 
              ? 'bg-white text-secondary border-white' 
              : 'bg-secondary text-gray-400 border-white/5 hover:border-white/20 hover:text-white'"
          >
            {{ status }}
          </button>
        </div>
      </div>

      <div class="bg-secondary border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest border-b border-white/5">
              <tr>
                <th class="p-5 font-bold">Client / Description</th>
                <th class="p-5 font-bold">Billing Period</th>
                <th class="p-5 font-bold">Amount</th>
                <th class="p-5 font-bold">Status</th>
                <th class="p-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              
              <template v-if="loading">
                <tr v-for="i in 5" :key="i" class="animate-pulse">
                  <td class="p-5"><div class="h-4 w-32 bg-white/5 rounded mb-2"></div><div class="h-3 w-20 bg-white/5 rounded"></div></td>
                  <td class="p-5"><div class="h-4 w-24 bg-white/5 rounded"></div></td>
                  <td class="p-5"><div class="h-4 w-16 bg-white/5 rounded"></div></td>
                  <td class="p-5"><div class="h-6 w-16 bg-white/5 rounded-full"></div></td>
                  <td class="p-5 text-right"><div class="h-8 w-8 bg-white/5 rounded inline-block"></div></td>
                </tr>
              </template>

              <tr v-else-if="filteredRetainers.length === 0">
                <td colspan="5" class="py-20 text-center">
                  <div class="flex flex-col items-center justify-center">
                    <div class="bg-white/5 p-4 rounded-full mb-4">
                      <UIcon name="i-heroicons-document-magnifying-glass" class="w-8 h-8 text-gray-500" />
                    </div>
                    <p class="text-white font-bold text-lg">No invoices found</p>
                    <p class="text-gray-500 text-sm mt-1 mb-6">Try adjusting your filters or create a new invoice.</p>
                    <button @click="showModal = true" class="text-primary hover:text-white text-sm font-bold transition-colors">
                      + Create New Invoice
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-else v-for="r in filteredRetainers" :key="r.id" class="hover:bg-white/5 transition-colors group">
                <td class="p-5">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      {{ r.clients?.name?.charAt(0) || '?' }}
                    </div>
                    <div>
                      <div class="font-bold text-white">{{ r.clients?.name || 'Unknown Client' }}</div>
                      <div class="text-xs text-gray-500">{{ r.title }}</div>
                    </div>
                  </div>
                </td>
                <td class="p-5">
                  <div class="flex items-center gap-2 text-sm text-gray-400">
                    <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                    {{ new Date(r.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }} 
                    <span class="text-gray-600">→</span>
                    {{ new Date(r.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }}
                  </div>
                </td>
                <td class="p-5 font-mono text-white font-medium">
                  {{ formatCurrency(r.amount, r.currency) }}
                </td>
                <td class="p-5">
                  <span 
                    :class="{
                      'bg-green-500/10 text-green-400 border-green-500/20': r.status === 'paid',
                      'bg-orange-500/10 text-orange-400 border-orange-500/20': r.status === 'pending',
                      'bg-red-500/10 text-red-400 border-red-500/20': r.status === 'overdue'
                    }"
                    class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border flex w-fit items-center gap-1.5"
                  >
                    <div class="w-1.5 h-1.5 rounded-full" :class="{
                      'bg-green-400': r.status === 'paid',
                      'bg-orange-400': r.status === 'pending',
                      'bg-red-400': r.status === 'overdue'
                    }"></div>
                    {{ r.status }}
                  </span>
                </td>
                <td class="p-5 text-right">
                  <div class="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      v-if="r.status !== 'paid'" 
                      @click="updateStatus(r.id, 'paid')" 
                      class="text-xs bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white px-3 py-1.5 rounded-lg transition-all font-bold"
                    >
                      Mark Paid
                    </button>
                    <button 
                      @click="deleteRetainer(r.id)" 
                      class="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                      title="Delete Invoice"
                    >
                      <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div @click="showModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        
        <div class="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <UIcon name="i-heroicons-document-plus" class="w-5 h-5 text-primary" />
              Create New Invoice
            </h2>
            <button @click="showModal = false" class="text-gray-400 hover:text-white">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <form @submit.prevent="createRetainer" class="p-6 overflow-y-auto space-y-6">
            
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Select Client</label>
              <div class="relative">
                <select v-model="newRetainer.client_id" required class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                  <option value="" disabled>Choose a client...</option>
                  <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Invoice Description</label>
              <input v-model="newRetainer.title" type="text" placeholder="e.g. Q1 2026 Monthly Retainer" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-600"/>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Amount (NGN)</label>
                <input v-model="newRetainer.amount" type="number" min="0" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"/>
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Status</label>
                <div class="relative">
                  <select v-model="newRetainer.status" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <UIcon name="i-heroicons-chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Start Date</label>
                <input v-model="newRetainer.start_date" type="date" required class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"/>
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">End Date</label>
                <input v-model="newRetainer.end_date" type="date" required class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"/>
              </div>
            </div>

            <div class="pt-4 flex gap-3">
              <button type="button" @click="showModal = false" class="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 font-bold transition-all">Cancel</button>
              <button type="submit" :disabled="saving" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
                {{ saving ? 'Creating...' : 'Create Invoice' }}
              </button>
            </div>

          </form>
        </div>
      </div>
    </Transition>

    <Transition enter-active-class="transform ease-out duration-300 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0f172a] border-green-500/50 text-green-400' : 'bg-[#0f172a] border-red-500/50 text-red-400'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" />
          <span class="font-bold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>

  </div>
</template>