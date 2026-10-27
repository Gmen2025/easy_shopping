# AdduGenet EShop - Mobile E-Commerce Application

A full-featured React Native e-commerce mobile application built with Expo, featuring secure payments, order management, and admin capabilities.

## Per-store delivery and dispatch

New mobile and website product checkouts price each store separately:
store -> first drop-off -> additional drop-offs, using actual road legs and the
existing configured vehicle rates. One base fee and speed surcharge apply per
store, not per product or destination. Selecting a vehicle updates all destinations
from that store only. Destination shares add up exactly to the store route fee.
Driver travel to pickup and batching detours do not add customer charges.

Nearest eligible stores receive paid/activated orders and may accept or reject.
Rejections/timeouts try other nearby eligible stores, then the default store.
Default fallback requests persist without expiry even while offline. Matching
default-store stock can be quoted when no open store can supply it. The default
must open and claim before preparing. Claiming and rerouting do not need Admin
approval. Rerouting offers other eligible stores a timed chance to accept; only
explicit fallback rejection enters Admin review without cancelling payment.

In **Store assignments**, **Claim order** / **Accept order**, prepare the package,
then **Mark package ready**. Marking ready automatically selects that package and
increases **Dispatch selected**; claiming alone does not mark goods ready or select
them. You can deselect packages or select already-ready packages manually. Dispatch
packages from the same store using the same vehicle with **Dispatch selected**. Single
dispatch needs no reason. Known combined cargo must fit the vehicle; unknown
measurements require single-package dispatch. Each durable batch is offered to
one driver and stays queued if nobody is available. All packages in a batch must
be picked up before drop-offs. Other stores in the checkout dispatch independently.

If an accepted older order shows no **Mark package ready** button, use
**Enable store preparation** first (select a delivery vehicle if none was saved).
This explicitly upgrades the order without changing saved fees, payment records
or inventory reservations. Older cart-wide orders upgrade all active packages
together; all stores must have claimed them and no driver may be assigned or have
picked up a package. Afterward, **Mark package ready** appears and automatically
selects the package. Unknown-size packages must be dispatched singly. Deploy the
backend upgrade endpoint with both clients; older orders are not migrated automatically.

Claimed requests may be rerouted before dispatch. **Admin > Store requests** also
supports direct claim for the assigned/default eligible store, reroute, preparation
and batch/single dispatch. Admin rerouting reopens eligible store attempts, with
an offline default queue when no alternative is available. Rejected requests stay
listed for review, including after cancellation. Use **Payment, cancellation &
refunds** to cancel through the checkout and reconcile any required refund before
deleting a rejected paid order. The server enforces these payment safeguards.

### Driver fallback and Admin override

New store batches try nearby available partners, then the nearest available company
driver (without a radius limit), then the nearest eligible offline company driver.
Offline offers persist in the designated driver's list. Normal claiming requires
going online with a compatible vehicle and enough capacity. Company drivers may
claim, reroute or reject their offer, or release an accepted batch before pickup.
Rejection stays visible to Admin without blocking delivery or changing payment.
Prepared, dispatched scheduled batches appear as **Upcoming scheduled delivery**
to the designated compatible company driver, even offline. Drivers may claim
immediately, before the delivery window, or reject/reroute before pickup.
Store cards and batch offers display saved delivery windows; early claiming
does not change schedules or fees. Any enabled vehicle that fits the measured
combined load may carry a batch, regardless of its billed vehicle. Unknown-size
packages still require the explicitly selected vehicle. Normal availability,
capacity, approval and pickup safeguards remain enforced.

Dispatching stores can **Reroute to another driver**, keeping all batch packages
together. **Admin > Store requests** shows company offers, assigned drivers and
rejection history. Enter an approved driver's ID and use **Admin assign / dispatch
to driver** to override ownership, online status, proximity and previous refusal.
Admin may also claim/dispatch from closed approved stores. Stock, matching prices,
vehicle/capacity, payment/refund, scheduled windows and pickup/completion safeguards
still apply. Reassignment is blocked after any pickup; physical package handover
is not implemented. Admin assignment does not switch a driver's online status on.

Deploy the backend and website changes with this app. Existing saved quotes and
orders retain their original rules, described in the legacy section below.
US-to-Ethiopia orders apply per-store pricing to US store-to-hub routes only.
Focused validation: `node --test scripts\multiDeliveryCheckout.test.cjs scripts\storeAssignments.test.cjs scripts\storeRoutePricing.test.cjs scripts\companyDriverRefresh.test.cjs`.

### Legacy cart-route delivery

Previously saved mobile and website grouped product checkouts retain this behavior in
USA and Ethio: one fixed delivery fee for the customer's pickup stores and
drop-off addresses. It includes one vehicle base fee, route distance and one
speed surcharge, never driver travel to the first store or another customer's
detours. Changing any vehicle selector applies to the whole cart. Receipt amounts
on store orders are allocated shares, not additional delivery charges.

Company drivers claim a complete cart after all stores accept it, then can batch
several accepted carts within the cart-count and conservative combined vehicle
capacity limits. Shared stores appear once in the operational stop list. Confirm
each collected store order; after pickup the cart route returns to the refreshed
queue so cart readiness reflects every collected product. No drop-off route or
delivery confirmation unlocks until all pickups for that customer cart finish.
Other accepted carts are checked independently. Unknown package measurements require manual vehicle
selection and disable multi-cart batching.

Deploy the matching backend first and release both clients. Saved legacy quotes
and orders retain their previous rules. Geographic multi-start route ordering is
a heuristic, priced with actual road legs, not guaranteed shortest-road routing.
Live driver navigation and batching never reprice a reserved cart.
The configured default store receives unaccepted fallback requests from all
storefronts, including unrelated ones, to claim with matching stock/prices,
reroute, or reject for Admin review. Other fallback stores retain family scope.

All driver accounts, including partners, have a Driver tab with **Available
Delivery Assignments**, shared with the website through the backend's
`drivers/me/available-deliveries` list/claim APIs. Eligible available drivers
can claim an unassigned complete cart or legacy delivery even if a company offer
was directed to someone else. Partner drivers retain the 5 km first-pickup radius
and pre-pickup recipient privacy. Approval, vehicle/capacity, availability and
ride exclusions are checked again transactionally on claim; no socket or second
acceptance is required.

