export async function playtestingRequest<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/playtesting" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r
    .json()
    .catch(() => ({
      error:
        "The testing service is unavailable. Your draft is still on this device.",
    }));
  if (!r.ok) throw Error(data.error || "Could not reach the testing service");
  return data;
}

export async function proofOfWork(ticket: string) {
  const payload = JSON.parse(
      atob(ticket.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")),
    ),
    encoder = new TextEncoder();
  for (let counter = 0; counter < 10000000; counter++) {
    const hash = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(payload.nonce + ":" + counter),
      ),
    );
    if (hash[0] === 0 && hash[1] < 16) return counter;
    if (counter % 1000 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  throw Error("Browser check did not finish. Please retry.");
}
