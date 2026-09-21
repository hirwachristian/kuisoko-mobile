# KuISOKO Mobile

The native companion to [kuisoko.store](https://kuisoko.store) — built with Expo and React Native for customers, riders, and admins who'd rather run the store from their phone than a browser.

It shares a backend with the website (same API, same database), so an order placed in the app shows up instantly on the website's admin dashboard and vice versa. Three very different experiences live in one codebase depending on who's signed in: a shopper sees the storefront, a rider sees their delivery queue and a one-tap "share my location" toggle, and an admin gets a full dashboard with the same management tools as the web app.

## What it does

**For customers:**
- Browse products by category, with color/size variants and a swipeable image + video gallery
- Checkout as a guest or with an account — Cash on Delivery, MTN MoMo, or WhatsApp, with a required email code before any order goes through
- Join a group buy on a product to unlock a better price as more people join
- Chat directly with support, including photos and files
- Track a rider's live location once an order is out for delivery
- Push notifications for order updates, chat replies, and delivery status

**For riders:**
- A dedicated queue of assigned deliveries, separate from the customer experience
- One-tap live location sharing while a delivery is in progress
- Delivery history

**For admins:**
- A dashboard with revenue, order, and product stats — sparklines, trends, the works
- Full product/category/coupon management
- Order management with rider assignment and reassignment
- Inventory overview with stock-level filtering
- Returns and back-in-stock request handling
- The same notification bell as the website — orders, users, reviews, subscribers, and chat, all in one place

## How it's built

**Framework** — Expo (React Native) with TypeScript, React Navigation for routing (a stack per role: customer, rider, admin).

**Backend** — talks to the same Express/PostgreSQL API as [kuisoko](https://github.com/hirwachristian/kuisoko), no separate mobile backend to keep in sync.

**Native bits** — expo-location for rider tracking, expo-notifications for push, expo-image-picker for product photos and chat attachments, expo-video for the product gallery, and Leaflet running inside a WebView for the delivery map (same library the website uses, so both render identically).

**Error tracking** — Sentry, same as the website.

**Distribution** — EAS Build for native builds, EAS Update for shipping JS-only changes over the air without a full app store review.

## Running it locally

You'll need the [Expo CLI](https://docs.expo.dev/get-started/installation/) and a running instance of the [backend](https://github.com/hirwachristian/kuisoko) (or point it at the production API).

```bash
git clone https://github.com/hirwachristian/kuisoko-mobile.git
cd kuisoko-mobile
npm install
npm start
```

Scan the QR code with Expo Go, or press `i` / `a` in the terminal for an iOS Simulator / Android emulator. By default it points at the production API — set `EXPO_PUBLIC_API_URL` in a `.env` file to point at a local backend instead (use your machine's network address, not `localhost`, since the app runs on a device or simulator, not your machine).

## Deployment

- `eas build --profile production --platform all` for a new native build (needed whenever a native module changes — new permissions, new native dependencies).
- `eas update --channel production` for everything else — a JS-only change ships to everyone's app within seconds, no store review, no waiting.

## A note on the code

This mirrors the website closely on purpose — a lot of the business logic (variant selection, stock validation, checkout rules) is a deliberate port of the same logic in `kuisoko/frontend`, kept consistent so the two apps never disagree about something like whether a product is in stock. Comments across the codebase call out where something mirrors, or intentionally diverges from, the website's behavior.