If nobody is available, requests stay queued. Company drivers still see them
when reopening or refreshing while offline/full, with Claim disabled until
eligible. Company drivers can Reroute/Reject any ready unclaimed request, even
without a designated offer or another driver currently available. Both actions
remove the whole cart only from that driver's list and leave it queued for
other eligible company/partner drivers. Reject also flags it in Admin's Delivery
Rejection Review without blocking delivery; Reroute does not create a review
flag. Neither action cancels/refunds payment. Assigned carts cannot be released by these actions.
Company-only passenger ride
controls remain hidden for partner drivers.
US-to-Ethiopia shipping uses this for the US store-to-hub leg only; international
tariffs remain separate.

Focused validation: `node --test scripts\multiDeliveryCheckout.test.cjs scripts\companyDriverRefresh.test.cjs scripts\orderTracking.test.cjs`.

## Optional store logos

**Admin > Company Stores** supports an optional image on both Create and Edit.
**My store & inventory** supports the same controls for owner profiles and new
branches. Choose a JPEG, PNG or WebP from the photo library (up to 5 MB), enter
an HTTPS image URL, or remove the image to use initials from the registered
store name. Both store-directory cards and storefront headers show the logo,
with initials as a fallback for missing or unavailable images.

Image selection uses the existing Expo Image Picker and Cloudinary integration.
Photo access is requested only when choosing an image. Upload failures are
displayed and saving is blocked while an upload is in progress. Save the store
form to persist an uploaded or removed logo; cancelling edits leaves its saved
logo unchanged. Changes are shared with the website through `Store.logo` in the
same regional database. Deploy the matching backend first and configure its
existing Cloudinary credentials; no new mobile dependency or database migration
is required. Removing/replacing the store reference does not delete the old
Cloudinary asset.

Focused validation: `node --test scripts\store-logo.test.cjs`.

## Social sign-in and optional two-factor authentication

The login screen uses the yellow-and-white Addu Genet design, with email,
Google, Apple, and Facebook entry points. Provider account selection happens
in the provider's real browser UI, not an imitation account picker.
Existing registration, password reset, guest shopping and role-based profiles
remain available. Authenticated users can open **Profile > Security Settings**
to enable an authenticator app or email codes, save single-use backup codes,
regenerate recovery codes, or disable 2FA after verifying their current factor.
SMS and trusted-device bypass are not implemented.

Deploy the matching authentication backend from `D:\MERN_COURSE\backend`
before using these screens. Follow its authentication setup documentation
and `.env.example` to register Google, Apple and Facebook applications,
configure callback URLs, SMTP, the encryption key and permitted app redirects.
No OAuth client secrets belong in this mobile app. An unconfigured provider
returns an explicit error; buttons never simulate successful sign-in.

- Admins control Google, Apple, and Facebook separately under **Admin >
  Maintenance & Login > Social sign-in**, or in the website's **Admin Dashboard >
  Social sign-in** panel. Each provider has its own toggle, shared by all regions
  and all development/production clients connected to that backend. Settings
  are stored in its default database and default to OFF. Existing shared settings
  are inherited until each provider is changed, so upgrading preserves the current
  state. Separate test backends have separate settings.
- Login reads public `GET /settings/social-login` on focus, on returning to the
  foreground, and every 30 seconds while focused. Failed/invalid reads hide the
  buttons and show an error without blocking email login. The mobile API checks
  again before opening the selected provider. Only enabled provider buttons are
  visible; the separator is hidden when none are enabled. The backend enforces
  that provider's setting at social start, callback, handoff exchange and
  social-origin 2FA completion. Disabling one provider does not disable the others,
  revoke existing sessions or affect password sign-in/2FA.
- Deploy the matching backend first, then distribute the updated mobile bundle
  and website. After that, admin changes do not require rebuilding clients.
  `EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN` is no longer used and can be removed from
  build environments. Enabling a provider does not configure provider secrets,
  native modules or callbacks; finish the provider setup and testing first.
- Public signup is customer-only: the Register as Driver switch and driver-role
  fields have been removed from the form/submission. Existing driver accounts
  and their role-based navigation are unchanged; backend registration policy
  is not changed by hiding the mobile option.
- Native callback: `addugeneteshop://auth`, using the existing Expo scheme.
  Use a development or release build, not Expo Go, to test this callback.
- Optional mobile environment: `EXPO_PUBLIC_API_URL` overrides the API base
  URL and must include `/api/v1/` with a trailing slash. Otherwise the existing
  Render API remains the default. Use a reachable LAN URL for a physical phone,
  not a backend Windows filesystem path.
- Optional `EXPO_PUBLIC_AUTH_REDIRECT_URI` overrides the callback (also exposed
  through `app.config.js`). For web, configure a fixed HTTPS origin/page in the
  backend allowlist; the current web origin is the default.
- OAuth uses a browser authorization-code flow and a short-lived, one-use,
  PKCE-bound handoff. Access tokens are never placed in callback URLs.
- Password and social sign-in both stop at the 2FA challenge when enrolled;
  the app stores an access token only after final verification.
- Authenticator setup shows a QR code and selectable manual setup key.
  Backup codes are displayed once; store them safely before continuing.
- Rebuild the native app after installing the new Expo Crypto, Web Browser
  and SVG native dependencies. Restart Metro after changing public environment
  settings. Provider credentials and SMTP cannot be verified without your
  configured service accounts.

### Missing ExpoCrypto or ExpoWebBrowser on a device

An APK/dev client installed before these native dependencies were added cannot
load them from a JavaScript reload or an OTA update. Social sign-in checks the
installed native modules and displays an explicit rebuild message rather than
crashing startup; email sign-in remains available. There is no insecure random
number fallback for PKCE.

For a connected Android emulator/device, run `npx expo run:android --device`
to rebuild and install the native app, then use
`npx expo start --dev-client --clear` if Metro is not already running.
Alternatively, build `npx eas-cli@latest build --platform android --profile development`
and install that new development APK on each test device. For a standalone test
APK, use `--profile preview` instead. Restarting Metro alone does not update
native code. Use a rebuilt development/release app, not Expo Go, for social login.

