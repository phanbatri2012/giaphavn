import { PayOS } from "@payos/node";

export function createPayOSClient() {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) return undefined;
  return new PayOS({ clientId, apiKey, checksumKey, logLevel: "error" });
}
