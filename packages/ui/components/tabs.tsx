"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva(
	"inline-flex items-center justify-center text-card-foreground/80 text-sm",
	{
		variants: {
			variant: {
				line: "border-b-2",
				pill: "gap-0.5 rounded-full bg-muted p-1",
			},
		},
		defaultVariants: {
			variant: "line",
		},
	},
);

const TabsList = ({
	className,
	variant,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
	VariantProps<typeof tabsListVariants>) => (
	<TabsPrimitive.List
		className={cn(tabsListVariants({ variant }), className)}
		{...props}
	/>
);

const tabsTriggerVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap font-medium text-sm ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				line: "-mb-0.5 border-transparent border-b-2 px-3 py-2 text-foreground/60 hover:text-foreground/80 data-[state=active]:border-primary data-[state=active]:text-card-foreground",
				pill: "rounded-full px-5 py-2 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
			},
		},
		defaultVariants: {
			variant: "line",
		},
	},
);

const TabsTrigger = ({
	className,
	variant,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
	VariantProps<typeof tabsTriggerVariants>) => (
	<TabsPrimitive.Trigger
		className={cn(tabsTriggerVariants({ variant }), className)}
		{...props}
	/>
);

const TabsContent = ({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) => (
	<TabsPrimitive.Content
		className={cn(
			"mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			className,
		)}
		{...props}
	/>
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
