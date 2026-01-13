# Firebase Security Rules

It appears you are encountering "Permission Denied" errors. This is because your Firebase Realtime Database Security Rules are likely set to default (locked) or are too restrictive.

To fix this and allow valid authenticated users (Citizens and Admins) to access the system, please update your rules in the Firebase Console.

## Steps to Fix

1. Go to the **[Firebase Console](https://console.firebase.google.com/)**.
2. Select your project **SYNC Nagar Alert**.
3. In the left sidebar, click **Build** -> **Realtime Database**.
4. Click on the **Rules** tab.
5. Replace the current rules with the following JSON:

```json
{
  "rules": {
    "users": {
      "$uid": {
        // Users can read/write their own profile
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      },
      "admins": {
        // Authenticated users can read the admins list (needed for role checks)
        ".read": "auth != null", 
        ".write": false // Only updated manually via console or backend
      },
      "registry": {
          ".read": "auth != null",
          ".write": "auth != null"
      }
    },
    "reports": {
      // Allow authenticated users to read and write reports
      ".read": "auth != null",
      ".write": "auth != null",
      "by_department": {
        ".read": "auth != null", // Admins read from here
        ".write": "auth != null"
      }
    },
    "broadcasts": {
        ".read": "auth != null",
        ".write": "auth != null"
    }
  }
}
```

6. Click **Publish**.

This will resolve the `Permission Denied` errors in your console log and allow the dashboard's Realtime Listener to work correctly alongside our API fallback.
