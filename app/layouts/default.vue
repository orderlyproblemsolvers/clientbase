<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
const auth = useAuthStore();
const user = useSupabaseUser();
const { 
  profile, 
  fetch: fetchProfileData, 
  isLoading,
  hasProfile,
  isAuthenticated,
  reset: resetProfile // 🔥 Import reset function
} = useUserProfile();

// --- Navigation State ---
const isMenuOpen = ref(false);
const isCollapsed = ref(true);

// --- Computed Profile Display ---
const displayName = computed(() => {
  // 🔥 Ensure we show user's metadata if profile not loaded yet
  return profile.value.full_name || 
         user.value?.user_metadata?.full_name || 
         user.value?.email || 
         'User'
})

const displayRole = computed(() => {
  return profile.value.role || 
         user.value?.user_metadata?.role || 
         'Team Member'
})

const displayInitial = computed(() => {
  const name = displayName.value
  return name ? name.charAt(0).toUpperCase() : 'U'
})

// 🔥 Watch auth state changes in auth store if you have one
watch(() => auth.isAuthenticated, (isAuth) => {
  if (!isAuth) {
    resetProfile() // Explicit reset on logout
  }
})

// 🔥 Debug logging to track state
watchEffect(() => {
  console.log('Layout profile state:', {
    userEmail: user.value?.email,
    userId: user.value?.id?.substring(0, 8),
    profileName: profile.value.full_name,
    avatar: profile.value.avatar_url?.substring(0, 30),
    fetched: profile.value.fetched,
    loading: profile.value.loading
  })
})

// --- Helper: Handle Link Click ---
const handleNavClick = () => {
  isMenuOpen.value = false
}
</script>

