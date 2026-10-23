
import { Ticket, Message } from '../types';

const API_URL = import.meta.env?.VITE_MAIL_API_URL || '/backend/mail_handler.php';
const INTERNAL_TOKEN = import.meta.env?.VITE_MAIL_INTERNAL_TOKEN || '';
const IT_STAFF_EMAIL = 'ticket@naiyatechnology.org';
const PORTAL_LINK = typeof window !== 'undefined' ? window.location.origin : 'https://ticket.naiyatechnology.org';

export interface EmailAttachment {
  filename: string;
  data: string; // Base64 encoded file data
  mime?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  attachment?: EmailAttachment;
}

const getEmailFooter = () => `
  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center;">
    <p>Please <strong>DO NOT REPLY</strong> to this email directly. Replies sent to this inbox are not monitored.</p>
    <a href="${PORTAL_LINK}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin: 10px 0;">
      View Ticket / Reply on Portal
    </a>
    <p>&copy; ${new Date().getFullYear()} Na'iya Support System</p>
  </div>
`;

function markdownToEmailHtml(content: string): string {
  if (!content) return '';
  let safe = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  safe = safe.replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-size: 13px;">$1</code>');
  safe = safe.replace(/^\s*[-*]\s+(.*)$/gm, '<li style="margin-bottom: 4px;">$1</li>');
  safe = safe.replace(/(<li style="margin-bottom: 4px;">[\s\S]*?<\/li>)/g, '<ul style="margin: 8px 0; padding-left: 20px;">$1</ul>');
  safe = safe.replace(/\n\n+/g, '</p><p style="margin: 10px 0; color: #334155; font-size: 15px; line-height: 1.6;">');
  safe = safe.replace(/\n/g, '<br/>');
  return `<p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.6;">${safe}</p>`;
}

const sendToBridge = async (payload: EmailPayload) => {
  if (!payload.to || !payload.to.includes('@')) {
      console.warn('[EmailService] Aborted: Invalid or missing recipient email.', payload.to);
      return false;
  }

  console.log(`[EmailService] Sending email to ${payload.to}...`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        body: payload.html,
        attachment: payload.attachment,
        internal_token: INTERNAL_TOKEN
      }),
    });

    const responseText = await response.text();
    let result;
    
    try {
        result = JSON.parse(responseText);
    } catch (e) {
        console.error('[EmailService] Bridge Error (Invalid JSON):', responseText.substring(0, 300));
        return false;
    }

    if (response.ok && (result.status === 'success' || result.success === true)) {
        console.log('[EmailService] Email dispatched successfully.');
        return true;
    } else {
        console.error('[EmailService] Gateway Error:', result.message || 'Unknown error');
        return false;
    }
  } catch (error) {
    console.error('[EmailService] Network/Fetch Error:', error);
    return false;
  }
};

// Intentionally disabled: Staff / ticket inbox does NOT receive notices when tickets are created.
// Email notifications are strictly outbound to agents when staff/team leads reply.
export const sendNewTicketEmail = async (_ticket: Ticket) => {
  return;
};

// Intentionally disabled: Ticket escalations are managed inside the dashboard, not via staff email notifications.
export const sendEscalationEmail = async (_ticket: Ticket) => {
  return;
};

