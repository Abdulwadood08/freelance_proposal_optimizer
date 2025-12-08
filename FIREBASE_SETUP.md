# Firebase Setup Guide - Step by Step

This guide will walk you through setting up Firebase for your Freelance Proposal Optimizer backend.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `freelance-proposal-optimizer` (or your preferred name)
4. Click **"Continue"**
5. **Optional**: Disable Google Analytics if you don't need it, or enable it
6. Click **"Create project"**
7. Wait for project creation (takes ~30 seconds)
8. Click **"Continue"** when ready

## Step 2: Enable Firestore Database

1. In your Firebase project dashboard, click on **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll set up security rules later if needed)
4. Click **"Next"**
5. Select a **Cloud Firestore location** (choose the closest to your users, e.g., `us-central1`)
6. Click **"Enable"**
7. Wait for Firestore to initialize (~30 seconds)

## Step 3: Create Service Account

1. In Firebase Console, click the **gear icon (⚙️)** next to "Project Overview" in the left sidebar
2. Click **"Project settings"**
3. Go to the **"Service accounts"** tab
4. Make sure **"Firebase Admin SDK"** is selected (not "Node.js" or "Python" - we'll use the JSON directly)
5. Click **"Generate new private key"**
6. A dialog will appear - click **"Generate key"**
7. A JSON file will be downloaded to your computer (e.g., `freelance-proposal-optimizer-xxxxx-firebase-adminsdk-xxxxx.json`)

**⚠️ IMPORTANT**: Keep this file secure! It contains sensitive credentials.

## Step 4: Save Service Account File

1. Move the downloaded JSON file to your project directory:
   ```bash
   # Example: Move to project root
   mv ~/Downloads/freelance-proposal-optimizer-*.json /Users/apple/Desktop/freelance_proposal_optimizer/firebase-service-account.json
   ```

2. **Optional but recommended**: Add the file to `.gitignore` to prevent committing it to version control:
   ```bash
   echo "firebase-service-account.json" >> .gitignore
   ```

## Step 5: Set Environment Variable

### For macOS/Linux (current session):
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/Users/apple/Desktop/freelance_proposal_optimizer/firebase-service-account.json"
```

### To make it permanent (add to ~/.zshrc or ~/.bash_profile):
```bash
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/Users/apple/Desktop/freelance_proposal_optimizer/firebase-service-account.json"' >> ~/.zshrc
source ~/.zshrc
```

## Step 6: Verify Setup

After completing the steps above, we'll test the connection!

