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
import { Svg, Path, Line, Polyline, Circle } from "react-native-svg";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { colors } from "../theme/colors";

const navItems = [
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
  {
    key: "知识图谱",
    label: "知识图谱",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx="6" cy="6" r="3" stroke={color} strokeWidth={1.8} />
        <Circle cx="18" cy="6" r="3" stroke={color} strokeWidth={1.8} />
        <Circle cx="12" cy="18" r="3" stroke={color} strokeWidth={1.8} />
        <Line x1="8.5" y1="7.5" x2="10.5" y2="16" stroke={color} strokeWidth={1.5} />
        <Line x1="15.5" y1="7.5" x2="13.5" y2="16" stroke={color} strokeWidth={1.5} />
        <Line x1="9" y1="6" x2="15" y2="6" stroke={color} strokeWidth={1.5} />
      </Svg>
    ),
  },
  {
    key: "错题本",
    label: "错题本",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 19.5A2.5 2.5 0 016.5 17H20"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line x1="9" y1="10" x2="15" y2="10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    key: "学习历程",
    label: "学习历程",
    icon: (color: string) => (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={1.8} />
        <Polyline
          points="12 6 12 12 16 14"
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
      <View style={styles.header}>
        <Text style={styles.title}>MindFlow</Text>
        <Text style={styles.subtitle}>会话历史与学习工具</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.newChatButton,
          !currentConversationId && currentRoute === "主导航" && styles.newChatButtonActive,
        ]}
        onPress={() => {
          newChat();
          props.navigation.navigate("主导航", { screen: "聊天", params: { reset: true } });
          props.navigation.closeDrawer();
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Line x1="12" y1="5" x2="12" y2="19" stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1="5" y1="12" x2="19" y2="12" stroke={colors.white} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <Text style={styles.newChatText}>新建对话</Text>
      </TouchableOpacity>

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
                props.navigation.navigate("主导航", {
                  screen: "聊天",
                  params: { conversationId: conv.id },
                });
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

      <View style={styles.navSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>更多工具</Text>
        </View>
        <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
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
    paddingTop: 52,
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.stone800,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.stone500,
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: colors.brand,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  newChatButtonActive: {
    opacity: 0.92,
  },
  newChatText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  sectionHeader: {
    paddingHorizontal: 4,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.stone400,
  },
  conversationList: {
    flexGrow: 0,
    maxHeight: 210,
  },
  conversationItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(231, 229, 228, 0.8)",
  },
  conversationItemActive: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderColor: "rgba(198, 122, 74, 0.22)",
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
    paddingHorizontal: 8,
    fontSize: 13,
    color: colors.stone400,
  },
  navSection: {
    marginTop: 10,
    flex: 1,
  },
  navScroll: {
    flex: 1,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(231, 229, 228, 0.8)",
  },
  navItemActive: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderColor: "rgba(198, 122, 74, 0.22)",
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
    marginTop: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
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
