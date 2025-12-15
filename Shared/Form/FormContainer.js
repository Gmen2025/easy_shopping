import React from 'react'
import { ScrollView, Dimensions, StyleSheet, Text } from 'react-native'


var { width} = Dimensions.get('window')

{/* {props.children} /* This is where the form fields will be rendered.   */}

const FormContainer = (props) => {
  return (
    <ScrollView
      contentContainerStyle={styles.container}>
        <Text style={styles.title}>{props.title}</Text>
        {props.children}  
        {/* {props.footer} /* This is where the footer will be rendered, e.g., submit button. */ }
        {/* {props.error} /* This is where any error messages will be displayed. */ }
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
    marginBottom: 20,
    width: width,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    //height: 800,
    //flexGrow: 1,
  },
  title: {
    fontSize: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
});

export default FormContainer
