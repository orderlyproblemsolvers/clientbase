<script setup lang="ts">
// ⚠️ Entire script remains exactly the same
import { FIELD_TYPES, FILE_TYPE_OPTIONS, type FormField, type FieldType, useOnboarding } from '~/composables/useOnboarding'

const supabase = useSupabaseClient()
const user     = useSupabaseUser()
const route    = useRoute()
const formId   = route.params.id as string

const { blankField, moveUp, moveDown } = useOnboarding()

// ── State ─────────────────────────────────────────────────────────────────────
const loading   = ref(true)
const saving    = ref(false)
const formData  = ref<any>(null)
const fields    = ref<FormField[]>([])
const activeTab = ref<'build' | 'fill' | 'share' | 'submissions'>('build')
const toast     = ref({ show: false, message: '', type: 'success' })

// Submissions
const submissions = ref<any[]>([])
const selectedSub = ref<any>(null)

// Add field
const showAddField   = ref(false)
const editingField   = ref<FormField | null>(null)
const editingFieldIdx = ref<number>(-1)

const fieldDraft = ref<FormField>(blankField())

// Fill mode
const fillAnswers = ref<Record<string, any>>({})
const submitting  = ref(false)
const fillDone    = ref(false)

// Clients / projects for linking
const clients  = ref<any[]>([])
const projects = ref<any[]>([])

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    const { data: fData, error } = await supabase
      .from('onboarding_forms')
      .select('*, clients(id, name), projects(id, name)')
      .eq('id', formId)
      .single()

    if (error) throw error
    formData.value = fData
    fields.value   = (fData.fields || []).sort((a: FormField, b: FormField) => a.position - b.position)

    const { data: subs } = await supabase
      .from('onboarding_submissions')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
    submissions.value = subs || []

    const { data: cData } = await supabase.from('clients').select('id, name').order('name')
    clients.value = cData || []

    const { data: pData } = await supabase.from('projects').select('id, name, client_id').order('name')
    projects.value = pData || []

    // Pre-fill fill answers
    fields.value.forEach(f => { fillAnswers.value[f.id] = '' })

  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    loading.value = false
  }
}

