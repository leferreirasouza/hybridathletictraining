## Training Preferences Page

Add a new athlete-facing screen to edit their `training_preferences` row (auto-created on first save).

### Route & navigation
- New route `/training-preferences` mounted inside `AppLayout` (protected, requires org).
- Add a link from the Profile page (and Settings sidebar entry) labeled "Training Preferences" — visible to athletes only.

### Page: `src/pages/TrainingPreferences.tsx`
Loads the current user's row from `training_preferences` (single, by `athlete_id = auth.uid()`). If none exists, initialize with the DB defaults. On save, `upsert` on `athlete_id`.

Sections (using existing shadcn `Card`, `Button`, `Slider`, `Input`, `Checkbox`, `Label`):

1. **Available days** — 7 toggle chips (Mon–Sun) mapping to `available_days: number[]` (1=Mon … 7=Sun). At least 1 day required.
2. **Session length** — `Slider` 20–180 min, step 5, bound to `session_length_min`.
3. **Run type weights** — 5 sliders (easy, tempo, interval, long, fartlek) 0–100%. Show live sum; show inline warning if sum ≠ 100%. "Normalize" button to rescale to sum 1.0. Stored as `run_type_weights` jsonb of fractions.
4. **Strength & mobility** — two number inputs: `strength_sessions_per_week` (0–7), `mobility_technique_sessions_per_week` (0–7).
5. **Muscle focus** — multi-select chips: posterior chain, anterior chain, core, upper body, grip, none. Stored in `muscle_focus: string[]`.
6. **Equipment** — checkbox grid: barbell, dumbbells, kettlebell, sled, ski erg, rower, assault bike, wall ball, sandbag, pull-up bar, box, none. Stored as `equipment` jsonb `{ [key]: true }`.

### Behavior
- Single Save button → toast on success/failure; disabled while saving or while form invalid (no days selected, or weights sum is 0).
- Loading skeleton while fetching.
- Coaches/admins viewing this route see read-only banner + their own prefs (since RLS only allows athletes to write their own).

### Files
- Create `src/pages/TrainingPreferences.tsx`
- Edit `src/App.tsx` — register route
- Edit `src/pages/Profile.tsx` (or relevant nav) — add a link card to Training Preferences

No DB migration required (table already exists with RLS).