# Complete Brazilian Portuguese coverage

## Goal
Make every user-facing screen follow the existing language selector: English in `en`, Brazilian Portuguese in `pt-BR`, with no remaining English-only page, dialog, card, form, empty state, validation message, toast, tooltip, or accessibility label.

## Current scope confirmed
The app already uses `react-i18next` and persists the selected language under `ha-language`, but translation coverage is incomplete. Fully English screens confirmed in the current code include About, Terms, Contact, Analytics, Training Preferences, Equipment Presets, Activity Log, Mileage History, OAuth Consent, callback/error pages, and the plan-creation wizard. Shared features still containing English include Week Builder, workout sharing, admin tools, onboarding health forms, schedule/session dialogs, plan-builder forms, and dashboard cards.

## Implementation

### 1. Build a complete translation inventory
- Audit every routed screen in `src/App.tsx` and every user-facing component it renders.
- Include visible copy, form labels, placeholders, buttons, tabs, statuses, empty/loading/error states, confirmation prompts, toasts, chart labels/tooltips, validation errors, dialog copy, `aria-label`s, and image/share titles.
- Exclude internal identifiers, database values, user-entered content, brand names, universal abbreviations such as CTL/ATL/TSB and RPE, and measurement units such as km.

### 2. Extend both locale dictionaries symmetrically
- Add matching semantic keys to `en.json` and `pt-BR.json`, grouped by feature rather than by individual file.
- Translate naturally for Brazilian athletes and coaches, preserving the current HYROX/training terminology.
- Add reusable keys for weekdays, disciplines, intensities, statuses, common actions, validation, and generic errors to avoid duplicated translations.
- Preserve interpolation and plurals for counts, weeks, sessions, distances, and progress messages.

### 3. Convert every English-only screen and shared flow
- Public/auth/legal: About, Terms, Contact, password reset, not-found, OAuth consent, Strava/Garmin callbacks.
- Athlete experience: Analytics, mileage, training preferences, equipment presets, schedule/session details, dashboard cards, history/share flow, and profile-related states.
- Plan creation and coaching: the complete plan wizard and all steps, Week Builder, manual plan forms, plan history, coach safety panels, assignment dialogs, and race comparison content.
- Administration: users, activity log, knowledge library, scheduled jobs, athlete sync, and all admin confirmations/statuses.
- Navigation and layout: any remaining labels, tooltips, role names, and mobile/desktop navigation text.

### 4. Localize formatting as well as words
- Use the active locale for displayed dates, weekdays, and timestamps instead of fixed English formatting.
- Keep stored values and backend payloads unchanged; translate only their displayed labels.
- Keep English as the fallback language if a key is unavailable.

### 5. Verification
- Add an automated locale-parity test that fails when an English key is absent from Portuguese or vice versa.
- Add a targeted scan/test for user-facing hardcoded English in routed screens and feature components, with explicit allowances for brands, units, and technical abbreviations.
- Run the translation/parity tests and existing relevant tests.
- Open the app in both `pt-BR` and English, checking public pages and signed-in athlete, coach, and admin navigation at desktop and mobile widths; confirm dialogs, toasts, charts, and long Portuguese labels fit without overlap.

## Boundaries
- No business rules, permissions, database schema, training calculations, or stored user data will change.
- This translates the existing product only; it does not add new features or rewrite legal meaning.
