const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'cpanel', 'routes');
const files = fs.readdirSync(routesDir);

files.forEach(file => {
    if (file.endsWith('.php')) {
        const filePath = path.join(routesDir, file);
        let content = fs.readFileSync(filePath, 'utf8');

        // Check if already wrapped in switch
        if (!content.includes('switch ($action)')) {
            // Insert 'switch ($action) {' right after <?php and any header comments
            const phpHeaderMatch = content.match(/<\?php\s*(\/\/[^\n]*\n)?/);
            if (phpHeaderMatch) {
                const header = phpHeaderMatch[0];
                const rest = content.substring(header.length);
                const newContent = header + "\nswitch ($action) {\n" + rest + "\n}\n";
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`Successfully wrapped ${file} in switch ($action)`);
            }
        }
    }
});
