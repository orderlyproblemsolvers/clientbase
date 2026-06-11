<script setup lang="ts">
const supabase = useSupabaseClient()
const { isOpen: showSearch } = useGlobalSearch()
const query = ref('')
const results = ref<any[]>([])
const loading = ref(false)
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// Debounced search
watch(query, (newVal) => {
  if (debounceTimer.value) clearTimeout(debounceTimer.value)
  if (!newVal.trim()) {
    results.value = []
    return
  }
  debounceTimer.value = setTimeout(async () => {
    await search()
  }, 300)
})

const search = async () => {
  loading.value = true
  try {
    const { data } = await supabase.rpc('global_search', { query: query.value })
    results.value = data || []
  } catch (e) {
    console.error('Search failed:', e)
    results.value = []
  } finally {
    loading.value = false
  }
}

// Keyboard shortcut
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    showSearch.value = !showSearch.value
  }
  if (e.key === 'Escape') showSearch.value = false
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// Close on route change
const route = useRoute()
watch(() => route.path, () => { showSearch.value = false })

const entityIcons: Record<string, string> = {
  client: 'i-heroicons-building-office-2',
  project: 'i-heroicons-folder-open',
  snippet: 'i-heroicons-code-bracket',
  invoice: 'i-heroicons-banknotes',
}

const entityColors: Record<string, string> = {
  client: 'text-primary',
  project: 'text-blue-400',
  snippet: 'text-purple-400',
  invoice: 'text-amber-400',
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showSearch"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4"
        role="dialog"
        aria-modal="true"
      >
        <!-- Scrim -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showSearch = false" />

        <!-- Panel -->
        <div class="relative w-full max-w-xl bg-[#0d1525] border border-white/8 rounded-2xl shadow-2xl overflow-hidden">
          <!-- Input -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-white/5">
            <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5 text-slate-500" />
            <input
              v-model="query"
              type="text"
              placeholder="Search clients, projects, snippets, invoices…"
              class="w-full bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none"
              autofocus
              @keydown.escape="showSearch = false"
            />
            <kbd class="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/8 text-[10px] text-slate-500 font-semibold">
              <span class="text-xs">⌘</span>K
            </kbd>
          </div>

          <!-- Results -->
          <div class="max-h-[60vh] overflow-y-auto p-2">
            <!-- Loading -->
            <div v-if="loading" class="flex justify-center py-10">
              <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary" />
            </div>

            <!-- Empty -->
            <div v-else-if="query && results.length === 0" class="py-10 text-center text-sm text-slate-500">
              Nothing found for “{{ query }}”
            </div>

            <!-- Grouped results -->
            <template v-else>
              <div v-for="group in ['client', 'project', 'snippet', 'invoice']" :key="group">
                <template v-if="results.filter(r => r.entity_type === group).length > 0">
                  <p class="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    {{ group }}s
                  </p>
                  <NuxtLink
                    v-for="item in results.filter(r => r.entity_type === group)"
                    :key="item.entity_id"
                    :to="item.url"
                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                    @click="showSearch = false"
                  >
                    <div class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <UIcon :name="entityIcons[item.entity_type]" class="w-3.5 h-3.5" :class="entityColors[item.entity_type]" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-white truncate">{{ item.title }}</p>
                      <p v-if="item.subtitle" class="text-xs text-slate-500 truncate">{{ item.subtitle }}</p>
                    </div>
                    <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors ml-auto" />
                  </NuxtLink>
                </template>
              </div>
            </template>
          </div>

          <!-- Footer hint -->
          <div class="px-5 py-3 border-t border-white/5 flex items-center gap-4 text-[10px] text-slate-600">
            <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 rounded bg-white/5 border border-white/8">↑↓</kbd> Navigate</span>
            <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 rounded bg-white/5 border border-white/8">↵</kbd> Open</span>
            <span class="flex items-center gap-1"><kbd class="px-1 py-0.5 rounded bg-white/5 border border-white/8">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(8px) scale(0.98);
}
</style>