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

function emailOf(raw: unknown): string {
  const value = String(raw || "").trim().toLowerCase();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "";
  return value;
}

export function createBalanceHandler(stripe: Stripe) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = emailOf(req.query.email);
      const fieldShare = 85;

      const [paidAgg, pendingAgg, personalPaid, personalPending, recent, stripeBal] = await Promise.all([
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
        email
          ? prisma.order.aggregate({
              where: { status: "paid", user: { email } },
              _sum: { amount: true },
              _count: true,
            })
          : Promise.resolve(null),
        email
          ? prisma.order.aggregate({
              where: { status: "pending", user: { email } },
              _sum: { amount: true },
              _count: true,
            })
          : Promise.resolve(null),
        email
          ? prisma.order.findMany({
              where: { user: { email } },
              orderBy: { createdAt: "desc" },
              take: 8,
              select: { id: true, amount: true, currency: true, status: true, createdAt: true },
            })
          : Promise.resolve([]),
        stripe.balance.retrieve().catch(() => null),
      ]);

      const available = stripeBal?.available?.[0];
      const pendingStripe = stripeBal?.pending?.[0];
      const currency = (available?.currency || pendingStripe?.currency || "usd").toLowerCase();
      const availableCents = available?.amount ?? 0;
      const pendingStripeCents = pendingStripe?.amount ?? 0;
      const paidCents = paidAgg._sum.amount ?? 0;
      const pendingOrderCents = pendingAgg._sum.amount ?? 0;
      const persPaidCents = personalPaid?._sum.amount ?? 0;
      const persPendCents = personalPending?._sum.amount ?? 0;
      const persPaidCount = personalPaid?._count ?? 0;
      const persPendCount = personalPending?._count ?? 0;

      let personalStatus = "ENTER EMAIL";
      if (email) {
        if (persPaidCount + persPendCount > 0) personalStatus = "LINKED";
        else personalStatus = "NO PAYOUTS";
      }

      res.json({
        live: !!stripeBal,
        currency,
        fund: {
          available: {
            cents: availableCents,
            label: money(availableCents, currency),
            status: availableCents > 0 ? "FUNDED" : "EMPTY",
          },
          pending: {
            cents: pendingStripeCents,
            label: money(pendingStripeCents, currency),
          },
          paid: {
            cents: paidCents,
            count: paidAgg._count,
            label: money(paidCents, currency),
          },
          split: {
            field: fieldShare,
            ops: 100 - fieldShare,
            label: `${fieldShare}/${100 - fieldShare} SPLIT`,
          },
        },
        personal: {
          email: email || null,
          status: personalStatus,
          paid: {
            cents: persPaidCents,
            count: persPaidCount,
            label: money(persPaidCents, currency),
          },
          pending: {
            cents: persPendCents,
            count: persPendCount,
            label: money(persPendCents, currency),
          },
          recent: recent.map((row) => ({
            id: row.id,
            amount: money(row.amount, row.currency),
            status: row.status,
            at: row.createdAt.toISOString(),
          })),
        },
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
