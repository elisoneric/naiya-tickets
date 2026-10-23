var y="/backend/mail_handler.php",g="4e5183cdb9abb915b5e52a782c5f2bf5",f="ticket@naiyatechnology.org",a=typeof window<"u"?window.location.origin:"https://ticket.naiyatechnology.org",d=()=>`
  <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center;">
    <p>Please <strong>DO NOT REPLY</strong> to this email directly. Replies sent to this inbox are not monitored.</p>
    <a href="${a}" style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin: 10px 0;">
      View Ticket / Reply on Portal
    </a>
    <p>&copy; ${new Date().getFullYear()} Na'iya Support System</p>
  </div>
`;function m(o){if(!o)return"";let e=o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");return e=e.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>"),e=e.replace(/__([^_]+)__/g,"<strong>$1</strong>"),e=e.replace(/\*([^*]+)\*/g,"<em>$1</em>"),e=e.replace(/`([^`]+)`/g,'<code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-size: 13px;">$1</code>'),e=e.replace(/^\s*[-*]\s+(.*)$/gm,'<li style="margin-bottom: 4px;">$1</li>'),e=e.replace(/(<li style="margin-bottom: 4px;">[\s\S]*?<\/li>)/g,'<ul style="margin: 8px 0; padding-left: 20px;">$1</ul>'),e=e.replace(/\n\n+/g,'</p><p style="margin: 10px 0; color: #334155; font-size: 15px; line-height: 1.6;">'),e=e.replace(/\n/g,"<br/>"),`<p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.6;">${e}</p>`}var i=async o=>{if(!o.to||!o.to.includes("@"))return!1;try{const e=await fetch(y,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","X-Internal-Token":g},body:JSON.stringify({to:o.to,subject:o.subject,body:o.html,attachment:o.attachment,internal_token:g})}),t=await e.text();let r;try{r=JSON.parse(t)}catch{return!1}return!!(e.ok&&(r.status==="success"||r.success===!0))}catch{return!1}},h=async(o,e)=>{const t=e.role==="staff"||e.role==="team_lead",r=(o.createdByEmail||"").trim();t&&r&&r.toLowerCase()!==f.toLowerCase()&&await i({to:r,subject:`[Update] Ticket #${o.ticketNumber} has a new reply`,html:`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #f8fafc; padding: 20px; border-bottom: 1px solid #eaeaea; text-align: center;">
            <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Support Ticket Update</h2>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Ticket #${o.ticketNumber}</p>
          </div>
          <div style="padding: 30px 20px;">
            <p style="margin-top: 0; color: #334155; font-size: 16px;">Hello ${o.createdByName},</p>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;"><strong>${e.senderName}</strong> has replied to your ticket <strong>"${o.title}"</strong>.</p>
            
            <div style="margin: 25px 0; background-color: #f8fafc; padding: 20px; border-left: 4px solid #0284c7; border-radius: 6px;">
              ${m(e.content)}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${a}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                View and Respond to Ticket
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px; line-height: 1.5;">
              If the button above does not work, you can copy and paste the following URL into your browser:<br/>
              <a href="${a}" style="color: #0284c7;">${a}</a>
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #94a3b8; font-size: 13px;">
            <p style="margin: 0;">Please DO NOT REPLY to this email. Replies are not monitored.</p>
            <p style="margin: 5px 0 0;">&copy; ${new Date().getFullYear()} NAIYA TECHNOLOGY</p>
          </div>
        </div>`}).catch(n=>{})},v=async(o,e)=>{await i({to:f,subject:`[Email Recovery] Access Request: ${o}`,html:`
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #0284c7;">Email Recovery Request</h2>
        <p>An agent has submitted a request to recover access to their account.</p>
        <p><strong>Company Email:</strong> ${o}</p>
        <p><strong>Alternative Email:</strong> ${e}</p>
        <p>Login to the Admin Dashboard to review and approve/reject this request.</p>
        ${d()}
      </div>`})},w=async(o,e)=>{await i({to:o,subject:"[Access Granted] Welcome to Na'iya Support Portal",html:`
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #bbf7d0; background-color: #f0fdf4; border-radius: 8px;">
            <h2 style="color: #166534;">Access Approved</h2>
            <p>Your request for access has been approved. You can now login using your email address.</p>
            <p><strong>Login Email:</strong> ${o}</p>
            ${e?`
            <div style="margin: 20px 0; background-color: #ffffff; padding: 15px; border-left: 4px solid #166534; border-radius: 4px;">
              <p style="margin: 0; color: #166534;"><strong>Message from IT Staff:</strong></p>
              <p style="margin: 5px 0 0; white-space: pre-wrap;">${e}</p>
            </div>
            `:""}
            <div style="text-align: center; margin: 20px 0;">
                <a href="${a}" style="background-color: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login Now</a>
            </div>
        </div>`})},k=async(o,e)=>{await i({to:o,subject:"[Access Update] Regarding your Support Portal Request",html:`
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #374151;">Access Request Status</h2>
            <p>We reviewed your request for access to the Na'iya Support Portal.</p>
            <p>At this time, we are unable to grant access. If you believe this is an error, please contact your supervisor.</p>
            ${e?`
            <div style="margin: 20px 0; background-color: #f9fafb; padding: 15px; border-left: 4px solid #6b7280; border-radius: 4px;">
              <p style="margin: 0; color: #374151;"><strong>Message from IT Staff:</strong></p>
              <p style="margin: 5px 0 0; white-space: pre-wrap;">${e}</p>
            </div>
            `:""}
        </div>`})},$=async(o,e,t,r)=>{await i({to:o,subject:"[Access Recovered] Your Na'iya Support Credentials",html:`
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #bbf7d0; background-color: #f0fdf4; border-radius: 8px;">
            <h2 style="color: #166534;">Email Recovery Approved</h2>
            <p>Your identity has been successfully verified by our IT staff.</p>
            <p>You can now log in to the portal using your company email address and the temporary password below.</p>
            
            <div style="margin: 20px 0; background-color: #ffffff; padding: 15px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center;">
                <p style="margin: 0; color: #374151; font-size: 14px;"><strong>Company Email:</strong><br/>${e}</p>
                <p style="margin: 15px 0 0; color: #374151; font-size: 14px;"><strong>Temporary Password:</strong><br/>
                    <span style="font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #0284c7; font-weight: bold; padding: 5px 10px; background: #f0f9ff; border-radius: 4px; display: inline-block; margin-top: 5px;">${t}</span>
                </p>
            </div>
            
            ${r?`
            <div style="margin: 20px 0; background-color: #ffffff; padding: 15px; border-left: 4px solid #166534; border-radius: 4px;">
              <p style="margin: 0; color: #166534;"><strong>Message from IT Staff:</strong></p>
              <p style="margin: 5px 0 0; white-space: pre-wrap;">${r}</p>
            </div>
            `:""}
            
            <p style="color: #991b1b; font-size: 14px;"><strong>Important:</strong> We strongly recommend changing your password immediately after logging in.</p>
            
            <div style="text-align: center; margin: 20px 0;">
                <a href="${a}" style="background-color: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login Now</a>
            </div>
        </div>`})},S=async(o,e)=>{const t=[o];e?.altEmail&&e.altEmail.includes("@")&&e.altEmail.toLowerCase()!==o.toLowerCase()&&t.push(e.altEmail);const r=e?.isReset,n=e?.tempPassword,l=new Date().toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});for(const s of t)await i({to:s,subject:r?"[Security Alert] Your Na'iya Support Password Has Been Reset":"[Security Alert] Your Na'iya Support Password Has Been Created",html:`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%); padding: 24px 20px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Password Security Notice</h2>
            <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">Na'iya Support Portal Account Security</p>
          </div>
          <div style="padding: 28px 24px;">
            <p style="margin-top: 0; color: #334155; font-size: 15px;">Hello,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
              This is an automated confirmation that the password for your Na'iya Support account (<strong>${o}</strong>) was successfully <strong>${r?"reset / updated":"created"}</strong> on <strong>${l}</strong>.
            </p>

            ${n?`
              <div style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Your Temporary Password</p>
                <div style="margin-top: 8px;">
                  <span style="font-family: monospace; font-size: 22px; letter-spacing: 3px; color: #0284c7; font-weight: bold; padding: 8px 18px; background: #e0f2fe; border-radius: 6px; display: inline-block;">${n}</span>
                </div>
                <p style="margin: 10px 0 0; color: #94a3b8; font-size: 12px;">Please change this password immediately after logging in.</p>
              </div>
            `:`
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
              <a href="${a}" style="background-color: #0284c7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">Log In to Portal</a>
            </div>

            ${d()}
          </div>
        </div>`}).catch(c=>{})},E=async(o,e,t,r="Announcement",n="Na'iya IT Support")=>{let l=0,s=0;const c=`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 20px; text-align: center; color: white;">
        <div style="display: inline-block; background-color: ${r==="Urgent"||r==="Incident"?"#fee2e2":r==="Maintenance"?"#fef3c7":"#e0f2fe"}; color: ${r==="Urgent"||r==="Incident"?"#dc2626":r==="Maintenance"?"#d97706":"#0284c7"}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          ${r}
        </div>
        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${e}</h2>
        <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Official Message from ${n}</p>
      </div>
      <div style="padding: 30px 24px;">
        <div style="color: #334155; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">
${t}
        </div>

        <div style="text-align: center; margin: 30px 0 10px 0;">
          <a href="${a}" style="background-color: #0284c7; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);">
            Open Support Portal
          </a>
        </div>

        ${d()}
      </div>
    </div>`,x=Array.from(new Set(o.map(p=>p.trim().toLowerCase()).filter(p=>p.includes("@"))));for(const p of x)try{await i({to:p,subject:`[${r}] ${e}`,html:c})?l++:s++}catch{s++}return{sent:l,failed:s}},A=async(o,e,t,r)=>await i({to:o,subject:e,html:t,attachment:r}),u=["naiyatechnology.org","samuikyglobal.com.ng","naiyatech.com.ng"],N=o=>{if(!o||typeof o!="string")return!1;const e=o.trim().toLowerCase().split("@");if(e.length!==2)return!1;const t=e[1];return u.some(r=>t===r||t.endsWith("."+r))};export{v as a,h as c,k as i,E as l,N as n,S as o,w as r,$ as s,u as t,A as u};
