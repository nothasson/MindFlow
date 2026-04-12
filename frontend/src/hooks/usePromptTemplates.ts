"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getPromptTemplates, fillTemplate, type PromptTemplates } from "@/lib/api";

/** 默认 prompt 模板 — 后端不可用时的 fallback */
const DEFAULT_TEMPLATES: PromptTemplates = {
  learn_resource: "我想基于资料「{{filename}}」开始学习，请先帮我梳理重点知识点。",
  learn_concept: "我想学习知识点「{{concept}}」，请帮我深入理解这个概念。",
  learn_course_section: "我想学习课程「{{course_title}}」的第 {{section_index}} 章「{{section_title}}」。\n\n学习目标：\n{{learning_objectives}}\n\n请用苏格拉底式对话引导我理解这些内容。",
  review_concept: "复习一下{{concept}}",
  quiz_concept: "请针对「{{concept}}」出一道测试题",
};

/** 全局缓存和订阅机制，避免多个组件重复请求 */
let globalTemplates: PromptTemplates = { ...DEFAULT_TEMPLATES };
const globalListeners: Set<() => void> = new Set();
let globalFetched = false;

function subscribe(listener: () => void) {
  // 触发首次加载
  if (!globalFetched) {
    globalFetched = true;
    getPromptTemplates().then((t) => {
      // 合并：后端返回的覆盖默认值
      globalTemplates = { ...DEFAULT_TEMPLATES, ...t };
      globalListeners.forEach((l) => l());
    }).catch(() => {
      globalFetched = false;
    });
  }
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}

function getSnapshot(): PromptTemplates {
  return globalTemplates;
}

/**
 * 获取 prompt 模板的 Hook
 * 返回 { templates, fill } — templates 是模板映射，fill 是填充函数
 * 内置 fallback 默认模板，后端不可用时也能正常工作
 */
export function usePromptTemplates() {
  const templates = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  /** 获取指定场景的 prompt，填充变量 */
  const fill = useCallback((key: string, vars: Record<string, string>): string => {
    const tpl = templates[key] || DEFAULT_TEMPLATES[key] || "";
    if (!tpl) return "";
    return fillTemplate(tpl, vars);
  }, [templates]);

  return { templates, fill };
}
