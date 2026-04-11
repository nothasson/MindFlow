import React, { useCallback, useRef } from "react";
import { FlatList, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import { Svg, Line, Rect } from "react-native-svg";
import { useChatStore } from "../stores/chatStore";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput } from "../components/ChatInput";
import { colors } from "../theme/colors";
import type { Message } from "../lib/types";

export function HomeScreen() {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const { messages, isStreaming, sendMessage, stopStreaming, newChat } =
    useChatStore();

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content);
    },
    [sendMessage]
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      <MessageBubble
        message={item}
        isStreaming={isStreaming && index === messages.length - 1}
      />
    ),
    [isStreaming, messages.length]
  );

  const keyExtractor = useCallback(
    (_: Message, index: number) => `msg-${index}`,
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="18" height="18" rx="2" stroke={colors.stone600} strokeWidth={1.8} />
            <Line x1="9" y1="3" x2="9" y2="21" stroke={colors.stone600} strokeWidth={1.8} />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MindFlow</Text>
        <TouchableOpacity style={styles.headerButton} onPress={newChat}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Line x1="12" y1="5" x2="12" y2="19" stroke={colors.stone600} strokeWidth={2} strokeLinecap="round" />
            <Line x1="5" y1="12" x2="19" y2="12" stroke={colors.stone600} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* 消息列表 */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyLogo}>
            <Text style={styles.emptyLogoText}>M</Text>
          </View>
          <Text style={styles.emptyTitle}>开始学习</Text>
          <Text style={styles.emptySubtitle}>输入你想学的内容，AI 会用苏格拉底式对话引导你</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />
      )}

      {/* 输入框 */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        onStop={stopStreaming}
        isStreaming={isStreaming}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(214, 211, 209, 0.4)",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.stone800,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyLogoText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: "700",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.stone800,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.stone500,
    textAlign: "center",
    lineHeight: 20,
  },
});