<template>
  <div class="h-screen w-screen bg-base font-sans text-white flex flex-col overflow-hidden">
    
    <header class="lg:hidden flex-none flex items-center justify-between p-4 bg-secondary border-b border-white/5 z-40">
      <NuxtLink to="/" @click="handleNavClick">
        <img src="/img/clientbaselogo-white.png" alt="Client Base OPS" class="h-16 w-auto object-contain" />
      </NuxtLink>
      
      <button @click="isMenuOpen = !isMenuOpen" class="p-2 text-gray-400 hover:text-white transition-colors">
        <UIcon v-if="!isMenuOpen" name="i-heroicons-bars-3-bottom-left" class="w-7 h-7" />
        <UIcon v-else name="i-heroicons-x-mark" class="w-7 h-7" />
      </button>
    </header>

    <div class="flex-1 flex relative overflow-hidden">
      
      <div v-if="isMenuOpen" @click="isMenuOpen = false" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"></div>

      <aside
        :class="[
          /* Mobile */
          isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          /* Desktop Width */
          isCollapsed ? 'lg:w-20' : 'lg:w-64',
          /* Fixed Layout */
          'absolute inset-y-0 left-0 z-50 bg-secondary border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out w-64 shadow-2xl lg:shadow-none'
        ]"
      >
        <div class="h-16 flex-none flex items-center justify-center border-b border-white/5 relative overflow-hidden">
          <NuxtLink to="/" @click="handleNavClick" class="transition-all duration-300 absolute inset-0 flex items-center justify-center"
            :class="!isCollapsed ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'">
            <img src="/img/clientbaselogo-white.png" alt="Client Base OPS" class="h-16 w-auto object-contain" />
          </NuxtLink>

          <NuxtLink to="/" @click="handleNavClick" class="transition-all duration-300 absolute inset-0 flex items-center justify-center"
            :class="!isCollapsed ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'">
            <img src="/img/clientbaselogo-min.png" alt="Client Base" class="h-16 w-auto object-contain drop-shadow-lg" />
          </NuxtLink>
        </div>

        <div class="hidden lg:flex justify-end px-2 pt-2">
          <button 
            @click="isCollapsed = !isCollapsed"
            class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Toggle Sidebar"
          >
            <UIcon :name="isCollapsed ? 'i-heroicons-chevron-double-right' : 'i-heroicons-chevron-double-left'" class="w-4 h-4" />
          </button>
        </div>

        <nav class="flex-1 px-2 space-y-1 mt-4 overflow-y-auto">
          <NuxtLink to="/" @click="handleNavClick"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap text-xs font-medium"
            :class="isCollapsed ? 'lg:justify-center' : ''"
            :title="isCollapsed ? 'Dashboard' : ''" 
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span class="transition-all duration-300" :class="isCollapsed ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'">
              Dashboard
            </span>
          </NuxtLink>
          
          <div class="pt-6 pb-2 px-3 text-[9px] uppercase font-bold text-gray-600 tracking-widest transition-opacity duration-300 whitespace-nowrap overflow-hidden"
            :class="isCollapsed ? 'lg:opacity-0 lg:h-0 lg:py-0' : 'opacity-100'">
            Quick Access
          </div>
          
          <NuxtLink to="/library" @click="handleNavClick"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap text-xs font-medium"
            :class="isCollapsed ? 'lg:justify-center' : ''"
            :title="isCollapsed ? 'Code Library' : ''"
          >
            <UIcon name="i-heroicons-code-bracket" class="w-5 h-5 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span class="transition-all duration-300" :class="isCollapsed ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'">
              Code Library
            </span>
          </NuxtLink>
          
          <NuxtLink to="/retainers" @click="handleNavClick"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap text-xs font-medium"
            :class="isCollapsed ? 'lg:justify-center' : ''"
            :title="isCollapsed ? 'Retainers' : ''"
          >
            <UIcon name="i-heroicons-banknotes" class="w-5 h-5 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span class="transition-all duration-300" :class="isCollapsed ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'">
              Retainers
            </span>
          </NuxtLink>
          
          <NuxtLink to="/settings" @click="handleNavClick"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-all group overflow-hidden whitespace-nowrap mt-auto text-xs font-medium"
            :class="isCollapsed ? 'lg:justify-center' : ''"
            :title="isCollapsed ? 'Settings' : ''"
          >
            <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-gray-400 group-hover:text-primary shrink-0 transition-colors" />
            <span class="transition-all duration-300" :class="isCollapsed ? 'lg:opacity-0 lg:w-0 lg:hidden' : 'opacity-100'">
              Settings
            </span>
          </NuxtLink>
        </nav>

        <!-- Profile Section -->
        <div v-if="user" class="flex-none border-t border-white/5 bg-secondary overflow-hidden">
          <!-- Loading state (optional) -->
          <div v-if="isLoading" class="p-4 flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-primary" />
            <span v-if="!isCollapsed" class="text-xs text-gray-400">Loading profile...</span>
          </div>
          
          <div v-else class="flex items-center gap-3 p-4 transition-all duration-300" :class="isCollapsed ? 'lg:justify-center px-2' : ''">
            <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="Profile" 
                 class="w-8 h-8 rounded-full object-cover shadow-lg border-2 border-primary/50 shrink-0" />
            <div v-else class="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-xs text-white shadow-lg shrink-0">
              {{ displayInitial }}
            </div>
            
            <div class="truncate transition-all duration-300" :class="isCollapsed ? 'lg:w-0 lg:opacity-0 lg:hidden' : 'w-auto opacity-100'">
              <p class="text-xs font-bold text-white truncate">{{ displayName }}</p>
              <p class="text-[9px] text-gray-500 font-medium truncate">{{ displayRole }}</p>
            </div>
          </div>

          <div class="flex items-center border-t border-white/5">
            <button @click="auth.logout" 
              class="flex-1 text-left px-4 py-3 text-[10px] uppercase font-bold text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2 overflow-hidden whitespace-nowrap"
              :class="isCollapsed ? 'lg:justify-center' : ''"
              :title="isCollapsed ? 'Logout' : ''">
              <UIcon name="i-heroicons-arrow-left-on-rectangle" class="w-4 h-4 shrink-0" />
              <span :class="isCollapsed ? 'lg:hidden' : ''">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <main class="flex-1 h-full overflow-y-auto overflow-x-hidden w-full transition-all duration-300"
            :class="isCollapsed ? 'lg:pl-20' : 'lg:pl-64'">
        <div class="p-4 md:p-8">
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

/* Smooth transitions for sidebar elements */
aside * {
  transition-property: opacity, width, transform;
  transition-duration: 300ms;
  transition-timing-function: ease-in-out;
}
</style>