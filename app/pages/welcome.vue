<script setup lang="ts">
definePageMeta({
  layout: 'empty'
})

const user = useSupabaseUser()

// --- State ---
const activeFeature = ref('dashboard')

// --- Scroll Handler ---
const scrollToDemo = () => {
  const el = document.getElementById('interactive-demo')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

// --- Features Config ---
const features = [
  {
    id: 'dashboard',
    label: 'Client Dashboard',
    icon: 'i-heroicons-squares-2x2',
    desc: 'Manage all your clients in one place.'
  },
  {
    id: 'library',
    label: 'Code Library',
    icon: 'i-heroicons-code-bracket',
    desc: 'Store and reuse code snippets.'
  },
  {
    id: 'secrets',
    label: 'Secrets Vault',
    icon: 'i-heroicons-lock-closed',
    desc: 'Securely store API keys and credentials.'
  },
  {
    id: 'retainers',
    label: 'Billing & Retainers',
    icon: 'i-heroicons-banknotes',
    desc: 'Track invoices and payments.'
  }
]

// ==================== DASHBOARD STATE ====================
const clients = ref([
  { id: 1, name: 'Acme Corp', category: 'Development', website: 'acme.com', avatar: 'A' },
  { id: 2, name: 'TechStart', category: 'Fintech', website: 'techstart.io', avatar: 'T' },
  { id: 3, name: 'EduLearn', category: 'Educational', website: 'edulearn.com', avatar: 'E' }
])
const showClientModal = ref(false)
const newClientName = ref('')
const newClientWebsite = ref('')

const addClient = () => {
  if (!newClientName.value.trim()) return
  clients.value.push({
    id: Date.now(),
    name: newClientName.value,
    category: 'Development',
    website: newClientWebsite.value || `${newClientName.value.toLowerCase().replace(/\s+/g, '')}.com`,
    avatar: newClientName.value.charAt(0).toUpperCase()
  })
  newClientName.value = ''
  newClientWebsite.value = ''
  showClientModal.value = false
}

const deleteClient = (id: number) => {
  clients.value = clients.value.filter(c => c.id !== id)
}

// ==================== CODE LIBRARY STATE ====================
const snippets = ref([
  { 
    id: 1, 
    title: 'useUserProfile', 
    language: 'typescript',
    description: 'Composable for user profile state',
    code: `export const useUserProfile = () => {
  const user = useSupabaseUser()
  return useState('profile', () => ({
    name: user.value?.email,
    role: 'Developer'
  }))
}`
  },
  {
    id: 2,
    title: 'fetchClients',
    language: 'typescript',
    description: 'Async function to fetch all clients',
    code: `const fetchClients = async () => {
  const { data } = await client
    .from('clients')
    .select('*')
  return data
}`
  }
])

const showSnippetModal = ref(false)
const showSnippetView = ref(false)
const activeSnippet = ref<any>(null)
const newSnippet = ref({ title: '', language: 'typescript', description: '', code: '' })
const copiedSnippet = ref<number | null>(null)

const addSnippet = () => {
  if (!newSnippet.value.title || !newSnippet.value.code) return
  snippets.value.unshift({
    id: Date.now(),
    ...newSnippet.value
  })
  newSnippet.value = { title: '', language: 'typescript', description: '', code: '' }
  showSnippetModal.value = false
}

const viewSnippet = (snippet: any) => {
  activeSnippet.value = snippet
  showSnippetView.value = true
}

const deleteSnippet = (id: number) => {
  snippets.value = snippets.value.filter(s => s.id !== id)
  if (activeSnippet.value?.id === id) {
    showSnippetView.value = false
    activeSnippet.value = null
  }
}

const copySnippetCode = (id: number, code: string) => {
  navigator.clipboard.writeText(code)
  copiedSnippet.value = id
  setTimeout(() => copiedSnippet.value = null, 2000)
}

// ==================== SECRETS VAULT STATE ====================
const secrets = ref([
  { id: 1, name: 'STRIPE_KEY', value: 'sk_test_4eC39HqLyjWDarjtT1zdp7dc', revealed: false },
  { id: 2, name: 'DATABASE_URL', value: 'postgresql://user:pass@localhost:5432/db', revealed: false }
])

const showSecretModal = ref(false)
const newSecret = ref({ name: '', value: '' })
const copiedSecret = ref<number | null>(null)

const addSecret = () => {
  if (!newSecret.value.name || !newSecret.value.value) return
  secrets.value.push({
    id: Date.now(),
    name: newSecret.value.name,
    value: newSecret.value.value,
    revealed: false
  })
  newSecret.value = { name: '', value: '' }
  showSecretModal.value = false
}

const toggleSecretReveal = (id: number) => {
  const secret = secrets.value.find(s => s.id === id)
  if (secret) secret.revealed = !secret.revealed
}

const copySecret = (id: number, value: string) => {
  navigator.clipboard.writeText(value)
  copiedSecret.value = id
  setTimeout(() => copiedSecret.value = null, 2000)
}

const deleteSecret = (id: number) => {
  secrets.value = secrets.value.filter(s => s.id !== id)
}

// ==================== RETAINERS STATE ====================
const retainers = ref([
  { id: 1, client: 'Acme Corp', title: 'Q1 2026 Maintenance', amount: 450000, status: 'paid', currency: 'NGN' },
  { id: 2, client: 'TechStart', title: 'App Development', amount: 850000, status: 'pending', currency: 'NGN' }
])

const showRetainerModal = ref(false)
const newRetainer = ref({ client: '', title: '', amount: 0, status: 'pending' })

const addRetainer = () => {
  if (!newRetainer.value.client || !newRetainer.value.amount) return
  retainers.value.push({
    id: Date.now(),
    client: newRetainer.value.client,
    title: newRetainer.value.title,
    amount: newRetainer.value.amount,
    status: newRetainer.value.status,
    currency: 'NGN'
  })
  newRetainer.value = { client: '', title: '', amount: 0, status: 'pending' }
  showRetainerModal.value = false
}

const updateRetainerStatus = (id: number, status: string) => {
  const retainer = retainers.value.find(r => r.id === id)
  if (retainer) retainer.status = status
}

const deleteRetainer = (id: number) => {
  retainers.value = retainers.value.filter(r => r.id !== id)
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount)
}

