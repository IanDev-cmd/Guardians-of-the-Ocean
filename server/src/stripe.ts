import Stripe from "stripe";
import type { Env } from "./env.js";

export function createStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
}
