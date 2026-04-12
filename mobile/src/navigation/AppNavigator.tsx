import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  NavigationContainer,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";
import { LoginScreen } from "../screens/LoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { ResourcesScreen } from "../screens/ResourcesScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { ReviewSessionScreen } from "../screens/ReviewSessionScreen";
import { QuizScreen } from "../screens/QuizScreen";
import { KnowledgeScreen } from "../screens/KnowledgeScreen";
import { WrongbookScreen } from "../screens/WrongbookScreen";
import { MemoryScreen } from "../screens/MemoryScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { CourseDetailScreen } from "../screens/CourseDetailScreen";
import { DrawerContent } from "../components/DrawerContent";
import { colors } from "../theme/colors";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ReviewSession: { concept?: string } | undefined;
  CourseDetail: { courseId: string } | undefined;
};

export type MainTabParamList = {
  "聊天": { conversationId?: string; prompt?: string; reset?: boolean } | undefined;
  "复习": undefined;
  "测验": { concept?: string } | undefined;
  "资料": undefined;
  "我的": undefined;
};

export type DrawerParamList = {
  "主导航": NavigatorScreenParams<MainTabParamList> | undefined;
  "学习数据": undefined;
  "知识图谱": undefined;
  "错题本": undefined;
  "学习历程": undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICON_NAME: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  "聊天": "chatbubble-ellipses-outline",
  "复习": "calendar-outline",
  "测验": "school-outline",
  "资料": "document-text-outline",
  "我的": "person-circle-outline",
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.stone400,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarStyle: {
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: "rgba(214, 211, 209, 0.5)",
          backgroundColor: "rgba(255,255,255,0.96)",
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={TAB_ICON_NAME[route.name]}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="聊天" component={HomeScreen} />
      <Tab.Screen name="复习" component={ReviewScreen} />
      <Tab.Screen name="测验" component={QuizScreen} />
      <Tab.Screen name="资料" component={ResourcesScreen} />
      <Tab.Screen name="我的" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: colors.background,
          width: 300,
        },
        drawerType: "front",
        swipeEnabled: true,
      }}
    >
      <Drawer.Screen name="主导航" component={MainTabs} />
      <Drawer.Screen name="学习数据" component={DashboardScreen} />
      <Drawer.Screen name="知识图谱" component={KnowledgeScreen} />
      <Drawer.Screen name="错题本" component={WrongbookScreen} />
      <Drawer.Screen name="学习历程" component={MemoryScreen} />
    </Drawer.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading, init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainDrawer} />
            <Stack.Screen name="ReviewSession" component={ReviewSessionScreen} />
            <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
