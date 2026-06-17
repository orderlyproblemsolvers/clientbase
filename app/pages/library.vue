<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const { $md }  = useNuxtApp()

const RESOURCE_TYPES = [
  { id: 'code',     label: 'Code',      icon: 'i-heroicons-code-bracket',       color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
  { id: 'prompt',   label: 'Prompt',    icon: 'i-heroicons-sparkles',            color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  { id: 'template', label: 'Template',  icon: 'i-heroicons-document-duplicate',  color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  { id: 'doc',      label: 'Doc',       icon: 'i-heroicons-book-open',           color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  { id: 'config',   label: 'Config',    icon: 'i-heroicons-cog-6-tooth',         color: 'text-gray-400   bg-gray-400/10   border-gray-400/20'   },
]

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' }, { id: 'typescript', name: 'TypeScript' }, { id: 'vue', name: 'Vue.js' },
  { id: 'python', name: 'Python' }, { id: 'sql', name: 'SQL' }, { id: 'html', name: 'HTML' }, { id: 'css', name: 'CSS' },
  { id: 'json', name: 'JSON' }, { id: 'bash', name: 'Bash/Shell' }, { id: 'php', name: 'PHP' }, { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' }, { id: 'csharp', name: 'C#' }, { id: 'java', name: 'Java' }, { id: 'text', name: 'Plain Text' }
]

const LANG_COLORS: Record<string, string> = {
  javascript: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', typescript: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  vue: 'text-green-400 bg-green-400/10 border-green-400/20', python: 'text-blue-300 bg-blue-300/10 border-blue-300/20',
  sql: 'text-orange-400 bg-orange-400/10 border-orange-400/20', html: 'text-orange-600 bg-orange-600/10 border-orange-600/20',
  css: 'text-sky-300 bg-sky-300/10 border-sky-300/20', json: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  bash: 'text-gray-200 bg-gray-200/10 border-gray-200/20', php: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  go: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', rust: 'text-red-400 bg-red-400/10 border-red-400/20',
  csharp: 'text-purple-400 bg-purple-400/10 border-purple-400/20', java: 'text-red-600 bg-red-600/10 border-red-600/20',
  text: 'text-gray-500 bg-gray-500/10 border-gray-500/20'
}

const AI_TOOLS = [
  { id: 'claude', name: 'Claude', url: (p: string) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  { id: 'chatgpt', name: 'ChatGPT', url: (p: string) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { id: 'gemini', name: 'Gemini', url: (p: string) => `https://gemini.google.com/app?q=${encodeURIComponent(p)}` },
]

const loading        = ref(true)
const fetchError     = ref('')
const resources      = ref<any[]>([])
const projects       = ref<any[]>([])
const clients        = ref<any[]>([])
const searchQuery    = ref('')
const selectedType   = ref('all')
const selectedLang   = ref('all')
const copiedId       = ref<string | null>(null)

const showCreateModal = ref(false)
const showViewModal   = ref(false)
const showFillModal   = ref(false)
const selectedItem    = ref<any>(null)
const saving          = ref(false)

const showDeleteConfirm = ref(false)
const deletingResourceId = ref<string | null>(null)
const deletingResource = ref(false)

const filledVariables = ref<Record<string, string>>({})
const filledContent   = computed(() => {
  if (!selectedItem.value) return ''
  let content = selectedItem.value.code
  Object.entries(filledVariables.value).forEach(([key, val]) => {
    content = content.replaceAll(`{{${key}}}`, val || `{{${key}}}`)
  })
  return content
})

const toast = ref({ show: false, message: '', type: 'success' })

const form = ref({
  type: 'code', title: '', description: '', language: 'javascript', code: '', tags: '', project_id: '', client_id: '', is_pinned: false
})

const filteredResources = computed(() => {
  if (!Array.isArray(resources.value)) return []
  return resources.value.filter(r => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q) || r.tags?.some((t: string) => t.toLowerCase().includes(q))
    const matchType = selectedType.value === 'all' || r.type === selectedType.value
    const matchLang = selectedLang.value === 'all' || r.language === selectedLang.value
    return matchSearch && matchType && matchLang
  }).sort((a, b) => (a.is_pinned === b.is_pinned) ? 0 : a.is_pinned ? -1 : 1)
})

const typeStats = computed(() => {
  const stats: Record<string, number> = {}
  resources.value.forEach(r => { stats[r.type] = (stats[r.type] || 0) + 1 })
  return stats
})

const langStats = computed(() => {
  const stats: Record<string, number> = {}
  resources.value.filter(r => r.type === 'code' || r.type === 'config').forEach(r => { stats[r.language] = (stats[r.language] || 0) + 1 })
  return stats
})

const showLangFilter = computed(() => selectedType.value === 'all' || selectedType.value === 'code' || selectedType.value === 'config')

const templateVariables = computed(() => {
  if (!selectedItem.value?.code) return []
  const matches = selectedItem.value.code.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((m: string) => m.slice(2, -2)))]
})

const templateVariablesList = computed(() => templateVariables.value.map((v: string) => `{{${v}}}`).join(', '))

const renderedDoc = computed(() => selectedItem.value?.type === 'doc' ? $md.render(selectedItem.value.code || '') : '')
const highlightedCode = computed(() => {
  if (!selectedItem.value || (selectedItem.value.type !== 'code' && selectedItem.value.type !== 'config')) return ''
  const lang = selectedItem.value.language || 'text'
  return $md.render(`\`\`\`${lang}\n${selectedItem.value.code}\n\`\`\``)
})

const wrapVariable = (v: string) => `{{${v}}}`

const HINT_PROMPT_VARS   = 'Use {{variable}} for dynamic parts.'
const HINT_TEMPLATE_VARS = 'Use {{variable}} placeholders — fill them at copy time.'
const HINT_VARIABLE_NAME = '{{variable_name}}'

const fetchData = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    resources.value = data || []

    const { data: pData } = await supabase.from('projects').select('id, name').order('name')
    projects.value = pData || []

    const { data: cData } = await supabase.from('clients').select('id, name').order('name')
    clients.value = cData || []
  } catch (e: any) {
    fetchError.value = e.message || 'Failed to load library'
    showToast('Failed to load library', 'error')
  } finally {
    loading.value = false
  }
}

