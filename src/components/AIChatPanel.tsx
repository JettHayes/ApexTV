'use client';

import { formatAppError, readJsonResponse, reportAppError } from '@/lib/app-error';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { Bot, ChevronDown, Copy, Loader2, RefreshCw, Send, Sparkles, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';

import { VideoContext } from '@/lib/ai-orchestrator';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { smoothScrollBehavior } from '@/lib/motion';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  retryMessage?: string;
  /** 本回合执行过的工具调用（含参数与返回结果），随 history 回喂服务端 */
  toolCalls?: Array<{
    name: string;
    key?: string;
    args?: any;
    result?: string;
    ok?: boolean;
  }>;
  /** 较早对话被压缩后写回的摘要正文；存在时替换 toolCalls 随 history 回喂（避免下次请求上下文重新膨胀） */
  compressedSummaries?: string[];
}

/** 工具链中的一个工具调用 */
interface ToolChainItem {
  name: string;
  status: 'running' | 'done' | 'failed';
  key?: string;
  args?: any;
  result?: string;
  ok?: boolean;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context?: VideoContext;
  welcomeMessage?: string;
  onStreamingChange?: (isStreaming: boolean) => void;
  useDrawer?: boolean;
  drawerWidth?: string;
  embedded?: boolean;
}

type MarkdownSegment =
  | { type: 'markdown'; content: string }
  | {
      type: 'table';
      header: string[];
      align: Array<'left' | 'center' | 'right' | undefined>;
      rows: string[][];
    };

const splitMarkdownTableRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === '|' && trimmed[i - 1] !== '\\') {
      cells.push(current.replace(/\\\|/g, '|').trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.replace(/\\\|/g, '|').trim());
  return cells;
};

const getTableAlign = (cell: string): 'left' | 'center' | 'right' | undefined => {
  const trimmed = cell.trim();
  if (!/^:?-{3,}:?$/.test(trimmed)) return undefined;
  if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
  if (trimmed.endsWith(':')) return 'right';
  return 'left';
};

const isTableDelimiterRow = (line: string): boolean => {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
};

const normalizeTableRow = (cells: string[], length: number): string[] => {
  if (cells.length === length) return cells;
  if (cells.length > length) return cells.slice(0, length);
  return [...cells, ...Array.from({ length: length - cells.length }, () => '')];
};

const splitMarkdownByTables = (content: string): MarkdownSegment[] => {
  const lines = content.split('\n');
  const segments: MarkdownSegment[] = [];
  const markdownBuffer: string[] = [];
  let inFence = false;
  let i = 0;

  const flushMarkdown = () => {
    const markdown = markdownBuffer.join('\n');
    if (markdown.trim()) {
      segments.push({ type: 'markdown', content: markdown });
    }
    markdownBuffer.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      markdownBuffer.push(line);
      i++;
      continue;
    }

    if (
      !inFence &&
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableDelimiterRow(lines[i + 1])
    ) {
      const header = splitMarkdownTableRow(line);
      const delimiter = splitMarkdownTableRow(lines[i + 1]);

      if (header.length === delimiter.length) {
        flushMarkdown();

        const rows: string[][] = [];
        i += 2;

        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
          rows.push(normalizeTableRow(splitMarkdownTableRow(lines[i]), header.length));
          i++;
        }

        segments.push({
          type: 'table',
          header,
          align: delimiter.map(getTableAlign),
          rows,
        });
        continue;
      }
    }

    markdownBuffer.push(line);
    i++;
  }

  flushMarkdown();
  return segments;
};

const transformStrikethrough = (line: string): string => {
  return line;
};

const transformTaskList = (line: string): string => {
  return line.replace(/^(\s*[-*+]\s+)\[(x|X| )\]\s+/g, (_match, prefix: string, checked: string) => {
    return `${prefix}${checked.trim() ? '☑' : '☐'} `;
  });
};

