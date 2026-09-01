import { CopyButton } from "@/components/docs/copy-button";
import { LanguageIcon } from "@/components/docs/language-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CodeBlockFigureProps {
  className?: string;
  code: string;
  filename?: string;
  highlightedCode?: string;
  language?: string;
}

export const CodeBlockFigure = ({
  className,
  code,
  filename,
  highlightedCode,
  language = "tsx",
}: CodeBlockFigureProps) => (
  <figure className={cn(className)} data-rehype-pretty-code-figure="">
    {filename ? (
      <figcaption
        className="text-code-foreground [&_svg]:text-code-foreground flex min-w-0 items-center gap-2 pr-12 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-70"
        data-language={language}
        data-rehype-pretty-code-title=""
        title={filename}
      >
        <LanguageIcon language={language} />
        <span className="min-w-0 truncate text-left" dir="rtl">
          <span dir="ltr">{filename}</span>
        </span>
      </figcaption>
    ) : null}
    <CopyButton
      className={cn(
        "bg-code text-code-foreground hover:bg-code absolute top-3 right-2 z-10 size-7 hover:opacity-100 focus-visible:opacity-100",
        filename && "top-1.5!"
      )}
      value={code}
    />
    <ScrollArea className="max-h-96 w-full">
      {highlightedCode ? (
        <div
          // Highlighted HTML is generated server-side by Shiki from trusted source.
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
          data-not-typeset=""
        />
      ) : (
        <pre className="min-w-max !bg-transparent px-4 py-3.5 outline-none">
          <code data-line-numbers="">
            {(() => {
              const occurrenceByLine = new Map<string, number>();
              return code.split("\n").map((line) => {
                const occurrence = occurrenceByLine.get(line) ?? 0;
                occurrenceByLine.set(line, occurrence + 1);
                return (
                  <span data-line="" key={`${line}\0${occurrence}`}>
                    {line}
                    {"\n"}
                  </span>
                );
              });
            })()}
          </code>
        </pre>
      )}
    </ScrollArea>
  </figure>
);
