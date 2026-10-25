# Session library — global entries

The catalogue `generate-plan` picks from, so every planned session can say *why* it is in the plan (`session_library`, organization_id NULL).
Coaches can add their own org-scoped entries, which an org admin approves before they can be used.

**Status:** `validated` = backed by published research; `reference` = HYROX practitioner consensus (there are no controlled trials of HYROX-specific sessions yet).

Paces refer to the plan's computed zones (Daniels E/M/T/I/R) and the athlete's goal HYROX run split. Generated from the same data as `supabase/migrations/20261025020001_session_library_seed.sql`.

## Running (13)

### `RUN_EASY` — Easy aerobic run
*run · easy · intensity **easy** · validated*

- **Objective:** Build aerobic base and running durability at low physiological cost.
- **Execution:** 30–70 min continuous at Easy pace (computed E zone) — conversational, RPE 3–4, HR below the athlete's aerobic threshold. Flat or rolling terrain.
- **Progression:** Add 5–10 min per week within the plan's weekly run-km cap; never progress both duration and pace in the same week.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** Most weekly running volume should be easy so the hard sessions can be truly hard; easy volume drives mitochondrial and capillary adaptations with little fatigue.
- **Evidence:** Seiler 2010, Int J Sports Physiol Perform — intensity distribution in endurance athletes (~80/20); Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

### `RUN_RECOVERY` — Recovery run
*run · easy · intensity **easy** · validated*

- **Objective:** Promote recovery between hard days while keeping running frequency.
- **Execution:** 20–35 min very easy, slower than E pace (RPE 2–3). Stop early if legs feel worse after 10 min.
- **Progression:** Does not progress — keep it short and easy; replace with rest or mobility when TSB is very negative.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Replace with rest when form (TSB) is in the high-risk band.
- **Why:** Very low intensity adds frequency and blood flow without adding meaningful training stress, protecting the next quality session.
- **Evidence:** Seiler 2010, Int J Sports Physiol Perform — intensity distribution in endurance athletes (~80/20); Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

### `RUN_LONG` — Long run
*run · long · intensity **easy** · validated*

- **Objective:** Extend aerobic endurance and musculoskeletal tolerance for the 8 km of race running under fatigue.
- **Execution:** 60–110 min at Easy pace (E zone), RPE 4. Fuel and hydrate as for a race on runs over 75 min.
- **Progression:** Grow by ≤10 % per week and cap at ~25–30 % of weekly run volume; hold or cut back in recovery weeks.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not in the final 7 days before a race.
- **Why:** Time on feet at low intensity improves fatigue resistance and economy late in a session — exactly what HYROX runs 5–8 demand.
- **Evidence:** Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces; Gabbett 2016, Br J Sports Med — training–injury prevention paradox (load progression)

### `RUN_PROGRESSION` — Progression run
*run · long · intensity **moderate** · validated*

- **Objective:** Practice running faster while fatigued and finishing strong.
- **Execution:** 45–75 min: first two-thirds at Easy pace, final third building to Marathon then Threshold pace (M→T zones), finishing at RPE 7.
- **Progression:** Lengthen the faster final segment by 5 min every 1–2 weeks.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Counts as a quality session — not on the day before or after another hard session.
- **Why:** A controlled finish at faster paces trains pacing discipline and fatigue resistance with less stress than a full tempo run.
- **Evidence:** Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

### `RUN_STRIDES` — Easy run + strides
*run · easy · intensity **easy** · validated*

- **Objective:** Keep leg speed and running economy without adding fatigue.
- **Execution:** 30–45 min Easy, then 6–8 × 20 s strides at Repetition-pace feel (fast, relaxed, not sprinting) with 60–90 s walk/jog between.
- **Progression:** Go from 6 to 10 strides; keep each stride ≤20 s.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Skip strides with any calf or Achilles soreness.
- **Why:** Short fast efforts improve neuromuscular coordination and economy with negligible metabolic cost.
- **Evidence:** Barnes & Kilding 2015, Sports Med — strategies to improve running economy; Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

### `RUN_TEMPO` — Tempo run
*run · tempo · intensity **hard** · validated*

