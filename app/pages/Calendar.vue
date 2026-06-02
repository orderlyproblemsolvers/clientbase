<template>
  <div class="min-h-screen  animate-in fade-in duration-300">
    
    <!-- ── PAGE HEADER ────────────────────────────────────────────────────── -->
    <div class="mb-8 pb-5 border-b border-white/[0.04]">
      <h1 class="text-2xl font-semibold text-white tracking-tight">
        Calendar
      </h1>
      <p class="text-slate-400 mt-1 text-xs tracking-wide">
        All operational milestones, actionable tasks, and active project lifecycles mapped across ClientBase.
      </p>
    </div>

    <!-- ── CORE INTERACTIVE TIMELINE ELEMENT ──────────────────────────────── -->
    <CalendarView />
    
  </div>
</template>

<script setup>
// Global master timeline entry point — no localized project constraints enforced
</script>