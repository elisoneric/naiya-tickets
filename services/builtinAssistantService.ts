import { knowledgeBase, KBArticle } from './knowledgeBase';

export interface ChatOption {
    label: string;
    value: string;
    action?: 'send_msg' | 'open_modal' | 'open_kb' | 'create_ticket' | 'back_main';
    modalType?: 'vpn' | 'nimc' | 'webmail' | 'pay' | 'history';
    kbId?: string;
    category?: string;
    icon?: string;
}

export interface ChatActionButton {
    label: string;
    action: 'open_modal' | 'open_kb' | 'create_ticket' | 'link';
    modalType?: 'vpn' | 'nimc' | 'webmail' | 'pay' | 'history';
    kbId?: string;
    url?: string;
    category?: string;
}

export interface BuiltinAssistantResponse {
    text: string;
    options?: ChatOption[];
    actionButton?: ChatActionButton;
    autoCreateCategory?: string;
}

export const getMainMenuOptions = (): ChatOption[] => [
    { label: 'Payment & Work Done', value: 'Payment & Work Done Portal', icon: 'CreditCard' },
    { label: 'Device & Activation', value: 'Device & Activation Related', icon: 'Device' },
    { label: 'VPN Related Issues', value: 'VPN Related', icon: 'Shield' },
    { label: 'NIMC Login Details', value: 'NIMC Login Details', icon: 'Key' },
    { label: 'Webmail / Email Access', value: 'WEBMAIL', icon: 'Mail' },
    { label: 'Metadata Onboarding', value: 'Metadata Onboarding', icon: 'Document' },
    { label: 'Training & Registration', value: 'Training Registration', icon: 'Book' },
    { label: 'Other / Open Support Ticket', value: 'I need to report an issue or complain.', icon: 'Ticket' }
];

