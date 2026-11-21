import { defineConfig } from '@neon/config/v1';
import { API_FUNCTION_SLUG } from './lib/function-slugs.ts';

export default defineConfig({
  functions: {
    [API_FUNCTION_SLUG]: {
      name: 'Activity search API',
      source: './functions/api.ts',
      env: {
        ACTIVITIES_DATABASE_URL: {
          value: process.env.ACTIVITIES_DATABASE_URL,
          required: true,
        },
        GARMIN_KEY_ENCRYPTION_SECRET: {
          value: process.env.GARMIN_KEY_ENCRYPTION_SECRET,
          required: true,
        },
        SETUP_INVITE_CODE: {
          value: process.env.SETUP_INVITE_CODE,
          required: false,
        },
      },
    },
  },
  triggers: {
    'daily-sync': {
      type: 'schedule',
      function: API_FUNCTION_SLUG,
      cron: '0 0 * * *',
      functionPath: '/sync',
      enabled: true,
    },
  },
});
