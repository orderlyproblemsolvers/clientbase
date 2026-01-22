<script setup lang="ts">
const { $md } = useNuxtApp()
const route = useRoute()
const client = useSupabaseClient()
const user = useSupabaseUser()

// Get ID from URL
const clientId = route.params.id as string

// --- State ---
const loading = ref(true)
const activeTab = ref('secrets') 
const clientData = ref<any>(null)
const secrets = ref<any[]>([])
const files = ref<any[]>([])
const events = ref<any[]>([]) 
const uploading = ref(false)
const isDeleting = ref(false)
const copiedSecretId = ref<string | null>(null)

// Secrets Form
const showSecretModal = ref(false)
const newSecret = ref({ name: '', value: '' })

// Advanced Notes State
const isEditingNotes = ref(false)
const notesDraft = ref('')
const isPreviewMode = ref(false)

// Schedule Form
const newEvent = ref({ title: '', date: '', type: 'deadline' })

// --- Actions ---

const fetchData = async () => {
  loading.value = true
  try {
    const { data: cData } = await client.from('clients').select('*').eq('id', clientId).single()
    clientData.value = cData
    notesDraft.value = cData.notes || ''

    const sData = await $fetch(`/api/secrets?client_id=${clientId}`)
    secrets.value = sData?.map((s: any) => ({ ...s, isRevealed: false })) || []

    const { data: fData } = await client.from('files').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    files.value = fData || []

    const { data: eData } = await client.from('events').select('*').eq('client_id', clientId).order('event_date', { ascending: true })
    events.value = eData || []

  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// --- Schedule Logic ---
const addEvent = async () => {
  if (!newEvent.value.title || !newEvent.value.date) return
  try {
    const { error } = await client.from('events').insert({
      client_id: clientId,
      title: newEvent.value.title,
      event_date: newEvent.value.date,
      event_type: newEvent.value.type
    })
    if (error) throw error
    newEvent.value = { title: '', date: '', type: 'deadline' }
    await fetchData()
  } catch (e: any) {
    alert(e.message)
  }
}

const toggleEvent = async (event: any) => {
  try {
    const { error } = await client.from('events').update({ is_completed: !event.is_completed }).eq('id', event.id)
    if (error) throw error
    event.is_completed = !event.is_completed
  } catch (e) {
    console.error(e)
  }
}

// --- Notes Logic ---
const saveNotes = async () => {
  try {
    const { error } = await client.from('clients').update({ notes: notesDraft.value }).eq('id', clientId)
    if (error) throw error
    clientData.value.notes = notesDraft.value
    isEditingNotes.value = false
    isPreviewMode.value = false
  } catch (e: any) {
    alert('Save failed: ' + e.message)
  }
}

// --- Secrets Logic ---
const addSecret = async () => {
  if (!newSecret.value.name || !newSecret.value.value) return
  try {
    await $fetch('/api/secrets', {
      method: 'POST',
      body: {
        client_id: clientId,
        key_name: newSecret.value.name,
        value: newSecret.value.value
      }
    })
    
    showSecretModal.value = false
    newSecret.value = { name: '', value: '' }
    await fetchData()
  } catch (e: any) {
    alert(e.message || 'Error saving secret')
  }
}

const deleteSecret = async (id: string) => {
  if(!confirm('Delete this secret?')) return
  await $fetch(`/api/secrets?id=${id}`, { method: 'DELETE' })
  await fetchData()
}

const copyToClipboard = (text: string, id: string) => {
  navigator.clipboard.writeText(text)
  copiedSecretId.value = id
  setTimeout(() => copiedSecretId.value = null, 2000)
}

// --- File Logic ---
const handleFileUpload = async (event: any) => {
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${user.value?.id}/${clientId}/${fileName}`

    const { error: uploadError } = await client.storage.from('project_files').upload(filePath, file)
    if (uploadError) throw uploadError

    const { error: dbError } = await client.from('files').insert({
      client_id: clientId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type
    })
    if (dbError) throw dbError
    await fetchData()
  } catch (e: any) {
    alert(e.message)
  } finally {
    uploading.value = false
  }
}

const downloadFile = async (path: string) => {
  const { data } = await client.storage.from('project_files').createSignedUrl(path, 60)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

// --- Client Deletion ---
const deleteClient = async () => {
  if (!confirm("Permanently delete this client and all associated data?")) return
  isDeleting.value = true
  try {
    const { data: filesToDelete } = await client.from('files').select('file_path').eq('client_id', clientId)
    if (filesToDelete && filesToDelete.length > 0) {
      await client.storage.from('project_files').remove(filesToDelete.map(f => f.file_path))
    }
    await client.from('clients').delete().eq('id', clientId)
    return navigateTo('/')
  } catch (error: any) {
    alert("Error: " + error.message)
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base p-4 md:p-8 font-sans">
    
    <nav class="flex items-center gap-2 text-sm text-gray-500 mb-8">
      <NuxtLink to="/" class="hover:text-primary transition-colors flex items-center gap-1">
        <UIcon name="i-heroicons-home" class="w-4 h-4" />
        Dashboard
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3 h-3 text-gray-600" />
      <span class="text-gray-300 font-medium">{{ clientData?.name || 'Loading...' }}</span>
    </nav>

    <div v-if="loading && !clientData" class="space-y-6">
      <div class="h-12 w-64 bg-secondary/50 animate-pulse rounded-lg"></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="h-24 bg-secondary/50 animate-pulse rounded-xl"></div>
      </div>
    </div>

    <div v-else>
      <header class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-white/5 pb-6 gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">{{ clientData.name }}</h1>
          <div class="flex items-center gap-3">
            <span class="bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <UIcon name="i-heroicons-tag" class="w-3 h-3" />
              {{ clientData.category || 'General' }}
            </span>
            <a v-if="clientData.website" :href="clientData.website" target="_blank" class="flex items-center gap-1 text-primary hover:text-white transition-colors text-sm font-medium">
              <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
              {{ clientData.website }}
            </a>
          </div>
        </div>
      </header>

      <div v-if="clientData?.contact_name" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div class="bg-secondary/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          <div class="p-3 bg-base rounded-lg text-gray-400">
            <UIcon name="i-heroicons-user" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Contact Person</p>
            <p class="text-white text-sm font-medium">{{ clientData.contact_name }}</p>
          </div>
        </div>
        <div v-if="clientData?.contact_email" class="bg-secondary/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          <div class="p-3 bg-base rounded-lg text-gray-400">
            <UIcon name="i-heroicons-envelope" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Email Address</p>
            <a :href="`mailto:${clientData.contact_email}`" class="text-primary text-sm font-medium hover:underline">{{ clientData.contact_email }}</a>
          </div>
        </div>
        <div v-if="clientData?.contact_phone" class="bg-secondary/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          <div class="p-3 bg-base rounded-lg text-gray-400">
            <UIcon name="i-heroicons-phone" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Phone Number</p>
            <a :href="`tel:${clientData.contact_phone}`" class="text-white text-sm font-medium hover:text-primary transition-colors">{{ clientData.contact_phone }}</a>
          </div>
        </div>
      </div>

      <div class="bg-secondary/30 p-1 rounded-xl flex gap-1 mb-8 overflow-x-auto border border-white/5 max-w-2xl">
        <button 
          v-for="tab in ['secrets', 'notes', 'files', 'schedule']" 
          :key="tab"
          @click="activeTab = tab" 
          :class="activeTab === tab ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'"
          class="flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all capitalize flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <UIcon v-if="tab === 'secrets'" name="i-heroicons-key" class="w-4 h-4" />
          <UIcon v-if="tab === 'notes'" name="i-heroicons-document-text" class="w-4 h-4" />
          <UIcon v-if="tab === 'files'" name="i-heroicons-folder-open" class="w-4 h-4" />
          <UIcon v-if="tab === 'schedule'" name="i-heroicons-calendar" class="w-4 h-4" />
          {{ tab }}
        </button>
      </div>

      <div v-if="activeTab === 'secrets'" class="animate-in fade-in duration-300">
        <div class="flex justify-end mb-4">
          <button @click="showSecretModal = true" class="bg-primary hover:bg-[#3d34d9] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
            <UIcon name="i-heroicons-plus" class="w-5 h-5" />
            Add Secret
          </button>
        </div>
        
        <div class="bg-secondary/40 border border-white/5 rounded-2xl overflow-hidden">
          
          <div v-if="secrets.length === 0" class="p-12 text-center flex flex-col items-center justify-center text-gray-500">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <UIcon name="i-heroicons-lock-closed" class="w-6 h-6 opacity-50" />
            </div>
            <p>No secrets stored yet.</p>
          </div>
          
          <div v-else class="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-white/5">
            <div class="col-span-3">Key Name</div>
            <div class="col-span-7">Value</div>
            <div class="col-span-2 text-right">Actions</div>
          </div>

          <div v-for="s in secrets" :key="s.id" class="p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center">
            
            <div class="md:col-span-3 font-medium text-white w-full flex justify-between md:justify-start items-center">
               <div class="flex items-center gap-2">
                 <UIcon name="i-heroicons-key" class="w-4 h-4 text-gray-500" />
                 {{ s.key_name }}
               </div>
               <UIcon :name="s.isRevealed ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4 text-gray-600 md:hidden" />
            </div>

            <div class="md:col-span-7 w-full font-mono text-sm">
               <button 
                @click="s.isRevealed = !s.isRevealed" 
                class="w-full text-left relative bg-base px-3 py-2.5 rounded-lg border border-white/5 hover:border-primary/50 transition-colors group"
               >
                  <span :class="!s.isRevealed ? 'blur-sm select-none opacity-50' : 'opacity-100'" class="block transition-all duration-300 truncate">
                    {{ s.isRevealed ? s.value : '••••••••••••••••••••••••' }}
                  </span>
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                    {{ s.isRevealed ? 'Hide' : 'Show' }}
                  </span>
               </button>
            </div>

            <div class="md:col-span-2 flex items-center justify-end gap-2 w-full md:w-auto mt-1 md:mt-0">
               <button @click="copyToClipboard(s.value, s.id)" class="flex-1 md:flex-none py-2 md:p-2 bg-white/5 md:bg-transparent rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2" :class="copiedSecretId === s.id ? 'text-green-400' : 'text-gray-400 hover:text-white'">
                 <UIcon :name="copiedSecretId === s.id ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-5 h-5" />
                 <span class="text-xs font-bold md:hidden">{{ copiedSecretId === s.id ? 'Copied' : 'Copy' }}</span>
               </button>

               <button @click="deleteSecret(s.id)" class="flex-1 md:flex-none py-2 md:p-2 bg-white/5 md:bg-transparent rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2">
                 <UIcon name="i-heroicons-trash" class="w-5 h-5" />
                 <span class="text-xs font-bold md:hidden">Delete</span>
               </button>
            </div>

          </div>
        </div>
      </div>

      <div v-if="activeTab === 'notes'" class="space-y-6 animate-in fade-in duration-300">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-secondary/40 p-2 pl-4 rounded-xl border border-white/5 gap-4">
          <div class="flex items-center gap-4">
            <h3 class="text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-primary" />
              Project Notes
            </h3>
            <div v-if="isEditingNotes" class="flex items-center gap-1 bg-base p-1 rounded-lg border border-white/5">
              <button @click="isPreviewMode = false" :class="!isPreviewMode ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'" class="px-3 py-1 text-xs rounded-md transition-all font-medium">Write</button>
              <button @click="isPreviewMode = true" :class="isPreviewMode ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'" class="px-3 py-1 text-xs rounded-md transition-all font-medium">Preview</button>
            </div>
          </div>
          <div class="flex gap-2 w-full sm:w-auto">
            <button v-if="!isEditingNotes" @click="isEditingNotes = true" class="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm transition-all w-full sm:w-auto flex items-center justify-center gap-2 font-medium">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
              Edit Notes
            </button>
            <template v-else>
              <button @click="isEditingNotes = false" class="text-gray-400 hover:text-white text-sm px-3 font-medium transition-colors">Cancel</button>
              <button @click="saveNotes" class="bg-primary hover:bg-[#3d34d9] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                <UIcon name="i-heroicons-check" class="w-4 h-4" />
                Save
              </button>
            </template>
          </div>
        </div>

        <div class="relative">
          <textarea v-if="isEditingNotes && !isPreviewMode" v-model="notesDraft" class="w-full bg-secondary border border-white/10 rounded-2xl p-8 text-gray-300 font-mono text-sm min-h-[500px] focus:outline-none focus:border-primary/50 transition-all leading-relaxed resize-y" placeholder="# Deployment Instructions..."></textarea>
          
          <div v-else class="bg-secondary/20 border border-white/5 rounded-2xl p-8 min-h-[500px]">
            <div v-if="notesDraft" class="prose prose-invert max-w-none prose-indigo leading-relaxed text-gray-300" v-html="$md.render(notesDraft)"></div>
            <div v-else class="flex flex-col items-center justify-center h-full py-20 text-gray-600 italic">
              <UIcon name="i-heroicons-pencil" class="w-12 h-12 opacity-20 mb-2" />
              No notes created yet.
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'files'" class="animate-in fade-in duration-300">
        <div class="mb-8 p-10 border-2 border-dashed border-white/10 rounded-2xl text-center hover:border-primary/50 hover:bg-white/[0.02] transition-all group relative cursor-pointer">
          <input type="file" @change="handleFileUpload" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" :disabled="uploading" />
          <div v-if="uploading" class="text-primary flex flex-col items-center animate-pulse">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mb-2" />
            <span class="font-bold">Uploading...</span>
          </div>
          <div v-else class="flex flex-col items-center gap-2 text-gray-500 group-hover:text-gray-300">
            <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
              <UIcon name="i-heroicons-cloud-arrow-up" class="w-6 h-6" />
            </div>
            <p class="text-white font-medium">Click or Drag to Upload</p>
            <p class="text-xs uppercase tracking-widest opacity-60">PDF, PNG, JPG (Max 5MB)</p>
          </div>
        </div>

        <div v-if="files.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="f in files" :key="f.id" class="flex items-center justify-between p-4 bg-secondary/60 border border-white/5 rounded-xl group hover:border-white/20 transition-all">
            <div class="flex items-center gap-4 overflow-hidden">
              <div class="p-3 bg-base rounded-lg text-primary">
                <UIcon name="i-heroicons-document-text" class="w-6 h-6" />
              </div>
              <div class="overflow-hidden">
                <p class="text-white text-sm font-medium truncate">{{ f.file_name }}</p>
                <p class="text-[10px] text-gray-500 uppercase font-bold">{{ new Date(f.created_at).toLocaleDateString() }}</p>
              </div>
            </div>
            <button @click="downloadFile(f.file_path)" class="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-colors" title="Download">
              <UIcon name="i-heroicons-arrow-down-tray" class="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div v-else-if="!uploading" class="text-center text-gray-600 py-10 italic">
          No documents uploaded yet.
        </div>
      </div>

      <div v-if="activeTab === 'schedule'" class="space-y-8 animate-in fade-in duration-300">
        <div class="bg-secondary/40 p-6 rounded-2xl border border-white/5">
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <UIcon name="i-heroicons-calendar-days" class="w-5 h-5" />
            Schedule Event
          </h3>
          <form @submit.prevent="addEvent" class="flex flex-col md:flex-row gap-4 items-end">
            <div class="flex-1 w-full">
              <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Title</label>
              <input v-model="newEvent.title" type="text" placeholder="Event Title (e.g. Domain Renewal)" class="w-full bg-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none placeholder-gray-600" />
            </div>
            <div class="w-full md:w-48">
              <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Type</label>
              <div class="relative">
                <select v-model="newEvent.type" class="w-full bg-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none appearance-none cursor-pointer">
                  <option value="deadline">⚠️ Deadline</option>
                  <option value="maintenance">🔧 Maintenance</option>
                  <option value="meeting">👥 Meeting</option>
                </select>
                <UIcon name="i-heroicons-chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div class="w-full md:w-48">
              <label class="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Date</label>
              <input v-model="newEvent.date" type="date" class="w-full bg-base border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-primary focus:outline-none text-sm" />
            </div>
            <button type="submit" class="w-full md:w-auto bg-primary hover:bg-[#3d34d9] text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
              <UIcon name="i-heroicons-plus" class="w-5 h-5" />
              Add
            </button>
          </form>
        </div>

        <div class="space-y-3">
          <div v-for="e in events" :key="e.id" class="flex items-center gap-4 group">
            <div class="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-secondary/80 border border-white/5 text-center shrink-0 shadow-sm">
              <span class="text-[10px] text-gray-400 uppercase font-bold">{{ new Date(e.event_date).toLocaleString('default', { month: 'short' }) }}</span>
              <span class="text-xl font-bold text-white">{{ new Date(e.event_date).getDate() }}</span>
            </div>
            
            <div class="flex-1 bg-secondary/30 hover:bg-secondary/50 border border-white/5 rounded-xl p-4 flex items-center justify-between transition-all group-hover:border-white/10">
              <div class="flex items-center gap-4">
                <button @click="toggleEvent(e)" class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0" :class="e.is_completed ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-primary'">
                  <UIcon v-if="e.is_completed" name="i-heroicons-check" class="w-4 h-4 text-black" />
                </button>
                <div>
                  <p :class="{ 'line-through text-gray-600': e.is_completed, 'text-white': !e.is_completed }" class="font-medium text-sm">{{ e.title }}</p>
                  <p class="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2 mt-0.5">
                    <span v-if="e.event_type === 'deadline'" class="text-red-400 flex items-center gap-1"><UIcon name="i-heroicons-clock" class="w-3 h-3" /> Expiry</span>
                    <span v-if="e.event_type === 'maintenance'" class="text-orange-400 flex items-center gap-1"><UIcon name="i-heroicons-wrench" class="w-3 h-3" /> Maintenance</span>
                    <span v-if="e.event_type === 'meeting'" class="text-blue-400 flex items-center gap-1"><UIcon name="i-heroicons-users" class="w-3 h-3" /> Meeting</span>
                  </p>
                </div>
              </div>
              
              <div v-if="!e.is_completed" class="hidden sm:block">
                 <span class="text-xs bg-base px-3 py-1.5 rounded-lg border border-white/5 text-gray-400 whitespace-nowrap font-medium">
                   {{ Math.ceil((new Date(e.event_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) }} days left
                 </span>
              </div>
            </div>
          </div>
          <div v-if="events.length === 0" class="text-center py-12 text-gray-600 flex flex-col items-center">
            <UIcon name="i-heroicons-calendar" class="w-12 h-12 opacity-20 mb-2" />
            <p>No upcoming events scheduled.</p>
          </div>
        </div>
      </div>

      <div class="mt-24 pt-8 border-t border-white/5">
        <h3 class="text-red-500 font-bold mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
          Danger Zone
        </h3>
        <div class="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-red-500/10 transition-colors">
          <div>
            <p class="text-white font-medium">Delete Client</p>
            <p class="text-gray-500 text-sm">This action is permanent and cannot be undone.</p>
          </div>
          <button @click="deleteClient" :disabled="isDeleting" class="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            <UIcon v-if="isDeleting" name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
            <span v-else>Delete Project</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSecretModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showSecretModal = false" class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"></div>
      <div class="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <UIcon name="i-heroicons-lock-closed" class="w-5 h-5 text-primary" />
            New Secret
          </h2>
          <button @click="showSecretModal = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
          </button>
        </div>
        
        <form @submit.prevent="addSecret" class="space-y-4">
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Key Name</label>
            <input v-model="newSecret.name" type="text" placeholder="e.g. STRIPE_SECRET_KEY" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700" />
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-gray-500 mb-1">Value</label>
            <input v-model="newSecret.value" type="text" placeholder="sk_test_..." class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none placeholder-gray-700 font-mono text-sm" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" @click="showSecretModal = false" class="flex-1 py-3 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
            <button type="submit" class="flex-1 bg-primary hover:bg-[#3d34d9] text-white py-3 rounded-lg font-bold shadow-lg transition-all">Save Secret</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped>
textarea::-webkit-scrollbar { width: 8px; }
textarea::-webkit-scrollbar-track { background: transparent; }
textarea::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
textarea::-webkit-scrollbar-thumb:hover { background: #475569; }

:deep(.prose) { color: #cbd5e1; }
:deep(.prose h1), :deep(.prose h2), :deep(.prose h3) { color: white; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
:deep(.prose code) { background: #1e293b; color: #818cf8; padding: 0.2em 0.4em; border-radius: 4px; font-weight: 600; }
:deep(.prose pre) { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; }
:deep(.prose a) { color: #818cf8; text-decoration: none; }
:deep(.prose a:hover) { text-decoration: underline; }
:deep(.prose blockquote) { border-left-color: #818cf8; color: #94a3b8; font-style: italic; }
</style>