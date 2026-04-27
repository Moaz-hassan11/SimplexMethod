// ================================================================
// APP CONFIG — app.config.ts
// ================================================================
// This is the CENTRAL CONFIGURATION for the entire Angular app.
//
// 🔑 KEY CONCEPT: Dependency Injection (DI)
// ──────────────────────────────────────────
// Angular uses DI to provide services to components. Instead of
// each component creating its own HttpClient, we REGISTER it here
// once, and Angular gives it to any component/service that asks.
//
// In OLD Angular (pre-v15), you'd do this in app.module.ts:
//   imports: [HttpClientModule]
//
// In MODERN Angular (v15+), we use standalone functions:
//   providers: [provideHttpClient()]
//
// This is simpler and tree-shakable (unused code gets removed).
// ================================================================

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

// 👇 This is the function that registers HttpClient for the whole app.
//    Without this, any service trying to inject HttpClient will crash
//    with: "NullInjectorError: No provider for HttpClient!"
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Catches unhandled errors globally (comes with Angular 21)
    provideBrowserGlobalErrorListeners(),

    // Registers the Angular Router (for URL → Component mapping)
    provideRouter(routes),

    // 🌟 THIS IS THE KEY LINE 🌟
    // Registers HttpClient so our SimplexService can inject it.
    // HttpClient is what sends HTTP requests (GET, POST, etc.)
    // to our Flask backend and automatically handles JSON
    // serialization/deserialization.
    provideHttpClient(),
  ]
};
