# Firebase Setup Instructions

To complete the deployment of your application to Google Cloud, you need to set up a Firebase project.

## 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"** or **"Create a project"**.
3. Name your project (e.g., `my-dsng-app`) and follow the setup steps.

## 2. Enable Authentication
1. In your new project, go to **Build > Authentication** in the left sidebar.
2. Click **"Get started"**.
3. Select **"Email/Password"** from the Sign-in method list.
4. Enable **"Email/Password"** and click **"Save"**.

## 3. Enable Cloud Firestore
1. Go to **Build > Firestore Database**.
2. Click **"Create database"**.
3. Choose a location (e.g., `nam5 (us-central)`).
4. Start in **Test mode** (for now, to allow easy development) or **Production mode** (you will need to set up rules later).
   - *Recommendation: Start in Test mode for initial testing.*

## 4. Get Configuration Keys
1. Go to **Project settings** (gear icon next to "Project Overview").
2. Scroll down to **"Your apps"**.
3. Click the **Web** icon (`</>`) to create a web app.
4. Register the app (e.g., `DesignSync Web`).
5. You will see a `firebaseConfig` object. You need the values from this object.

## 5. Configure Your App
Create a `.env` file in the root of your project (`/Users/sylvain/Dev/DSNG/my-dsng-app/.env`) with the following content, replacing the placeholders with your actual values:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 6. Deploy (Optional)
To deploy your app to the web:
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init`
   - Select **Hosting**.
   - Use your existing project.
   - Public directory: `dist`
   - Configure as single-page app: **Yes**
   - Overwrite index.html: **No** (if asked)
4. Build: `npm run build`
5. Deploy: `firebase deploy`