Focused checks: `node --test scripts/authentication.test.cjs`.

## 📱 Features

### Customer Features
- **Profile dashboard**: Reference-style account summary, yellow edit action,
  service requests and red sign-out action, order shortcuts, privacy/security
  rows and support tiles. Phones use two-column tiles; wider screens use four.
  Account and support details use actual existing data, not reference placeholders.
  Order List expands the existing order cards; Track Delivery filters active
  orders and Deliveries filters delivered orders. Cancellation and Payment open
  the existing delivery checkout manager, which enforces cancellation/refund
  eligibility and shows checkout payments; no saved-payment-method manager is
  implied. Security Settings remains accessible for 2FA/recovery. Loading,
  empty and failed order requests have distinct states, with pull-to-refresh
  and retry support.
- **Reference-style Storefront**: Yellow branded header with a shopping menu,
  regional country selector, notification inbox and cart shortcut. Home includes
  search, Ride/Store/Service Request shortcuts, circular catalog categories,
  the existing promotional artwork, featured products and responsive product
  cards (two columns on phones, four from 700 logical pixels). Category images
  use the category's own artwork or a matching catalog product; ratings are
  shown only when present. Filter/sort, stock counts, regional prices and
  role-based navigation remain available. Bottom tabs retain their destinations
  and now show labels. No reference-image products, prices or review counts
  are used as catalog data.
- **Product Browsing**: Browse products by category with search and advanced dropdown filters
- **Shopping Cart**: Add, remove, and manage cart items
- **Live Stock Visibility**: Product cards and product detail screens show current inventory left
- **Secure Checkout**: Multi-step checkout with address and payment
- **Multiple Payment Options**: 
  - Credit/Debit cards via Stripe
  - Telebirr mobile money
- **Regional payment controls**: Cash on delivery (including USA) and all
  existing supported methods are available independently of development or
  production builds. Admin > Maintenance & Login > Payment methods has
  separate USA/Ethio switches for cash, bank, card and Telebirr, shared with
  the website. Missing switches default ON. Checkout and ride payment screens
  refresh on focus, foregrounding and every 30 seconds. Disabled methods
  cannot start new payments; settings failures block new submissions with
  an explicit error. If no eligible methods remain, checkout displays:
  "Payment is temporarily unavailable. Please try again later."
  Deploy the matching backend first (`settings/payment-methods` uses the
  selected `x-database-name`; updates require Admin).
  Existing grouped reservations, saved ride methods, card intents and receipt
  reconciliation remain accessible. Legacy order creation is a new submission
  and is blocked while its method is disabled; coordinate maintenance around
  already-paid legacy orders. Currency restrictions, provider configuration
  and Stripe's native-build requirement still apply. Telebirr is supported by
  legacy Ethio checkout, not grouped checkout/rides. USA-to-Ethiopia shipping
  remains ETB bank-only; Ethiopia USD/service payments still exclude cash.
- **USA Car Delivery**: In vehicle checkout, calculate routes and select
  **Car** under **Delivery vehicle** for each pickup/destination. The previewed
  fee updates and the saved order requires a car driver. Car is shown only when
  enabled with valid pricing/capacity in **USA > Admin > Vehicle delivery
  settings** and suitable for the known load. Enable vehicle checkout and
  migrate per-store inventory first. Missing or unsuitable Car options show an explanation rather than
  bypassing capacity checks.
- **Delivery Speed**: New checkouts offer **Express (1-2 business days)**,
  **Standard (2-5 business days, default)** and **Scheduled** (future date),
  applied to all deliveries. Business days are Monday-Friday, with no holiday
  calendar; counting starts on the next business day. Admin can adjust day
  ranges, delivery hours, IANA time zone and pricing under **Delivery Pricing**.
  Hours default to 09:00-18:00; the regional default zone is America/New_York
  for USA and Africa/Addis_Ababa for Ethiopia. Set the USA zone to match your
  operation. For US-to-Ethiopia purchases the window covers the US hub leg
  only, not international arrival.
  Express retains the previous same-day legacy base/premium/distance rates;
  Standard retains previous next-day legacy rates. Multi-delivery retains its
  vehicle/route fees with explicit speed surcharges per delivery (zero by
  default), rather than charging the legacy distance fee again. Historical
  Same Day/Next Day orders keep their original mode and delivery promises.
  Deploy the matching backend and upgraded mobile together: old clients sending
  SAME_DAY/NEXT_DAY for new orders will be rejected. Existing orders and
  in-flight legacy quotes retain their timing.
- **Store-based delivery pricing**: All products from one pickup store to one
  destination incur one delivery fee, not a fee per product or unit. Stores
  are selected by the backend: when one eligible store has enough unreserved
  stock for the entire checkout at the quoted prices and within storefront
  restrictions, that store is preferred over splitting products between
  nearer stores. If no one store can fulfill everything, multiple stores may
  supply the order. Separate delivery addresses still have separate fees. Stores
  within **500 meters of every other store in their pricing group** share one
  fee when the **same vehicle type** is selected. The fee uses the store with
  the shortest driving distance to the drop-off, including the speed surcharge
  only once. Proximity uses straight-line pickup distance; far-apart stores,
  different vehicle types and separate destination IDs are charged separately.
  Vehicle choices show unshared route prices; the delivery preview shows the
  actual shared total and each store's share. Shared fees are split equally
  between store orders, with exact cent rounding, for partial refunds.
  Pickups, capacity checks and tracking remain separate per store. The US hub
  leg uses the same rule per international recipient; onward shipping is
  unchanged. Historical orders and existing quotes keep their saved pricing.
  Deploy the matching backend and updated mobile together.
- **Reference-inspired cart flow**: White cards, a yellow brand header/actions
  and progress through Cart, Address, Delivery and Payment lead to a separate
  Order Summary. Quantity +/- and remove respect the exact regional/storefront
  cart variant. Multi-address allocations, server vehicle recommendations,
  USD/Birr choices, exchange-rate locks, international shipping and recovery
  remain intact. Review displays server-estimated delivery windows and
  vehicle-adjusted totals; payment eligibility is unchanged. No store pickup,
  invented tax, unsupported Telebirr flow or email/SMS promise is added.
  Processing reflects real requests; confirmation distinguishes paid orders,
  cash due, pending bank verification and international bank review.
