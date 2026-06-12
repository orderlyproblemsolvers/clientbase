<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const token = String(route.query.token ?? '')   // no 'as' keyword
const message = ref('')

onMounted(async () => {
  if (!token) {
    message.value = 'Invalid link.'
    return
  }
  const { data, error } = await supabase
    .from('clients')
    .update({ do_not_remind: true })
    .eq('unsubscribe_token', token)
    .select('name')
    .single()
  if (error) {
    message.value = 'Failed to unsubscribe. Please contact us directly.'
  } else {
    message.value = `You have been unsubscribed from future reminders, ${data.name}.`
  }
})
</script>

<template>
  <div class="min-h-screen bg-base flex items-center justify-center p-6">
    <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-8 text-center max-w-md">
      <UIcon name="i-heroicons-envelope" class="w-10 h-10 text-slate-500 mx-auto mb-4" />
      <p class="text-white text-lg font-semibold">{{ message }}</p>
    </div>
  </div>
</template>