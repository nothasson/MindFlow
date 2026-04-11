import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile, Paths } from "expo-file-system";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { Resource, ResourceUploadResult } from "../lib/types";

// ===== 常量 =====

type InputTab = "file" | "url" | "text";

const TABS: { key: InputTab; label: string }[] = [
  { key: "file", label: "文件上传" },
  { key: "url", label: "URL 导入" },
  { key: "text", label: "文本粘贴" },
];

const SOURCE_TYPE_LABELS: Record<string, string> = {
  upload: "文件上传",
  url: "URL 导入",
  text: "文本粘贴",
};

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOC",
  doc: "DOC",
  txt: "TXT",
  md: "MD",
};

// ===== 主组件 =====

export function ResourcesScreen() {
  const navigation = useNavigation<any>();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<InputTab>("file");

  // 输入状态
  const [urlInput, setUrlInput] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);

  // 上传/导入状态
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ResourceUploadResult | null>(
    null
  );

  // 资源列表状态
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // ===== 加载资源列表 =====

  const fetchResources = useCallback(async () => {
    try {
      setLoadingResources(true);
      const data = await api.getResources();
      setResources(data ?? []);
    } catch {
      Alert.alert("错误", "获取资源列表失败，请稍后重试");
    } finally {
      setLoadingResources(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // ===== 文件选择 =====

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
          "text/markdown",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? "application/octet-stream",
        });
      }
    } catch {
      Alert.alert("错误", "文件选择失败");
    }
  };

  // ===== 上传/导入 =====

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (activeTab === "file") {
      if (!selectedFile) {
        Alert.alert("提示", "请先选择文件");
        return;
      }
      try {
        setUploading(true);
        const result = await api.uploadResource(selectedFile);
        setUploadResult(result);
        setSelectedFile(null);
        fetchResources();
      } catch (e: any) {
        Alert.alert("上传失败", e?.message ?? "请稍后重试");
      } finally {
        setUploading(false);
      }
    } else if (activeTab === "url") {
      const trimmed = urlInput.trim();
      if (!trimmed) {
        Alert.alert("提示", "请输入网址");
        return;
      }
      if (!/^https?:\/\/.+/i.test(trimmed)) {
        Alert.alert("提示", "请输入有效的网址（以 http:// 或 https:// 开头）");
        return;
      }
      try {
        setUploading(true);
        const result = await api.importUrlResource(trimmed);
        setUploadResult(result);
        setUrlInput("");
        fetchResources();
      } catch (e: any) {
        Alert.alert("导入失败", e?.message ?? "请稍后重试");
      } finally {
        setUploading(false);
      }
    } else {
      // text tab — 写入临时文件后上传
      const trimmedText = textInput.trim();
      if (!trimmedText) {
        Alert.alert("提示", "请输入或粘贴文本内容");
        return;
      }
      const title = textTitle.trim() || "粘贴文本";
      const fileName = `${title}.txt`;
      try {
        setUploading(true);
        const tmpFile = new ExpoFile(Paths.cache, fileName);
        if (tmpFile.exists) {
          tmpFile.delete();
        }
        tmpFile.create();
        tmpFile.write(trimmedText);
        const result = await api.uploadResource({
          uri: tmpFile.uri,
          name: fileName,
          type: "text/plain",
        });
        setUploadResult(result);
        setTextInput("");
        setTextTitle("");
        fetchResources();
      } catch (e: any) {
        Alert.alert("提交失败", e?.message ?? "请稍后重试");
      } finally {
        setUploading(false);
      }
    }
  };

  // ===== 删除资源 =====

  const handleDelete = (id: string, filename: string) => {
    Alert.alert("确认删除", `确定删除「${filename}」吗？此操作不可撤销。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteResource(id);
            setResources((prev) => prev.filter((r) => r.id !== id));
          } catch (e: any) {
            Alert.alert("删除失败", e?.message ?? "请稍后重试");
          }
        },
      },
    ]);
  };

  // ===== 基于资料学习 =====

  const handleStartLearning = (resourceId: string) => {
    const target = resources.find((item) => item.id === resourceId);
    const prompt = target
      ? `我想基于资料「${target.filename}」开始学习，请先帮我梳理重点知识点。`
      : "我想基于刚上传的资料开始学习，请先帮我梳理重点知识点。";
    navigation.navigate("主导航", {
      screen: "聊天",
      params: { prompt },
    });
  };

  // ===== 过滤资源 =====

  const filteredResources = searchQuery.trim()
    ? resources.filter(
        (r) =>
          r.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.knowledge_points?.some((kp) =>
            kp.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : resources;

  // ===== 渲染 =====

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{"‹"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>学习资料</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={filteredResources}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Tab 切换 */}
            <View style={styles.tabRow}>
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    activeTab === tab.key && styles.tabActive,
                  ]}
                  onPress={() => {
                    setActiveTab(tab.key);
                    setUploadResult(null);
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab.key && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 输入区 */}
            <View style={styles.inputCard}>
              {activeTab === "file" && (
                <View style={styles.inputSection}>
                  <TouchableOpacity
                    style={styles.pickFileButton}
                    onPress={handlePickFile}
                  >
                    <Text style={styles.pickFileIcon}>📄</Text>
                    <Text style={styles.pickFileText}>
                      {selectedFile
                        ? selectedFile.name
                        : "点击选择文件（PDF / DOCX / TXT / MD）"}
                    </Text>
                  </TouchableOpacity>
                  {selectedFile && (
                    <TouchableOpacity
                      style={styles.clearFileButton}
                      onPress={() => setSelectedFile(null)}
                    >
                      <Text style={styles.clearFileText}>清除</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {activeTab === "url" && (
                <TextInput
                  style={styles.textInputSingle}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder="请输入网页地址"
                  placeholderTextColor={colors.stone400}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              )}

              {activeTab === "text" && (
                <View style={styles.inputSection}>
                  <TextInput
                    style={styles.textInputSingle}
                    value={textTitle}
                    onChangeText={setTextTitle}
                    placeholder="标题（可选）"
                    placeholderTextColor={colors.stone400}
                  />
                  <TextInput
                    style={styles.textInputMulti}
                    value={textInput}
                    onChangeText={setTextInput}
                    placeholder="粘贴或输入学习文本内容..."
                    placeholderTextColor={colors.stone400}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* 提交按钮 */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  uploading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {activeTab === "file"
                      ? "上传文件"
                      : activeTab === "url"
                        ? "导入网页"
                        : "提交文本"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 上传结果 */}
            {uploadResult && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>上传成功</Text>

                <View style={styles.resultMeta}>
                  <ResultRow
                    label="文件名"
                    value={uploadResult.filename}
                  />
                  <ResultRow
                    label="资源 ID"
                    value={uploadResult.resource_id}
                  />
                  <ResultRow
                    label="来源类型"
                    value={
                      SOURCE_TYPE_LABELS[uploadResult.source_type] ??
                      uploadResult.source_type
                    }
                  />
                  <ResultRow
                    label="页数"
                    value={`${uploadResult.pages}`}
                  />
                  <ResultRow
                    label="字数"
                    value={`${uploadResult.text?.length ?? 0}`}
                  />
                  <ResultRow
                    label="块数"
                    value={`${uploadResult.chunks}`}
                  />
                </View>

                {/* 知识点标签 */}
                {uploadResult.knowledge_points?.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>知识点</Text>
                    <View style={styles.tagRow}>
                      {uploadResult.knowledge_points.map((kp, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{kp}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* 摘要 */}
                {uploadResult.summary && (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>摘要</Text>
                    <Text style={styles.resultSummaryText}>
                      {uploadResult.summary}
                    </Text>
                  </View>
                )}

                {/* 建议学习问题 */}
                {uploadResult.questions && uploadResult.questions.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultSectionTitle}>
                      建议学习问题
                    </Text>
                    {uploadResult.questions.map((q, i) => (
                      <Text key={i} style={styles.questionText}>
                        {i + 1}. {q}
                      </Text>
                    ))}
                  </View>
                )}

                {/* 基于此资料学习 */}
                <TouchableOpacity
                  style={styles.learnButton}
                  onPress={() =>
                    handleStartLearning(uploadResult.resource_id)
                  }
                >
                  <Text style={styles.learnButtonText}>
                    基于此资料学习
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 资源列表标题 + 搜索 */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>已上传资料</Text>
            </View>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="搜索文件名或知识点..."
                placeholderTextColor={colors.stone400}
                returnKeyType="search"
              />
            </View>

            {/* 加载/空态 */}
            {loadingResources && (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            )}
            {!loadingResources && filteredResources.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyText}>
                  {searchQuery.trim()
                    ? "没有找到匹配的资料"
                    : "暂无学习资料，上传文件开始学习"}
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <ResourceCard
            resource={item}
            onDelete={() => handleDelete(item.id, item.filename)}
            onLearn={() => handleStartLearning(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ===== 子组件 =====

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ResourceCard({
  resource,
  onDelete,
  onLearn,
}: {
  resource: Resource;
  onDelete: () => void;
  onLearn: () => void;
}) {
  const ext = resource.filename.split(".").pop()?.toLowerCase() ?? "";
  const typeIcon = FILE_TYPE_ICONS[ext] ?? "FILE";

  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceCardHeader}>
        {/* 类型图标 */}
        <View style={styles.fileTypeTag}>
          <Text style={styles.fileTypeText}>{typeIcon}</Text>
        </View>
        <View style={styles.resourceCardInfo}>
          <Text style={styles.resourceName} numberOfLines={1}>
            {resource.filename}
          </Text>
          <Text style={styles.resourceMeta}>
            {resource.pages > 0 ? `${resource.pages} 页` : ""}
            {resource.pages > 0 && resource.chunks > 0 ? " · " : ""}
            {resource.chunks > 0 ? `${resource.chunks} 块` : ""}
          </Text>
        </View>
      </View>

      {/* 知识点标签 */}
      {resource.knowledge_points?.length > 0 && (
        <View style={styles.tagRow}>
          {resource.knowledge_points.slice(0, 5).map((kp, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{kp}</Text>
            </View>
          ))}
          {resource.knowledge_points.length > 5 && (
            <View style={styles.tagMore}>
              <Text style={styles.tagMoreText}>
                +{resource.knowledge_points.length - 5}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 操作按钮 */}
      <View style={styles.resourceActions}>
        <TouchableOpacity style={styles.learnSmallButton} onPress={onLearn}>
          <Text style={styles.learnSmallButtonText}>基于此资料学习</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===== 样式 =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(214, 211, 209, 0.4)",
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 28,
    color: colors.stone800,
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.stone800,
  },
  headerSpacer: {
    width: 36,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.stone100,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.brand,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone600,
  },
  tabTextActive: {
    color: colors.white,
  },

  // Input card
  inputCard: {
    backgroundColor: colors.stone100,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  inputSection: {
    gap: 8,
  },
  pickFileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.stone200,
    borderStyle: "dashed",
    gap: 10,
  },
  pickFileIcon: {
    fontSize: 20,
  },
  pickFileText: {
    flex: 1,
    fontSize: 14,
    color: colors.stone500,
  },
  clearFileButton: {
    alignSelf: "flex-end",
  },
  clearFileText: {
    fontSize: 13,
    color: colors.error,
  },
  textInputSingle: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.stone800,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  textInputMulti: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.stone800,
    borderWidth: 1,
    borderColor: colors.stone200,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },

  // Upload result
  resultCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.success,
    gap: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.success,
  },
  resultMeta: {
    gap: 6,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultLabel: {
    fontSize: 13,
    color: colors.stone500,
    width: 72,
  },
  resultValue: {
    flex: 1,
    fontSize: 13,
    color: colors.stone800,
    textAlign: "right",
  },
  resultSection: {
    gap: 6,
  },
  resultSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.stone700,
  },
  resultSummaryText: {
    fontSize: 13,
    color: colors.stone600,
    lineHeight: 20,
  },
  questionText: {
    fontSize: 13,
    color: colors.stone600,
    lineHeight: 20,
    paddingLeft: 4,
  },
  learnButton: {
    backgroundColor: colors.stone800,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  learnButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },

  // Section header
  sectionHeader: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
  },

  // Search
  searchContainer: {},
  searchInput: {
    backgroundColor: colors.stone100,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.stone800,
  },

  // Empty / Loading
  stateContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 14,
    color: colors.stone500,
    textAlign: "center",
  },

  // Resource card
  resourceCard: {
    backgroundColor: colors.stone100,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  resourceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fileTypeTag: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  fileTypeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  resourceCardInfo: {
    flex: 1,
    gap: 2,
  },
  resourceName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.stone800,
  },
  resourceMeta: {
    fontSize: 12,
    color: colors.stone500,
  },

  // Tags
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: "500",
  },
  tagMore: {
    backgroundColor: colors.stone200,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagMoreText: {
    fontSize: 12,
    color: colors.stone500,
  },

  // Resource actions
  resourceActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  learnSmallButton: {
    flex: 1,
    backgroundColor: colors.stone800,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  learnSmallButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: colors.stone200,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "600",
  },
});
