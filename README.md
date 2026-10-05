# AdduGenet EShop - Mobile E-Commerce Application

A full-featured React Native e-commerce mobile application built with Expo, featuring secure payments, order management, and admin capabilities.

## 📱 Features

### Customer Features
- **Product Browsing**: Browse products by category with search and advanced dropdown filters
- **Shopping Cart**: Add, remove, and manage cart items
- **Live Stock Visibility**: Product cards and product detail screens show current inventory left
- **Secure Checkout**: Multi-step checkout with address and payment
- **Multiple Payment Options**: 
  - Credit/Debit cards via Stripe
  - Telebirr mobile money
- **USA Development Cash Checkout**: Cash on delivery is selectable for the USA
  database only when React Native `__DEV__` is true (development/debug bundles).
  It is hidden and blocked at order confirmation in release bundles, including
  preview and production builds. Ethiopia cash checkout remains unchanged.
  This is a mobile build gate, not a backend authorization policy. Development
  cash checkout creates real orders in the selected database; use test products.
- **Checkout Stock Guard**: Prevents checkout/payment when requested quantity exceeds available stock
- **User Accounts**: Registration, login, email verification
- **Order Tracking**: View order history and status
- **Notification Inbox**: Received and opened notifications share one entry per
  identifier. Saved duplicates are removed on startup, read status is preserved,
  and the inbox retains the latest 20 unique entries.
- **Profile Management**: Edit profile and manage addresses
- **Password Recovery**: Forgot password functionality

### Admin Features
- **Product Management**: Add, edit, delete products
- **Category Management**: Manage product categories
- **Order Management**: View all orders, update status, delete orders
- **Company Store Analytics**: AdminStore shows assigned orders and orders containing
  owned or marked-ready products; sales count completed orders only. Analytics
  refresh after marking a product ready, and load failures display a retry message.
- **Company Store Order Details**: Tap an order in AdminStore's assigned and
  fulfilled orders list to view its products, quantities, current catalog prices,
  order/delivery status, schedule, and totals. Assigned orders include all items;
  mixed-store fulfillments include only store-associated products. Details use
  the latest loaded dashboard snapshot (all active orders plus up to 20 recent
  orders, without duplicates); return and
  refresh for updates.
- **AdminStore Product Visibility**: Active assigned orders retain every ordered
  product even if its catalog owner is another store. Unanswered products from
  those orders appear in the fulfillment queue regardless of catalog-store distance.
  Marked-ready/rejected products leave the action queue, not the order details.
- **Company Order Fallback**: With no eligible partner store within 10 km or driver
  within 5 km, the backend routes to the nearest available company account without
  a radius limit. AdminStore receives assigned orders in its overview; AdminDriver
  receives an unassigned offer to claim or reject. Claimed deliveries enter the
  active queue; rejecting passes the offer to the next eligible driver.
  When company stores cannot be ranked by proximity, an eligible preferred
  company store or a stable available default is used instead of leaving pickup
  unassigned. Closed or unapproved stores are not eligible.
- **Low Stock Monitor**: Dedicated low-stock screen with configurable minimum threshold
- **Low Stock Badge**: Admin tab badge shows current low-stock count
- **Auto Cleanup**: Automatic deletion of old delivered orders (2+ months)

### Security Features
- JWT authentication
- Email verification
- Password reset via email
- Secure payment processing
- Cart persistence per user
- HTTPS encryption
- Order-time stock validation before payment/transaction proceeds

## 🛠️ Tech Stack

- **Framework**: React Native 0.81.5
- **Development**: Expo SDK 54.0.0
- **State Management**: Redux Toolkit 2.8.2
- **Navigation**: React Navigation 7.x
- **UI Components**: React Native Paper 5.14.5
- **Styling**: Styled Components 6.1.19
- **Payment**: Stripe, Telebirr
- **Storage**: AsyncStorage
- **Backend API**: Node.js + Express (deployed on Render)

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo Go app (for testing on device)
- Expo CLI: `npm install -g expo-cli`

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/Gmen2025/easy_shopping.git
cd easy_shopping
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
   
   Update `assets/common/baseUrl.js`:
   - For development: Set `ENV = 'development'`
   - For production: Set `ENV = 'production'`

4. **Start the development server**
```bash
npx expo start
```

5. **Run on device/emulator**
   - Scan QR code with Expo Go (Android/iOS)
   - Press `a` for Android emulator
   - Press `i` for iOS simulator

## 🔧 Configuration

Notification inbox regression tests:

