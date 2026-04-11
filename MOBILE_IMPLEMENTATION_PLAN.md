# MindFlow Mobile - 实现优先级规划

## 🎯 快速概览

```
当前状态：3/12 页面已实现 (Home + Dashboard + Login)
目标状态：完整复制Web端所有功能到Mobile
总工作量估算：20-25个工程日
建议周期：4-5周（高效执行）
```

---

## 📊 按优先级的任务分解

### 🔥 **URGENT（第0周）：框架改进**

#### **[0.1] 实现 BottomTab 导航框架**
- **为什么重要**：改进信息架构，移动端标准UI
- **工作量**：2-3h
- **涉及文件**：
  - `navigation/AppNavigator.tsx` (添加BottomTabNavigator)
  - 新建 `screens/KnowledgeScreen.tsx` (占位)
  - 新建 `screens/QuizScreen.tsx` (占位)
  - 新建 `screens/ReviewScreen.tsx` (占位)
  - 新建 `screens/SettingsScreen.tsx` (占位)

**代码框架**：
```typescript
const Tab = createBottomTabNavigator<RootTabParamList>();

export type RootTabParamList = {
  "聊天": undefined;
  "知识": undefined;
  "测验": undefined;
  "复习": undefined;
  "我的": undefined;
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          const icons = {
            "聊天": "💬",
            "知识": "📚",
            "测验": "🎯",
            "复习": "📅",
            "我的": "👤",
          };
          return <Text style={{ fontSize: 20 }}>{icons[route.name]}</Text>;
        },
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
      })}
    >
      <Tab.Screen name="聊天" component={HomeScreen} />
      <Tab.Screen name="知识" component={KnowledgeScreen} />
      <Tab.Screen name="测验" component={QuizScreen} />
      <Tab.Screen name="复习" component={ReviewScreen} />
      <Tab.Screen name="我的" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
```

**验收标准**：
- [ ] 5个Tab图标可见
- [ ] 页面切换流畅
- [ ] 标签栏在底部
- [ ] 选中态样式清晰

---

#### **[0.2] 添加晨间简报到 HomeScreen**
- **为什么重要**：改进空状态UI，增强学习动力
- **工作量**：2-3h
- **新组件**：`components/DailyBriefing.tsx`
- **API调用**：`getDailyBriefing()` (已有类型)

**实现步骤**：
```typescript
// HomeScreen.tsx 中添加
useEffect(() => {
  api.getDailyBriefing()
    .then(setBriefing)
    .catch(() => {})
    .finally(() => setBriefingLoading(false));
}, []);

// 在空状态下显示
{messages.length === 0 && briefing && (
  <DailyBriefing briefing={briefing} onSelectItem={sendMessage} />
)}
```

**UI样式**：
- 顶部折叠按钮显示 "📋 今日建议：X项复习，Y项新学"
- 展开后显示标签云：
  - 复习标签（棕色 #C67A4A）
  - 新学标签（灰色）
  - 测验标签（深色）
- 点击标签发送对应消息

---

#### **[0.3] 深色模式基础适配**
- **为什么重要**：系统级别设置，影响全局体验
- **工作量**：3-4h
- **文件修改**：`theme/colors.ts`, `AppNavigator.tsx`

**实现步骤**：
```typescript
// theme/colors.ts
import { useColorScheme } from 'react-native';

export const lightColors = {
  background: "#EEECE2",
  foreground: "#1c1917",
  // ...
};

export const darkColors = {
  background: "#1c1917",
  foreground: "#EEECE2",
  // ...
};

export function useThemeColors() {
  const isDark = useColorScheme() === 'dark';
  return isDark ? darkColors : lightColors;
}
```

---

### 📊 **HIGH（第1-2周）：关键功能**

#### **[1.1] Dashboard - 完整图表实现**
- **为什么重要**：核心数据展示，影响用户粘性
- **工作量**：4-5h
- **依赖库**：`react-native-chart-kit`

**要实现的图表**：
1. **Heatmap** - 365天学习活动热力图
2. **Donut Chart** - 掌握进度（绿/黄/红三个圆环）
3. **Bar Chart** - 7天学习趋势
4. **Top 5 Weak Points** - 薄弱点列表

**新增API调用**：
```typescript
// 在 lib/api.ts 中
export async function getHeatmapData(): Promise<HeatmapDay[]> {
  // 调用后端获取365天数据
}

export async function getMasteryStats() {
  // 获取掌握/学习/薄弱点数量
}

export async function getWeakConcepts(limit: number = 5) {
  // 获取Top N薄弱点及进度
}
```

**新组件**：
- `components/HeatmapChart.tsx`
- `components/MasteryDonut.tsx`
- `components/TrendChart.tsx`
- `components/WeakPointsList.tsx`

