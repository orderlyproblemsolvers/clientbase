<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const user = useSupabaseUser()
const { profile } = useUserProfile()

// v-model:open is viewport-aware:
// desktop → controls expanded / collapsed (icon) state
// mobile  → controls modal/drawer open state
const open = ref(true)
const route = useRoute()

watch(() => route.path, () => {
  if (window.innerWidth < 1024) open.value = false
})

const displayName = computed(() =>
  profile.value.full_name ||
  user.value?.user_metadata?.full_name ||
  user.value?.email ||
  'User'
)

const displayRole = computed(() =>
  profile.value.role ||
  user.value?.user_metadata?.role ||
  'Team Member'
)

const displayInitial = computed(() => {
  const name = displayName.value
  return name ? name.charAt(0).toUpperCase() : 'U'
})

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
  <div class="h-screen w-screen bg-base font-sans text-white flex flex-col overflow-hidden">

    <!-- Mobile-only top bar -->
    <header class="lg:hidden flex-none flex items-center justify-between p-4 bg-secondary border-b border-white/5 z-40">
      <NuxtLink to="/">
        <img src="/img/clientbaselogo-white.png" alt="Client Base OPS" class="h-16 w-auto object-contain" />
      </NuxtLink>
      <UButton
        icon="i-heroicons-bars-3-bottom-left"
        color="neutral"
        variant="ghost"
        aria-label="Open menu"
        class="text-gray-400 hover:text-white"
        @click="open = true"
      />
    </header>

    <!-- Sidebar + Main -->
    <div class="flex flex-1 overflow-hidden">

      <USidebar
      rail
      close
      close-icon="i-heroicons-x-mark"
        v-model:open="open"
        collapsible="icon"
        :ui="{
          root: 'bg-secondary border-r border-white/5 shadow-2xl lg:shadow-none',
          header: 'h-16 border-b border-white/5 px-4 flex items-center',
          body: 'px-2 py-2 mt-1',
          footer: 'border-t border-white/5 px-0 py-0',
          inner: 'bg-secondary divide-white/5',
          container: 'h-full',
        }"
      >

        <!-- Logo -->
        <template #header>
          <NuxtLink to="/" class="flex items-center justify-center w-full h-full">
            <Transition name="logo" mode="out-in">
              <img
                v-if="open"
                key="full"
                src="/img/clientbaselogo-white.png"
                alt="Client Base OPS"
                class="h-16 w-auto object-contain"
              />
              <img
                v-else
                key="mini"
                src="/img/clientbaselogo-min.png"
                alt="Client Base"
                class="h-16 w-auto object-contain drop-shadow-lg"
              />
            </Transition>
          </NuxtLink>
        </template>

        <!-- Navigation — direct child, no #default wrapper to avoid duplicate slot conflict -->
        <UNavigationMenu
          :key="String(open)"
          :items="getNavItems(open ? 'expanded' : 'collapsed')"
          orientation="vertical"
          :ui="{
            root: 'w-full',
            link: [
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium',
              'text-gray-400 hover:text-white hover:bg-white/5 transition-all',
              'data-[active=true]:bg-white/5 data-[active=true]:text-primary',
              'overflow-hidden whitespace-nowrap',
            ],
            linkLeadingIcon: 'size-5 shrink-0',
            label: 'pt-6 pb-2 px-3 text-[9px] uppercase font-bold text-gray-600 tracking-widest',
          }"
        />

        <!-- User Profile + Logout -->
        <template #footer>
          <div v-if="user">

            <!-- Loading -->
            <div
              v-if="profile.loading"
              class="p-4 flex items-center gap-2"
              :class="!open ? 'justify-center' : ''"
            >
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-primary shrink-0" />
              <span v-if="open" class="text-xs text-gray-400">Loading profile...</span>
            </div>

            <!-- Profile -->
            <div
              v-else
              class="flex items-center gap-3 p-4"
              :class="!open ? 'justify-center px-2' : ''"
            >
              <img
                v-if="profile.avatar_url"
                :src="profile.avatar_url"
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
                  <p class="text-[9px] text-gray-500 font-medium truncate">{{ displayRole }}</p>
                </div>
              </Transition>
            </div>

            <!-- Logout -->
            <div class="border-t border-white/5">
              <button
                class="w-full px-4 py-3 text-[10px] uppercase font-bold text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2"
                :class="!open ? 'justify-center' : ''"
                :title="!open ? 'Logout' : ''"
                @click="auth.logout"
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