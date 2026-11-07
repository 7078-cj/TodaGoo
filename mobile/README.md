# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Building the app (EAS)

Prepared, not built yet. Builds run on [EAS Build](https://docs.expo.dev/build/introduction/).

### Where the settings come from

| Setting | Local (`npx expo start`) | EAS build (preview / production) |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`, `EXPO_PUBLIC_ORS_API_KEY` | `.env` | `.env.production`, overridden by the profile's EAS environment variables if set |
| app name / id / scheme | `app.config.js` (`APP_VARIANT`, default `development`) | `eas.json` sets `APP_VARIANT` per profile |

- **`.env.production`** holds the release values. It's git-ignored, and EAS uploads it anyway because `.easignore` (which EAS reads instead of `.gitignore`) leaves it in. Expo loads it when it bundles a release build. Your local `.env` is never uploaded.
- **`EXPO_PUBLIC_*` values are built into the app**, so anyone with the app can read them. Never put a secret there.
- **All the app's code reads them through `constants/config.js`**, which adds the trailing `/` the URLs need and takes the socket URL from the API host when `EXPO_PUBLIC_WS_URL` is empty.

### Build profiles (`eas.json`)

| Profile | App | Android package / iOS bundle id | Output |
| --- | --- | --- | --- |
| `development` | TodaGoo Dev | `com.todagoo.app.dev` | APK, iOS simulator |
| `preview` | TodaGoo Preview | `com.todagoo.app.preview` | APK for testers (internal) |
| `production` | TodaGoo | `com.todagoo.app` | AAB for Play Store, App Store build |

Each variant installs side by side on one phone. Build numbers are counted by EAS (`appVersionSource: remote`, `autoIncrement` on production); the version people see is `APP_VERSION` (default `app.json` `version`).

### Checks before a build

`app.config.js` refuses an EAS build (or `STRICT_CONFIG=true`) when:
- `EXPO_PUBLIC_API_URL` is missing or not http(s);
- production: the URLs aren't `https://` / `wss://`, or point at a LAN / localhost address;
- preview or production: the URLs are still the `…example…` placeholders from `.env.production`.

Locally it only warns. Plain `http://` (a LAN backend) is allowed only in development / preview builds (Android `usesCleartextTraffic` through `expo-build-properties`).

### Before the first build

1. **Put the real production server** in `mobile/.env.production` (`https://…/api/` and `wss://…/`).
2. **Choose the app id** for good: `APP_ID` (default `com.todagoo.app`). It can't change once the app is in a store.
3. **Install EAS CLI, log in and link the project:**

   ```bash
   npm install -g eas-cli
   ```

   ```bash
   eas login
   ```

   ```bash
   eas init
   ```

   `eas init` gives a project id; set it as `EAS_PROJECT_ID` (in each EAS environment, or in `.env.production`).
4. **Optional:** to give preview builds their own server (for example a LAN backend), set its URLs in the preview EAS environment. They take priority over `.env.production`:

   ```bash
   eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value http://192.168.1.10:8000/api/ --visibility plaintext
   ```

5. **Check what EAS will upload** (`.env.production` must be listed, `.env` must not):

   ```bash
   npx eas-cli build:inspect --platform android --stage archive --output ./archive-check --profile production
   ```

### Build (when ready)

```bash
eas build --profile preview --platform android
```

```bash
eas build --profile production --platform all
```

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
