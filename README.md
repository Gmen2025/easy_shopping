# AdduGenet EShop - Mobile E-Commerce Application

A full-featured React Native e-commerce mobile application built with Expo, featuring secure payments, order management, and admin capabilities.

## 📱 Features

### Customer Features
- **Product Browsing**: Browse products by category with search and filter
- **Shopping Cart**: Add, remove, and manage cart items
- **Secure Checkout**: Multi-step checkout with address and payment
- **Multiple Payment Options**: 
  - Credit/Debit cards via Stripe
  - Telebirr mobile money
- **User Accounts**: Registration, login, email verification
- **Order Tracking**: View order history and status
- **Profile Management**: Edit profile and manage addresses
- **Password Recovery**: Forgot password functionality

### Admin Features
- **Product Management**: Add, edit, delete products
- **Category Management**: Manage product categories
- **Order Management**: View all orders, update status, delete orders
- **Auto Cleanup**: Automatic deletion of old delivered orders (2+ months)

### Security Features
- JWT authentication
- Email verification
- Password reset via email
- Secure payment processing
- Cart persistence per user
- HTTPS encryption

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
git clone https://github.com/YOUR_USERNAME/easy_shopping.git
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
STRIPE_SECRET_KEY=your_stripe_key
USE_MOCK_TELEBIRR=true
TELEBIRR_PRIVATE_KEY=your_telebirr_key

# URLs
FRONTEND_URL=your_frontend_url
NOTIFY_URL=your_webhook_url
REDIRECT_URL=your_redirect_url
```

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

## 🔮 Future Enhancements

- [ ] Push notifications
- [ ] Wishlist functionality
- [ ] Product reviews and ratings
- [ ] Advanced search filters
- [ ] Multiple language support (Amharic, Oromo)
- [ ] Real-time chat support
- [ ] Loyalty program
- [ ] Social media integration

## 📝 Changelog

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

- **Your Name** - *Initial work* - [YourGitHub](https://github.com/yourusername)

## 🙏 Acknowledgments

- React Native community
- Expo team
- All contributors and testers

---

**Built with ❤️ in Ethiopia**

*For the latest updates and documentation, visit our [GitHub repository](https://github.com/YOUR_USERNAME/easy_shopping)*

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

