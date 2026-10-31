# Android download size

The previous universal APK was 115,705,888 bytes. About 84 MiB was native
libraries for four CPU architectures. Shipping only the device's architecture
preserves application features. Download size is different from installed size.

Verified local ARM64 release: **21.92 MB (20.90 MiB)**, built successfully with
Java 17. The APK contains only `arm64-v8a` native libraries and passes the
50,000,000-byte size check. Other architecture profiles and Play delivery sizes
have not been measured. No connected device was available for runtime testing.

Build profiles:

- `eas build --platform android --profile preview`: ARM64 APK for modern phones.
- `eas build --platform android --profile preview-arm32`: older 32-bit ARM phones.
- `eas build --platform android --profile preview-emulator`: x86_64 emulators.
- `eas build --platform android --profile production`: App Bundle for Google Play;
  Play delivers the architecture and resources appropriate to each device.

The Expo config plugin enables release code/resource shrinking, JS bundle
compression and compressed native libraries. No screens or features are removed.
Existing network content still loads from the API. This does not introduce a
post-install native component downloader or require downloading code before login.

For an existing local Android project, regenerate configuration with
`npx expo prebuild --platform android --no-install`, then run from `android/`:

```powershell
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Set `JAVA_HOME` to a compatible JDK 17 installation before running Gradle.
On this machine Java 27 in `JAVA_HOME` caused Android JDK image conversion to fail,
despite Java 17 being first on `PATH`.

From `app/`, check the produced APK with `node scripts/check-apk-size.cjs`.
An AAB's upload size is not its per-device download size. Before publishing,
test a signed release on supported devices, including login/OTP, maps, uploads,
and chat. Local builds currently use the existing development signing setup;
use the configured EAS production credentials for distribution.