```bash
node --test scripts/notificationInbox.test.mjs
```

Store pickup-selection regression tests:

```bash
node --test scripts/storeRouting.test.cjs
```

AdminStore order navigation and product-detail regression tests:

```bash
node --test scripts/companyStoreOrders.test.cjs
```

### Native Android builds

Hermes compiler selection uses the React Native Gradle plugin's platform-aware
default (`hermes-compiler` for the installed React Native version). Do not override
it with the legacy `react-native/sdks/hermesc` path; that executable is no longer
shipped there and causes EAS release bundling to fail.

#### Google Maps API key

Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (or `GOOGLE_MAPS_API_KEY`) in the
environment used for the build. Local Expo builds can read it from the untracked
`.env`; EAS builds require the variable in the selected EAS environment.
Enable **Maps SDK for Android** in the Google Cloud project and restrict its
Android key to package `com.addugenet.eshop` and the signing certificate SHA-1
for that build. Directions requests additionally need the appropriate API enabled.
Do not put key values in tracked source files.

The checked-in Gradle project resolves the Expo configuration and supplies the
`com.google.android.geo.API_KEY` manifest metadata through a placeholder. Native
code exposes only whether the installed manifest contains a key. If the key or
native configuration module is missing, map screens display an unavailable
message rather than creating a crashing native map; delivery controls remain usable.
Delivery routes use Expo Location for live GPS and render a custom driver marker.
MapView's native user-location layer and follow mode are disabled to avoid
unsupported `topUserLocationChange` events in mismatched native map builds;
the existing route camera updates continue to follow route coordinates.
If the map is blank with only the Google logo, JavaScript key presence and live
GPS do not confirm SDK authorization. Check billing, Maps SDK for Android, and
the installed APK's package/signing SHA-1 restriction. Driving directions are a
separate web-service request: this library uses the Directions API endpoint.
Both maps request the latest Google renderer and fit driving-route geometry after
native map readiness. Customer camera bounds exclude unrelated nearby drivers and
the driver's current position after delivery. Driver maps omit unavailable markers.
Use `adb logcat -s "Google Maps Android API"` to diagnose SDK authorization; redact
API key values before sharing logs. Authorize the installed certificate fingerprint,
which may change when rebuilding a deleted Android project with a new debug keystore.
On an emulator, set a realistic driver GPS location using Extended Controls > Location;
the default Mountain View location produces a real California-to-Chicago driving route.
When live driver GPS is unavailable, the driver screen uses the registered pickup
store coordinates as an explicitly labeled estimated origin. It does not invent a
nearby driver position or use stale request coordinates. Road distance and ETA are
measured from the store; before pickup this is a store-to-itself route, not a claim
that the driver has arrived. Missing store coordinates leave routing unavailable.
When live GPS arrives, the screen requests a new route from the real driver origin.
The driver's active-route screen now requests driving routes from the authenticated
backend and draws a polyline. It refreshes at most once per minute using live GPS;
the server selects the pickup/customer destination from the assigned order.
Requests rejected as unauthorized, forbidden or unassigned stop automatic retries;
return to the queue and reopen an active claimed delivery. Completed deliveries
do not request an active driver route.
Route requests share their cooldown across GPS/store-origin transitions to avoid
duplicate calls. HTTP 429 responses honor Retry-After without replacing the underlying
route failure. Google Routes rejection messages are redacted and surfaced by the backend;
server configuration changes must be applied to the deployed service, not the mobile environment.
Live GPS arrival does not cancel or clear a successful store-origin route; its metrics
remain labeled as from-store until the next live-origin route succeeds. Changing from
pickup to delivery clears the previous leg and requests the new leg after at most the
10-second transition cooldown (subject to server Retry-After). Missing metrics show
Calculating or Unavailable, and valid zero-distance/zero-duration routes display zero.
Live GPS is used regardless of distance to the destination; there is no artificial
300-km service-area cutoff. Google determines whether a driving route exists.
GPS permission/fetch failures are shown explicitly, and distance estimates do not
clear backend routing errors.
Set the separate `GOOGLE_ROUTES_API_KEY` on the backend and enable Routes API.
The Android SDK key remains Android-restricted. Customer tracking uses direct
Directions API requests and requires a separate
`EXPO_PUBLIC_GOOGLE_DIRECTIONS_API_KEY`. Enable Directions API for that key;
the Android SDK key and its Android-app restriction cannot authorize a Directions
web-service request. An embedded client key is public, so restrict it to the
Directions API and use a backend proxy with a server-restricted key for production.
There is no SDK-key fallback. If directions fail or are not configured, neither
customer nor driver tracking draws a straight-line substitute or shows a distance
or ETA estimate.
Immediately after purchase, tracking uses the checkout pickup/customer coordinates
until the tracking response supplies them. Pending orders show the pickup-to-delivery
route even before a driver reports GPS; assigned drivers show the active pickup
or delivery leg. The camera fits the coordinates after the native map is ready.
Checkout geocodes the entered shipping address for store assignment and the drop-off,
not the device's current GPS position, and verifies the result belongs to the selected
country. Android's native geocoder requires location permission. If the address cannot
be resolved or verified, checkout reports the error instead of substituting a coordinate.
Tracking resolves shipping addresses on older orders as well; until resolution succeeds
it shows only known map points. US route distances display in miles; other countries
continue to display kilometers.
Use Refresh to retry an address lookup after granting permission or fixing connectivity.
Failures are displayed with key values redacted. Checkout also requires the backend's
road-distance estimate to price delivery; it does not substitute a straight-line distance.
Checkout sends the geocoded shipping coordinates with the distance request so the
backend can select the pickup store even when the mobile store cache is empty.
The server uses nearby eligible partners first, then an available AdminStore,
and only requires a separately configured hub if no selected store provides an origin.
USA delivery settings and checkout interpret the existing `sameDayPerKm`,
`nextDayPerKm` and `scheduledPerKm` amounts as per-mile rates for `E_ShopUSA`.
The amounts are not converted: 10 km is charged as approximately 6.21371 miles.
Other databases retain per-kilometer pricing. API/order distances remain stored in
kilometers; only the distance multiplied by the rate is converted. Deploy the
matching backend update before using the new mobile checkout calculation.
The distance-estimation request includes the customer's Bearer token, using the
stored session token if checkout has not loaded it yet. A missing session reports
that sign-in is required rather than sending an unauthenticated request.
Checkout distance requires the backend's `GOOGLE_MAPS_API_KEY` authorized for
Distance Matrix API; the mobile Directions key does not configure this endpoint.
Backend error messages are preserved when a driving distance is unavailable.
The backend uses checkout's verified shipping coordinates as the driving destination,
avoiding a second lookup of address text (including Ethiopian addresses). Older clients
without coordinates still use the address. A `ZERO_RESULTS` response means Google
found no driving route: verify both map pins and road access; routing coverage may
be unavailable in the area. It is not an API-key or billing error.
Checkout's **Preview delivery locations** button shows the geocoded shipping pin
and selected pickup-store pin before payment or distance calculation. Both pins
include coordinates and links to Google Maps, even when native maps are unavailable.
Previewing requires a shipping address, city and country, not a completed order.
An unchanged address reuses the previewed delivery coordinates at confirmation;
editing the address or country hides the old preview and triggers a fresh lookup.
Pickup selection is refreshed at confirmation and remains subject to server eligibility.
Refine the shipping address if its pin is wrong, or have the store administrator
correct the pickup pin. Routing errors remain visible on checkout, with the preview,
and no fallback distance or fee is substituted when Google cannot find a driving route.
An OTA update or Metro reload cannot add native manifest metadata: rebuild and
reinstall the Android app after configuring the key.
For EAS development builds, set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in the
**development** EAS environment (a local `.env` does not configure an already
installed EAS APK). Build with `eas build --platform android --profile development`,
install the new APK, and restart the dev client. A missing native map configuration
module message means the installed APK predates the checked-in native integration.