---

#### **[1.2] Knowledge Graph - Canvas 方案选型**
- **为什么重要**：最复杂的功能，需要提前规划
- **工作量**：决策 1h，实现 8-10h
- **选型评估**：

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| **react-native-skia** | 高性能、对标Web Canvas | 生态不完整 | ⭐⭐⭐ |
| **react-native-svg** | 生态成熟 | 复杂动画性能差 | ⭐⭐ |
| **Three.js-RN** | 3D支持 | 过度设计 | ❌ |
| **WebView** | 复用Web代码 | 性能瓶颈 | ❌ |

**建议**：采用 **react-native-skia**，配合Force Graph库改编

**实现框架**：
```typescript
// screens/KnowledgeScreen.tsx
export function KnowledgeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ForceDirectedGraph
        nodes={nodes}
        edges={edges}
        onNodeSelect={handleNodeSelect}
      />
      <NodeDetail node={selectedNode} />
    </View>
  );
}
```

---

#### **[1.3] Quiz System - 三种测验模式**
- **为什么重要**：核心学习功能，三种模式满足不同学习需求
- **工作量**：6-8h
- **三种模式**：
  1. **Traditional Mode** - 文本输入题目
  2. **Anki Mode** - 卡片翻转+FSRS评分
  3. **Conversation Mode** - 多轮对话评估

**新组件**：
- `components/QuestionCard.tsx` (通用题目卡片)
- `components/TraditionalQuiz.tsx` (文本输入)
- `components/AnkiCard.tsx` (翻转卡片+动画)
- `components/ConversationQuiz.tsx` (对话模式)
- `components/ErrorTypeFilter.tsx` (错误分类过滤)

**新Zustand Store**：
```typescript
// stores/quizStore.ts
interface QuizState {
  currentQuestion: Question | null;
  userAnswer: string;
  quizMode: 'traditional' | 'anki' | 'conversation';
  questions: Question[];
  
  startQuiz: (mode: QuizMode) => void;
  submitAnswer: (answer: string, rating?: number) => void;
  nextQuestion: () => void;
}
```

---

### 📅 **MEDIUM（第2-3周）：补充功能**

#### **[2.1] Review Calendar**
- **工作量**：3-4h
- **依赖库**：`react-native-calendars`
- **实现内容**：
  - 当月日历，有复习任务的日期标记
  - 待复习列表（按优先级排序）
  - 即将复习列表（未来7天计划）

---

#### **[2.2] Settings Page**
- **工作量**：3-4h
- **实现内容**：
  - 教学风格选择 (Socratic/深度原理/类比) - Picker
  - LLM提供商选择 - RadioGroup
  - 考试计划管理 - 表单
  - 深色模式开关

---

#### **[2.3] Wrong Book（错题本）**
- **工作量**：3-4h
- **实现内容**：
  - 按错误类型分类过滤
  - 可展开的错题卡片
  - 侧滑删除/标记已解决
  - 题目重做功能

---

#### **[2.4] Resources Upload**
- **工作量**：3-4h
- **依赖库**：`react-native-document-picker`, `react-native-fs`
- **实现内容**：
  - 文件选择器集成
  - 拖拽上传UI (长按提示)
  - 上传进度条
  - 提取概念显示

---

### 🎨 **LOW（第3-4周）：优化和完善**

#### **[3.1] 下拉刷新和手势**
- **工作量**：2-3h
- **内容**：RefreshControl + 侧滑返回优化

---

#### **[3.2] Course Detail Page**
- **工作量**：2-3h
- **内容**：章节导航 + 学习目标 + 思考题

---

#### **[3.3] 离线支持 & 缓存优化**
- **工作量**：5-6h
- **内容**：
  - 消息离线队列
  - 数据本地缓存
  - 断网提示

---

## 🗂️ **文件结构规划**

