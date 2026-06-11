<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const user = useSupabaseUser()

// ── Responsive breakpoint detection ───────────────────────────────────────────
const isMobile = ref(false)

function updateBreakpoint() {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  updateBreakpoint()
  window.addEventListener('resize', updateBreakpoint)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateBreakpoint)
})

// ── Sidebar state ─────────────────────────────────────────────────────────────
const open = ref(!isMobile.value)

const route = useRoute()
watch(() => route.path, () => {
  if (isMobile.value) open.value = false
})

watch(isMobile, (mobile) => {
  if (!mobile) open.value = true
  else open.value = false
})

// ── Display values — read directly from store ────────────────────────────────
const displayName = computed(() => auth.displayName)
const displayRole = computed(() => auth.displayRole)
const displayInitial = computed(() => auth.displayInitial)

const avatarUrl      = computed(() => auth.profile.avatar_url)
const profileLoading = computed(() => auth.profileLoading)

// ── Global search control ─────────────────────────────────────────────────────
const { isOpen: showGlobalSearch } = useGlobalSearch()

function getNavItems(state: 'expanded' | 'collapsed'): NavigationMenuItem[] {
  return [
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
    ...(state === 'expanded'
      ? [{ type: 'label' as const, label: 'Work' }]
      : []),
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
    ...(state === 'expanded'
      ? [{ type: 'label' as const, label: 'Quick Access' }]
      : []),
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
  ]
}
</script>

<template>
  <div class="h-screen w-screen bg-base text-white flex flex-col overflow-hidden">

    <!-- Mobile-only top bar -->
    <header class="lg:hidden flex-none flex items-center justify-between px-5 py-4 bg-base border-b border-white/5 z-40">
      <NuxtLink to="/">
        <img src="/img/clientbaselogo-white.png" alt="Client Base OPS" class="h-12 w-auto object-contain" />
      </NuxtLink>
      <div class="flex items-center gap-2">
        <!-- Global search button (mobile) -->
        <button
          class="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Search"
          @click="showGlobalSearch = true"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
        </button>

        <button
          class="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Open menu"
          @click="open = true"
        >
          <UIcon name="i-heroicons-bars-3-bottom-left" class="w-6 h-6" />
        </button>
      </div>
    </header>

    <!-- Sidebar + Main -->
    <div class="flex flex-1 overflow-hidden">

      <USidebar
        v-model:open="open"
        :overlay="isMobile"
        :close="isMobile"
        close-icon="i-heroicons-x-mark"
        collapsible="icon"
        expand-on-hover
        :ui="{
          root: 'bg-base border-r border-white/5 shadow-2xl lg:shadow-none',
          panel: 'bg-base border-r border-white/5',
          header: 'h-16 border-b border-white/5 px-4 flex items-center',
          body: 'px-2 py-2 mt-1',
          footer: 'border-t border-white/5 px-0 py-0',
          inner: 'bg-base divide-white/5',
          container: 'h-full',
        }"
      >

        <!-- Logo + mobile close button -->
        <template #header>
          <div class="flex items-center justify-between w-full h-full">
            <NuxtLink to="/" class="flex items-center justify-center">
              <Transition name="logo" mode="out-in">
                <img
                  v-if="open"
                  key="full"
                  src="/img/clientbaselogo-white.png"
                  alt="Client Base OPS"
                  class="h-12 w-auto object-contain"
                />
                <img
                  v-else
                  key="mini"
                  src="/img/clientbaselogo-min.png"
                  alt="Client Base"
                  class="h-12 w-auto object-contain drop-shadow-lg"
                />
              </Transition>
            </NuxtLink>

            <button
              v-if="isMobile"
              class="p-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Close sidebar"
              @click="open = false"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>
        </template>

        <!-- Navigation -->
        <UNavigationMenu
          :key="String(open)"
          :items="getNavItems(open ? 'expanded' : 'collapsed')"
          orientation="vertical"
          :ui="{
            root: 'w-full',
            link: [
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
              'text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150',
              'data-[active=true]:bg-white/5 data-[active=true]:text-primary',
              'overflow-hidden whitespace-nowrap',
            ],
            linkLeadingIcon: 'size-5 shrink-0',
            label: 'pt-6 pb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600',
          }"
        />

        <!-- User Profile + Logout -->
        <template #footer>
          <div v-if="user">

            <!-- Loading -->
            <div
              v-if="profileLoading"
              class="p-4 flex items-center gap-2"
              :class="!open ? 'justify-center' : ''"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-primary shrink-0" />
              <span v-if="open" class="text-xs text-slate-400">Loading profile...</span>
            </div>

            <!-- Profile -->
            <div
              v-else
              class="flex items-center gap-3 p-4"
              :class="!open ? 'justify-center px-2' : ''"
            >
              <img
                v-if="avatarUrl"
                :src="avatarUrl"
                alt="Profile"
                class="w-8 h-8 rounded-full object-cover border-2 border-primary/50 shrink-0 shadow-lg"
              />
              <div
                v-else
                class="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-lg"
              >
                {{ displayInitial }}
              </div>

              <Transition name="fade">
                <div v-if="open" class="truncate min-w-0">
                  <p class="text-xs font-bold text-white truncate">{{ displayName }}</p>
                  <p class="text-[9px] text-slate-500 font-medium truncate">{{ displayRole }}</p>
                </div>
              </Transition>
            </div>

            <!-- Logout -->
            <div class="border-t border-white/5">
              <button
                @click="auth.logout"
                class="w-full px-4 py-3 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2"
                :class="!open ? 'justify-center' : ''"
                :title="!open ? 'Logout' : ''"
              >
                <UIcon name="i-heroicons-arrow-left-on-rectangle" class="w-4 h-4 shrink-0" />
                <span v-if="open">Logout</span>
              </button>
            </div>

          </div>
        </template>

      </USidebar>

      <!-- Main content -->
      <main class="flex-1 h-full overflow-y-auto overflow-x-hidden">
        <div class="p-4 md:p-8">
          <slot />
        </div>
      </main>

    </div>

    <!-- Global Search (Cmd+K) -->
    <GlobalSearch />
  </div>
</template>

<style scoped>
.logo-enter-active,
.logo-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.logo-enter-from,
.logo-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>