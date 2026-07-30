import type { TemplateContent } from "./layout.js";

/**
 * Fallback content for every template this app can send right now, used
 * when lib/db/account_upgrade.sql hasn't been applied yet (email_templates
 * table absent) or a row is missing. Mirrors the seed rows in that migration
 * exactly, so behavior is identical whether or not the DB copy exists —
 * editing a template in Admin only takes effect once the migration has
 * landed and the DB row is what's actually read.
 */
export const DEFAULT_TEMPLATES: Record<string, Omit<TemplateContent, "ctaUrl"> & { ctaUrlTemplate?: string }> = {
  welcome: {
    subject: "Welcome to MarketPulse AI, {{user_name}}",
    preheader: "Your account is ready — here is what to explore first.",
    body:
      "Hi {{user_name}},\n\nYour MarketPulse AI account is live. You now have access to real-time market dashboards, AI-driven signals, and portfolio tools built for serious investors.\n\nA quick note on your inbox: transactional emails like this one (security alerts, password resets, support updates) are always sent regardless of your notification preferences, since they keep your account safe.",
    ctaLabel: "Go to Dashboard",
    ctaUrlTemplate: "{{support_url}}",
  },
  verify_email: {
    subject: "Verify your email address",
    preheader: "One click to confirm {{user_email}}.",
    body:
      "Hi {{user_name}},\n\nPlease confirm that {{user_email}} is your email address. This link expires in 24 hours and can only be used once.\n\nIf you did not create a MarketPulse AI account, you can safely ignore this email.",
    ctaLabel: "Verify Email Address",
    ctaUrlTemplate: "{{verification_url}}",
  },
  email_verified: {
    subject: "Your email is verified",
    preheader: "You are all set, {{user_name}}.",
    body: "Hi {{user_name}},\n\n{{user_email}} has been verified. Your account now has full access to MarketPulse AI.",
    ctaLabel: "Go to Dashboard",
    ctaUrlTemplate: "{{support_url}}",
  },
  password_reset_request: {
    subject: "Reset your MarketPulse AI password",
    preheader: "This link expires in 1 hour.",
    body:
      "We received a request to reset the password for {{user_email}}.\n\nIf this was you, use the button below to choose a new password. This link expires in 1 hour and can only be used once.\n\nIf you did not request this, you can safely ignore this email — your password will not be changed.",
    ctaLabel: "Reset Password",
    ctaUrlTemplate: "{{reset_url}}",
    footerNote: "For your security, we never include your existing password in email.",
  },
  password_changed: {
    subject: "Your MarketPulse AI password was changed",
    preheader: "Security confirmation for {{user_email}}.",
    body:
      "Hi {{user_name}},\n\nYour MarketPulse AI password was changed. If you made this change, no further action is needed.\n\nIf you did not perform this action, please contact support immediately using the link below.",
    ctaLabel: "Contact Support",
    ctaUrlTemplate: "{{support_url}}",
  },
  new_login_alert: {
    subject: "New sign-in to your MarketPulse AI account",
    preheader: "A sign-in from a new location was detected.",
    body:
      "Hi {{user_name}},\n\nWe noticed a sign-in to your account from a new location:\n\nIP address: {{login_ip}}\nTime: {{login_time}}\n\nIf this was you, no action is needed. If you do not recognize this activity, please change your password immediately and contact support.",
    ctaLabel: "Review Account Security",
    ctaUrlTemplate: "{{support_url}}",
  },
  email_changed: {
    subject: "Your MarketPulse AI email address was changed",
    preheader: "Security confirmation for your account.",
    body:
      "Hi {{user_name}},\n\nThe email address on your MarketPulse AI account was changed from {{old_email}} to {{new_email}}.\n\nIf you made this change, no further action is needed. If you did not request this, please contact support immediately — your account may be at risk.",
    ctaLabel: "Contact Support",
    ctaUrlTemplate: "{{support_url}}",
  },
  ticket_created: {
    subject: "We received your support request ({{ticket_id}})",
    preheader: "{{ticket_subject}}",
    body:
      "Hi {{user_name}},\n\nWe have received your support ticket and our team will respond as soon as possible.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\nStatus: {{ticket_status}}",
    ctaLabel: "View Ticket",
    ctaUrlTemplate: "{{support_url}}",
  },
  ticket_reply: {
    subject: "New reply on ticket {{ticket_id}}",
    preheader: "{{ticket_subject}}",
    body:
      "Hi {{user_name}},\n\nOur support team has replied to your ticket.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\n\nSign in to MarketPulse AI to read the full reply and respond.",
    ctaLabel: "View Ticket",
    ctaUrlTemplate: "{{support_url}}",
  },
  ticket_status_changed: {
    subject: "Ticket {{ticket_id}} status updated: {{ticket_status}}",
    preheader: "{{ticket_subject}}",
    body:
      "Hi {{user_name}},\n\nThe status of your support ticket has changed.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\nNew status: {{ticket_status}}",
    ctaLabel: "View Ticket",
    ctaUrlTemplate: "{{support_url}}",
  },
  ticket_resolved: {
    subject: "Your ticket {{ticket_id}} has been resolved",
    preheader: "{{ticket_subject}}",
    body:
      "Hi {{user_name}},\n\nGood news — your support ticket has been marked resolved.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\n\nIf this did not fully solve your issue, you can reopen the ticket from MarketPulse AI.",
    ctaLabel: "View Ticket",
    ctaUrlTemplate: "{{support_url}}",
  },
  ticket_closed: {
    subject: "Your ticket {{ticket_id}} has been closed",
    preheader: "{{ticket_subject}}",
    body:
      "Hi {{user_name}},\n\nYour support ticket has been closed.\n\nTicket: {{ticket_id}}\nSubject: {{ticket_subject}}\n\nIf you need further help on this topic, you can open a new ticket referencing this one at any time.",
    ctaLabel: "View Ticket",
    ctaUrlTemplate: "{{support_url}}",
  },
  admin_announcement: {
    subject: "{{announcement_title}}",
    preheader: "An update from the MarketPulse AI team.",
    body: "{{announcement_body}}",
    ctaLabel: "Go to Dashboard",
    ctaUrlTemplate: "{{support_url}}",
  },
};

export type EmailTemplateKey = keyof typeof DEFAULT_TEMPLATES;
