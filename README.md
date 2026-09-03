# MRI Safety QuickCheck

MRI Safety QuickCheck is an Expo/React Native app backed by Supabase for conservative MRI safety decision support.

## Safety model

Manufacturer MRI labeling is the primary authority. The app is designed so that unknown, unverified, incomplete, or conflicting configurations are not treated as safe. A QuickCheck requires the exact implant/device, exact implanted components, scanner model, field strength, scan region, and applicable manufacturer conditions to be matched.

This app is decision support and does not replace current manufacturer labeling, IFU, facility policy, or qualified clinical review.

## Local setup

1. Install Node.js 20+ and npm.
2. Copy `.env.example` to `.env.local`.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the intended Supabase project.
4. Install dependencies with `npm install`.
5. Run `npm run typecheck` and `npm run doctor`.
6. Start with `npm start`.

Do not put a Supabase service-role key in the app or repository.

## EAS builds

The repository includes `eas.json` with:

- `preview`: internal distribution; Android produces an installable APK for device testing.
- `production`: store-oriented production build with automatic version/build incrementing.
- `production` submit profile for later EAS Submit configuration.

After authenticating the Expo account and linking the project, use:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
eas build --profile production --platform android
eas build --profile production --platform ios
```

The first EAS project initialization and signing-credential setup require the Expo account owner to authenticate. Do not commit signing credentials.

## EAS environment variables

Set the two public Supabase variables in the EAS environment used by the build. The values are bundled into the client app, so security must come from Supabase Row Level Security and least-privilege public access—not from treating the publishable key as a secret.

## CI

GitHub Actions runs TypeScript and Expo Doctor checks on pushes and pull requests to `main`.
