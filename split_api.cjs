const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, 'cpanel', 'api.php');
const routesDir = path.join(__dirname, 'cpanel', 'routes');

if (!fs.existsSync(routesDir)) {
    fs.mkdirSync(routesDir, { recursive: true });
}

const content = fs.readFileSync(apiPath, 'utf8');

const switchStartMatch = content.match(/try\s*\{\s*switch\s*\(\$action\)\s*\{/);
if (!switchStartMatch) {
    console.error("Could not find switch statement");
    process.exit(1);
}

const switchStartIndex = switchStartMatch.index + switchStartMatch[0].length;

const catchMatch = content.match(/\}\s*catch\s*\(\s*Throwable\s*\$e\s*\)\s*\{/);
if (!catchMatch) {
    console.error("Could not find catch block");
    process.exit(1);
}

const switchEndIndex = catchMatch.index;

const topContent = content.substring(0, switchStartMatch.index);
const switchContent = content.substring(switchStartIndex, switchEndIndex);
const bottomContent = content.substring(switchEndIndex);

const routeGroups = {
    'auth.php': ['login_staff', 'login_lead', 'login_agent', 'send_agent_otp', 'verify_agent_otp_and_set_password', 'approve_agent_recovery', 'set_agent_password', 'update_agent_password'],
    'tickets.php': ['create_ticket', 'update_ticket', 'add_message', 'get_tickets', 'search_tickets', 'get_ticket_details', 'cleanup_tickets'],
    'agents.php': ['get_agents', 'update_agents', 'delete_agents'],
    'staff.php': ['get_staff', 'upsert_staff', 'delete_staff', 'get_leads', 'upsert_lead', 'delete_lead'],
    'feedback.php': ['get_feedback', 'get_feedback_image', 'save_feedback', 'resolve_feedback'],
    'system.php': ['get_settings', 'update_settings', 'get_analytics_snapshot', 'get_stats', 'track_action', 'upload_image', 'send_email', 'upgrade']
};

let routesCode = {
    'auth.php': "<?php\n// Auth Routes\n",
    'tickets.php': "<?php\n// Ticket Routes\n",
    'agents.php': "<?php\n// Agent Routes\n",
    'staff.php': "<?php\n// Staff Routes\n",
    'feedback.php': "<?php\n// Feedback Routes\n",
    'system.php': "<?php\n// System Routes\n"
};

const lines = switchContent.split('\n');
let currentGroup = null;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let caseMatch = line.match(/^\s*case\s+'([^']+)':/);
    if (caseMatch) {
        let caseName = caseMatch[1];
        let foundGroup = null;
        for (let file in routeGroups) {
            if (routeGroups[file].includes(caseName)) {
                foundGroup = file;
                break;
            }
        }
        if (foundGroup) {
            currentGroup = foundGroup;
        }
        if (currentGroup) {
            routesCode[currentGroup] += line + '\n';
        }
    } else if (line.match(/^\s*default:/)) {
        currentGroup = null;
    } else if (currentGroup) {
        routesCode[currentGroup] += line + '\n';
    }
}

for (let file in routesCode) {
    fs.writeFileSync(path.join(routesDir, file), routesCode[file]);
    console.log(`Created ${file}`);
}

let newSwitch = `try {
    switch ($action) {
`;

for (let file in routeGroups) {
    for (let c of routeGroups[file]) {
        newSwitch += `        case '${c}':\n`;
    }
    newSwitch += `            require __DIR__ . '/routes/${file}';\n`;
    newSwitch += `            break;\n\n`;
}
newSwitch += `        default:\n            echo json_encode(['status' => 'error', 'message' => 'Invalid action']);\n            break;\n    }\n`;

const newApiPhp = topContent + newSwitch + bottomContent;
fs.writeFileSync(apiPath, newApiPhp);
console.log("Updated api.php");
