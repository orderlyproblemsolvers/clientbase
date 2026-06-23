<script setup lang="ts">
definePageMeta({ layout: false })

const { $md } = useNuxtApp()
const route = useRoute()
const supabase = useSupabaseClient()
const token = route.params.token as string

const activeTab = ref<'overview' | 'files' | 'invoices' | 'notes' | 'milestones'>('overview')

const loading = ref(true)
const fetchError = ref('')
const project = ref<any>(null)
const files = ref<any[]>([])
const invoices = ref<any[]>([])
const milestones = ref<any[]>([])
const provider = ref({ brandColor: '#4d48e5', name: '', organization: '' })
const renderedNotes = ref('')

const previewFile = ref<any>(null)

const fileViewMode = ref<'grid' | 'list'>('grid')

const tabs = computed(() => [
  { key: 'overview',   label: 'Overview',   icon: 'i-heroicons-home',                   visible: true },
  { key: 'files',      label: 'Files',      icon: 'i-heroicons-folder-open',             visible: files.value.length > 0 },
  { key: 'invoices',   label: 'Invoices',   icon: 'i-heroicons-banknotes',               visible: invoices.value.length > 0 },
  { key: 'milestones', label: 'Milestones', icon: 'i-heroicons-flag',                    visible: milestones.value.length > 0 },
  { key: 'notes',      label: 'Notes',      icon: 'i-heroicons-document-text',           visible: project.value?.notes?.length > 0 },
])

const fetchProject = async () => {
  loading.value = true
  fetchError.value = ''
  try {
    const { data: projectData, error: projectError } = await supabase
      .rpc('get_shared_project', { p_share_token: token })
    if (projectError) throw projectError
    if (!projectData || projectData.length === 0) {
      project.value = null
      return
    }

    const row = projectData[0]
    project.value = {
      id:          row.id,
      name:        row.name,
      description: row.description,
      status:      row.status,
      start_date:  row.start_date,
      end_date:    row.end_date,
      budget:      row.budget,
      currency:    row.currency,
      notes:       row.notes,
      clients:     { name: row.client_name, website: row.client_website },
    }

    if (row.preferences) {
      provider.value = {
        brandColor:   row.preferences.brand_color || '#4d48e5',
        name:         row.profile_name || '',
        organization: row.profile_organization || '',
      }
      document.documentElement.style.setProperty('--brand-color', provider.value.brandColor)
    }

    const { data: fileData } = await supabase
      .rpc('get_shared_files', { p_project_id: row.id })
    files.value = (fileData || []).map((f: any) => ({
      ...f,
      signedUrl:      null,
      urlFetchedAt:   null,
      urlLoading:     false,
    }))

    const { data: invoiceData } = await supabase
      .rpc('get_shared_invoices', { p_project_id: row.id })
    invoices.value = invoiceData || []

    const { data: milestoneData } = await supabase
      .rpc('get_shared_milestones', { p_project_id: row.id })
    milestones.value = milestoneData || []

    if (project.value.notes) {
      renderedNotes.value = $md.render(project.value.notes)
    }
  } catch (e: any) {
    console.error(e)
    fetchError.value = e.message || 'Failed to load project'
    project.value = null
  } finally {
    loading.value = false
  }
}

const isUrlFresh = (file: any) => {
  if (!file.signedUrl || !file.urlFetchedAt) return false
  return Date.now() - file.urlFetchedAt < 4 * 60 * 1000
}

const ensureSignedUrl = async (file: any) => {
  if (isUrlFresh(file)) return file.signedUrl
  file.urlLoading = true
  try {
    const { signedUrl } = await $fetch('/api/files/shared-download', {
      query: { fileId: file.id, token }
    })
    file.signedUrl    = signedUrl
    file.urlFetchedAt = Date.now()
    return signedUrl
  } finally {
    file.urlLoading = false
  }
}

const openPreview = async (file: any) => {
  previewFile.value = file
  if (!isUrlFresh(file)) {
    await ensureSignedUrl(file)
  }
}

const closePreview = () => {
  previewFile.value = null
}

const downloadFile = async (file: any) => {
  try {
    const url = await ensureSignedUrl(file)
    window.open(url, '_blank')
  } catch {
    // silently fail
  }
}

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  lead:     { label: 'Lead',     dot: 'bg-slate-400',   badge: 'text-slate-600 bg-slate-100 border-slate-200'     },
  proposal: { label: 'Proposal', dot: 'bg-blue-400',    badge: 'text-blue-600 bg-blue-50 border-blue-200'         },
  active:   { label: 'Active',   dot: 'bg-emerald-400', badge: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  review:   { label: 'Review',   dot: 'bg-amber-400',   badge: 'text-amber-600 bg-amber-50 border-amber-200'       },
  complete: { label: 'Complete', dot: 'bg-violet-400',  badge: 'text-violet-600 bg-violet-50 border-violet-200'   },
  archived: { label: 'Archived', dot: 'bg-slate-600',   badge: 'text-slate-500 bg-slate-100 border-slate-200'     },
}

const invoiceStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-600 bg-amber-50 border-amber-200',       dot: 'bg-amber-400'   },
  paid:      { label: 'Paid',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-400' },
  overdue:   { label: 'Overdue',   color: 'text-red-600 bg-red-50 border-red-200',             dot: 'bg-red-400'     },
  cancelled: { label: 'Cancelled', color: 'text-slate-500 bg-slate-50 border-slate-200',       dot: 'bg-slate-400'   },
}

const isOverdue = (inv: any) =>
  inv.status === 'overdue' || (inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < new Date())

const effectiveInvoiceStatus = (inv: any) => isOverdue(inv) ? 'overdue' : inv.status

const fmtCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const isImage = (type: string) => type?.startsWith('image/')
const isPdf   = (type: string) => type === 'application/pdf'

onMounted(() => fetchProject())
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">

    <!-- Loading Skeleton -->
    <div v-if="loading" class="flex-1 py-8 px-4 max-w-4xl mx-auto w-full">
      <div class="animate-pulse space-y-6">
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-wrap items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gray-200"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 w-48 bg-gray-200 rounded"></div>
            <div class="h-3 w-32 bg-gray-200 rounded"></div>
          </div>
          <div class="h-6 w-20 bg-gray-200 rounded-full"></div>
        </div>
        <div class="flex gap-2">
          <div v-for="i in 4" :key="i" class="h-10 w-24 bg-gray-200 rounded-lg"></div>
        </div>
        <div class="space-y-4">
          <div class="h-32 bg-white border border-gray-200 rounded-2xl"></div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div v-for="j in 4" :key="j" class="h-20 bg-white border border-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError || !project" class="flex-1 flex items-center justify-center py-20 px-4">
      <div class="text-center max-w-sm">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500" />
        </div>
        <h2 class="text-xl font-bold text-gray-800 mb-2">Link Invalid</h2>
        <p class="text-gray-500 text-sm">{{ fetchError || 'The project link is broken or has expired.' }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-8">

      <!-- Header Card -->
      <div class="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 mb-6 shadow-sm">
        <div class="flex flex-wrap items-center gap-3 md:gap-4">
          <div
            class="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0"
            :style="{ backgroundColor: provider.brandColor + '15', border: '1px solid ' + provider.brandColor + '30' }"
          >
            <span class="font-bold text-lg md:text-xl" :style="{ color: provider.brandColor }">
              {{ project.name?.charAt(0).toUpperCase() }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl md:text-2xl font-bold text-gray-900 truncate">{{ project.name }}</h1>
            <p class="text-gray-500 text-sm">{{ project.clients?.name }}</p>
          </div>
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
            :class="statusConfig[project.status]?.badge"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="statusConfig[project.status]?.dot" />
            {{ statusConfig[project.status]?.label }}
          </span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="flex gap-1 mb-6 border-b border-gray-200 pb-1 overflow-x-auto no-scrollbar">
        <button
          v-for="tab in tabs.filter(t => t.visible)"
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="[
            'flex items-center gap-1.5 px-3 md:px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
            activeTab === tab.key
              ? 'text-white shadow-md'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          ]"
          :style="activeTab === tab.key ? { backgroundColor: provider.brandColor } : {}"
        >
          <UIcon :name="tab.icon" class="w-4 h-4 hidden sm:inline" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <Transition name="tab-fade" mode="out-in">

        <!-- Overview -->
        <div v-if="activeTab === 'overview'" key="overview" class="space-y-5">
          <div v-if="project.description" class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Description</h3>
            <p class="text-gray-600 text-sm leading-relaxed">{{ project.description }}</p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Start</p>
              <p class="text-sm font-medium text-gray-800">{{ project.start_date ? fmtDate(project.start_date) : '—' }}</p>
            </div>
            <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">End</p>
              <p class="text-sm font-medium text-gray-800">{{ project.end_date ? fmtDate(project.end_date) : '—' }}</p>
            </div>
            <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Budget</p>
              <p class="text-sm font-medium text-gray-800">{{ project.budget ? fmtCurrency(project.budget, project.currency) : '—' }}</p>
            </div>
            <div class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Currency</p>
              <p class="text-sm font-medium text-gray-800">{{ project.currency }}</p>
            </div>
          </div>
        </div>

        <!-- Files -->
        <div v-else-if="activeTab === 'files'" key="files">
          <!-- View toggle -->
          <div class="flex items-center justify-end mb-4">
            <div class="bg-gray-100 p-1 rounded-lg flex gap-1">
              <button
                @click="fileViewMode = 'grid'"
                :class="fileViewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              >
                <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
              </button>
              <button
                @click="fileViewMode = 'list'"
                :class="fileViewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              >
                <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Grid View -->
          <div v-if="fileViewMode === 'grid'" class="grid grid-cols-1 xs:grid-cols-2 gap-3 md:gap-4">
            <div
              v-for="file in files"
              :key="file.id"
              class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
              @click="openPreview(file)"
            >
              <div class="relative h-36 xs:h-40 md:h-48 bg-gray-100 flex items-center justify-center">
                <img
                  v-if="isImage(file.file_type) && file.signedUrl"
                  :src="file.signedUrl"
                  :alt="file.file_name"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div v-else-if="file.urlLoading" class="flex items-center justify-center w-full h-full">
                  <div class="w-8 h-8 border-2 border-gray-300 rounded-full animate-spin"
                       :style="{ borderTopColor: provider.brandColor }"></div>
                </div>
                <div v-else-if="isPdf(file.file_type)" class="text-center p-4">
                  <UIcon name="i-heroicons-document-text" class="w-8 h-8 md:w-10 md:h-10 text-gray-400 mb-2 mx-auto" />
                  <span class="text-xs text-gray-500">PDF</span>
                </div>
                <div v-else class="text-center p-4">
                  <UIcon name="i-heroicons-document" class="w-8 h-8 md:w-10 md:h-10 text-gray-400 mb-2 mx-auto" />
                  <span class="text-xs text-gray-500">File</span>
                </div>
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div class="w-12 h-12 rounded-full bg-white/90 shadow flex items-center justify-center">
                    <UIcon name="i-heroicons-eye" class="w-6 h-6 text-gray-700" />
                  </div>
                </div>
              </div>
              <div class="p-3 flex items-center justify-between">
                <span class="text-sm font-medium text-gray-800 truncate flex-1 mr-2">{{ file.file_name }}</span>
                <button
                  @click.stop="downloadFile(file)"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                  title="Download"
                >
                  <UIcon v-if="file.urlLoading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                  <UIcon v-else name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- List View -->
          <div v-else class="space-y-2">
            <div
              v-for="file in files"
              :key="file.id"
              class="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 group"
              @click="openPreview(file)"
            >
              <!-- Thumbnail or icon -->
              <div class="w-10 h-10 shrink-0 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                <img
                  v-if="isImage(file.file_type) && file.signedUrl"
                  :src="file.signedUrl"
                  :alt="file.file_name"
                  class="w-full h-full object-cover"
                />
                <UIcon v-else-if="isPdf(file.file_type)" name="i-heroicons-document-text" class="w-5 h-5 text-gray-400" />
                <UIcon v-else name="i-heroicons-document" class="w-5 h-5 text-gray-400" />
              </div>
              <!-- File info -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-800 truncate">{{ file.file_name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ file.file_type?.split('/')[1] || 'File' }}
                  <span v-if="file.file_size" class="ml-2">{{ (file.file_size / 1024).toFixed(1) }} KB</span>
                </p>
              </div>
              <!-- Download -->
              <button
                @click.stop="downloadFile(file)"
                class="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                title="Download"
              >
                <UIcon v-if="file.urlLoading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                <UIcon v-else name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Invoices -->
        <div v-else-if="activeTab === 'invoices'" key="invoices" class="space-y-3 md:space-y-4">
          <div
            v-for="inv in invoices"
            :key="inv.id"
            class="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4"
          >
            <div class="flex-1 min-w-0">
              <p class="text-gray-900 font-bold font-mono text-sm md:text-base">{{ inv.invoice_number }}</p>
              <p class="text-gray-600 text-sm mt-0.5 truncate">{{ inv.title }}</p>
              <p class="text-gray-400 text-xs mt-1">Due {{ inv.due_date ? fmtDate(inv.due_date) : '—' }}</p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-base md:text-lg font-mono font-bold text-gray-900">{{ fmtCurrency(inv.amount, inv.currency) }}</span>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.color"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.dot" />
                {{ invoiceStatusConfig[effectiveInvoiceStatus(inv)]?.label }}
              </span>
              <a
                v-if="inv.payment_link"
                :href="inv.payment_link"
                target="_blank"
                class="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                :style="{ backgroundColor: provider.brandColor }"
              >
                Pay Now
              </a>
            </div>
          </div>
        </div>

        <!-- Milestones -->
        <div v-else-if="activeTab === 'milestones'" key="milestones" class="space-y-4">
          <div v-if="milestones.length === 0" class="text-center py-12 text-gray-500">
            <UIcon name="i-heroicons-flag" class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No active milestones yet.</p>
          </div>
          <div
            v-for="m in milestones"
            :key="m.id"
            class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center gap-4"
          >
            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-flag" class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-gray-900 font-semibold text-sm truncate">{{ m.title }}</p>
              <p class="text-gray-500 text-xs mt-0.5">
                Due {{ fmtDate(m.due_date) }}
                <span v-if="m.description" class="text-gray-400"> · {{ m.description }}</span>
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
              :class="{
                'text-emerald-600 bg-emerald-50 border-emerald-200': m.status === 'complete',
                'text-blue-600 bg-blue-50 border-blue-200':          m.status === 'in_progress',
                'text-slate-600 bg-slate-100 border-slate-200':      m.status === 'pending',
              }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="{
                  'bg-emerald-400': m.status === 'complete',
                  'bg-blue-400':    m.status === 'in_progress',
                  'bg-slate-400':   m.status === 'pending',
                }"
              />
              {{ m.status === 'in_progress' ? 'In Progress' : m.status.charAt(0).toUpperCase() + m.status.slice(1) }}
            </span>
          </div>
        </div>

        <!-- Notes -->
        <div v-else-if="activeTab === 'notes'" key="notes" class="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm">
          <div class="prose prose-sm max-w-none text-gray-700" v-html="renderedNotes"></div>
        </div>

      </Transition>
    </div>

    <!-- Footer -->
    <footer v-if="!loading" class="border-t border-gray-200 bg-white py-4 mt-auto">
      <div class="max-w-4xl mx-auto px-4 flex items-center justify-center gap-2 text-xs text-gray-400">
        <span>Powered by</span>
        <a href="/" target="_blank" class="hover:opacity-80 transition-opacity inline-flex items-center gap-1">
          <img src="/img/clientbase-main.svg" alt="ClientBase" class="h-8 w-auto" />
        </a>
        <span class="mx-1">·</span>
        <a href="/terms"   target="_blank" class="hover:text-gray-500 transition-colors">Terms</a>
        <span>·</span>
        <a href="/privacy" target="_blank" class="hover:text-gray-500 transition-colors">Privacy</a>
      </div>
    </footer>

    <!-- Preview Lightbox -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="previewFile"
          class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 md:p-4"
          @click="closePreview"
        >
          <div
            class="relative w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            @click.stop
          >
            <div class="flex items-center justify-between p-3 md:p-4 border-b border-gray-200">
              <p class="text-gray-900 font-medium text-sm truncate flex-1 mr-2">{{ previewFile.file_name }}</p>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click="downloadFile(previewFile)"
                  class="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Download"
                >
                  <UIcon
                    v-if="previewFile.urlLoading"
                    name="i-heroicons-arrow-path"
                    class="w-4 h-4 animate-spin"
                  />
                  <UIcon v-else name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
                </button>
                <button
                  @click="closePreview"
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                </button>
              </div>
            </div>
            <div class="overflow-auto" :style="{ maxHeight: 'calc(90vh - 60px)' }">
              <div v-if="previewFile.urlLoading" class="flex justify-center py-20">
                <div
                  class="w-8 h-8 border-2 border-gray-300 rounded-full animate-spin"
                  :style="{ borderTopColor: provider.brandColor }"
                ></div>
              </div>
              <img
                v-else-if="isImage(previewFile.file_type) && previewFile.signedUrl"
                :src="previewFile.signedUrl"
                :alt="previewFile.file_name"
                class="w-full h-auto object-contain"
              />
              <iframe
                v-else-if="isPdf(previewFile.file_type) && previewFile.signedUrl"
                :src="previewFile.signedUrl"
                class="w-full"
                :style="{ height: 'calc(90vh - 60px)' }"
                frameborder="0"
              ></iframe>
              <div v-else-if="!previewFile.urlLoading" class="p-8 text-center text-gray-500">
                <UIcon name="i-heroicons-document" class="w-10 h-10 mx-auto mb-4" />
                <p class="font-medium">Preview not available</p>
                <button
                  @click="downloadFile(previewFile)"
                  class="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  :style="{ backgroundColor: provider.brandColor }"
                >
                  Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
@media (max-width: 480px) {
  .xs\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .xs\:h-40 { height: 10rem; }
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.tab-fade-enter-active,
.tab-fade-leave-active { transition: opacity 0.2s ease; }
.tab-fade-enter-from,
.tab-fade-leave-to { opacity: 0; }

.modal-enter-active,
.modal-leave-active { transition: opacity 200ms ease; }
.modal-enter-active .relative,
.modal-leave-active .relative { transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1); }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .relative { transform: translateY(24px) scale(0.98); }
</style>