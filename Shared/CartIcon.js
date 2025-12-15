import React from 'react';
import {StyleSheet, View } from 'react-native';
import { Badge } from 'react-native-paper';
import { Icon } from 'react-native-vector-icons/FontAwesome';
import { useSelector } from 'react-redux';



const CartIcon = ({ color }) => {
  const cartItems = useSelector((state) => state.cart.cartItems);
  const totalCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <View style={{ width: 30, height: 30 }}>
      {totalCount > 0 && (
        <Badge style={styles.badge}>{totalCount}</Badge>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -35,
    right: -15,
    backgroundColor: 'red',
    color: 'white',
    fontSize: 12,
    zIndex: 1,
  },
});

export default CartIcon;