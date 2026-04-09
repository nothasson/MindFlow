package memory

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStore_LongTermMemory(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 Store 失败: %v", err)
	}

	// 初始应为空
	content, err := store.GetLongTermMemory()
	if err != nil {
		t.Fatalf("读取失败: %v", err)
	}
	if content != "" {
		t.Error("初始应为空")
	}

	// 写入
	err = store.WriteLongTermMemory("# 学习画像\n\n## 已掌握\n- 二叉树")
	if err != nil {
		t.Fatalf("写入失败: %v", err)
	}

	// 读取
	content, err = store.GetLongTermMemory()
	if err != nil {
		t.Fatalf("读取失败: %v", err)
	}
	if content == "" {
		t.Error("写入后不应为空")
	}
}

func TestStore_DailyLog(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 Store 失败: %v", err)
	}

	// 追加日志
	err = store.AppendDailyLog("2026-04-09", "学习了二叉树遍历")
	if err != nil {
		t.Fatalf("追加失败: %v", err)
	}

	// 读取日志
	log, err := store.GetDailyLog("2026-04-09")
	if err != nil {
		t.Fatalf("读取失败: %v", err)
	}
	if log == "" {
		t.Error("日志不应为空")
	}

	// 验证文件存在
	path := filepath.Join(tmpDir, "memory", "2026-04-09.md")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("日志文件应存在")
	}
}

func TestStore_Search(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("创建 Store 失败: %v", err)
	}

	store.WriteLongTermMemory("掌握了二叉树遍历，特征值还不行")
	store.AppendTodayLog("今天复习了特征值分解")

	results, err := store.Search("特征值")
	if err != nil {
		t.Fatalf("搜索失败: %v", err)
	}
	if len(results) == 0 {
		t.Error("应找到包含'特征值'的记忆")
	}
}

func TestStore_DirectoryCreation(t *testing.T) {
	tmpDir := t.TempDir()
	subDir := filepath.Join(tmpDir, "nested", "deep")
	_, err := NewStore(subDir)
	if err != nil {
		t.Fatalf("创建嵌套目录失败: %v", err)
	}

	if _, err := os.Stat(filepath.Join(subDir, "memory")); os.IsNotExist(err) {
		t.Error("memory 子目录应被创建")
	}
}
