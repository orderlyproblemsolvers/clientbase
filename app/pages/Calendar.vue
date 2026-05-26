<script setup lang="ts">
// Global calendar — no project filter
</script>

<template>
  <div class="min-h-screen bg-base font-sans">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white tracking-tight">Calendar</h1>
      <p class="text-gray-400 mt-1 text-sm">
        All milestones, tasks, and project dates across every client.
      </p>
    </div>
    <CalendarView />
  </div>
</template>