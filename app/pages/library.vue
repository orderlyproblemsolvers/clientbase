<script setup lang="ts">
const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const { $md }  = useNuxtApp()

// ── Constants ─────────────────────────────────────────────────────────────────
const RESOURCE_TYPES = [
  { id: 'code',     label: 'Code',      icon: 'i-heroicons-code-bracket',       color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
  { id: 'prompt',   label: 'Prompt',    icon: 'i-heroicons-sparkles',            color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  { id: 'template', label: 'Template',  icon: 'i-heroicons-document-duplicate',  color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  { id: 'doc',      label: 'Doc',       icon: 'i-heroicons-book-open',           color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  { id: 'config',   label: 'Config',    icon: 'i-heroicons-cog-6-tooth',         color: 'text-gray-400   bg-gray-400/10   border-gray-400/20'   },
]

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'typescript', name: 'TypeScript' },
  { id: 'vue',        name: 'Vue.js'     },
  { id: 'python',     name: 'Python'     },
  { id: 'sql',        name: 'SQL'        },
  { id: 'html',       name: 'HTML'       },
  { id: 'css',        name: 'CSS'        },
  { id: 'json',       name: 'JSON'       },
  { id: 'bash',       name: 'Bash/Shell' },
  { id: 'php',        name: 'PHP'        },
  { id: 'go',         name: 'Go'         },
  { id: 'rust',       name: 'Rust'       },
  { id: 'csharp',     name: 'C#'         },
  { id: 'java',       name: 'Java'       },
  { id: 'text',       name: 'Plain Text' },
]

const LANG_COLORS: Record<string, string> = {
  javascript: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  typescript: 'text-blue-400   bg-blue-400/10   border-blue-400/20',
  vue:        'text-green-400  bg-green-400/10  border-green-400/20',
  python:     'text-blue-300   bg-blue-300/10   border-blue-300/20',
  sql:        'text-orange-400 bg-orange-400/10 border-orange-400/20',
  html:       'text-orange-600 bg-orange-600/10 border-orange-600/20',
  css:        'text-sky-300    bg-sky-300/10    border-sky-300/20',
  json:       'text-gray-400   bg-gray-400/10   border-gray-400/20',
  bash:       'text-gray-200   bg-gray-200/10   border-gray-200/20',
  php:        'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
  go:         'text-cyan-400   bg-cyan-400/10   border-cyan-400/20',
  rust:       'text-red-400    bg-red-400/10    border-red-400/20',
  csharp:     'text-purple-400 bg-purple-400/10 border-purple-400/20',
  java:       'text-red-600    bg-red-600/10    border-red-600/20',
  text:       'text-gray-500   bg-gray-500/10   border-gray-500/20',
}

const AI_TOOLS = [
  { id: 'claude',   name: 'Claude',    url: (p: string) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  { id: 'chatgpt',  name: 'ChatGPT',   url: (p: string) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { id: 'gemini',   name: 'Gemini',    url: (p: string) => `https://gemini.google.com/app?q=${encodeURIComponent(p)}` },
]

// ── State ─────────────────────────────────────────────────────────────────────
const loading        = ref(true)
const resources      = ref<any[]>([])
const projects       = ref<any[]>([])
const clients        = ref<any[]>([])
const searchQuery    = ref('')
const selectedType   = ref('all')
const selectedLang   = ref('all')
const copiedId       = ref<string | null>(null)

// Modals
const showCreateModal = ref(false)
const showViewModal   = ref(false)
const showFillModal   = ref(false)
const selectedItem    = ref<any>(null)
const saving          = ref(false)

// Template variable fill state
const filledVariables = ref<Record<string, string>>({})
const filledContent   = computed(() => {
  if (!selectedItem.value) return ''
  let content = selectedItem.value.code
  Object.entries(filledVariables.value).forEach(([key, val]) => {
    content = content.replaceAll(`{{${key}}}`, val || `{{${key}}}`)
  })
  return content
})

// Toast
const toast = ref({ show: false, message: '', type: 'success' })

// Form
const form = ref({
  type:        'code',
  title:       '',
  description: '',
  language:    'javascript',
  code:        '',
  tags:        '' as string,
  project_id:  '',
  client_id:   '',
  is_pinned:   false,
})

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredResources = computed(() => {
  if (!Array.isArray(resources.value)) return []
  return resources.value.filter(r => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch =
      !q ||
      r.title?.toLowerCase().includes(q)       ||
      r.description?.toLowerCase().includes(q) ||
      r.code?.toLowerCase().includes(q)        ||
      r.tags?.some((t: string) => t.toLowerCase().includes(q))
    const matchType = selectedType.value === 'all' || r.type === selectedType.value
    const matchLang = selectedLang.value === 'all' || r.language === selectedLang.value
    return matchSearch && matchType && matchLang
  }).sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return 0
  })
})

const typeStats = computed(() => {
  const stats: Record<string, number> = {}
  resources.value.forEach(r => { stats[r.type] = (stats[r.type] || 0) + 1 })
  return stats
})

const langStats = computed(() => {
  const stats: Record<string, number> = {}
  resources.value
    .filter(r => r.type === 'code' || r.type === 'config')
    .forEach(r => { stats[r.language] = (stats[r.language] || 0) + 1 })
  return stats
})

const showLangFilter = computed(() =>
  selectedType.value === 'all' || selectedType.value === 'code' || selectedType.value === 'config'
)

// Extract {{variable}} names from template content
const templateVariables = computed(() => {
  if (!selectedItem.value?.code) return []
  const matches = selectedItem.value.code.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((m: string) => m.slice(2, -2)))]
})

