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
  app: {
    head: {
      title: "Clientbase by OPS",
      meta: [
        {
          name: "description",
          content: "manage your project assets and dependencies. An asset management CRM",
        },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { charset: "utf-8" },
        { name: "author", content: "Orderly Problem Solvers" },
        { name: "application-name", content: "Clientbase" },
        {
          name: "apple-mobile-web-app-title",
          content: "Clientbase",
        },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "author", content: "Clientbase" },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  supabase: {
    redirect: false
  },
  runtimeConfig:{
    public: {
      CloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
      CloudinaryPreset: process.env.CLOUDINARY_PRESET
    }
  },
  nitro: {
    preset: 'netlify',
    compressPublicAssets: true,
    minify: true
  },
})