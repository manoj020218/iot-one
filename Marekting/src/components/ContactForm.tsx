import { useMemo, useState } from "react";

import { brand } from "../content/brand";

export function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    country: "",
    enquiry: "OEM discussion",
    devices: "",
    description: "",
    consent: false
  });
  const [submitted, setSubmitted] = useState(false);

  const mailto = useMemo(() => {
    const subject = encodeURIComponent(`Smart One enquiry: ${form.enquiry}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nPhone: ${form.phone}\nCompany: ${form.company}\nCountry: ${form.country}\nExpected devices: ${form.devices}\n\nProject description:\n${form.description}`
    );
    return `mailto:${brand.supportEmail}?subject=${subject}&body=${body}`;
  }, [form]);

  return (
    <div className="contact-shell">
      <form
        className="contact-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!form.consent) {
            return;
          }
          setSubmitted(true);
        }}
      >
        {[
          ["Full name", "name"],
          ["Business email", "email"],
          ["Phone number", "phone"],
          ["Company", "company"],
          ["Country", "country"],
          ["Expected number of devices", "devices"]
        ].map(([label, key]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input
              required={key !== "devices"}
              type={key === "email" ? "email" : "text"}
              value={form[key as keyof typeof form] as string}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        ))}
        <label className="field">
          <span>Enquiry type</span>
          <select
            value={form.enquiry}
            onChange={(event) => setForm((current) => ({ ...current, enquiry: event.target.value }))}
          >
            <option>OEM discussion</option>
            <option>API access</option>
            <option>Third-party integration</option>
            <option>Platform support</option>
          </select>
        </label>
        <label className="field field-full">
          <span>Project description</span>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </label>
        <label className="checkbox-field field-full">
          <input
            checked={form.consent}
            type="checkbox"
            onChange={(event) => setForm((current) => ({ ...current, consent: event.target.checked }))}
          />
          <span>I consent to Jenix contacting me about this enquiry.</span>
        </label>
        <button className="button button-primary field-full" type="submit">
          Prepare enquiry
        </button>
      </form>
      <aside className="contact-sidebar">
        <h3>Sales and support channels</h3>
        <p>Email: <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
        <p>WhatsApp: <a href={`https://wa.me/91${brand.whatsapp}`}>+91 {brand.whatsapp}</a></p>
        <p>Address: {brand.address}</p>
        {submitted ? (
          <div className="contact-status">
            <strong>Your enquiry draft is ready.</strong>
            <p>Use email for detailed requirements or WhatsApp for faster first contact.</p>
            <a className="button button-secondary" href={mailto}>Open email draft</a>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
