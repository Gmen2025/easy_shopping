import React, { useContext, useEffect, useState } from "react";
import { View, TextInput, Button, Text, Dimensions } from "react-native";
import { AuthContext } from "../../Context/store/Auth";
import { StyleSheet } from "react-native";
import FormContainer from "../../Shared/Form/FormContainer";
import Input from "../../Shared/Form/Input";
import Error from "../../Shared/Error";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";

const Login = (props) => {
  const { login, loading, isAuthenticated, error: contextError } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");


  useEffect(() => {
    console.log("Login component mounted, isAuthenticated:", isAuthenticated);
    if (isAuthenticated) {
      props.navigation.navigate("User Profile");
    }

    return () => {
      setEmail();
      setPassword();
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
  
    if (email && password) {
      login(email, password);
    } else {
      setError("Please fill in all fields");
    }
  };

  return (
    <FormContainer title="Login">
      <Input
        placeholder="Email"
        value={email}
        name={email}
        id={"email"}
        onChangeText={(text) => setEmail(text.toLowerCase())}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        placeholder="Password"
        name={password}
        id={"password"}
        value={password}
        onChangeText={(text) => setPassword(text)}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      {/* locally defined error state */}
      {error ? <Error message={error} /> : null}
      {/* context error state from AuthContext */} 
      {contextError ? <Error message={contextError} /> : null}
      <EasyButton
        tertiary
        large
        onPress={() => handleLogin()}
        >
        <Text style={{ color: "white" }}>{loading ? "Loading..." : "Login"}</Text>
      </EasyButton>
      <EasyButton
        onPress={() => props.navigation.navigate("ForgotPassword")}
        style={{ marginTop: 10 }}
      >
        <Text style={{ color: "#8a6c09", textDecorationLine: "underline" }}>Forgot Password?</Text>
      </EasyButton>
      
      <Text style={{padding:20}}>Don't have an account yet?</Text>
      <EasyButton
        tertiary
        large
        onPress={() => props.navigation.navigate("Register")}
      >
        <Text style={{ color: "white" }}>Register</Text>
      </EasyButton>
      <EasyButton
        onPress={() => props.navigation.navigate("Home")}
        style={styles.button}
      > 
        <Text style={{ color: "#8a6c09", textDecorationLine: "underline" }}>Back to Home</Text>
      </EasyButton>

      {/* {isAuthenticated && <Text style={styles.successText}>Login Successful!</Text>} */}
    </FormContainer>
  );
};

// style
const styles = StyleSheet.create({
  button: {
    marginTop: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  input: {
    height: 40,
    width: Dimensions.get("window").width - 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  errorText: {
    color: "red",
    marginTop: 10,
  },
  successText: {
    color: "green",
    marginTop: 10,
  },
  buttnGroup: {
    width: "80%",
    margin: 10,
    alignItems: "center",
  },
  subContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default Login;
