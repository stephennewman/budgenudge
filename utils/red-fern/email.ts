/**
 * The confirmation email, with the calendar invite attached.
 *
 * Building the message is pure so the booking flow can show the guest exactly
 * what was sent — the demo renders this same object on the confirmation screen
 * — and so the copy can be asserted in tests. Delivery happens elsewhere.
 */

import { VENUE, type Experience } from "./catalog";
import type { Booking } from "./availability";
import { balanceDueDate, buildBookingInvite, type Party } from "./ics";
import { formatDateFull, formatDateSpan, formatMoney, formatTime } from "./dates";
import type { Quote } from "./pricing";

export type BookingEmail = {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  /** The raw iCalendar body, for inspection; the wire copy is base64 below. */
  calendar: string;
  attachments: {
    filename: string;
    /** Base64, the form Resend documents for inline content. */
    content: string;
    /**
     * Snake_case on purpose: Resend's REST API reads `content_type`, and the
     * `method=` parameter is what makes a mail client show an invitation
     * rather than a file to download.
     */
    content_type: string;
  }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `Sat, Nov 21` or `Nov 21 – Nov 23, 2026` plus the start time. */
export function whenText(booking: Booking): string {
  const span = formatDateSpan(booking.start_date, booking.days);
  return booking.days > 1
    ? `${span}, starting at ${formatTime(booking.start_time)}`
    : `${formatDateFull(booking.start_date)} at ${formatTime(booking.start_time)}`;
}

export function subjectFor(
  booking: Booking,
  experience: Experience,
  method: "REQUEST" | "CANCEL"
): string {
  if (method === "CANCEL") {
    return `Cancelled: ${experience.name} at ${VENUE.name} — ${formatDateSpan(booking.start_date, booking.days)}`;
  }
  const verb = booking.status === "confirmed" ? "Confirmed" : "Date held";
  return `${verb}: ${experience.name} — ${formatDateSpan(booking.start_date, booking.days)}`;
}

/** The one thing the guest has to do next, if anything. */
function leadParagraph(booking: Booking, experience: Experience): string {
  if (booking.status === "cancelled") {
    return "This booking has been released. Declining the invitation removes it from your calendar.";
  }
  if (booking.total === 0) {
    return "You're on the book. Accept the invitation and it lands on your calendar with a reminder the night before. Nothing to pay, nothing to bring — come see the place.";
  }
  if (booking.deposit_due > 0) {
    return `We're holding ${booking.days > 1 ? "these dates" : "this date"} for you. A ${formatMoney(
      booking.deposit_due
    )} deposit confirms it — we'll call within one business day to take it, or you can reach us at ${VENUE.phone}.`;
  }
  return "We're holding this date for you and will call within one business day to finish the details.";
}

export function buildBookingEmail(
  booking: Booking,
  experience: Experience,
  quote: Quote,
  options: {
    to?: string;
    from: string;
    organizer?: Party;
    method?: "REQUEST" | "CANCEL";
    manageUrl?: string;
    now?: Date;
    domain?: string;
  }
): BookingEmail {
  const { from, organizer, method = "REQUEST", manageUrl, now, domain } = options;
  const to = options.to ?? booking.guest_email;

  const calendar = buildBookingInvite(booking, {
    organizer,
    attendee: { email: to, name: booking.guest_name },
    method,
    now,
    domain,
    manageUrl,
  });

  const lead = leadParagraph(booking, experience);
  const due = balanceDueDate(booking, experience);
  const balance = booking.total - booking.deposit_due;

  const facts: [string, string][] = [
    ["What", experience.name],
    ["When", whenText(booking)],
    [experience.party.label, String(booking.party_size)],
    ["Where", VENUE.address],
    ["Confirmation", booking.reference],
  ];

  const money: [string, string][] = [];
  if (booking.total > 0) {
    for (const line of quote.lines) {
      money.push([
        line.detail ? `${line.label} (${line.detail})` : line.label,
        formatMoney(line.amount),
      ]);
    }
    money.push(["Total", formatMoney(booking.total)]);
    if (booking.deposit_due > 0) money.push(["Deposit to confirm", formatMoney(booking.deposit_due)]);
    if (balance > 0 && due) money.push([`Balance due ${formatDateFull(due)}`, formatMoney(balance)]);
  }

  const text = [
    `${experience.name} at ${VENUE.name}`,
    "",
    lead,
    "",
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(money.length ? ["", "Your estimate", ...money.map(([l, v]) => `${l}: ${v}`)] : []),
    "",
    "What's included",
    ...experience.includes.map((item) => `• ${item}`),
    ...(booking.notes ? ["", `Your note: ${booking.notes}`] : []),
    "",
    `Questions: ${VENUE.phone} · ${VENUE.email}`,
    VENUE.address,
  ].join("\n");

  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#63696b;white-space:nowrap;font-size:13px">${escapeHtml(
      label
    )}</td><td style="padding:6px 0;font-size:13px;text-align:right;${
      bold ? "font-weight:700;" : ""
    }color:#3c4143">${escapeHtml(value)}</td></tr>`;

  const html = `<div style="background:#f4f2ef;padding:24px 12px;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:560px;margin:0 auto;background:#fbfaf8;border:1px solid #ddd9d3;border-radius:14px;overflow:hidden">
    <div style="background:#3c4143;color:#f4f2ef;padding:26px 26px 22px;text-align:center">
      <p style="margin:0;font-size:22px;letter-spacing:.34em;font-weight:500;padding-left:.34em">REDFERN</p>
      <div style="width:56px;height:1px;background:#cf8577;margin:10px auto"></div>
      <p style="margin:0;font-size:10px;letter-spacing:.44em;padding-left:.44em;color:#d6d3ce">PLANTATION</p>
      <p style="margin:12px 0 0;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#cf8577">${escapeHtml(
        VENUE.city
      )}, ${escapeHtml(VENUE.state)}</p>
    </div>
    <div style="padding:26px">
      <h2 style="margin:0 0 10px;font-size:19px;color:#3c4143;font-weight:400">${escapeHtml(
        experience.name
      )}</h2>
      <p style="margin:0 0 20px;color:#4f5456;line-height:1.6;font-size:14px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${escapeHtml(
        lead
      )}</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd9d3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        ${facts.map(([label, value]) => row(label, value)).join("\n        ")}
      </table>
      ${
        money.length
          ? `<h3 style="margin:24px 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7e8385;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">Your estimate</h3>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd9d3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        ${money
          .map(([label, value], index) => row(label, value, index >= money.length - 3))
          .join("\n        ")}
      </table>`
          : ""
      }
      <h3 style="margin:24px 0 6px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7e8385;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">What's included</h3>
      <ul style="margin:0;padding-left:18px;color:#4f5456;line-height:1.7;font-size:13px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        ${experience.includes.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n        ")}
      </ul>
      ${
        booking.notes
          ? `<p style="margin:20px 0 0;padding:12px 14px;background:#eceae6;border-radius:10px;color:#4f5456;font-size:13px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><strong>Your note:</strong> ${escapeHtml(
              booking.notes
            )}</p>`
          : ""
      }
      <p style="margin:24px 0 0;color:#63696b;font-size:12px;line-height:1.6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        The attached invitation adds this to your calendar with a reminder the night before.<br>
        ${escapeHtml(VENUE.phone)} · ${escapeHtml(VENUE.email)}<br>${escapeHtml(VENUE.address)}
      </p>
    </div>
  </div>
</div>`;

  return {
    to,
    from,
    replyTo: VENUE.email,
    subject: subjectFor(booking, experience, method),
    text,
    html,
    calendar,
    attachments: [
      {
        filename: `red-fern-${booking.reference.toLowerCase()}.ics`,
        content: Buffer.from(calendar, "utf-8").toString("base64"),
        content_type: `text/calendar; charset=utf-8; method=${method}`,
      },
    ],
  };
}
