import {createSlice } from '@reduxjs/toolkit';

// This code defines a Redux slice for managing cart items in a shopping application.

const cartSlice = createSlice({
  name: 'cart',
  initialState:{
    _id: null, // This can be used to store a unique identifier for the cart
    cartItems: [], // This will hold the items added to the cart
  },
  reducers: {
    addToCart: (state, action) => {
      const productId = action.payload._id || action.payload.id;
      if (!productId) return;

      // Check if the item already exists in the cart
      const existingItem = state.cartItems.find(item => item.id === productId);
      // If it exists, update the quantity
      if (existingItem) {
        existingItem.quantity += 1
      }else {
        // If it doesn't exist, add the new item to the cart. ...action.payload, 
        state.cartItems.push({ ...action.payload, id: productId, _id: productId, quantity: 1 });
      }
    },
    deductQuantity: (state, action) => {
      const productId = action.payload._id || action.payload.id;
      const existingItem = state.cartItems.find(item => item.id === productId);
      if (existingItem && existingItem.quantity > 1) {
        existingItem.quantity -= 1; // Decrease quantity by 1
      } else if (existingItem && existingItem.quantity === 1) {
        // If quantity is 1, remove the item from the cart
        state.cartItems = state.cartItems.filter(item => item.id !== productId);
      }
    },
    clearCart: (state) => {
      state.cartItems = []
    },
  },
});

export const { addToCart, clearCart, deductQuantity } = cartSlice.actions;
export default cartSlice.reducer;
