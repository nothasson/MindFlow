# MindFlow Mobile - 第一步快速开始指南

## 🚀 今天的任务：实现 BottomTab 导航框架

**预计时间**: 2-3小时  
**难度**: ⭐⭐ 中等  
**收益**: 改进信息架构，为后续所有页面提供基础

---

## 📋 完成清单

### 第1步：安装依赖 (5分钟)

```bash
cd /Users/hasson/Codes/MindFlow/mobile

# 添加BottomTabNavigator支持
npm install @react-navigation/bottom-tabs

# 如果有报错，确保基础包都安装了
npm ls @react-navigation/native @react-navigation/native-stack
```

**验证**：
```bash
npm list @react-navigation/bottom-tabs
# 应该看到 @react-navigation/bottom-tabs@^6.x
```

---

### 第2步：创建占位Screens (30分钟)

在 `mobile/src/screens/` 目录下创建以下文件：

#### **KnowledgeScreen.tsx**
```typescript
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export function KnowledgeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, color: colors.stone800 }}>📚 知识图谱</Text>
        <Text style={{ color: colors.stone500, marginTop: 8 }}>敬请期待...</Text>
      </View>
    </SafeAreaView>
  );
}
```

#### **QuizScreen.tsx**
```typescript
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export function QuizScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, color: colors.stone800 }}>🎯 测验</Text>
        <Text style={{ color: colors.stone500, marginTop: 8 }}>敬请期待...</Text>
      </View>
    </SafeAreaView>
  );
}
```

#### **ReviewScreen.tsx**
```typescript
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export function ReviewScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, color: colors.stone800 }}>📅 复习</Text>
        <Text style={{ color: colors.stone500, marginTop: 8 }}>敬请期待...</Text>
      </View>
    </SafeAreaView>
  );
}
```

#### **SettingsScreen.tsx**
```typescript
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, color: colors.stone800 }}>👤 我的</Text>
        <Text style={{ color: colors.stone500, marginTop: 8 }}>敬请期待...</Text>
      </View>
    </SafeAreaView>
  );
}
```

**验证**：
```bash
# 检查文件是否创建
ls -la mobile/src/screens/
# 应该看到 5 个 .tsx 文件
```

---

### 第3步：修改 AppNavigator.tsx (30分钟)

**当前文件位置**：`mobile/src/navigation/AppNavigator.tsx`

**完全替换为**：

```typescript
import React, { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuthStore } from "../stores/authStore";
import { LoginScreen } from "../screens/LoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { KnowledgeScreen } from "../screens/KnowledgeScreen";
import { QuizScreen } from "../screens/QuizScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { colors } from "../theme/colors";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type RootTabParamList = {
  "聊天": undefined;
  "知识": undefined;
  "测验": undefined;
  "复习": undefined;
  "我的": undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// Tab标签图标配置
const tabIcons: Record<keyof RootTabParamList, string> = {
  "聊天": "💬",
  "知识": "📚",
  "测验": "🎯",
  "复习": "📅",
  "我的": "👤",
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 24 }}>{tabIcons[route.name]}</Text>
        ),
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.stone400,
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: -4,
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: "rgba(214, 211, 209, 0.4)",
          paddingBottom: 4,
          height: 56,
        },
      })}
    >
      <Tab.Screen
        name="聊天"
        component={HomeScreen}
        options={{
          title: "聊天",
        }}
      />
      <Tab.Screen
        name="知识"
        component={KnowledgeScreen}
        options={{
          title: "知识",
        }}
      />
      <Tab.Screen
        name="测验"
        component={QuizScreen}
        options={{
          title: "测验",
        }}
      />
      <Tab.Screen
        name="复习"
        component={ReviewScreen}
        options={{
          title: "复习",
        }}
      />
      <Tab.Screen
        name="我的"
        component={SettingsScreen}
        options={{
          title: "我的",
        }}
      />
    </Tab.Navigator>
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
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**关键改动说明**：
1. ✅ 添加了 `createBottomTabNavigator` 导入
2. ✅ 创建了 `RootTabParamList` 类型定义 (5个Tab)
3. ✅ 创建了 `MainTabs()` 函数，包含BottomTabNavigator配置
4. ✅ Tab图标使用Emoji（不依赖额外图标库）
5. ✅ 保留了原有登录流程
6. ✅ 把所有Tab Screen都集成进去

---

### 第4步：更新 HomeScreen（移除Drawer按钮）(15分钟)

由于现在有了Tab导航，不再需要Header中的抽屉按钮。

**文件**：`mobile/src/screens/HomeScreen.tsx`

**修改部分**：在 styles 中，修改 header 相关部分

```typescript
// 将原来的 header 修改为：
<View style={styles.header}>
  <Text style={styles.headerTitle}>MindFlow</Text>
  <TouchableOpacity style={styles.headerButton} onPress={newChat}>
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={colors.stone600} strokeWidth={2} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={colors.stone600} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  </TouchableOpacity>
</View>

