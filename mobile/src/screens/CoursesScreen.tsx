import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import * as api from "../lib/api";
import type { Course } from "../lib/types";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function CoursesScreen() {
  const navigation = useNavigation<NavProp>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCourses();
      setCourses(data.courses ?? []);
    } catch {
      Alert.alert("错误", "获取课程列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 页面聚焦时刷新
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", fetchCourses);
    return unsubscribe;
  }, [navigation, fetchCourses]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert("确认删除", `确定删除课程「${title}」吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteCourse(id);
            setCourses((prev) => prev.filter((c) => c.id !== id));
          } catch {
            Alert.alert("错误", "删除失败");
          }
        },
      },
    ]);
  };

  const renderCourse = ({ item }: { item: Course }) => {
    const diffLabel =
      item.difficulty_level === "beginner"
        ? "初学"
        : item.difficulty_level === "advanced"
          ? "进阶"
          : "专家";

    return (
      <View style={styles.courseCard}>
        <Text style={styles.courseTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.summary ? (
          <Text style={styles.courseSummary} numberOfLines={2}>
            {item.summary.slice(0, 120)}
          </Text>
        ) : null}
        <View style={styles.courseMeta}>
          <View style={styles.diffTag}>
            <Text style={styles.diffTagText}>{diffLabel}</Text>
          </View>
          <Text style={styles.metaText}>{item.section_count} 个章节</Text>
        </View>
        <View style={styles.courseActions}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate("CourseDetail", { courseId: item.id })}
          >
            <Text style={styles.startButtonText}>开始学习</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id, item.title)}
          >
            <Text style={styles.deleteButtonText}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{"‹"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>课程库</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
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
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          renderItem={renderCourse}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  courseCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.stone200,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.stone800,
  },
  courseSummary: {
    fontSize: 13,
    color: colors.stone500,
    lineHeight: 18,
  },
  courseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diffTag: {
    backgroundColor: "rgba(198, 122, 74, 0.12)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  diffTagText: {
    fontSize: 11,
    color: colors.brand,
    fontWeight: "600",
  },
  metaText: {
    fontSize: 12,
    color: colors.stone400,
  },
  courseActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
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
    fontSize: 14,
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
  stateContainer: {
    flex: 1,
    justifyContent: "center",
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
    margin: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    fontSize: 15,
    color: colors.stone500,
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 13,
    color: colors.stone400,
  },
});
