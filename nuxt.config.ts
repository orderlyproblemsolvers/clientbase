// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,
  modules: [
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/hints',
    '@pinia/nuxt',
    '@nuxtjs/supabase'
  ],
  css: ['~/assets/css/main.css'],
  supabase: {
    redirect: false
  },
  nitro: {
    preset: 'netlify',
    compressPublicAssets: true,
    minify: true
  },
})