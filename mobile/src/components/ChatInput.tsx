import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Svg, Path } from "react-native-svg";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { colors } from "../theme/colors";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  onStop?: () => void;
  isStreaming?: boolean;
}

export function ChatInput({ onSend, disabled, onStop, isStreaming }: ChatInputProps) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  // ===== 语音识别事件 =====
  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    if (transcript) {
      setText(transcript);
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    console.warn("语音识别错误:", event.error);
  });

  const toggleListening = useCallback(async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    // 请求权限
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert("权限不足", "请在系统设置中允许麦克风权限");
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: "zh-CN",
      interimResults: true,
      continuous: true,
    });
  }, [listening]);

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="输入你想学的内容..."
          placeholderTextColor={colors.stone400}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        {/* 语音输入按钮 */}
        <TouchableOpacity
          style={[styles.micButton, listening && styles.micButtonActive]}
          onPress={toggleListening}
          activeOpacity={0.7}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={listening ? colors.white : colors.stone500}>
            <Path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
            <Path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z" />
          </Svg>
        </TouchableOpacity>
        {/* 发送 / 停止按钮 */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!text.trim() && !isStreaming) && styles.sendButtonDisabled,
          ]}
          onPress={isStreaming ? onStop : handleSend}
          disabled={!text.trim() && !isStreaming}
          activeOpacity={0.7}
        >
          {isStreaming ? (
            <View style={styles.stopIcon} />
          ) : (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                stroke={colors.white}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.stone200,
    backgroundColor: colors.background,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.stone800,
    maxHeight: 120,
    paddingVertical: 8,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.stone100,
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonActive: {
    backgroundColor: "#ef4444",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.stone300,
  },
  stopIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
});
