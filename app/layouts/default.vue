<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const user = useSupabaseUser()

// ── Sidebar state ─────────────────────────────────────────────────────────────
const open = ref(false)
const collapsed = ref(false)

const route = useRoute()
watch(() => route.path, () => {
  open.value = false
})

// ── Display values from store ────────────────────────────────────────────────
const displayName = computed(() => auth.displayName)
const displayRole = computed(() => auth.displayRole)
const displayInitial = computed(() => auth.displayInitial)

const avatarUrl      = computed(() => auth.profile.avatar_url)
const profileLoading = computed(() => auth.profileLoading)

// ── Global search control ─────────────────────────────────────────────────────
const { isOpen: showGlobalSearch } = useGlobalSearch()

// ── Navigation Items ─────────────────────────────────────────────────────────
const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Dashboard',
    icon:  'i-heroicons-squares-2x2',
    to:    '/',
  },
  {
    label: 'Calendar',
    icon:  'i-heroicons-calendar-days',
    to:    '/calendar',
  },
  { 
    type: 'label', 
    label: 'Work' 
  },
  {
    label: 'Projects',
    icon:  'i-heroicons-folder-open',
    to:    '/projects',
  },
  {
    label: 'Onboarding',
    icon:  'i-heroicons-clipboard-document-list',
    to:    '/onboarding',
  },
  { 
    type: 'label', 
    label: 'Quick Access' 
  },
  {
    label: 'Library',
    icon:  'i-heroicons-book-open',
    to:    '/library',
  },
  {
    label: 'Retainers',
    icon:  'i-heroicons-banknotes',
    to:    '/retainers',
  },
  {
    label: 'Settings',
    icon:  'i-heroicons-cog-6-tooth',
    to:    '/settings',
  },
])
</script>

<template>
  <UDashboardGroup class="bg-base text-white">
    
    <!-- Sidebar -->
    <UDashboardSidebar
      v-model:open="open"
      v-model:collapsed="collapsed"
      collapsible
      resizable
      :ui="{
        root: 'bg-base border-r border-white/5 no-scrollbar',
        header: 'h-16 border-b border-white/5 px-4 flex items-center',
        body: 'px-2 py-4 no-scrollbar',
        footer: 'border-t border-white/5 p-4',
      }"
    >
      <!-- Desktop Sidebar Header -->
      <template #header>
        <NuxtLink to="/" class="flex items-center">
          <img
            v-if="!collapsed"
            src="/img/clientbaselogo-white.png"
            alt="Client Base OPS"
            class="h-16 w-auto object-contain"
          />
          <img
            v-else
            src="/img/clientbaselogo-min.png"
            alt="Client Base"
            class="h-16 w-auto object-contain drop-shadow-lg"
          />
        </NuxtLink>
      </template>

      <template #default>
        <!-- Desktop Search Bar -->
        <UButton
          v-if="!collapsed"
          label="Search..."
          icon="i-heroicons-magnifying-glass"
          color="neutral"
          variant="outline"
          block
          class="mb-4 text-slate-400 border-white/10 hover:bg-white/5 hover:text-white"
          @click="showGlobalSearch = true"
        >
          <template #trailing>
            <div class="flex items-center gap-0.5 ms-auto opacity-50">
              <UKbd value="meta" variant="subtle" size="sm" />
              <UKbd value="K" variant="subtle" size="sm" />
            </div>
          </template>
        </UButton>
        <UButton
          v-else
          icon="i-heroicons-magnifying-glass"
          color="neutral"
          variant="ghost"
          block
          class="mb-4 text-slate-400 hover:text-white"
          @click="showGlobalSearch = true"
        />

        <UNavigationMenu
          :items="navItems"
          :collapsed="collapsed"
          orientation="vertical"
          :ui="{
            root: 'w-full no-scrollbar',
            link: [
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
              'text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150',
              'data-[active=true]:bg-white/5 data-[active=true]:text-primary',
            ],
            label: 'pt-6 pb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600',
          }"
        />
      </template>

      <template #footer>
        <div v-if="user" class="w-full space-y-4">
          <div 
            class="flex items-center gap-3" 
            :class="collapsed ? 'justify-center' : ''"
          >
            <UAvatar
              v-if="avatarUrl"
              :src="avatarUrl"
              size="sm"
              class="border-2 border-primary/50 shadow-lg"
            />
            <UAvatar
              v-else
              :alt="displayInitial"
              size="sm"
              class="bg-primary text-white shadow-lg"
            />
            
            <div v-if="!collapsed" class="truncate min-w-0">
              <p class="text-xs font-bold text-white truncate">{{ displayName }}</p>
              <p class="text-[9px] text-slate-500 font-medium truncate">{{ displayRole }}</p>
            </div>
          </div>

          <UButton
            icon="i-heroicons-arrow-left-on-rectangle"
            label="Logout"
            color="error"
            variant="ghost"
            block
            :square="collapsed"
            :truncate="!collapsed"
            class="text-[10px] font-bold uppercase"
            @click="auth.logout"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <!-- Main Content Panel -->
    <UDashboardPanel :ui="{
      root: 'no-scrollbar'
    }">
      <template #header>
        <!-- 
          Requirement #1: Remove "Dashboard" title on mobile and use logo.
          Requirement #2: Remove search icon from header.
        -->
        <UDashboardNavbar 
          :ui="{
            root: 'bg-base border-b border-white/5 no-scrollbar',
            left: 'flex-1'
          }"
        >
          <template #left>
            <div class="flex items-center gap-2">
              <!-- Hamburger toggle (mobile) / Collapse toggle (desktop) -->
              <UDashboardSidebarCollapse class="text-slate-400 hover:text-white" />
              
              <!-- Requirement #1: Logo in the header for mobile/desktop context -->
              <NuxtLink to="/" class="lg:hidden flex items-center">
                <img
                  src="/img/clientbaselogo-white.png"
                  alt="Client Base OPS"
                  class="h-16 w-auto object-contain"
                />
              </NuxtLink>
            </div>
          </template>

          <template #right>
            <!-- Search removed from here as per Requirement #2 -->
          </template>
        </UDashboardNavbar>
      </template>

      <!-- Requirement #3: Hide scrollbar on large screens -->
      <template #body>
        <div class="flex-1 overflow-y-auto no-scrollbar">
          <div class=" md:p-8">
            <slot />
          </div>
        </div>
      </template>
    </UDashboardPanel>

    <GlobalSearch />
  </UDashboardGroup>
</template>

<style scoped>
/* Requirement #3: CSS to hide scrollbars while maintaining scroll functionality */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>