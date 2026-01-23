<script setup lang="ts">
const user = useSupabaseUser()
const router = useRouter()

// The Nuxt Supabase module automatically watches the URL fragment.
// Once it successfully parses the token, 'user' will change from null to an object.
watch(user, (newUser) => {
  if (newUser) {
    // Logic: Once authenticated, send them to the dashboard or welcome page
    return router.push('/')
  }
}, { immediate: true })

// Security: If the link is broken or the user isn't found after 10 seconds, 
// send them back to login.
onMounted(() => {
  setTimeout(() => {
    if (!user.value) {
      router.push('/login?error=timeout')
    }
  }, 10000)
})
</script>

<template>
  <div class="min-h-screen bg-base flex items-center justify-center font-sans">
    <div class="text-center animate-in fade-in zoom-in-95 duration-700">
      <div class="relative w-20 h-20 mx-auto mb-6">
        <div class="absolute inset-0 border-4 border-primary/20 rounded-xl"></div>
        <div class="absolute inset-0 border-4 border-primary rounded-xl animate-spin [animation-duration:3s] border-t-transparent"></div>
        <UIcon name="i-heroicons-shield-check" class="absolute inset-0 m-auto w-8 h-8 text-primary" />
      </div>
      
      <h2 class="text-white font-bold text-xl tracking-tight">Verifying Session</h2>
      <p class="text-gray-500 mt-2 text-sm">Please wait while we secure your connection...</p>
    </div>
  </div>
</template>