import { Platform } from "react-native";

// Environment configuration
const ENV = 'production'; // Change to 'development' for local testing

// Production API URL (deployed on Render)
const PRODUCTION_URL = 'https://easy-shop-server-wldr.onrender.com/api/v1/';

// Development API URLs
const DEVELOPMENT_URLS = {
  android: 'http://10.0.2.2:3001/api/v1/', // Android emulator
  ios: 'http://192.168.1.6:3001/api/v1/',     // iOS simulator or real device
};

let baseUrl = '';

if (ENV === 'production') {
  baseUrl = PRODUCTION_URL;
} else {
  // Development mode - use platform-specific URLs
  if (Platform.OS === 'android') {
    baseUrl = DEVELOPMENT_URLS.android;
  } else {
    baseUrl = DEVELOPMENT_URLS.ios;
  }
}

export default baseUrl;
