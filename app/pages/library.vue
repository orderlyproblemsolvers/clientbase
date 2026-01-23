<script setup lang="ts">
const client = useSupabaseClient()
const user = useSupabaseUser()
const { $md } = useNuxtApp() // 👈 Access your markdown plugin

// --- Constants ---
const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  { id: 'typescript', name: 'TypeScript', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  { id: 'vue', name: 'Vue.js', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  { id: 'python', name: 'Python', color: 'text-blue-300 bg-blue-300/10 border-blue-300/20' },
  { id: 'sql', name: 'SQL', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  { id: 'html', name: 'HTML', color: 'text-orange-600 bg-orange-600/10 border-orange-600/20' },
  { id: 'css', name: 'CSS', color: 'text-sky-300 bg-sky-300/10 border-sky-300/20' },
  { id: 'json', name: 'JSON', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  { id: 'bash', name: 'Bash/Shell', color: 'text-gray-200 bg-gray-200/10 border-gray-200/20' },
  { id: 'php', name: 'PHP', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' },
  { id: 'go', name: 'Go', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  { id: 'rust', name: 'Rust', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  { id: 'csharp', name: 'C#', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  { id: 'java', name: 'Java', color: 'text-red-600 bg-red-600/10 border-red-600/20' },
  { id: 'text', name: 'Plain Text', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' },
]

// --- State ---
const loading = ref(true)
const snippets = ref<any[]>([])
const searchQuery = ref('')
const selectedLang = ref('all')
const copiedId = ref<string | null>(null)

// Modals
const showCreateModal = ref(false)
const showViewModal = ref(false)
const selectedSnippet = ref<any>(null)

// Toast
const toast = ref({ show: false, message: '', type: 'success' })

// Form
const saving = ref(false)
const form = ref({
  title: '',
  language: 'javascript',
  code: '',
  description: ''
})

// --- Computed ---

// 🔥 NEW: Render using your Markdown Plugin
const highlightedCode = computed(() => {
  if (!selectedSnippet.value) return ''
  
  const code = selectedSnippet.value.code
  const lang = selectedSnippet.value.language
  
  // We wrap the code in markdown backticks so your plugin detects it
  const markdownBlock = `\`\`\`${lang}\n${code}\n\`\`\``
  
  // Use the global $md helper to render HTML
  return $md.render(markdownBlock)
})

const filteredSnippets = computed(() => {
  if (!Array.isArray(snippets.value)) return []
  return snippets.value.filter(s => {
    const matchesSearch = 
      s.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
      s.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesLang = selectedLang.value === 'all' || s.language === selectedLang.value
    return matchesSearch && matchesLang
  })
})

const languageStats = computed(() => {
  if (!Array.isArray(snippets.value)) return {}
  const stats: Record<string, number> = {}
  snippets.value.forEach(s => {
    stats[s.language] = (stats[s.language] || 0) + 1
  })
  return stats
})

// --- Actions ---

const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const getLangColor = (langId: string) => {
  return LANGUAGES.find(l => l.id === langId)?.color || LANGUAGES.find(l => l.id === 'text')?.color
}

const getLangName = (langId: string) => {
  return LANGUAGES.find(l => l.id === langId)?.name || langId
}

const fetchSnippets = async () => {
  loading.value = true
  try {
    const { data, error } = await client.from('snippets').select('*').order('created_at', { ascending: false })
    if (error) throw error
    snippets.value = data || []
  } catch (e: any) {
    showToast('Failed to load snippets', 'error')
    snippets.value = []
  } finally {
    loading.value = false
  }
}

const createSnippet = async () => {
  if (!form.value.title || !form.value.code) return
  saving.value = true
  try {
    const { error } = await client.from('snippets').insert({
      title: form.value.title,
      language: form.value.language,
      code: form.value.code,
      description: form.value.description,
      user_id: user.value?.id
    })
    if (error) throw error

    showCreateModal.value = false
    form.value = { title: '', language: 'javascript', code: '', description: '' }
    await fetchSnippets()
    showToast('Snippet saved to library!')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

const deleteSnippet = async (id: string) => {
  if (!confirm('Permanently delete this snippet?')) return
  try {
    const { error } = await client.from('snippets').delete().eq('id', id)
    if (error) throw error
    snippets.value = snippets.value.filter(s => s.id !== id)
    
    if (selectedSnippet.value?.id === id) {
      showViewModal.value = false
      selectedSnippet.value = null
    }
    showToast('Snippet deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const copyToClipboard = async (code: string, id: string) => {
  try {
    await navigator.clipboard.writeText(code)
    copiedId.value = id
    setTimeout(() => copiedId.value = null, 2000)
    showToast('Code copied to clipboard')
  } catch (err) {
    showToast('Failed to copy', 'error')
  }
}

const openSnippet = (snippet: any) => {
  selectedSnippet.value = snippet
  showViewModal.value = true
}

onMounted(() => fetchSnippets())
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div class="max-w-7xl mx-auto mb-8">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
             <UIcon name="i-heroicons-code-bracket-square" class="w-8 h-8 text-primary" />
             Code Library
          </h1>
          <p class="text-gray-400 mt-2 text-sm max-w-lg">
            Store, organize, and reuse your commonly used code patterns and algorithms.
          </p>
        </div>
        <button 
          @click="showCreateModal = true" 
          class="bg-primary hover:bg-[#3d34d9] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group"
        >
          <div class="bg-white/20 p-1 rounded-full group-hover:scale-110 transition-transform">
             <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          </div>
          Add Snippet
        </button>
      </div>

      <div class="flex flex-col md:flex-row gap-4 mb-8">
        <div class="relative flex-1">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search titles or code..." 
            class="w-full bg-secondary border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        
        <div class="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button 
            @click="selectedLang = 'all'"
            class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap"
            :class="selectedLang === 'all' 
              ? 'bg-white text-secondary border-white' 
              : 'bg-secondary text-gray-400 border-white/5 hover:border-white/20 hover:text-white'"
          >
            All <span class="opacity-50 ml-1">{{ snippets.length }}</span>
          </button>
          
          <button 
            v-for="lang in LANGUAGES" 
            :key="lang.id"
            v-show="languageStats[lang.id]" 
            @click="selectedLang = lang.id"
            class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-2"
            :class="selectedLang === lang.id 
              ? 'bg-white text-secondary border-white' 
              : 'bg-secondary text-gray-400 border-white/5 hover:border-white/20 hover:text-white'"
          >
            {{ lang.name }}
            <span class="bg-white/10 px-1.5 py-0.5 rounded text-[9px]">{{ languageStats[lang.id] || 0 }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="i in 6" :key="i" class="bg-secondary border border-white/5 rounded-2xl h-64 animate-pulse p-6"></div>
      </div>

      <div v-else-if="filteredSnippets.length === 0" class="flex flex-col items-center justify-center py-20 bg-secondary/30 rounded-3xl border border-white/5 border-dashed">
         <UIcon name="i-heroicons-code-bracket" class="w-10 h-10 text-gray-500 mb-4" />
         <h3 class="text-white font-bold text-lg">No snippets found</h3>
         <button @click="showCreateModal = true" class="text-primary hover:text-white text-sm font-bold mt-4">+ Add First Snippet</button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <div 
          v-for="s in filteredSnippets" 
          :key="s.id" 
          @click="openSnippet(s)"
          class="bg-secondary border border-white/5 hover:border-white/20 rounded-2xl overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 flex flex-col cursor-pointer"
        >
          <div class="p-5 border-b border-white/5 flex items-start justify-between gap-4">
            <div>
              <h3 class="text-white font-bold truncate pr-2" :title="s.title">{{ s.title }}</h3>
              <p v-if="s.description" class="text-xs text-gray-500 mt-1 line-clamp-1">{{ s.description }}</p>
            </div>
            <span class="px-2 py-1 rounded-md text-[10px] uppercase font-bold border shrink-0" :class="getLangColor(s.language)">
              {{ getLangName(s.language) }}
            </span>
          </div>

          <div class="relative bg-[#0b1221] p-5 group-hover:bg-[#080c16] transition-colors overflow-hidden h-48">
            <pre class="font-mono text-xs text-gray-300 overflow-hidden whitespace-pre-wrap break-all h-full mask-bottom">{{ s.code }}</pre>
            
            <div class="absolute inset-0 bg-gradient-to-t from-[#0b1221] to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
              <div class="flex items-center gap-2 text-primary font-bold text-xs">
                 <UIcon name="i-heroicons-arrows-pointing-out" class="w-4 h-4" />
                 Click to view
              </div>
              <div class="flex gap-2">
                <button @click.stop="copyToClipboard(s.code, s.id)" class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all shadow-lg">
                  <UIcon v-if="copiedId === s.id" name="i-heroicons-check" class="w-4 h-4 text-green-400" />
                  <UIcon v-else name="i-heroicons-clipboard-document" class="w-4 h-4" />
                </button>
                <button @click.stop="deleteSnippet(s.id)" class="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 backdrop-blur-sm transition-all shadow-lg">
                  <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div @click="showCreateModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div class="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 class="text-lg font-bold text-white">Add New Snippet</h2>
            <button @click="showCreateModal = false" class="text-gray-400 hover:text-white">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>
          <form @submit.prevent="createSnippet" class="p-6 overflow-y-auto space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="md:col-span-2">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Title</label>
                <input v-model="form.title" type="text" required class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"/>
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Language</label>
                <div class="relative">
                  <select v-model="form.language" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                    <option v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
                  </select>
                  <UIcon name="i-heroicons-chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
               <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Code</label>
               <textarea v-model="form.code" required rows="8" class="w-full bg-[#0b1221] border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:border-primary focus:outline-none resize-none"></textarea>
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Description</label>
              <input v-model="form.description" type="text" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"/>
            </div>
            <div class="pt-4 flex gap-3">
              <button type="button" @click="showCreateModal = false" class="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold">Cancel</button>
              <button type="submit" :disabled="saving" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
                {{ saving ? 'Saving...' : 'Save Snippet' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showViewModal && selectedSnippet" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div @click="showViewModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        
        <div class="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <div class="p-6 border-b border-white/5 flex items-start justify-between bg-white/5">
            <div>
              <div class="flex items-center gap-3 mb-2">
                 <h2 class="text-xl font-bold text-white">{{ selectedSnippet.title }}</h2>
                 <span class="px-2 py-1 rounded-md text-[10px] uppercase font-bold border" :class="getLangColor(selectedSnippet.language)">
                    {{ getLangName(selectedSnippet.language) }}
                 </span>
              </div>
              <p v-if="selectedSnippet.description" class="text-gray-400 text-sm">{{ selectedSnippet.description }}</p>
            </div>
            <div class="flex gap-2">
               <button 
                  @click="copyToClipboard(selectedSnippet.code, selectedSnippet.id)" 
                  class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  :title="copiedId === selectedSnippet.id ? 'Copied!' : 'Copy Code'"
                >
                  <UIcon v-if="copiedId === selectedSnippet.id" name="i-heroicons-check" class="w-5 h-5 text-green-400" />
                  <UIcon v-else name="i-heroicons-clipboard-document" class="w-5 h-5" />
               </button>
               <button @click="showViewModal = false" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
                 <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
               </button>
            </div>
          </div>

          <div class="flex-1 overflow-auto bg-[#2e3440] p-6 relative"> <div v-html="highlightedCode"></div>
          </div>
          
          <div class="p-4 border-t border-white/5 bg-white/5 flex justify-between items-center text-xs text-gray-500">
             <span>Added {{ new Date(selectedSnippet.created_at).toLocaleDateString() }}</span>
             <button @click="deleteSnippet(selectedSnippet.id)" class="text-red-400 hover:text-red-300 hover:underline">Delete Snippet</button>
          </div>

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

<style scoped>
.mask-bottom {
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
}
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

/* Ensure hljs text color is readable */
:deep(.hljs) {
  background: transparent !important;
  padding: 0;
  margin: 0;
  color: #d8dee9; /* Nord Foreground */
}
</style>