const transformBareLinks = (line: string): string => {
  return line.replace(/(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)/g, (match, _url: string, offset: number, source: string) => {
    const before = source.slice(Math.max(0, offset - 2), offset);
    const previousChar = source[offset - 1];
    const lastOpenBracket = source.lastIndexOf('[', offset);
    const lastCloseBracket = source.lastIndexOf(']', offset);
    const nextCloseBracket = source.indexOf(']', offset + match.length);
    const nextOpenParen = nextCloseBracket >= 0 ? source.slice(nextCloseBracket, nextCloseBracket + 2) : '';

    // 已经是 Markdown 链接目标或链接文本时不重复转换。
    if (before === '](' || previousChar === '<' || (lastOpenBracket > lastCloseBracket && nextOpenParen === '](')) {
      return match;
    }

    const trailing = match.match(/[.,!?;:，。！？；：]+$/)?.[0] || '';
    const cleanUrl = trailing ? match.slice(0, -trailing.length) : match;
    const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;

    return `[${cleanUrl}](${href})${trailing}`;
  });
};

const transformLightweightGfm = (content: string): string => {
  const lines = content.split('\n');
  let inFence = false;

  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }

    if (inFence) return line;

    return transformBareLinks(transformStrikethrough(transformTaskList(line)));
  }).join('\n');
};

const renderStrikethroughNodes = (children: React.ReactNode): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const parts: React.ReactNode[] = [];
      const regex = /~~([^~\n]+)~~/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(child)) !== null) {
        if (match.index > lastIndex) {
          parts.push(child.slice(lastIndex, match.index));
        }

        parts.push(<del key={`${match.index}-${match[1]}`}>{match[1]}</del>);
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < child.length) {
        parts.push(child.slice(lastIndex));
      }

      return parts.length > 0 ? parts : child;
    }

    if (React.isValidElement(child) && (child as any).props?.children) {
      return React.cloneElement(child as any, {
        children: renderStrikethroughNodes((child as any).props.children),
      });
    }

    return child;
  });
};

