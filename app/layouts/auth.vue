<template>
  <div class="min-h-screen h-screen flex overflow-hidden bg-base font-sans text-white">
    
    <!-- Left Hero Section -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-secondary">
      <img 
        src="/img/clientbasehero.png" 
        alt="Client Base Hero" 
        class="absolute inset-0 w-full h-full object-cover opacity-90"
      />
      
      <div class="absolute inset-0 bg-gradient-to-t from-base/90 via-base/20 to-transparent"></div>

      <div class="absolute bottom-12 left-12 right-12 max-w-md p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded bg-primary flex items-center justify-center font-bold text-white">C</div>
          <h2 class="text-xl font-bold tracking-tight">ClientBase</h2>
        </div>
        <p class="text-gray-300 text-sm leading-relaxed">
          Secure client management, automated retainers, and code libraries for the modern consultancy.
        </p>
      </div>
    </div>

    <!-- Right Content Section -->
    <div class="w-full lg:w-1/2 flex flex-col overflow-y-auto bg-base">
      
      <div class="flex-1 flex flex-col justify-center items-center px-8 py-12">
        
        <!-- Mobile Logo -->
        <div class="lg:hidden w-full max-w-sm mb-8 grid place-content-center">
          <img src="/img/clientbaselogo-white.png" alt="Client Base OPS" class="h-16 w-auto object-contain" />
        </div>

        <!-- Main Content -->
        <div class="w-full max-w-sm">
          <slot />
        </div>

        <!-- Footer -->
        <div class="w-full max-w-sm mt-12">
          <p class="text-xs text-gray-600 text-center">
            &copy; {{ new Date().getFullYear() }} Orderly Problem Solvers.
          </p>
        </div>
      </div>

    </div>

  </div>
</template>