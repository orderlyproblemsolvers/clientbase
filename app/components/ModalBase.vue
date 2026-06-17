<!-- components/ModalBase.vue (updated with maxWidth prop) -->
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="$emit('close')" />
        <div
          class="relative w-full border border-white/8 bg-[#0d1525] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
          :class="maxWidth ? `sm:${maxWidth}` : 'sm:max-w-md'"
        >
          <div v-if="!noHandle" class="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div class="w-10 h-1 rounded-full bg-white/10" />
          </div>
          <div class="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
            <div>
              <h2 class="text-base font-bold text-white">{{ title }}</h2>
              <p v-if="subtitle" class="text-xs text-slate-500 mt-0.5">{{ subtitle }}</p>
            </div>
            <button @click="$emit('close')" class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all" aria-label="Close">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>
          <div class="overflow-y-auto flex-1 px-6 py-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="px-6 py-4 border-t border-white/5 shrink-0">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  subtitle?: string
  noHandle?: boolean
  maxWidth?: string
}>()
defineEmits(['close'])
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
.modal-enter-active .relative, .modal-leave-active .relative { transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative { transform: translateY(24px) scale(0.98); }
@media (max-width: 639px) { .modal-enter-from .relative { transform: translateY(100%); } }
</style>