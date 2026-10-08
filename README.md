# Serenity Spa — SPA Booking System

A production-grade spa appointment booking system built with HTML + CSS + Vanilla JS (ES Modules) + Firebase (Firestore, Auth, Storage).

## Features

- **Public Landing Page** — showcases branches and services
- **Customer Booking Portal** — 5-step booking wizard with date/time selection
- **Staff Dashboard** — role-gated, branch-scoped views
- **Management Console** — full CRUD for branches, services, staff, availability
- **Super Admin Panel** — full system control
- **Slot Generation Engine** — intelligent time-slot algorithm respecting availability, holidays, and overbooking
- **Calendar Views** — week and month views with appointment blocks
- **Overbooking System** — configurable per branch
- **Landing Page Editor** — edit hero, about, and service visibility from dashboard

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project (or use existing)
2. Enable **Authentication** → **Sign-in method** → Enable **Email/Password**
3. Enable **Cloud Firestore** → Create database (choose a location, start in **test mode** initially, then apply the rules file)
4. Enable **Storage** (for service images — optional)
5. Register a **Web app** in Project Settings → General → Your apps → Add app
6. Copy the `firebaseConfig` object

### 2. Configure the Project

Open `js/firebase.js` and replace the placeholder config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Deploy Security Rules & Indexes

Install the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore  # select your project
```

Copy the rules and indexes:

```bash
cp firebase/firestore.rules firestore.rules
cp firebase/firestore.indexes.json firestore.indexes.json
```

Deploy:

```bash
firebase deploy --only firestore
```

### 4. Set Up Initial Data

**Create a superAdmin user:**

1. Go to Firebase Console → **Authentication** → **Users**
2. Click **Add user** — enter email and password
3. Copy the auto-generated **UID**

**Create the user document in Firestore:**

In the Firestore Console, create a document at `users/{UID}`:

| Field | Value |
|---|---|
| `uid` | The UID you copied |
| `email` | admin@serenityspa.com |
| `name` | Admin |
| `role` | `"superadmin"` |
| `createdAt` | `Timestamp.now()` (use server timestamp) |

### 5. Run the App Locally

Since this is a vanilla JS app (no build step), you need a local server:

```bash
# Using Python:
python3 -m http.server 8080

# Using Node:
npx serve .

# Using VS Code Live Server extension
```

Open **http://localhost:8080** in your browser.

### 6. Bootstrap the System

1. **Sign in** with your superAdmin account at `/login.html`
2. **Create a branch** from the admin dashboard → Branches tab
3. **Create services** — add name, duration, category, and set pricing per branch
4. **Add staff** — assign them to a branch and map them to services
5. **Set availability** — configure branch hours and staff working hours
6. **Toggle overbooking** in branch config if desired
7. **Visit the landing page** — services and branches appear automatically
8. **Open `/book.html`** in an incognito window to test the customer booking flow

### 7. Deploy to Production

```bash
firebase init hosting
# Point "public" directory to "."
# Configure as single-page app: NO
firebase deploy --only hosting
```

## Project Structure

```
/
├── index.html               # Landing page (public)
├── book.html                # Customer booking flow
├── login.html               # Auth page
├── dashboard.html           # Dashboard shell
│
├── js/
│   ├── firebase.js          # Firebase init + exports
│   ├── auth.js              # Auth state, role detection, guards
│   ├── router.js            # Hash-based SPA router
│   ├── utils.js             # Date/time utilities
│   ├── validators.js        # Input validation
│   ├── cache.js             # SessionStorage cache layer
│   ├── slots.js             # Slot generation algorithm
│   ├── calendar.js          # Calendar rendering engine
│   ├── components.js        # Reusable UI components
│   │
│   ├── db/                  # Data access layer
│   │   ├── branches.js
│   │   ├── services.js
│   │   ├── staff.js
│   │   ├── appointments.js
│   │   ├── holidays.js
│   │   └── landingPage.js
│   │
│   └── views/               # View controllers
│       ├── landing.js
│       ├── booking.js
│       ├── login.js
│       ├── admin/           # Admin dashboard views
│       └── user/            # User views
│
├── css/
│   ├── tokens.css           # Design tokens
│   ├── base.css              # Reset + typography
│   ├── components.css       # Reusable components
│   ├── landing.css
│   ├── booking.css
│   └── dashboard.css
│
└── firebase/
    ├── firestore.rules
    └── firestore.indexes.json
```

## Role Hierarchy

```
SuperAdmin
  └── Admin (manages all branches)
        └── Manager (scoped to one branch)
              ├── Staff (own schedule)
              ├── Reception (branch appointments)
              └── User (own appointments)
```

## Key Guardrails

- **Never expose another branch's data** to a lower-privileged user — enforced at Firestore rules level
- **Never allow double-booking** unless overbooking is explicitly enabled
- **Never let a cancelled appointment block a slot** — slot generation ignores cancelled appointments
- **All destructive actions** require two-step confirmation modal
- **Prices and availability** always read from Firestore, never hardcoded
- **All Firestore reads** use `.withConverter()` typed converters
- **Rate-limit all write operations** with 500ms debounce
- **Paginate all list queries** — 20 per page with cursor-based pagination
- **Cache branch config** in sessionStorage, invalidate on write

## Design System

- **Palette:** Warm stone with gold accents and sage green
- **Typography:** Playfair Display (headings) + Inter (body)
- **Status colors:** Pending (amber), Confirmed (green), Cancelled (red), Completed (indigo), No Show (gray)
- **CSS Custom Properties** for all colors, spacing, radii, shadows, and transitions
