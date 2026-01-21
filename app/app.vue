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
</script>