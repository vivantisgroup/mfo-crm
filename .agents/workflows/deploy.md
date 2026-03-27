---
description: Deploy the MFO-CRM platform (Firebase rules + local + cloud)
---

// turbo-all

## Standard Deployment

Always run these three steps in order every time you deploy.

### Step 1 — Deploy Firebase Security Rules

```
firebase deploy --only firestore:rules
```

Run from: `c:\MFO-CRM`

This ensures Firestore security rules are always up to date in production before the app is deployed.

### Step 2 — Verify local dev server

The local dev server should already be running. If not, start it:

```
npm run dev --workspace=apps/web
```

Run from: `c:\MFO-CRM`

Local is accessible at: `http://localhost:3000`

### Step 3 — Deploy to Vercel (cloud / production)

```
vercel --prod
```

Run from: `c:\MFO-CRM`

When prompted `? Please select a Project:`, select `mfo-crm` and press Enter.

Production URL: **https://mfo-crm-web.vercel.app**