Validate key wiring and the missing-key guard with
`node --test scripts/mapsConfiguration.test.cjs`.
Validate post-purchase coordinates and route selection with
`node --test scripts/orderTracking.test.cjs`.
Validate checkout location previews with
`node --test scripts/checkoutLocationPreview.test.cjs`.
Checkout and payment stock checks query live product inventory in the selected
database and use the existing bounded retry helper for transient network/server
failures. Verification failures identify the item and distinguish connectivity,
service errors, rejected access and unavailable products from insufficient stock.
Items from another shopping region must be removed and re-added in the selected
region. Missing or malformed stock never permits checkout, and cached cart stock
is not substituted for live inventory.
Validate inventory verification with `node --test scripts/inventory.test.cjs`.

The checked-in `android/` project is the source of truth for Android builds, including EAS Build.
Changes to native settings in `app.json` or `app.config.js` (such as icons, permissions,
plugins, and Google Services files) do not automatically update that project. Apply those
changes to `android/` as well and rebuild the native app. The Expo Doctor native-config
sync check is disabled for this reason. Its React Native Directory check still reports
known compatibility and maintenance issues; packages without directory metadata are
not reported.

### Backend API

The app connects to a backend API. Configure in `assets/common/baseUrl.js`:

```javascript
const ENV = 'production'; // or 'development'
const PRODUCTION_URL = 'https://easy-shop-server-wldr.onrender.com/api/v1/';
```

