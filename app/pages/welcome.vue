<script setup>
definePageMeta({
  layout: false,
})

useSeoMeta({
  title: 'ClientBase – Unified Freelance Workspace',
  description: 'Consolidate client data, automate onboarding, and centralize billing in an engineered environment designed for independent professionals.',
})

const user = useSupabaseUser()

const useScrollReveal = () => {
  const revealed = ref(false)
  const elRef = ref(null)

  onMounted(() => {
    if (!elRef.value) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          revealed.value = true
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(elRef.value)
  })

  return { elRef, revealed }
}

const operationalBottlenecks = [
  {
    title: 'Data Fragmentation',
    description: 'Client details reside in a CRM, project milestones in separate trackers, and invoices in isolated spreadsheets. This decentralization requires constant manual synchronization.',
  },
  {
    title: 'Inefficient Onboarding',
    description: 'Relying on disparate forms, emails, and PDFs creates friction. Manually provisioning project workspaces post-onboarding consumes valuable development time.',
  },
  {
    title: 'Opaque Client Communications',
    description: 'Without a centralized portal, clients lack visibility into project status and financial obligations, leading to redundant status inquiries.',
  },
  {
    title: 'Poor Financial Tracking',
    description: 'Decoupled invoicing leads to delayed payments and tracking errors. Identifying overdue milestones requires auditing multiple separate platforms.',
  },
]

const features = [
  {
    id: 'onboarding',
    title: 'Automated Onboarding Architecture',
    description: 'Deploy dynamic, brand-aligned forms with smart field mapping. A single client submission automatically provisions a project environment, establishes budget parameters, and attaches the initial brief.',
    image: '/img/welcome/onboarding.png',
    icon: 'i-heroicons-clipboard-document-list',
  },
  {
    id: 'workspace',
    title: 'Centralized Control Plane',
    description: 'Access a unified dashboard aggregating active projects, pending deliverables, and financial metrics. Global search and interconnected data structures eliminate the need to switch contexts.',
    image: '/img/welcome/control.png',
    icon: 'i-heroicons-cpu-chip',
  },
  {
    id: 'billing',
    title: 'Integrated Financial Operations',
    description: 'Manage line items, structured payment schedules, and recurring retainers. The billing engine syncs directly with project milestones, providing instant visibility into outstanding ledger balances.',
    image: '/img/welcome/retainers.png',
    icon: 'i-heroicons-banknotes',
  },
]

const testimonials = [
  {
    quote: 'The automated provisioning has reduced our administrative overhead by hours each week. Projects are instantly staged upon client form submission.',
    name: 'Jane D.',
    role: 'Freelance Engineer',
  },
  {
    quote: 'The client portal provides necessary transparency without requiring account management. Status update requests have dropped to zero.',
    name: 'Alex M.',
    role: 'Full-Stack Developer',
  },
  {
    quote: 'Consolidating our CRM, task tracking, and billing into a single ecosystem has standardized our entire operational workflow.',
    name: 'Priya K.',
    role: 'Agency Director',
  },
]

const faqs = [
  {
    q: 'Is there a cost-free tier available?',
    a: 'Yes. The Free tier provides core infrastructural access: up to 5 active project environments, standard onboarding forms, client portals, and essential invoicing. The Pro tier unlocks infinite scaling and advanced financial routing.',
  },
  {
    q: 'How does ClientBase differentiate from existing legacy tools?',
    a: 'ClientBase is engineered for high performance and low bloat. We prioritize a clean UI, rapid data retrieval, and interconnected systems (like snippets that sync with calendars) rather than disconnected feature modules.',
  },
  {
    q: 'How is client portal security managed without authentication?',
    a: 'Each project generates a cryptographically secure, unique identifier link. This allows clients frictionless access to their specific data silo without managing a password lifecycle.',
  },
  {
    q: 'Are data exports supported?',
    a: 'Full data portability is standard. You can export JSON or CSV payloads of your client, project, and financial data at any time. REST API access is currently in development.',
  },
]

const openFaq = ref(null)
const toggleFaq = (idx) => {
  openFaq.value = openFaq.value === idx ? null : idx
}
</script>

