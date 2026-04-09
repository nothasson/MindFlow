export interface ParseResult {
  closedContent: string;
  pendingContent: string;
}

/**
 * 将流式 Markdown 文本分割为「已闭合」和「未闭合」两部分。
 * 已闭合部分可安全交给 Markdown 渲染器，未闭合部分用纯文本显示。
 */
export function parseStreamingMarkdown(text: string): ParseResult {
  if (!text) {
    return { closedContent: "", pendingContent: "" };
  }

  // Step 1: 检测是否在未闭合的代码块内
  const fencePositions: number[] = [];
  const fenceRegex = /^```/gm;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    fencePositions.push(match.index);
  }

  // 奇数个 ``` 表示最后一个代码块未闭合
  if (fencePositions.length % 2 === 1) {
    const lastOpenFence = fencePositions[fencePositions.length - 1];
    return {
      closedContent: text.slice(0, lastOpenFence),
      pendingContent: text.slice(lastOpenFence),
    };
  }

  // Step 2: 不在代码块内，找最后一个段落分隔符
  const lastDoubleNewline = text.lastIndexOf("\n\n");

  if (lastDoubleNewline === -1) {
    // 没有完整段落
    return { closedContent: "", pendingContent: text };
  }

  const closed = text.slice(0, lastDoubleNewline + 2);
  const tail = text.slice(lastDoubleNewline + 2);

  if (!tail) {
    // 文本恰好以 \n\n 结尾，全部已闭合
    return { closedContent: closed, pendingContent: "" };
  }

  // Step 3: 检查尾部是否在未闭合的表格或列表中
  if (isInTable(tail) || isInList(tail)) {
    return { closedContent: closed, pendingContent: tail };
  }

  // 尾部是普通段落，作为 pending
  return { closedContent: closed, pendingContent: tail };
}

function isInTable(text: string): boolean {
  const lines = text.split("\n").filter(Boolean);
  return lines.length > 0 && lines[lines.length - 1].trimStart().startsWith("|");
}

function isInList(text: string): boolean {
  const lines = text.split("\n").filter(Boolean);
  if (lines.length === 0) return false;
  const lastLine = lines[lines.length - 1];
  return /^(\s*[-*+]|\s*\d+\.)\s/.test(lastLine);
}
