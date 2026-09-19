import type { Request, Response, NextFunction } from "express";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import type { Env } from "../env.js";
import { prisma } from "../db.js";
import { HttpError } from "../http.js";

async function markProcessed(eventId: string, type: string): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({ data: { id: eventId, type } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}

async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (orderId) {
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing && existing.status !== "paid") {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "paid",
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      });
    }
  } else {
    await prisma.order.updateMany({
      where: { stripeSessionId: session.id, status: { not: "paid" } },
      data: {
        status: "paid",
        stripePaymentIntentId: paymentIntentId,
      },
    });
  }

  if (session.mode === "subscription" && session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    await prisma.subscription.updateMany({
      where: { stripeSessionId: session.id },
      data: { status: "active", stripeSubscriptionId: subId },
    });
  }
}

async function failPaymentIntent(pi: Stripe.PaymentIntent): Promise<void> {
  await prisma.order.updateMany({
    where: {
      stripePaymentIntentId: pi.id,
      status: { not: "paid" },
    },
    data: { status: "failed" },
  });
}

async function cancelSubscription(sub: Stripe.Subscription): Promise<void> {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: "canceled" },
  });
}

export function createWebhookHandler(stripe: Stripe, env: Env) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") {
        throw new HttpError(400, "Missing Stripe-Signature header");
      }

      const raw = req.body;
      if (!Buffer.isBuffer(raw)) {
        throw new HttpError(400, "Webhook body must be raw");
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          raw,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        );
      } catch {
        throw new HttpError(400, "Invalid webhook signature");
      }

      const fresh = await markProcessed(event.id, event.type);
      if (!fresh) {
        res.json({ received: true, duplicate: true });
        return;
      }

      switch (event.type) {
        case "checkout.session.completed":
          await fulfillCheckout(event.data.object as Stripe.Checkout.Session);
          break;
        case "payment_intent.payment_failed":
          await failPaymentIntent(event.data.object as Stripe.PaymentIntent);
          break;
        case "customer.subscription.deleted":
          await cancelSubscription(event.data.object as Stripe.Subscription);
          break;
        default:
          break;
      }

      res.json({ received: true });
    } catch (err) {
      next(err);
    }
  };
}
