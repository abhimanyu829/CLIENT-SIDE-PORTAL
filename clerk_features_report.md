# Clerk Authentication Features Report

This report outlines the Clerk authentication features implemented in the Next.js project based on an analysis of the codebase.

## Feature Status Overview

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Email verification** | **Found** | Implemented using Clerk's `useSignUp` hook with the `email_code` strategy. |
| **Password change** | **Found** | Implemented using Clerk's `useSignIn` hook with the `reset_password_email_code` strategy. |
| **Mobile number verification** | **Not Found** | The application does not use Clerk for phone verification. It implements a custom OTP solution. |
| **SMS** | **Not Found** | The application uses a custom Twilio/MSG91 integration for SMS, not Clerk's built-in SMS services. |

---

## Detailed Findings

### 1. Email Verification
- **Status:** Found
- **Location:** `app/(auth)/register/page.tsx`
- **Implementation Details:** 
  The registration flow uses Clerk's `useSignUp` hook. When a user creates an account, it explicitly triggers email verification using `signUp.prepareEmailAddressVerification({ strategy: "email_code" })`. Once the user receives the code, the application verifies it by calling `signUp.attemptEmailAddressVerification({ code })`.

### 2. Password Change / Reset
- **Status:** Found
- **Location:** `app/(auth)/forgot-password/page.tsx`
- **Implementation Details:** 
  The forgot password flow uses Clerk's `useSignIn` hook. It initiates a password reset with `signIn.create({ strategy: "reset_password_email_code", identifier: data.email })`. After receiving the code, it completes the flow using `signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password: data.newPassword })`.

### 3. Mobile Number Verification
- **Status:** Not Found (Via Clerk)
- **Location:** `app/api/auth/otp/send/route.ts` & `app/api/auth/otp/verify/route.ts`
- **Implementation Details:** 
  Clerk's native `preparePhoneNumberVerification` and phone verification hooks are completely absent from the codebase. Instead, the developers have built a custom API route for OTP verification that manually generates a code, stores it, and marks a `phoneVerified` timestamp in the database.

### 4. SMS
- **Status:** Not Found (Via Clerk)
- **Location:** `lib/twilio.ts`, `app/api/auth/otp/send/route.ts`
- **Implementation Details:** 
  Clerk's SMS features are not used. SMS delivery is handled by a custom integration using Twilio (`sendSms` function in `lib/twilio.ts`), which is invoked by the custom OTP API route.

### 5. Other Related Services
- **OAuth Providers:** Implemented via Clerk. `app/(auth)/register/page.tsx` uses `clerk.client.signUp.authenticateWithRedirect` for Google (`oauth_google`) and GitHub (`oauth_github`) Single Sign-On (SSO).
- **Webhooks:** Implemented. `app/api/webhooks/clerk/route.ts` is configured to listen to `user.created`, `user.updated`, and `user.deleted` webhooks via Svix. This syncs Clerk user states to the internal Prisma database.
- **Client Providers:** Implemented. The app is wrapped in the `<ClerkProvider>` at the root `app/layout.tsx`.
