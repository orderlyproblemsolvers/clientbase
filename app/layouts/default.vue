<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
const auth = useAuthStore();
const user = useSupabaseUser();
const route = useRoute();

// --- Computed Profile Data ---
const displayName = computed(() => {
  return user.value?.user_metadata?.full_name || user.value?.email || 'User'
})

const displayRole = computed(() => {
  return user.value?.user_metadata?.role || 'Team Member'
})

const displayInitial = computed(() => {
  return displayName.value.charAt(0).toUpperCase()
})

// --- Navigation State ---
const isMenuOpen = ref(false); // Mobile Drawer
const isCollapsed = ref(true); // Desktop: Default to "Mini Mode"
const isHovered = ref(false);  // Desktop: Track mouse hover

// Computed property to determine if the sidebar currently looks expanded
const isExpanded = computed(() => {
  return !isCollapsed.value || isHovered.value
})

// Close mobile menu automatically when the route changes
watch(
  () => route.fullPath,
  () => {
    isMenuOpen.value = false;
  }
);
</script>

<template>
  <div class="min-h-screen bg-base font-sans text-white">
    
    <header
      class="lg:hidden flex items-center justify-between p-4 bg-secondary border-b border-white/5 sticky top-0 z-40"
    >
      <NuxtLink to="/">
        <img 
          src="/img/clientbaselogo-min.png" 
          alt="Client Base OPS" 
          class="h-8 w-auto object-contain" 
        />
      </NuxtLink>

      <button
        @click="isMenuOpen = !isMenuOpen"
        class="p-2 text-gray-400 hover:text-white transition-colors"
      >
        <UIcon v-if="!isMenuOpen" name="i-heroicons-bars-3" class="w-8 h-8" />
        <UIcon v-else name="i-heroicons-x-mark" class="w-8 h-8" />
      </button>
    </header>

    <div class="flex min-h-[calc(100vh-65px)] lg:min-h-screen">
      <div
        v-if="isMenuOpen"
        @click="isMenuOpen = false"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
      ></div>

      <aside
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
        :class="[
          /* Mobile: Slide in/out */
          isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          /* Desktop: Dynamic Width based on Expansion state */
          isExpanded ? 'lg:w-64' : 'lg:w-20',
          /* Base styles: Added w-64 to ensure mobile drawer has width */
          'fixed inset-y-0 left-0 w-64 bg-secondary border-r border-white/5 flex flex-col z-50 transition-all duration-300 ease-in-out lg:static lg:z-auto'
        ]"
      >
        <div class="h-20 flex items-center justify-center border-b border-white/5 relative overflow-hidden">
          
          <NuxtLink 
            to="/" 
            class="transition-all duration-300 absolute inset-0 flex items-center justify-center"
            :class="isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'"
          >
            <img 
              src="/img/clientbaselogo-white.png" 
              alt="Client Base OPS" 
              class="h-10 w-auto object-contain" 
            />
          </NuxtLink>

          <NuxtLink 
             to="/"
             class="transition-all duration-300 absolute inset-0 flex items-center justify-center"
             :class="isExpanded ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'"
          >
            <img 
              src="/img/clientbaselogo-min.png" 
              alt="Client Base" 
              class="h-8 w-auto object-contain drop-shadow-lg" 
            />
          </NuxtLink>
        </div>

        <nav class="flex-1 px-3 space-y-2 mt-6">
          
          <NuxtLink
            to="/"
            class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap"
            :class="!isExpanded ? 'lg:justify-center' : ''"
            :title="!isExpanded ? 'Dashboard' : ''"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-6 h-6 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span 
              class="transition-all duration-300"
              :class="!isExpanded ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'"
            >
              Dashboard
            </span>
          </NuxtLink>
          
          <div
            class="pt-4 pb-2 px-3 text-[10px] uppercase font-bold text-gray-600 tracking-widest transition-opacity duration-300 whitespace-nowrap overflow-hidden"
            :class="!isExpanded ? 'lg:opacity-0 lg:h-0 lg:py-0' : 'opacity-100'"
          >
            Quick Access
          </div>
          
          <NuxtLink
            to="/library"
            class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap"
            :class="!isExpanded ? 'lg:justify-center' : ''"
            :title="!isExpanded ? 'Code Library' : ''"
          >
            <UIcon name="i-heroicons-code-bracket" class="w-6 h-6 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span 
              class="transition-all duration-300"
              :class="!isExpanded ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'"
            >
              Code Library
            </span>
          </NuxtLink>
          
          <NuxtLink
            to="/retainers"
            class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap"
            :class="!isExpanded ? 'lg:justify-center' : ''"
            :title="!isExpanded ? 'Retainers' : ''"
          >
            <UIcon name="i-heroicons-banknotes" class="w-6 h-6 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span 
              class="transition-all duration-300"
              :class="!isExpanded ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'"
            >
              Retainers
            </span>
          </NuxtLink>
          
          <NuxtLink 
            to="/settings" 
            class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap mt-auto"
            :class="!isExpanded ? 'lg:justify-center' : ''"
            :title="!isExpanded ? 'Settings' : ''"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-6 h-6 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span 
              class="transition-all duration-300"
              :class="!isExpanded ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'"
            >
              Settings
            </span>
          </NuxtLink>
        </nav>

        <div v-if="user" class="border-t border-white/5 bg-secondary overflow-hidden">
          
          <div 
            class="flex items-center gap-3 p-4 transition-all duration-300"
            :class="!isExpanded ? 'lg:justify-center px-2' : ''"
          >
            <div
              class="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-sm text-white shadow-lg shrink-0"
            >
              {{ displayInitial }}
            </div>
            
            <div 
              class="truncate transition-all duration-300"
              :class="!isExpanded ? 'lg:w-0 lg:opacity-0 lg:hidden' : 'w-auto opacity-100'"
            >
              <p class="text-xs font-bold text-white truncate">{{ displayName }}</p>
              <p class="text-[10px] text-gray-500 font-medium truncate">{{ displayRole }}</p>
            </div>
          </div>

          <div class="flex items-center border-t border-white/5">
             <button
              @click="auth.logout"
              class="flex-1 text-left px-4 py-3 text-xs text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2 overflow-hidden whitespace-nowrap"
              :class="!isExpanded ? 'lg:justify-center' : ''"
              :title="!isExpanded ? 'Logout' : ''"
            >
              <UIcon name="i-heroicons-arrow-left-on-rectangle" class="w-4 h-4 shrink-0" />
              <span :class="!isExpanded ? 'lg:hidden' : ''">Logout</span>
            </button>
            
            <button 
              @click="isCollapsed = !isCollapsed"
              class="hidden lg:flex items-center justify-center w-10 h-full border-l border-white/5 text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              :title="isCollapsed ? 'Pin Sidebar Open' : 'Unpin Sidebar'"
            >
               <UIcon :name="isCollapsed ? 'i-heroicons-lock-open' : 'i-heroicons-lock-closed'" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>

      <main class="flex-1 overflow-x-hidden w-full">
        <div class="md:p-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
nav .router-link-active {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-primary); 
}

aside {
  will-change: width;
}
</style>