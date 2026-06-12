import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "reminders@orderlyproblemsolvers.com";
const FROM_NAME = "ClientBase";

serve(async (req) => {
  try {
    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    // 1. Get user info (to send test to themselves)
    const { data: project } = await supabase
      .from("projects")
      .select("user_id, name")
      .eq("id", project_id)
      .single();
    if (!project) throw new Error("Project not found");

    const { data: userAuth } = await supabase
      .from("auth.users")
      .select("email")
      .eq("id", project.user_id)
      .single();
    if (!userAuth?.email) throw new Error("User email not found");

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", project.user_id)
      .single();

    const senderName = userProfile?.full_name || "Your Agency";
    const senderEmail = userAuth.email;
    const senderAvatar = userProfile?.avatar_url || null;

    // 2. Get reminder config for custom message
    const { data: config } = await supabase
      .from("invoice_reminder_configs")
      .select("custom_message, frequency")
      .eq("project_id", project_id)
      .single();

    const customMsg = config?.custom_message || "";
    const frequency = config?.frequency || "weekly";

    // 3. Build a sample email body
    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f1e; color: #cbd5e1; padding: 24px; border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 16px;">
          ${senderAvatar ? `<img src="${senderAvatar}" alt="${senderName}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />` : ""}
          <div>
            <p style="color: #ffffff; font-weight: 600; margin: 0;">${senderName}</p>
            <p style="color: #64748b; font-size: 12px; margin: 0;">${senderEmail}</p>
          </div>
        </div>
        <h2 style="color: #ef4444; font-size: 18px; margin-bottom: 12px;">[TEST] Overdue Invoice Reminder</h2>
        <p style="margin-bottom: 16px;">Dear [Client Name],</p>
        <p style="margin-bottom: 12px;">
          This is a <strong>test</strong> email for the reminder settings of project <strong>${project.name}</strong>.
        </p>
        <p style="margin-bottom: 12px;">
          A real reminder would look like this and be sent with frequency <strong>${frequency}</strong>.
        </p>
        ${customMsg ? `<p style="margin-bottom: 16px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">Custom message: "${customMsg}"</p>` : ""}
        <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06);">
          Thank you,<br/>
          <strong style="color: #ffffff;">${senderName}</strong>
        </p>
      </div>
    `;

    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: senderEmail,
      subject: `[TEST] Invoice Reminder for ${project.name}`,
      html,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
});