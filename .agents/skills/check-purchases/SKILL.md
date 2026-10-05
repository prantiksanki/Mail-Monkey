---
name: check-purchases
description: Add purchase or subscription checks to components and API routes in this supastarter codebase. Use when gating features behind paid plans, checking active subscriptions, or implementing paywall logic.
argument-hint: [where-to-add-purchase-check]
---

# Check for Purchases or Subscriptions

Add purchase/subscription checks to gate premium features. The plan ID is defined in the `key` property of the plan object from the config file (e.g., `free`, `pro`, `enterprise`, `lifetime`).

## Client-Side: usePurchases Hook

Use the `usePurchases` hook in client components:

```typescript
"use client";

import { usePurchases } from "@saas/payments/hooks/use-purchases";

function SomeComponent() {
    const { activePlan, hasSubscription, hasPurchase } = usePurchases();

    // check if the user has an active subscription
    const hasActiveSubscription = hasSubscription();

    // check for a specific plan
    const hasProPurchase = hasPurchase("pro");

    // check for multiple plans
    const hasProOrEnterprisePurchase = hasPurchase(["pro", "enterprise"]);

    // check for one-time purchase (e.g., lifetime)
    const hasLifetimeAccess = hasPurchase("lifetime");
}
```

### With Organization Scope

```typescript
"use client";

import { usePurchases } from "@saas/payments/hooks/use-purchases";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";

function OrgFeature() {
    const { activeOrganization } = useActiveOrganization();
    const { activePlan, hasSubscription, hasPurchase } = usePurchases(activeOrganization!.id);
}
```

### Hook Return Values

- `activePlan` - The active plan of the user/org
- `purchases` - Array of all purchases
- `hasSubscription(planId?)` - Check for active subscription, optionally for specific plan(s)
- `hasPurchase(planId)` - Check for a specific purchase by plan ID or array of plan IDs

## Server-Side: React Server Components

```typescript
import { getPurchases } from "@saas/payments/lib/server";
import { createPurchasesHelper } from "@repo/payments/lib/helper";

export async function PremiumContent() {
    const purchases = await getPurchases();
    const { activePlan, hasSubscription, hasPurchase } = createPurchasesHelper(purchases);

    if (!hasSubscription("pro")) {
        return <UpgradePrompt />;
    }

    return <PremiumFeature />;
}
```

### With Organization Scope (RSC)

```typescript
import { getPurchases } from "@saas/payments/lib/server";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getActiveOrganization } from "@saas/organizations/lib/server";

const organization = await getActiveOrganization(organizationSlug);
const purchases = await getPurchases(organization.id);
const { activePlan, hasSubscription, hasPurchase } = createPurchasesHelper(purchases);
```

## Server-Side: API Routes (oRPC Procedures)

```typescript
import { getPurchases } from "../../payments/lib/purchases";
import { createPurchasesHelper } from "@repo/payments/lib/helper";

export const premiumAction = protectedProcedure
    .route({ method: "POST", path: "/premium-action", tags: ["Premium"] })
    .handler(async ({ context }) => {
        const purchases = await getPurchases({ organizationId: context.organizationId });
        // or: await getPurchases({ userId: context.user.id });
        const { hasSubscription, hasPurchase } = createPurchasesHelper(purchases);

        if (!hasSubscription("pro")) {
            throw new ORPCError({ code: "FORBIDDEN", message: "Pro plan required" });
        }

        // proceed with premium logic
    });
```

## Common Patterns

### Paywall Component

```typescript
"use client";

import { usePurchases } from "@saas/payments/hooks/use-purchases";

export function PaywallGate({ planId, children, fallback }: {
    planId: string | string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
    const { hasPurchase, hasSubscription } = usePurchases();
    const hasAccess = hasPurchase(planId) || hasSubscription(planId);

    if (!hasAccess) {
        return fallback ?? <UpgradeCTA />;
    }

    return <>{children}</>;
}
```

## Apply to: $ARGUMENTS
