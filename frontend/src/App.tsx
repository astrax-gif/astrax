import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { BRAND, CAL_URL, EMAIL, ENQUIRY_URL, NAME, PLANS, TECH, money } from "./config";
import type { Currency } from "./config";
import { fetchQuote, sendEnquiry } from "./api";
import type { QuoteResult } from "./api";

type ModalState = { plan: string; message: string } | null;

export default function App() {
  const [cur, setCur] = useState<Currency>("USD");
  const [modal, setModal] = useState<ModalState>(null);
  const openContact = (plan = "General enquiry", message = "") => setModal({ plan, message });

  useEffect(() => {
    document.title = `Websites for Businesses | ${BRAND}`;
  }, []);

  return (
    <>
      <Header onContact={() => openContact()} />
      <main id="top">
        <Hero />
        <Plans cur={cur} setCur={setCur} onPick={(name) => openContact(name)} />
        <Estimator cur={cur} onRequest={openContact} />
        <Tech />
        <About onContact={() => openContact()} />
        <Cta onContact={() => openContact()} />
      </main>
      <Footer />
      {modal && <ContactModal plan={modal.plan} initialMessage={modal.message} onClose={() => setModal(null)} />}
    </>
  );
}

function Header({ onContact }: { onContact: () => void }) {
  const [open, setOpen] = useState(false);
  const links: [string, string][] = [
    ["Home", "#top"], ["About", "#about"], ["Plans", "#plans"],
    ["Estimate", "#estimate"], ["Tech", "#tech"], ["Contact", "#contact"],
  ];
  return (
    <header>
      <div className="wrap nav">
        <a className="logo" href="#top">
          <i>{BRAND.trim().charAt(0).toUpperCase()}</i>
          <span>{BRAND}</span>
        </a>
        <nav className={`links${open ? " open" : ""}`}>
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
          ))}
        </nav>
        <div className="actions">
          <button className="btn line" onClick={onContact}>Get in Touch</button>
          <a className="btn fill" href="#plans">Start Project</a>
          <button className="menu" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="hero">
      <div className="wrap">
        <span className="pill dark">Web Development</span>
        <h1>Websites That Put Your Business <em>Online</em></h1>
        <p>
          From a simple page that helps customers find you, to a full platform that takes payments and orders.
          Pick a plan, get a clear price, and get a site that works.
        </p>
        <div className="row">
          <a className="btn fill" href="#plans">See Plans</a>
          <a className="btn ghost" href={CAL_URL} target="_blank" rel="noopener noreferrer">Book a Call →</a>
        </div>
      </div>
    </div>
  );
}

function Plans(props: { cur: Currency; setCur: (c: Currency) => void; onPick: (plan: string) => void }) {
  const { cur, setCur, onPick } = props;
  return (
    <section id="plans" className="alt">
      <div className="wrap center">
        <span className="pill">Choose Your Plan</span>
        <h2>Website <em>Plans</em></h2>
        <p className="lead">
          Responsive on every screen, fast loading and built to be found on Google. One-time prices, no hidden fees.
        </p>
        <div className="toggle">
          {(["USD", "AED"] as Currency[]).map((c) => (
            <button key={c} className={cur === c ? "on" : ""} onClick={() => setCur(c)}>
              {c === "USD" ? "$ USD" : "AED"}
            </button>
          ))}
        </div>
        <div className="grid">
          {PLANS.map((p) => (
            <article key={p.name} className={`card${p.recommended ? " rec" : ""}`}>
              {p.recommended && <span className="badge">RECOMMENDED</span>}
              <h3>{p.name}</h3>
              <p className="desc">{p.desc}</p>
              <div className="price">{money(p.usd, cur)} <small>/ one time</small></div>
              <ul>
                {p.features.map(([text, included]) => (
                  <li key={text} className={included ? "" : "no"}>{text}</li>
                ))}
              </ul>
              <button className={`btn ${p.recommended ? "fill" : "line"}`} onClick={() => onPick(p.name)}>
                Get Started
              </button>
            </article>
          ))}
        </div>
        <p className="note">
          Prices are one-time project prices. Domain registration and ongoing hosting after the first setup are billed
          at cost. Larger custom work is quoted separately.
        </p>
      </div>
    </section>
  );
}

