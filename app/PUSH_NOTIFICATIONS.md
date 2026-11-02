# Push notifications

The app requests notification permission after sign-in on Android and iOS. It registers an Expo push token with the authenticated API account. The server sends notifications to the other party when an inquiry, message, or offer is created, or an inquiry or deal status changes. A notification opens the related conversation or deal.

## Before testing on a device

1. Configure Android FCM v1 and iOS APNs push credentials for the EAS project in `app.json`. Follow the [Expo credential setup](https://docs.expo.dev/push-notifications/push-notifications-setup/). The Firebase web keys in `eas.json` are not FCM push credentials.
2. Build and install a new development or release binary. Expo Go on Android does not support remote push notifications.
3. Deploy the updated server and run `npm run db:indexes:prod` from `server` to create the push device and receipt indexes.
4. Sign in on two physical devices with different accounts, allow notifications, and create an inquiry or offer. Test a reply and status change in both directions. Expo push tickets and receipts are checked by the server; delivery errors appear in server logs.

The registration endpoint is authenticated, and there is no public send endpoint. The app unregisters its token on sign-out; the server also removes tokens when Expo reports `DeviceNotRegistered`.
