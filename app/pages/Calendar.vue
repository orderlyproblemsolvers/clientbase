<template>
  <div class="min-h-screen bg-base font-sans">
    <!-- ===== Hero Header ===== -->
    <div class="relative mb-8 rounded-2xl bg-gradient-to-r from-primary/5 to-transparent border border-white/6 p-5 md:p-6">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <UIcon name="i-heroicons-calendar-days" class="w-8 h-8 text-primary" />
          Calendar
        </h1>
        <p class="text-slate-400 mt-2 text-sm max-w-lg">
          All operational milestones, actionable tasks, and active project lifecycles mapped across ClientBase.
        </p>
      </div>
    </div>

    <!-- ===== Calendar View ===== -->
    <CalendarView />
  </div>
</template>

<script setup>
// Global master timeline entry point — no localized project constraints enforced
</script>