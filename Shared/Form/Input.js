import React from 'react'
import {TextInput, StyleSheet} from 'react-native'

const Input = (props) => {

    return (
        <TextInput
            style={styles.input}
            id ={props.id}
            name={props.name}
            onFocus={props.onFocus}
            placeholder={props.placeholder}
            value={props.value}
            onChangeText={props.onChangeText}
            secureTextEntry={props.secureTextEntry}
            keyboardType={props.keyboardType}
            autoCorrect={props.autoCorrect}
        />
    )
}

const styles = StyleSheet.create({
    input: {
        width: '80%',
        height: 60,
        backgroundColor: 'white',
        borderWidth: 2,
        margin: 10,
        padding:10,
        borderRadius: 20,
        borderColor: 'orange',
    },
});

export default Input