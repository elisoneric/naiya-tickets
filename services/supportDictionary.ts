export interface SupportIntent {
    intentId: string;
    category: string;
    triggerKeywords: string[];
    mandatoryPreChecks: string[];
    requiredFieldsToCollect?: string[];
    canonicalResponse: string;
    actionFormUrl?: string;
    canEscalateToStaff: boolean;
}

export const SUPPORT_DICTIONARY: Record<string, SupportIntent> = {
    // ==========================================
    // 1. VPN RELATED
    // ==========================================
    VPN_AUTH_FAILURE: {
        intentId: "vpn_auth_failure",
        category: "VPN Related",
        triggerKeywords: [
            "authentication failure", "vpn not connecting", "vpn fluctuating",
            "password not working", "unstable vpn", "gateway timeout", "vpn expired",
            "not connecting", "cant connect"
        ],
        mandatoryPreChecks: [
            "Are you connecting through an MTN SIM or MTN mobile hotspot? (MTN provides optimal routing with zero drops to NIMC FortiGate servers)",
            "Did you copy the password directly with NO leading or trailing spaces?",
            "Is your Caps Lock turned OFF?"
        ],
        canonicalResponse: `Our automated gateway checks confirm this VPN is active on our FortiGate server.
Please ensure:
1. Connect via an MTN network or MTN mobile hotspot (Airtel and Glo frequently drop connections to NIMC).
2. Double-check password formatting (no spaces, verify capital letters and special characters).
If you have verified with MTN and it still fails, please confirm and I will route you to an IT engineer.`,
        canEscalateToStaff: true
    },

    VPN_PERSONAL_REQUEST: {
        intentId: "vpn_personal_request",
        category: "VPN Related",
        triggerKeywords: [
            "personal vpn", "my own vpn", "many people using it", "too many connections", "shared vpn"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `While we understand your preference for an individual VPN, NIMC provides these VPN slots and currently experiences delays in standalone activations.
To prevent agents from being stranded, our IT team allocates verified, active connections. Rest assured, your allocated slot is dedicated to your active work session. If your assigned VPN experiences downtime, our system will swap you to an active one.`,
        canEscalateToStaff: false
    },

    // ==========================================
    // 2. NIMC LOGIN & METADATA
    // ==========================================
    NIMC_AGENT_NOT_FOUND: {
        intentId: "nimc_agent_not_found",
        category: "NIMC Login Details",
        triggerKeywords: [
            "agent not found", "unable to find agent", "agent not on metadata",
            "invalid user response", "not found on metadata"
        ],
        mandatoryPreChecks: [
            "Have you completed your official training and certification exam?"
        ],
        requiredFieldsToCollect: ["Full Name", "NIN (11 digits)", "Phone Number", "Email Address"],
        canonicalResponse: `If you have completed your training and certification but receive 'Agent Not Found', you have not yet been populated on the NIMC metadata server.
Please submit the official Agent Upload Request Form below:`,
        actionFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeT5Ou82Iha4zdHZ2ADwPHvcpS8NfNrlyAlSU1sYq6PyLAFHQ/viewform",
        canEscalateToStaff: true
    },

    NIMC_ACCOUNT_INACTIVE: {
        intentId: "nimc_account_inactive",
        category: "NIMC Login Details",
        triggerKeywords: [
            "account is inactive", "contact your fep administrator", "contact fep admin",
            "inactive account", "account inactive"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `Your account is temporarily inactive pending NIMC onboarding window approval.
NIMC opens enrollment windows in batches. Once NIMC opens the onboarding process and activates your batch, an announcement will be published to your agent group and your login will become active.`,
        canEscalateToStaff: false
    },

    NIMC_STATUS_CHECK: {
        intentId: "nimc_status_check",
        category: "NIMC Login Details",
        triggerKeywords: [
            "check metadata status", "check my nin", "is my email on meta",
            "status check", "verify my details"
        ],
        mandatoryPreChecks: [],
        requiredFieldsToCollect: ["FEP (NA'IYA or SAMUIKY)", "Full Name", "NIN (11 digits)", "Phone Number", "Email Address"],
        canonicalResponse: `Please provide your details (FEP: NA'IYA or SAMUIKY, Name, NIN, Phone, Email) for an official metadata verification. Our staff will cross-reference the central database and update your ticket shortly.`,
        canEscalateToStaff: true
    },

    // ==========================================
    // 3. WEBMAIL / CORPORATE EMAIL
    // ==========================================
    WEBMAIL_PASSWORD_RESET: {
        intentId: "webmail_password_reset",
        category: "WEBMAIL",
        triggerKeywords: [
            "forgot webmail password", "reset corporate email", "cant access naiyatech email",
            "webmail password", "forgot official email password", "webmail access"
        ],
        mandatoryPreChecks: [
            "Is this an official corporate email ending in @naiyatechnology.org, @naiyatech.com.ng, or @samuikyglobal.com.ng?"
        ],
        requiredFieldsToCollect: ["Corporate Email Address"],
        canonicalResponse: `To reset your corporate mailbox, please provide your exact company email (e.g., yourname@naiyatech.com.ng).
You can log in to your webmail at:
• https://naiyatechnology.org/webmail
• https://samuikyglobal.com.ng/webmail`,
        canEscalateToStaff: true
    },

    WEBMAIL_PERSONAL_EMAIL_REJECT: {
        intentId: "webmail_personal_email_reject",
        category: "WEBMAIL",
        triggerKeywords: [
            "@gmail.com", "@yahoo.com", "reset my gmail", "forgot google password", "personal email"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `We can only manage and reset official corporate emails (@naiyatechnology.org, @naiyatech.com.ng, @samuikyglobal.com.ng).
We are unable to reset personal Gmail or Yahoo passwords. Please use Google's or Yahoo's password recovery page.`,
        canEscalateToStaff: false
    },

    // ==========================================
    // 4. DEVICE, HARDWARE & ACTIVATION (STRICT DEFLECTION — NO ESCALATION)
    // ==========================================
    DEVICE_SETUP_DETAILS: {
        intentId: "device_setup_details",
        category: "Device & Activation Related",
        triggerKeywords: [
            "activation details", "onboarding details", "esa code", "admin nin", "device setup"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `For Device Onboarding and Activation, enter the following exact parameters:
• Admin First Name: Yahaya
• Surname: Olajide
• NIN: 18050024425
• Phone: 09033666669
• Email: olajideyahayahammed@naiyatechnology.org
• ESA: NA'IYA TECHNOLOGY SOLUTIONS LTD
• ESA CODE: 437

Registration Form: https://docs.google.com/forms/d/e/1FAIpQLSeSKPdSgAbAkJDC6vORXiKCmNPH2Kj7r5nMW90ai9_Tv_Ganw/viewform

Notice: IT Support handles technical system access only. We do not handle physical devices or form processing, and cannot fast-track submissions. Any submitted form is considered in due batch processing. For device assistance, please ask in your official enroller community group.`,
        canEscalateToStaff: false
    },

    DEVICE_PRODUCTION_SWITCH: {
        intentId: "device_production_switch",
        category: "Device & Activation Related",
        triggerKeywords: [
            "switch to production", "test run completed", "device not live",
            "switch to live", "test enrollment done"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `To switch your device to live production:
1. Conduct exactly three test runs and tap 'Switch to Production' on your terminal.
2. Complete the official Production Switch Form below:
https://docs.google.com/forms/d/e/1FAIpQLSeqpetDm8DH8wtlmu4SkiUhpp1VEsQToIxsEqitqVRoF5b4kg/viewform

Notice: IT Support handles technical system access only. We do not handle physical devices or form approvals, and we cannot fast-track submissions. Submitted forms are reviewed in regular processing batches. For device troubleshooting and advice, please ask in your official enroller community group.`,
        actionFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeqpetDm8DH8wtlmu4SkiUhpp1VEsQToIxsEqitqVRoF5b4kg/viewform",
        canEscalateToStaff: false
    },

    DEVICE_REACTIVATION: {
        intentId: "device_reactivation",
        category: "Device & Activation Related",
        triggerKeywords: [
            "device inactive", "reactivation form", "workflow issue",
            "stuck on workflow"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `For devices requiring reactivation or unresolved workflow issues, please complete the official Reactivation Form:
https://docs.google.com/forms/d/e/1FAIpQLSdQuZlgQRqv6bHBaoMByY6JoZhESex7c4VxN1A3TDvLoCojQw/viewform

Notice: We are not the form handlers and cannot fast-track requests; forms are reviewed in regular processing batches. For device troubleshooting, settings, or peer advice, please ask in your official enroller community group.`,
        actionFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdQuZlgQRqv6bHBaoMByY6JoZhESex7c4VxN1A3TDvLoCojQw/viewform",
        canEscalateToStaff: false
    },

    DEVICE_DAMAGE_THEFT: {
        intentId: "device_damage_theft",
        category: "Device & Activation Related",
        triggerKeywords: [
            "damage", "broken device", "screen broken", "theft", "stolen", "lost device"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `For device damage, loss, or theft, please report directly via email:
• Email: Customercaretransitioning@naiyatechnology.org
• CC: Abubakaribrahimolose@naiyatechnlogy.org, Naiyatransitioningcustomercare@gmail.com

Notice: Physical device replacements and approvals are not handled by IT support and cannot be fast-tracked. For additional guidance, please consult your official enroller community group.`,
        canEscalateToStaff: false
    },


    // ==========================================
    // 5. FINANCE & NON-IT INQUIRIES
    // ==========================================
    FINANCE_COMMISSION_DEFLECTION: {
        intentId: "finance_commission_deflection",
        category: "Others",
        triggerKeywords: [
            "commission", "payment", "when will i get paid", "august payment",
            "october commission", "nin payment", "allowance", "salary"
        ],
        mandatoryPreChecks: [],
        canonicalResponse: `This support desk handles IT and technical systems support only (VPNs, Webmail, Device Activation, NIMC Logins).
We do not process finance or commission payments. Official commission announcements and portal updates are published directly in your official agent communication channels.`,
        canEscalateToStaff: false
    }
};

/**
 * Helper to build an injection string of the support dictionary for the system prompt.
 */
export const getSupportDictionaryPrompt = (): string => {
    return Object.values(SUPPORT_DICTIONARY).map(intent => {
        let block = `[INTENT: ${intent.intentId}] Category: ${intent.category}\nTrigger Keywords: ${intent.triggerKeywords.join(', ')}\nCanonical Response / Resolution:\n${intent.canonicalResponse}`;
        if (intent.mandatoryPreChecks.length > 0) {
            block += `\nMandatory Pre-Checks to Ask User:\n${intent.mandatoryPreChecks.map(c => `  - ${c}`).join('\n')}`;
        }
        if (intent.requiredFieldsToCollect && intent.requiredFieldsToCollect.length > 0) {
            block += `\nRequired Fields before Escalating: ${intent.requiredFieldsToCollect.join(', ')}`;
        }
        if (intent.actionFormUrl) {
            block += `\nOfficial Form Link: ${intent.actionFormUrl}`;
        }
        block += `\nCan Escalate to Human IT: ${intent.canEscalateToStaff ? 'YES' : 'NO'}`;
        return block;
    }).join('\n\n---\n\n');
};
