import { CodeBlockFigure } from "@/components/docs/code-block-figure";
import { CodeCollapsibleWrapper } from "@/components/docs/code-collapsible-wrapper";
import { highlightCode } from "@/lib/highlight-code";
import { cn } from "@/lib/utils";

const COLLAPSIBLE_LINE_THRESHOLD = 16;

interface CodeBlockProps {
  className?: string;
  code: string;
  collapsible?: boolean;
  filename?: string;
  language?: string;
}

export const CodeBlock = async ({
  className,
  code,
  collapsible,
  filename,
  language = "tsx",
}: CodeBlockProps) => {
  const highlightedCode = await highlightCode(code, language);
  const shouldCollapse =
    collapsible ?? code.split("\n").length > COLLAPSIBLE_LINE_THRESHOLD;

  const figure = (
    <CodeBlockFigure
      className={shouldCollapse ? undefined : className}
      code={code}
      filename={filename}
      highlightedCode={highlightedCode}
      language={language}
    />
  );

  if (!shouldCollapse) {
    return figure;
  }

  return (
    <CodeCollapsibleWrapper className={cn(className)}>
      {figure}
    </CodeCollapsibleWrapper>
  );
};
