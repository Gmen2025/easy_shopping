import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableHighlight,
  TouchableOpacity,
  Dimensions,
  Button,
  Modal,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";

var { width } = Dimensions.get("window");

const ListItem = (props) => {
  const { item } = props;
  //console.log(item.image)
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <View>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <TouchableOpacity
              style={{ 
                alignSelf: "flex-end",
                position: "absolute",
                top: 10,
                right: 10
              }}
              onPress={() => setModalVisible(false)}
            >
              <Icon name="close" size={20} color="red" />
            </TouchableOpacity>
            <EasyButton medium secondary onPress={() => {
              setModalVisible(false);
              props.navigation.navigate("ProductForm", { item: item, title: "Edit Product" });
            }}>
              <Text style={{color: 'white'}}>Edit</Text>
            </EasyButton>
            <EasyButton medium danger onPress={() => {
              setModalVisible(false);
              props.delete(item._id);
            }}>
              <Text style={{ color: "white" }}>Delete</Text>
            </EasyButton>
          </View>
        </View>
      </Modal>
      <TouchableOpacity
      onPress={() => {
        props.navigation.navigate("ProductDetail", { item: item
        });
      }}
        onLongPress={() => setModalVisible(true)}
        style={[
          styles.container,
          {
            backgroundColor: props.index % 2 == 0 ? "lightgray" : "white",
          },
        ]}
      >
        <Image
          source={{
            uri: item.image
              ? item.image : "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
          }}
          resizeMode="contain"
          style={styles.image}
        />
        <Text style={styles.item}>{item.brand}</Text>
        <Text style={styles.item} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <Text style={styles.item} numberOfLines={1} ellipsizeMode="tail">
          {item.category.name}
        </Text>
        <Text style={styles.item}>${item.price}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: 5,
    width: width,
  },
  image: {
    borderRadius: 50,
    width: width / 6,
    height: 20,
    margin: 2,
  },
  item: {
    margin: 3,
    flexWrap: "wrap",
    width: width / 6,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
export default ListItem;
