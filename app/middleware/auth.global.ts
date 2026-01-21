// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useSupabaseUser()

  // 1. List of public pages that don't require login
  const publicRoutes = ['/login', '/signup']

  // 2. Check if the user is NOT logged in
  if (!user.value) {
    // If they are trying to go somewhere other than a public page, redirect to login
    if (!publicRoutes.includes(to.path)) {
      return navigateTo('/login')
    }
  } 
  
  // 3. (Optional) Reverse Check: 
  // If the user IS logged in but tries to go to Login or Signup, 
  // redirect them to the Dashboard (so they don't see the login form again)
  else if (publicRoutes.includes(to.path)) {
    return navigateTo('/')
  }
})