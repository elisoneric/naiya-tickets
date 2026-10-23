import React, { useMemo } from 'react';

export interface FormattedMessageProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'bold_italic' | 'code' | 'link' | 'url' | 'email';
  value?: string;
  label?: string;
  url?: string;
  email?: string;
}

interface Block {
  type: 'paragraph' | 'ul' | 'ol' | 'codeblock' | 'blockquote' | 'heading';
  lines?: string[];
  items?: string[];
  code?: string;
  lang?: string;
  text?: string;
  level?: number;
}

/**
 * Strips markdown syntax for clean single/two-line previews and snippets.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\r?\n+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes an inline string into formatted elements.
 * Handles bold, italics, links, raw URLs, emails, and inline code.
 * Resilient to masked asterisks (e.g. 26*******93).
 */
function parseInline(text: string): InlineToken[] {
  if (!text) return [];

  // Matcher for inline Markdown elements
  // Group 1: [label](url) -> 2: label, 3: url
  // Group 4: ***bold-italic*** -> 5: text
  // Group 6: **bold** -> 7: text
  // Group 8: *italic* -> 9: text
  // Group 10: `code` -> 11: text
  // Group 12: url
  // Group 13: email
  const regex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|((?:https?:\/\/)[^\s<>"')]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.substring(lastIndex, match.index) });
    }

    if (match[1]) {
      tokens.push({ type: 'link', label: match[2], url: match[3] });
    } else if (match[4]) {
      tokens.push({ type: 'bold_italic', value: match[5] });
    } else if (match[6]) {
      tokens.push({ type: 'bold', value: match[7] });
    } else if (match[8]) {
      tokens.push({ type: 'italic', value: match[9] });
    } else if (match[10]) {
      tokens.push({ type: 'code', value: match[11] });
    } else if (match[12]) {
      tokens.push({ type: 'url', url: match[12] });
    } else if (match[13]) {
      tokens.push({ type: 'email', email: match[13] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.substring(lastIndex) });
  }

  return tokens;
}

/**
 * Splits markdown content into structural blocks (paragraphs, lists, code blocks, etc.).
 */
function parseBlocks(content: string): Block[] {
  if (!content) return [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing
      blocks.push({ type: 'codeblock', lang, code: codeLines.join('\n') });
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    // Regular paragraph
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].match(/^#{1,6}\s+/)
    ) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', lines: pLines });
  }

  return blocks;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  className = '',
  isUser = false
}) => {
  const blocks = useMemo(() => parseBlocks(content || ''), [content]);

  if (!content) return null;

  const renderInlineTokens = (tokens: InlineToken[], keyPrefix: string) => {
    return tokens.map((token, idx) => {
      const key = `${keyPrefix}-${idx}`;
      switch (token.type) {
        case 'bold_italic':
          return (
            <strong key={key} className={`font-bold italic ${isUser ? 'text-white' : 'text-surface-900 dark:text-white'}`}>
              {token.value}
            </strong>
          );
        case 'bold':
          return (
            <strong key={key} className={`font-bold ${isUser ? 'text-white' : 'text-surface-900 dark:text-white'}`}>
              {token.value}
            </strong>
          );
        case 'italic':
          return (
            <em key={key} className="italic opacity-90">
              {token.value}
            </em>
          );
        case 'code':
          return (
            <code
              key={key}
              className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                isUser
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-100 dark:bg-dark-hover text-brand-600 dark:text-brand-300 border border-surface-200/60 dark:border-dark-border/60'
              }`}
            >
              {token.value}
            </code>
          );
        case 'link':
          return (
            <a
              key={key}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-semibold transition-opacity break-all ${
                isUser
                  ? 'text-white underline hover:opacity-80'
                  : 'text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
              }`}
            >
              {token.label || token.url}
            </a>
          );
        case 'url':
          return (
            <a
              key={key}
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-semibold transition-opacity break-all ${
                isUser
                  ? 'text-white underline hover:opacity-80'
                  : 'text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
              }`}
            >
              {token.url}
            </a>
          );
        case 'email':
          return (
            <a
              key={key}
              href={`mailto:${token.email}`}
              className={`underline font-medium transition-opacity break-all ${
                isUser
                  ? 'text-white underline hover:opacity-80'
                  : 'text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300'
              }`}
              title={`Email ${token.email}`}
            >
              {token.email}
            </a>
          );
        case 'text':
        default:
          return <React.Fragment key={key}>{token.value}</React.Fragment>;
      }
    });
  };

  return (
    <div className={`space-y-2.5 leading-relaxed text-[13.5px] md:text-[14px] ${className}`}>
      {blocks.map((block, blockIdx) => {
        const blockKey = `b-${blockIdx}`;

        if (block.type === 'paragraph' && block.lines) {
          return (
            <p key={blockKey} className="m-0 leading-relaxed">
              {block.lines.map((line, lineIdx) => (
                <React.Fragment key={`${blockKey}-l-${lineIdx}`}>
                  {lineIdx > 0 && <br />}
                  {renderInlineTokens(parseInline(line), `${blockKey}-l-${lineIdx}`)}
                </React.Fragment>
              ))}
            </p>
          );
        }

        if (block.type === 'ul' && block.items) {
          return (
            <ul key={blockKey} className="my-2 space-y-1.5 pl-0.5 list-none">
              {block.items.map((item, itemIdx) => (
                <li key={`${blockKey}-i-${itemIdx}`} className="flex items-start gap-2.5">
                  <span
                    className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                      isUser ? 'bg-white/80' : 'bg-brand-500 dark:bg-brand-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    {renderInlineTokens(parseInline(item), `${blockKey}-i-${itemIdx}`)}
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ol' && block.items) {
          return (
            <ol key={blockKey} className="my-2 space-y-1.5 pl-1 list-none counter-reset">
              {block.items.map((item, itemIdx) => (
                <li key={`${blockKey}-i-${itemIdx}`} className="flex items-start gap-2">
                  <span
                    className={`text-xs font-bold shrink-0 min-w-[1.2rem] tabular-nums ${
                      isUser ? 'text-white/80' : 'text-brand-600 dark:text-brand-400'
                    }`}
                  >
                    {itemIdx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    {renderInlineTokens(parseInline(item), `${blockKey}-i-${itemIdx}`)}
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'codeblock') {
          return (
            <div
              key={blockKey}
              className={`my-2 rounded-xl overflow-hidden border font-mono text-xs ${
                isUser
                  ? 'bg-black/30 border-white/20 text-white'
                  : 'bg-surface-900 border-surface-800 text-surface-100 dark:bg-black/40 dark:border-dark-border'
              }`}
            >
              {block.lang && (
                <div
                  className={`px-3 py-1 text-2xs uppercase tracking-wider font-bold border-b ${
                    isUser
                      ? 'bg-black/40 border-white/10 text-white/70'
                      : 'bg-surface-800 border-surface-700 text-surface-400'
                  }`}
                >
                  {block.lang}
                </div>
              )}
              <pre className="p-3 overflow-x-auto leading-relaxed">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={blockKey}
              className={`my-2 pl-3 py-1 text-xs italic border-l-2 rounded-r-lg ${
                isUser
                  ? 'border-white/60 bg-white/10 text-white/90'
                  : 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20 text-surface-700 dark:text-surface-300'
              }`}
            >
              {renderInlineTokens(parseInline(block.text || ''), blockKey)}
            </blockquote>
          );
        }

        if (block.type === 'heading') {
          const Tag = (block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
          const sizeClass =
            block.level === 1
              ? 'text-base font-bold'
              : block.level === 2
              ? 'text-sm font-bold'
              : 'text-xs font-bold uppercase tracking-wider';

          return (
            <Tag key={blockKey} className={`${sizeClass} mt-3 mb-1 text-surface-900 dark:text-white`}>
              {renderInlineTokens(parseInline(block.text || ''), blockKey)}
            </Tag>
          );
        }

        return null;
      })}
    </div>
  );
};