### Payment Configuration

- **Stripe**: Configure in backend with your Stripe secret key
- **Telebirr**: Currently in mock mode for testing

## 📱 Running the App

### Development Mode
```bash
# Start with cache cleared
npx expo start --clear

# Start offline (bypass network checks)
npx expo start --offline

# Start on specific platform
npx expo start --android
npx expo start --ios
```

### Production Build

#### Android APK/AAB
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android
eas build --platform android --profile production
```

#### iOS IPA
```bash
# Build for iOS (requires Apple Developer account)
eas build --platform ios --profile production
```

## 📂 Project Structure

```
easy_shopping/
├── App.js                      # Root component
├── index.js                    # Entry point
├── app.json                    # Expo configuration
├── package.json                # Dependencies
├── assets/                     # Images, icons, data files
│   ├── common/                 # Shared utilities
│   │   └── baseUrl.js          # API configuration
│   └── data/                   # Static data (categories, countries)
├── Context/                    # React Context providers
│   └── store/                  # Auth, Checkout, Telebirr contexts
├── Navigators/                 # Navigation configuration
│   ├── Main.js                 # Bottom tab navigator
│   ├── HomeNavigator.js        # Home stack
│   ├── CartNavigator.js        # Cart stack
│   ├── UserNavigator.js        # User/Auth stack
│   └── AdminNavigator.js       # Admin stack
├── Screens/                    # Screen components
│   ├── Products/               # Product browsing
│   ├── Cart/                   # Cart and checkout
│   ├── User/                   # Auth and profile
│   └── Admin/                  # Admin management
├── Shared/                     # Reusable components
│   ├── Form/                   # Form components
│   └── StyledComponents/       # Custom styled components
└── store/                      # Redux store
    ├── redux/store.js          # Redux configuration
    └── cartSlice.js            # Cart state management
```

## 🔑 Environment Variables (Backend)

Required backend environment variables:

```bash
# Database
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret

# Payment
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
USE_MOCK_TELEBIRR=false
USE_MOCK_SIGNING=false
TELEBIRR_PRIVATE_KEY=your_telebirr_key

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@info.addugeneteshop.com
EMAIL_REPLY_TO=support@addugeneteshop.com

# URLs
FRONTEND_URL=your_frontend_url
NOTIFY_URL=your_webhook_url
REDIRECT_URL=your_redirect_url

# Mobile app runtime (EAS/Expo)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
EXPO_PUBLIC_STRIPE_CURRENCY=usd
EXPO_PUBLIC_TELEBIRR_MOCK_ENABLED=false
```

For real transactions, do not use `sk_test_` or `pk_test_` keys in production builds.

Use a `From` email on the verified Resend subdomain `info.addugeneteshop.com`.

## 📸 Screenshots

(Add screenshots here once available)

## 🚀 Deployment

### Frontend (Mobile App)
- Build with EAS Build
- Submit to App Store / Play Store
- See `APP_STORE_DESCRIPTION.md` for submission guide

### Backend API
- Deployed on Render: `https://easy-shop-server-wldr.onrender.com`
- See `PRODUCTION_SETUP.md` for configuration

## 📄 Documentation

- **Privacy Policy**: See `PRIVACY_POLICY.md`
- **Account Deletion Page**: See `account-deletion.html`
- **Production Setup**: See `PRODUCTION_SETUP.md`
- **App Store Submission**: See `APP_STORE_DESCRIPTION.md`
- **GitHub Pages Setup**: See `GITHUB_PAGES_SETUP.md`

## 🧪 Testing

### Test Accounts

**Customer Account:**
```
Email: test@example.com
Password: Test123!
```

**Admin Account:**
```
Email: admin@example.com
Password: Admin123!
```

### Test Payment Cards (Stripe)
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

## 🐛 Known Issues

- Free tier Render backend may sleep after inactivity (30-60s wake up time)
- First API call may be slow on cold start
- During backend wake-up, temporary `503` errors may occur; app now retries transient failures with backoff and shows friendly status messages