- **Objective:** Raise lactate threshold — the pace you can sustain for HYROX's running legs.
- **Execution:** 15 min Easy warm-up, 20–30 min continuous at Threshold pace (T zone, comfortably hard, RPE 7), 10 min Easy cool-down.
- **Progression:** Extend the tempo block by 5 min per week up to 35–40 min, or switch to cruise intervals.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not when form is in the fatigued/high-risk band; not within 48 h of another hard session.
- **Why:** Sustained threshold work is a time-efficient way to lift threshold pace and is directly specific to HYROX's 8 × 1 km.
- **Evidence:** Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces; Seiler 2010, Int J Sports Physiol Perform — intensity distribution in endurance athletes (~80/20)

### `RUN_CRUISE_INTERVALS` — Threshold cruise intervals
*run · tempo · intensity **hard** · validated*

- **Objective:** Accumulate more time at threshold than a continuous tempo allows.
- **Execution:** 15 min Easy warm-up, 3–5 × 8 min at Threshold pace (T zone) with 1–2 min easy jog, 10 min cool-down.
- **Progression:** Add one repetition every 1–2 weeks (max 5 × 8 min), then shorten recoveries to 60 s.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not within 48 h of another hard session.
- **Why:** Short recoveries keep lactate near threshold while splitting the work makes the total volume tolerable.
- **Evidence:** Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

### `RUN_THRESHOLD_5X6` — Threshold 5 × 6 min
*run · tempo · intensity **hard** · validated*

- **Objective:** Threshold development with HYROX-like work durations (each 1 km run takes ~4–6 min).
- **Execution:** 15 min Easy warm-up, 5 × 6 min at Threshold pace (T zone) with 90 s easy jog, 10 min cool-down.
- **Progression:** Move from 5 to 6 repetitions, then cut recoveries to 60 s.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not within 48 h of another hard session.
- **Why:** Matches the duration of a HYROX run segment while keeping the stimulus at threshold.
- **Evidence:** Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces; HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet

### `RUN_VO2_4X4` — VO2max 4 × 4 min
*run · interval · intensity **hard** · validated*

- **Objective:** Raise VO2max — the ceiling that threshold and race pace sit under.
- **Execution:** 15 min Easy warm-up, 4 × 4 min at 90–95 % HRmax (Interval pace, I zone; RPE 8–9) with 3 min active recovery, 10 min cool-down.
- **Progression:** Once 4 × 4 is controlled, increase pace slightly rather than adding reps; use at most once per week.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not in base phase for beginners; not when form is fatigued; never within 48 h of another hard session.
- **Why:** The 4 × 4 protocol is among the best-supported interval formats for improving VO2max in trained adults.
- **Evidence:** Helgerud et al. 2007, Med Sci Sports Exerc — 4×4 min aerobic intervals raise VO2max; Billat 2001, Sports Med — interval training for performance (parts I–II)

### `RUN_VO2_SHORT` — Short VO2 intervals
*run · interval · intensity **hard** · validated*

- **Objective:** Accumulate time near VO2max with shorter, more repeatable efforts.
- **Execution:** 15 min Easy warm-up, 2 sets of 8–10 × 400 m (or 90 s) at Interval pace (I zone) with 60–90 s jog, 3 min between sets, 10 min cool-down.
- **Progression:** Add repetitions to the second set; keep paces consistent across reps rather than chasing speed.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not within 48 h of another hard session.
- **Why:** Short intervals with brief recoveries keep oxygen uptake high while reducing the per-rep strain of longer intervals.
- **Evidence:** Billat 2001, Sports Med — interval training for performance (parts I–II); Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

### `RUN_HILLS` — Hill repeats
*run · interval · intensity **hard** · validated*

- **Objective:** Build running-specific strength and power with lower impact than flat speed work.
- **Execution:** 15 min Easy warm-up, 8–10 × 60–90 s uphill (4–8 % grade) at hard effort (RPE 8), jog back down to recover, 10 min cool-down. Treadmill incline works.
- **Progression:** Add 2 repetitions per week up to 12, or lengthen reps to 2 min.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Avoid with active Achilles or calf issues.
- **Why:** Uphill running loads the posterior chain and improves economy and power with reduced eccentric impact.
- **Evidence:** Barnes & Kilding 2015, Sports Med — strategies to improve running economy

### `RUN_FARTLEK` — Fartlek
*run · fartlek · intensity **moderate** · validated*

