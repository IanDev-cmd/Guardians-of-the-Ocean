import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { prisma } from "../../../server/src/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

const bodySchema = z.object({
  email: z.string().email(),
  mode: z.enum(["payment", "subscription"]).default("payment"),
  amount: z.number().int().min(50).max(1_000_000).optional(),
});

export async function POST(req: Request) {
  const secret = process.env.CHECKOUT_USER_SECRET;
  if (secret) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const origin = (process.env.APP_BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
  const amount = parsed.data.amount ?? Number(process.env.CHECKOUT_AMOUNT_CENTS || 2500);
  const currency = (process.env.CHECKOUT_CURRENCY || "usd").toLowerCase();

  const user = await prisma.user.upsert({
    where: { email: parsed.data.email },
    update: {},
    create: { email: parsed.data.email },
  });

  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: parsed.data.email,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    });
  }

  const pending = await prisma.order.create({
    data: {
      userId: user.id,
      stripeSessionId: `pending_${crypto.randomUUID()}`,
      amount,
      currency,
      status: "pending",
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: parsed.data.mode,
    customer: stripeCustomerId,
    client_reference_id: user.id,
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart.html`,
    metadata: { userId: user.id, orderId: pending.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          ...(parsed.data.mode === "subscription"
            ? { recurring: { interval: "month" as const } }
            : {}),
          product_data: {
            name: "Guardians of the Ocean · restoration credit",
          },
        },
      },
    ],
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
  }

  await prisma.order.update({
    where: { id: pending.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url, orderId: pending.id, sessionId: session.id });
}
