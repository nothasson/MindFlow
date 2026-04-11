import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "mindflow_token";
const STYLE_KEY = "mindflow_teaching_style";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getTeachingStyle(): Promise<string | null> {
  return AsyncStorage.getItem(STYLE_KEY);
}

export async function setTeachingStyle(style: string): Promise<void> {
  await AsyncStorage.setItem(STYLE_KEY, style);
}
