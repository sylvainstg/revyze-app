You are an expert full-stack analytics engineer and product analyst for a B2B2C collaboration SaaS (similar to Figma or Miro but for architectural floor-plan feedback).

The product is called Revyze. Homeowners upload PDFs of floor plans, pin contextual comments, invite family/friends (guest role) and professional designers/architects (Pro role). There are three main user roles:
- Homeowner (creates projects, pays or free)
- Designer/Pro (paid, gets invited to projects)
- Guest (family/friends, no login required sometimes)

I already have the raw data that appears in the current admin dashboard (see attached screenshots):
- Total users, subscribers (Pro), active admins
- Per-user table with: email, role, plan (Free/Pro), status, login count, project count, last activity
- User detail modal with: logins, projects created, guest shares, pro shares, last activity timestamp, network size (unique collaborators)

Goal
Build a new top-level analytics view called “Engagement Overview” (and the supporting backend metrics) that lets me (the founder/admin) instantly understand the health and growth of user engagement at a meta level, while still being able to drill into segments and individual users.

Requirements – State-of-the-art engagement dashboard (2025 standards)

1. High-level Engagement Cohorts (last 28 days by default, with date picker)
   - Daily Active Users (DAU), Weekly (WAU), Monthly (MAU)
   - DAU/MAU ratio (% stickiness)
   - % of users who created or commented on at least 1 project in the period
   - % of projects that received at least 1 new comment in the period

2. Core Action Intensity Metrics (with trend sparks or 7-day change)
   - Comments per active user
   - Comments per active project
   - Pins placed per active project
   - Unique collaborators invited per active project
   - Guest shares vs Pro shares ratio

3. Engagement Funnel (Homeowner journey)
   New Homeowner → Uploaded first PDF (within 7d) → Created first comment → Invited at least 1 person → Project received reply from invitee
   Show conversion % at each step and drop-off

4. Role-based Engagement Heatmap (table)
   Rows = Free Homeowner | Pro Homeowner | Designer/Pro
   Columns = % Active last 7d | Avg projects | Avg comments made | Avg comments received | Avg unique collaborators

5. Power User & At-Risk Segments
   - “Power collaborators” = users with ≥5 unique collaborators in last 30d
   - “Dormant but valuable” = Pro users active >30 days ago but with >3 projects historically
   - “One-and-done” = users who created 1 project and never returned

6. Collaboration Network Health
   - Average network size per project (unique people who commented)
   - % of projects that are “multi-person” (≥3 unique commenters)
   - Top 10 most collaborative projects (table with project owner + #unique commenters

7. Time-series Trends (last 90 days)
   Line charts (multi-axis possible):
   - New projects created
   - New comments + pins
   - New users invited (guest + pro)
   - Active Pro users

8. Drill-down capability
   Every number or segment → opens a user list with the same columns as current admin + the new metrics (comments last 30d, collaborators, etc.)
   Clicking a user → enhanced version of current user detail modal with 90-day activity timeline

Technical notes
- All metrics must be calculable from existing events we already log (project_created, pdf_uploaded, comment_created, pin_created, user_invited, login, share_guest, share_pro, etc.)
- Use the same design language as the current admin (clean cards, purple accent #635BFF, rounded corners, Inter font)
- Mobile-responsive, but primary use is desktop

Deliverables I want from you
1. Full mockup description (or Figma-like text description) of the complete “Engagement Overview” page
2. Exact list of new database queries / analytics tables I need to add (BigQuery/Supabase/Postgres style)
3. Suggested names and exact definitions for the 12–15 most important engagement KPIs
4. Bonus: early-warning “Engagement Score” (0–100) per user and for the whole platform

Please output everything in clean, ready-to-implement format so I can give it directly to my developer.