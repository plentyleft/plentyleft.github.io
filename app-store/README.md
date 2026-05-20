# App Store screenshots (iPhone)

Apple guideline **2.3.3** requires screenshots that show the **real app UI** at the correct device sizes—not marketing mockups, placeholders, or wrong dimensions.

## Required sizes (upload in App Store Connect)

| Display | Simulator device | Portrait size |
|---------|------------------|---------------|
| **6.7"** (required) | iPhone 15 Pro Max or 16 Pro Max | **1290 × 2796** |
| **6.5"** (if asked) | iPhone 11 Pro Max | **1242 × 2688** |

The iOS Simulator saves at the correct resolution automatically. Use **portrait** only (PlentyLeft is portrait-locked).

## Screens to capture (5–6 total)

Sign up two **dev** test accounts (Sign up tab) or reuse accounts you keep for demos.

| # | File name | How to get there |
|---|-----------|------------------|
| 1 | `01-login.png` | **Account** → **Sign out → capture login screen** (dev) or sign out manually |
| 1b | `01b-onboarding.png` | **Account** → **Preview corporation / nonprofit screen** (dev) |
| 2 | `02-corp-post-listing.png` | Corp account → **Post Listing** → tap **Fill sample data** (dev) |
| 3 | `03-corp-my-listings.png` | Submit a listing → **My Listings** (shows open card) |
| 4 | `04-nonprofit-matches.png` | Nonprofit account → home with a match (see seed SQL below if empty) |
| 5 | `05-corp-claimed.png` | Corp → **Claimed** tab (after a nonprofit claims) |
| 6 | `06-account.png` | Either role → **Account** (optional; shows sign out + delete) |

Save files under `app-store/screenshots/6.7-inch/`.

## Capture steps

1. **Start Expo** (Terminal):
   ```bash
   cd /Users/outsideoffline/plentyleft/mobile
   npx expo start
   ```

2. **Open the right simulator** (must be 6.7" for primary set):
   ```bash
   ./scripts/open-screenshot-simulator.sh
   ```
   Or in the Expo terminal press **`i`** after the script opens the simulator.

3. **Navigate** to each screen in the table above.

4. **Save screenshot** (either method):
   - Simulator menu: **File → Save Screen** (⌘S)
   - Or run:
     ```bash
     ./scripts/capture-ios-screenshot.sh 01-login
     ```
     (Run once per screen; pass the file base name.)

5. **Upload** in [App Store Connect](https://appstoreconnect.apple.com) → your app → **App Store** tab → **Screenshots** → iPhone 6.7".

## Nonprofit match seed (if home is empty)

After creating dev accounts named **Screenshot Corp** and **Screenshot Nonprofit**, run `supabase/seed_screenshot_match.sql` in the Supabase SQL editor (edit org names in the file if needed).

## Checklist before submit

- [ ] Screenshots are **PNG**, portrait, from **6.7"** simulator (1290×2796)
- [ ] UI matches the current build (Plenty/Left branding, green/amber)
- [ ] No placeholder “lorem” or blank primary screens
- [ ] Login screen included OR first screenshot shows core logged-in value
- [ ] Same build you submit to review is what you photographed