export const processBuiltinAssistantMessage = (
    userMsg: string,
    history: { role: string; text: string }[] = [],
    disabledCategories: { name: string; message: string }[] = []
): BuiltinAssistantResponse => {
    const textLower = userMsg.trim().toLowerCase();

    // Check for explicit "back to main" or greeting
    if (textLower === 'main menu' || textLower === 'menu' || textLower === 'help' || textLower === 'start over') {
        return {
            text: "Here is what I can help you with. Please choose a topic below or type your question:",
            options: getMainMenuOptions()
        };
    }

    // 1. Check if category is disabled by lockdown guard
    for (const d of disabledCategories) {
        if (textLower.includes(d.name.toLowerCase())) {
            return {
                text: `**${d.name}** is currently under maintenance:\n\n${d.message}\n\nPlease check back later or choose another topic.`,
                options: getMainMenuOptions()
            };
        }
    }

    // 2. PAYMENT & WORK DONE PORTAL
    if (
        textLower.includes('pay') ||
        textLower.includes('salary') ||
        textLower.includes('disbursement') ||
        textLower.includes('work done') ||
        textLower.includes('enrollment count') ||
        textLower.includes('fep report') ||
        textLower.includes('samuiky') ||
        textLower.includes('naiya tech') ||
        textLower.includes('payout') ||
        textLower === 'payment & work done portal'
    ) {
        return {
            text: "**Agent Payment & Work Done Reporter**\n\nYou can query your verified monthly enrollments and work done records for **NA'IYA TECHNOLOGIES LIMITED** and **SAMUIKY GLOBAL** directly.\n\n• Simply enter your **Device IMEI** or **NIN**.\n• Access is logged and tracked to your email.\n• View your verified count and download your official CSV statement or printable slip.\n\nClick below to open the Payment & Work Done portal:",
            actionButton: {
                label: 'Open Payment & Work Portal',
                action: 'open_modal',
                modalType: 'pay'
            },
            options: [
                { label: 'Open Payment & Work Portal', value: 'LAUNCH_PAY', action: 'open_modal', modalType: 'pay' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 3. DEVICE & ACTIVATION RELATED (STRICT DEFLECTION — NO TICKETS)
    if (
        textLower.includes('device') || 
        textLower.includes('activation') || 
        textLower.includes('activate') ||
        textLower.includes('onboarding') ||
        textLower.includes('setup') ||
        textLower === 'device & activation related'
    ) {
        const disclaimer = "\n\n⚠️ **Notice**: IT Support handles technical system access only (NIMC login credentials, metadata). We do not handle physical devices, hardware repairs, or form approvals, and we cannot fast-track requests. Submitted forms will be considered in normal batch processing. For device troubleshooting, setup, or peer assistance, please ask in your official Enroller Community Group.";

        // Specific sub-queries
        if (textLower.includes('switch') || textLower.includes('production') || textLower.includes('test run')) {
            const kb = knowledgeBase.find(k => k.id === 'kb-002');
            return {
                text: `**Post-Onboarding & Production Switch**\n\n${kb?.resolutionText || 'To complete your post-onboarding production switch, please do exactly 3 test runs and then fill out the completion form.'}${disclaimer}`,
                actionButton: kb?.link ? { label: 'Open Production Switch Form', action: 'link', url: kb.link } : undefined,
                options: [
                    { label: 'Other Device Info', value: 'Device & Activation Related' },
                    { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                ]
            };
        }

        if (textLower.includes('damage') || textLower.includes('loss') || textLower.includes('theft') || textLower.includes('broken') || textLower.includes('stolen')) {
            const kb = knowledgeBase.find(k => k.id === 'kb-003');
            return {
                text: `**Device Damage, Loss or Theft Reporting**\n\n${kb?.resolutionText}${disclaimer}`,
                actionButton: kb?.link ? { label: 'Send Report Email', action: 'link', url: kb.link } : undefined,
                options: [
                    { label: 'Other Device Info', value: 'Device & Activation Related' },
                    { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                ]
            };
        }

        if (textLower.includes('reactivat') || textLower.includes('workflow')) {
            const kb = knowledgeBase.find(k => k.id === 'kb-004');
            return {
                text: `**Reactivation & Workflow Issues**\n\n${kb?.resolutionText}${disclaimer}`,
                actionButton: kb?.link ? { label: 'Open Reactivation Form', action: 'link', url: kb.link } : undefined,
                options: [
                    { label: 'Other Device Info', value: 'Device & Activation Related' },
                    { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                ]
            };
        }

        if (textLower.includes('detail') || textLower.includes('admin') || textLower.includes('esa') || textLower.includes('nin')) {
            const kb = knowledgeBase.find(k => k.id === 'kb-001');
            return {
                text: `**Device Onboarding & Activation Details**\n\n${kb?.resolutionText}${disclaimer}`,
                actionButton: kb?.link ? { label: 'Open Onboarding Form', action: 'link', url: kb.link } : undefined,
                options: [
                    { label: 'Post-Onboarding Switch', value: 'Post-Onboarding Switch' },
                    { label: 'Main Menu', value: 'main menu', action: 'back_main' }
                ]
            };
        }

        // Default Device sub-menu
        return {
            text: `Here are the official solutions for **Device & Activation Related** topics:${disclaimer}\n\nPlease select what applies to you:`,
            options: [
                { label: 'Device Activation Details & ESA Code', value: 'Device Activation Details' },
                { label: 'Post-Onboarding Production Switch (3 Test Runs)', value: 'Post-Onboarding Switch' },
                { label: 'Device Damage, Loss or Theft Report', value: 'Device Damage Report' },
                { label: 'Reactivation & Workflow Support', value: 'Reactivation Support' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 3. VPN RELATED
    if (textLower.includes('vpn') || textLower.includes('wireguard') || textLower.includes('cisco') || textLower === 'vpn related') {
        return {
            text: "**VPN Assistant**\n\nHello, here is your VPN tool:\n\n• Use **MTN network** for best connection.\n• Double-check your password (no spaces, check Caps Lock).\n\nClick below to open your VPN:",
            actionButton: {
                label: 'Open VPN Tool',
                action: 'open_modal',
                modalType: 'vpn'
            },
            options: [
                { label: 'Open VPN Tool', value: 'LAUNCH_VPN', action: 'open_modal', modalType: 'vpn' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 4. NIMC LOGIN DETAILS
    if (textLower.includes('nimc') || textLower.includes('nin login') || textLower.includes('identity') || textLower === 'nimc login details') {
        return {
            text: "**NIMC Login & Identity Verification**\n\nFor NIMC login issues, password retrieval, or identity verification assistance, you can use our interactive NIMC Login Helper.",
            actionButton: {
                label: 'Open NIMC Login Helper',
                action: 'open_modal',
                modalType: 'nimc'
            },
            options: [
                { label: 'Open NIMC Login Helper', value: 'LAUNCH_NIMC', action: 'open_modal', modalType: 'nimc' },
                { label: 'State NIMC Complaint', value: 'I have a problem with my NIMC login details.' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 5. WEBMAIL
    if (textLower.includes('webmail') || textLower.includes('email') || textLower.includes('mailbox') || textLower === 'webmail') {
        return {
            text: "**Corporate Webmail Support**\n\nIf you are locked out of your corporate email, need a password reset, or are experiencing mailbox sync errors, our Webmail Assistant is available.",
            actionButton: {
                label: 'Open Webmail Assistant',
                action: 'open_modal',
                modalType: 'webmail'
            },
            options: [
                { label: 'Open Webmail Assistant', value: 'LAUNCH_WEBMAIL', action: 'open_modal', modalType: 'webmail' },
                { label: 'Report Webmail Access Problem', value: 'I need help resetting or accessing my corporate webmail.' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 6. METADATA ONBOARDING
    if (textLower.includes('metadata') || textLower === 'metadata onboarding') {
        return {
            text: "**Metadata Onboarding**\n\nTo onboard metadata, ensure your device activation has been completed and verified with your ESA code. If you require manual verification from an IT officer, we can open a ticket for you.",
            options: [
                { label: 'View Activation Credentials', value: 'Device Activation Details' },
                { label: 'Report Metadata Onboarding Issue', value: 'I need assistance with my metadata onboarding.' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 7. TRAINING REGISTRATION
    if (textLower.includes('train') || textLower.includes('class') || textLower.includes('register')) {
        const kb = knowledgeBase.find(k => k.id === 'kb-005');
        return {
            text: `**Training Registration**\n\n${kb?.resolutionText}`,
            actionButton: kb?.link ? { label: 'Open Training Form', action: 'link', url: kb.link } : undefined,
            options: [
                { label: 'Inquire About Training', value: 'I need more information about training registration.' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 8. BLACKLIST RESOLUTION
    if (textLower.includes('blacklist') || textLower.includes('blocked') || textLower.includes('suspended')) {
        const kb = knowledgeBase.find(k => k.id === 'kb-006');
        return {
            text: `**Blacklist Appeal & Resolution**\n\n${kb?.resolutionText}`,
            actionButton: kb?.link ? { label: 'Open Blacklist Resolution Form', action: 'link', url: kb.link } : undefined,
            options: [
                { label: 'Appeal Blacklist Status', value: 'My account has been blacklisted and I need IT support.' },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 9. SEARCH KNOWLEDGE BASE BY KEYWORDS
    const matchedKb = knowledgeBase.find(kb => 
        kb.keywords.some(k => textLower.includes(k.toLowerCase())) ||
        kb.topic.toLowerCase().includes(textLower)
    );

    if (matchedKb) {
        return {
            text: `**${matchedKb.topic}**\n\n${matchedKb.resolutionText}`,
            actionButton: matchedKb.link ? { label: 'Open Official Form / Link', action: 'link', url: matchedKb.link } : undefined,
            options: [
                { label: 'Still need help? State Issue', value: `I tried the solution for ${matchedKb.topic} but I still need assistance.` },
                { label: 'Main Menu', value: 'main menu', action: 'back_main' }
            ]
        };
    }

    // 10. UNMATCHED / CUSTOM USER QUERY -> CONVERSATIONAL TRIAGE
    return {
        text: `I understand you need assistance with:\n> "${userMsg}"\n\nPlease provide any additional details, or choose an option below:`,
        options: [
            { label: 'Payment & Work Report', value: 'LAUNCH_PAY', action: 'open_modal', modalType: 'pay' },
            { label: 'Open VPN Assistant', value: 'LAUNCH_VPN', action: 'open_modal', modalType: 'vpn' },
            { label: 'Open NIMC Helper', value: 'LAUNCH_NIMC', action: 'open_modal', modalType: 'nimc' },
            { label: 'Open Webmail Assistant', value: 'LAUNCH_WEBMAIL', action: 'open_modal', modalType: 'webmail' },
            { label: 'Main Menu', value: 'main menu', action: 'back_main' }
        ]
    };
};
