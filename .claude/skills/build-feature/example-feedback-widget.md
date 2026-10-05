# Example: Feedback Widget (Complete Walkthrough)

This is a reference implementation showing every layer of a feature built in supastarter.

## 1. Database Schema

```prisma
// packages/database/prisma/schema.prisma
model Feedback {
    id        String   @id @default(cuid())
    userId    String?
    user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
    email     String?
    name      String?
    message   String
    type      String
    ipAddress String?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    @@map("feedback")
}

// Add relation to User model:
// feedbacks Feedback[]
```

## 2. Database Queries

```typescript
// packages/database/prisma/queries/feedback.ts
import { db } from "../client";

export async function createFeedback({
    message,
    type,
    email,
    name,
    ipAddress,
    userId,
}: {
    message: string;
    type: string;
    email?: string;
    name?: string;
    ipAddress?: string;
    userId?: string;
}) {
    return await db.feedback.create({
        data: { message, type, email, name, ipAddress, userId },
    });
}

// Export from packages/database/prisma/queries/index.ts:
// export * from "./feedback";
```

## 3. API Types

```typescript
// packages/api/modules/feedback/types.ts
import { z } from "zod";

export const feedbackSchema = z.object({
    message: z.string().min(10).max(1000),
    type: z.enum(["bug", "feature", "general"]).default("general"),
    email: z.string().email().optional(),
    name: z.string().min(2).max(100).optional(),
});

export type FeedbackFormValues = z.infer<typeof feedbackSchema>;
```

## 4. API Procedure

```typescript
// packages/api/modules/feedback/procedures/create.ts
import { ORPCError } from "@orpc/server";
import { auth } from "@repo/auth";
import { createFeedback } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import { feedbackSchema } from "../types";

export const createFeedbackProcedure = publicProcedure
    .route({
        method: "POST",
        path: "/feedback",
        tags: ["Feedback"],
        summary: "Submit user feedback",
    })
    .input(feedbackSchema)
    .output(z.object({ id: z.string(), message: z.string() }))
    .handler(async ({ input, context }) => {
        try {
            const session = await auth.api.getSession({ headers: context.headers });
            const ipAddress = context.headers.get("x-forwarded-for") ||
                             context.headers.get("x-real-ip") || undefined;
            const feedback = await createFeedback({
                ...input,
                ipAddress,
                userId: session?.user.id,
            });
            return { id: feedback.id, message: "Feedback submitted successfully" };
        } catch (error) {
            logger.error("Failed to submit feedback:", error);
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Could not submit feedback",
            });
        }
    });
```

```typescript
// packages/api/modules/feedback/router.ts
import { createFeedbackProcedure } from "./procedures/create";
export const feedbackRouter = { create: createFeedbackProcedure };

// Mount in packages/api/orpc/router.ts:
// import { feedbackRouter } from "../modules/feedback/router";
// Add: feedback: feedbackRouter
```

## 5. Frontend Component

```typescript
// apps/web/modules/shared/components/FeedbackWidget.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "@saas/auth/hooks/use-session";
import { Button } from "@ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@ui/components/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ui/components/form";
import { Input } from "@ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/select";
import { Textarea } from "@ui/components/textarea";
import { cn } from "@ui/lib";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { orpc } from "@shared/lib/orpc-query-utils";
import { toast } from "sonner";

// Schema, form, mutation, component with conditional fields for auth state
// See full implementation in the build-feature guide
```

## 6. Translations

```json
// packages/i18n/translations/en.json - add under root:
{
  "feedback": {
    "button": "Feedback",
    "title": "Send Feedback",
    "success": { "message": "Your feedback has been submitted successfully." },
    "error": { "message": "Failed to submit feedback" },
    "form": {
      "type": {
        "label": "Feedback Type",
        "placeholder": "Select feedback type",
        "options": { "general": "General", "bug": "Bug Report", "feature": "Feature Request" }
      },
      "name": { "label": "Name", "placeholder": "Your name" },
      "email": { "label": "Email", "placeholder": "your.email@example.com" },
      "message": { "label": "Message", "placeholder": "Tell us what you think..." },
      "submit": "Send Feedback"
    }
  }
}
```

## 7. Integration

```typescript
// Add to a layout, e.g. apps/web/app/(marketing)/layout.tsx
import { FeedbackWidget } from "@modules/shared/components/FeedbackWidget";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <FeedbackWidget />
        </>
    );
}
```