export const sendReplyNotification = async (ticket: Ticket, message: Message) => {
  // Only send notification to the agent if the reply came from a staff member or team lead
  const isFromStaff = message.role === 'staff' || message.role === 'team_lead';
  const agentEmail = (ticket.createdByEmail || '').trim();

  // Enforce: Email is for agents only, never sent to staff/ticket inbox
  if (isFromStaff && agentEmail && agentEmail.toLowerCase() !== IT_STAFF_EMAIL.toLowerCase()) {
    // Notify the Agent (User)
    await sendToBridge({
      to: agentEmail,
      subject: `[Update] Ticket #${ticket.ticketNumber} has a new reply`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #f8fafc; padding: 20px; border-bottom: 1px solid #eaeaea; text-align: center;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Support Ticket Update</h2>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Ticket #${ticket.ticketNumber}</p>
          </div>
          <div style="padding: 30px 20px;">
            <p style="margin-top: 0; color: #334155; font-size: 16px;">Hello ${ticket.createdByName},</p>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;"><strong>${message.senderName}</strong> has replied to your ticket <strong>"${ticket.title}"</strong>.</p>
            
            <div style="margin: 25px 0; background-color: #f8fafc; padding: 20px; border-left: 4px solid #0284c7; border-radius: 6px;">
              ${markdownToEmailHtml(message.content)}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${PORTAL_LINK}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                View and Respond to Ticket
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px; line-height: 1.5;">
              If the button above does not work, you can copy and paste the following URL into your browser:<br/>
              <a href="${PORTAL_LINK}" style="color: #0284c7;">${PORTAL_LINK}</a>
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #94a3b8; font-size: 13px;">
            <p style="margin: 0;">Please DO NOT REPLY to this email. Replies are not monitored.</p>
            <p style="margin: 5px 0 0;">&copy; ${new Date().getFullYear()} NAIYA TECHNOLOGY</p>
          </div>
        </div>`
    }).catch(err => console.error('[EmailService] Failed to dispatch reply email', err));
  }
};


export const sendEmailRecoveryNotification = async (currentEmail: string, altEmail: string) => {
  await sendToBridge({
    to: IT_STAFF_EMAIL,
    subject: `[Email Recovery] Access Request: ${currentEmail}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #0284c7;">Email Recovery Request</h2>
        <p>An agent has submitted a request to recover access to their account.</p>
        <p><strong>Company Email:</strong> ${currentEmail}</p>
        <p><strong>Alternative Email:</strong> ${altEmail}</p>
        <p>Login to the Admin Dashboard to review and approve/reject this request.</p>
        ${getEmailFooter()}
      </div>`
  });
};

export const sendAgentApprovedEmail = async (email: string, comment?: string) => {
    await sendToBridge({
        to: email,
        subject: `[Access Granted] Welcome to Na'iya Support Portal`,
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #bbf7d0; background-color: #f0fdf4; border-radius: 8px;">
            <h2 style="color: #166534;">Access Approved</h2>
            <p>Your request for access has been approved. You can now login using your email address.</p>
            <p><strong>Login Email:</strong> ${email}</p>
            ${comment ? `
            <div style="margin: 20px 0; background-color: #ffffff; padding: 15px; border-left: 4px solid #166534; border-radius: 4px;">
              <p style="margin: 0; color: #166534;"><strong>Message from IT Staff:</strong></p>
              <p style="margin: 5px 0 0; white-space: pre-wrap;">${comment}</p>
            </div>
            ` : ''}
            <div style="text-align: center; margin: 20px 0;">
                <a href="${PORTAL_LINK}" style="background-color: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login Now</a>
            </div>
        </div>`
    });
};

export const sendAgentRejectedEmail = async (email: string, comment?: string) => {
    await sendToBridge({
        to: email,
        subject: `[Access Update] Regarding your Support Portal Request`,
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #374151;">Access Request Status</h2>
            <p>We reviewed your request for access to the Na'iya Support Portal.</p>
            <p>At this time, we are unable to grant access. If you believe this is an error, please contact your supervisor.</p>
            ${comment ? `
            <div style="margin: 20px 0; background-color: #f9fafb; padding: 15px; border-left: 4px solid #6b7280; border-radius: 4px;">
              <p style="margin: 0; color: #374151;"><strong>Message from IT Staff:</strong></p>
              <p style="margin: 5px 0 0; white-space: pre-wrap;">${comment}</p>
            </div>
            ` : ''}
        </div>`
    });
};

export const sendRecoveryPasswordEmail = async (personalEmail: string, companyEmail: string, tempPassword: string, comment?: string) => {
    await sendToBridge({
        to: personalEmail,
        subject: `[Access Recovered] Your Na'iya Support Credentials`,
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #bbf7d0; background-color: #f0fdf4; border-radius: 8px;">
            <h2 style="color: #166534;">Email Recovery Approved</h2>
            <p>Your identity has been successfully verified by our IT staff.</p>
            <p>You can now log in to the portal using your company email address and the temporary password below.</p>
            
            <div style="margin: 20px 0; background-color: #ffffff; padding: 15px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center;">
                <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Company Email:</strong><br/>${companyEmail}</p>
                <p style="margin: 15px 0 0; color: #374151; font-size: 14px;"><strong>Temporary Password:</strong><br/>
                    <span style="font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #0284c7; font-weight: bold; padding: 5px 10px; background: #f0f9ff; border-radius: 4px; display: inline-block; margin-top: 5px;">${tempPassword}</span>
                </p>
            </div>
            
            ${comment ? `
            <div style="margin: 20px 0; background-color: #ffffff; padding: 15px; border-left: 4px solid #166534; border-radius: 4px;">
              <p style="margin: 0; color: #166534;"><strong>Message from IT Staff:</strong></p>
              <p style="margin: 5px 0 0; white-space: pre-wrap;">${comment}</p>
            </div>
            ` : ''}
            
            <p style="color: #991b1b; font-size: 14px;"><strong>Important:</strong> We strongly recommend changing your password immediately after logging in.</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <a href="${PORTAL_LINK}" style="background-color: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login Now</a>
            </div>
        </div>`
    });
};

export const sendNewUserWelcomeEmail = async (email: string, tempPassword: string, altEmail?: string) => {
  const recipients = [email];
  if (altEmail && altEmail.includes('@') && altEmail.toLowerCase() !== email.toLowerCase()) {
      recipients.push(altEmail);
  }

  for (const recipient of recipients) {
      await sendToBridge({
        to: recipient,
        subject: `[Welcome to Na'iya Support] Your Account Details & Password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0284c7; padding: 20px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 22px;">Welcome to Na'iya Support Portal</h2>
              <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Your Support Agent Account is Ready</p>
            </div>
            <div style="padding: 25px 20px;">
              <p style="margin-top: 0; color: #334155; font-size: 15px;">Hello,</p>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">An account has been created for you on the Na'iya Support Portal. You can log in using the credentials below:</p>
              
              <div style="margin: 20px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 18px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Login Email (Username)</p>
                <p style="margin: 5px 0 15px; color: #0f172a; font-weight: bold; font-size: 16px;">${email}</p>
                
                <p style="margin: 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Temporary Password</p>
                <div style="margin-top: 5px;">
                  <span style="font-family: monospace; font-size: 20px; letter-spacing: 2px; color: #0284c7; font-weight: bold; padding: 8px 16px; background: #e0f2fe; border-radius: 6px; display: inline-block;">${tempPassword}</span>
                </div>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.4;">
                  <strong>Important:</strong> Upon your first login, you will be prompted to change this temporary password to your own private password.
                </p>
              </div>

              <div style="text-align: center; margin: 25px 0;">
                <a href="${PORTAL_LINK}" style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">Log In Now</a>
              </div>

              ${getEmailFooter()}
            </div>
          </div>`
      }).catch(err => console.error('[EmailService] Failed to send welcome email', err));
  }
};

export const sendPasswordSetEmail = async (email: string, options?: { isReset?: boolean; tempPassword?: string; altEmail?: string }) => {
  const recipients = [email];
  if (options?.altEmail && options.altEmail.includes('@') && options.altEmail.toLowerCase() !== email.toLowerCase()) {
    recipients.push(options.altEmail);
  }

  const isReset = options?.isReset;
  const tempPassword = options?.tempPassword;
  const nowFormatted = new Date().toLocaleString('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short'
  });

  for (const recipient of recipients) {
    await sendToBridge({
      to: recipient,
      subject: isReset 
        ? `[Security Alert] Your Na'iya Support Password Has Been Reset` 
        : `[Security Alert] Your Na'iya Support Password Has Been Created`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); padding: 24px 20px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Password Security Notice</h2>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">Na'iya Support Portal Account Security</p>
          </div>
          <div style="padding: 28px 24px;">
            <p style="margin-top: 0; color: #334155; font-size: 15px;">Hello,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              This is an automated confirmation that the password for your Na'iya Support account (<strong>${email}</strong>) was successfully <strong>${isReset ? 'reset / updated' : 'created'}</strong> on <strong>${nowFormatted}</strong>.
            </p>

            ${tempPassword ? `
              <div style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Your Temporary Password</p>
                <div style="margin-top: 8px;">
                  <span style="font-family: monospace; font-size: 22px; letter-spacing: 3px; color: #0284c7; font-weight: bold; padding: 8px 18px; background: #e0f2fe; border-radius: 6px; display: inline-block;">${tempPassword}</span>
                </div>
                <p style="margin: 10px 0 0; color: #94a3b8; font-size: 12px;">Please change this password immediately after logging in.</p>
              </div>
            ` : `
              <div style="margin: 20px 0; background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 16px; border-radius: 6px;">
                <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">
                  Your new password is now active.
                </p>
                <p style="margin: 4px 0 0; color: #15803d; font-size: 13px;">
                  You can now log in using your email address and your new secret password.
                </p>
              </div>
            `}

            <div style="margin: 24px 0; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px;">
              <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
                <strong>Did not make this change?</strong> If you did not request or perform this password update, please immediately contact IT Support to secure your account.
              </p>
            </div>

            <div style="text-align: center; margin: 28px 0 10px 0;">
              <a href="${PORTAL_LINK}" style="background-color: #0284c7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">Log In to Portal</a>
            </div>

            ${getEmailFooter()}
          </div>
        </div>`
    }).catch(err => console.error('[EmailService] Failed to send password set email', err));
  }
};

export const sendSystemBroadcastEmail = async (
  recipients: string[], 
  subject: string, 
  message: string, 
  badge: string = 'Announcement',
  senderName: string = "Na'iya IT Support"
): Promise<{ sent: number; failed: number }> => {
  let sent = 0;
  let failed = 0;

  const badgeColor = badge === 'Urgent' || badge === 'Incident' ? '#dc2626' : badge === 'Maintenance' ? '#d97706' : '#0284c7';
  const badgeBg = badge === 'Urgent' || badge === 'Incident' ? '#fee2e2' : badge === 'Maintenance' ? '#fef3c7' : '#e0f2fe';

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 20px; text-align: center; color: white;">
        <div style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          ${badge}
        </div>
        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${subject}</h2>
        <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Official Message from ${senderName}</p>
      </div>
      <div style="padding: 30px 24px;">
        <div style="color: #334155; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">
${message}
        </div>

        <div style="text-align: center; margin: 30px 0 10px 0;">
          <a href="${PORTAL_LINK}" style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">
            Open Support Portal
          </a>
        </div>

        ${getEmailFooter()}
      </div>
    </div>`;

  const uniqueRecipients = Array.from(new Set(recipients.map(r => r.trim().toLowerCase()).filter(r => r.includes('@'))));

  for (const to of uniqueRecipients) {
    try {
      const ok = await sendToBridge({
        to,
        subject: `[${badge}] ${subject}`,
        html: htmlContent
      });
      if (ok) sent++;
      else failed++;
    } catch (e) {
      failed++;
    }
  }

  return { sent, failed };
};

export const sendWeeklyReportEmail = async (
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  attachment?: EmailAttachment
): Promise<boolean> => {
  return await sendToBridge({
    to: recipientEmail,
    subject,
    html: htmlContent,
    attachment
  });
};


