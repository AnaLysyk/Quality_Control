"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { FiCheck, FiChevronDown } from "react-icons/fi";

import { cn } from "./cn";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-12 w-full items-center justify-between rounded-[20px] border border-(--tc-border) bg-(--tc-surface-2) px-4 py-3 text-sm text-(--tc-text-primary) outline-none transition",
      "focus-visible:ring-2 focus-visible:ring-[rgba(239,0,1,0.18)]",
      "data-placeholder:text-(--tc-text-muted)",
      className,
    )}
    {...props}
  >
    <span className="truncate">{children}</span>
    <SelectPrimitive.Icon asChild>
      <FiChevronDown className="h-4 w-4 shrink-0 text-(--tc-text-muted)" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        // Portalled dropdowns must clear auth/login overlays that use a very high stacking context.
        "z-2147483647 min-w-48 overflow-hidden rounded-[22px] border border-(--tc-border) bg-(--tc-surface) text-(--tc-text-primary) shadow-[0_24px_50px_rgba(15,23,42,0.12)]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto p-1.5">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-2xl py-2.5 pl-9 pr-3 text-sm outline-none transition",
      "focus:bg-(--tc-surface-2) focus:text-(--tc-text-primary)",
      className,
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <FiCheck className="h-4 w-4 text-(--tc-accent)" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
};
