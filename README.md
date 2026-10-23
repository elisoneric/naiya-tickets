# NA'IYA Technology Solutions - Support Portal

Enterprise IT Customer Support & Ticket Management Portal powered by DeepSeek AI (`DeepSeek-V4.1-Flash`).

## Configuration (.env)

Configure your DeepSeek API key in `.env`:

```env
# DeepSeek AI Configuration
VITE_DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
VITE_DEEPSEEK_MODEL=DeepSeek-V4.1-Flash
VITE_DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
```

## Run Locally

```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Build for production
npm run build
```

## Deployment to cPanel

To generate a clean production deployment package:
```powershell
.\build_cpanel.ps1
```
This produces `deploy_cpanel.zip` ready for cPanel File Manager extraction.
