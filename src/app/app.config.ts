import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { timelineInterceptor } from './timeline';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Angular 22's default backend is fetch, which can't report upload progress.
    provideHttpClient(withXhr(), withInterceptors([timelineInterceptor])),
  ],
};
