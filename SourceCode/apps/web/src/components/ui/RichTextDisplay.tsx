import "katex/dist/katex.min.css";

import katex from "katex";
import type { ReactNode } from "react";

import { cn } from "../../utils/cn";

type RichTextSegment =
  | {
      kind: "text";
      content: string;
    }
  | {
      kind: "math";
      content: string;
      displayMode: boolean;
    };

type RichTextBlock =
  | {
      kind: "text";
      content: string;
    }
  | {
      kind: "table";
      header: string[];
      rows: string[][];
    };

export type RichTextDisplayProps = {
  content: string;
  className?: string;
};

function normalizeLatexContent(content: string) {
  return content
    .replace(/\\\\(?=[A-Za-z])/g, "\\")
    // Thay thế \n thành xuống dòng, nhưng tha cho các chữ bắt đầu bằng \n (như \neq, \nabla...)
    .replace(/\\n(?![a-zA-Z])/g, "\n");
}

function unescapeMathEntities(math: string) {
  return math
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function splitTableRow(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine.startsWith("|") || !trimmedLine.endsWith("|")) {
    return null;
  }

  return trimmedLine
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell: string) {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function isTableSeparatorLine(line: string, columnCount: number) {
  const cells = splitTableRow(line);

  return Boolean(cells && cells.length === columnCount && cells.every(isSeparatorCell));
}

function parseRichTextBlocks(content: string): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];
  const lines = content.split("\n");
  const textBuffer: string[] = [];

  const flushTextBuffer = () => {
    if (textBuffer.length === 0) {
      return;
    }

    blocks.push({
      kind: "text",
      content: textBuffer.join("\n")
    });
    textBuffer.length = 0;
  };

  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const currentLine = lines[lineIndex];
    const header = currentLine ? splitTableRow(currentLine) : null;
    const nextLine = lines[lineIndex + 1];

    if (header && header.length > 0 && nextLine && isTableSeparatorLine(nextLine, header.length)) {
      const rows: string[][] = [];
      let rowIndex = lineIndex + 2;

      while (rowIndex < lines.length) {
        const rowLine = lines[rowIndex];
        const row = rowLine ? splitTableRow(rowLine) : null;

        if (!row || row.length !== header.length) {
          break;
        }

        rows.push(row);
        rowIndex += 1;
      }

      flushTextBuffer();
      blocks.push({
        kind: "table",
        header,
        rows
      });
      lineIndex = rowIndex;
      continue;
    }

    if (currentLine !== undefined) {
      textBuffer.push(currentLine);
    }
    lineIndex += 1;
  }

  flushTextBuffer();

  return blocks;
}

function parseInlineRichText(content: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawSegment = match[0];
    const matchIndex = match.index;

    if (matchIndex > cursor) {
      segments.push({
        kind: "text",
        content: content.slice(cursor, matchIndex)
      });
    }

    if (rawSegment.startsWith("$$") && rawSegment.endsWith("$$")) {
      segments.push({
        kind: "math",
        content: rawSegment.slice(2, -2),
        displayMode: true
      });
    } else {
      segments.push({
        kind: "math",
        content: rawSegment.slice(1, -1),
        displayMode: false
      });
    }

    cursor = matchIndex + rawSegment.length;
  }

  if (cursor < content.length) {
    segments.push({
      kind: "text",
      content: content.slice(cursor)
    });
  }

  return segments;
}

function renderMathSegment(segment: Extract<RichTextSegment, { kind: "math" }>, key: string) {
  const cleanMath = unescapeMathEntities(segment.content);
  const html = katex.renderToString(cleanMath, {
    throwOnError: false,
    displayMode: segment.displayMode
  });

  const className = segment.displayMode
    ? "my-2 block max-w-full overflow-x-auto overflow-y-hidden py-1"
    : "inline max-w-full overflow-x-auto align-baseline";

  return <span key={key} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderInlineContent(content: string, keyPrefix: string) {
  return parseInlineRichText(content).map((segment, index) => {
    const key = `${keyPrefix}-${segment.kind}-${index}`;

    if (segment.kind === "text") {
      return <span key={key}>{segment.content}</span>;
    }

    return renderMathSegment(segment, key);
  });
}

function renderTableBlock(block: Extract<RichTextBlock, { kind: "table" }>, key: string) {
  return (
    <span key={key} className="my-3 block max-w-full overflow-x-auto">
      <table className="min-w-full border-collapse overflow-hidden rounded-lg border border-border bg-white text-left text-sm">
        <thead className="bg-slate-50 text-text-primary">
          <tr>
            {block.header.map((cell, cellIndex) => (
              <th key={`${key}-head-${cellIndex}`} className="border border-border px-3 py-2 font-semibold align-top">
                {renderInlineContent(cell, `${key}-head-${cellIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-text-secondary">
          {block.rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/60">
              {row.map((cell, cellIndex) => (
                <td key={`${key}-row-${rowIndex}-${cellIndex}`} className="border border-border px-3 py-2 align-top">
                  {renderInlineContent(cell, `${key}-row-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  );
}

export function RichTextDisplay({ content, className }: RichTextDisplayProps) {
  const normalizedContent = normalizeLatexContent(content);

  if (!normalizedContent.trim()) {
    return null;
  }

  const children: ReactNode[] = parseRichTextBlocks(normalizedContent).map((block, index) => {
    const key = `${block.kind}-${index}`;

    if (block.kind === "text") {
      return <span key={key}>{renderInlineContent(block.content, key)}</span>;
    }

    return renderTableBlock(block, key);
  });

  return (
    <span
      className={cn(
        "rich-text-display block min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words",
        className
      )}
    >
      {children}
    </span>
  );
}
