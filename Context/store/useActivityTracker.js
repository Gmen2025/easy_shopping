import { useContext, useEffect, useRef } from "react";
import { GestureResponderEvent } from "react-native";
import { AuthContext } from "./Auth";

/**
 * Hook to track user activity and update last activity timestamp
 * Call this in screens where you want to track user interactions
 * 
 * Usage:
 * const { trackActivity } = useActivityTracker();
 * 
 * Then attach trackActivity to interactive elements:
 * <TouchableOpacity onPress={() => { trackActivity(); handlePress(); }}>
 */
export const useActivityTracker = () => {
  const { updateLastActivity } = useContext(AuthContext);
  const lastUpdateRef = useRef(0);
  
  // Throttle updates to every 5 seconds to avoid excessive AsyncStorage writes
  const THROTTLE_MS = 5000;

  const trackActivity = () => {
    const now = Date.now();
    if (now - lastUpdateRef.current > THROTTLE_MS) {
      lastUpdateRef.current = now;
      if (updateLastActivity) {
        updateLastActivity().catch((error) => {
          console.warn("Failed to track activity:", error);
        });
      }
    }
  };

  return { trackActivity };
};
