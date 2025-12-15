import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "../../store/cartSlice"; // Import the cart slice reducer

export const store = configureStore({
  reducer: {
    // Add your reducers here
    cart: cartReducer, // This is the cart slice reducer
  }
});
