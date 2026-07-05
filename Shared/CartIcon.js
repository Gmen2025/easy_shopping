import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge } from 'react-native-paper';
import { useSelector } from 'react-redux';
import {
  DEFAULT_DB_NAME,
  getDatabaseNameFromStorage,
  sanitizeDatabaseName,
} from '../assets/common/databaseConfig';

const CartIcon = () => {
  const cartItems = useSelector((state) => state.cart.cartItems);
  const [selectedDatabase, setSelectedDatabase] = useState(DEFAULT_DB_NAME);

  useEffect(() => {
    let isMounted = true;

    const loadSelectedDatabase = async () => {
      const dbName = await getDatabaseNameFromStorage();
      if (isMounted) {
        setSelectedDatabase(sanitizeDatabaseName(dbName));
      }
    };

    loadSelectedDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalCount = useMemo(() => {
    return cartItems
      .filter(
        (item) =>
          sanitizeDatabaseName(item.databaseName || item.dbName) === selectedDatabase
      )
      .reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cartItems, selectedDatabase]);

  if (totalCount === 0) return null;

  return (
    <Badge style={styles.badge}>{totalCount}</Badge>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: '#e53935',
    color: 'white',
    fontSize: 10,
    zIndex: 10,
    minWidth: 18,
    height: 18,
    lineHeight: 18,
  },
});

export default CartIcon;