- **Checkout Stock Guard**: Prevents checkout/payment when requested quantity exceeds available stock
- **User Accounts**: Registration, login, email verification
- **Order Tracking**: View order history and status
- **Notification Inbox**: Received and opened notifications share one entry per
  identifier. Saved duplicates are removed on startup, read status is preserved,
  and the inbox retains the latest 20 unique entries.
- **Profile Management**: Edit profile and manage addresses
- **Map-first Ride Booking**: A full-screen background map stays visible through
  pickup/drop-off editing, vehicle selection and trip summary. The screen opens
  with one **collapsed** bottom panel. **Show booking details** expands the
  pickup/drop-off search card and booking details together in a single vertical
  scroll area; **Show more map** collapses them together without clearing edits.
  In **Map & stops**, choose a stop before tapping the map; locations
  are verified before being applied. A single search at the top edits the selected
  pickup or drop-off; use the stop selectors to switch and **+ Add** to insert
  another stop. Saved-address badges apply to the selected stop. While typing,
  the brand header hides and the combined panel expands within the space above
  the keyboard. Search suggestions, phone, passenger and manual address fields
  remain mounted and scrollable, and focused inputs scroll above the keyboard.
  iOS uses keyboard padding; Android uses the configured resize mode.
  **Done** dismisses the keyboard without collapsing the panel.
  Shared-ride rules are available through **Info** beside the shared-ride switch.
  Fare calculation and payment-after-ride behavior are unchanged. The booking map
  waits for real coordinates before mounting, uses neighborhood zoom for a single
  location and limits overlay padding to leave a usable map viewport.
  GPS remains available if address verification fails. Location permission
  and a correctly configured native map build are required.
- **Password Recovery**: Forgot password functionality

### US Products to Ethiopia, Paid in Birr
- Select the **USA catalog**, then **Pay birr & ship to Ethiopia (ETB)** in the
  cart. This is **products only**: USA rides and other services do not accept
  birr through this feature. Domestic US USD purchases are unchanged.
- Enter Ethiopian recipient addresses and allocate product quantities. US
  stores deliver to the Admin's US consolidation hub; Admin manages onward
  shipping and final delivery to each Ethiopian address. The driver map tracks
  only the US pickup-to-hub leg. **At US hub is not final recipient delivery.**
- Checkout displays USD product costs, US hub-delivery fees and international
  shipping, followed by the converted ETB payment. Shipping is charged once per
  recipient, based on the greater of actual or volumetric packaged weight.
  Vehicle upgrades affect only domestic hub-delivery fees. **Import/customs
  duties and clearance charges are excluded and paid separately by the recipient.**
- In the **USA region**, **Admin > FX Rate** independently controls this
  feature and its daily birr-per-USD rate, manual Apply and automatic provider
  refresh. Every successful Apply/Fetch records a timestamp/revision even if
  the numeric rate is unchanged. At exactly 24 hours without a successful
  update, new birr export checkout is inactive with an explanation. Saved
  payments still recover at their locked rate.
- **Admin > US Shipping** configures the US hub, USD shipping tariff/minimum,
  volumetric divisor, weight/dimension limits and explicit export approval of
  products. Products default to domestic-only. Package sizes, US inventory
  migration and enabled hub vehicle pricing are required.
- Only **ETB-tagged bank transfers configured in the USA region** are allowed.
  Submit the transfer reference before the stock hold expires. During
  **bank_review**, stock stays reserved but stores cannot fulfill until Admin
  confirms received birr funds in combined payments. Do not send another payment.
  Admin may reject a reference only after verifying no funds were received.
- Admin advances recipient shipment tracking through **at hub, shipped,
  arrived Ethiopia and delivered**, supplying carrier/tracking details and
  final delivery proof. Customer checkouts, order receipts and tracking show
  these separately from domestic driver status. Carrier booking and actual
  international/final-mile operations are manual, not automatic API integration.
- Initially disabled. Configure and test both repositories, actual payments,
  MongoDB transaction concurrency and international shipping operations in
  staging before enabling. No deployment, migration or live activation is
  performed by adding this code.

### Ethiopia USD Purchasing
- Customers select the **Ethiopia region**, then choose **ETB or USD** in the cart.
  Goods and non-ride quoted services are delivered/performed in Ethiopia for
  their recipients, not shipped internationally. Prices and store/driver
  accounting remain birr; checkout displays a separate converted USD charge.
  USD is not available for passenger rides.
- **Admin > FX Rate** in Ethiopia enables/disables this service, separately toggles automatic
  fetching, selects a server-configured provider, or manually applies a
  **birr-per-1-USD** rate. Apply/Fetch visibly record time, revision and history,
  even when the rate has not numerically changed. Saving toggles does not renew
  a rate. After exactly 24 hours without a successful apply, new USD checkout
  is unavailable with an explanation; ETB checkout continues.
- USD products require backend per-store inventory migration, vehicle delivery
  settings. Packaged product sizes are optional for domestic USD checkout;
  missing measurements require manual vehicle selection. USD checkout offers only card / explicitly
  USD-tagged bank accounts, never cash. **Admin > Bank Account Settings** chooses
  ETB/USD for each account; old Ethiopia accounts remain ETB.
- USD cards require a native development/production build, a USD-capable
  merchant, and dedicated matching backend
  `STRIPE_SECRET_KEY_ETHIOPIA_USD` / `STRIPE_PUBLISHABLE_KEY_ETHIOPIA_USD`.
  The prepared checkout supplies its public key; native confirmation selects it
  and restores the normal app key afterward. No borrowing USA merchant keys.
- Orders, combined payments and refunds show the saved USD charge and exchange
  snapshot, separately from ETB prices. Interrupted reservations recover at
  that saved amount even if the rate later expires or USD is switched off.
  Check payment status before retrying; do not start a second payment.
