<script setup lang="ts">
definePageMeta({
  layout: false
})

const user = useSupabaseUser()

// ── Pain point → solution mapping ────────────────────────────────────────────
const painPoints = [
  {
    id: 'scattered',
    pain: '"Where\'s that client\'s brief again?"',
    solution: 'Every client, project, brief, and file lives in one organised workspace — searchable from a single dashboard.',
    icon: 'i-heroicons-magnifying-glass-circle',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    id: 'onboarding',
    pain: '"Onboarding new clients takes days of back-and-forth emails."',
    solution: 'Structured intake forms collect requirements, budgets, and deadlines upfront — auto‑creating projects from responses.',
    icon: 'i-heroicons-clipboard-document-check',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    id: 'billing',
    pain: '"Who\'s paid? Who\'s overdue? I\'ve lost track."',
    solution: 'Invoices, retainers, and split‑payment schedules with real‑time status — never chase a late payment blind again.',
    icon: 'i-heroicons-banknotes',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    id: 'snippets',
    pain: '"I wrote that function last month — now I can\'t find it."',
    solution: 'A shared code library with syntax highlighting, tagging, and instant copy — stop rewriting the same logic.',
    icon: 'i-heroicons-code-bracket',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
  },
  {
    id: 'secrets',
    pain: '"Sharing API keys over Slack feels reckless."',
    solution: 'Encrypted secrets vault per project — reveal, copy, and rotate credentials without leaving the dashboard.',
    icon: 'i-heroicons-shield-check',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
  },
  {
    id: 'deadlines',
    pain: '"We missed a milestone because nobody saw it coming."',
    solution: 'Unified calendar with tasks, milestones, invoice dues, and project timelines — all visible at a glance.',
    icon: 'i-heroicons-calendar-days',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/20',
  },
]