- **Objective:** Unstructured speed variation that develops pace changes and aerobic power.
- **Execution:** 40–55 min total: after 15 min Easy, alternate 1–3 min at Threshold-to-Interval feel with equal easy running for 20–25 min, then cool down.
- **Progression:** Extend the fast portions toward 3 min and shorten the floats.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** Varying pace without strict targets builds the ability to surge and recover — useful for the run-after-station transitions.
- **Evidence:** Billat 2001, Sports Med — interval training for performance (parts I–II)

### `RUN_HYROX_1K_REPEATS` — HYROX race-pace 1 km repeats
*run · interval · intensity **race_pace** · reference*

- **Objective:** Rehearse goal HYROX run-split pace until it feels automatic.
- **Execution:** 15 min Easy warm-up, 5–8 × 1 km at goal HYROX run pace (from the athlete's target run split) with 2 min recovery (walk/jog or a light station movement), 10 min cool-down.
- **Progression:** Add repetitions toward 8, then shorten recoveries to 90 s in the peak phase.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not in the final 5 days before a race.
- **Why:** Race-specific pace practice improves pacing accuracy; the 1 km distance matches each HYROX run exactly.
- **Evidence:** HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet; Daniels, Daniels' Running Formula, 3rd ed. — E/M/T/I/R training paces

## Strength (6)

### `STR_LOWER_HEAVY` — Lower-body heavy strength
*strength · lower · intensity **hard** · validated*

- **Objective:** Increase maximal leg strength for sled push/pull, lunges and wall balls.
- **Execution:** Warm-up 10 min. Back or front squat 4 × 4–6 @ RPE 7–8; Romanian deadlift 3 × 6–8; Bulgarian split squat 3 × 8/leg; calf raise 3 × 12. Rest 2–3 min on main lifts.
- **Progression:** Add load when all reps are completed at the target RPE; deload every 4th week.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Keep ≥6 h (ideally a separate day) from hard running sessions.
- **Why:** Heavy strength work improves running economy and force production without meaningful hypertrophy when volume is kept moderate.
- **Evidence:** Rønnestad & Mujika 2014, Scand J Med Sci Sports — strength training improves endurance performance; Wilson et al. 2012, J Strength Cond Res — concurrent training interference meta-analysis

### `STR_UPPER_PUSH_PULL` — Upper-body push/pull
*strength · upper · intensity **moderate** · validated*

- **Objective:** Build pulling and pushing strength for sled pull, SkiErg, rowing and wall balls.
- **Execution:** Pull-up or lat pulldown 4 × 6–8; push press 4 × 5; single-arm row 3 × 10/side; push-up 3 × max-2; face pull 3 × 15.
- **Progression:** Add load or reps weekly in small steps; keep 1–2 reps in reserve.
- **Contraindications:** Modify with shoulder pain (no overhead pressing).
- **Why:** Upper-body strength carries over to the pulling stations, which are often where mid-pack athletes lose the most time.
- **Evidence:** Rønnestad & Mujika 2014, Scand J Med Sci Sports — strength training improves endurance performance; Lauersen et al. 2014, Br J Sports Med — strength training reduces sports injuries

### `STR_FULL_BODY` — Full-body strength
*strength · full_body · intensity **moderate** · validated*

- **Objective:** Time-efficient strength maintenance across all major movement patterns.
- **Execution:** Trap-bar deadlift 3 × 5; goblet squat 3 × 8; dumbbell bench or push-up 3 × 8–10; inverted row 3 × 10; farmer carry 4 × 40 m.
- **Progression:** Progress load on the first two lifts; keep total session ≤60 min.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** With limited sessions per week, full-body work maintains strength in every pattern HYROX uses while minimising interference with running.
- **Evidence:** Rønnestad & Mujika 2014, Scand J Med Sci Sports — strength training improves endurance performance; Wilson et al. 2012, J Strength Cond Res — concurrent training interference meta-analysis

### `STR_POSTERIOR_UNILATERAL` — Posterior chain & single-leg
*strength · posterior · intensity **moderate** · validated*

- **Objective:** Strengthen hamstrings, glutes and single-leg stability — the usual weak links for running injuries.
- **Execution:** Single-leg RDL 3 × 8/leg; hip thrust 4 × 8; Nordic or slider hamstring curl 3 × 6; step-up 3 × 8/leg; side plank 3 × 30 s/side.
- **Progression:** Add load to hip thrust and step-ups; progress Nordic range before adding reps.
- **Contraindications:** Reduce Nordic volume with hamstring soreness; skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** Unilateral and posterior-chain strength work is associated with fewer running-related injuries and carries over to lunges.
- **Evidence:** Lauersen et al. 2014, Br J Sports Med — strength training reduces sports injuries

### `STR_POWER_LOW_VOLUME` — Low-volume power (peak/taper)
*strength · power · intensity **moderate** · validated*

- **Objective:** Keep strength and power through the peak and taper without accumulating fatigue.
- **Execution:** Box jump 4 × 3; trap-bar jump or kettlebell swing 4 × 5; squat 3 × 3 @ RPE 6–7; med-ball throw 3 × 5. Full recovery between sets; under 40 min.
- **Progression:** Does not progress — volume drops through the taper while intensity stays moderate.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. No jumping with knee or Achilles pain.
- **Why:** Maintaining intensity while cutting volume preserves strength during a taper; low-volume power work avoids residual fatigue on race day.
- **Evidence:** Bosquet et al. 2007, Med Sci Sports Exerc — tapering meta-analysis; Rønnestad & Mujika 2014, Scand J Med Sci Sports — strength training improves endurance performance

### `STR_CORE_ANTI_ROTATION` — Core & anti-rotation
*accessories · core · intensity **easy** · validated*

- **Objective:** Trunk stiffness for carries, sandbag lunges and wall balls.
- **Execution:** Pallof press 3 × 10/side; dead bug 3 × 8/side; suitcase carry 4 × 30 m/side; plank variations 3 × 40 s. 20–30 min.
- **Progression:** Add load to carries and Pallof press; lengthen holds.
- **Contraindications:** Stop with lower-back pain beyond mild fatigue.
- **Why:** Anti-rotation and carry work trains the bracing used under load in the farmers carry and sandbag stations.
- **Evidence:** Lauersen et al. 2014, Br J Sports Med — strength training reduces sports injuries

## Mobility & technique (4)

### `MOB_FLOW` — Mobility flow
*mobility · mobility · intensity **easy** · validated*

- **Objective:** Maintain range of motion for hips, ankles and thoracic spine.
- **Execution:** 20–30 min: hip airplanes, 90/90 switches, ankle dorsiflexion rocks, thoracic rotations, couch stretch (2 × 60 s/side), deep squat hold. Slow and controlled.
- **Progression:** Add positions where the athlete is most restricted; increase hold time.
- **Contraindications:** None beyond acute injury.
- **Why:** Regular mobility work maintains the positions needed for squats, lunges and wall balls; dynamic work before training doesn't impair performance.
- **Evidence:** Behm et al. 2016, Appl Physiol Nutr Metab — acute effects of stretching and dynamic warm-up

### `TECH_RUN_DRILLS` — Running drills
*mobility · run_mechanics · intensity **easy** · validated*

- **Objective:** Improve running mechanics and coordination.
- **Execution:** After 10 min easy jog: A-skips, B-skips, high knees, butt kicks, straight-leg bounds (2 × 20 m each), then 4 × 80 m relaxed strides.
- **Progression:** Increase drill speed while keeping form; add single-leg hops if pain-free.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** Drills and strides reinforce efficient mechanics and are a low-fatigue way to work on running economy.
- **Evidence:** Barnes & Kilding 2015, Sports Med — strategies to improve running economy

### `TECH_STATION_SKILLS` — Station technique
*hyrox_station · skill_drill · intensity **easy** · reference*

- **Objective:** Make station movements efficient so they cost less energy on race day.
- **Execution:** Pick 2–3 stations; 3–4 × 1–2 min of submaximal, technique-focused work each (SkiErg stroke timing, sled push body angle, burpee-broad-jump rhythm, wall-ball catch and squat depth). Video if possible.
- **Progression:** Move from technique pace to race pace once the movement is consistent.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** Station time is largely technique-limited for most athletes; practising efficient movement at low fatigue transfers to race pace.
- **Evidence:** HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet

### `PREHAB_LOWER_LEG` — Lower-leg prehab
*prehab · rehab · intensity **easy** · validated*

- **Objective:** Build calf, Achilles and foot capacity to tolerate running volume.
- **Execution:** Straight-knee calf raise 3 × 15; bent-knee calf raise 3 × 15; tibialis raise 3 × 15; single-leg balance 3 × 30 s/side; foot doming 2 × 10. 15–20 min.
- **Progression:** Add load to calf raises; progress to single-leg and slow eccentrics.
- **Contraindications:** With an existing injury, follow the clinician's protocol instead.
- **Why:** Lower-leg strength work is a low-cost way to reduce common running overuse injuries as volume rises.
- **Evidence:** Lauersen et al. 2014, Br J Sports Med — strength training reduces sports injuries; Gabbett 2016, Br J Sports Med — training–injury prevention paradox (load progression)

## HYROX-specific (5)

### `HYX_COMPROMISED_BRICK` — Compromised running brick
*hyrox_station · brick · intensity **hard** · reference*

- **Objective:** Learn to run at target pace straight after a station.
- **Execution:** Warm-up 15 min. 4–6 rounds: 1 station block at race effort (e.g. 500 m SkiErg, 25 m sled push, 20 wall balls) → immediately 1 km at goal HYROX run pace. 2–3 min between rounds.
- **Progression:** Add rounds, then rotate the hardest stations (sleds, lunges) before the runs.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Counts as a hard session; not within 48 h of another.
- **Why:** Running immediately after a station is the defining demand of HYROX; rehearsing the transition improves pacing on legs 2–8.
- **Evidence:** HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet

### `HYX_STATION_ENDURANCE` — Station endurance circuit
*hyrox_station · station_endurance · intensity **moderate** · reference*

- **Objective:** Raise the volume of station work the athlete can sustain without breaking.
- **Execution:** 3–4 rounds at steady effort: 250 m row, 15 wall balls, 20 m sandbag lunge, 40 m farmers carry, 10 burpee broad jumps. 2 min between rounds.
- **Progression:** Add a round or increase loads toward race weights.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h.
- **Why:** Muscular endurance at race loads limits station time for most athletes; steady circuits build it without maximal fatigue.
- **Evidence:** HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet

### `HYX_ERG_INTERVALS` — SkiErg / Row intervals
*hyrox_station · erg · intensity **hard** · reference*

- **Objective:** Build pacing and aerobic power on the two erg stations.
- **Execution:** 10 min easy erg warm-up; 6–8 × 250 m alternating SkiErg and row at goal race pace per 500 m, 1 min rest; then 2 × 1000 m steady.
- **Progression:** Lengthen reps to 500 m; tighten pace consistency between reps.
- **Contraindications:** Modify with shoulder or lower-back pain.
- **Why:** Erg pacing is learnable and low-impact, letting athletes add aerobic work without extra running load.
- **Evidence:** Billat 2001, Sports Med — interval training for performance (parts I–II); HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet

### `HYX_HALF_SIM` — Half simulation
*hyrox_station · simulation · intensity **race_pace** · reference*

- **Objective:** Test pacing and fuelling over half a race.
- **Execution:** Warm-up 15 min. 4 × (1 km at goal run pace + one station at race weight), in race order (either stations 1–4 or 5–8). Record splits.
- **Progression:** Alternate halves across blocks; compare splits with the previous attempt.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not in the final 7 days before a race; not when form is fatigued.
- **Why:** A half simulation provides race-specific feedback at a fraction of the recovery cost of a full simulation.
- **Evidence:** HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet; Gabbett 2016, Br J Sports Med — training–injury prevention paradox (load progression)

### `HYX_FULL_SIM` — Full simulation
*hyrox_station · simulation · intensity **race_pace** · reference*

- **Objective:** Full race rehearsal: pacing, transitions, fuelling and equipment.
- **Execution:** Full course at goal pace: 8 × (1 km + station) in race order, with Roxzone transitions timed. Treat as a race-day dress rehearsal.
- **Progression:** At most once every 3–4 weeks, in the build/peak phases only.
- **Contraindications:** Skip or replace with easy cross-training if the athlete reported pain in the last 72 h. Not in base phase; not in the final 10 days before a race; not when form is fatigued or high-risk.
- **Why:** Occasional full rehearsals expose pacing and fuelling errors, but their fatigue cost means they should be rare and placed well before the taper.
- **Evidence:** HYROX format (8 × 1 km run + 8 stations): practitioner consensus — no controlled trials of HYROX-specific sessions yet; Bosquet et al. 2007, Med Sci Sports Exerc — tapering meta-analysis