// 并删除 drawer 相关代码
```

实际上，让我们**保留整个HomeScreen不动**，因为Tab导航不会影响它的显示。

---

### 第5步：测试 (30分钟)

```bash
# 清理缓存
cd mobile
npm start -- --reset-cache

# 在另一个终端运行
npm run android  # 或 ios

# 或使用 Expo
npx expo start
# 然后按 i (iOS) 或 a (Android)
```

**预期看到的**：
- ✅ 应用启动后显示底部5个Tab
- ✅ 每个Tab都可以点击切换
- ✅ 聊天Tab（Home）显示原有聊天界面
- ✅ 其他Tab显示占位页面（"敬请期待..."）
- ✅ 选中的Tab颜色为棕色 (#C67A4A)

**如果有错误**：
```
错误：Cannot find module '@react-navigation/bottom-tabs'
→ 运行：npm install @react-navigation/bottom-tabs

错误：Cannot find exported member 'KnowledgeScreen'
→ 检查文件是否正确创建在 mobile/src/screens/
```

---

## 📸 预期效果

```
┌─────────────────────────┐
│                         │
│   聊天界面（现有）        │
│                         │
│                         │
├─────────────────────────┤
│ 💬  📚  🎯  📅  👤      │  ← BottomTab (高度 56px)
│ 聊天 知识 测验 复习 我的   │
└─────────────────────────┘
```

---

## ✅ 验收标准

完成后应检查：

- [ ] Tab导航栏显示在屏幕底部
- [ ] 5个Tab都可见：聊天、知识、测验、复习、我的
- [ ] 点击任何Tab都能切换页面
- [ ] 选中的Tab显示为棕色 (#C67A4A)
- [ ] 未选中的Tab显示为灰色
- [ ] 聊天Tab内容正常显示
- [ ] 其他Tab显示占位内容
- [ ] 没有TypeScript错误

---

## 🎯 下一步计划

一旦验证通过，下一个任务是：

### **[0.2] 添加晨间简报到 HomeScreen** (2-3小时)

需要完成：
1. 创建 `components/DailyBriefing.tsx`
2. 在HomeScreen中调用 `getDailyBriefing()` API
3. 在空状态（无消息）时显示日报
4. 实现标签点击后发送消息

---

## 💡 常见问题

**Q: 为什么用Emoji作为图标？**  
A: 避免额外图标库依赖，Emoji在RN中原生支持，能快速看到效果。后续可用`react-native-vector-icons`替换。

**Q: 能否移除Drawer导航？**  
A: 可以，改用纯Tab方式。但目前保留会话列表在设置页更好。

**Q: Tab顺序能否改变？**  
A: 可以，在RootTabParamList和MainTabs中的Tab.Screen顺序决定了左右顺序。

**Q: 怎么添加Badge（红点/数字）？**  
A: Tab.Screen配置中添加 `options={{ tabBarBadge: 3 }}`

---

## 📚 相关资源

- [React Navigation BottomTabNavigator](https://reactnavigation.org/docs/bottom-tab-navigator/)
- [当前文件结构](MOBILE_CODE_REVIEW.md)
- [完整实现计划](MOBILE_IMPLEMENTATION_PLAN.md)

---

**估计完成时间**：今天（2-3小时）  
**难度等级**：⭐⭐ (中等)  
**下一里程碑**：晨间简报实现（明天）

---

生成时间：2026-04-11 13:52
