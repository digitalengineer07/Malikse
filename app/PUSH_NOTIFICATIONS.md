# Notifications

MalikSe delivers messages over its authenticated API. Android device alerts use Expo Push Service and Firebase Cloud Messaging. Alerts contain generic copy and open the relevant screen. The in-app bell continues to use MalikSe, including when the OS blocks device alerts. Bulk listing announcements stay in the bell.

## Before rollout

1. In Firebase, register Android package `com.devoxa.malikse`. Supply its Android configuration file to the app build as `GOOGLE_SERVICES_JSON` (a file path). Keep the FCM service account private and upload it to the same Expo project as an FCM v1 credential.
2. Deploy the backend to Bluehost and verify the production indexes with the repository's database index workflow. Configure `EXPO_PUSH_ACCESS_TOKEN` on Bluehost if Expo push security is enabled. Set `DEVICE_ALERTS_ENABLED=true` only after the credential and staging checks pass.
3. Build and install a native Android APK. Expo Go continues to support the in-app bell. It cannot verify remote Android alerts.
4. On two signed-in phones, allow notifications. Send a message in both directions with the receiving app foregrounded, backgrounded, and closed. Confirm a tap opens the right conversation. Check enquiry, offer, and listing workflow alerts, denied permission, sign-out, and temporary network loss.
5. Check the server logs for provider failures. Expo receipts confirm delivery to the platform provider. They do not confirm a user saw the alert.

To turn off outbound delivery during rollout, unset `DEVICE_ALERTS_ENABLED` and restart the backend. Chat and in-app notifications continue to work.
