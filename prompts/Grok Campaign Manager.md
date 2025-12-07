You are a senior full-stack engineer implementing features in Antigravity IDE for a single-page React web app called Revize. The app uses Create React App (or Vite) for the frontend, with Firebase as the complete backend: Firestore for database, Firebase Functions (Node.js 20+) for serverless APIs and jobs, Firebase Auth for authentication, and Firebase Hosting for deployment. SendGrid is already integrated in Functions via @sendgrid/mail. The app has existing user analytics stored in Firestore (e.g., collections like 'users' and 'user_events').

Implement a complete, production-ready but minimal “Feedback Loops Engine” for targeted user feedback collection. Focus on early adopters: segment users via Firestore queries, deliver one delicate in-app question at a time, collect answers, and fallback to email via SendGrid if unanswered. Deliver clean, commented, copy-pasteable code as separate files/folders for easy integration into the existing repo. Use TypeScript for all code, ESLint/Prettier for formatting, and Firebase SDKs (v10+).

Required features (exactly these for MVP, no extras):

1. Firestore Schema (via initial data setup or migration script)
   - Collection: 'feedback_campaigns' (docs with fields: id (string), name (string), segmentQuery (object for Firestore query params, e.g., { field: 'sessionsLast7d', op: '>=', value: 5 }), question (string), type (enum: 'free_text' | 'multiple_choice'), choices? (array<string> for multiple_choice), anonymous (boolean), activeFrom (timestamp), activeUntil (timestamp), frequencyCapDays (number, default 14), emailFallbackAfterHours (number, default 120))
   - Collection: 'feedback_answers' (docs with fields: id (string), userId (string), campaignId (string), answer (string or object for choices), timestamp (timestamp), segmentData? (object for query snapshot))
   - Update existing 'users' collection: add field 'lastFeedbackRequestedAt' (timestamp, nullable)

2. Firebase Functions (in functions/src/index.ts and new files)
   - Auth middleware: require Firebase Auth UID for all endpoints.
   - https.onRequest('/api/feedback/active'): GET - Returns active campaign for current user (query Firestore for matching active campaigns, check frequency cap via user's lastFeedbackRequestedAt and segmentQuery). If match, return campaign doc; else null.
   - https.onRequest('/api/feedback/answer'): POST - Save answer to 'feedback_answers', update user's lastFeedbackRequestedAt to now(). Return success.
   - Admin-only (check Firebase Admin or custom admin UID claims): 
     - GET '/api/feedback/campaigns': List all campaigns with aggregated answer counts (use aggregation queries).
     - POST '/api/feedback/campaigns': Create new campaign (validate segmentQuery).
     - PUT '/api/feedback/campaigns/{id}': Update campaign.
   - Background job: https.onRequest('/api/feedback/send-email-fallbacks') (callable by Cloud Scheduler cron): Query users who saw a campaign > emailFallbackAfterHours ago (no answer in 'feedback_answers'), send personalized SendGrid email with question + one-click deep link back to app (e.g., pre-fill answer via query param). Use dynamic templates.

3. Cloud Scheduler Setup (instructions only, no code)
   - Suggest cron job: Run '/api/feedback/send-email-fallbacks' daily at 2 AM UTC via Google Cloud Console (e.g., '0 2 * * *' schedule).

4. React Frontend Components (in src/components/)
   - Hook: useFeedback() - Fetches /api/feedback/active on mount/session, polls every 5min if active. Returns { campaign, dismiss() }.
   - Component: <FeedbackModal /> - Conditional render via useFeedback. Delicate UI (use TailwindCSS or Material-UI for modal/toast). Supports free_text (textarea) or multiple_choice (radio/select). Buttons: Submit, "Not now" (dismisses, sets localStorage flag for 14 days). Post-submit: Thank-you toast (use react-hot-toast). Auto-show on routes like dashboard if active and not dismissed.
   - Integrate into App.tsx: Wrap <FeedbackModal /> at root level.

5. Admin Dashboard Page (protected route /admin/feedback)
   - Component: FeedbackAdminPage.tsx - Use Firebase Auth to guard (redirect if not admin). Fetch campaigns via API. Table: List campaigns (use react-table or simple list) with answer counts. Forms: Create/edit campaign (use react-hook-form, validate segmentQuery as JSON). Export answers: Button to download CSV of all answers (fetch via API, use PapaParse).
   - Add route to main App router (e.g., React Router).

6. Politeness & Security Rules
   - Enforce one active campaign max per user at a time.
   - Frequency: Block if lastFeedbackRequestedAt within cap days.
   - Anonymity: If true, strip userId/email from answer storage.
   - Rate limit: Use Firebase Functions rate limiting if needed.
   - Validation: Sanitize inputs, validate timestamps.

Additional Files/Setup:
- functions/package.json updates (add deps: @sendgrid/mail if missing, firebase-admin, firebase-functions).
- src/types/feedback.ts: TypeScript interfaces for Campaign, Answer, etc.
- Example SendGrid dynamic template (JSON for the email: subject, html with {{question}}, {{answerLink}} = `${window.location.origin}?feedbackPrefill=${campaignId}`).
- Deployment instructions: firebase deploy --only functions,hosting; initial Firestore rules for security (read/write with auth).
- Test utils: Simple integration test script for Functions (using Jest).

Structure output as labeled sections with full file paths and code:
- Firestore Setup (migration script in functions/src/migrations/feedback-setup.ts)
- Firebase Functions (full index.ts + any utils)
- React Components (full .tsx files)
- Types and Utils
- Admin Page (full .tsx)
- SendGrid Template Example
- Deployment & Cron Instructions

Make everything type-safe, secure (Firestore rules prevent unauthorized access), performant (use batched writes), and ready to deploy. No third-party feedback tools—keep it all in-house with Firebase. Optimize for single-page app flow (no full reloads).