const createResource = async () => {
  if (!form.value.title || !form.value.code) return
  saving.value = true
  try {
    const tags = form.value.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await supabase.from('snippets').insert({
      user_id: user.value?.id, type: form.value.type, title: form.value.title,
      description: form.value.description || null,
      language: form.value.type === 'code' || form.value.type === 'config' ? form.value.language : 'text',
      code: form.value.code, tags, is_pinned: form.value.is_pinned,
      project_id: form.value.project_id || null, client_id: form.value.client_id || null,
    })
    if (error) throw error
    showCreateModal.value = false
    resetForm()
    await fetchData()
    showToast('Saved to library!')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  form.value = { type: 'code', title: '', description: '', language: 'javascript', code: '', tags: '', project_id: '', client_id: '', is_pinned: false }
}

const togglePin = async (item: any, e: Event) => {
  e.stopPropagation()
  try {
    const { error } = await supabase.from('snippets').update({ is_pinned: !item.is_pinned }).eq('id', item.id)
    if (error) throw error
    item.is_pinned = !item.is_pinned
    resources.value.sort((a, b) => (a.is_pinned === b.is_pinned) ? 0 : a.is_pinned ? -1 : 1)
    showToast(item.is_pinned ? 'Pinned!' : 'Unpinned')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const requestDeleteResource = (id: string, e?: Event) => {
  e?.stopPropagation()
  deletingResourceId.value = id
  showDeleteConfirm.value = true
}

const confirmDeleteResource = async () => {
  if (!deletingResourceId.value) return
  deletingResource.value = true
  try {
    const { error } = await supabase.from('snippets').delete().eq('id', deletingResourceId.value)
    if (error) throw error
    resources.value = resources.value.filter(r => r.id !== deletingResourceId.value)
    if (selectedItem.value?.id === deletingResourceId.value) { showViewModal.value = false; selectedItem.value = null }
    showToast('Deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    deletingResource.value = false
    showDeleteConfirm.value = false
    deletingResourceId.value = null
  }
}

const copyText = async (text: string, id: string, e?: Event) => {
  e?.stopPropagation()
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => copiedId.value = null, 2000)
    showToast('Copied!')
  } catch {
    showToast('Failed to copy', 'error')
  }
}

const openInAI = (toolId: string, content: string) => {
  const tool = AI_TOOLS.find(t => t.id === toolId)
  if (!tool) return
  window.open(tool.url(content), '_blank')
}

const openFillModal = (item: any) => {
  selectedItem.value = item
  filledVariables.value = {}
  templateVariables.value.forEach((v: string) => { filledVariables.value[v] = '' })
  showFillModal.value = true
}

const openItem = (item: any) => {
  selectedItem.value = item
  showViewModal.value = true
}

const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const getTypeConfig = (typeId: string) => RESOURCE_TYPES.find(t => t.id === typeId) || RESOURCE_TYPES[0]
const getLangColor = (langId: string) => LANG_COLORS[langId] || LANG_COLORS.text
const getLangName = (langId: string) => LANGUAGES.find(l => l.id === langId)?.name || langId
const getPreview = (item: any): string => item.code?.slice(0, 300) || ''

const placeholderMap: Record<string, string> = {
  code: 'Paste your code here...',
  prompt: `Write your AI prompt here. ${HINT_PROMPT_VARS}\n\nExample:\nYou are a senior developer. Review the following code for {{client_name}}:\n\n{{code}}`,
  template: `Write your template here. ${HINT_TEMPLATE_VARS}\n\nExample:\nHi {{client_name}},\n\nFollowing up on the invoice of {{amount}} due on {{due_date}}...`,
  doc: '# Title\n\nWrite your documentation in Markdown.\n\n## Section\n\nContent here...',
  config: 'Paste your config, .env template, or API endpoint list here...',
}

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">
    <!-- Hero Header -->
    <div class="relative mb-8 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-white/6 p-5 md:p-6">
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <UIcon name="i-heroicons-book-open" class="w-8 h-8 text-primary" />
            Library
          </h1>
          <p class="text-slate-400 mt-2 text-sm max-w-lg">Prompts, templates, documentation, configs, and code — all in one place.</p>
        </div>
        <button @click="resetForm(); showCreateModal = true" class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] shrink-0">
          <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          Add Resource
        </button>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      <button @click="selectedType = 'all'; selectedLang = 'all'" class="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border whitespace-nowrap" :class="selectedType === 'all' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">All <span class="opacity-60 tabular-nums">{{ resources.length }}</span></button>
      <button v-for="t in RESOURCE_TYPES" :key="t.id" @click="selectedType = t.id; selectedLang = 'all'" class="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border whitespace-nowrap" :class="selectedType === t.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">
        <UIcon :name="t.icon" class="w-3.5 h-3.5" /> {{ t.label }}
        <span v-if="typeStats[t.id]" class="bg-white/10 px-1.5 py-0.5 rounded text-[10px] tabular-nums">{{ typeStats[t.id] }}</span>
      </button>
    </div>

    <!-- Search + Language filter -->
    <div class="flex flex-col md:flex-row gap-4 mb-8">
      <div class="relative flex-1">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
        <input v-model="searchQuery" type="search" placeholder="Search by title, description, content, or tag..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/40 focus:outline-none transition-all duration-150" />
      </div>
      <div v-if="showLangFilter && Object.keys(langStats).length > 0" class="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
        <button @click="selectedLang = 'all'" class="px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all border whitespace-nowrap" :class="selectedLang === 'all' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">Any lang</button>
        <button v-for="lang in LANGUAGES.filter(l => langStats[l.id])" :key="lang.id" @click="selectedLang = lang.id" class="px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all border whitespace-nowrap" :class="selectedLang === lang.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">{{ lang.name }}</button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="fetchError && !loading" class="text-center py-20">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-10 h-10 text-red-400 mx-auto mb-4" />
      <p class="text-white font-medium mb-2">Failed to load library</p>
      <p class="text-slate-400 text-sm mb-4">{{ fetchError }}</p>
      <button @click="fetchData" class="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">Retry</button>
    </div>

    <!-- Loading / Empty / Grid -->
    <div v-else>
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="i in 6" :key="i" class="bg-white/[0.03] border border-white/6 rounded-2xl h-56 animate-pulse"></div>
      </div>

      <div v-else-if="filteredResources.length === 0" class="flex flex-col items-center justify-center py-20 border border-dashed border-white/8 rounded-2xl">
        <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-book-open" class="w-6 h-6 text-slate-600" />
        </div>
        <p class="text-sm font-medium text-slate-300 mb-1">Nothing here yet</p>
        <p class="text-xs text-slate-500 mb-5">{{ searchQuery || selectedType !== 'all' ? 'Try adjusting your filters' : 'Add your first resource' }}</p>
        <button @click="resetForm(); showCreateModal = true" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-white transition-colors">
          <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" /> Add Resource
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <div
          v-for="item in filteredResources"
          :key="item.id"
          @click="openItem(item)"
          class="bg-white/[0.03] border border-white/6 hover:border-white/10 rounded-2xl overflow-hidden group transition-all duration-200 hover:bg-white/[0.055] flex flex-col cursor-pointer relative"
        >
          <div v-if="item.is_pinned" class="absolute top-3 right-3 z-10">
            <UIcon name="i-heroicons-star-solid" class="w-4 h-4 text-yellow-400" />
          </div>
          <div class="p-5 border-b border-white/5">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" :class="getTypeConfig(item.type).color.split(' ').slice(1).join(' ')">
                  <UIcon :name="getTypeConfig(item.type).icon" class="w-3.5 h-3.5" :class="getTypeConfig(item.type).color.split(' ')[0]" />
                </div>
                <h3 class="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">{{ item.title }}</h3>
              </div>
              <span v-if="(item.type === 'code' || item.type === 'config') && item.language" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border shrink-0" :class="getLangColor(item.language)">{{ getLangName(item.language) }}</span>
              <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border shrink-0" :class="getTypeConfig(item.type).color">{{ getTypeConfig(item.type).label }}</span>
            </div>
            <p v-if="item.description" class="text-xs text-slate-500 line-clamp-1">{{ item.description }}</p>
            <div v-if="item.tags?.length" class="flex items-center gap-1 mt-2 flex-wrap">
              <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500 font-medium">{{ tag }}</span>
              <span v-if="item.tags.length > 3" class="text-[10px] text-slate-600">+{{ item.tags.length - 3 }}</span>
            </div>
          </div>
          <div class="relative bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors overflow-hidden h-40">
            <pre class="font-mono text-xs text-slate-400 p-4 overflow-hidden whitespace-pre-wrap break-all h-full mask-bottom leading-relaxed">{{ getPreview(item) }}</pre>
            <div class="absolute inset-0 bg-gradient-to-t from-[#0d1525] to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
              <div class="flex items-center gap-1.5 text-primary font-semibold text-xs"><UIcon name="i-heroicons-arrows-pointing-out" class="w-3.5 h-3.5" /> Open</div>
              <div class="flex gap-1.5">
                <button @click="togglePin(item, $event)" class="p-1.5 rounded-xl backdrop-blur-sm transition-all shadow-lg" :class="item.is_pinned ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/10 hover:bg-white/20 text-white'">
                  <UIcon :name="item.is_pinned ? 'i-heroicons-star-solid' : 'i-heroicons-star'" class="w-3.5 h-3.5" />
                </button>
                <button @click.stop="copyText(item.code, item.id, $event)" class="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all shadow-lg">
                  <UIcon :name="copiedId === item.id ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" class="w-3.5 h-3.5" :class="copiedId === item.id ? 'text-emerald-400' : ''" />
                </button>
                <button @click.stop="requestDeleteResource(item.id, $event)" class="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 backdrop-blur-sm transition-all shadow-lg">
                  <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- View Modal -->
    <ModalBase :open="showViewModal && !!selectedItem" title="" :maxWidth="'max-w-4xl'" @close="showViewModal = false">
      <template v-if="selectedItem">
        <div class="flex items-center justify-between mb-5">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="getTypeConfig(selectedItem.type).color.split(' ').slice(1).join(' ')">
              <UIcon :name="getTypeConfig(selectedItem.type).icon" class="w-4 h-4" :class="getTypeConfig(selectedItem.type).color.split(' ')[0]" />
            </div>
            <div>
              <h2 class="text-base font-bold text-white truncate">{{ selectedItem.title }}</h2>
              <p v-if="selectedItem.description" class="text-xs text-slate-400 mt-0.5">{{ selectedItem.description }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button v-if="selectedItem.type === 'template' && templateVariables.length" @click="showViewModal = false; openFillModal(selectedItem)" class="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors flex items-center gap-1.5 border border-primary/20">
              <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" /> Fill Variables
            </button>
            <button @click="copyText(selectedItem.code, selectedItem.id)" class="p-2 rounded-xl hover:bg-white/8 text-slate-400 hover:text-white transition-colors" :title="copiedId === selectedItem.id ? 'Copied!' : 'Copy'">
              <UIcon :name="copiedId === selectedItem.id ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" class="w-5 h-5" :class="copiedId === selectedItem.id ? 'text-emerald-400' : ''" />
            </button>
          </div>
        </div>
        <div v-if="selectedItem.tags?.length" class="flex gap-2 flex-wrap mb-4">
          <span v-for="tag in selectedItem.tags" :key="tag" class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 font-medium border border-white/6">{{ tag }}</span>
        </div>

        <!-- Code / Config with overflow-x-auto -->
        <div v-if="selectedItem.type === 'code' || selectedItem.type === 'config'" class="bg-white/[0.03] rounded-2xl border border-white/6 p-5 overflow-x-auto max-w-full">
          <div v-html="highlightedCode"></div>
        </div>

        <!-- Prompt with overflow-x-auto -->
        <div v-else-if="selectedItem.type === 'prompt'">
          <div class="flex items-center gap-2 mb-4 flex-wrap">
            <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open in:</p>
            <button v-for="tool in AI_TOOLS" :key="tool.id" @click="openInAI(tool.id, selectedItem.code)" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-primary/10 text-slate-400 hover:text-primary text-xs font-semibold transition-colors border border-white/6 hover:border-primary/20 flex items-center gap-1.5">
              <UIcon name="i-heroicons-sparkles" class="w-3.5 h-3.5" /> {{ tool.name }}
            </button>
          </div>
          <pre class="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-2xl p-5 border border-white/6 overflow-x-auto max-w-full">{{ selectedItem.code }}</pre>
        </div>

        <!-- Template with overflow-x-auto -->
        <div v-else-if="selectedItem.type === 'template'">
          <div v-if="templateVariables.length" class="flex items-center gap-2 mb-4 bg-primary/5 border border-primary/10 rounded-2xl p-4">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-primary shrink-0" />
            <p class="text-xs text-slate-400">
              This template has <span class="text-primary font-semibold">{{ templateVariables.length }} variable{{ templateVariables.length !== 1 ? 's' : '' }}</span>:
              <span class="font-mono text-primary ml-1">{{ templateVariablesList }}</span>
            </p>
            <button @click="showViewModal = false; openFillModal(selectedItem)" class="ml-auto shrink-0 text-xs font-semibold text-primary hover:text-white transition-colors whitespace-nowrap">Fill &amp; Copy →</button>
          </div>
          <pre class="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-2xl p-5 border border-white/6 overflow-x-auto max-w-full">{{ selectedItem.code }}</pre>
        </div>

        <!-- Doc (Markdown) unchanged -->
        <div v-else-if="selectedItem.type === 'doc'" class="prose prose-invert max-w-none prose-indigo leading-relaxed text-slate-300 bg-white/[0.03] rounded-2xl border border-white/6 p-5" v-html="renderedDoc"></div>
      </template>
      <template #footer>
        <div class="flex items-center justify-between text-xs text-slate-500">
          <div class="flex items-center gap-4">
            <span>Added {{ selectedItem?.created_at ? new Date(selectedItem.created_at).toLocaleDateString() : '' }}</span>
            <button @click="togglePin(selectedItem, $event)" class="flex items-center gap-1 transition-colors font-medium" :class="selectedItem?.is_pinned ? 'text-yellow-400' : 'hover:text-yellow-400'">
              <UIcon :name="selectedItem?.is_pinned ? 'i-heroicons-star-solid' : 'i-heroicons-star'" class="w-3.5 h-3.5" />
              {{ selectedItem?.is_pinned ? 'Pinned' : 'Pin' }}
            </button>
          </div>
          <button @click="showViewModal = false; requestDeleteResource(selectedItem?.id)" class="text-red-400 hover:text-red-300 font-medium transition-colors">Delete</button>
        </div>
      </template>
    </ModalBase>

    <!-- Fill Template Modal -->
    <ModalBase :open="showFillModal && !!selectedItem" title="Fill Template" :subtitle="selectedItem?.title" @close="showFillModal = false">
      <div v-if="selectedItem" class="space-y-6">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Variables</p>
          <div class="space-y-3">
            <div v-for="variable in templateVariables" :key="variable">
              <label class="block text-xs font-semibold text-slate-400 mb-1 font-mono">{{ wrapVariable(variable) }}</label>
              <input v-model="filledVariables[variable]" type="text" :placeholder="`Enter ${variable.replace(/_/g, ' ')}...`" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all" />
            </div>
          </div>
        </div>
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Preview</p>
          <pre class="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-2xl p-5 border border-white/6 max-h-60 overflow-y-auto overflow-x-auto max-w-full">{{ filledContent }}</pre>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showFillModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="copyText(filledContent, 'filled'); showFillModal = false" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
            <UIcon :name="copiedId === 'filled' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" class="w-4 h-4" />
            {{ copiedId === 'filled' ? 'Copied!' : 'Copy Filled Template' }}
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Create Modal -->
    <ModalBase :open="showCreateModal" title="Add to Library" :maxWidth="'max-w-2xl'" @close="showCreateModal = false">
      <form @submit.prevent="createResource" class="space-y-5">
        <div>
          <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Type</label>
          <div class="grid grid-cols-5 gap-2">
            <button type="button" v-for="t in RESOURCE_TYPES" :key="t.id" @click="form.type = t.id" class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-all border" :class="form.type === t.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10'">
              <UIcon :name="t.icon" class="w-4 h-4" /> {{ t.label }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2 space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Title <span class="text-red-400">*</span></label>
            <input v-model="form.title" type="text" required placeholder="Give it a clear name..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none" />
          </div>
          <div v-if="form.type === 'code' || form.type === 'config'" class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Language</label>
            <div class="relative">
              <select v-model="form.language" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer">
                <option class="bg-[#0d1525]" v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Description</label>
          <input v-model="form.description" type="text" placeholder="Brief description..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Content <span class="text-red-400">*</span></label>
          <textarea v-model="form.code" required rows="10" :placeholder="placeholderMap[form.type] || 'Content...'" class="w-full bg-white/[0.04] border border-white/8 rounded-xl p-4 text-sm text-white font-mono placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none leading-relaxed"></textarea>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-400">Tags</label>
          <input v-model="form.tags" type="text" placeholder="comma, separated, tags" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Link to Project</label>
            <div class="relative">
              <select v-model="form.project_id" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer">
                <option class="bg-[#0d1525] text-white" value="">None</option>
                <option class="bg-[#0d1525] text-white" v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold text-slate-400">Link to Client</label>
            <div class="relative">
              <select v-model="form.client_id" class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer">
                <option class="bg-[#0d1525] text-white" value="">None</option>
                <option class="bg-[#0d1525] text-white" v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" @click="form.is_pinned = !form.is_pinned" class="w-10 h-6 rounded-full relative transition-colors" :class="form.is_pinned ? 'bg-yellow-400' : 'bg-white/10'">
            <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" :class="form.is_pinned ? 'left-5' : 'left-1'"></div>
          </button>
          <label class="text-sm text-slate-400 font-medium cursor-pointer" @click="form.is_pinned = !form.is_pinned">Pin to top of library</label>
        </div>
      </form>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showCreateModal = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button type="submit" form="create-resource-form" :disabled="saving" class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50" @click="createResource">
            <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Save to Library</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Delete Confirmation Modal -->
    <ModalBase :open="showDeleteConfirm" title="Delete Resource" subtitle="This action cannot be undone." @close="showDeleteConfirm = false">
      <p class="text-slate-400 text-sm">Are you sure you want to delete this resource?</p>
      <template #footer>
        <div class="flex gap-2.5">
          <button @click="showDeleteConfirm = false" class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all">Cancel</button>
          <button @click="confirmDeleteResource" :disabled="deletingResource" class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
            <UIcon v-if="deletingResource" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span v-else>Delete</span>
          </button>
        </div>
      </template>
    </ModalBase>

    <!-- Toast -->
    <Transition enter-active-class="transform ease-out duration-300 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0d1525] border-emerald-500/50' : 'bg-[#0d1525] border-red-500/50'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'" />
          <span class="font-semibold text-sm text-white">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mask-bottom {
  mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
}
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
:deep(.hljs) { background: transparent !important; padding: 0; margin: 0; color: #d8dee9; }
:deep(.prose) { color: #cbd5e1; }
:deep(.prose h1), :deep(.prose h2), :deep(.prose h3) { color: white; font-weight: 700; }
:deep(.prose code) { background: #1e293b; color: #818cf8; padding: 0.2em 0.4em; border-radius: 4px; }
:deep(.prose pre) { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
:deep(.prose a) { color: #818cf8; }
:deep(.prose blockquote) { border-left-color: #818cf8; color: #94a3b8; }
</style>