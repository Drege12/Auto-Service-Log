import { useLogin } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

export default function LoginScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const loginMutation = useLogin();

  const handleLogin = async () => {
    if (!password) return;
    setError("");

    try {
      const result = await loginMutation.mutateAsync({ data: { password } });
      if (result.ok) {
        await AsyncStorage.setItem("dt_auth", "1");
        router.replace("/");
      } else {
        setError("Invalid password");
      }
    } catch (e) {
      setError("Login failed. Please try again.");
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
      bottomOffset={20}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather name="tool" size={64} color={Colors.dark.tint} />
        </View>
        <Text style={styles.title}>DEALER TRACKER</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Shop Password"
            placeholderTextColor={Colors.dark.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoFocus
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>ENTER</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    marginBottom: 40,
    letterSpacing: 2,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 24,
  },
  input: {
    width: "100%",
    height: 56,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: Colors.dark.text,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  errorText: {
    color: Colors.dark.error,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  button: {
    width: "100%",
    height: 56,
    backgroundColor: Colors.dark.tint,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#000",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
