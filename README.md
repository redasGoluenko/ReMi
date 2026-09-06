# Remi

## Push notifications

The web push flow needs one public VAPID key in the frontend and the matching private key in Supabase:

1. Generate a VAPID key pair with `npx web-push generate-vapid-keys`.
2. Set `VITE_WEB_PUSH_PUBLIC_KEY` alongside the existing Vite environment variables.
3. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Supabase Edge Function secrets.
4. Run `supabase/dates_rls.sql` in the Supabase SQL editor.
5. Deploy `supabase/functions/send-notification` with `supabase functions deploy send-notification`.

On iPhone, open the deployed site in Safari, add it to the Home Screen, open it from there, choose a painting name, and enable notifications. On Android, open it in Chrome, choose a painting name, and enable notifications.

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
