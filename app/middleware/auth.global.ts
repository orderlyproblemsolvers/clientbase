export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser()

  const publicRoutes   = ['/login', '/signup', '/welcome', '/confirm']
  const isInvoicePrint = to.path.startsWith('/invoices/')
  const isClientBrief  = to.path.startsWith('/brief/')  
  const isProjectView  = to.path.startsWith('/view/')

  if (isInvoicePrint || isClientBrief || isProjectView) return

  if (!user.value) {
    if (!publicRoutes.includes(to.path)) return navigateTo('/welcome')
  } else if (publicRoutes.includes(to.path)) {
    return navigateTo('/')
  }
})