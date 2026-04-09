import { parseStreamingMarkdown } from "@/lib/markdown-parser";

import { MarkdownRenderer } from "./MarkdownRenderer";

interface StreamingMarkdownProps {
  content: string;
  isStreaming: boolean;
}

export function StreamingMarkdown({ content, isStreaming }: StreamingMarkdownProps) {
  if (!isStreaming || !content) {
    return <MarkdownRenderer content={content} />;
  }

  const { closedContent, pendingContent } = parseStreamingMarkdown(content);

  return (
    <>
      {closedContent ? <MarkdownRenderer content={closedContent} /> : null}
      {pendingContent ? (
        <span className="whitespace-pre-wrap">
          {pendingContent}
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-stone-400" />
        </span>
      ) : null}
    </>
  );
}