<template>
  <div class="font-sans text-gray-900 antialiased selection:bg-primary/20 selection:text-primary">
    <header class="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100 transition-all">
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2">
          <NuxtImg
            src="/img/clientbase-main.svg"
            alt="ClientBase"
            class="h-7 w-auto"
          />
        </NuxtLink>
        <div class="flex items-center gap-6">
          <template v-if="user">
            <NuxtLink
              to="/"
              class="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Console
            </NuxtLink>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign In
            </NuxtLink>
            <NuxtLink
              to="/signup"
              class="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/20 transition-colors shadow-sm"
            >
              Get Started
            </NuxtLink>
          </template>
        </div>
      </div>
    </header>

    <section class="relative pt-32 pb-10 lg:pt-48 lg:pb-16 overflow-hidden bg-white">
      <div class="relative max-w-5xl mx-auto px-6 text-center z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-8 animate-fade-in-up">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          ClientBase v1.0 is now live
        </div>

        <h1 class="text-4xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6 animate-fade-in-up animation-delay-200">
          The unified operating system <br class="hidden lg:block"/> for independent professionals.
        </h1>
        <p class="text-lg lg:text-xl text-gray-500 max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-300">
          Consolidate your CRM, project management, and invoicing into a single, highly structured environment. Engineered for clarity, speed, and absolute operational control.
        </p>

        <div class="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-up animation-delay-400">
          <NuxtLink
            to="/signup"
            class="px-8 py-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/60 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            Start building for free
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
          </NuxtLink>
          <a
            href="#architecture"
            class="px-8 py-3.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Explore architecture
          </a>
        </div>
      </div>

      <div class="relative max-w-6xl mx-auto px-6 mt-20 z-10 animate-fade-in-up animation-delay-500">
        <div class="bg-gray-50/50 border border-gray-200/60 rounded-2xl md:rounded-[2rem] shadow-2xl shadow-blue-900/5 aspect-[16/9] lg:aspect-[21/9] flex items-center justify-center overflow-hidden relative backdrop-blur-sm">
          <NuxtImg
            src="/img/welcome/hero-img.png"
            alt="ClientBase Screenshot"
            class="w-full h-full rounded-lg border border-gray-200/70 shadow-sm object-cover"
          />
        </div>
      </div>

      <!-- Animated primary-colour wave — lower third of section -->
      <div aria-hidden="true" class="hero-wave-container">
        <!-- Fade the very top edge so waves blend into white -->
        <div class="hero-wave-fade" />

        <!-- Three layered waves at staggered depths and speeds -->
        <svg class="hero-wave hero-wave--1" viewBox="0 0 1440 320" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,160 C180,220 360,80 540,140 C720,200 900,100 1080,160 C1260,220 1350,140 1440,160 L1440,320 L0,320 Z" fill="rgba(77,72,229,0.15)" />
        </svg>
        <svg class="hero-wave hero-wave--2" viewBox="0 0 1440 320" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,200 C200,140 400,260 600,200 C800,140 1000,240 1200,190 C1350,155 1400,210 1440,200 L1440,320 L0,320 Z" fill="rgba(77,72,229,0.25)" />
        </svg>
        <svg class="hero-wave hero-wave--3" viewBox="0 0 1440 320" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,240 C240,200 480,280 720,240 C960,200 1200,260 1440,240 L1440,320 L0,320 Z" fill="rgba(77,72,229,0.35)" />
        </svg>
      </div>
    </section>

    <section id="bottlenecks" class="py-24 bg-gray-50 relative z-10 border-b border-gray-100">
      <div class="max-w-6xl mx-auto px-6">
        <div class="mb-16 max-w-2xl">
          <h2 class="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Resolving operational friction.</h2>
          <p class="text-gray-500 text-lg">Current workflows rely on fragile integrations between disparate tools, causing data loss and administrative bloat.</p>
        </div>
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="(item, idx) in operationalBottlenecks"
            :key="idx"
            class="bg-white border border-gray-200/70 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
          >
            <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-5">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-gray-600" />
            </div>
            <h3 class="text-base font-semibold text-gray-900 mb-2">{{ item.title }}</h3>
            <p class="text-sm text-gray-500 leading-relaxed">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <section id="architecture" class="py-24 bg-white">
      <div class="max-w-6xl mx-auto px-6">
        <div class="text-center mb-20 max-w-3xl mx-auto">
          <h2 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Engineered for clarity and scale.</h2>
          <p class="text-gray-500 text-lg">A robust suite of tightly integrated modules designed to handle the entire lifecycle of a client relationship.</p>
        </div>

        <div class="space-y-32">
          <div v-for="(feat, idx) in features" :key="feat.id" class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div :class="idx % 2 === 1 ? 'lg:order-2' : ''">
              <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-primary mb-6">
                <UIcon :name="feat.icon" class="w-6 h-6" />
              </div>
              <h3 class="text-2xl font-bold text-gray-900 mb-4">{{ feat.title }}</h3>
              <p class="text-gray-600 text-lg leading-relaxed mb-6">{{ feat.description }}</p>
            </div>

            <div class="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden aspect-video flex items-center justify-center group relative shadow-sm">
              <NuxtImg :src="feat.image" alt="" class="object-cover hover:scale-105 transition-transform duration-300" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 bg-primary/60 text-white">
      <div class="max-w-6xl mx-auto px-6">
        <div class="mb-16">
          <h2 class="text-2xl lg:text-3xl font-bold mb-4">System validates.</h2>
          <p class="text-gray-400 text-lg">How technical and creative professionals utilize the platform.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
          <div
            v-for="(t, idx) in testimonials"
            :key="idx"
            class="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8"
          >
            <p class="text-gray-300 text-sm leading-relaxed mb-6">"{{ t.quote }}"</p>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300">
                {{ t.name.charAt(0) }}
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-100">{{ t.name }}</p>
                <p class="text-xs text-gray-400">{{ t.role }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 bg-gray-50 border-b border-gray-100">
      <div class="max-w-4xl mx-auto px-6 text-center">
        <h2 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Transparent infrastructure pricing.</h2>
        <p class="text-gray-500 text-lg mb-16">Deploy at zero cost. Upgrade infrastructure as your client base scales.</p>

        <div class="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <div class="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col text-left">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Base Environment</h3>
            <div class="mb-6">
              <span class="text-4xl font-bold text-gray-900">₦0</span>
              <span class="text-sm font-medium text-gray-500"> / mo</span>
            </div>
            <ul class="space-y-4 text-sm text-gray-600 mb-10 flex-grow">
              <li class="flex items-start gap-3">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-gray-900 shrink-0" />
                <span>Maintain up to 5 concurrent projects</span>
              </li>
              <li class="flex items-start gap-3">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-gray-900 shrink-0" />
                <span>Standard onboarding routines & client portals</span>
              </li>
              <li class="flex items-start gap-3">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-gray-900 shrink-0" />
                <span>Core invoicing & ledger tracking</span>
              </li>
            </ul>
            <NuxtLink
              to="/signup"
              class="block w-full py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors text-center"
            >
              Deploy Free Workspace
            </NuxtLink>
          </div>

          <div class="bg-white border-2 border-primary rounded-2xl p-8 shadow-xl shadow-blue-900/5 flex flex-col text-left relative">
            <div class="absolute -top-3 left-8 bg-primary text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full">
              Recommended
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Pro Environment</h3>
            <div class="mb-6">
              <span class="text-4xl font-bold text-gray-900">₦1900</span>
              <span class="text-sm font-medium text-gray-500"> / mo</span>
            </div>
            <ul class="space-y-4 text-sm text-gray-600 mb-10 flex-grow">
              <li class="flex items-start gap-3">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary shrink-0" />
                <span class="font-medium text-gray-900">Infinite concurrent projects</span>
              </li>
              <li class="flex items-start gap-3">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary shrink-0" />
                <span>Advanced billing (split schedules & retainers)</span>
              </li>
              <li class="flex items-start gap-3">
                <UIcon name="i-heroicons-check" class="w-5 h-5 text-primary shrink-0" />
                <span>Custom domain mapping for client portals</span>
              </li>
            </ul>
            <NuxtLink
              to="/signup?plan=pro"
              class="block w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/60 transition-colors text-center"
            >
              Upgrade to Pro
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 bg-white">
      <div class="max-w-3xl mx-auto px-6">
        <h2 class="text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-12">System Inquiries</h2>
        <dl class="space-y-3">
          <div
            v-for="(faq, idx) in faqs"
            :key="idx"
            class="bg-gray-50 border border-gray-100 rounded-xl overflow-hidden"
          >
            <dt>
              <button
                type="button"
                @click="toggleFaq(idx)"
                class="flex justify-between items-center w-full px-6 py-4 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100/50 transition-colors"
              >
                {{ faq.q }}
                <UIcon
                  name="i-heroicons-plus"
                  class="w-4 h-4 text-gray-500 transition-transform duration-300"
                  :class="{ 'rotate-45': openFaq === idx }"
                />
              </button>
            </dt>
            <Transition name="collapse">
              <dd v-show="openFaq === idx" class="px-6 pb-4 text-sm text-gray-600 leading-relaxed bg-white border-t border-gray-100">
                <div class="pt-4">{{ faq.a }}</div>
              </dd>
            </Transition>
          </div>
        </dl>
      </div>
    </section>

    <section class="py-24 bg-primary relative overflow-hidden">
      <div class="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
      <div class="relative max-w-3xl mx-auto px-6 text-center text-white">
        <h2 class="text-3xl lg:text-4xl font-bold mb-6">Initialize your optimized workflow.</h2>
        <p class="text-blue-100 text-lg mb-10">Standardize your operations. Deploy your integrated workspace today.</p>
        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <NuxtLink
            to="/signup"
            class="px-8 py-3.5 rounded-lg bg-white text-blue-700 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </section>

    <footer class="border-t border-gray-200 py-12 bg-white">
      <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-3">
          <NuxtImg src="/img/clientbase-main-min-no-bg-light.svg" alt="ClientBase Logo" class="h-5 w-auto grayscale opacity-50" />
          <span class="text-sm font-medium text-gray-500">© 2026 ClientBase Operations.</span>
        </div>
        <div class="flex gap-8 text-sm font-medium text-gray-500">
          <NuxtLink to="/privacy" class="hover:text-gray-900 transition-colors">Privacy Policy</NuxtLink>
          <NuxtLink to="/terms" class="hover:text-gray-900 transition-colors">Terms of Service</NuxtLink>
          <a href="mailto:help@orderlyproblemolvers.com" class="hover:text-gray-900 transition-colors">Support</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.font-sans {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* ── Hero wave ───────────────────────────────────────────────────────────── */

.hero-wave-container {
  position: absolute;
  inset-x: 0;
  bottom: 0;
  height: 38%;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;
}

.hero-wave-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, white 0%, transparent 30%);
  z-index: 3;
}

