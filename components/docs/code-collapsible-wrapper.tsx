"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface CodeCollapsibleWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const CodeCollapsibleWrapper = ({
  children,
  className,
}: CodeCollapsibleWrapperProps) => {
  const [isOpened, setIsOpened] = React.useState(false);

  return (
    <Collapsible
      className={cn(
        "group/collapsible relative md:-mx-1 [&_[data-rehype-pretty-code-title]]:pr-28",
        className
      )}
      onOpenChange={setIsOpened}
      open={isOpened}
    >
      <div className="absolute top-1.5 right-9 z-10 flex items-center">
        <CollapsibleTrigger
          render={
            <Button
              className="text-muted-foreground h-7 rounded-md pr-2 pl-3"
              size="sm"
              variant="ghost"
            />
          }
        >
          {isOpened ? "Collapse" : "Expand"}
        </CollapsibleTrigger>
        <Separator
          className="mx-1.5! h-4 self-center!"
          orientation="vertical"
        />
      </div>
      <div
        className={cn(
          "relative overflow-hidden [&>figure]:mt-0 [&>figure]:md:mx-0!",
          !isOpened && "max-h-64"
        )}
      >
        {children}
      </div>
      <CollapsibleTrigger
        className={cn(
          "via-background/70 to-background text-foreground absolute inset-x-0 -bottom-2 flex h-20 items-center justify-center rounded-b-lg bg-linear-to-b from-transparent p-0 text-sm",
          isOpened && "hidden"
        )}
      >
        <span className="bg-background/90 border-border rounded-lg border px-2 py-1">
          Expand
        </span>
      </CollapsibleTrigger>
    </Collapsible>
  );
};
