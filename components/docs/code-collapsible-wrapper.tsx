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
      className={cn("group/collapsible relative md:-mx-1", className)}
      onOpenChange={setIsOpened}
      open={isOpened}
    >
      <div className="flex h-10 items-center justify-end rounded-t-xl bg-code px-2 sm:absolute sm:top-1.5 sm:right-9 sm:z-10 sm:h-auto sm:rounded-none sm:bg-transparent sm:p-0">
        <CollapsibleTrigger
          render={
            <Button
              className="h-7 rounded-md px-2 text-muted-foreground"
              size="sm"
              variant="ghost"
            />
          }
        >
          {isOpened ? "Collapse" : "Expand"}
        </CollapsibleTrigger>
        <Separator
          className="mx-1.5! hidden h-4 sm:block"
          orientation="vertical"
        />
      </div>
      <div
        className={cn(
          "relative overflow-hidden [&>figure]:mt-0 [&>figure]:rounded-t-none! sm:[&>figure]:rounded-t-xl! [&>figure]:md:mx-0!",
          !isOpened && "max-h-64"
        )}
      >
        {children}
      </div>
      <CollapsibleTrigger
        className={cn(
          "absolute inset-x-0 -bottom-2 flex h-20 p-0 items-center justify-center rounded-b-lg bg-linear-to-b from-transparent via-background/70 to-background text-foreground text-sm",
          isOpened && "hidden"
        )}
      >
        <span className="bg-background/90 border border-border px-2 py-1 rounded-lg">
          Expand
        </span>
      </CollapsibleTrigger>
    </Collapsible>
  );
};