- **My Service Requests > Accept & pay quote in USD** uses the Admin's stored ETB
  quote. Service payment does not alter the product cart. Admin receives bank
  confirmation in combined payments. Prepared service prices are locked;
  cancel an unpaid checkout before editing. Submitted/paid service payments
  require support review/manual refund before cancellation and cannot be deleted.
- Initially disabled. Deploy/configure the matching backend (including the
  provider registry described in its README) and verify actual MongoDB
  transactions, exchange-provider integration and native payments on staging
  before enabling. No deployment, live rate fetch or migration is automatic.

### Admin Products
- The Products screen scrolls its management shortcuts, search field, column
  headings and product rows together, including while products are loading.

### Ride Service
- The customer flow uses white cards, yellow actions and a four-step progress
  indicator: **Your trip > Map & stops > Select ride > Trip summary**. Review all
  ordered stops, passenger/contact details, the server-priced vehicle, driving
  route and estimated fare before requesting. Back preserves the draft; **Edit
  trip** clears prices. Payments remain after completion, not at booking.
- In **Map & stops**, select the numbered stop and tap the map to choose its
  address. The existing `POST /rides/places/current-location` endpoint reverse
  geocodes and validates the chosen coordinates in the current region; failures
  leave the stop unchanged. Address search, saved addresses, manual entry and
  device GPS remain available. The pre-quote map shows pins only; a verified
  driving route appears in the quote review. No new server endpoint is required.
- Regular intermediate stops have **Move up**, **Move down**, and **Remove
  stop** controls. The first pickup and final drop-off stay fixed, the maximum
  remains 12 stops, and reordering recalculates the final passenger count.
- Tracking presents the booking status, driver pin, GPS freshness, calling,
  native trip sharing and the existing ten-second foreground refresh. Completed,
  cancelled and terminated rides do not show a live driver pin. For assigned
  rides, `GET /rides/:id` supplies `pickupEta`: traffic-aware driving from fresh
  driver GPS through any preceding stops to your pickup (including Shared-trip
  stops). The UI counts down from `arrivalAt`, displays the preceding stop count
  and last calculation time, and expires the estimate at `expiresAt` or when its
  source GPS reaches 60 seconds old. Status polling remains every ten seconds;
  the backend caches routing for at most 30 seconds to limit Google calls.
  Stale GPS, route failures and older backends show an explicit unavailable
  message, never planned trip duration as pickup ETA. Boarding delays are not
  included. Deploy the updated backend with `GOOGLE_ROUTES_API_KEY` and enable
  Google Routes API/billing; no routing secret is added to the mobile app.
- Ride booking and history require sign-in. Guests see a sign-in action instead
  of an authorization popup; expired sessions offer sign-in again. Returning to
  the Ride page after login reloads the configuration and saved addresses.
- The **Ride** badge beside **Stores** and **Service Request** opens address
  entry, saved/current-address selection and road-fare estimates. Regular is the
  default: arrange 2-12 ordered pickups/dropoffs and pay one fare for the whole
  booking. Boarding/leaving counts must balance. Shared bookings have one own
  pickup/dropoff and passenger-party count; the backend matches unrelated
  customers only when road-route, wait, detour and seat limits fit.
- The first stop is always a pickup and the last is always a drop-off. Set the
  number boarding at each pickup (and leaving at intermediate drop-offs); the
  final drop-off count automatically includes everyone still onboard. Adding,
  removing, or changing intermediate stops recalculates that count. Switching
  between Regular and Shared resets to the first pickup and final drop-off with
  matching passenger counts.
- With location permission, the first pickup defaults to the device's current
  GPS position. **Use my current location** refreshes it; search, saved addresses,
  and manual stop details remain available to change pickup. The server reverse
  geocodes GPS through `POST /rides/places/current-location`, verifies the shopping
  country, and rechecks the position when quoting. Enable Geocoding API for
  `GOOGLE_MAPS_API_KEY`. Permission/lookup failures show a message and allow manual
  entry. Editing street/city/ZIP/country clears the GPS selection.
- Each stop has a visible, editable **Contact phone**, prefilled from the current
  account address or profile. The number is required and saved in the ride's stop
  address for the driver to contact the passenger; changing it invalidates the
  quote. This does not change the account's profile phone.
- **Calculate road route & fare** compares server-priced **Economy**, **Comfort**
  and **Van** options for both Regular and Shared rides. Choose an option at its
  displayed price before requesting; Motorcycle and Truck are omitted. Economy
  and Comfort require a car with the exact Admin-assigned class; Van matches vans.
  Prices are estimates, not a guarantee of an available driver. Disabled regional
  options cannot be selected. Address, phone, passenger or mode edits clear all
  prices; recalculate them. Quotes expire after ten minutes.
- After selecting a priced option, the quote shows a Google map with the
  numbered pickup (green) and drop-off (red) pins and the driving route through
  every stop in order, plus a link that opens the same route in Google Maps. My
  rides shows the same map with the assigned driver's live pin. The server builds
  the route with `GOOGLE_ROUTES_API_KEY` (`GET /rides/:id/route`, owner-only) and
  caches it on the booking; without that key, the pins still show with a message.
- Each pickup/drop-off has a search-as-you-type box that suggests places in the
  store's country (USA store → US, Ethio store → Ethiopia). Choosing a suggestion
  fills the address and pins the exact map location; editing the address
  afterwards clears that pin and the address is geocoded instead. The ZIP field is
  hidden for Ethiopia (ZIP is optional for Ethiopian addresses everywhere).
  Suggestions go through the server (`GET /rides/places/autocomplete` and
  `/rides/places/details/:placeId`) using `GOOGLE_PLACES_API_KEY` (or
  `GOOGLE_MAPS_API_KEY`); enable **Places API (New)** for that key.
- **My rides & post-ride payments** shows only the customer's own booking,
  driver/contact/GPS, status and fare. Waiting/offered rides explain that driver
  tracking starts after acceptance, rather than reporting missing GPS as an error.
  For assigned/onboard rides without valid driver coordinates, the screen explains
  that the driver must allow location access and keep Ride service or the active
  trip open in the foreground. Customer-phone location permission does not supply
  the driver's pin. GPS stops being shared after their ride
  completes; driver contact remains for payment. Quotes are estimates: regular final fares
  use planned road distance and actual elapsed ride time; shared fares use the
  customer's solo route/time refreshed at pickup, excluding others' detours,
  with the configured shared discount. No payment is requested before the ride
  finishes. Card is USA-only in a configured native build (not Expo Go); bank
  transfer uses existing active accounts and waits for Admin receipt verification;
  cash outside USA is confirmed by the assigned driver/Admin.
