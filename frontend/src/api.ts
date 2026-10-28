import { ENQUIRY_URL, QUOTE_URL } from "./config";

export interface QuoteInput {
  plan: number;            // 0 Basic, 1 Editable, 2 Fully Dynamic
  extra_pages: number;
  integrations: number;
  extra_gateways: number;
  rush: boolean;
}

export interface QuoteResult {
  total: number;
  breakdown: { base: number; extra_pages: number; integrations: number; gateways: number; rush: number };
}

export interface EnquiryPayload {
  name: string;
  email: string;
  phone: string;
  business: string;
  message: string;
  plan: string;
}

// Calls the Python (FastAPI) service, which runs the C++ price engine.
export async function fetchQuote(input: QuoteInput, signal?: AbortSignal): Promise<QuoteResult> {
  if (!QUOTE_URL) throw new Error("The estimator is not connected yet.");
  const res = await fetch(`${QUOTE_URL}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : "Please check the values you entered.");
  }
  return data as QuoteResult;
}

// Sends the contact form to the Java enquiry service.
export async function sendEnquiry(payload: EnquiryPayload): Promise<void> {
  const res = await fetch(`${ENQUIRY_URL}/api/enquiry`, {
    method: "POST",
    body: new URLSearchParams({ ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
}
