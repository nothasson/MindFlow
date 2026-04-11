import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Message } from "../lib/types";
import { colors } from "../theme/colors";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  if (isAssistant && !message.content) {
    if (isStreaming) {
      return (
        <View style={styles.row}>
          <View style={[styles.avatar, styles.assistantAvatar]}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <View style={styles.contentWrap}>
            <Text style={styles.thinkingText}>思考中...</Text>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          isAssistant ? styles.assistantAvatar : styles.userAvatar,
        ]}
      >
        <Text style={styles.avatarText}>{isAssistant ? "M" : "U"}</Text>
      </View>
      <View style={styles.contentWrap}>
        {isAssistant ? (
          <MarkdownRenderer content={message.content} />
        ) : (
          <Text style={styles.userText}>{message.content}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  assistantAvatar: {
    backgroundColor: colors.brand,
  },
  userAvatar: {
    backgroundColor: colors.stone500,
  },
  avatarText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  contentWrap: {
    flex: 1,
  },
  userText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.stone800,
  },
  thinkingText: {
    fontSize: 14,
    color: colors.stone400,
    fontStyle: "italic",
  },
});