- Company drivers open the separate **Ride service** section on their delivery
  dashboard for ride offers, route and independent delivery/regular/shared
  toggles. Old drivers default to delivery-only. Offers have a three-minute
  claim/reject window (shorter if the configured pickup deadline ends); expired
  actions disappear and the backend reroutes. Claiming and product delivery
  dispatch cannot occupy the same vehicle. Keep the app in the foreground for
  GPS/polling. Background-location tracking is not implemented.
- The driver dashboard shows approval, online status, vehicle/seats and enabled
  ride modes, even if reporting GPS fails. Open **Ride assignments & route** to
  enable Regular/Shared rides and grant location permission. Admin must approve
  and enable the company driver and configure car/van passenger seats first.
  For simulator tests, set simulated GPS near the passenger pickup and use the
  same shopping region on both accounts. Dispatch requires GPS updated within
  two minutes and within the region's configured driver search radius.
- The active ride lists ordered pickups/dropoffs, passenger counts and contacts.
  Claiming a ride opens **DriverRideTrip**, a full-screen route map with the
  driver's live pin and remaining pickup/drop-off pins. **Open full-screen ride
  map** in assignments resumes an existing trip after leaving/restarting the app.
  The trip-details card can collapse to the side or bottom and expand again.
  It shows customer names, stop addresses, passenger counts and a call icon;
  phone numbers are not printed in the card. Calling opens the device dialer
  (this is UI concealment, not a masked/proxy telephone service).
  **Start trip to pickup** saves trip start without boarding passengers or
  starting the fare timer. The next-stop button confirms the complete passenger
  count for that stop, with pickup/drop-off progress totals. Stops remain ordered
  and retain fresh-GPS/300m server checks. After the last drop-off, return to ride
  assignments for payments. Termination and service settings remain there too.
  Android Expo Go uses its bundled Google Maps key and does not require the
  app's custom `MapsConfiguration` native module. Some SDK 57 Expo Go versions
  show a blank map with the Google logo because their bundled key fails
  authorization; see [expo/expo#49323](https://github.com/expo/expo/issues/49323).
  Changing this project's key or camera cannot repair Expo Go's native key.
  Use an installed development build to test with this project's key.
  Installed development/release builds require their native Google Maps key and
  module. Map configuration
  errors appear below the full-screen header rather than behind it. Driving
  polylines still require the backend Routes API configuration in either runtime.
  Missing stop coordinates no longer hide the whole ride map: available driver
  and road-route coordinates remain usable, and a visible warning identifies
  missing stop pins. The viewport fits after the native map is ready.
  After claiming, the driver sees a Google map of the remaining vehicle route,
  starting at driver GPS and including all pending shared-booking stops in order
  (`GET /rides/me/route`, assigned company driver only). It refreshes when the
  trip version changes, including after boarding/drop-off or a shared insertion.
  Google Maps can open the whole remaining route or just the next stop. Enable
  Routes API for the server's `GOOGLE_ROUTES_API_KEY`; if route lookup fails,
  stop pins, a retry action and external navigation remain available.
  Open external Google navigation to the next stop; return to confirm boarding
  or dropoff. The backend requires fresh GPS within 300m of that stop. **Stop
  shared intake** warns before immediately rerouting accepted riders not yet
  onboard; only existing passengers' dropoffs remain. Reopen explicitly to
  resume matching. Disabling shared mode also reroutes waiting riders.
- In **Ride assignments & route > Service preferences**, drivers select
  Motorcycle, Car, Van or Truck and submit a vehicle-change request. Their
  registered type is not changed until Admin verifies it. New passenger offers
  pause while verification is pending; selecting the current registered type
  cancels the request. Changes are blocked during rides, offers or deliveries.
  Motorcycle/truck remain delivery-only; car/van passenger seats require Admin.
- **Admin > Rides** lists requested/registered vehicles. Admin selects the
  verified type, configures car/van seats, and may assign **Economy** or
  **Comfort** to cars only. Unclassified cars cannot receive new class-selected
  bookings. Configure separate base/distance/minute rates and availability for
  **Economy**, **Comfort** and **Van** before using the comparison screen. The
  shared discount applies to each option's rates. Existing quotes keep their
  saved rates; Regular final fares use actual elapsed minutes, Shared uses the
  booking's solo route/time. **Admin > Vehicles & packaged sizes** also displays
  these same passenger controls under **Passenger car pricing: Economy & Comfort**,
  with separate Economy, Comfort and Van rates. **Save passenger vehicle prices**
  updates the shared ride configuration while retaining current ride activation,
  discounts and route limits. Its product-delivery pricing section and
  **Save vehicle configuration** remain separate and do not change passenger rates.
- Drivers can **Terminate booking** with a reason and fresh GPS without reaching
  the planned destination. Confirm this only after affected passengers have
  safely exited. The booking stays `terminated`, not completed; its unfinished
  stops and occupied seats are removed without ending other shared bookings.
  Payment is held for review in **Admin > Rides**. In the completed rides and
  terminated ride reviews list, Admin enters a review note and selects
  **Waive payment** to cancel the amount due, or enters an adjusted fare and
  selects **Resolve termination review** (zero also waives payment).
  Receipt confirmation is unavailable while review is required or payment is
  waived. Customers can pay a positive
  reviewed fare using the existing regional methods; no estimate is charged
  automatically. Normal pickup/drop-off confirmation still requires nearby GPS.
- **Admin > Rides** configures the region's fares, shared discount, maximum
  pickup wait / extra travel, search radius, verified company car/van passenger
  seats (excluding the driver), and bank/cash receipt verification. The driver
  chooses their service modes. Rides are initially disabled independently of
  per-store inventory; no automatic pricing or live activation occurs.
- Deploy the matching backend on MongoDB replica-set/Atlas infrastructure
  (transactional delivery/ride dispatch), enable Google Geocoding and Distance
  Matrix driving/traffic access, and test real GPS, pooled-route concurrency and
  native payments on staging before activating rides. Interrupted payments must
  resume the same booking; do not create another charge. Ride payments remain
  separate from product orders and delivery-income analytics.
- Rollout: deploy the backend and updated app, then save per-option rates in
  **Admin > Rides** and assign each car a class. No class price is auto-filled from
  legacy rates. Old in-progress bookings and payments remain finishable. Legacy
  clients cannot create unclassified quotes after class pricing is configured.
- Tests: `node --test scripts/rides.test.cjs scripts/companyDriverRefresh.test.cjs scripts/multiDeliveryCheckout.test.cjs`.

### Admin Features
- **Storefronts and per-store inventory**: Customers open the Stores badge beside
  Service Request to browse a store's catalog. AdminStore users open **My store &
  inventory** to edit their store name, address, coordinates, optional HTTPS logo
  URL, branches, prices, physical quantities and low-stock thresholds. Stores
  choose existing catalog products and categories; removing a store listing
  never deletes the shared product. Only Admin manages categories.
- **Inventory rollout**: Deploy the matching backend from `D:\MERN_COURSE\backend`
  before using these screens. In Admin > AdminStores, select the region's default
  store and run **Migrate existing inventory** once, after completing/cancelling
  active orders. Stock moves to each product's linked approved store; unlinked
  products move to the selected default. Stock is never copied to every store.
  Store editing is blocked until migration succeeds. Before migration, existing
  checkout and fulfillment behavior remains unchanged.
- **Inventory-based fulfillment**: Main-catalog stock is the sum of unreserved
  inventory across approved, open stores. Legacy checkout requires one store to
  fulfill the entire cart at its quoted prices. With multi-delivery enabled,
  products and quantities can be sourced from multiple price-matching stores,
  nearest to each destination, with the default store as last fallback.
  Storefront items stay within their selected store's branch family.
- **Multiple destinations and vehicle checkout**: Enable this per region under
  **Admin > Vehicles**, after migrating per-store inventory. Set usable vehicle
  payload, cargo volume/dimensions, base fees and distance rates. Optionally
  configure each product's packaged weight/dimensions for domestic delivery.
  Product editing links to these size controls. Checkout then supports mixed
  storefront/main-catalog carts, saved
  and editable addresses, and splitting units of one product across addresses.
  Under **Saved delivery addresses**, use **Delete saved address** to remove an
  entry from your account after confirmation. Existing orders and addresses
  already selected for the current checkout are unchanged.
  The address editor includes search-as-you-type place suggestions using the same
  server-backed Places search as rides. Selecting a place fills its address and
  location while preserving the label, unit and recipient phone; manual edits to
  the street, city, postal code or country clear that selected location.
  The street is not repeated when Google's place name is the same address with
  different capitalization, punctuation, common street abbreviations or
  directional abbreviations (for example, `810 W Grace St` / `810 West Grace Street`).
  New addresses default to the checkout destination country. Postal code is
  hidden and not required for Ethiopia (including `Ethio` and `ET`); it remains
  required for other countries. Manual address entry is still available.
  Customers see configured packaged weight and dimensions; missing values show
  **Not available currently**. Missing measurements do not block domestic quoting,
  but require the customer to choose a vehicle manually before continuing.
  Known measurements still constrain vehicle options; full capacity cannot be
  verified for unmeasured items. Until a vehicle is chosen, totals show estimates
  using the lowest offered delivery fee. Admin can leave measurements blank or
  configure them individually. International US-to-Ethiopia shipping still
  requires complete measurements to calculate actual/volumetric shipping charges.
  Each pickup/destination pair has its own order and vehicle choices, with an
  automatic recommendation when measurements are complete. Road fees use miles
  in USA and kilometers in Ethiopia.
  Recommendations check total weight/volume and individual parcel dimensions;
  they are load estimates, not a three-dimensional packing guarantee.
- **Combined payments and recovery**: All delivery stock is reserved in one
  transaction before card payment. Quotes last ten minutes and unpaid holds
  fifteen minutes. Card payment is USA-only and requires a native build, matching
  Stripe keys and the existing backend live-key configuration. Bank transfer
  provides account details after reservation and accepts a reference before the
  hold expires; Admin verifies the combined funds under **Admin > Payments**.
  Cash remains available outside USA and is collected per delivery. Open
  **Cart > My multi-delivery checkouts** to recover interrupted payment, inspect
  or track individual deliveries, and cancel before a driver is assigned.
  Never create a second payment after an uncertain result. If a bank hold
  expires after sending money, contact support with the transfer reference.
- **Partial refunds**: Cancelling one delivery leaves siblings active. Paid card
  cancellations are reconciled by the backend scan with idempotent refunds;
  Admin can retry failed refunds under **Payments**. Bank refunds require Admin
  to return funds manually and record the refund reference. Grouped orders cannot
  have payment amounts changed through the legacy order editor. Admin can delete
  an individual grouped delivery from Order Management after it is cancelled and
  its refund is complete or not required, or after delivery/store fulfillment is
  completed.
  Delivery fees stay fixed if a store rejects/times out, while actual route
  distance is refreshed for the replacement pickup.
- **Store assignments**: Open **Store assignments** to accept and prepare or reject
  an order. Each assignment has a five-minute acceptance deadline. The backend's
  30-second scan reroutes unanswered requests; rejection reroutes immediately.
  No driver is dispatched until acceptance. If no matching store remains, the
  order enters a persistent default-store fallback list without holding stock.
  The configured inventory default (or nearest/stable approved company store)
  receives it even when closed; **Store assignments** offers **Claim & prepare**,
  **Reroute**, or final **Reject** for Admin review, without a five-minute expiry.
  Claim requires an approved open store and matching whole-order stock/prices;
  it atomically reserves inventory. Selected storefront orders stay within their
  store family. Checkout stock/payment guards remain unchanged.
  Reservations move with the order, release on cancellation and consume physical
  stock once on delivery. Order details retain the assigned store's ID, name,
  address, logo and new orders' purchase prices.
- **Product Management**: Add, edit, delete products
- **Category Management**: Manage product categories
- **Order Management**: View all orders, update status, delete orders. Grouped
  deliveries can be deleted individually after cancellation and refund settlement,
  or after delivery/store fulfillment is completed. Deleting an order does not issue a refund.
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
  receives an unassigned offer to claim, reroute, or reject for other drivers. When no
  currently eligible company driver remains, an approved default company driver
  still receives a persistent list, even offline, busy or suspended. Existing
  offers stay visible when availability or proximity changes. Claim enforces
  approval, availability, suspension, service/ride conflicts, vehicle and capacity
  checks. Claimed deliveries enter the active queue; **Reroute** and **Reject**
  exclude the responding driver and return the entire unclaimed request to other
  eligible drivers. With no alternative, it stays queued until one is available.
  Reject additionally flags the request for non-blocking Admin review; Reroute
  does not. Neither action cancels payment, deletes the order or issues a refund.
  Driver lists refresh every
  15 seconds while focused.
  When company stores cannot be ranked by proximity, an eligible preferred
  company store or a stable available default is used instead of leaving pickup
  unassigned. Closed or unapproved stores are not eligible.
  Closed approved stores may receive fallback requests but cannot claim them
  until reopened. Deploy the matching backend in `D:\MERN_COURSE\backend` and
  rebuild/update this app before testing these actions against the production API.
- **Delivery Claim Deadline**: Claim/reject actions stop spinning after a
  20-second end-to-end deadline, including storage reads and request interceptors,
  in both Ethiopia and USA. A timed-out claim refreshes offers and Your Route;
  check Your Route before retrying because the server may have saved the assignment.
  Claim failures show the server or connection error instead of hiding it behind
  a generic message. The backend must release assignment locks before waiting on
  partner-driver decisions and must not wait for push notifications to finish a claim.
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

Company-driver refresh and claim-deadline regression tests:

```bash
node --test scripts/companyDriverRefresh.test.cjs
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

For Google Play installs, add the **app signing key certificate SHA-1** from
Play Console > App integrity to the key's Android application restrictions,
paired with `com.addugenet.eshop`. The upload certificate and local debug
certificate do not authorize a Play-signed APK. Keep separate entries for the
development and Play certificates. Check every EAS environment used for store
builds: `production` uses the production environment, while `internal-testing`
uses preview.

When a Play build shows only the Google logo, connect the phone with USB
debugging authorized and inspect the installed APK rather than assuming that
local configuration matches it:

```powershell
adb devices -l
adb shell dumpsys package com.addugenet.eshop |
  Select-String 'versionCode=|versionName=|installerPackageName='
adb shell pm path com.addugenet.eshop
# Pull the base.apk path returned above, then use your SDK build-tools version.
adb pull "<installed-base.apk-path>" "$env:TEMP\easy-shopping-play.apk"
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify --print-certs "$env:TEMP\easy-shopping-play.apk"
```

Use **Signer #1 certificate SHA-1**, not the Source Stamp Signer fingerprint.
Confirm Maps SDK for Android is enabled and billing is active in the key's
Google Cloud project. After saving a missing certificate restriction, allow
several minutes for propagation and fully close/reopen the Play-installed app.
This console-only correction does not require a new build if the installed
APK already embeds the correct key. Changing the embedded key or native code
does require rebuilding and installing a new release. Verify streets/tiles
first, then customer Directions and backend driver Routes separately.

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
For Android Expo Go, check the bundled-key issue above before changing your
project's credentials. To test locally with your own configured key, enable USB
debugging, connect the phone, confirm it appears as authorized in `adb devices`,
and run `npm run android`. Open the installed AdduGenet EShop development app,
not Expo Go. For later JavaScript sessions, use `npm run start:dev-client`.
The debug certificate must be authorized for `com.addugenet.eshop` in the Android
Maps key restrictions. A local native build must finish successfully before a
Metro reload can use this configuration.
Ride map backgrounds use `StyleSheet.absoluteFill`, supported by this React
Native version; the removed `absoluteFillObject` leaves the background without
absolute positioning and can collapse the native map to zero height. Ride camera
commands wait for both native map readiness and a nonzero width/height.
A visible Google logo after this layout fix
does not prove tile authorization; check native logs for `Authorization failure`
and authorize the exact package/certificate pair printed there.
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
Company-driver dashboard refreshes use 20-second request timeouts and reject
overlapping refreshes. Refresh Data remains disabled while loading and becomes
available again after success or failure; failed delivery requests show an error
instead of leaving the spinner running indefinitely.
Validate refresh recovery with `node --test scripts/companyDriverRefresh.test.cjs`.
The AdminDriver dashboard displays backend dispatch-eligibility guidance, and
keeps offer/route request errors visible rather than presenting failures as empty
queues. The AdminDrivers management page shows approval, availability and suspension;
approved, non-suspended offline drivers have an **Enable availability** action.
Availability does not override capacity or create an active route before claiming.
Suspended company drivers also have an administrator-only **Reinstate driver**
action with confirmation, using the existing backend reinstatement endpoint.
The driver dashboard displays the saved suspension reason when present.
Manual suspensions are never cleared automatically.
Claim/reject requests have 20-second timeouts and an in-flight guard. If a claim
cannot be confirmed, the dashboard reloads offers and routes because assignment
may already have been saved; inspect Your Route before trying again.
Country switching refreshes the authenticated profile in the selected database
before remounting navigation, so AdminDriver and AdminStore tabs reflect that
region's account permissions. A combined company driver/store-owner account can
see both tabs. If profile refresh fails, stale permissions are cleared and the
switch reports an error; sign in again for the selected region.
Validate with `node --test scripts/regionProfile.test.cjs`.

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
- **App legal links**: Login, registration, and profile use `assets/common/legalLinks.js`
  for `https://addugeneteshop.com/privacy.html` and
  `https://addugeneteshop.com/terms.html`. Profile account-deletion instructions
  use `https://addugeneteshop.com/account-deletion.html`. Deploy the website's
  public legal pages before releasing the app update; local website files alone
  do not make these URLs live.
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
