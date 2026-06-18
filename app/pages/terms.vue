<!-- pages/terms.vue -->
<script setup lang="ts">
definePageMeta({ layout: false })
</script>

<template>
  <div class="min-h-screen bg-base font-sans text-slate-300 flex flex-col">
    <div class="max-w-3xl mx-auto px-4 py-16 flex-1 w-full">
      <NuxtLink to="/" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary transition-colors mb-8">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        Back to Home
      </NuxtLink>

      <h1 class="text-3xl font-bold text-white mb-6">Terms of Use</h1>
      <p class="text-slate-400 text-sm mb-8">Last updated: {{ new Date().getFullYear() }}</p>

      <div class="prose prose-invert max-w-none prose-slate">
        <p>
          Welcome to ClientBase. By accessing or using our platform, you agree to be bound
          by these Terms of Use. Please read them carefully before using our services.
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By creating an account or using any service provided by ClientBase, you agree to
          comply with these Terms. If you do not agree, you may not use our services.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          ClientBase provides tools for freelancers and agencies to manage clients, projects,
          invoices, and onboarding forms. Features may change over time, and we reserve the
          right to modify or discontinue any part of the service at our discretion.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials.
          You agree to provide accurate and complete information during registration and to
          update it as needed. You are liable for all activities that occur under your account.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>
          You agree not to misuse the platform. This includes, but is not limited to: uploading
          malicious code, violating any applicable laws, infringing on intellectual property
          rights, or attempting to disrupt the service for other users.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          All content you create and store on ClientBase remains your property. We claim no
          ownership over your client data, files, or project information. The platform itself,
          including its code, design, and branding, is owned by ClientBase and protected by
          copyright and intellectual property laws.
        </p>

        <h2>6. Limitation of Liability</h2>
        <p>
          ClientBase is provided "as is" without warranties of any kind, either express or
          implied. We shall not be liable for any damages arising from your use or inability
          to use the service, including but not limited to data loss, business interruption,
          or financial loss.
        </p>

        <h2>7. Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account at any time for violation
          of these Terms. You may also delete your account at any time through the platform
          settings. Upon termination, your data may be permanently deleted.
        </p>

        <h2>8. Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify users of significant
          changes via email or through the platform. Continued use after changes constitutes
          acceptance of the new Terms.
        </p>

        <h2>9. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the
          Federal Republic of Nigeria. Any disputes shall be resolved in the courts of
          Nigeria.
        </p>

        <h2>10. Contact</h2>
        <p>
          For questions about these Terms, please contact us at
          <a href="mailto:help@orderlyproblemsolvers.com" class="text-primary hover:text-primary/80">help@orderlyproblemsolvers.com</a>.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-base py-4 mt-auto">
      <div class="max-w-3xl mx-auto px-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>Powered by</span>
        <NuxtLink to="/" class="hover:opacity-80 transition-opacity inline-flex items-center gap-1">
          <img src="/img/clientbaselogo.png" alt="ClientBase" class="h-16 w-auto" />
        </NuxtLink>
        <span class="mx-1">·</span>
        <NuxtLink to="/terms" class="hover:text-slate-300 transition-colors">Terms</NuxtLink>
        <span>·</span>
        <NuxtLink to="/privacy" class="hover:text-slate-300 transition-colors">Privacy</NuxtLink>
      </div>
    </footer>
  </div>
</template>