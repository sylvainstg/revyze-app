---
description: Deploy the application to the Firebase staging channel
---

# Deploy to Staging

## Steps

1. Navigate to the app directory
```bash
cd /Users/sylvain/Dev/DSNG/my-dsng-app
```

// turbo
2. Run the staging deployment (builds and deploys to Firebase hosting channel)
```bash
npm run deploy:staging
```

3. The staging URL will be displayed in the output, typically:
   - `https://dsng-app--staging-XXXXXX.web.app`

## Notes
- This deploys to a Firebase preview channel named "staging"
- Preview channels expire after 7 days by default
- The script runs `npm run build` first, then `firebase hosting:channel:deploy staging`
