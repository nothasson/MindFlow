import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from "react-native";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Svg, Path, Line, Polyline } from "react-native-svg";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { colors } from "../theme/colors";

const navItems = [
  {
    key: "聊天",
    label: "聊天",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  {
    key: "学习数据",
    label: "学习数据",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 3v18h18M9 17V9m4 8V5m4 12v-4"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
];

export function DrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuthStore();
  const { conversations, currentConversationId, loadConversations, selectConversation, newChat, deleteConversation } =
    useChatStore();
  const currentRoute = props.state.routeNames[props.state.index];

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleDelete = (id: string) => {
    Alert.alert("确认删除", "确定删除这个会话吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => deleteConversation(id),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 标题 */}
      <View style={styles.header}>
        <Text style={styles.title}>MindFlow</Text>
      </View>

      {/* 新建对话 */}
      <TouchableOpacity
        style={[
          styles.navItem,
          !currentConversationId && currentRoute === "聊天" && styles.navItemActive,
        ]}
        onPress={() => {
          newChat();
          props.navigation.navigate("聊天");
          props.navigation.closeDrawer();
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Line x1="12" y1="5" x2="12" y2="19" stroke={colors.stone600} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1="5" y1="12" x2="19" y2="12" stroke={colors.stone600} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <Text style={styles.navText}>新建对话</Text>
      </TouchableOpacity>

      {/* 会话列表 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近对话</Text>
      </View>
      <ScrollView style={styles.conversationList}>
        {conversations.length > 0 ? (
          conversations.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              style={[
                styles.conversationItem,
                currentConversationId === conv.id && styles.conversationItemActive,
              ]}
              onPress={() => {
                selectConversation(conv.id);
                props.navigation.navigate("聊天");
                props.navigation.closeDrawer();
              }}
              onLongPress={() => handleDelete(conv.id)}
            >
              <Text
                style={[
                  styles.conversationText,
                  currentConversationId === conv.id && styles.conversationTextActive,
                ]}
                numberOfLines={1}
              >
                {conv.title || "未命名会话"}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无会话</Text>
        )}
      </ScrollView>

      {/* 导航项 */}
      <View style={styles.navSection}>
        {navItems.map((item) => {
          const active = currentRoute === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => {
                props.navigation.navigate(item.key);
                props.navigation.closeDrawer();
              }}
            >
              {item.icon(active ? colors.stone800 : colors.stone600)}
              <Text style={[styles.navText, active && styles.navTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 用户区域 */}
      <View style={styles.userSection}>
        {user && (
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(user.display_name || user.email).charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {user.display_name || user.email}
            </Text>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => {
                Alert.alert("退出登录", "确定退出吗？", [
                  { text: "取消", style: "cancel" },
                  { text: "退出", style: "destructive", onPress: logout },
                ]);
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                  stroke={colors.stone400}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points="16 17 21 12 16 7"
                  stroke={colors.stone400}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Line
                  x1="21"
                  y1="12"
                  x2="9"
                  y2="12"
                  stroke={colors.stone400}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: 12,
  },
  header: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.stone800,
  },
  sectionHeader: {
    paddingHorizontal: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.stone400,
    textTransform: "uppercase",
  },
  conversationList: {
    flex: 1,
  },
  conversationItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  conversationItemActive: {
    backgroundColor: "rgba(231, 229, 228, 0.7)",
  },
  conversationText: {
    fontSize: 14,
    color: colors.stone600,
  },
  conversationTextActive: {
    fontWeight: "500",
    color: colors.stone800,
  },
  emptyText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.stone400,
  },
  navSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(214, 211, 209, 0.4)",
    paddingTop: 12,
    marginTop: 8,
    gap: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: "rgba(231, 229, 228, 0.7)",
  },
  navText: {
    fontSize: 14,
    color: colors.stone600,
  },
  navTextActive: {
    fontWeight: "500",
    color: colors.stone800,
  },
  userSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(214, 211, 209, 0.4)",
    paddingTop: 12,
    paddingBottom: 16,
    marginTop: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.stone700,
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "500",
  },
  userName: {
    flex: 1,
    fontSize: 14,
    color: colors.stone700,
  },
  logoutButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});
