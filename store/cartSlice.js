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
      // Check if the item already exists in the cart
      const existingItem = state.cartItems.find(item => item.id === action.payload._id);
      // If it exists, update the quantity
      if (existingItem) {
        existingItem.quantity += 1
      }else {
        // If it doesn't exist, add the new item to the cart. ...action.payload, 
        state.cartItems.push({id: action.payload._id, quantity: 1, ...action.payload });
      }
    },
    deductQuantity: (state, action) => {
      const existingItem = state.cartItems.find(item => item.id === action.payload._id);
      if (existingItem && existingItem.quantity > 1) {
        existingItem.quantity -= 1; // Decrease quantity by 1
      } else if (existingItem && existingItem.quantity === 1) {
        // If quantity is 1, remove the item from the cart
        state.cartItems = state.cartItems.filter(item => item.id !== action.payload._id);
      }
    },
    clearCart: (state) => {
      state.cartItems = []
    },
  },
});

export const { addToCart, clearCart, deductQuantity } = cartSlice.actions;
export default cartSlice.reducer;
