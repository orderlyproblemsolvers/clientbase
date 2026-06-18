<!-- pages/privacy.vue -->
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

      <h1 class="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
      <p class="text-slate-400 text-sm mb-8">Last updated: {{ new Date().getFullYear() }}</p>

      <div class="prose prose-invert max-w-none prose-slate">
        <p>
          Your privacy is important to us. This Privacy Policy explains how ClientBase
          collects, uses, and protects your personal information when you use our platform.
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          <strong>Account Information:</strong> When you sign up, we collect your email address,
          name, and any profile details you provide (role, organization, avatar).
        </p>
        <p>
          <strong>Usage Data:</strong> We automatically collect information about how you interact
          with the platform, including pages visited, features used, and time spent on the app.
          This helps us improve the service.
        </p>
        <p>
          <strong>Client Data:</strong> You may store information about your clients, projects,
          invoices, and files within the platform. We do not share this data with third parties.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use your personal information to provide and improve our services, communicate with
          you about your account, and ensure the security of the platform. We may also use
          aggregated, anonymized data for analytics.
        </p>

        <h2>3. Data Storage and Security</h2>
        <p>
          Your data is stored on secure servers provided by Supabase, our backend infrastructure
          partner. We implement industry‑standard security measures to protect your information
          from unauthorized access, alteration, or destruction.
        </p>

        <h2>4. Third‑Party Services</h2>
        <p>
          We use the following third‑party services that may process limited data on our behalf:
        </p>
        <ul>
          <li><strong>Supabase</strong> – database, authentication, and file storage</li>
          <li><strong>Cloudinary</strong> – image hosting for avatars and logos</li>
          <li><strong>Highlight.js</strong> – syntax highlighting in the library</li>
        </ul>
        <p>
          These services have their own privacy policies, and we encourage you to review them.
        </p>

        <h2>5. Cookies</h2>
        <p>
          ClientBase uses essential cookies for authentication and session management. We do not
          use tracking cookies or sell your data to advertising networks.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your account information and client data for as long as your account remains
          active. Upon account deletion, your data is permanently removed from our systems within
          30 days, except where we are required to retain it by law.
        </p>

        <h2>7. Your Rights</h2>
        <p>
          You have the right to access, update, or delete your personal information at any time
          through your account settings. You may also request a full export of your data by
          contacting us.
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. Significant changes will be communicated
          via email. Your continued use of the platform after changes indicates your acceptance.
        </p>

        <h2>9. Contact</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at
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