import {createSlice } from '@reduxjs/toolkit';
import { DEFAULT_DB_NAME, sanitizeDatabaseName } from '../assets/common/databaseConfig';
import { cartItemKey } from '../assets/common/cartIdentity';

// This code defines a Redux slice for managing cart items in a shopping application.

const cartSlice = createSlice({
  name: 'cart',
  initialState:{
    _id: null, // This can be used to store a unique identifier for the cart
    cartItems: [], // This will hold the items added to the cart
    completedCheckouts: [],
    pendingCheckouts: [],
  },
  reducers: {
    addToCart: (state, action) => {
      const productId = action.payload._id || action.payload.id;
      const itemDatabaseName = sanitizeDatabaseName(
        action.payload.databaseName || action.payload.dbName || DEFAULT_DB_NAME
      );
      if (!productId) return;

      // Check if the item already exists in the cart
      const existingItem = state.cartItems.find(
        (item) =>
          cartItemKey(item) === cartItemKey(action.payload)
      );
      // If it exists, update the quantity
      if (existingItem) {
        existingItem.quantity += 1
      }else {
        // If it doesn't exist, add the new item to the cart. ...action.payload, 
        state.cartItems.push({
          ...action.payload,
          id: productId,
          _id: productId,
          quantity: 1,
          databaseName: itemDatabaseName,
        });
      }
    },
    deductQuantity: (state, action) => {
      const productId = action.payload._id || action.payload.id;
      const hasDatabaseName =
        typeof action.payload.databaseName === 'string' ||
        typeof action.payload.dbName === 'string';
      const itemDatabaseName = hasDatabaseName
        ? sanitizeDatabaseName(action.payload.databaseName || action.payload.dbName)
        : null;
      const existingItem = state.cartItems.find(
        (item) =>
          (action.payload.cartKey ? cartItemKey(item) === action.payload.cartKey :
          item.id === productId &&
          (!itemDatabaseName ||
            sanitizeDatabaseName(item.databaseName || item.dbName || DEFAULT_DB_NAME) ===
              itemDatabaseName))
      );
      if (existingItem && existingItem.quantity > 1) {
        existingItem.quantity -= 1; // Decrease quantity by 1
      } else if (existingItem && existingItem.quantity === 1) {
        // If quantity is 1, remove the item from the cart
        state.cartItems = state.cartItems.filter((item) => cartItemKey(item) !== cartItemKey(existingItem));
      }
    },
    clearCart: (state) => {
      state.cartItems = []
      state.pendingCheckouts = [];
    },
    beginCheckout: (state, action) => {
      if (!state.pendingCheckouts.includes(action.payload.id)) state.pendingCheckouts.push(action.payload.id);
    },
    completeCheckout: (state, action) => {
      if (state.completedCheckouts.includes(action.payload.id) || !state.pendingCheckouts.includes(action.payload.id)) return;
      for (const purchased of action.payload.items) {
        const item = state.cartItems.find((entry) => cartItemKey(entry) === purchased.key);
        if (item) item.quantity = Math.max(0, item.quantity - purchased.quantity);
      }
      state.cartItems = state.cartItems.filter((item) => item.quantity > 0);
      state.completedCheckouts.push(action.payload.id);
      state.pendingCheckouts = state.pendingCheckouts.filter((id) => id !== action.payload.id);
    },
  },
});

export const { addToCart, clearCart, deductQuantity, beginCheckout, completeCheckout } = cartSlice.actions;
export default cartSlice.reducer;