const totalRevenue = computed(() => {
  return retainers.value
    .filter(r => r.status === 'paid')
    .reduce((acc, curr) => acc + curr.amount, 0)
})

const pendingCount = computed(() => retainers.value.filter(r => r.status === 'pending').length)
</script>

<template>
  <div class="min-h-screen bg-[#0B0E14] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
    
    <!-- Navigation -->
    <nav class="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0B0E14]/80 backdrop-blur-md">
      <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/img/clientbaselogo-white.png" alt="Client Base OPS" class="hidden md:inline-flex lg:inline-flex h-16 w-auto object-contain" />
          <img src="/img/clientbaselogo-min.png" alt="Client Base OPS" class="md:hidden lg:hidden h-12 w-auto object-cover" />
        </div>

        <div class="flex items-center gap-4">
          <template v-if="user">
             <NuxtLink to="/" class="px-6 py-2 rounded-full bg-white text-black font-bold text-sm hover:scale-105 transition-transform">
              Go to Dashboard
            </NuxtLink>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="text-sm font-medium text-gray-400 hover:text-white transition-colors">Sign In</NuxtLink>
            <NuxtLink to="/signup" class="px-6 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20">
              Get Started
            </NuxtLink>
          </template>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative pt-40 pb-20 lg:pt-52 lg:pb-32 overflow-hidden">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] -z-10 opacity-40"></div>
      
      <div class="max-w-7xl mx-auto px-6 text-center">

        
        <h1 class="text-5xl lg:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent">
          The Operating System <br class="hidden lg:block" />
          for <span class="text-indigo-500">Modern Dev Agencies</span>.
        </h1>
        
        <p class="text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Manage clients, store code snippets, secure API keys, and track billing from a single, high-performance dashboard.
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <NuxtLink 
            to="/signup"
            class="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-all shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2"
          >
            Start Building Free
            <UIcon name="i-heroicons-arrow-right" class="w-5 h-5" />
          </NuxtLink>
          
          <button 
            @click="scrollToDemo"
            class="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-lg transition-all"
          >
            Try Interactive Demo
          </button>
        </div>
      </div>
    </section>

    <!-- Interactive Demo Section -->
    <section id="interactive-demo" class="py-24 bg-[#0F1219] border-y border-white/5 scroll-mt-24">
      <div class="max-w-7xl mx-auto px-6">
        
        <div class="text-center mb-16">
          <h2 class="text-3xl lg:text-4xl font-bold mb-4">Try it yourself - Click, Add, Delete!</h2>
          <p class="text-gray-400">Fully interactive demo. Your changes stay in this session.</p>
        </div>

        <div class="grid lg:grid-cols-12 gap-8 lg:gap-12">
          
          <!-- Feature Tabs -->
          <div class="lg:col-span-4 space-y-4">
            <button 
              v-for="feature in features" 
              :key="feature.id"
              @click="activeFeature = feature.id"
              class="w-full text-left p-6 rounded-2xl border transition-all duration-300 group relative overflow-hidden"
              :class="activeFeature === feature.id ? 'bg-white/5 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-transparent border-white/5 hover:bg-white/5 hover:border-white/10'"
            >
              <div class="flex items-center gap-4">
                <div 
                  class="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                  :class="activeFeature === feature.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-gray-400 group-hover:text-white'"
                >
                  <UIcon :name="feature.icon" class="w-6 h-6" />
                </div>
                <div>
                  <h3 class="font-bold text-white">{{ feature.label }}</h3>
                  <p class="text-xs text-gray-500 mt-1">{{ feature.desc }}</p>
                </div>
              </div>
            </button>
          </div>

          <!-- Interactive Window -->
          <div class="lg:col-span-8 bg-[#0B0E14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-h-[550px] flex flex-col">
            
            <!-- Window Header -->
            <div class="h-10 bg-white/5 border-b border-white/5 flex items-center px-4 gap-2 flex-none">
              <div class="w-3 h-3 rounded-full bg-red-500/50"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-500/50"></div>
              <div class="w-3 h-3 rounded-full bg-green-500/50"></div>
              <div class="ml-4 px-3 py-0.5 rounded-full bg-black/40 text-[10px] text-gray-500 font-mono">
                ops-system://{{ activeFeature }}
              </div>
            </div>

            <!-- Content Area -->
            <div class="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar">
              
              <Transition mode="out-in" name="fade">
                
                <!-- DASHBOARD VIEW -->
                <div v-if="activeFeature === 'dashboard'" class="space-y-4">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">My Clients</h3>
                    <button @click="showClientModal = true" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                      <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                      Add Client
                    </button>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div v-for="client in clients" :key="client.id" class="bg-[#151921] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all group">
                      <div class="flex items-start justify-between mb-3">
                        <div class="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                          {{ client.avatar }}
                        </div>
                        <button @click="deleteClient(client.id)" class="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded text-gray-500 hover:text-red-400 transition-all">
                          <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                        </button>
                      </div>
                      <h4 class="font-bold text-white mb-1">{{ client.name }}</h4>
                      <p class="text-xs text-gray-500 flex items-center gap-1">
                        <UIcon name="i-heroicons-globe-alt" class="w-3 h-3" />
                        {{ client.website }}
                      </p>
                      <span class="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {{ client.category }}
                      </span>
                    </div>
                  </div>

                  <div v-if="clients.length === 0" class="text-center py-12 text-gray-500">
                    <UIcon name="i-heroicons-building-office-2" class="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No clients yet. Add one to get started!</p>
                  </div>
                </div>

                <!-- CODE LIBRARY VIEW -->
                <div v-else-if="activeFeature === 'library'" class="space-y-4">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">Code Snippets</h3>
                    <button @click="showSnippetModal = true" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                      <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                      New Snippet
                    </button>
                  </div>

                  <div class="space-y-3">
                    <div v-for="snippet in snippets" :key="snippet.id" class="bg-[#151921] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all group">
                      <div class="p-4 flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                          <h4 class="font-bold text-white mb-1">{{ snippet.title }}</h4>
                          <p class="text-xs text-gray-500 mb-2">{{ snippet.description }}</p>
                          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {{ snippet.language }}
                          </span>
                        </div>
                        <div class="flex gap-1 ml-2">
                          <button @click="viewSnippet(snippet)" class="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-all">
                            <UIcon name="i-heroicons-arrows-pointing-out" class="w-4 h-4" />
                          </button>
                          <button @click="copySnippetCode(snippet.id, snippet.code)" class="p-1.5 hover:bg-white/10 rounded transition-all" :class="copiedSnippet === snippet.id ? 'text-green-400' : 'text-gray-400 hover:text-white'">
                            <UIcon :name="copiedSnippet === snippet.id ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-4 h-4" />
                          </button>
                          <button @click="deleteSnippet(snippet.id)" class="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400 transition-all">
                            <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div class="bg-[#0d1117] p-3 border-t border-white/5">
                        <pre class="text-xs text-gray-400 font-mono overflow-x-auto">{{ snippet.code.split('\n').slice(0, 3).join('\n') }}...</pre>
                      </div>
                    </div>
                  </div>

                  <div v-if="snippets.length === 0" class="text-center py-12 text-gray-500">
                    <UIcon name="i-heroicons-code-bracket" class="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No snippets saved. Create your first one!</p>
                  </div>
                </div>

                <!-- SECRETS VAULT VIEW -->
                <div v-else-if="activeFeature === 'secrets'" class="space-y-4">
                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">Secrets Vault</h3>
                    <button @click="showSecretModal = true" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                      <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                      Add Secret
                    </button>
                  </div>

                  <div class="space-y-3">
                    <div v-for="secret in secrets" :key="secret.id" class="bg-[#151921] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
                      <div class="flex items-center gap-3 mb-3">
                        <UIcon name="i-heroicons-key" class="w-4 h-4 text-yellow-500" />
                        <span class="font-bold text-white">{{ secret.name }}</span>
                      </div>
                      
                      <div class="relative bg-[#0d1117] rounded-lg p-3 mb-3">
                        <button @click="toggleSecretReveal(secret.id)" class="w-full text-left font-mono text-sm">
                          <span :class="!secret.revealed ? 'blur-sm select-none' : ''" class="transition-all">
                            {{ secret.revealed ? secret.value : '••••••••••••••••••••••••' }}
                          </span>
                        </button>
                      </div>

                      <div class="flex gap-2">
                        <button @click="toggleSecretReveal(secret.id)" class="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-2">
                          <UIcon :name="secret.revealed ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
                          {{ secret.revealed ? 'Hide' : 'Reveal' }}
                        </button>
                        <button @click="copySecret(secret.id, secret.value)" class="flex-1 bg-white/5 hover:bg-white/10 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-2" :class="copiedSecret === secret.id ? 'text-green-400' : ''">
                          <UIcon :name="copiedSecret === secret.id ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-4 h-4" />
                          {{ copiedSecret === secret.id ? 'Copied!' : 'Copy' }}
                        </button>
                        <button @click="deleteSecret(secret.id)" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg px-4 py-2 text-xs font-bold transition-all">
                          <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-if="secrets.length === 0" class="text-center py-12 text-gray-500">
                    <UIcon name="i-heroicons-lock-closed" class="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No secrets stored. Add your first API key!</p>
                  </div>
                </div>

                <!-- RETAINERS VIEW -->
                <div v-else-if="activeFeature === 'retainers'" class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-[#151921] p-4 rounded-xl border border-white/5">
                      <div class="text-xs text-gray-500 uppercase font-bold mb-1">Total Revenue</div>
                      <div class="text-xl font-bold text-white">{{ formatCurrency(totalRevenue) }}</div>
                    </div>
                    <div class="bg-[#151921] p-4 rounded-xl border border-white/5">
                      <div class="text-xs text-gray-500 uppercase font-bold mb-1">Pending</div>
                      <div class="text-xl font-bold text-orange-400">{{ pendingCount }}</div>
                    </div>
                    <div class="bg-[#151921] p-4 rounded-xl border border-white/5">
                      <div class="text-xs text-gray-500 uppercase font-bold mb-1">Clients</div>
                      <div class="text-xl font-bold text-indigo-400">{{ new Set(retainers.map(r => r.client)).size }}</div>
                    </div>
                  </div>

                  <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold">Invoices</h3>
                    <button @click="showRetainerModal = true" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                      <UIcon name="i-heroicons-plus" class="w-4 h-4" />
                      New Invoice
                    </button>
                  </div>

                  <div class="space-y-3">
                    <div v-for="retainer in retainers" :key="retainer.id" class="bg-[#151921] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
                      <div class="flex items-start justify-between mb-3">
                        <div>
                          <h4 class="font-bold text-white">{{ retainer.client }}</h4>
                          <p class="text-xs text-gray-500">{{ retainer.title }}</p>
                        </div>
                        <span 
                          :class="{
                            'bg-green-500/10 text-green-400 border-green-500/20': retainer.status === 'paid',
                            'bg-orange-500/10 text-orange-400 border-orange-500/20': retainer.status === 'pending',
                          }"
                          class="px-2 py-1 rounded text-[10px] uppercase font-bold border"
                        >
                          {{ retainer.status }}
                        </span>
                      </div>
                      
                      <div class="flex items-center justify-between mb-3">
                        <span class="text-2xl font-bold text-white">{{ formatCurrency(retainer.amount) }}</span>
                      </div>

                      <div class="flex gap-2">
                        <button v-if="retainer.status !== 'paid'" @click="updateRetainerStatus(retainer.id, 'paid')" class="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg py-2 text-xs font-bold transition-all">
                          Mark as Paid
                        </button>
                        <button @click="deleteRetainer(retainer.id)" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg px-4 py-2 text-xs font-bold transition-all">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-if="retainers.length === 0" class="text-center py-12 text-gray-500">
                    <UIcon name="i-heroicons-banknotes" class="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>No invoices yet. Create your first one!</p>
                  </div>
                </div>

              </Transition>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-32">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-4xl font-bold mb-4">Built for Orderly Problem Solvers</h2>
          <p class="text-gray-400">Every feature is designed to reduce chaos and increase output.</p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
          <div class="md:col-span-2 p-8 rounded-3xl bg-[#151921] border border-white/5 hover:border-indigo-500/30 transition-colors group relative overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-all"></div>
            <UIcon name="i-heroicons-shield-check" class="w-12 h-12 text-indigo-400 mb-6" />
            <h3 class="text-2xl font-bold mb-2">Enterprise Security</h3>
            <p class="text-gray-400 max-w-md">Encrypted secrets vault, role-based access control, and secure client portals ensuring your data stays safe.</p>
          </div>

          <div class="md:row-span-2 p-8 rounded-3xl bg-[#151921] border border-white/5 hover:border-emerald-500/30 transition-colors group">
             <div class="h-full flex flex-col">
                <UIcon name="i-heroicons-bolt" class="w-12 h-12 text-emerald-400 mb-6" />
                <h3 class="text-2xl font-bold mb-2">Lightning Fast</h3>
                <p class="text-gray-400 mb-8">Built on Nuxt 3 and Supabase for instantaneous data fetching.</p>
                <div class="mt-auto h-32 w-full bg-emerald-500/10 rounded-xl border border-emerald-500/20 relative overflow-hidden">
                  <div class="absolute inset-0 flex items-center justify-center font-mono text-emerald-400 text-xs">
                    &lt;Speed /&gt;
                  </div>
                </div>
             </div>
          </div>

          <div class="p-8 rounded-3xl bg-[#151921] border border-white/5 hover:border-orange-500/30 transition-colors">
            <UIcon name="i-heroicons-user-group" class="w-10 h-10 text-orange-400 mb-4" />
            <h3 class="text-xl font-bold mb-2">Team Sync</h3>
            <p class="text-gray-400 text-sm">Real-time collaboration on code snippets and client data.</p>
          </div>

          <div class="p-8 rounded-3xl bg-[#151921] border border-white/5 hover:border-pink-500/30 transition-colors">
            <UIcon name="i-heroicons-paint-brush" class="w-10 h-10 text-pink-400 mb-4" />
            <h3 class="text-xl font-bold mb-2">Fully Themable</h3>
            <p class="text-gray-400 text-sm">Customize the interface to match your brand identity.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-[#080a0f] py-12">
      <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-2">
           <span class="text-gray-600 text-sm">© 2026 Orderly Problem Solvers</span>
        </div>
        <div class="flex gap-8 text-sm text-gray-500">
          <a href="#" class="hover:text-white transition-colors">Privacy</a>
          <a href="#" class="hover:text-white transition-colors">Terms</a>
          <a href="#" class="hover:text-white transition-colors">Contact</a>
        </div>
      </div>
    </footer>

    <!-- ==================== MODALS ==================== -->

    <!-- Add Client Modal -->
    <div v-if="showClientModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showClientModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Add New Client</h3>
          <button @click="showClientModal = false" class="text-gray-500 hover:text-white">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="addClient" class="space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Client Name</label>
            <input v-model="newClientName" type="text" placeholder="e.g. Acme Corp" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" required />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Website (Optional)</label>
            <input v-model="newClientWebsite" type="text" placeholder="e.g. acme.com" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" @click="showClientModal = false" class="flex-1 py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold">Add Client</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Snippet Modal -->
    <div v-if="showSnippetModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div @click="showSnippetModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl my-8">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">New Code Snippet</h3>
          <button @click="showSnippetModal = false" class="text-gray-500 hover:text-white">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="addSnippet" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Title</label>
              <input v-model="newSnippet.title" type="text" placeholder="e.g. fetchUsers" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" required />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Language</label>
              <select v-model="newSnippet.language" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none">
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="sql">SQL</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Description</label>
            <input v-model="newSnippet.description" type="text" placeholder="What does this code do?" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Code</label>
            <textarea v-model="newSnippet.code" rows="8" placeholder="// Paste your code here..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none font-mono text-sm resize-none" required></textarea>
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" @click="showSnippetModal = false" class="flex-1 py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold">Save Snippet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Snippet Modal -->
    <div v-if="showSnippetView && activeSnippet" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showSnippetView = false" class="absolute inset-0 bg-black/90 backdrop-blur-md"></div>
      <div class="relative w-full max-w-4xl h-[85vh] bg-[#0c162c] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div class="p-6 border-b border-white/5 bg-[#151921] flex justify-between items-center">
          <div>
            <h2 class="text-xl font-bold text-white">{{ activeSnippet.title }}</h2>
            <p class="text-sm text-gray-400">{{ activeSnippet.description }}</p>
          </div>
          <button @click="showSnippetView = false" class="text-gray-500 hover:text-white">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        <div class="flex-1 overflow-auto p-6">
          <pre class="text-sm text-gray-300 font-mono">{{ activeSnippet.code }}</pre>
        </div>
      </div>
    </div>

    <!-- Add Secret Modal -->
    <div v-if="showSecretModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showSecretModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">Add New Secret</h3>
          <button @click="showSecretModal = false" class="text-gray-500 hover:text-white">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="addSecret" class="space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Key Name</label>
            <input v-model="newSecret.name" type="text" placeholder="e.g. STRIPE_SECRET_KEY" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none font-mono" required />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Value</label>
            <input v-model="newSecret.value" type="text" placeholder="sk_test_..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none font-mono text-sm" required />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" @click="showSecretModal = false" class="flex-1 py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold">Save Secret</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Retainer Modal -->
    <div v-if="showRetainerModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showRetainerModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold">New Invoice</h3>
          <button @click="showRetainerModal = false" class="text-gray-500 hover:text-white">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="addRetainer" class="space-y-4">
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Client Name</label>
            <input v-model="newRetainer.client" type="text" placeholder="e.g. Acme Corp" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" required />
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Description</label>
            <input v-model="newRetainer.title" type="text" placeholder="e.g. Q1 2026 Maintenance" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" required />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Amount (₦)</label>
              <input v-model.number="newRetainer.amount" type="number" placeholder="450000" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none" required />
            </div>
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Status</label>
              <select v-model="newRetainer.status" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-indigo-500 focus:outline-none">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" @click="showRetainerModal = false" class="flex-1 py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold">Create Invoice</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>