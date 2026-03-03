# HYROX Coach OS — MVP QA Checklist

## Authentication
- [ ] Sign up with email + password → confirmation email sent
- [ ] Log in with valid credentials → redirected to dashboard
- [ ] Log in with invalid credentials → error message shown
- [ ] Forgot password → reset email sent → /reset-password works
- [ ] Sign out → redirected to /auth
- [ ] Protected routes redirect to /auth when not logged in

## Onboarding
- [ ] New user without org → redirected to /onboarding
- [ ] Can create organization + auto-assigned role
- [ ] Can join existing organization
- [ ] After onboarding → redirected to /dashboard

## Athlete Dashboard
- [ ] Shows greeting with user name
- [ ] Race countdown appears when future race exists
- [ ] Plan completion progress bar shows correct %
- [ ] Training objectives listed from targets
- [ ] Today's sessions shown (or rest day message)
- [ ] Quick stats (week volume, sessions, avg RPE) correct
- [ ] Week overview dots show completed days
- [ ] Weekly Report CTA navigates to /reports
- [ ] AI Coach CTA navigates to /ai

## Coach Dashboard
- [ ] Shows assigned athletes list
- [ ] Can navigate to athlete details
- [ ] Weekly Report link works

## Training Schedule
- [ ] Daily view shows today's sessions
- [ ] Weekly view shows full week with summary header
- [ ] Monthly calendar view renders
- [ ] Sessions show discipline icon, name, intensity
- [ ] Swap session dialog opens and submits
- [ ] Targets panel shows HR zones, pace targets

## Plan Builder (Coach)
- [ ] Can create plan manually (name, weeks, sessions)
- [ ] Import from CSV/XLSX works
- [ ] Generates correct sessions across weeks

## Plan Builder (Athlete)
- [ ] Race type selector (HYROX vs Running) works
- [ ] HYROX: age-group defaults shown for first-timers
- [ ] HYROX: race analysis shown when prior races exist
- [ ] HYROX: per-station targets can be set
- [ ] HYROX: weak stations auto-detected from race data
- [ ] Running: distance + target time inputs work
- [ ] Get Prediction button returns AI assessment
- [ ] Generate Plan creates plan and redirects to /schedule

## Session Logging
- [ ] Can log standalone session (no plan link)
- [ ] Can link to planned session (auto-fills fields)
- [ ] RPE slider works (1-10)
- [ ] Pain flag toggle shows pain notes textarea
- [ ] Submit saves to database
- [ ] Audit log entry created on submit

## Race Results
- [ ] Can add race manually with all splits
- [ ] Can upload screenshot for AI parsing
- [ ] Race comparison chart renders (Splits, Radar, Trend)
- [ ] Can delete race result

## Analytics
- [ ] Summary cards show correct totals
- [ ] Weekly volume chart renders (duration + distance toggle)
- [ ] RPE trend chart renders
- [ ] Discipline breakdown stacked bar chart renders
- [ ] HR zone distribution pie chart renders
- [ ] HR zone trend over weeks renders
- [ ] Empty state shown when no data

## Weekly Reports
- [ ] Athlete sees completion rate, volume, intensity, AI commentary
- [ ] Coach sees per-athlete breakdown
- [ ] Compliance alerts highlight low-completion or pain-flagged athletes

## Messaging
- [ ] Can send message to coach/athlete
- [ ] Messages appear in real-time
- [ ] Unread badge shows on nav
- [ ] Mark as read on open

## AI Chat
- [ ] Can send message
- [ ] Streaming response renders token-by-token
- [ ] Thread history persists

## Activity Log
- [ ] Athletes see their session completion feed
- [ ] Coaches/admins see full audit trail
- [ ] Timeline renders with correct icons and timestamps

## Profile
- [ ] Name displayed correctly
- [ ] Can edit name inline
- [ ] Role badge shown
- [ ] Quick actions navigate correctly
- [ ] Activity Log link works
- [ ] Sign out works

## Settings
- [ ] App settings accessible
- [ ] Theme/notification preferences work

## Dark Mode
- [ ] All pages render correctly in dark mode
- [ ] No hardcoded white/black colors visible

## Mobile / PWA
- [ ] Bottom nav renders 5 tabs
- [ ] Active tab indicator animates
- [ ] Safe area padding works on notched devices
- [ ] PWA installable from browser
