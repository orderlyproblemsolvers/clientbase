<script setup lang="ts">
const client = useSupabaseClient()
const user = useSupabaseUser()

// --- State ---
const loading = ref(true)
const clients = ref<any[]>([])
const upcomingEvents = ref<any[]>([])
const searchQuery = ref('')
const showModal = ref(false)
const creating = ref(false)

// Categories List
const categories = ['Educational', 'Fintech', 'Internal', 'Development', 'Personal']

// Form Data
const newClient = ref({
  name: '',
  website: '',
  category: 'Development',
  contact_name: '',
  contact_email: '',
  contact_phone: ''
})

// --- Computed ---
const filteredClients = computed(() => {
  if (!searchQuery.value) return clients.value
  const query = searchQuery.value.toLowerCase()
  return clients.value.filter(c => 
    c.name.toLowerCase().includes(query) ||
    (c.website && c.website.toLowerCase().includes(query)) ||
    (c.category && c.category.toLowerCase().includes(query))
  )
})

// --- Actions ---
const fetchDashboardData = async () => {
  loading.value = true
  try {
    // 1. Fetch Clients
    const { data: clientData, error: clientError } = await client
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })

    if (clientError) throw clientError
    clients.value = clientData || []

    // 2. Fetch Upcoming Events
    const { data: eventData, error: eventError } = await client
      .from('events')
      .select('*, clients(id, name)')
      .gte('event_date', new Date().toISOString()) // Only future dates
      .eq('is_completed', false) // Only active tasks
      .order('event_date', { ascending: true }) // Soonest first
      .limit(4)

    if (eventError) console.error('Error fetching events:', eventError)
    upcomingEvents.value = eventData || []

  } catch (error) {
    console.error('Error loading dashboard:', error)
  } finally {
    loading.value = false
  }
}

const createClient = async () => {
  if (!newClient.value.name) return 
  creating.value = true
  try {
    const { error } = await client.from('clients').insert(newClient.value)
    if (error) throw error

    showModal.value = false
    // Reset form
    newClient.value = { 
      name: '', website: '', category: 'Development', 
      contact_name: '', contact_email: '', contact_phone: '' 
    } 
    await fetchDashboardData() 
  } catch (error: any) {
    alert('Error creating client: ' + error.message)
  } finally {
    creating.value = false
  }
}

const getDaysLeft = (dateStr: string) => {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 3600 * 24))
}

// Helper for category icons
const getCategoryIcon = (cat: string) => {
  switch(cat) {
    case 'Educational': return 'i-heroicons-academic-cap';
    case 'Fintech': return 'i-heroicons-banknotes';
    case 'Internal': return 'i-heroicons-building-office';
    case 'Personal': return 'i-heroicons-user';
    default: return 'i-heroicons-code-bracket';
  }
}

