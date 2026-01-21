<script setup lang="ts">
const { $md } = useNuxtApp()
const client = useSupabaseClient()
const loading = ref(true)

// --- State ---
const snippets = ref<any[]>([])
const searchQuery = ref('')
const selectedLang = ref('All')

// Modals State
const showCreateModal = ref(false)
const showViewModal = ref(false)
const activeSnippet = ref<any>(null)
const newSnippet = ref({ title: '', description: '', language: 'typescript', code: '' })

// Supported Languages
const languages = [
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Vue / Nuxt', value: 'xml' },
  { label: 'SQL', value: 'sql' },
  { label: 'CSS / Tailwind', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'Bash', value: 'bash' }
]

// --- Computed ---
const filteredSnippets = computed(() => {
  return snippets.value.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          s.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesLang = selectedLang.value === 'All' || s.language === selectedLang.value
    return matchesSearch && matchesLang
  })
})

// --- Actions ---
const fetchSnippets = async () => {
  loading.value = true
  const { data } = await client.from('snippets').select('*').order('created_at', { ascending: false })
  snippets.value = data || []
  loading.value = false
}

const createSnippet = async () => {
  if (!newSnippet.value.title || !newSnippet.value.code) return
  
  const { error } = await client.from('snippets').insert({
    title: newSnippet.value.title,
    description: newSnippet.value.description,
    language: newSnippet.value.language,
    code: newSnippet.value.code
  })

  if (!error) {
    showCreateModal.value = false
    newSnippet.value = { title: '', description: '', language: 'typescript', code: '' }
    fetchSnippets()
  }
}

const deleteSnippet = async (id: string) => {
  if (!confirm('Are you sure you want to delete this snippet?')) return
  
  const { error } = await client.from('snippets').delete().eq('id', id)
  
  if (!error) {
    if (activeSnippet.value?.id === id) {
      showViewModal.value = false
      activeSnippet.value = null
    }
    fetchSnippets()
  } else {
    alert('Error deleting snippet: ' + error.message)
  }
}

const openSnippet = (snippet: any) => {
  activeSnippet.value = snippet
  showViewModal.value = true
}

const renderCode = (code: string, lang: string) => {
  // Guard against empty code to prevent rendering errors
  if (!code) return ''
  const mdString = '```' + lang + '\n' + code + '\n```'
  return $md.render(mdString)
}

const copyCode = (code: string) => {
  navigator.clipboard.writeText(code)
  alert('Snippet copied to clipboard!')
}