## 🔮 Future Enhancements

- [ ] Push notifications
- [ ] Wishlist functionality
- [ ] Product reviews and ratings
- [ ] Multiple language support (Amharic, Oromo)
- [ ] Real-time chat support
- [ ] Loyalty program
- [ ] Social media integration

## 📝 Changelog

### Version 1.2.0 (June 2026)
- Fixed cart visibility/state consistency issues across product and cart screens
- Added inventory-aware checkout validation to block over-quantity orders before transaction
- Added post-order inventory deduction in checkout completion flows
- Added admin low-stock workflow:
   - Dedicated Low Stock screen
   - Configurable minimum stock threshold
   - Admin tab low-stock badge with instant refresh on threshold updates
- Added resilient API retry handling for transient `503/5xx` backend responses

### Version 1.1.0 (June 2026)
- Product search experience refined
- Advanced filters now open as a dropdown below search controls
- Improved product listing filter UX and layout stability

### Version 1.0.0 (December 2025)
- Initial release
- Complete e-commerce functionality
- Stripe and Telebirr integration
- Admin panel
- Email verification
- Order management
- Cart persistence

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

- **Email**: support@addugenet.com
- **Phone**: +251 911 234 567
- **Hours**: Monday - Saturday, 9 AM - 6 PM (EAT)

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **AdduGenet Team** - *Core development* - [Gmen2025](https://github.com/Gmen2025)

## 🙏 Acknowledgments

- React Native community
- Expo team
- All contributors and testers

---

**Built with ❤️ in Ethiopia**

*For the latest updates and documentation, visit our [GitHub repository](https://github.com/Gmen2025/easy_shopping)*

## ☁️ Cloudinary Direct Uploads

This project includes a small server-side signer and a React Native helper to upload images directly from the app to Cloudinary without exposing your `CLOUDINARY_API_SECRET`.

- Server signer: `scripts/cloudinary_server.js` — issues short-lived signatures. Keep `CLOUDINARY_API_SECRET` only on the server.
- RN helper: `Shared/CloudinaryUploader.js` — ready-to-drop helper with `getSignature`, `uploadToCloudinary`, and `uploadWithProgress`.

Basic flow:
1. App requests a signature from your signer: `POST /sign` with optional `{ public_id, folder }`.
2. Signer returns `{ signature, api_key, timestamp, cloud_name }`.
3. App uploads directly to Cloudinary `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload` with `file`, `api_key`, `timestamp`, and `signature` (plus optional `folder`, `public_id`).

React Native example (using the included helper):

```javascript
// request signature from your backend
const sig = await CloudinaryUploader.getSignature('https://your-server.com', { folder: 'mobile_uploads' });

// upload localUri (from ImagePicker)
const result = await CloudinaryUploader.uploadToCloudinary(localUri, sig, { folder: 'mobile_uploads' });
console.log('uploaded', result.secure_url);
```

curl example (after obtaining `signature` + `timestamp` from your signer):

```bash
curl -X POST "https://api.cloudinary.com/v1_1/<cloud_name>/image/upload" \
   -F "file=@/path/to/photo.jpg" \
   -F "api_key=<api_key>" \
   -F "timestamp=<timestamp>" \
   -F "signature=<signature>" \
   -F "folder=mobile_uploads"
```

Security notes:
- Do not embed `CLOUDINARY_API_SECRET` in the app. Issue signatures from server after authenticating the user.
- The included signer already filters allowed params; restrict further as needed for your app.

## Push Notifications Backend Example

The mobile app now registers Expo push tokens and calls this backend route:

- `PUT /api/v1/users/:userId/push-token`

To help you wire the server side quickly, a full Express example is included at:

- `scripts/expo_push_server_example.js`

What it includes:

- Token storage route (`PUT /api/v1/users/:userId/push-token`)
- Token removal route (`DELETE /api/v1/users/:userId/push-token`)
- Send notification route (`POST /api/v1/notifications/send`)
- Expo chunking and ticket handling using `expo-server-sdk`

Run the example:

1. `npm install express expo-server-sdk`
2. `node scripts/expo_push_server_example.js`

Example send payload:

```json
{
   "userId": "664e4b9db2a2f6dce8a4d111",
   "title": "Order update",
   "body": "Your order has been shipped.",
   "data": { "orderId": "ABC123" }
}
```

Production notes:

- Replace in-memory token storage with your database.
- Protect all routes with your JWT auth middleware.
- Remove invalid tokens when Expo receipts return `DeviceNotRegistered`.
