import { useDispatch } from "react-redux";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";
import { addToCart } from "../../store/cartSlice";

export const apiRequest = async (resource, path, { method = "get", data, token, timeout = 20000 } = {}) => {
  const databaseName = await getDatabaseNameFromStorage();
  const sessionToken = token || await AsyncStorage.getItem("token");
  const response = await axios({
    url: `${baseUrl}${resource}/${path}`, method, data, timeout,
    headers: { "x-database-name": databaseName, ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
  });
  return response.data;
};
export const storeRequest = (path, options) => apiRequest("stores", path, options);

export const getStorefrontScope = (items) => {
  const scopes = new Set(items.map((item) => item.storefrontId || ""));
  if (scopes.size > 1) throw new Error("Use multi-delivery checkout for products from different storefronts.");
  return items[0]?.storefrontId || null;
};

export const useStoreCart = () => {
  const dispatch = useDispatch();
  return (product) => {
    dispatch(addToCart(product));
    return true;
  };
};