// Joined list of variables formatted as {{name}} for display
const templateVariablesList = computed(() =>
  templateVariables.value.map((v: string) => `{{${v}}}`).join(', ')
)

// Rendered markdown for doc type
const renderedDoc = computed(() => {
  if (!selectedItem.value || selectedItem.value.type !== 'doc') return ''
  return $md.render(selectedItem.value.code || '')
})

// Highlighted code for code/config type
const highlightedCode = computed(() => {
  if (!selectedItem.value) return ''
  if (selectedItem.value.type !== 'code' && selectedItem.value.type !== 'config') return ''
  const lang = selectedItem.value.language || 'text'
  return $md.render(`\`\`\`${lang}\n${selectedItem.value.code}\n\`\`\``)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// Wraps a variable name in {{ }} — used in template to avoid Vue compiler conflicts
const wrapVariable = (v: string) => `{{${v}}}`

// Static label strings that contain {{ }} — kept in script to avoid compiler conflicts
const HINT_PROMPT_VARS   = 'Use {{variable}} for dynamic parts.'
const HINT_TEMPLATE_VARS = 'Use {{variable}} placeholders — fill them at copy time.'
const HINT_VARIABLE_NAME = '{{variable_name}}'

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
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
    showToast('Failed to load library', 'error')
    resources.value = []
  } finally {
    loading.value = false
  }
}

