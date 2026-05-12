import { useEffect, useState } from "react";
import {
  DEFAULT_DB_NAME,
  getDatabaseNameFromStorage,
  sanitizeDatabaseName,
} from "./databaseConfig";

const CURRENCY_BY_DB = {
  E_ShopUSA: { symbol: "$", code: "USD" },
  E_Shopping: { symbol: "ETB", code: "ETB" },
  E_Shopping_2: { symbol: "ETB", code: "ETB" },
};

export const getCurrencyConfigForDatabase = (databaseName) => {
  const safeDatabaseName = sanitizeDatabaseName(databaseName || DEFAULT_DB_NAME);
  return CURRENCY_BY_DB[safeDatabaseName] || CURRENCY_BY_DB[DEFAULT_DB_NAME];
};

export const useCurrency = () => {
  const [currency, setCurrency] = useState(
    getCurrencyConfigForDatabase(DEFAULT_DB_NAME)
  );

  useEffect(() => {
    let isMounted = true;

    const loadCurrency = async () => {
      const dbName = await getDatabaseNameFromStorage();
      if (isMounted) {
        setCurrency(getCurrencyConfigForDatabase(dbName));
      }
    };

    loadCurrency();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatPrice = (value) => {
    const amount = Number(value);
    if (Number.isNaN(amount)) {
      return `${currency.symbol} 0.00`;
    }

    return `${currency.symbol} ${amount.toFixed(2)}`;
  };

  return {
    currencySymbol: currency.symbol,
    currencyCode: currency.code,
    formatPrice,
  };
};
