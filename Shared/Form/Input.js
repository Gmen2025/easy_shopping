import React from 'react'
import {TextInput, StyleSheet, View} from 'react-native'

const Input = (props) => {

    return (
        <View style={styles.inputWrapper}>
            <TextInput
                style={styles.input}
                id ={props.id}
                name={props.name}
                onFocus={props.onFocus}
                placeholder={props.placeholder}
                placeholderTextColor="#c2ab63"
                value={props.value}
                onChangeText={props.onChangeText}
                secureTextEntry={props.secureTextEntry}
                keyboardType={props.keyboardType}
                autoCorrect={props.autoCorrect}
                autoCapitalize={props.autoCapitalize}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    inputWrapper: {
        width: '100%',
        marginBottom: 6,
        marginTop: 6,
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 8,
        fontSize: 15,
        color: '#1a1a1a',
        fontWeight: '500',
    },
});

export default Input