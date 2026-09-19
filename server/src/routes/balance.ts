import type { Request, Response, NextFunction } from "express";
import type Stripe from "stripe";
import { prisma } from "../db.js";
import { HttpError } from "../http.js";

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

export function createBalanceHandler(stripe: Stripe) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [balance, paidAgg, pendingAgg] = await Promise.all([
        stripe.balance.retrieve(),
        prisma.order.aggregate({
          where: { status: "paid" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.order.aggregate({
          where: { status: "pending" },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      const available = balance.available[0];
      const pendingStripe = balance.pending[0];
      const currency = (available?.currency || pendingStripe?.currency || "usd").toLowerCase();
      const availableCents = available?.amount ?? 0;
      const pendingStripeCents = pendingStripe?.amount ?? 0;
      const paidCents = paidAgg._sum.amount ?? 0;
      const pendingOrderCents = pendingAgg._sum.amount ?? 0;
      const fieldShare = 85;

      res.json({
        live: true,
        currency,
        operating: {
          cents: availableCents,
          label: money(availableCents, currency),
          status: availableCents > 0 ? "FUNDED" : "EMPTY",
        },
        payoutQueue: {
          cents: pendingStripeCents + pendingOrderCents,
          count: pendingAgg._count,
          label: `${pendingAgg._count} PENDING`,
        },
        spendSplit: {
          field: fieldShare,
          ops: 100 - fieldShare,
          label: `${fieldShare}/${100 - fieldShare} SPLIT`,
        },
        ledger: {
          paidCount: paidAgg._count,
          paid: money(paidCents, currency),
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export function createOrderStatusHandler() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = String(req.query.session_id || "");
      if (!sessionId) throw new HttpError(400, "session_id is required");
      const order = await prisma.order.findUnique({
        where: { stripeSessionId: sessionId },
        include: { user: { select: { email: true } } },
      });
      if (!order) {
        res.json({ status: "pending", found: false });
        return;
      }
      res.json({
        found: true,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        email: order.user.email,
        orderId: order.id,
        fulfilled: order.status === "paid",
      });
    } catch (err) {
      next(err);
    }
  };
}
