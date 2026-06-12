import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "reminders@orderlyproblemsolvers.com";
const FROM_NAME = "ClientBase";

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(RESEND_API_KEY);

  const { data: configs, error: configError } = await supabase
    .from("invoice_reminder_configs")
    .select(`*, project:projects!inner(id, name, user_id, clients:client_id (id, name, contact_email, do_not_remind, unsubscribe_token))`)
    .eq("enabled", true);

  if (configError) return new Response(configError.message, { status: 500 });

  for (const config of configs) {
    const { data: invoices } = await supabase
      .from("retainers")
      .select("*, clients(id, name, contact_email, do_not_remind, unsubscribe_token)")
      .eq("project_id", config.project_id)
      .eq("status", "overdue")
      .order("due_date", { ascending: true });

    if (!invoices?.length) continue;

    // Fetch user profile info for email body
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", config.project.user_id)
      .single();

    const { data: userAuth } = await supabase
      .from("auth.users")
      .select("email")
      .eq("id", config.project.user_id)
      .single();

    const senderName = userProfile?.full_name || "Your Agency";
    const senderEmail = userAuth?.email || "";
    const senderAvatar = userProfile?.avatar_url || null;

    for (const inv of invoices) {
      if (inv.clients?.do_not_remind) continue;

      // Determine recipient: override > client contact_email
      const toEmail = config.recipient_email || inv.clients?.contact_email;
      if (!toEmail) continue;

      // Per‑invoice frequency check
      const { data: state } = await supabase
        .from("invoice_reminder_states")
        .select("last_reminded_at")
        .eq("invoice_id", inv.id)
        .single();
      const lastReminded = state?.last_reminded_at ? new Date(state.last_reminded_at) : null;
      const now = new Date();
      let shouldSend = false;

      if (!lastReminded) {
        shouldSend = true;
      } else {
        const diffDays = Math.floor((now.getTime() - lastReminded.getTime()) / (1000 * 60 * 60 * 24));
        switch (config.frequency) {
          case "daily":    shouldSend = diffDays >= 1; break;
          case "weekly":   shouldSend = diffDays >= 7; break;
          case "biweekly": shouldSend = diffDays >= 14; break;
          case "monthly":  shouldSend = diffDays >= 30; break;
        }
      }
      if (!shouldSend) continue;

      // Build email
      const unsubscribeLink = inv.clients?.unsubscribe_token
        ? `${SUPABASE_URL.replace(".supabase.co", "")}/unsubscribe?token=${inv.clients.unsubscribe_token}`
        : "#";

      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f1e; color: #cbd5e1; padding: 24px; border-radius: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 16px;">
            ${senderAvatar ? `<img src="${senderAvatar}" alt="${senderName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />` : ""}
            <div>
              <p style="color: #ffffff; font-weight: 600; margin: 0;">${senderName}</p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">${senderEmail}</p>
            </div>
          </div>
          <h2 style="color: #ef4444; font-size: 18px; margin-bottom: 12px;">Overdue Invoice Reminder</h2>
          <p style="margin-bottom: 16px;">Dear ${inv.clients?.name},</p>
          <p style="margin-bottom: 12px;">
            Invoice <strong style="color: #ffffff;">${inv.invoice_number}</strong> for 
            <strong style="color: #ffffff;">₦${inv.amount.toLocaleString()}</strong> was due on 
            <strong style="color: #ffffff;">${inv.due_date}</strong> and is now overdue.
          </p>
          <p style="margin-bottom: 16px;">Please arrange payment at your earliest convenience.</p>
          ${config.custom_message ? `<p style="margin-bottom: 16px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">${config.custom_message}</p>` : ""}
          <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);">
            Thank you,<br/>
            <strong style="color: #ffffff;">${senderName}</strong>
          </p>
          <p style="font-size: 11px; color: #64748b; margin-top: 24px;">
            You are receiving this because you have an overdue invoice with us. 
            <a href="${unsubscribeLink}" style="color: #818cf8;">Unsubscribe from reminders</a>.
          </p>
        </div>
      `;

      const subject = `Reminder: Invoice ${inv.invoice_number} is overdue`;

      try {
        await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: toEmail,              // <-- uses override if set
          reply_to: senderEmail || undefined,
          subject,
          html,
        });

        await supabase.from("invoice_reminder_states").upsert({ invoice_id: inv.id, last_reminded_at: now.toISOString() });
        await supabase.from("invoice_reminder_logs").insert({
          project_id: config.project_id,
          invoice_id: inv.id,
          sent_to: toEmail,
          status: "sent",
        });
      } catch (e: any) {
        await supabase.from("invoice_reminder_logs").insert({
          project_id: config.project_id,
          invoice_id: inv.id,
          sent_to: toEmail,
          status: "failed",
          error_message: e.message,
        });
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});