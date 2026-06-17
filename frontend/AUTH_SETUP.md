# Authentication Setup Guide

This guide will walk you through setting up Firebase Authentication for the frontend.

## Step 1: Enable Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create one if you haven't)
3. Click on **"Authentication"** in the left sidebar
4. Click **"Get started"** (if you haven't enabled it yet)
5. Go to the **"Sign-in method"** tab
6. Click on **"Email/Password"**
7. Enable the **"Email/Password"** provider (toggle it on)
8. Click **"Save"**

## Step 2: Get Firebase Configuration

1. In Firebase Console, click the **gear icon (⚙️)** next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. If you don't have a web app yet:
   - Click the **"</>"** (web) icon
   - Register your app with a nickname (e.g., "Freelance Proposal Optimizer")
   - Click **"Register app"**
5. Copy the Firebase configuration object (it looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 3: Create Environment File

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and fill in your Firebase configuration values:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

## Step 4: Restart Development Server

After creating/updating `.env.local`, restart your Next.js dev server:

```bash
npm run dev
```

## Step 5: Test Authentication

1. Navigate to `http://localhost:3000`
2. Click **"Sign Up"** in the navigation
3. Create a test account with email and password
4. You should be redirected to the Profile page
5. Try logging out and logging back in

## Features Implemented

✅ Email/Password authentication  
✅ User signup and login  
✅ Protected routes (Profile and Generate Proposal)  
✅ Auto-load user profile on login  
✅ Auth tokens sent to backend API  
✅ Logout functionality  
✅ Navigation shows auth state  

## Backend Integration

The frontend now sends Firebase auth tokens to the backend in the `Authorization` header:
```
Authorization: Bearer <firebase-id-token>
```

Make sure your backend is configured to verify these tokens. See the backend documentation for details.

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure `.env.local` exists and has all required Firebase config values
- Restart your dev server after creating/updating `.env.local`

### "Firebase: Error (auth/operation-not-allowed)"
- Make sure Email/Password authentication is enabled in Firebase Console
- Go to Authentication > Sign-in method > Email/Password and enable it

### Authentication not working
- Check browser console for errors
- Verify all environment variables are set correctly
- Make sure you're using `NEXT_PUBLIC_` prefix for client-side variables