onMounted(() => fetchSnippets())
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <div class="max-w-7xl mx-auto mb-10">
      
      <div class="flex flex-col sm:flex-row justify-between sm:items-end gap-4 sm:gap-6 mb-8">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">Code Library</h1>
          <p class="text-gray-400 mt-1 text-sm md:text-base">Reusable components, configs, and SQL queries.</p>
        </div>
        <button 
          @click="showCreateModal = true" 
          class="w-full sm:w-auto bg-primary hover:bg-[#3d34d9] text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
        >
          <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          New Snippet
        </button>
      </div>

      <div class="flex flex-col lg:flex-row gap-4 mb-8">
        <div class="relative flex-1">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search library..." 
            class="w-full bg-secondary border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-600"
          />
        </div>
        <div class="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <button 
            @click="selectedLang = 'All'"
            :class="selectedLang === 'All' ? 'bg-white text-black' : 'bg-secondary text-gray-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap shrink-0"
          >
            All
          </button>
          <button 
            v-for="l in languages" 
            :key="l.value"
            @click="selectedLang = l.value"
            :class="selectedLang === l.value ? 'bg-white text-black' : 'bg-secondary text-gray-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap border border-white/5 shrink-0"
          >
            {{ l.label }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div 
          v-for="s in filteredSnippets" 
          :key="s.id" 
          class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col group hover:border-white/20 transition-all relative"
        >
          <div class="p-5 border-b border-white/5 flex justify-between items-start bg-secondary">
            <div class="min-w-0 pr-2"> <div class="flex items-center gap-2 mb-1">
                <h3 class="text-white font-bold text-lg truncate">{{ s.title }}</h3>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                 <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-base text-gray-400 border border-white/10 shrink-0">
                  {{ s.language }}
                </span>
                <p class="text-xs text-gray-500 truncate">{{ s.description }}</p>
              </div>
            </div>
            
            <div class="flex gap-1 shrink-0">
              <button 
                @click.stop="copyCode(s.code)" 
                class="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" 
                title="Copy"
              >
                <UIcon name="i-heroicons-clipboard" class="w-5 h-5" />
              </button>
              
              <button 
                @click.stop="deleteSnippet(s.id)" 
                class="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors" 
                title="Delete"
              >
                <UIcon name="i-heroicons-trash" class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div class="relative bg-[#0c162c] group-hover:bg-[#0f1b35] transition-colors flex-1">
            <div class="h-48 overflow-hidden p-4 text-xs opacity-80 group-hover:opacity-100 transition-opacity">
              <div class="prose prose-invert max-w-none pointer-events-none select-none" v-html="renderCode(s.code, s.language)"></div>
            </div>
            <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0c162c] to-transparent flex items-end justify-center pb-4">
              <button 
                @click="openSnippet(s)"
                class="bg-secondary hover:bg-white text-white hover:text-black border border-white/10 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-xl flex items-center gap-2 transform md:translate-y-2 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 opacity-100 translate-y-0"
              >
                <UIcon name="i-heroicons-arrows-pointing-out" class="w-4 h-4" />
                Expand Code
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredSnippets.length === 0 && !loading" class="text-center py-20 text-gray-600">
        <UIcon name="i-heroicons-code-bracket-square" class="w-16 h-16 opacity-20 mb-4 mx-auto" />
        <p>No snippets found. Time to save some code!</p>
      </div>
    </div>

    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showCreateModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-2xl bg-secondary border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <UIcon name="i-heroicons-plus-circle" class="w-6 h-6 text-primary" />
          Save New Snippet
        </h2>
        <form @submit.prevent="createSnippet" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Title</label>
              <input v-model="newSnippet.title" type="text" placeholder="e.g. Supabase Auth Helper" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"/>
            </div>
            <div>
              <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Language</label>
              <div class="relative">
                <select v-model="newSnippet.language" class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                  <option v-for="l in languages" :key="l.value" :value="l.value">{{ l.label }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none w-4 h-4" />
              </div>
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Description</label>
            <input v-model="newSnippet.description" type="text" placeholder="Short explanation of what this does..." class="w-full bg-base border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"/>
          </div>
          <div>
            <label class="block text-xs uppercase font-bold text-gray-500 mb-2">Code</label>
            <textarea v-model="newSnippet.code" rows="10" class="w-full bg-base border border-white/10 rounded-lg p-4 font-mono text-sm text-gray-300 focus:border-primary focus:outline-none resize-none" placeholder="// Paste your code here..."></textarea>
          </div>
          <div class="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button type="button" @click="showCreateModal = false" class="w-full sm:w-auto flex-1 py-3 text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" class="w-full sm:w-auto flex-1 bg-primary text-white py-3 rounded-lg font-bold">Save to Library</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showViewModal && activeSnippet" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showViewModal = false" class="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"></div>
      
      <div class="relative w-full max-w-5xl h-[85vh] bg-[#0c162c] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        <div class="p-4 md:p-6 border-b border-white/5 bg-secondary flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shrink-0">
          <div>
            <h2 class="text-xl font-bold text-white mb-1 break-words line-clamp-1">{{ activeSnippet.title }}</h2>
            <p class="text-sm text-gray-400 line-clamp-1">{{ activeSnippet.description }}</p>
          </div>
          <div class="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            <span class="text-xs font-bold px-3 py-1 rounded bg-base text-gray-300 border border-white/10 uppercase shrink-0">
              {{ activeSnippet.language }}
            </span>
            
            <button 
              @click="copyCode(activeSnippet.code)" 
              class="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shrink-0"
            >
              <UIcon name="i-heroicons-clipboard-document" class="w-4 h-4" />
              <span class="hidden sm:inline">Copy</span>
            </button>
            
            <button 
              @click="deleteSnippet(activeSnippet.id)" 
              class="bg-white/10 hover:bg-red-500/20 text-gray-400 hover:text-red-400 p-2 rounded-lg transition-colors shrink-0"
              title="Delete Snippet"
            >
              <UIcon name="i-heroicons-trash" class="w-5 h-5" />
            </button>

            <button 
              @click="showViewModal = false" 
              class="bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white p-2 rounded-lg transition-colors ml-2 shrink-0"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-0 custom-scrollbar relative">
          <div class="p-4 md:p-8 prose prose-invert max-w-none prose-pre:bg-transparent prose-pre:m-0" v-html="renderCode(activeSnippet.code, activeSnippet.language)"></div>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
/* Hide scrollbar for Chrome, Safari and Opera */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
.scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
}

.custom-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0c162c; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 5px; border: 2px solid #0c162c; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a5568; }
.hljs { background: transparent !important; padding: 0 !important; }
</style>