// ── Save form ─────────────────────────────────────────────────────────────────
const saveForm = async () => {
  saving.value = true
  try {
    const { error } = await supabase
      .from('onboarding_forms')
      .update({
        title:       formData.value.title,
        description: formData.value.description,
        client_id:   formData.value.client_id  || null,
        project_id:  formData.value.project_id || null,
        fields:      fields.value,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', formId)
    if (error) throw error
    showToast('Form saved!')
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    saving.value = false
  }
}

// ── Field CRUD ────────────────────────────────────────────────────────────────
const openAddField = () => {
  fieldDraft.value  = blankField(fields.value.length)
  editingField.value = null
  editingFieldIdx.value = -1
  showAddField.value = true
}

const toggleAcceptedType = (value: string) => {
  const types = fieldDraft.value.acceptedTypes || []
  if (types.includes(value)) {
    fieldDraft.value.acceptedTypes = types.filter(t => t !== value)
  } else {
    fieldDraft.value.acceptedTypes = [...types, value]
  }
}

const openEditField = (field: FormField, idx: number) => {
  fieldDraft.value    = { ...field, options: [...field.options] }
  editingField.value  = field
  editingFieldIdx.value = idx
  showAddField.value  = true
}

const saveField = () => {
  if (!fieldDraft.value.label.trim()) return
  if (editingFieldIdx.value >= 0) {
    fields.value[editingFieldIdx.value] = { ...fieldDraft.value }
  } else {
    fields.value.push({ ...fieldDraft.value, position: fields.value.length })
  }
  showAddField.value = false
}

const removeField = (idx: number) => {
  fields.value.splice(idx, 1)
  fields.value = fields.value.map((f, i) => ({ ...f, position: i }))
}

const moveFieldUp   = (idx: number) => { fields.value = moveUp(fields.value, idx) }
const moveFieldDown = (idx: number) => { fields.value = moveDown(fields.value, idx) }

// Options for select field
const optionInput = ref('')
const addOption = () => {
  const o = optionInput.value.trim()
  if (o && !fieldDraft.value.options.includes(o)) {
    fieldDraft.value.options.push(o)
  }
  optionInput.value = ''
}
const removeOption = (i: number) => fieldDraft.value.options.splice(i, 1)

// ── Send to client (mark as sent) ─────────────────────────────────────────────
const markSent = async () => {
  try {
    const { error } = await supabase
      .from('onboarding_forms')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', formId)
    if (error) throw error
    formData.value.status = 'sent'
    showToast('Form marked as sent!')
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

const copyClientLink = () => {
  const url = `${window.location.origin}/brief/${formData.value.token}`
  navigator.clipboard.writeText(url)
  showToast('Client link copied!')
}

const clientLink = computed(() =>
  formData.value ? `${window.location.origin}/brief/${formData.value.token}` : ''
)

// ── Fill yourself ─────────────────────────────────────────────────────────────
const submitFill = async () => {
  for (const f of fields.value) {
    if (f.required && !fillAnswers.value[f.id]) {
      showToast(`"${f.label}" is required`, 'error')
      return
    }
  }
  submitting.value = true
  try {
    const { data: sub, error } = await supabase
      .from('onboarding_submissions')
      .insert({
        form_id:        formId,
        responses:      fillAnswers.value,
        submitter_name: 'Self (filled by owner)',
      })
      .select()
      .single()

    if (error) throw error
    await applyToRecord(fillAnswers.value, sub.id)

    // Mark form completed
    await supabase.from('onboarding_forms')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', formId)
    formData.value.status = 'completed'

    fillDone.value = true
    showToast(formData.value.project_id ? 'Applied to project!' : 'New project created!')
    await fetchData()
    activeTab.value = 'submissions'
  } catch (e: any) {
    showToast(e.message, 'error')
  } finally {
    submitting.value = false
  }
}

// ── Apply submission to client/project ────────────────────────────────────────
const applyToRecord = async (responses: Record<string, any>, subId: string) => {
  const get = (labelFragment: string, type?: string): string => {
    const f = fields.value.find(f => {
      const lbl = f.label.toLowerCase()
      const matchLabel = lbl.includes(labelFragment.toLowerCase())
      const matchType  = type ? f.type === type : true
      return matchLabel && matchType
    })
    return f ? String(responses[f.id] || '') : ''
  }

  const projectName  = formData.value.title
  const description  = get('goal') || get('building') || get('scope') || get('service') || ''
  const budget       = parseFloat((get('budget', 'number') || '0').replace(/[^0-9.]/g, '')) || null
  const endDate      = get('deadline', 'date') || get('launch', 'date') || get('end', 'date') || null
  const startDate    = get('start', 'date') || null

  const attachments: string[] = []
  fields.value.forEach(f => {
    if (f.type === 'file' || f.type === 'url') {
      const val = responses[f.id]
      if (Array.isArray(val)) {
        val.forEach(v => v && attachments.push(v))
      } else if (val) {
        attachments.push(String(val))
      }
    }
  })

  let projectId = formData.value.project_id

  if (projectId) {
    await supabase.from('projects').update({
      description:              description  || undefined,
      budget:                   budget       || undefined,
      end_date:                 endDate      || undefined,
      start_date:               startDate    || undefined,
      onboarding_submission_id: subId,
      updated_at:               new Date().toISOString(),
    }).eq('id', projectId)
  } else {
    let userId = user.value?.id
    if (!userId) {
      const { data } = await supabase.auth.getSession()
      userId = data.session?.user?.id
    }

    const { data: newProj, error } = await supabase
      .from('projects')
      .insert({
        client_id: formData.value.client_id,
        user_id:  userId,
        name:   projectName,
        description: description  || null,
        budget:    budget  || null,
        end_date:   endDate  || null,
        start_date: startDate  || null,
        status: 'active',
        currency:  'NGN',
        onboarding_submission_id: subId,
      })
      .select()
      .single()

    if (error) throw error
    projectId = newProj.id

    await supabase
      .from('onboarding_forms')
      .update({ project_id: projectId, updated_at: new Date().toISOString() })
      .eq('id', formId)
    formData.value.project_id = projectId
  }

  await supabase
    .from('onboarding_submissions')
    .update({ project_id: projectId })
    .eq('id', subId)

  return projectId
}

const applySubmission = async (sub: any) => {
  try {
    const projectId = await applyToRecord(sub.responses, sub.id)

    await supabase.from('onboarding_forms')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', formId)
    formData.value.status = 'completed'

    const action = formData.value.project_id ? 'Updated project!' : 'New project created!'
    showToast(action)
    await fetchData()
  } catch (e: any) {
    showToast(e.message, 'error')
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const showToast = (msg: string, type = 'success') => {
  toast.value = { show: true, message: msg, type }
  setTimeout(() => toast.value.show = false, 3000)
}

const fieldTypeConfig = (type: FieldType) =>
  FIELD_TYPES.find(t => t.type === type) || FIELD_TYPES[0]

const clientProjects = computed(() =>
  formData.value?.client_id
    ? projects.value.filter(p => p.client_id === formData.value.client_id)
    : projects.value
)

const statusConfig: Record<string, string> = {
  draft:     'text-slate-400  bg-slate-400/10  border-slate-400/20',
  sent:      'text-blue-400   bg-blue-400/10   border-blue-400/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
}

onMounted(() => fetchData())
</script>

<template>
  <div class="min-h-screen bg-base font-sans">

    <!-- Breadcrumb -->
    <nav class="flex items-center gap-1.5 text-sm text-slate-500 mb-6" aria-label="Breadcrumb">
      <NuxtLink to="/" class="flex items-center gap-1.5 hover:text-slate-300 transition-colors duration-150">
        <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
        <span>Dashboard</span>
      </NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <NuxtLink to="/onboarding" class="hover:text-slate-300 transition-colors duration-150">Onboarding</NuxtLink>
      <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-600" />
      <span class="text-slate-300 truncate max-w-48">{{ formData?.title || '…' }}</span>
    </nav>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-10 w-64 bg-white/5 animate-pulse rounded-lg"></div>
      <div class="h-96 bg-white/5 animate-pulse rounded-2xl"></div>
    </div>

    <div v-else-if="formData" class="space-y-8">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-white tracking-tight">{{ formData.title }}</h1>
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border"
            :class="statusConfig[formData.status]"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="{
              'bg-slate-400': formData.status === 'draft',
              'bg-blue-400': formData.status === 'sent',
              'bg-emerald-400': formData.status === 'completed',
            }" aria-hidden="true"></span>
            {{ formData.status }}
          </span>
        </div>
        <button
          @click="saveForm"
          :disabled="saving"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 shrink-0"
        >
          <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          <UIcon v-else name="i-heroicons-check" class="w-4 h-4" />
          Save Form
        </button>
      </div>

      <!-- Tabs -->
      <div class="bg-white/5 p-1 rounded-xl flex gap-1 overflow-x-auto max-w-xl">
        <button
          v-for="tab in [
            { id: 'build',       label: 'Build',       icon: 'i-heroicons-wrench-screwdriver' },
            { id: 'fill',        label: 'Fill Myself', icon: 'i-heroicons-pencil'             },
            { id: 'share',       label: 'Share',       icon: 'i-heroicons-share'              },
            { id: 'submissions', label: 'Submissions', icon: 'i-heroicons-inbox'              },
          ]"
          :key="tab.id"
          @click="activeTab = tab.id as any"
          :class="[
            'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 whitespace-nowrap',
            activeTab === tab.id
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          ]"
          :aria-label="tab.label"
          :aria-selected="activeTab === tab.id"
          role="tab"
        >
          <UIcon :name="tab.icon" class="w-3.5 h-3.5" />
          {{ tab.label }}
          <span v-if="tab.id === 'submissions' && submissions.length" class="bg-white/20 px-1.5 py-0.5 rounded text-[10px] tabular-nums">
            {{ submissions.length }}
          </span>
        </button>
      </div>

      <!-- ── BUILD TAB ───────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'build'" class="space-y-6">

        <!-- Form meta -->
        <div class="bg-white/3 border border-white/6 rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-white">Form Settings</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="form-title" class="block text-xs font-semibold text-slate-400">Title</label>
              <input id="form-title" v-model="formData.title" type="text" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none transition-all duration-150" />
            </div>
            <div class="space-y-1.5">
              <label for="form-desc" class="block text-xs font-semibold text-slate-400">Description (visible to client)</label>
              <input id="form-desc" v-model="formData.description" type="text" placeholder="Brief intro shown at top of form..." class="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
            </div>
            <div class="space-y-1.5">
              <label for="form-client" class="block text-xs font-semibold text-slate-400">Linked Client</label>
              <div class="relative">
                <select id="form-client" v-model="formData.client_id" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                  <option class="bg-black hover:bg-gray-900" value="">None</option>
                  <option class="bg-black hover:bg-gray-900" v-for="c in clients" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>
            <div class="space-y-1.5">
              <label for="form-project" class="block text-xs font-semibold text-slate-400">Linked Project</label>
              <div class="relative">
                <select id="form-project" v-model="formData.project_id" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                  <option class="bg-black hover:bg-gray-900" value="">None</option>
                  <option class="bg-black hover:bg-gray-900" v-for="p in clientProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <!-- Fields -->
        <div class="bg-white/3 border border-white/6 rounded-2xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 class="text-sm font-semibold text-white">
              Fields
              <span class="text-slate-500 font-normal ml-2 text-xs">{{ fields.length }} total</span>
            </h3>
            <button
              @click="openAddField"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary transition-colors duration-150 border border-primary/20"
            >
              <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
              Add Field
            </button>
          </div>

          <!-- Empty fields -->
          <div v-if="fields.length === 0" class="p-12 text-center">
            <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <UIcon name="i-heroicons-rectangle-stack" class="w-6 h-6 text-slate-600" />
            </div>
            <p class="text-sm font-medium text-slate-300 mb-1">No fields yet</p>
            <p class="text-xs text-slate-500">Add your first field above.</p>
          </div>

          <!-- Field list -->
          <div v-else class="divide-y divide-white/5">
            <div
              v-for="(field, idx) in fields"
              :key="field.id"
              class="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors duration-150 group"
            >
              <!-- Type icon -->
              <div class="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <UIcon :name="fieldTypeConfig(field.type).icon" class="w-4 h-4 text-slate-400" />
              </div>

              <!-- Label + type -->
              <div class="flex-1 min-w-0">
                <p class="text-white text-sm font-medium flex items-center gap-2 truncate">
                  {{ field.label || '(no label)' }}
                  <span v-if="field.required" class="text-red-400 text-[10px] font-semibold">REQUIRED</span>
                </p>
                <p class="text-slate-500 text-xs mt-0.5">
                  {{ fieldTypeConfig(field.type).label }}
                  <span v-if="field.placeholder"> · {{ field.placeholder }}</span>
                  <span v-if="field.options?.length"> · {{ field.options.length }} options</span>
                </p>
              </div>

              <!-- Controls -->
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                <button @click="moveFieldUp(idx)" :disabled="idx === 0" class="p-1.5 rounded-lg text-slate-600 hover:text-white disabled:opacity-20 transition-colors" aria-label="Move up">
                  <UIcon name="i-heroicons-chevron-up" class="w-3.5 h-3.5" />
                </button>
                <button @click="moveFieldDown(idx)" :disabled="idx === fields.length - 1" class="p-1.5 rounded-lg text-slate-600 hover:text-white disabled:opacity-20 transition-colors" aria-label="Move down">
                  <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5" />
                </button>
                <button @click="openEditField(field, idx)" class="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors" aria-label="Edit field">
                  <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
                </button>
                <button @click="removeField(idx)" class="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors" aria-label="Delete field">
                  <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ── FILL TAB ─────────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'fill'" class="animate-in fade-in duration-300">

        <div v-if="fillDone" class="text-center py-16">
          <div class="w-16 h-16 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-check-circle" class="w-8 h-8 text-emerald-400" />
          </div>
          <p class="text-white font-bold text-lg">Saved!</p>
          <p class="text-slate-500 text-sm mt-1">Responses saved and applied to the linked client/project.</p>
          <button @click="fillDone = false; activeTab = 'submissions'" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors mt-4">
            View Submissions →
          </button>
        </div>

        <template v-else>
          <div class="max-w-2xl space-y-5">
            <div class="bg-primary/5 border border-primary/10 rounded-2xl p-4">
              <p class="text-slate-400 text-sm">
                <strong class="text-white">Fill on behalf of your client.</strong>
                Responses will be saved as a submission and automatically applied to
                {{ formData.clients?.name ? `"${formData.clients.name}"` : 'the linked client' }}
                {{ formData.projects?.name ? `and "${formData.projects.name}"` : '' }}.
              </p>
            </div>

            <div
              v-for="field in fields"
              :key="field.id"
              class="space-y-1.5"
            >
              <label class="block text-sm font-medium text-slate-300">
                {{ field.label }}
                <span v-if="field.required" class="text-red-400 ml-1">*</span>
              </label>

              <textarea
                v-if="field.type === 'textarea'"
                v-model="fillAnswers[field.id]"
                :placeholder="field.placeholder"
                rows="4"
                class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none resize-none transition-all duration-150"
              ></textarea>

              <div v-else-if="field.type === 'select'" class="relative">
                <select v-model="fillAnswers[field.id]" class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 focus:outline-none appearance-none cursor-pointer transition-all duration-150">
                  <option value="">Select...</option>
                  <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <UIcon name="i-heroicons-chevron-up-down" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
              </div>

              <input
                v-else
                v-model="fillAnswers[field.id]"
                :type="field.type === 'file' ? 'url' : field.type"
                :placeholder="field.type === 'file' ? 'Paste file/drive link here' : field.placeholder"
                class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150"
              />
            </div>

            <div class="flex gap-3 pt-4">
              <button
                @click="submitFill"
                :disabled="submitting"
                class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
              >
                <UIcon v-if="submitting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                <span v-else>Save & Apply to Project</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- ── SHARE TAB ───────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'share'" class="animate-in fade-in duration-300 max-w-xl space-y-6">

        <div class="bg-white/3 border border-white/6 rounded-2xl p-6 space-y-4">
          <h3 class="text-sm font-semibold text-white">Client Link</h3>
          <p class="text-slate-400 text-sm">
            Share this link with your client. They can fill the form without creating a ClientBase account.
          </p>

          <!-- Link display -->
          <div class="flex items-center gap-3 bg-white/4 rounded-xl p-3 border border-white/8">
            <p class="flex-1 text-slate-300 text-sm font-mono truncate">{{ clientLink }}</p>
            <button
              @click="copyClientLink"
              class="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white transition-all duration-150"
            >
              Copy Link
            </button>
          </div>

          <!-- Status alerts -->
          <div v-if="formData.status === 'draft'" class="bg-amber-400/5 border border-amber-400/10 rounded-2xl p-4">
            <p class="text-amber-400 text-xs font-medium mb-3">
              This form is still in Draft. Once you share the link, mark it as Sent so you can track it.
            </p>
            <button
              @click="markSent"
              class="w-full py-2.5 rounded-xl text-xs font-semibold bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 hover:text-white transition-all"
            >
              Mark as Sent
            </button>
          </div>

          <div v-else-if="formData.status === 'sent'" class="bg-blue-400/5 border border-blue-400/10 rounded-2xl p-4 flex items-center gap-3">
            <UIcon name="i-heroicons-paper-airplane" class="w-5 h-5 text-blue-400 shrink-0" />
            <p class="text-blue-400 text-sm font-medium">Link sent — waiting for client to fill.</p>
          </div>

          <div v-else-if="formData.status === 'completed'" class="bg-emerald-400/5 border border-emerald-400/10 rounded-2xl p-4 flex items-center gap-3">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-emerald-400 shrink-0" />
            <p class="text-emerald-400 text-sm font-medium">Completed — client has submitted.</p>
          </div>
        </div>

        <!-- Preview link -->
        <div class="bg-white/3 border border-white/6 rounded-2xl p-6">
          <h3 class="text-sm font-semibold text-white mb-2">Preview as Client</h3>
          <p class="text-slate-500 text-sm mb-4">See exactly what your client will see when they open the link.</p>
          <a
            :href="clientLink"
            target="_blank"
            class="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
            Open form in new tab
          </a>
        </div>
      </div>

      <!-- ── SUBMISSIONS TAB ─────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'submissions'" class="animate-in fade-in duration-300">

        <div v-if="submissions.length === 0" class="text-center py-16 border border-dashed border-white/8 rounded-2xl">
          <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-inbox" class="w-6 h-6 text-slate-600" />
          </div>
          <p class="text-sm font-medium text-slate-300 mb-1">No submissions yet</p>
          <p class="text-xs text-slate-500">Share the form link or fill it yourself.</p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="sub in submissions"
            :key="sub.id"
            class="bg-white/3 border border-white/6 hover:border-white/10 rounded-2xl p-5 transition-all duration-150"
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <p class="text-white font-semibold text-sm">{{ sub.submitter_name || 'Anonymous' }}</p>
                <p class="text-slate-500 text-xs mt-0.5">
                  {{ new Date(sub.submitted_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
                </p>
              </div>
              <button
                @click="applySubmission(sub)"
                class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 hover:text-white transition-all border border-emerald-400/20"
              >
                <UIcon name="i-heroicons-arrow-down-tray" class="w-3.5 h-3.5" />
                Apply to Project
              </button>
            </div>

            <!-- Responses -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="field in fields"
                :key="field.id"
                class="bg-white/4 rounded-xl p-3"
              >
                <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{{ field.label }}</p>
                <p class="text-slate-300 text-sm wrap-break-word">
                  {{ sub.responses[field.id] || '—' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Add/Edit Field Modal ────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showAddField"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-modal-title"
        >
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showAddField = false" aria-hidden="true"></div>
          <div class="relative w-full sm:max-w-md bg-[#0d1525] border border-white/8 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
            <!-- Mobile drag indicator -->
            <div class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div class="w-10 h-1 rounded-full bg-white/10"></div>
            </div>

            <!-- Header -->
            <div class="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h2 id="field-modal-title" class="text-base font-bold text-white">{{ editingField ? 'Edit Field' : 'Add Field' }}</h2>
                <p class="text-xs text-slate-500 mt-0.5">{{ formData?.title }}</p>
              </div>
              <button @click="showAddField = false" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all" aria-label="Close modal">
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>

            <!-- Scrollable form body -->
            <div class="overflow-y-auto flex-1 px-6 py-5">
              <div class="space-y-5">

                <!-- Field type -->
                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-2">Field Type</label>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="ft in FIELD_TYPES"
                      :key="ft.type"
                      type="button"
                      @click="fieldDraft.type = ft.type"
                      class="flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wide transition-all"
                      :class="fieldDraft.type === ft.type
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                        : 'bg-white/5 text-slate-400 border-white/6 hover:border-white/10 hover:text-white'"
                    >
                      <UIcon :name="ft.icon" class="w-4 h-4" />
                      {{ ft.label }}
                    </button>
                  </div>
                </div>

                <!-- Label -->
                <div class="space-y-1.5">
                  <label for="field-label" class="block text-xs font-semibold text-slate-400">Label <span class="text-red-400">*</span></label>
                  <input id="field-label" v-model="fieldDraft.label" type="text" placeholder="e.g. Budget, Company Name..." class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>

                <!-- Placeholder -->
                <div class="space-y-1.5">
                  <label for="field-placeholder" class="block text-xs font-semibold text-slate-400">Placeholder</label>
                  <input id="field-placeholder" v-model="fieldDraft.placeholder" type="text" placeholder="Hint shown inside the field..." class="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150" />
                </div>

                <!-- Options (select only) -->
                <div v-if="fieldDraft.type === 'select'" class="space-y-3">
                  <label class="block text-xs font-semibold text-slate-400">Options</label>
                  <div class="space-y-2">
                    <div v-for="(opt, i) in fieldDraft.options" :key="i" class="flex items-center gap-2">
                      <span class="flex-1 bg-white/4 px-3 py-2 rounded-xl text-white text-sm">{{ opt }}</span>
                      <button type="button" @click="removeOption(i)" class="p-1.5 rounded-lg text-slate-600 hover:text-red-400 transition-colors">
                        <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <input
                      v-model="optionInput"
                      type="text"
                      placeholder="Add option..."
                      class="flex-1 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-primary/50 focus:outline-none transition-all duration-150"
                      @keydown.enter.prevent="addOption"
                    />
                    <button type="button" @click="addOption" class="px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/8 border border-white/6 text-slate-400 hover:text-white transition-all">
                      Add
                    </button>
                  </div>
                </div>

                <!-- Required toggle -->
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    @click="fieldDraft.required = !fieldDraft.required"
                    class="w-10 h-6 rounded-full relative transition-colors"
                    :class="fieldDraft.required ? 'bg-primary' : 'bg-white/10'"
                  >
                    <div class="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" :class="fieldDraft.required ? 'left-5' : 'left-1'"></div>
                  </button>
                  <label class="text-sm text-slate-400 font-medium cursor-pointer" @click="fieldDraft.required = !fieldDraft.required">
                    Required field
                  </label>
                </div>

                <!-- File field config -->
                <div v-if="fieldDraft.type === 'file'" class="space-y-4 pt-2 border-t border-white/5">
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">File Field Settings</p>

                  <!-- Max files -->
                  <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1.5">
                      Max number of files the client can upload
                    </label>
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        @click="fieldDraft.maxFiles = Math.max(1, (fieldDraft.maxFiles || 1) - 1)"
                        class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/8 text-white flex items-center justify-center font-semibold transition-colors"
                      >−</button>
                      <span class="text-white font-semibold w-8 text-center">{{ fieldDraft.maxFiles || 1 }}</span>
                      <button
                        type="button"
                        @click="fieldDraft.maxFiles = Math.min(20, (fieldDraft.maxFiles || 1) + 1)"
                        class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/8 text-white flex items-center justify-center font-semibold transition-colors"
                      >+</button>
                      <span class="text-slate-500 text-xs">file{{ (fieldDraft.maxFiles || 1) !== 1 ? 's' : '' }} maximum</span>
                    </div>
                  </div>

                  <!-- Accepted file types -->
                  <div>
                    <label class="block text-xs font-medium text-slate-400 mb-2">Accepted file types</label>
                    <div class="grid grid-cols-2 gap-2">
                      <label
                        v-for="opt in FILE_TYPE_OPTIONS"
                        :key="opt.value"
                        class="flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                        :class="(fieldDraft.acceptedTypes || []).includes(opt.value)
                          ? 'bg-primary/10 border-primary/30 text-white'
                          : 'bg-white/5 border-white/6 text-slate-400 hover:border-white/10'"
                      >
                        <input
                          type="checkbox"
                          class="hidden"
                          :checked="(fieldDraft.acceptedTypes || []).includes(opt.value)"
                          @change="toggleAcceptedType(opt.value)"
                        />
                        <div
                          class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                          :class="(fieldDraft.acceptedTypes || []).includes(opt.value)
                            ? 'bg-primary border-primary'
                            : 'border-slate-600'"
                        >
                          <UIcon v-if="(fieldDraft.acceptedTypes || []).includes(opt.value)" name="i-heroicons-check" class="w-2.5 h-2.5 text-white" />
                        </div>
                        <span class="text-xs font-medium">{{ opt.label }}</span>
                      </label>
                    </div>
                    <p class="text-[10px] text-slate-600 mt-1">Leave all unchecked to allow any file type.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer actions -->
            <div class="px-6 py-4 border-t border-white/5 shrink-0 flex gap-2.5">
              <button
                type="button"
                @click="showAddField = false"
                class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/8 border border-white/6 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="saveField"
                :disabled="!fieldDraft.label.trim()"
                class="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.98]"
              >
                {{ editingField ? 'Save Changes' : 'Add Field' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
/* Modal transitions (exact match with all other pages) */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: translateY(24px) scale(0.98);
}
@media (max-width: 639px) {
  .modal-enter-from .relative {
    transform: translateY(100%);
  }
}
</style>