import React, { useCallback, useEffect, useRef } from "react";
import { FlatList, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, DrawerActions, useRoute } from "@react-navigation/native";
import { Svg, Line, Rect } from "react-native-svg";
import { useChatStore } from "../stores/chatStore";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput } from "../components/ChatInput";
import { DailyBriefing } from "../components/DailyBriefing";
import { colors } from "../theme/colors";
import type { BriefingItem, Message } from "../lib/types";

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const flatListRef = useRef<FlatList>(null);
  const handledPromptRef = useRef<string | null>(null);
  const handledConversationRef = useRef<string | null>(null);
  const { messages, currentConversationId, isStreaming, sendMessage, stopStreaming, newChat, selectConversation } =
    useChatStore();

  useEffect(() => {
    const params = route.params ?? {};

    if (params.conversationId && handledConversationRef.current !== params.conversationId) {
      handledConversationRef.current = params.conversationId;
      selectConversation(params.conversationId);
      navigation.setParams?.({ conversationId: undefined });
      return;
    }

    if (params.prompt && handledPromptRef.current !== params.prompt) {
      handledPromptRef.current = params.prompt;
      newChat();
      sendMessage(params.prompt);
      navigation.setParams?.({ prompt: undefined, reset: undefined });
      return;
    }

    if (params.reset && !params.prompt && currentConversationId) {
      newChat();
      navigation.setParams?.({ reset: undefined });
    }
  }, [
    currentConversationId,
    navigation,
    newChat,
    route.params,
    selectConversation,
    sendMessage,
  ]);

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

  const startPromptedChat = useCallback(
    async (prompt: string) => {
      newChat();
      navigation.navigate("聊天");
      await sendMessage(prompt);
    },
    [navigation, newChat, sendMessage]
  );

  const handleReviewItem = useCallback(
    async (item: BriefingItem) => {
      await startPromptedChat(`复习一下「${item.concept}」`);
    },
    [startPromptedChat]
  );

  const handleNewItem = useCallback(
    async (item: BriefingItem) => {
      await startPromptedChat(`我想学习「${item.concept}」`);
    },
    [startPromptedChat]
  );

  const handleQuizSuggestion = useCallback(
    (item: BriefingItem) => {
      navigation.navigate("测验", { concept: item.concept });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.getParent()?.dispatch(DrawerActions.openDrawer())}
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
          <View style={styles.briefingWrap}>
            <DailyBriefing
              onReviewItem={handleReviewItem}
              onNewItem={handleNewItem}
              onQuizSuggestion={handleQuizSuggestion}
            />
          </View>
          <View style={styles.emptyHero}>
            <View style={styles.emptyLogoRing}>
              <View style={styles.emptyLogo}>
                <Text style={styles.emptyLogoText}>M</Text>
              </View>
            </View>
            <Text style={styles.emptyEyebrow}>你的 AI 学习搭子</Text>
            <Text style={styles.emptyTitle}>开始学习</Text>
            <Text style={styles.emptySubtitle}>
              输入你想学的内容，AI 会用苏格拉底式对话一步步引导你理解、提问和复盘。
            </Text>
            <View style={styles.emptyFeatureRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>对话式学习</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>知识图谱</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>复习节奏</Text>
              </View>
            </View>
          </View>
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
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(214, 211, 209, 0.55)",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
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
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  briefingWrap: {
    width: "100%",
    marginBottom: 28,
  },
  emptyHero: {
    alignItems: "center",
    maxWidth: 300,
  },
  emptyLogoRing: {
    width: 98,
    height: 98,
    borderRadius: 49,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(198, 122, 74, 0.16)",
    marginBottom: 16,
  },
  emptyLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.brand,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  emptyLogoText: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "700",
  },
  emptyEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    color: colors.brand,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.stone800,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.stone500,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
  },
  emptyFeatureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  featurePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(214, 211, 209, 0.7)",
  },
  featurePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.stone600,
  },
});
