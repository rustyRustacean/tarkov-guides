"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../lib/cn";

import type { ComponentProps } from "react";

/** Tabbed panel switcher, built on Radix's `Tabs`; roving tabindex and arrow-key navigation come free. */
export const Tabs = TabsPrimitive.Root;

/** Container for a `Tabs`' `TabsTrigger` buttons. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 items-center rounded-lg p-1",
        className,
      )}
      {...props}
    />
  );
}

/** A single tab button within a `TabsList`. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** The panel shown for a given `TabsTrigger`'s value. */
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-4", className)} {...props} />;
}
