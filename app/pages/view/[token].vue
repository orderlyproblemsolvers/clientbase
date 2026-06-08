<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const supabase = useSupabaseClient()

const token = route.params.token as string
const loading = ref(true)
const project = ref<any>(null)
const files = ref<any[]>([])

const fetchProject = async () => {
  loading.value = true
  try {
    // Use the secure function instead of a direct query
    const { data, error } = await supabase.rpc('get_shared_project', {
      p_share_token: token
    })

    if (error) throw error

    if (data && data.length > 0) {
      const row = data[0]
      // Map the flat function result back to the shape the template expects
      project.value = {
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        start_date: row.start_date,
        end_date: row.end_date,
        budget: row.budget,
        currency: row.currency,
        notes: row.notes,
        clients: {
          name: row.client_name,
          website: row.client_website
        }
      }

      // Fetch files via the secure function
      const { data: fileData } = await supabase.rpc('get_shared_files', {
        p_project_id: row.id
      })
      files.value = fileData || []
    } else {
      project.value = null
    }
  } catch (e) {
    console.error(e)
    project.value = null
  } finally {
    loading.value = false
  }
}

const downloadFile = async (path: string) => {
  const { data } = await supabase.storage
    .from('project_files')
    .createSignedUrl(path, 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

onMounted(() => fetchProject())
</script>

<template>
  <div class="min-h-screen bg-base font-sans p-6">
    <div v-if="loading" class="flex justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!project" class="text-center py-20">
      <h2 class="text-xl font-bold text-white mb-4">Invalid or expired link</h2>
      <p class="text-slate-400">The project you're looking for doesn't exist or the link is broken.</p>
    </div>

    <div v-else class="max-w-3xl mx-auto space-y-8">
      <!-- Client / project header -->
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <span class="text-primary font-bold text-lg">
            {{ project.name?.charAt(0).toUpperCase() }}
          </span>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-white">{{ project.name }}</h1>
          <p v-if="client" class="text-slate-400 text-sm">{{ client.name }}</p>
        </div>
      </div>

      <!-- Status badge -->
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border"
              :class="{
                'text-slate-300 bg-slate-400/10 border-slate-400/20': project.status === 'lead',
                'text-blue-300 bg-blue-400/10 border-blue-400/20': project.status === 'proposal',
                'text-emerald-300 bg-emerald-400/10 border-emerald-400/20': project.status === 'active',
                'text-amber-300 bg-amber-400/10 border-amber-400/20': project.status === 'review',
                'text-violet-300 bg-violet-400/10 border-violet-400/20': project.status === 'complete',
                'text-slate-500 bg-slate-600/10 border-slate-600/20': project.status === 'archived',
              }">
          <span class="w-1.5 h-1.5 rounded-full" :class="{
            'bg-slate-400': project.status === 'lead',
            'bg-blue-400': project.status === 'proposal',
            'bg-emerald-400': project.status === 'active',
            'bg-amber-400': project.status === 'review',
            'bg-violet-400': project.status === 'complete',
            'bg-slate-600': project.status === 'archived',
          }" />
          {{ project.status }}
        </span>
      </div>

      <!-- Description -->
      <div v-if="project.description" class="bg-white/[0.03] border border-white/6 rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-white mb-2">Description</h3>
        <p class="text-slate-400 text-sm leading-relaxed">{{ project.description }}</p>
      </div>

      <!-- Dates & budget -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Start</p>
          <p class="text-sm font-medium text-white">
            {{ project.start_date ? new Date(project.start_date).toLocaleDateString() : '—' }}
          </p>
        </div>
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">End</p>
          <p class="text-sm font-medium text-white">
            {{ project.end_date ? new Date(project.end_date).toLocaleDateString() : '—' }}
          </p>
        </div>
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Budget</p>
          <p class="text-sm font-medium text-white">
            {{ project.budget ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: project.currency }).format(project.budget) : '—' }}
          </p>
        </div>
        <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-4">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Currency</p>
          <p class="text-sm font-medium text-white">{{ project.currency }}</p>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="project.notes" class="bg-white/[0.03] border border-white/6 rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-white mb-2">Project Notes</h3>
        <div class="prose prose-invert max-w-none prose-indigo text-slate-300 text-sm leading-relaxed" v-html="renderedNotes"></div>
      </div>

      <!-- Files -->
      <div v-if="files.length" class="bg-white/[0.03] border border-white/6 rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Shared Files</h3>
        <div class="grid gap-3">
          <div v-for="f in files" :key="f.id" class="flex items-center justify-between bg-white/[0.04] border border-white/6 rounded-xl p-3">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-document" class="w-5 h-5 text-primary" />
              <span class="text-sm text-white">{{ f.file_name }}</span>
            </div>
            <button @click="downloadFile(f.file_path)" class="p-2 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
              <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>