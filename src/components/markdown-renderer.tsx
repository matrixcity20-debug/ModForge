import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={match[1]}
          PreTag="div"
          className="rounded-md !my-4 !bg-zinc-950 border border-zinc-800 text-sm overflow-hidden"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-zinc-100 dark:bg-zinc-800 text-primary font-mono px-1.5 py-0.5 rounded text-[0.85em]" {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none w-full
                    prose-headings:font-bold prose-headings:tracking-tight
                    prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                    prose-p:leading-relaxed
                    prose-a:text-primary hover:prose-a:text-primary/80 prose-a:no-underline
                    prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100
                    prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
