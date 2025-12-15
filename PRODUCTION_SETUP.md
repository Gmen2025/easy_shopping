# Production Deployment Configuration Guide

## ✅ Completed Steps

### Frontend Configuration
- **baseUrl.js updated** with production/development environment switching
- Production API URL: `https://easy-shop-server-wldr.onrender.com/api/v1/`
- Environment toggle: Change `ENV` variable in `assets/common/baseUrl.js`

## 🔧 Backend Configuration (Render Dashboard)

### Required Environment Variables

Login to your Render dashboard and set these environment variables for your backend service:

#### 1. Frontend & Redirect URLs
```
FRONTEND_URL=your-deployed-frontend-url
```
**Examples:**
- Expo Go/TestFlight: `exp://your-app-url`
- Standalone app: `myapp://` (custom URL scheme)
- Web version: `https://your-domain.com`

#### 2. Telebirr Webhook Configuration
```
NOTIFY_URL=https://easy-shop-server-wldr.onrender.com/api/v1/telebirr/webhook
REDIRECT_URL=your-frontend-payment-success-page
```

**Note:** `NOTIFY_URL` should already be set correctly to your Render backend URL.

#### 3. Telebirr Production Settings (When Ready)
```
USE_MOCK_TELEBIRR=false
TELEBIRR_PRIVATE_KEY=your-actual-telebirr-private-key
TELEBIRR_APP_ID=your-telebirr-app-id
TELEBIRR_MERCHANT_ID=your-merchant-id
```

**Current Setup:** Keep `USE_MOCK_TELEBIRR=true` for testing until you have real Telebirr credentials.

#### 4. Other Important Variables
Ensure these are already set:
```
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret-key
STRIPE_SECRET_KEY=your-stripe-secret-key (if using Stripe)
NODE_ENV=production
PORT=3001
```

---

## 📱 Frontend Deployment Options

### Option 1: Expo Go (Development/Testing)
**Current Status:** ✅ Ready to use
- Open Expo Go app on your phone
- Scan QR code from `npx expo start`
- Works with production API immediately

### Option 2: Expo EAS Build (Recommended for Production)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

### Option 3: Standalone APK/IPA
Follow the App Store/Play Store guides provided earlier.

---

## 🧪 Testing Production API

### Step 1: Switch to Production Mode
In `assets/common/baseUrl.js`:
```javascript
const ENV = 'production'; // Currently set to production
```

### Step 2: Restart Expo
```bash
npx expo start --clear
```

### Step 3: Test Key Features
- [ ] User Registration
- [ ] User Login
- [ ] Browse Products
- [ ] Add to Cart
- [ ] Checkout Process
- [ ] Telebirr Payment (mock mode)
- [ ] Order Creation
- [ ] Admin Dashboard
- [ ] Order Management

### Step 4: Monitor Backend Logs
In Render dashboard:
1. Go to your service
2. Click "Logs" tab
3. Watch for errors during testing

---

## 🔄 Switching Between Environments

### Development Mode (Local Backend)
```javascript
// In assets/common/baseUrl.js
const ENV = 'development';
```

Then run:
```bash
npx expo start --clear
```

### Production Mode (Render Backend)
```javascript
// In assets/common/baseUrl.js
const ENV = 'production';
```

Then run:
```bash
npx expo start --clear
```

---

## 🚀 Telebirr Production Checklist

### Before Going Live with Real Telebirr:

1. **Obtain Telebirr Credentials**
   - [ ] Register as Telebirr merchant
   - [ ] Receive `APP_ID`
   - [ ] Receive `MERCHANT_ID`
   - [ ] Receive private key file
   - [ ] Get test credentials first

2. **Update Backend Environment Variables**
   ```
   USE_MOCK_TELEBIRR=false
   TELEBIRR_PRIVATE_KEY=<paste-full-private-key-here>
   TELEBIRR_APP_ID=your-app-id
   TELEBIRR_MERCHANT_ID=your-merchant-id
   TELEBIRR_API_URL=<production-telebirr-api-url>
   ```

3. **Test in Telebirr Sandbox**
   - Test small transactions
   - Verify webhook callbacks
   - Check transaction status updates
   - Test refund flow (if applicable)

4. **Production Launch**
   - [ ] Update `USE_MOCK_TELEBIRR=false`
   - [ ] Monitor first few transactions closely
   - [ ] Set up error alerting
   - [ ] Have customer support ready

---

## 🔍 Monitoring & Debugging

### Check API Connection
Test the production API:
```bash
curl https://easy-shop-server-wldr.onrender.com/api/v1/
```

### Common Issues

#### Issue: "Network Error" or "Cannot connect to server"
**Solution:**
- Verify backend is running in Render dashboard
- Check if Render service is awake (free tier sleeps after inactivity)
- First API call may take 30-60 seconds to wake up free tier

#### Issue: Telebirr payment fails
**Solution:**
- Check `USE_MOCK_TELEBIRR=true` is set (for testing)
- Review Render logs for error messages
- Verify `NOTIFY_URL` is set correctly

#### Issue: Orders not saving
**Solution:**
- Check `MONGO_URI` is set correctly
- Verify database connection in Render logs
- Check network connectivity

---

## 📊 Production Monitoring

### Render Dashboard Metrics
- **CPU Usage:** Should stay under 50%
- **Memory:** Monitor for memory leaks
- **Response Time:** Should be < 2 seconds
- **Error Rate:** Should be < 1%

### Set Up Alerts
In Render dashboard:
1. Go to service settings
2. Add notification webhooks
3. Set up email alerts for:
   - Service crashes
   - High error rates
   - Memory issues

---

## 🔐 Security Checklist

- [ ] All environment variables set correctly
- [ ] JWT_SECRET is strong and unique
- [ ] Database has authentication enabled
- [ ] HTTPS is enforced (automatic with Render)
- [ ] API rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] CORS configured properly
- [ ] Sensitive data not logged

---

## 📝 Next Steps

1. **Immediate:**
   - ✅ Frontend now uses production API
   - Test all features with production backend
   - Monitor Render logs during testing

2. **Short-term (1-2 weeks):**
   - Deploy frontend to stores (Android/iOS)
   - Set up proper domain (optional)
   - Configure custom URL scheme for deep linking

3. **Before Production Launch:**
   - Complete Telebirr integration with real credentials
   - Add error tracking (Sentry, LogRocket)
   - Set up monitoring/alerting
   - Prepare customer support documentation

---

## 🆘 Support Resources

- **Render Documentation:** https://render.com/docs
- **Expo Documentation:** https://docs.expo.dev
- **Telebirr Integration:** Contact Telebirr support
- **Backend Repository:** Check your GitHub repo for backend code

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| Production API | `https://easy-shop-server-wldr.onrender.com/api/v1/` |
| Environment Toggle | `assets/common/baseUrl.js` → `ENV` variable |
| Render Dashboard | https://dashboard.render.com |
| Expo Dashboard | https://expo.dev |
| Current Status | ✅ Production API configured |

---

*Last Updated: November 16, 2025*
