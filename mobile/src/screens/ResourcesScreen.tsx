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
import { fillTemplate } from "../lib/api";
import type { Resource, ResourceUploadResult } from "../lib/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type { Course } from "../lib/types";

// ===== 工具函数 =====

/** 安全解码 URL 编码的文件名 */
function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** 从课程 summary 中提取简短摘要 */
function extractBrief(summary: string): string {
  const parts = summary.split(/\n---\n/);
  const first = parts[0] || summary;
  const lines = first.split("\n").filter((l: string) => !l.startsWith("## ") && !l.startsWith("### "));
  const text = lines.join("\n").trim();
  return text.length > 150 ? text.slice(0, 150) + "..." : text;
}

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Prompt 模板
  const [templates, setTemplates] = useState<api.PromptTemplates>({});

  useEffect(() => {
    api.getPromptTemplates().then(setTemplates).catch(() => {});
  }, []);

  // 顶层模式：上传资料 vs 我的课程
  const [mode, setMode] = useState<"upload" | "courses">("upload");

  // Tab 状态（内部输入方式切换）
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

  // 课程列表状态
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

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
    Alert.alert("确认删除", `确定删除「${decodeName(filename)}」吗？此操作不可撤销。`, [
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
      ? fillTemplate(templates.learn_resource || "我想基于资料「{{filename}}」开始学习，请先帮我梳理重点知识点。", { filename: decodeName(target.filename) })
      : templates.learn_resource_default || "我想基于刚上传的资料开始学习，请先帮我梳理重点知识点。";
    navigation.navigate("主导航", {
      screen: "聊天",
      params: { prompt },
    });
  };

  // ===== 生成课程 =====

  const [generatingCourseId, setGeneratingCourseId] = useState<string | null>(null);

  const handleGenerateCourse = async (resourceId: string) => {
    try {
      setGeneratingCourseId(resourceId);
      const data = await api.generateCourse(resourceId);
      navigation.navigate("CourseDetail", { courseId: data.course.id });
    } catch (e: any) {
      Alert.alert("生成失败", e?.message ?? "课程生成失败，请稍后重试");
    } finally {
      setGeneratingCourseId(null);
    }
  };

  // ===== 加载课程列表 =====
  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const data = await api.getCourses();
      setCourses(data ?? []);
    } catch { /* 静默 */ }
    finally { setCoursesLoading(false); }
  }, []);

  useEffect(() => {
    if (mode === "courses") fetchCourses();
  }, [mode, fetchCourses]);

  // ===== 删除课程 =====
  const handleDeleteCourse = (id: string, title: string) => {
    Alert.alert("确认删除", `确定删除课程「${decodeName(title)}」吗？此操作不可撤销。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try {
          await api.deleteCourse(id);
          setCourses((prev) => prev.filter((c) => c.id !== id));
        } catch { Alert.alert("错误", "删除失败"); }
      }},
    ]);
  };

  // ===== 过滤资源 =====

  const filteredResources = searchQuery.trim()
    ? resources.filter(
        (r) =>
          decodeName(r.filename).toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        data={mode === "upload" ? filteredResources : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* 顶层模式切换：上传资料 / 我的课程 */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === "upload" && styles.tabActive]}
                onPress={() => setMode("upload")}
              >
                <Text style={[styles.tabText, mode === "upload" && styles.tabTextActive]}>上传资料</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === "courses" && styles.tabActive]}
                onPress={() => setMode("courses")}
              >
                <Text style={[styles.tabText, mode === "courses" && styles.tabTextActive]}>
                  我的课程{courses.length > 0 ? ` (${courses.length})` : ""}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ========== 上传资料模式 ========== */}
            {mode === "upload" ? (
            <>
            {/* 内部输入方式切换 */}
            <View style={styles.innerTabRow}>
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.innerTab, activeTab === tab.key && styles.innerTabActive]}
                  onPress={() => { setActiveTab(tab.key); setUploadResult(null); }}
                >
                  <Text style={[styles.innerTabText, activeTab === tab.key && styles.innerTabTextActive]}>{tab.label}</Text>
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
                    value={decodeName(uploadResult.filename)}
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
            {loadingResources ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            ) : filteredResources.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyText}>
                  {searchQuery.trim() ? "没有找到匹配的资料" : "暂无学习资料，上传文件开始学习"}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          /* ========== 我的课程模式 ========== */
          <>
            {coursesLoading ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            ) : courses.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📚</Text>
                <Text style={styles.emptyText}>还没有课程</Text>
                <Text style={styles.emptySubText}>上传资料后点击"生成课程"即可创建</Text>
              </View>
            ) : (
              <View style={styles.courseList}>
                {courses.map((course) => (
                  <View key={course.id} style={styles.courseCard}>
                    <View style={styles.courseCardHeader}>
                      <Text style={styles.courseTitle} numberOfLines={2}>{decodeName(course.title)}</Text>
                    </View>
                    {course.summary ? (
                      <Text style={styles.courseSummary} numberOfLines={3}>{extractBrief(course.summary)}</Text>
                    ) : null}
                    <View style={styles.courseMeta}>
                      <View style={styles.diffTag}>
                        <Text style={styles.diffTagText}>
                          {course.difficulty_level === "beginner" ? "初学" : course.difficulty_level === "advanced" ? "进阶" : "专家"}
                        </Text>
                      </View>
                      <Text style={styles.metaText}>{course.section_count} 个章节</Text>
                    </View>
                    <View style={styles.courseActions}>
                      <TouchableOpacity
                        style={styles.startButton}
                        onPress={() => navigation.navigate("CourseDetail", { courseId: course.id })}
                      >
                        <Text style={styles.startButtonText}>开始学习</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteSmallButton}
                        onPress={() => handleDeleteCourse(course.id, course.title)}
                      >
                        <Text style={styles.deleteSmallButtonText}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        </>
        }
        renderItem={({ item }) => (
          <ResourceCard
            resource={item}
            onDelete={() => handleDelete(item.id, item.filename)}
            onLearn={() => handleStartLearning(item.id)}
            onGenerateCourse={() => handleGenerateCourse(item.id)}
            generatingCourse={generatingCourseId === item.id}
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
  onGenerateCourse,
  generatingCourse,
}: {
  resource: Resource;
  onDelete: () => void;
  onLearn: () => void;
  onGenerateCourse: () => void;
  generatingCourse: boolean;
}) {
  const decoded = decodeName(resource.filename);
  const ext = decoded.split(".").pop()?.toLowerCase() ?? "";
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
            {decoded}
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
        <TouchableOpacity
          style={[styles.courseButton, generatingCourse && styles.courseButtonDisabled]}
          onPress={onGenerateCourse}
          disabled={generatingCourse}
        >
          {generatingCourse ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={styles.courseButtonText}>生成中...</Text>
            </View>
          ) : (
            <Text style={styles.courseButtonText}>生成课程</Text>
          )}
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

  // Inner tabs (文件上传/URL导入/文本粘贴)
  innerTabRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  innerTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  innerTabActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  innerTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.stone500,
  },
  innerTabTextActive: {
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
  courseButton: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  courseButtonDisabled: {
    opacity: 0.6,
  },
  courseButtonText: {
    color: colors.brand,
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

  // 课程列表样式
  emptySubText: {
    fontSize: 13,
    color: colors.stone400,
    textAlign: "center",
  },
  courseList: {
    gap: 12,
  },
  courseCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.stone200,
    gap: 10,
  },
  courseCardHeader: {
    gap: 4,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
  },
  courseSummary: {
    fontSize: 13,
    color: colors.stone500,
    lineHeight: 20,
  },
  courseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diffTag: {
    backgroundColor: colors.stone100,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diffTagText: {
    fontSize: 11,
    color: colors.stone600,
    fontWeight: "500",
  },
  metaText: {
    fontSize: 12,
    color: colors.stone400,
  },
  courseActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  startButton: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  startButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  deleteSmallButton: {
    backgroundColor: colors.stone200,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  deleteSmallButtonText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "600",
  },
});
