// Environment-aware API configuration.
// Expo automatically injects EXPO_PUBLIC_* vars at build time from .env / .env.production.
// For Android emulator, use 10.0.2.2 instead of localhost.
// For physical device, use your machine's local IP address.

const RAW_API_URL = process.env['EXPO_PUBLIC_API_URL'];

export const config = {
  apiUrl: RAW_API_URL ?? 'http://localhost:3000/api',
  env: process.env['EXPO_PUBLIC_ENV'] ?? 'development',
  isDev: (process.env['EXPO_PUBLIC_ENV'] ?? 'development') === 'development',
} as const;

export const ANDROID_EMULATOR_URL = 'http://10.0.2.2:3000/api';
export const IOS_SIMULATOR_URL = 'http://localhost:3000/api';