onMounted(() => {
  fetchDashboardData()
})
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div v-if="upcomingEvents.length > 0" class="max-w-7xl mx-auto mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
        Urgent Attention
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink 
          v-for="e in upcomingEvents" 
          :key="e.id"
          :to="`/clients/${e.clients.id}`"
          class="bg-secondary/40 border border-white/5 hover:bg-secondary hover:border-white/10 transition-all p-4 rounded-xl group relative overflow-hidden"
        >
          <div 
            :class="{
              'bg-red-500': e.event_type === 'deadline',
              'bg-orange-500': e.event_type === 'maintenance',
              'bg-blue-500': e.event_type === 'meeting'
            }"
            class="absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5"
          ></div>

          <div class="pl-3">
            <div class="flex justify-between items-start mb-2">
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <UIcon name="i-heroicons-building-office-2" class="w-3 h-3" />
                {{ e.clients.name }}
              </span>
              <span 
                :class="getDaysLeft(e.event_date) <= 3 ? 'text-red-400 font-bold' : 'text-primary'"
                class="text-xs bg-base px-2 py-0.5 rounded border border-white/5"
              >
                {{ getDaysLeft(e.event_date) }}d left
              </span>
            </div>
            
            <h4 class="text-white font-medium text-sm truncate pr-2 group-hover:text-primary transition-colors flex items-center gap-2">
              <UIcon v-if="e.event_type === 'deadline'" name="i-heroicons-clock" class="w-4 h-4 text-red-500" />
              <UIcon v-else-if="e.event_type === 'maintenance'" name="i-heroicons-wrench" class="w-4 h-4 text-orange-500" />
              <UIcon v-else name="i-heroicons-users" class="w-4 h-4 text-blue-500" />
              {{ e.title }}
            </h4>
            
            <p class="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
              <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
              {{ new Date(e.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </div>

    <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p class="text-gray-400 mt-1 text-sm">Manage your clients and secure keys.</p>
      </div>
      
      <div class="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
        <div class="relative w-full sm:w-64 group">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 group-focus-within:text-primary transition-colors" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search clients..." 
            class="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-gray-600"
          />
        </div>

        <button 
          @click="showModal = true"
          class="w-full sm:w-auto bg-primary hover:bg-[#3d34d9] text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          Add Client
        </button>
      </div>
    </div>

    <div v-if="loading" class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 3" :key="i" class="h-40 rounded-2xl bg-secondary border border-white/5 animate-pulse"></div>
    </div>

    <div v-else-if="filteredClients.length === 0" class="max-w-7xl mx-auto text-center py-20">
       <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
         <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 text-gray-600" />
       </div>
       <p class="text-gray-500">No matches found for "{{ searchQuery }}"</p>
    </div>

    <div v-else class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <NuxtLink 
        v-for="c in filteredClients" 
        :key="c.id"
        :to="`/clients/${c.id}`"
        class="group bg-secondary/40 hover:bg-secondary border border-white/5 hover:border-white/10 transition-all rounded-2xl p-6 cursor-pointer block relative overflow-hidden"
      >
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

        <div class="relative z-10 flex items-start justify-between mb-6">
          <div class="w-12 h-12 rounded-xl bg-base flex items-center justify-center text-xl font-bold text-white border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-300">
            {{ c.name.charAt(0).toUpperCase() }}
          </div>
          
          <span 
            :class="{
              'bg-blue-500/10 text-blue-400 border-blue-500/20': c.category === 'Educational',
              'bg-purple-500/10 text-purple-400 border-purple-500/20': c.category === 'Fintech',
              'bg-orange-500/10 text-orange-400 border-orange-500/20': c.category === 'Internal',
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': !c.category || c.category === 'Development',
              'bg-pink-500/10 text-pink-400 border-pink-500/20': c.category === 'Personal'
            }"
            class="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border tracking-wider flex items-center gap-1.5"
          >
            <UIcon :name="getCategoryIcon(c.category)" class="w-3 h-3" />
            {{ c.category || 'Dev' }}
          </span>
        </div>
        
        <div class="relative z-10">
          <h3 class="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
            {{ c.name }}
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
          </h3>
          <p class="text-sm text-gray-500 truncate flex items-center gap-1.5">
            <UIcon name="i-heroicons-globe-alt" class="w-3 h-3" />
            {{ c.website || 'No website linked' }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"></div>
      
      <div class="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-primary" />
            Add New Client
          </h2>
          <button @click="showModal = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="createClient" class="space-y-5">
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Client Name</label>
            <div class="relative">
               <UIcon name="i-heroicons-building-office-2" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input v-model="newClient.name" type="text" required class="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary placeholder-gray-700" placeholder="e.g. Acme Corp"/>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Category</label>
              <div class="relative">
                <select v-model="newClient.category" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary appearance-none cursor-pointer">
                  <option v-for="cat in categories" :key="cat" :value="cat" class="bg-secondary text-gray-300">{{ cat }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Website</label>
              <input v-model="newClient.website" type="url" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary placeholder-gray-700" placeholder="https://..."/>
            </div>
          </div>

          <div class="pt-4 mt-2 border-t border-white/5">
            <p class="text-[10px] uppercase font-bold text-primary tracking-widest mb-4 flex items-center gap-1">
              <UIcon name="i-heroicons-user-circle" class="w-4 h-4" />
              Primary Contact
            </p>
            <div class="space-y-3">
              <input v-model="newClient.contact_name" type="text" placeholder="Contact Name" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-700" />
              <div class="grid grid-cols-2 gap-3">
                <input v-model="newClient.contact_email" type="email" placeholder="Email Address" class="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-700" />
                <input v-model="newClient.contact_phone" type="tel" placeholder="Phone Number" class="bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none placeholder-gray-700" />
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button type="button" @click="showModal = false" class="flex-1 px-4 py-3 rounded-lg text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
            <button type="submit" :disabled="creating" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white px-4 py-3 rounded-lg font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2">
              <UIcon v-if="creating" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
              <span v-else>Create Client</span>
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>