/* display:block prevents inline SVG bottom gap; transform-origin:bottom
   stops scaleY from clipping the wave top edge during animation */
.hero-wave {
  position: absolute;
  display: block;
  width: 200%;
  height: 100%;
  left: -50%;
  bottom: 0;
  transform-origin: bottom;
}

/* Fill is set inline on each <path> to bypass Vue scoped style targeting of SVG children */

.hero-wave--1 {
  animation: heroWave1 10s ease-in-out infinite;
  z-index: 1;
}

.hero-wave--2 {
  animation: heroWave2 14s ease-in-out infinite;
  z-index: 2;
}

.hero-wave--3 {
  animation: heroWave3 8s ease-in-out infinite;
  z-index: 2;
}

@keyframes heroWave1 {
  0%, 100% { transform: translateX(0%) scaleY(1); }
  50%       { transform: translateX(4%) scaleY(1.06); }
}

@keyframes heroWave2 {
  0%, 100% { transform: translateX(0%) scaleY(1); }
  50%       { transform: translateX(-5%) scaleY(0.94); }
}

@keyframes heroWave3 {
  0%, 100% { transform: translateX(0%) scaleY(1); }
  33%       { transform: translateX(3%) scaleY(1.04); }
  66%       { transform: translateX(-3%) scaleY(0.97); }
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  animation: fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.animation-delay-200 { animation-delay: 0.15s; }
.animation-delay-300 { animation-delay: 0.3s; }
.animation-delay-400 { animation-delay: 0.45s; }
.animation-delay-500 { animation-delay: 0.6s; }

/* ── FAQ accordion ───────────────────────────────────────────────────────── */

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 400px;
  opacity: 1;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>