```
mobile/src/
├── screens/
│   ├── HomeScreen.tsx          ✅ 已有
│   ├── DashboardScreen.tsx     ✅ 已有
│   ├── LoginScreen.tsx         ✅ 已有
│   ├── KnowledgeScreen.tsx     🔴 待实现
│   ├── QuizScreen.tsx          🔴 待实现
│   ├── ReviewScreen.tsx        🔴 待实现
│   ├── SettingsScreen.tsx      🔴 待实现
│   ├── WrongBookScreen.tsx     🔴 待实现
│   ├── ResourcesScreen.tsx     🔴 待实现
│   └── CourseDetailScreen.tsx  🔴 待实现
│
├── components/
│   ├── chat/
│   │   ├── ChatInput.tsx       ✅ 已有
│   │   ├── MessageBubble.tsx   ✅ 已有
│   │   ├── MarkdownRenderer.tsx ✅ 已有
│   │   └── DailyBriefing.tsx   🔴 待实现
│   │
│   ├── charts/
│   │   ├── HeatmapChart.tsx    🔴 待实现
│   │   ├── MasteryDonut.tsx    🔴 待实现
│   │   ├── TrendChart.tsx      🔴 待实现
│   │   └── WeakPointsList.tsx  🔴 待实现
│   │
│   ├── quiz/
│   │   ├── QuestionCard.tsx    🔴 待实现
│   │   ├── TraditionalQuiz.tsx 🔴 待实现
│   │   ├── AnkiCard.tsx        🔴 待实现
│   │   ├── ConversationQuiz.tsx 🔴 待实现
│   │   └── ErrorTypeFilter.tsx 🔴 待实现
│   │
│   ├── knowledge/
│   │   ├── ForceDirectedGraph.tsx 🔴 待实现
│   │   └── NodeDetail.tsx      🔴 待实现
│   │
│   ├── review/
│   │   ├── Calendar.tsx        🔴 待实现
│   │   └── ReviewList.tsx      🔴 待实现
│   │
│   ├── layout/
│   │   ├── DrawerContent.tsx   ✅ 已有
│   │   └── Header.tsx          🔴 待实现
│   │
│   └── forms/
│       ├── SettingsForm.tsx    🔴 待实现
│       ├── ExamPlanForm.tsx    🔴 待实现
│       └── FileUpload.tsx      🔴 待实现
│
├── stores/
│   ├── authStore.ts            ✅ 已有
│   ├── chatStore.ts            ✅ 已有
│   ├── quizStore.ts            🔴 待实现
│   └── appStore.ts             🔴 待实现 (theme, settings)
│
├── hooks/
│   ├── useTheme.ts             🔴 待实现
│   ├── useOffline.ts           🔴 待实现
│   └── useDimensions.ts        🔴 待实现
│
└── lib/
    ├── types.ts                ✅ 已有 (需要扩展)
    ├── api.ts                  ✅ 已有 (需要扩展)
    ├── storage.ts              ✅ 已有
    └── config.ts               ✅ 已有
```

---

## 📈 **周期规划**

### **Week 1: Foundation**
- [x] BottomTab导航框架
- [x] 晨间简报UI
- [x] 深色模式基础
- [ ] Dashboard图表库集成
- **交付物**：改进的主导航 + 更好的Home页

### **Week 2: Core Features**
- [ ] 完整Dashboard（所有图表）
- [ ] Knowledge Graph框架
- [ ] Quiz三种模式基础
- **交付物**：数据展示 + 图谱可交互

### **Week 3: Extended Features**
- [ ] Quiz三种模式完整
- [ ] Review Calendar
- [ ] Wrong Book
- [ ] Settings页面
- **交付物**：完整学习系统

### **Week 4: Polish**
- [ ] Resources上传
- [ ] Course详情页
- [ ] 下拉刷新
- [ ] 手势优化
- **交付物**：所有页面可用

### **Week 5: Optimization**
- [ ] 离线支持
- [ ] 性能优化
- [ ] 深色模式完整
- [ ] Bug修复
- **交付物**：生产就绪

---

## 🎯 **第一步行动清单**

### **今天完成**
- [ ] 创建 BottomTab 导航框架
- [ ] 添加5个占位 Screens
- [ ] 实现 DailyBriefing 组件
- [ ] 在 HomeScreen 集成日报

### **这周完成**
- [ ] 集成 react-native-chart-kit
- [ ] Dashboard 图表组件完成
- [ ] 深色模式全局适配
- [ ] 测试导航流畅性

### **下周开始**
- [ ] Knowledge Graph 方案确认
- [ ] Skia 库集成
- [ ] Quiz Store 设计

---

## 📦 **需要安装的库**

```bash
# 必需
npm install react-native-chart-kit
npm install react-native-calendars
npm install react-native-gesture-handler react-native-reanimated

# 可选但推荐
npm install react-native-skia                # Canvas替代品
npm install react-native-document-picker     # 文件上传
npm install lottie-react-native             # 动画效果

# 开发工具
npm install --save-dev @types/react-native-chart-kit
```

---

## ✅ **验收标准**

每个功能完成时应满足：
- [ ] 功能完整，无明显bug
- [ ] 移动端交互友好（触屏优化）
- [ ] 响应式设计（支持竖屏和横屏）
- [ ] 安全区域处理（刘海屏）
- [ ] 深色模式兼容
- [ ] 离线状态提示
- [ ] 加载状态有视觉反馈

---

生成时间：2026-04-11
