<template>
  <UApp>
    <NuxtLoadingIndicator :height="3" color="bg-primary-400"/>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
onMounted(() => {
  if (process.client) {
    // Check for saved theme
    const savedColor = localStorage.getItem('ops-primary-color')
    if (savedColor) {
      document.documentElement.style.setProperty('--color-primary', savedColor)
    }
  }
})

const user = useSupabaseUser()
const { fetch: fetchProfile, reset: resetProfile } = useUserProfile()

// 🔥 THE FIX: Watch the user state globally.
// 1. immediate: true -> Checks if user is already there on load
// 2. Reactivity -> Waits for user to "appear" after hydration
watch(user, (newUser) => {
  if (newUser) {
    fetchProfile()
  } else {
    resetProfile()
  }
}, { immediate: true })
</script>