// ── Create ────────────────────────────────────────────────────────────────────
const createResource = async () => {
  if (!form.value.title || !form.value.code) return
  saving.value = true
  try {
    const tags = form.value.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const { error } = await supabase.from('snippets').insert({
      user_id:     user.value?.id,
      type:        form.value.type,
      title:       form.value.title,
      description: form.value.description || null,
      language:    form.value.type === 'code' || form.value.type === 'config' ? form.value.language : 'text',
      code:        form.value.code,
      tags,
      is_pinned:   form.value.is_pinned,
      project_id:  form.value.project_id  || null,
      client_id:   form.value.client_id   || null,
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
  form.value = {
    type: 'code', title: '', description: '', language: 'javascript',
    code: '', tags: '', project_id: '', client_id: '', is_pinned: false,
  }
}

// ── Toggle pin ────────────────────────────────────────────────────────────────
const togglePin = async (item: any, e: Event) => {
  e.stopPropagation()
  try {
    const { error } = await supabase
      .from('snippets')
      .update({ is_pinned: !item.is_pinned })
      .eq('id', item.id)
    if (error) throw error
    item.is_pinned = !item.is_pinned
    resources.value.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return 0
    })
    showToast(item.is_pinned ? 'Pinned!' : 'Unpinned')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
const deleteResource = async (id: string, e?: Event) => {
  e?.stopPropagation()
  if (!confirm('Delete this resource?')) return
  try {
    const { error } = await supabase.from('snippets').delete().eq('id', id)
    if (error) throw error
    resources.value = resources.value.filter(r => r.id !== id)
    if (selectedItem.value?.id === id) { showViewModal.value = false; selectedItem.value = null }
    showToast('Deleted')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

// ── Copy ──────────────────────────────────────────────────────────────────────
const copyText = async (text: string, id: string, e?: Event) => {
  e?.stopPropagation()
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => copiedId.value = null, 2000)
    showToast('Copied to clipboard!')
  } catch {
    showToast('Failed to copy', 'error')
  }
}

// ── Open in AI tool ───────────────────────────────────────────────────────────
const openInAI = (toolId: string, content: string) => {
  const tool = AI_TOOLS.find(t => t.id === toolId)
  if (!tool) return
  window.open(tool.url(content), '_blank')
}

// ── Template fill ─────────────────────────────────────────────────────────────
const openFillModal = (item: any) => {
  selectedItem.value = item
  filledVariables.value = {}
  templateVariables.value.forEach((v: string) => { filledVariables.value[v] = '' })
  showFillModal.value = true
}

// ── Open view modal ───────────────────────────────────────────────────────────
const openItem = (item: any) => {
  selectedItem.value = item
  showViewModal.value = true
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const getTypeConfig = (typeId: string) =>
  RESOURCE_TYPES.find(t => t.id === typeId) || RESOURCE_TYPES[0]

const getLangColor = (langId: string) =>
  LANG_COLORS[langId] || LANG_COLORS.text

const getLangName = (langId: string) =>
  LANGUAGES.find(l => l.id === langId)?.name || langId

const getPreview = (item: any): string => {
  if (!item.code) return ''
  return item.code.slice(0, 300)
}

const placeholderMap: Record<string, string> = {
  code:     'Paste your code here...',
  prompt:   'Write your AI prompt here. Use {{variable}} for dynamic parts.\n\nExample:\nYou are a senior developer. Review the following code for {{client_name}} and provide feedback:\n\n{{code}}',
  template: 'Write your template here. Use {{variable}} for dynamic parts.\n\nExample:\nHi {{client_name}},\n\nFollowing up on the invoice of {{amount}} due on {{due_date}}...',
  doc:      '# Title\n\nWrite your documentation in Markdown.\n\n## Section\n\nContent here...',
  config:   'Paste your config, .env template, or API endpoint list here...',
}

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <UIcon name="i-heroicons-book-open" class="w-8 h-8 text-primary" />
          Library
        </h1>
        <p class="text-gray-400 mt-2 text-sm max-w-lg">
          Prompts, templates, documentation, configs, and code — all in one place.
        </p>
      </div>
      <UButton
        @click="resetForm(); showCreateModal = true"
        leading-icon="i-heroicons-plus"
        class="bg-primary text-white hover:bg-primary/80"
      >
        Add Resource
      </UButton>
    </div>

    <!-- Type tabs -->
    <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      <button
        @click="selectedType = 'all'; selectedLang = 'all'"
        class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-1.5"
        :class="selectedType === 'all'
          ? 'bg-white text-secondary border-white'
          : 'bg-secondary text-gray-400 border-white/5 hover:border-white/20 hover:text-white'"
      >
        All
        <span class="opacity-50">{{ resources.length }}</span>
      </button>

      <button
        v-for="t in RESOURCE_TYPES"
        :key="t.id"
        @click="selectedType = t.id; selectedLang = 'all'"
        class="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap flex items-center gap-2"
        :class="selectedType === t.id
          ? 'bg-white text-secondary border-white'
          : 'bg-secondary text-gray-400 border-white/5 hover:border-white/20 hover:text-white'"
      >
        <UIcon :name="t.icon" class="w-3.5 h-3.5" />
        {{ t.label }}
        <span v-if="typeStats[t.id]" class="bg-white/10 px-1.5 py-0.5 rounded text-[9px]">{{ typeStats[t.id] }}</span>
      </button>
    </div>

    <!-- Search + language filter -->
    <div class="flex flex-col md:flex-row gap-4 mb-8">
      <div class="relative flex-1">
        <UIcon name="i-heroicons-magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by title, description, content, or tag..."
          class="w-full bg-secondary border border-white/5 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:border-primary focus:outline-none transition-colors"
        />
      </div>

      <div v-if="showLangFilter && Object.keys(langStats).length > 0" class="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
        <button
          @click="selectedLang = 'all'"
          class="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all border whitespace-nowrap"
          :class="selectedLang === 'all'
            ? 'bg-white/10 text-white border-white/20'
            : 'bg-secondary text-gray-500 border-white/5 hover:border-white/20'"
        >
          Any lang
        </button>
        <button
          v-for="lang in LANGUAGES.filter(l => langStats[l.id])"
          :key="lang.id"
          @click="selectedLang = lang.id"
          class="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all border whitespace-nowrap"
          :class="selectedLang === lang.id
            ? 'bg-white/10 text-white border-white/20'
            : 'bg-secondary text-gray-500 border-white/5 hover:border-white/20'"
        >
          {{ lang.name }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="i in 6" :key="i" class="bg-secondary border border-white/5 rounded-2xl h-56 animate-pulse"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredResources.length === 0" class="flex flex-col items-center justify-center py-20 bg-secondary/30 rounded-3xl border border-white/5 border-dashed">
      <UIcon name="i-heroicons-book-open" class="w-10 h-10 text-gray-600 mb-4" />
      <h3 class="text-white font-bold text-lg">Nothing here yet</h3>
      <p class="text-gray-500 text-sm mt-1 mb-4">
        {{ searchQuery || selectedType !== 'all' ? 'Try adjusting your filters' : 'Add your first resource to the library' }}
      </p>
      <button @click="resetForm(); showCreateModal = true" class="text-primary hover:text-white text-sm font-bold transition-colors">
        + Add Resource
      </button>
    </div>

    <!-- Resource grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
      <div
        v-for="item in filteredResources"
        :key="item.id"
        @click="openItem(item)"
        class="bg-secondary border border-white/5 hover:border-white/20 rounded-2xl overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 flex flex-col cursor-pointer relative"
      >
        <div v-if="item.is_pinned" class="absolute top-3 right-3 z-10">
          <UIcon name="i-heroicons-star-solid" class="w-4 h-4 text-yellow-400" />
        </div>

        <div class="p-5 border-b border-white/5">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                :class="getTypeConfig(item.type).color.split(' ').slice(1).join(' ')"
              >
                <UIcon :name="getTypeConfig(item.type).icon" class="w-3.5 h-3.5" :class="getTypeConfig(item.type).color.split(' ')[0]" />
              </div>
              <h3 class="text-white font-bold truncate text-sm">{{ item.title }}</h3>
            </div>

            <span
              v-if="(item.type === 'code' || item.type === 'config') && item.language"
              class="px-2 py-0.5 rounded text-[10px] uppercase font-bold border shrink-0"
              :class="getLangColor(item.language)"
            >
              {{ getLangName(item.language) }}
            </span>

            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] uppercase font-bold border shrink-0"
              :class="getTypeConfig(item.type).color"
            >
              {{ getTypeConfig(item.type).label }}
            </span>
          </div>

          <p v-if="item.description" class="text-xs text-gray-500 line-clamp-1">{{ item.description }}</p>

          <div v-if="item.tags?.length" class="flex items-center gap-1 mt-2 flex-wrap">
            <span
              v-for="tag in item.tags.slice(0, 3)"
              :key="tag"
              class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium"
            >
              {{ tag }}
            </span>
            <span v-if="item.tags.length > 3" class="text-[9px] text-gray-600">+{{ item.tags.length - 3 }}</span>
          </div>
        </div>

        <div class="relative bg-[#0b1221] group-hover:bg-[#080c16] transition-colors overflow-hidden h-40">
          <pre class="font-mono text-xs text-gray-400 p-4 overflow-hidden whitespace-pre-wrap break-all h-full mask-bottom leading-relaxed">{{ getPreview(item) }}</pre>

          <div class="absolute inset-0 bg-gradient-to-t from-[#0b1221] to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
            <div class="flex items-center gap-1.5 text-primary font-bold text-xs">
              <UIcon name="i-heroicons-arrows-pointing-out" class="w-3.5 h-3.5" />
              Open
            </div>
            <div class="flex gap-1.5">
              <button
                @click="togglePin(item, $event)"
                class="p-1.5 rounded-lg backdrop-blur-sm transition-all shadow-lg"
                :class="item.is_pinned ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/10 hover:bg-white/20 text-white'"
                title="Pin"
              >
                <UIcon :name="item.is_pinned ? 'i-heroicons-star-solid' : 'i-heroicons-star'" class="w-3.5 h-3.5" />
              </button>
              <button
                @click.stop="copyText(item.code, item.id, $event)"
                class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all shadow-lg"
                title="Copy"
              >
                <UIcon :name="copiedId === item.id ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" class="w-3.5 h-3.5" :class="copiedId === item.id ? 'text-green-400' : ''" />
              </button>
              <button
                @click.stop="deleteResource(item.id, $event)"
                class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 backdrop-blur-sm transition-all shadow-lg"
                title="Delete"
              >
                <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── View modal ─────────────────────────────────────────────────────────── -->
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showViewModal && selectedItem" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div @click="showViewModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          <div class="p-5 border-b border-white/5 bg-white/5 flex items-start justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                :class="getTypeConfig(selectedItem.type).color.split(' ').slice(1).join(' ')"
              >
                <UIcon :name="getTypeConfig(selectedItem.type).icon" class="w-4 h-4" :class="getTypeConfig(selectedItem.type).color.split(' ')[0]" />
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-bold text-white truncate">{{ selectedItem.title }}</h2>
                <p v-if="selectedItem.description" class="text-gray-400 text-xs mt-0.5">{{ selectedItem.description }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <template v-if="selectedItem.type === 'prompt'">
                <div class="flex gap-1">
                  <button
                    v-for="tool in AI_TOOLS"
                    :key="tool.id"
                    @click="openInAI(tool.id, selectedItem.code)"
                    class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[10px] font-bold uppercase tracking-wide transition-colors border border-white/5"
                    :title="`Open in ${tool.name}`"
                  >
                    {{ tool.name }}
                  </button>
                </div>
              </template>

              <button
                v-if="selectedItem.type === 'template' && templateVariables.length"
                @click="showViewModal = false; openFillModal(selectedItem)"
                class="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
                Fill Variables
              </button>

              <button
                @click="copyText(selectedItem.code, selectedItem.id)"
                class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                :title="copiedId === selectedItem.id ? 'Copied!' : 'Copy'"
              >
                <UIcon :name="copiedId === selectedItem.id ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" class="w-5 h-5" :class="copiedId === selectedItem.id ? 'text-green-400' : ''" />
              </button>

              <button @click="showViewModal = false" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div v-if="selectedItem.tags?.length" class="px-5 pt-3 flex gap-2 flex-wrap">
            <span
              v-for="tag in selectedItem.tags"
              :key="tag"
              class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-medium border border-white/5"
            >
              {{ tag }}
            </span>
          </div>

          <div class="flex-1 overflow-auto">

            <!-- Code / Config -->
            <div v-if="selectedItem.type === 'code' || selectedItem.type === 'config'" class="bg-[#2e3440] p-6">
              <div v-html="highlightedCode"></div>
            </div>

            <!-- Prompt -->
            <div v-else-if="selectedItem.type === 'prompt'" class="p-6">
              <div class="flex items-center gap-2 mb-4 flex-wrap">
                <p class="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Open in:</p>
                <button
                  v-for="tool in AI_TOOLS"
                  :key="tool.id"
                  @click="openInAI(tool.id, selectedItem.code)"
                  class="px-4 py-2 rounded-lg bg-white/5 hover:bg-primary/20 text-gray-300 hover:text-primary text-xs font-bold transition-colors border border-white/5 hover:border-primary/30 flex items-center gap-2"
                >
                  <UIcon name="i-heroicons-sparkles" class="w-3.5 h-3.5" />
                  {{ tool.name }}
                </button>
              </div>
              <pre class="font-mono text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-5 border border-white/5">{{ selectedItem.code }}</pre>
            </div>

            <!-- Template -->
            <div v-else-if="selectedItem.type === 'template'" class="p-6">
              <div v-if="templateVariables.length" class="flex items-center gap-2 mb-4 bg-primary/5 border border-primary/10 rounded-xl p-3">
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-primary shrink-0" />
                <p class="text-xs text-gray-400">
                  This template has <span class="text-primary font-bold">{{ templateVariables.length }} variable{{ templateVariables.length !== 1 ? 's' : '' }}</span>:
                  <span class="font-mono text-primary ml-1">{{ templateVariablesList }}</span>
                </p>
                <button
                  @click="showViewModal = false; openFillModal(selectedItem)"
                  class="ml-auto shrink-0 text-xs font-bold text-primary hover:text-white transition-colors whitespace-nowrap"
                >
                  Fill &amp; Copy →
                </button>
              </div>
              <pre class="font-mono text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-5 border border-white/5">{{ selectedItem.code }}</pre>
            </div>

            <!-- Doc -->
            <div v-else-if="selectedItem.type === 'doc'" class="p-6">
              <div class="prose prose-invert max-w-none prose-indigo leading-relaxed text-gray-300" v-html="renderedDoc"></div>
            </div>

          </div>

          <div class="p-4 border-t border-white/5 bg-white/5 flex items-center justify-between text-xs text-gray-500">
            <div class="flex items-center gap-4">
              <span>Added {{ new Date(selectedItem.created_at).toLocaleDateString() }}</span>
              <button
                @click="togglePin(selectedItem, $event)"
                class="flex items-center gap-1 transition-colors"
                :class="selectedItem.is_pinned ? 'text-yellow-400' : 'hover:text-yellow-400'"
              >
                <UIcon :name="selectedItem.is_pinned ? 'i-heroicons-star-solid' : 'i-heroicons-star'" class="w-3.5 h-3.5" />
                {{ selectedItem.is_pinned ? 'Pinned' : 'Pin' }}
              </button>
            </div>
            <button @click="deleteResource(selectedItem.id)" class="text-red-400 hover:text-red-300 hover:underline">Delete</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Template fill modal ────────────────────────────────────────────────── -->
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showFillModal && selectedItem" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div @click="showFillModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          <div class="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div>
              <h2 class="text-white font-bold">Fill Template</h2>
              <p class="text-gray-500 text-xs mt-0.5">{{ selectedItem.title }}</p>
            </div>
            <button @click="showFillModal = false" class="text-gray-400 hover:text-white">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 overflow-y-auto space-y-6">

            <!-- Variable inputs -->
            <div>
              <p class="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-3">Variables</p>
              <div class="space-y-3">
                <div v-for="variable in templateVariables" :key="variable">
                  <!-- wrapVariable() keeps {{ }} out of the template compiler -->
                  <label class="block text-xs font-bold text-gray-400 mb-1 font-mono">{{ wrapVariable(variable) }}</label>
                  <input
                    v-model="filledVariables[variable]"
                    type="text"
                    :placeholder="`Enter ${variable.replace(/_/g, ' ')}...`"
                    class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-primary focus:outline-none placeholder-gray-700 transition-colors"
                  />
                </div>
              </div>
            </div>

            <!-- Preview -->
            <div>
              <p class="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-3">Preview</p>
              <pre class="font-mono text-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-white/[0.03] rounded-xl p-4 border border-white/5 max-h-60 overflow-y-auto">{{ filledContent }}</pre>
            </div>

            <!-- Copy action -->
            <div class="flex gap-3">
              <button type="button" @click="showFillModal = false" class="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold transition-all">
                Cancel
              </button>
              <button
                @click="copyText(filledContent, 'filled'); showFillModal = false"
                class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <UIcon :name="copiedId === 'filled' ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'" class="w-5 h-5" />
                {{ copiedId === 'filled' ? 'Copied!' : 'Copy Filled Template' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Create modal ───────────────────────────────────────────────────────── -->
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div @click="showCreateModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

          <div class="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
            <h2 class="text-lg font-bold text-white">Add to Library</h2>
            <button @click="showCreateModal = false" class="text-gray-400 hover:text-white">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <form @submit.prevent="createResource" class="p-6 overflow-y-auto space-y-5">

            <!-- Type selector -->
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Type</label>
              <div class="grid grid-cols-5 gap-2">
                <button
                  type="button"
                  v-for="t in RESOURCE_TYPES"
                  :key="t.id"
                  @click="form.type = t.id"
                  class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all border"
                  :class="form.type === t.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'"
                >
                  <UIcon :name="t.icon" class="w-4 h-4" />
                  {{ t.label }}
                </button>
              </div>

              <!-- Type hint — {{ }} kept in script constants to avoid compiler conflicts -->
              <p class="text-[10px] text-gray-600 mt-2">
                <template v-if="form.type === 'code'">Syntax-highlighted code snippets. Use for reusable functions, queries, and patterns.</template>
                <template v-else-if="form.type === 'prompt'">AI prompts for Claude, ChatGPT, Gemini, Cursor, Midjourney. {{ HINT_PROMPT_VARS }}</template>
                <template v-else-if="form.type === 'template'">Email, message, or proposal templates. {{ HINT_TEMPLATE_VARS }}</template>
                <template v-else-if="form.type === 'doc'">Markdown documentation, SOPs, how-to guides, or reference notes.</template>
                <template v-else-if="form.type === 'config'">ENV templates, config files, API endpoint lists, boilerplate setup.</template>
              </p>
            </div>

            <!-- Title + Language -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="md:col-span-2">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Title <span class="text-red-500">*</span></label>
                <input v-model="form.title" type="text" required placeholder="Give it a clear name..." class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-600" />
              </div>
              <div v-if="form.type === 'code' || form.type === 'config'">
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Language</label>
                <div class="relative">
                  <select v-model="form.language" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                    <option v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">{{ lang.name }}</option>
                  </select>
                  <UIcon name="i-heroicons-chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Description</label>
              <input v-model="form.description" type="text" placeholder="Brief description of what this is for..." class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-600" />
            </div>

            <!-- Content -->
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Content <span class="text-red-500">*</span></label>
              <textarea
                v-model="form.code"
                required
                rows="10"
                :placeholder="placeholderMap[form.type] || 'Content...'"
                class="w-full bg-[#0b1221] border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:border-primary focus:outline-none resize-none leading-relaxed"
              ></textarea>
              <!-- HINT_VARIABLE_NAME kept in script to avoid {{ }} compiler conflicts -->
              <p v-if="form.type === 'prompt' || form.type === 'template'" class="text-[10px] text-gray-600 mt-1">
                Use <span class="font-mono text-gray-400">{{ HINT_VARIABLE_NAME }}</span> for dynamic parts that you'll fill in at use time.
              </p>
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Tags</label>
              <input
                v-model="form.tags"
                type="text"
                placeholder="comma, separated, tags"
                class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-600"
              />
            </div>

            <!-- Optional links -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Link to Project</label>
                <div class="relative">
                  <select v-model="form.project_id" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer text-sm">
                    <option value="">None</option>
                    <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                  <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div>
                <label class="block text-[10px] uppercase font-bold text-gray-500 mb-2">Link to Client</label>
                <div class="relative">
                  <select v-model="form.client_id" class="w-full bg-base border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer text-sm">
                    <option value="">None</option>
                    <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                  <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>

            <!-- Pin toggle -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                @click="form.is_pinned = !form.is_pinned"
                class="w-10 h-6 rounded-full relative transition-colors"
                :class="form.is_pinned ? 'bg-yellow-400' : 'bg-white/10'"
              >
                <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" :class="form.is_pinned ? 'left-5' : 'left-1'"></div>
              </button>
              <label class="text-sm text-gray-400 font-medium cursor-pointer" @click="form.is_pinned = !form.is_pinned">
                Pin to top of library
              </label>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2 border-t border-white/5">
              <button type="button" @click="showCreateModal = false" class="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold transition-all">Cancel</button>
              <button type="submit" :disabled="saving" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
                {{ saving ? 'Saving...' : 'Save to Library' }}
              </button>
            </div>

          </form>
        </div>
      </div>
    </Transition>

    <!-- Toast -->
    <Transition enter-active-class="transform ease-out duration-300 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="toast.show" class="fixed bottom-4 right-4 z-50">
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border" :class="toast.type === 'success' ? 'bg-[#0f172a] border-green-500/50' : 'bg-[#0f172a] border-red-500/50'">
          <UIcon :name="toast.type === 'success' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'" class="w-5 h-5" :class="toast.type === 'success' ? 'text-green-400' : 'text-red-400'" />
          <span class="font-bold text-sm text-white">{{ toast.message }}</span>
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

:deep(.hljs) {
  background: transparent !important;
  padding: 0;
  margin: 0;
  color: #d8dee9;
}
:deep(.prose) { color: #cbd5e1; }
:deep(.prose h1), :deep(.prose h2), :deep(.prose h3) { color: white; font-weight: 700; }
:deep(.prose code) { background: #1e293b; color: #818cf8; padding: 0.2em 0.4em; border-radius: 4px; }
:deep(.prose pre) { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
:deep(.prose a) { color: #818cf8; }
:deep(.prose blockquote) { border-left-color: #818cf8; color: #94a3b8; }
</style>