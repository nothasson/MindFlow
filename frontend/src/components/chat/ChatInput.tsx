"use client";

import { FormEvent, useState, KeyboardEvent } from "react";

interface ChatInputProps {
  isLoading: boolean;
  onSend: (content: string) => Promise<void> | void;
}

export function ChatInput({ isLoading, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || isLoading) return;
    setValue("");
    await onSend(content);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-[20px] bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你想学的内容..."
        rows={1}
        className="w-full resize-none rounded-[20px] bg-transparent px-6 pb-12 pt-5 text-[16px] text-stone-700 outline-none placeholder:text-stone-400"
      />
      <div className="absolute bottom-3 right-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-white transition hover:bg-stone-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
