# Firebase Frontend Setup Guide

## Overview
The frontend uses Firebase Client SDK for user authentication. Users authenticate with Firebase, then the backend verifies the Firebase token and issues a JWT.

## Setup Steps

### 1. Get Firebase Web App Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **General** tab
4. Scroll down to **Your apps** section
5. Click the **Web** icon (`</>`) to add a web app (if not already added)
6. Register your app with a nickname (e.g., "Funtalk Web")
7. Copy the Firebase configuration object

### 2. Configure Environment Variables

Create or update `frontend/.env` file:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

**Important:** 
- All Firebase config values must start with `VITE_` to be accessible in Vite
- Replace the placeholder values with your actual Firebase config

### 3. Enable Firebase Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider
3. (Optional) Enable other providers like Google, GitHub, etc.

### 4. Install Dependencies

```bash
cd frontend
npm install
```

Firebase SDK is already added to `package.json`.

## How It Works

### Login Flow:
1. User enters email/password in frontend
2. Frontend authenticates with Firebase using `signInWithEmailAndPassword()`
3. Firebase returns user credentials
4. Frontend gets Firebase ID token using `getIdToken()`
5. Frontend sends Firebase token to backend `/api/auth/login`
6. Backend verifies Firebase token using Firebase Admin SDK
7. Backend returns JWT token
8. Frontend stores JWT token and redirects to dashboard

### Signup Flow:
1. User fills signup form
2. Frontend sends data to backend `/api/auth/register`
3. Backend creates user in Firebase (using Admin SDK)
4. Backend saves user to database
5. Backend returns JWT token
6. Frontend stores JWT token and redirects

## Testing

1. **Start the frontend:**
```bash
cd frontend
npm run dev
```

2. **Test login:**
   - Go to `/login`
   - Enter email/password of a user created via signup
   - Should authenticate and redirect to dashboard

3. **Test signup:**
   - Go to `/signup`
   - Create a new account
   - Should create Firebase user and redirect

## Troubleshooting

### Error: "Firebase: Error (auth/configuration-not-found)"
- Check that all `VITE_FIREBASE_*` environment variables are set
- Restart the dev server after changing `.env` file
- Verify the values match your Firebase project settings

### Error: "Firebase: Error (auth/invalid-api-key)"
- Verify `VITE_FIREBASE_API_KEY` is correct
- Check that the API key is enabled in Firebase Console

### Error: "Firebase: Error (auth/operation-not-allowed)"
- Enable Email/Password authentication in Firebase Console
- Go to Authentication → Sign-in method → Email/Password → Enable

### Error: "Firebase: Error (auth/user-not-found)"
- User doesn't exist in Firebase
- Make sure user was created via signup first

## Security Notes

- Firebase API keys are safe to expose in frontend code (they're public)
- The real security comes from Firebase Security Rules
- Firebase tokens are verified on the backend before issuing JWT
- Never commit `.env` file with real credentials to git

