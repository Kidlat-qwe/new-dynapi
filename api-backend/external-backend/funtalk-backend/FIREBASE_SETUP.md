# Firebase Admin SDK Setup Guide

## Overview
Firebase Admin SDK is used on the backend to manage Firebase Authentication. The frontend does NOT need Firebase setup.

## Setup Methods

### Method 1: Using Service Account JSON File (Recommended for Development)

1. **Get Firebase Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Download the JSON file

2. **Place the JSON file:**
   - Save it as `backend/firebase-service-account.json`
   - **IMPORTANT:** Add it to `.gitignore` (already included)

3. **Update `backend/config/firebase.js`** to use the JSON file (see below)

### Method 2: Using Environment Variables (Recommended for Production)

1. **Get Firebase Service Account Credentials:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Open the downloaded JSON file

2. **Extract the values:**
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

3. **Update `backend/.env`:**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Important Notes:**
- The `FIREBASE_PRIVATE_KEY` must be in quotes and include `\n` for newlines
- Or use actual newlines in the .env file (some systems support this)

## Testing the Setup

1. **Start your backend server:**
```bash
cd backend
npm install  # Make sure firebase-admin is installed
npm run dev
```

2. **Check the console output:**
   - ✅ `Firebase Admin SDK initialized successfully` = Working!
   - ⚠️ `Firebase credentials not found` = Need to configure
   - ❌ `Firebase Admin SDK initialization error` = Check credentials

3. **Test with a signup request:**
   - Try creating a new user via the signup endpoint
   - Check if Firebase user is created successfully

## Troubleshooting

### Error: "Firebase Admin SDK is not initialized"
- Check if all three environment variables are set
- Verify the private key format (must include `\n` for newlines)
- Check console for initialization errors

### Error: "Invalid credentials"
- Verify the service account key is correct
- Make sure the private key includes the full key with BEGIN/END markers
- Check that client_email matches the service account email

### Error: "Permission denied"
- Ensure the service account has proper permissions
- Check Firebase Authentication is enabled in Firebase Console

## Security Notes

- **NEVER commit** `firebase-service-account.json` to git
- **NEVER commit** `.env` file with real credentials
- Use environment variables in production
- Rotate service account keys regularly

