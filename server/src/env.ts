import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  FRONTEND_ORIGIN: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(8787),
  CHECKOUT_USER_SECRET: z.string().optional().default(""),
  CHECKOUT_AMOUNT_CENTS: z.coerce.number().int().min(50).max(1_000_000).default(2500),
  CHECKOUT_CURRENCY: z.string().min(3).max(3).default("usd"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(details)}`);
  }
  return parsed.data;
}
