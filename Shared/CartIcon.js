import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge } from 'react-native-paper';
import { useSelector } from 'react-redux';

const CartIcon = () => {
  const cartItems = useSelector((state) => state.cart.cartItems);
  const totalCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

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