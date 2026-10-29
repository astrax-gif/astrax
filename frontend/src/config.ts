// ---- EDIT THESE ----
export const BRAND = "Astrax Tech";                // your brand
export const EMAIL = "abdurhmanbereket74@gmail.com"; // shown in the footer and used if no enquiry service is set
export const CAL_URL = "";                         // your Cal.com or Calendly link. Leave "" and "Book a Call" opens the contact form instead
export const TECH = ["C++", "Java", "Python", "TypeScript", "React", "FastAPI", "Git & GitHub", "Vercel", "Render"]; // list only what you have really used
export const AED_PER_USD = 3.6725;                 // AED is pegged to USD

// Backends (set in .env locally, in Vercel for production)
export const QUOTE_URL = (import.meta.env.VITE_QUOTE_API_URL ?? "").replace(/\/$/, "");
export const ENQUIRY_URL = (import.meta.env.VITE_ENQUIRY_API_URL ?? "").replace(/\/$/, "");

export type Currency = "USD" | "AED";

export interface Plan {
  name: string;
  usd: number;
  desc: string;
  recommended: boolean;
  features: [text: string, included: boolean][];
}

export const PLANS: Plan[] = [
  {
    name: "Basic Website",
    usd: 199,
    desc: "A clean, fast website that gets your business found online.",
    recommended: false,
    features: [
      ["Home, About, Services, Gallery and Contact pages", true],
      ["Services page with fixed content", true],
      ["Edit your own content", false],
      ["Online payments and orders", false],
      ["API integration", false],
      ["Email support", true],
      ["Hosting setup, SSL and basic SEO setup", true],
    ],
  },
  {
    name: "Editable Website",
    usd: 319,
    desc: "A website you can update yourself, with no code needed.",
    recommended: true,
    features: [
      ["All pages included", true],
      ["Add, edit and delete your services or products", true],
      ["Admin panel for content and settings", true],
      ["Online payments and orders", false],
      ["1 API integration included", true],
      ["Email support, reply within 1 business day", true],
      ["Hosting setup, SSL and basic SEO setup", true],
    ],
  },
  {
    name: "Fully Dynamic Website",
    usd: 549,
    desc: "A complete web platform for businesses that take orders, bookings or payments online.",
    recommended: false,
    features: [
      ["All pages included", true],
      ["Manage all your services, products and content", true],
      ["Full admin dashboard and settings control", true],
      ["Online payments and order management (1 gateway included)", true],
      ["Custom API integrations, scope agreed up front", true],
      ["Priority support", true],
      ["Hosting setup, SSL and basic SEO setup", true],
    ],
  },
];

export function money(usd: number, cur: Currency): string {
  return cur === "USD"
    ? `$${usd.toLocaleString("en-US")}`
    : `AED ${Math.round(usd * AED_PER_USD).toLocaleString("en-US")}`;
}
