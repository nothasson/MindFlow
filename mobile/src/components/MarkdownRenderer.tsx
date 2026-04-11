import React from "react";
import { Platform, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { colors } from "../theme/colors";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <Markdown style={markdownStyles}>
      {content}
    </Markdown>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.stone800,
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.stone900,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.stone900,
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.stone800,
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  strong: {
    fontWeight: "600",
  },
  em: {
    fontStyle: "italic",
  },
  code_inline: {
    backgroundColor: colors.stone100,
    color: colors.brand,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  fence: {
    backgroundColor: colors.stone100,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.stone800,
  },
  blockquote: {
    backgroundColor: colors.stone50,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 2,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  link: {
    color: colors.brand,
    textDecorationLine: "underline",
  },
  hr: {
    backgroundColor: colors.stone200,
    height: 1,
    marginVertical: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.stone200,
    borderRadius: 4,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: colors.stone100,
  },
  th: {
    padding: 8,
    fontWeight: "600",
  },
  td: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
  },
});