// ── Scroll to section ─────────────────────────────────────────────────────────
const scrollToSection = (id: string) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="min-h-screen bg-base text-white font-sans selection:bg-primary/30 overflow-x-hidden">

    <!-- ===== Navigation ===== -->
    <nav class="fixed top-0 w-full z-50 border-b border-white/5 bg-base/80 backdrop-blur-lg">
      <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2">
          <img
            src="/img/clientbaselogo-min.png"
            alt="ClientBase"
            class="h-10 w-auto object-contain"
          />
        </NuxtLink>

        <div class="flex items-center gap-3">
          <template v-if="user">
            <NuxtLink
              to="/"
              class="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all duration-150 active:scale-[0.98]"
            >
              Open Dashboard
            </NuxtLink>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-150"
            >
              Sign In
            </NuxtLink>
            <NuxtLink
              to="/signup"
              class="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all duration-150 active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              Get Started
            </NuxtLink>
          </template>
        </div>
      </div>
    </nav>

    <!-- ===== Hero ===== -->
    <section class="relative pt-32 pb-20 lg:pt-44 lg:pb-28 overflow-hidden">
      <!-- Background glow -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/10 rounded-full blur-[140px] -z-10 opacity-50 pointer-events-none"></div>

      <div class="max-w-4xl mx-auto px-6 text-center">
        <span class="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
          Built for dev agencies
        </span>

        <h1 class="text-4xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
          Stop juggling tools.<br>
          <span class="text-primary">Run your agency</span> from one place.
        </h1>

        <p class="text-lg lg:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          ClientBase replaces scattered spreadsheets, chat threads, and sticky notes
          with a single dashboard built for how dev agencies actually work.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <NuxtLink
            to="/signup"
            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-base font-semibold transition-all duration-150 active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            Start for free
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
          </NuxtLink>
          <button
            @click="scrollToSection('problems')"
            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/6 text-slate-300 hover:text-white text-base font-semibold transition-all duration-150"
          >
            See what it solves
          </button>
        </div>

        <p class="text-xs text-slate-600 mt-4">No credit card required · Free tier available</p>
      </div>
    </section>

    <!-- ===== Pain Points → Solutions ===== -->
    <section id="problems" class="py-24 border-t border-white/5 scroll-mt-20">
      <div class="max-w-5xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold mb-3">You know the pain. Heres the fix.</h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            Six real problems agencies face every day — and how ClientBase eliminates them.
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <div
            v-for="pp in painPoints"
            :key="pp.id"
            class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 group"
          >
            <div class="flex items-start gap-4">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                :class="[pp.bg, pp.border]"
              >
                <UIcon :name="pp.icon" class="w-5 h-5" :class="pp.color" />
              </div>
              <div>
                <p class="text-sm font-medium text-slate-300 italic mb-2 leading-relaxed">
                  {{ pp.pain }}
                </p>
                <p class="text-sm text-slate-400 leading-relaxed">
                  {{ pp.solution }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== How it works (simple 3-step) ===== -->
    <section class="py-24 border-t border-white/5">
      <div class="max-w-5xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold mb-3">Three steps to agency clarity</h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            No complex setup. No steep learning curve. Just results.
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <span class="text-primary font-bold text-lg">1</span>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">Add your clients</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Create client profiles with contacts, categories, and websites in seconds.
            </p>
          </div>

          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <span class="text-primary font-bold text-lg">2</span>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">Send onboarding forms</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Clients fill structured briefs that auto‑create projects with budgets and deadlines.
            </p>
          </div>

          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
              <span class="text-primary font-bold text-lg">3</span>
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">Deliver & get paid</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Track milestones, share project portals, send invoices — all from one place.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Who it's for ===== -->
    <section class="py-24 border-t border-white/5">
      <div class="max-w-5xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold mb-3">Built for people like you</h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            Whether you're a solo dev or a growing agency, ClientBase scales with you.
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 text-center">
            <UIcon name="i-heroicons-user" class="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 class="text-lg font-semibold text-white mb-2">Freelancers</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Keep 5–10 clients organised without a spreadsheet. Know exactly what's due and when.
            </p>
          </div>

          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 text-center">
            <UIcon name="i-heroicons-user-group" class="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 class="text-lg font-semibold text-white mb-2">Small Agencies</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Onboard clients professionally, share secure project links, and keep your team aligned.
            </p>
          </div>

          <div class="bg-white/[0.03] border border-white/6 rounded-2xl p-6 text-center">
            <UIcon name="i-heroicons-building-office-2" class="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 class="text-lg font-semibold text-white mb-2">Studios</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              Manage dozens of projects with reusable templates, code libraries, and billing automation.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== CTA ===== -->
    <section class="py-24 border-t border-white/5">
      <div class="max-w-3xl mx-auto px-6 text-center">
        <h2 class="text-3xl font-bold mb-4">Ready to stop the chaos?</h2>
        <p class="text-slate-400 text-base mb-8 max-w-lg mx-auto">
          Join agencies who've replaced scattered tools with a single, powerful workspace.
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <NuxtLink
            to="/signup"
            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-base font-semibold transition-all duration-150 active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            Start building free
            <UIcon name="i-heroicons-arrow-right" class="w-4 h-4" />
          </NuxtLink>
          <NuxtLink
            to="/login"
            class="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/6 text-slate-300 hover:text-white text-base font-semibold transition-all duration-150"
          >
            Sign in
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- ===== Footer ===== -->
    <footer class="border-t border-white/5 py-10">
      <div class="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-2">
          <img src="/img/clientbaselogo-min.png" alt="ClientBase" class="h-6 w-auto opacity-50" />
          <span class="text-xs text-slate-600">© 2026 ClientBase</span>
        </div>
        <div class="flex gap-6 text-xs text-slate-600">
          <a href="#" class="hover:text-slate-400 transition-colors">Privacy</a>
          <a href="#" class="hover:text-slate-400 transition-colors">Terms</a>
          <a href="#" class="hover:text-slate-400 transition-colors">Contact</a>
        </div>
      </div>
    </footer>

  </div>
</template>