export default function AIChatPanel({
  isOpen,
  onClose,
  context,
  welcomeMessage = '你好！我是ApexTV的AI影视助手，有什么可以帮你的吗？',
  onStreamingChange,
  useDrawer = false,
  drawerWidth = 'w-full md:w-[min(420px,50vw)]',
  embedded = false,
}: AIChatPanelProps) {
  const pathname = usePathname();

  // 使用 useMemo 稳定 storage key，只在实际内容变化时才改变
  const storageKey = useMemo(() => {
    if (context?.title) {
      return `ai-chat-${context.title}-${context.year || ''}-${context.type || ''}`;
    }
    return 'ai-chat-general';
  }, [context?.title, context?.year, context?.type]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [copiedContent, setCopiedContent] = useState('');
  const [copyError, setCopyError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('用户');
  // 工具链：每个工具调用一行，记录工具名、关键参数、状态（独立于消息，不写入 sessionStorage）
  const [toolChain, setToolChain] = useState<ToolChainItem[]>([]);
  // 工具链实时镜像，供流式结束固化到消息时读取最新状态（setState 是异步的）
  const toolChainRef = useRef<ToolChainItem[]>([]);
  const conversationRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const followLatestRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevStorageKeyRef = useRef<string>(storageKey);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);
  /** 本次请求服务端上下文压缩产生的摘要，流式结束后随本消息固化回喂 */
  const compressionSummariesRef = useRef<string[]>([]);

  // 工具名称 → 展示文案
  const TOOL_LABELS: Record<string, string> = {
    get_current_time: '获取当前时间',
    web_search: '联网搜索',
    fetch_page: '抓取网页',
    douban_lookup: '豆瓣数据',
    tmdb_lookup: 'TMDB 数据',
    get_user_favorites: '读取收藏',
    get_user_recent: '最近观看',
  };

  // 工具名称 → 关键参数提取（用于工具链展示）
  const TOOL_KEY_EXTRACTORS: Record<string, (args: any) => string | undefined> = {
    web_search: (a) => a?.query,
    fetch_page: (a) => a?.url,
    douban_lookup: (a) => a?.query || (a?.id ? `ID:${a.id}` : undefined),
    tmdb_lookup: (a) =>
      a?.trending ? '热榜' : a?.query || (a?.id ? `ID:${a.id}` : undefined),
  };

  // 工具链：追加一个进行中的工具调用
  const pushToolChain = (name: string, args?: any) => {
    const extractor = TOOL_KEY_EXTRACTORS[name];
    const key = extractor ? extractor(args) : undefined;
    const item: ToolChainItem = { name, status: 'running', key, args };
    toolChainRef.current = [...toolChainRef.current, item];
    setToolChain(toolChainRef.current);
  };

  // 工具链：将某个进行中的工具标记为完成
  const finishToolChain = (name: string, done?: { result?: string; ok?: boolean }) => {
    toolChainRef.current = toolChainRef.current.map((item) =>
      item.name === name && item.status === 'running'
        ? {
            ...item,
            status: done && done.ok === false ? 'failed' : 'done',
            ...(done && { result: done.result, ok: done.ok }),
          }
        : item
    );
    setToolChain(toolChainRef.current);
  };

  // 工具链：全部重置（新请求 / 上下文切换 / 清空）
  const clearToolChain = () => {
    toolChainRef.current = [];
    setToolChain([]);
  };

  // 工具链渲染：显示每个工具调用的状态与关键参数（live=流式中，显示 spinner；否则显示完成状态）
  const renderToolChain = (items: ToolChainItem[], live: boolean) => {
    if (!items.length) return null;
    return (
      <div className='w-full space-y-1.5'>
        {items.map((item, i) => {
          const label = TOOL_LABELS[item.name] || item.name;
          // 持久化链没有 status，按 ok 推导；live 链自带 status
          const status = item.status || (item.ok === false ? 'failed' : 'done');
          const keyText =
            item.key && item.key.length > 60
              ? `${item.key.slice(0, 60)}...`
              : item.key;
          return (
            <div
              key={i}
              className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300'
            >
              {live && status === 'running' ? (
                <Loader2 size={14} className="animate-spin text-apex-accent-on-soft" />
              ) : (
                <span
                  className={
                    status === 'failed'
                      ? 'text-red-500'
                      : 'text-green-500'
                  }
                >
                  {status === 'failed' ? '✕' : '✓'}
                </span>
              )}
              <span className='flex-1 whitespace-nowrap'>{label}</span>
              {keyText && (
                <span className='max-w-[60%] truncate text-xs text-gray-400 dark:text-gray-500'>
                  {keyText}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 将《》包裹的影视名称转换为链接
  const convertTitleToLink = (content: string): string => {
    return content.replace(/《([^》]+)》/g, (match, title) => {
      const encodedTitle = encodeURIComponent(title);
      return `[《${title}》](/play?title=${encodedTitle})`;
    });
  };

  const markdownComponents = useMemo(() => ({
    del: ({ children }: any) => <del>{children}</del>,
    p: ({ children }: any) => <p>{renderStrikethroughNodes(children)}</p>,
    li: ({ children }: any) => <li>{renderStrikethroughNodes(children)}</li>,
    h1: ({ children }: any) => <h1>{renderStrikethroughNodes(children)}</h1>,
    h2: ({ children }: any) => <h2>{renderStrikethroughNodes(children)}</h2>,
    h3: ({ children }: any) => <h3>{renderStrikethroughNodes(children)}</h3>,
    h4: ({ children }: any) => <h4>{renderStrikethroughNodes(children)}</h4>,
    h5: ({ children }: any) => <h5>{renderStrikethroughNodes(children)}</h5>,
    h6: ({ children }: any) => <h6>{renderStrikethroughNodes(children)}</h6>,
    a: ({ href, children, ...props }: any) => {
      // 如果是内部链接（以 / 开头），使用 Next.js Link
      if (href?.startsWith('/')) {
        // 如果当前在 /play 页面且链接也是 /play，不做处理（返回纯文本）
        if (pathname === '/play' && href.startsWith('/play')) {
          return <span>{children}</span>;
        }
        return (
          <Link href={href} {...props}>
            {children}
          </Link>
        );
      }
      // 外部链接使用普通 a 标签
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
  }), [pathname]);

  const inlineMarkdownComponents = useMemo(() => ({
    ...markdownComponents,
    p: ({ children }: any) => <span>{renderStrikethroughNodes(children)}</span>,
  }), [markdownComponents]);

  const renderAssistantContent = (content: string) => {
    return splitMarkdownByTables(content).map((segment, segmentIndex) => {
      if (segment.type === 'markdown') {
        return (
          <ReactMarkdown key={segmentIndex} components={markdownComponents}>
            {transformLightweightGfm(convertTitleToLink(segment.content))}
          </ReactMarkdown>
        );
      }

      return (
        <div
          key={segmentIndex}
          className='not-prose overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10'
        >
          <div className='overflow-x-auto'>
            <table className='m-0 min-w-full border-separate border-spacing-0 text-left text-sm'>
              <thead>
                <tr className="bg-apex-selected dark:bg-apex-selected/40">
                {segment.header.map((cell, cellIndex) => (
                  <th
                    key={cellIndex}
                    className='whitespace-nowrap border-b border-gray-200 px-4 py-3 font-semibold text-gray-800 first:rounded-tl-xl last:rounded-tr-xl dark:border-gray-700 dark:text-gray-100'
                    style={{ textAlign: segment.align[cellIndex] }}
                  >
                    <ReactMarkdown components={inlineMarkdownComponents}>
                      {transformLightweightGfm(convertTitleToLink(cell))}
                    </ReactMarkdown>
                  </th>
                ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-gray-800'>
              {segment.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="transition-colors odd:bg-white even:bg-gray-50/70 hover:bg-apex-selected/70 dark:odd:bg-gray-900 dark:even:bg-gray-800/40 dark:hover:bg-apex-selected/25"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className='px-4 py-3 align-top leading-relaxed text-gray-700 dark:text-gray-200'
                      style={{ textAlign: segment.align[cellIndex] }}
                    >
                      <ReactMarkdown components={inlineMarkdownComponents}>
                        {transformLightweightGfm(convertTitleToLink(cell))}
                      </ReactMarkdown>
                    </td>
                  ))}
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    });
  };

  useEffect(() => {
    if (!isOpen && !embedded) return;
    const frame = window.requestAnimationFrame(() => {
      const conversation = conversationRef.current;
      if (conversation && followLatestRef.current) {
        conversation.scrollTo({ top: conversation.scrollHeight, behavior: isStreaming ? 'auto' : smoothScrollBehavior() });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, toolChain, isStreaming, isOpen, embedded]);

  useEffect(() => {
    if ((!isOpen && !embedded) || typeof ResizeObserver === 'undefined') return;
    const conversation = conversationRef.current;
    const composer = composerRef.current;
    if (!conversation || !composer) return;
    const observer = new ResizeObserver(() => {
      if (followLatestRef.current) conversation.scrollTop = conversation.scrollHeight;
    });
    observer.observe(conversation);
    observer.observe(composer);
    return () => observer.disconnect();
  }, [isOpen, embedded]);

  useEffect(() => {
    const authInfo = getAuthInfoFromBrowserCookie();
    setCurrentUsername(authInfo?.username || '用户');
  }, []);

  const userAvatarText = currentUsername.trim().charAt(0).toUpperCase() || '用';

  // 从sessionStorage加载消息记录
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 如果已经加载过当前 storageKey，跳过
    if (hasLoadedRef.current) return;

    const savedMessages = sessionStorage.getItem(storageKey);

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (error) {
        reportAppError(error, "加载聊天记录失败");
      }
    }

    // 标记为已加载
    hasLoadedRef.current = true;
  }, [storageKey]); // 当 storageKey 变化时重新加载

  // 保存消息记录到sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (error) {
      reportAppError(error, "保存聊天记录失败");
    }
  }, [messages, storageKey]); // 消息变化时保存

  // 检测VideoContext变化，清除旧的聊天记录
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (prevStorageKeyRef.current !== storageKey) {
      // 上下文变化了，取消正在进行的请求
      if (abortControllerRef.current) {
        console.log('视频上下文变化，取消正在进行的AI请求');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsStreaming(false);
      }

      // 清除消息并重置为欢迎消息
      console.log('视频上下文变化，清除聊天记录');
      clearToolChain();
      setMessages([{ role: 'assistant', content: welcomeMessage }]);

      // 重置加载标记，允许加载新视频的聊天记录
      hasLoadedRef.current = false;

      prevStorageKeyRef.current = storageKey;
    }
  }, [storageKey, welcomeMessage]); // 监听 storageKey 变化

  // 通知父组件 streaming 状态变化
  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  // 自动聚焦输入框和防止背景滚动
  useEffect(() => {
    if (isOpen) {
      // 检测是否为移动设备
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      checkMobile();

      // 只在非移动设备上聚焦输入框
      if (inputRef.current && window.innerWidth >= 768) {
        inputRef.current.focus();
      }

      // 只在非抽屉模式下防止背景滚动
      if (!useDrawer && !embedded) {
        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;

        // 获取滚动条宽度
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${scrollbarWidth}px`;

        return () => {
          document.body.style.overflow = originalOverflow;
          document.body.style.paddingRight = originalPaddingRight;
        };
      }
    }
  }, [isOpen, useDrawer, embedded]);

  const handleSendMessage = async (retryMessage?: string) => {
    const isRetry = typeof retryMessage === 'string';
    if (isStreaming || (!isRetry && !input.trim())) return;
    followLatestRef.current = true;

    const userMessage = isRetry ? retryMessage.trim() : input.trim();
    const requestHistory = (isRetry ? messages.slice(0, -2) : messages).filter(
      (m) => m.role !== 'assistant' || m.content !== welcomeMessage
    );
    if (!isRetry) setInput('');
    clearToolChain();
    compressionSummariesRef.current = [];

    // 重试时移除原来的用户消息和错误消息，避免历史记录重复。
    setMessages((prev) => [
      ...(isRetry ? prev.slice(0, -2) : prev),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: '' },
    ]);

    // 新请求开始时清空本次实时工具链（历史消息里的工具已固化，不影响）
    clearToolChain();

    setIsStreaming(true);

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          context,
          history: requestHistory,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await readJsonResponse<any>(response, "AI 请求");
     const errorMsg = errorData.error || errorData.details || `请求失败 (${response.status})`;
        throw new Error(errorMsg);
      }

      // 检查响应类型：流式(text/event-stream)或非流式(application/json)
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('text/event-stream')) {
        // 处理流式响应
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('无法读取响应流');
        }

        let assistantMessage = '';
        let streamError = '';
        let buffer = ''; // 缓冲区，用于保存不完整的行

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // 将新chunk与缓冲区拼接
          const text = buffer + chunk;
          // 按换行符分割，最后一个元素可能是不完整的行
          const parts = text.split('\n');
          // 保存最后一个不完整的行到缓冲区
          buffer = parts.pop() || '';

          // 处理完整的行
          const lines = parts.filter((line) => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                break;
              }

              try {
                const json = JSON.parse(data);

                // 新版工具式调用的工具进度事件
                if (json.type === 'tool') {
                  if (json.status === 'start') {
                    pushToolChain(json.name, json.args);
                  } else if (json.status === 'done') {
                    finishToolChain(json.name, {
                      result: json.result,
                      ok: json.ok,
                    });
                  } else if (json.status === 'failed') {
                    // 工具执行失败也标记为完成，但可在链上保留
                    finishToolChain(json.name, { result: json.result, ok: false });
                  }
                  continue;
                }

                if (json.error) {
                  streamError = formatAppError(json.error, 'AI 回答');
                  continue;
                }

                const text = json.text || '';

                if (text) {
                  assistantMessage += text;

              // 更新最后一条消息
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: 'assistant',
                      content: assistantMessage,
               };
                    return newMessages;
                  });
                }
              } catch (e) {
                reportAppError(e, "解析SSE数据失败");
              }
            }
          }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data && data !== '[DONE]') {
              try {
                const json = JSON.parse(data);
                if (json.error) {
                  streamError = String(json.error);
                }

                // 上下文压缩事件：摘要存入 ref，待流式结束后随本消息固化回喂
                if (json.type === 'context_compressed' && json.summary) {
                  compressionSummariesRef.current.push(`【较早对话已压缩】\n${json.summary}`);
                } else {
                  const text = json.text || '';
                  if (text) {
                    assistantMessage += text;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1] = {
                        role: 'assistant',
                        content: assistantMessage,
                      };
                      return newMessages;
                    });
                  }
                }
              } catch (e) {
                reportAppError(e, "解析最终缓冲区数据失败");
              }
            }
          }
        }

        // 流式结束：把本次实时工具链固化到最后一条 assistant 消息，
        // 使其跨消息持久显示，并随 history 回喂服务端（避免同一会话重复调工具）。
        const finishedTools = toolChainRef.current.map((t) => ({
          name: t.name,
          key: t.key,
          args: t.args,
          result: t.result,
          ok: t.ok,
        }));
        if (finishedTools.length || compressionSummariesRef.current.length) {
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: assistantMessage,
              ...(finishedTools.length ? { toolCalls: finishedTools } : {}),
              ...(compressionSummariesRef.current.length
                ? { compressedSummaries: compressionSummariesRef.current }
                : {}),
            };
            return newMessages;
          });
        }

        if (streamError) throw new Error(streamError);
        if (!assistantMessage.trim()) {
          throw new Error('AI服务未返回有效内容，请检查 API 密钥和服务配置');
        }
      } else {
        // 处理非流式响应
        const data = await readJsonResponse<any>(response, "AI 请求");
        if (data.error) throw new Error(String(data.error));
        const content = data.content || '';

        // 更新最后一条消息为完整响应
        setMessages((prev) => {
          const newMessages = [...prev];
          // 非流式压缩发生在本轮循环内，摘要随 JSON 返回
          const compressed = data.compressedSummary
            ? `【较早对话已压缩】\n${data.compressedSummary}`
            : undefined;
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: content,
            ...(compressed
              ? {
                  compressedSummaries: [
                    ...((prev[prev.length - 1] as ChatMessage)?.compressedSummaries || []),
                    compressed,
                  ],
                }
              : {}),
          };
          return newMessages;
        });
      }
    } catch (error) {
      // 如果是主动取消的请求（切换视频或其他原因），不显示错误
      if ((error as Error).name === 'AbortError') {
        console.log('请求已取消');
        return;
      }

      reportAppError(error, "发送消息失败");

      // 更新最后一条空消息为错误消息
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: 'assistant',
          content: `❌ 抱歉，出现了错误：\n\n${formatAppError(error, 'AI 问片')}`,
          error: true,
          retryMessage: userMessage,
        };
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
      // 流式/非流式结束后，实时工具链已固化到消息，这里清空 live 链
      clearToolChain();
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 清空聊天上下文
  const handleClearContext = () => {
    if (typeof window === 'undefined') return;

    // 清除sessionStorage
    sessionStorage.removeItem(storageKey);

    // 重置消息为欢迎消息
    setCopiedContent('');
    setCopyError('');
    clearToolChain();
    setMessages([{ role: 'assistant', content: welcomeMessage }]);

    console.log('已清空聊天上下文');
  };


  const suggestions = context?.title ? [
    { label: '这部作品讲了什么？', question: context.title + '讲的是什么故事？' },
    { label: '这部作品的评价', question: context.title + '这部作品评价怎么样？' },
    { label: '有没有续集？', question: context.title + '有没有续集？' },
    { label: '分析主要角色', question: '分析' + context.title + '中主要角色的成长线。' },
    { label: '推荐相似作品', question: '有哪些和' + context.title + '相似的电影或剧集？' },
    { label: '梳理关键情节', question: '帮我梳理' + context.title + '的关键情节，并先提醒是否包含剧透。' },
  ] : [
    { label: '推荐高分电影', question: '推荐一些高分电影' },
    { label: '最近有什么新片？', question: '最近有什么新电影上映？' },
    { label: '推荐一部轻松的作品', question: '推荐一部适合放松时观看的电影。' },
    { label: '想看科幻电影', question: '推荐几部值得看的科幻电影。' },
    { label: '适合朋友一起看', question: '推荐几部适合和朋友一起看的电影。' },
    { label: '推荐一部悬疑剧', question: '推荐一部情节紧凑的悬疑剧。' },
  ];
  const visibleSuggestions = Array.from({ length: 3 }, (_, index) => suggestions[(suggestionOffset + index) % suggestions.length]);
  const toolSummary = (items: ToolChainItem[], live: boolean) => items.length > 0 ? (
    <details className='f1-ai-tools' open>
      <summary><Sparkles size={14} aria-hidden /><span>调用工具</span><small>{items.length} 项</small><ChevronDown size={14} aria-hidden /></summary>
      <div>{renderToolChain(items, live)}</div>
    </details>
  ) : null;

  const modalContent = (
    <div className={embedded ? 'f1-ai-embedded' : 'f1-ai-overlay fixed inset-0 z-[1002] flex transition-[opacity,visibility] duration-200 ' + (isOpen ? 'opacity-100' : 'invisible pointer-events-none opacity-0') + (useDrawer ? ' pointer-events-none items-stretch justify-end' : ' items-center justify-center')}
      data-mode={embedded ? 'embedded' : useDrawer ? 'drawer' : 'dialog'} aria-hidden={!isOpen}
      onClick={(event) => { if (!useDrawer && event.target === event.currentTarget && isOpen) onClose(); }}>
      <section role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : !useDrawer} aria-label='AI 问片助手'
        className={'f1-ai-panel f1-ai-reference pointer-events-auto flex flex-col overflow-hidden ' + (useDrawer ? drawerWidth : '') + (useDrawer && !isOpen ? ' translate-x-full' : '')}>
        <header className='f1-ai-header'>
          <div className='f1-ai-heading'><Sparkles size={19} aria-hidden /><h2>AI 问片助手</h2></div>
          <div className='f1-ai-header-actions'>
            <button type='button' onClick={handleClearContext} disabled={isStreaming} aria-label='清空聊天记录' title='清空聊天记录'><Trash2 size={17} /></button>
            <button type='button' onClick={onClose} aria-label='关闭 AI 问片'><X size={19} /></button>
          </div>
          <p>{context?.title ? '正在讨论：' + context.title + (context.year ? ' (' + context.year + ')' : '') : '为你解答剧情、角色与观影问题'}</p>
        </header>
        <div ref={conversationRef} className='f1-ai-conversation' onScroll={(event) => {
          const box = event.currentTarget;
          followLatestRef.current = box.scrollHeight - box.clientHeight - box.scrollTop < 64;
        }}>
          {messages.map((message, index) => (
            <article key={index} className={'f1-ai-turn f1-ai-turn--' + message.role}>
              <span className='f1-ai-avatar' aria-hidden='true'>{message.role === 'user' ? userAvatarText : <Bot size={17} />}</span>
              <div className='f1-ai-bubble'>
                {message.role === 'user' ? <p>{message.content}</p> : <>
                  {message.toolCalls && toolSummary(message.toolCalls as ToolChainItem[], false)}
                  {isStreaming && index === messages.length - 1 && toolSummary(toolChain, true)}
                  <div className='f1-ai-markdown prose prose-sm max-w-none dark:prose-invert'>{renderAssistantContent(message.content)}</div>
                  {message.error && index === messages.length - 1 && !isStreaming && message.retryMessage && (
                    <button type='button' className='f1-ai-retry' onClick={() => handleSendMessage(message.retryMessage)}><RefreshCw size={14} />重试</button>
                  )}
                  {isStreaming && index === messages.length - 1 && !message.content && toolChain.length === 0 && (
                    <div className='f1-ai-thinking' role='status'><Loader2 size={16} className='animate-spin' /><span>AI 正在思考…</span></div>
                  )}
                  {message.content && !(isStreaming && index === messages.length - 1) && (
                    <div className='f1-ai-message-actions'>
                      <button type='button' onClick={async () => {
                        setCopyError('');
                        try { await navigator.clipboard.writeText(message.content); setCopiedContent(message.content); }
                        catch { setCopyError('复制失败，请选中回复文字手动复制。'); }
                      }} aria-label='复制回复'><Copy size={14} />{copiedContent === message.content ? '已复制' : '复制'}</button>
                    </div>
                  )}
                </>}
              </div>
            </article>
          ))}
          <div className='f1-ai-scroll-end' aria-hidden='true' />
        </div>
        <footer ref={composerRef} className='f1-ai-composer'>
          <div className='f1-ai-suggestions'>
            <div><h3><Sparkles size={13} aria-hidden />推荐提问</h3><button type='button' disabled={isStreaming} onClick={() => setSuggestionOffset((value) => (value + 3) % suggestions.length)}><RefreshCw size={12} />换一换</button></div>
            <div>{visibleSuggestions.map((suggestion) => <button type='button' disabled={isStreaming} key={suggestion.question} onClick={() => { setInput(suggestion.question); inputRef.current?.focus(); }}>{suggestion.label}</button>)}</div>
          </div>
          <div className='f1-ai-input-row'>
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown}
              placeholder={isMobile ? '向 AI 问片助手提问…' : '向 AI 问片助手提问…（Shift+Enter 换行）'}
              aria-label='向 AI 问片助手提问' disabled={isStreaming} rows={1}
              onInput={(event) => { const field = event.currentTarget; field.style.height = 'auto'; field.style.height = Math.min(field.scrollHeight, 120) + 'px'; }} />
            <button type='button' className='f1-ai-send' onClick={() => handleSendMessage()} disabled={!input.trim() || isStreaming} aria-label={isStreaming ? '正在生成回复' : '发送问题'}>
              {isStreaming ? <Loader2 size={19} className='animate-spin' /> : <Send size={19} />}
            </button>
          </div>
          {copyError && <p className='f1-ai-copy-error' role='status'>{copyError}</p>}
        </footer>
      </section>
    </div>
  );

  return embedded ? modalContent : typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
