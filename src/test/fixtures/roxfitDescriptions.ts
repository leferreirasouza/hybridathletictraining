// Real ROXFIT race descriptions as stored in strava_activities.raw.description
// (2026-10-25), with the activity name and elapsed_time they came with.
const block = (division: string, overall: number, ag: number, splits: string, totals: string) =>
  `Completed via ROXFIT\n\n🏆 Division: ${division}\n📊 Overall Rank: ${overall}\n🎯 Age Group Rank: ${ag}\nAverage pace: 05:30/km\nAverage run: 5:14\n\n⏱️ Split Times:\n${splits}\n\n${totals}\n`;

const splits = (r: string[], s: string[], rox: string) =>
  [
    `Run 1: ${r[0]}`, `Ski Erg: ${s[0]}`, `Run 2: ${r[1]}`, `Sled Push: ${s[1]}`,
    `Run 3: ${r[2]}`, `Sled Pull: ${s[2]}`, `Run 4: ${r[3]}`, `Burpee Broad Jump: ${s[3]}`,
    `Run 5: ${r[4]}`, `Row Erg: ${s[4]}`, `Run 6: ${r[5]}`, `Farmers Carry: ${s[5]}`,
    `Run 7: ${r[6]}`, `Sandbag Lunge: ${s[6]}`, `Run 8: ${r[7]}`, `Wall Ball: ${s[7]}`,
    `Roxzone: ${rox}`,
  ].join('\n');

export const ROXFIT_RACES = [
  {
    name: 'HYROX - Sao Paulo - 01:13:43', elapsed: 4423, date: '2026-04-25',
    description: block('Doubles Mixed', 91, 29,
      splits(['5:07', '5:00', '5:58', '5:12', '5:21', '5:06', '5:22', '4:53'], ['4:11', '1:57', '3:16', '2:52', '4:32', '1:43', '3:40', '3:39'], '6:00'),
      '🏃 Total Running: 41:59\n💪 Total Functional: 25:50\n⏸️ Roxzone (transitions): 6:00'),
  },
  {
    name: 'HYROX - Buenos Aires - 01:12:49', elapsed: 4369, date: '2026-06-13',
    description: block('Doubles Mixed', 36, 8,
      splits(['4:53', '5:09', '5:20', '5:19', '5:19', '4:54', '5:29', '4:21'], ['4:12', '2:22', '3:18', '3:24', '4:40', '1:46', '4:02', '3:29'], '4:58'),
      '🏃 Total Running: 40:44\n💪 Total Functional: 27:13\n⏸️ Roxzone (transitions): 4:58'),
  },
  {
    name: 'HYROX - Washington DC - 01:15:03', elapsed: 4503, date: '2026-09-05',
    description: block('Open Men', 249, 50,
      splits(['3:24', '4:11', '4:23', '4:25', '4:21', '4:15', '4:47', '4:02'], ['4:40', '3:10', '4:00', '4:55', '5:03', '1:39', '5:24', '5:47'], '6:42'),
      '🏃 Total Running: 33:48\n💪 Total Functional: 34:38\n⏸️ Roxzone (transitions): 6:42'),
  },
  {
    name: 'HYROX - São Paulo - 01:13:44', elapsed: 4424, date: '2026-10-17',
    description: block('Mixed Doubles', 74, 16,
      splits(['5:19', '4:45', '4:55', '5:08', '5:09', '5:01', '5:25', '5:13'], ['4:10', '2:10', '3:28', '2:57', '4:45', '1:38', '3:50', '3:51'], '6:07'),
      '🏃 Total Running: 40:55\n💪 Total Functional: 26:49\n⏸️ Roxzone (transitions): 6:07'),
  },
  {
    name: 'HYROX - São Paulo - 01:09:02', elapsed: 4142, date: '2026-10-17',
    description: block('Mixed Relay', 9, 4,
      splits(['4:58', '4:05', '4:19', '4:21', '3:51', '3:58', '4:13', '3:38'], ['4:19', '2:14', '5:18', '3:51', '4:29', '2:10', '3:24', '4:27'], '5:34'),
      '🏃 Total Running: 33:23\n💪 Total Functional: 30:12\n⏸️ Roxzone (transitions): 5:34'),
  },
  {
    name: 'HYROX - São Paulo - 01:10:35', elapsed: 4235, date: '2026-10-18',
    description: block('Doubles Men', 59, 14,
      splits(['4:49', '4:21', '4:33', '4:26', '4:32', '6:24', '5:06', '4:50'], ['4:04', '2:34', '3:17', '2:41', '4:15', '1:26', '3:10', '3:51'], '6:23'),
      '🏃 Total Running: 39:01\n💪 Total Functional: 25:18\n⏸️ Roxzone (transitions): 6:23'),
  },
];