const clamp = (v: string, min: number, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

function NumberField(props: { id: string; label: string; value: number; max: number; disabled?: boolean; onChange: (n: number) => void }) {
  return (
    <div>
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="number"
        min={0}
        max={props.max}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(clamp(e.target.value, 0, props.max))}
      />
    </div>
  );
}

function Estimator({ cur, onRequest }: { cur: Currency; onRequest: (plan: string, message: string) => void }) {
  const [plan, setPlan] = useState(1);
  const [pages, setPages] = useState(0);
  const [integrations, setIntegrations] = useState(0);
  const [gateways, setGateways] = useState(0);
  const [rush, setRush] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (plan !== 2 && gateways !== 0) setGateways(0); // payments only exist on the Fully Dynamic plan
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const q = await fetchQuote(
          { plan, extra_pages: pages, integrations, extra_gateways: plan === 2 ? gateways : 0, rush },
          ctrl.signal,
        );
        setQuote(q);
        setError("");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setQuote(null);
        setError(
          e instanceof TypeError
            ? "The estimator is offline right now. The plan prices above are the starting prices."
            : e instanceof Error ? e.message : "Could not calculate the estimate.",
        );
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [plan, pages, integrations, gateways, rush]);

  const request = () => {
    if (!quote) return;
    const parts = [
      `${pages} extra page${pages === 1 ? "" : "s"}`,
      `${integrations} integration${integrations === 1 ? "" : "s"}`,
      ...(plan === 2 ? [`${gateways} extra payment gateway${gateways === 1 ? "" : "s"}`] : []),
      ...(rush ? ["rush delivery"] : []),
    ];
    onRequest(PLANS[plan].name, `My estimate: ${PLANS[plan].name}, ${parts.join(", ")}. About ${money(quote.total, cur)}.`);
  };

  const rows: [string, number][] = quote
    ? [
        [`${PLANS[plan].name}`, quote.breakdown.base],
        [`Extra pages (${pages})`, quote.breakdown.extra_pages],
        [`Extra integrations`, quote.breakdown.integrations],
        [`Extra payment gateways (${gateways})`, quote.breakdown.gateways],
        [`Rush delivery (+20%)`, quote.breakdown.rush],
      ]
    : [];

  return (
    <section id="estimate">
      <div className="wrap center">
        <span className="pill">Instant Estimate</span>
        <h2>Get a <em>Price Estimate</em></h2>
        <p className="lead">Choose a plan and add what you need. The estimate updates as you change it.</p>
        <div className="est">
          <div className="panel">
            <label>Plan</label>
            <div className="seg">
              {PLANS.map((p, i) => (
                <button key={p.name} type="button" className={plan === i ? "on" : ""} onClick={() => setPlan(i)}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="two">
              <NumberField id="e-pages" label="Extra pages" value={pages} max={50} onChange={setPages} />
              <NumberField id="e-int" label="Integrations" value={integrations} max={20} onChange={setIntegrations} />
            </div>
            <div className="two">
              <NumberField id="e-gw" label="Extra payment gateways" value={gateways} max={5}
                disabled={plan !== 2} onChange={setGateways} />
              <div>
                <label htmlFor="e-rush">Delivery</label>
                <label className="check" htmlFor="e-rush">
                  <input id="e-rush" type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} />
                  Rush (+20%)
                </label>
              </div>
            </div>
            {plan !== 2 && <p className="hint">Online payments are only available on the Fully Dynamic plan.</p>}
          </div>
          <div className="panel result" aria-live="polite">
            {error && <p className="err-msg">{error}</p>}
            {quote && (
              <>
                <div className="rows">
                  {rows.filter(([, v], i) => i === 0 || v > 0).map(([label, v]) => (
                    <div key={label}><span>{label}</span><b>{money(v, cur)}</b></div>
                  ))}
                </div>
                <div className="total">{money(quote.total, cur)}</div>
                <p className="hint">Estimate only. The final price is confirmed after a short call.</p>
                <button className="btn fill" onClick={request}>Request this quote</button>
              </>
            )}
            {!quote && !error && <p className="hint">Calculating...</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Tech() {
  return (
    <section id="tech" className="alt">
      <div className="wrap center">
        <span className="pill">Tech Stack</span>
        <h2>Tools I <em>Build With</em></h2>
        <div className="tech">
          {TECH.map((t) => <span key={t}>{t}</span>)}
        </div>
      </div>
    </section>
  );
}

function About({ onContact }: { onContact: () => void }) {
  return (
    <section id="about">
      <div className="wrap about">
        <div>
          <span className="pill">About Me</span>
          <h2>Hi, I'm <em>{NAME}</em></h2>
          <p>
            I'm a software developer based in Dubai. I build websites for businesses of any size, from a clean
            one-page presence to a full platform with payments and orders.
          </p>
          <p>[Add 2 or 3 sentences: what you have built, what you studied, and why a client can trust you with their website.]</p>
          <button className="btn fill" onClick={onContact}>Work With Me</button>
        </div>
        <div className="facts">
          <div><b>Based in</b><span>Dubai, UAE</span></div>
          <div><b>Works with</b><span>Businesses of any size</span></div>
          <div><b>Reply time</b><span>Within 24 hours, Dubai time (GMT+4)</span></div>
          <div><b>Languages</b><span>[Add yours]</span></div>
        </div>
      </div>
    </section>
  );
}

function Cta({ onContact }: { onContact: () => void }) {
  return (
    <section className="cta" id="contact">
      <div className="wrap">
        <span className="pill dark">Ready to Start?</span>
        <h2>Let's Build Your <em>Website</em></h2>
        <p>Book a free call to talk through what you need. No obligation, and no pressure.</p>
        <div className="row">
          <a className="btn white" href={CAL_URL} target="_blank" rel="noopener noreferrer">Book a Call →</a>
          <button className="btn ghost" onClick={onContact}>Send a Message</button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span>© {new Date().getFullYear()} {BRAND}. All rights reserved.</span>
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </div>
    </footer>
  );
}

type Status = { kind: "idle" | "sending" | "ok" | "err"; text: string };

function ContactModal(props: { plan: string; initialMessage: string; onClose: () => void }) {
  const { plan, initialMessage, onClose } = props;
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // keep a reference: currentTarget is cleared after the first await
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (get("website")) { setStatus({ kind: "ok", text: "Thanks!" }); return; } // honeypot: bots fill this hidden field

    const payload = { name: get("name"), email: get("email"), phone: get("phone"), business: get("business"), message: get("message"), plan };
    if (!payload.name || !/^\S+@\S+\.\S+$/.test(payload.email) || !payload.message) {
      setStatus({ kind: "err", text: "Please add your name, a valid email and a short message." });
      return;
    }

    if (!ENQUIRY_URL) { // no enquiry service connected: open the visitor's email app instead
      const body = `Plan: ${plan}\nName: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.phone || "-"}\nBusiness: ${payload.business || "-"}\n\n${payload.message}`;
      setStatus({ kind: "ok", text: "Opening your email app to send this..." });
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Website enquiry: " + plan)}&body=${encodeURIComponent(body)}`;
      return;
    }

    setStatus({ kind: "sending", text: "Sending..." });
    try {
      await sendEnquiry(payload);
      setStatus({ kind: "ok", text: "Thanks! I'll reply within 24 hours (Dubai time)." });
      form.reset();
    } catch (err) {
      setStatus({
        kind: "err",
        text: err instanceof TypeError
          ? `Could not reach the server. Please email me directly at ${EMAIL}.`
          : err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="m-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <button className="x" aria-label="Close" onClick={onClose}>✕</button>
        <h3 id="m-title">Get in touch</h3>
        <p className="plan">Plan: <b>{plan}</b></p>
        <form onSubmit={submit} noValidate>
          <div className="two">
            <div><label htmlFor="f-name">Name *</label><input id="f-name" name="name" autoFocus autoComplete="name" /></div>
            <div><label htmlFor="f-email">Email *</label><input id="f-email" name="email" type="email" autoComplete="email" /></div>
          </div>
          <div className="two">
            <div><label htmlFor="f-phone">Phone (optional)</label><input id="f-phone" name="phone" autoComplete="tel" /></div>
            <div><label htmlFor="f-biz">Business name</label><input id="f-biz" name="business" /></div>
          </div>
          <label htmlFor="f-msg">What do you need? *</label>
          <textarea id="f-msg" name="message" rows={4} defaultValue={initialMessage}
            placeholder="Tell me about your business and goals." />
          <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <button className="btn fill" type="submit" disabled={status.kind === "sending"}>Send Message →</button>
          <div className={`status${status.kind === "err" ? " err" : ""}`} role="status">{status.text}</div>
        </form>
      </div>
    </div>
  );
}
