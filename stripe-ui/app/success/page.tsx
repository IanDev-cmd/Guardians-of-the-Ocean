"use client";

import { useEffect, useState } from "react";

type OrderStatus = {
  found?: boolean;
  fulfilled?: boolean;
  status?: string;
  amount?: number;
  currency?: string;
  orderId?: string;
};

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id || "";
  const [state, setState] = useState<OrderStatus>({});
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let stop = false;
    async function poll() {
      const res = await fetch(`/api/orders/status?session_id=${encodeURIComponent(sessionId)}`);
      const body = (await res.json()) as OrderStatus;
      if (stop) return;
      setState(body);
      if (!body.fulfilled && tries < 20) {
        setTimeout(() => setTries((n) => n + 1), 1500);
      }
    }
    void poll();
    return () => {
      stop = true;
    };
  }, [sessionId, tries]);

  return (
    <main>
      <h1>{state.fulfilled ? "Payment confirmed" : "Confirming payment…"}</h1>
      <p>
        Fulfillment is recorded only after the Stripe webhook updates the order.
        This redirect is not used as proof of payment.
      </p>
      {state.found ? (
        <p>
          Order {state.orderId}: {state.status}
        </p>
      ) : null}
    </main>
  );
}
