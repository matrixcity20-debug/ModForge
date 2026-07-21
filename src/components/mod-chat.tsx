import React from 'react';
import { Bot, Send, Trash2, ChevronDown, Loader2, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/markdown-renderer';

// ─── Mevcut modeller ──────────────────────────────────────────────────────────

export const CHAT_MODELS = [
  { id: 'openrouter:nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron Ultra 550B' },
  { id: 'openrouter:poolside/laguna-m.1:free',               label: 'Laguna M.1'          },
  { id: 'openrouter:tencent/hy3:free',                       label: 'Hunyuan 3'           },
  { id: 'openrouter:google/gemma-4-31b-it:free',             label: 'Gemma 4 31B'         },
  { id: 'openrouter:cohere/north-mini-code:free',            label: 'North Mini Code'     },
  { id: 'openrouter:nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron Super 120B' },
  { id: 'nvidia:nvidia/nemotron-3-ultra-550b-a55b',          label: 'Nemotron Ultra (NIM)'},
  { id: 'nvidia:meta/llama-3.3-70b-instruct',                label: 'Llama 3.3 70B (NIM)' },
] as const;

type ModelId = typeof CHAT_MODELS[number]['id'];

// ─── Mesaj tipleri ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ModChatProps {
  modId: number;
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export function ModChat({ modId }: ModChatProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [selectedModel, setSelectedModel] = React.useState<ModelId>(CHAT_MODELS[0].id);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // Yeni mesaj gelince en alta kaydır
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Textarea yüksekliğini içeriğe göre ayarla
  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const selectedModelLabel =
    CHAT_MODELS.find((m) => m.id === selectedModel)?.label ?? selectedModel;

  const handleSend = async () => {
    const userContent = input.trim();
    if (!userContent || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsStreaming(true);

    // Geçmiş mesajları (asistan placeholder dahil değil) API'ye gönder
    const history: { role: 'user' | 'assistant'; content: string }[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/mods/${modId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, model: selectedModel }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Sunucu hatası: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + chunk }
              : m,
          ),
        );
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content || `[Hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}]`,
              }
            : m,
        ),
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
      );
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setIsStreaming(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800">

      {/* ── Başlık ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
            AI Sohbet
          </span>
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider ml-1">
            — Modu Geliştir
          </span>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-zinc-500 hover:text-red-400 font-mono text-xs p-1 h-auto"
            title="Sohbeti temizle"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* ── Model seçici ──────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0 relative">
        <button
          onClick={() => setModelDropdownOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          <div className="flex items-center gap-1.5 truncate">
            <Bot className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate">{selectedModelLabel}</span>
          </div>
          <ChevronDown className={cn('w-3 h-3 text-zinc-500 shrink-0 transition-transform', modelDropdownOpen && 'rotate-180')} />
        </button>

        {modelDropdownOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl overflow-hidden">
            {CHAT_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m.id); setModelDropdownOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs font-mono hover:bg-zinc-800 transition-colors',
                  m.id === selectedModel ? 'text-primary bg-zinc-800' : 'text-zinc-300',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mesaj listesi ─────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500 font-mono">
                Bu modla ilgili her şeyi sorabilirsin.
              </p>
              <p className="text-xs text-zinc-700 mt-1 font-mono">
                Yeni özellik, hata düzeltme, optimizasyon...
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                  msg.role === 'user'
                    ? 'bg-primary/20 border border-primary/30'
                    : 'bg-zinc-800 border border-zinc-700',
                )}
              >
                {msg.role === 'user'
                  ? <User className="w-3 h-3 text-primary" />
                  : <Bot className="w-3 h-3 text-zinc-400" />
                }
              </div>

              {/* Balon */}
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary/15 border border-primary/20 text-zinc-100'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200',
                )}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                    {msg.content}
                  </p>
                ) : msg.content ? (
                  <div className="prose-sm prose-invert max-w-none text-xs leading-relaxed [&_code]:text-xs [&_pre]:text-xs [&_pre]:overflow-x-auto">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                ) : null}

                {msg.streaming && (
                  <span className="inline-flex items-center gap-1 mt-1 text-zinc-600">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span className="text-[10px] font-mono">yazıyor...</span>
                  </span>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Giriş alanı ───────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-zinc-800 shrink-0">
        <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 focus-within:border-zinc-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
            onKeyDown={handleKeyDown}
            placeholder="Bu moda ne eklemek istiyorsun? (Enter = gönder)"
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 font-mono outline-none min-h-[20px] max-h-[160px] py-0.5"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="h-7 w-7 p-0 rounded-lg shrink-0"
          >
            {isStreaming
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-zinc-700 font-mono mt-1.5 text-center">
          Shift+Enter yeni satır · Enter gönderir
        </p>
      </div>
    </div>
  );
}
