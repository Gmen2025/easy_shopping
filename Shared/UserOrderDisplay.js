import React, { useState, useContext, useEffect } from "react";
import { View, Text, ScrollView, Button } from "react-native";
import { Avatar } from "react-native-paper";
import axios from "axios";
import baseUrl from "../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthContext } from "../Context/store/Auth";

const UserOrderDisplay = (props) => {
  // State to hold user order data
  const [userOrderData, setUserOrderData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const context = useContext(AuthContext);

  useEffect(() => {
    fetchOrderItems();
  }, [context.user]);

  //API call to fetch order items details
  const fetchOrderItems = async () => {
    userId = context.user?._id || props.user?._id;
    const tokenValue = await AsyncStorage.getItem("token");
    console.log("Fetch order items for user:", userId);
    try {
      const response = await axios.get(
        `${baseUrl}orders/get/userorders/${userId}`,
        {
          headers: { Authorization: `Bearer ${tokenValue}` },
        }
      );
      //console.log(response.data);
      // Or log all at once
      setUserOrderData(response.data);
      setCurrentIndex(0);
      //console.log("User order data:", response.data);
      console.log("User order data variable:", userOrderData);
      // console.log("First orderItems:", userOrderData[0].orderItems);
      // console.log("First orderItems image:", userOrderData[0].orderItems[0].product.image);
      // console.log("First orderItems name:", userOrderData[0].orderItems[0].product.name);
      // console.log("First orderItems quantity:", userOrderData[0].orderItems[0].quantity);
      // console.log("First orderItems price:", userOrderData[0].orderItems[0].product.price);
      // Log all order items
      // const allOrderItems = response.data.map(order => order.orderItems);
      // console.log("All orderItems:", allOrderItems);
      // console.log("First orderItems:", allOrderItems[0][0].product);
      // console.log("First orderItems image:", allOrderItems[0][0].product.image);
      // console.log("First orderItems name:", allOrderItems[0][0].product.name);
      // console.log("First orderItems quantity:", allOrderItems[0][0].quantity);
      // console.log("First orderItems:", allOrderItems[0][0].product.price);
    } catch (error) {
      console.log("Error fetching order items:", error);
    }
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev < userOrderData.length - 1 ? prev + 1 : prev
    );
  };

  const currentOrder =
    Array.isArray(userOrderData) && userOrderData.length > 0
      ? userOrderData[currentIndex]
      : null;

  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: "bold", margin: 10 }}>
        Orders for Current User
      </Text>
      <ScrollView>
        {/* {Array.isArray(userOrderData) && userOrderData.length > 0 ? (
          <View key={userOrderData[0]._id} style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
              Order #{userOrderData[0]._id}
            </Text>
            {Array.isArray(userOrderData[0].orderItems) &&
            userOrderData[0].orderItems.length > 0 ? (
              userOrderData[0].orderItems.map((item, idx) => (
                <View
                  key={item._id || idx}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Avatar.Image
                    size={40}
                    source={{
                      uri:
                        item.product?.image ||
                        "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                    }}
                    style={{ backgroundColor: "#eee" }}
                  />
                  <View style={{ marginLeft: 10 }}>
                    <Text>{item.product?.name}</Text>
                    <Text>Qty: {item.quantity}</Text>
                    <Text>
                      $
                      {item.product?.price?.toFixed
                        ? item.product.price.toFixed(2)
                        : item.product?.price}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text>No items in this order.</Text>
            )}
          </View>
        ) : (
          <Text style={{ margin: 10 }}>No orders for this user.</Text>
        )} */}
        {Array.isArray(userOrderData) && userOrderData.length > 0 ? (
          userOrderData.map((order) => (
            <View key={order._id} style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
                Order #{order._id}
              </Text>
              {Array.isArray(order.orderItems) &&
              order.orderItems.length > 0 ? (
                order.orderItems.map((item, idx) => (
                  <View
                    key={item._id || idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Avatar.Image
                      size={40}
                      source={{
                        uri:
                          item.product?.image ||
                          "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                      }}
                      style={{ backgroundColor: "#eee" }}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <Text>{item.product?.name}</Text>
                      <Text>Qty: {item.quantity}</Text>
                      <Text>
                        $
                        {item.product?.price?.toFixed
                          ? item.product.price.toFixed(2)
                          : item.product?.price}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text>No items in this order.</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={{ margin: 10 }}>No orders for this user.</Text>
        )}
      </ScrollView>
    </View>
  );

};


//   return (
//     <View>
//       <Text style={{ fontSize: 16, fontWeight: "bold", margin: 10 }}>
//         Orders for Current User
//       </Text>
//       <View
//         style={{
//           flexDirection: "row",
//           justifyContent: "center",
//           marginBottom: 10,
//         }}
//       >
//         <Button
//           title="Prev"
//           onPress={handlePrev}
//           disabled={currentIndex === 0}
//         />
//         <Text style={{ marginHorizontal: 20, alignSelf: "center" }}>
//           {userOrderData.length > 0
//             ? `Order ${currentIndex + 1} of ${userOrderData.length}`
//             : ""}
//         </Text>
//         <Button
//           title="Next"
//           onPress={handleNext}
//           disabled={
//             currentIndex === userOrderData.length - 1 ||
//             userOrderData.length === 0
//           }
//         />
//       </View>
//       <ScrollView>
//         {currentOrder ? (
//           <View key={currentOrder._id} style={{ marginBottom: 16 }}>
//             <Text style={{ fontWeight: "bold", marginBottom: 5 }}>
//               Order #{currentOrder._id}
//             </Text>
//             {Array.isArray(currentOrder.orderItems) &&
//             currentOrder.orderItems.length > 0 ? (
//               currentOrder.orderItems.map((item, idx) => (
//                 <View
//                   key={item._id || idx}
//                   style={{
//                     flexDirection: "row",
//                     alignItems: "center",
//                     marginBottom: 8,
//                   }}
//                 >
//                   <Avatar.Image
//                     size={40}
//                     source={{
//                       uri:
//                         item.product?.image ||
//                         "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
//                     }}
//                     style={{ backgroundColor: "#eee" }}
//                   />
//                   <View style={{ marginLeft: 10 }}>
//                     <Text>{item.product?.name}</Text>
//                     <Text>Qty: {item.quantity}</Text>
//                     <Text>
//                       $
//                       {item.product?.price?.toFixed
//                         ? item.product.price.toFixed(2)
//                         : item.product?.price}
//                     </Text>
//                   </View>
//                 </View>
//               ))
//             ) : (
//               <Text>No items in this order.</Text>
//             )}
//           </View>
//         ) : (
//           <Text style={{ margin: 10 }}>No orders for this user.</Text>
//         )}
//       </ScrollView>
//     </View>
//   );
// };



export default UserOrderDisplay;
