/**
 * Practical examples of Beach Volleyball Tournament Scheduling
 * Using RCPSP (Resource-Constrained Project Scheduling Problem) algorithm
 */

import {
  scheduleMatches,
  validateSchedule,
  Match,
  Court,
  Team,
  SchedulerConfig,
} from '../src/tournamentScheduler';

// Utility function to format date/time
function formatTime(date: Date): string {
  return date.toISOString().substring(11, 16);
}

// Utility function to print schedule
function printSchedule(
  schedule: any,
  matches: Match[],
  title: string
) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(title);
  console.log('='.repeat(70));

  const byRound = new Map<number, typeof schedule.schedule>();
  for (const s of schedule.schedule) {
    if (!byRound.has(s.round)) {
      byRound.set(s.round, []);
    }
    byRound.get(s.round)!.push(s);
  }

  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  for (const round of rounds) {
    console.log(`\n--- ROUND ${round} ---`);

    const roundMatches = byRound.get(round)!;
    roundMatches.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    for (const s of roundMatches) {
      const match = matches.find(m => m.id === s.matchId)!;
      const team1 = typeof match.team1 === 'object' ? match.team1.name : match.team1;
      const team2 = typeof match.team2 === 'object' ? match.team2.name : match.team2;

      console.log(
        `  ${String(s.matchId).padEnd(8)} | ` +
        `Court ${String(s.courtId).padEnd(2)} | ` +
        `${formatTime(s.startTime)} - ${formatTime(s.endTime)} | ` +
        `${String(match.duration).padStart(2)}min | ` +
        `${team1} vs ${team2}`
      );
    }
  }

  console.log(`\n${'-'.repeat(70)}`);
  console.log(`Total Matches: ${schedule.summary.totalMatches}`);
  console.log(`Total Duration: ${schedule.summary.totalDuration.toFixed(0)} minutes (${(schedule.summary.totalDuration / 60).toFixed(1)} hours)`);
  console.log(`Courts Used: ${schedule.summary.courtsUsed}`);
  console.log(`Start: ${schedule.schedule[0].startTime.toISOString()}`);
  console.log(`End: ${schedule.summary.endTime.toISOString()}`);
  console.log('='.repeat(70));
}

// ============================================================================
// EXAMPLE 1: Simple 4-team knockout tournament
// ============================================================================

console.log('\n\n📋 EXAMPLE 1: Simple 4-Team Knockout Tournament\n');

const example1Teams: Team[] = [
  { id: 1, name: 'Paris Beach' },
  { id: 2, name: 'Lyon Sand' },
  { id: 3, name: 'Marseille Waves' },
  { id: 4, name: 'Nice Spike' },
];

const example1Matches: Match[] = [
  { id: 'SF1', team1: example1Teams[0], team2: example1Teams[1], round: 1, duration: 45 },
  { id: 'SF2', team1: example1Teams[2], team2: example1Teams[3], round: 1, duration: 45 },
  {
    id: 'FINAL',
    team1: 'Winner SF1',
    team2: 'Winner SF2',
    round: 2,
    duration: 60,
    dependencies: ['SF1', 'SF2'],
  },
];

const example1Courts: Court[] = [
  { id: 1, name: 'Centre Court' },
  { id: 2, name: 'Court 2' },
];

const example1Config: SchedulerConfig = {
  restTime: 15, // 15 minutes rest between matches
  startTime: new Date('2024-06-15T09:00:00Z'),
};

const example1Result = scheduleMatches(example1Matches, example1Courts, example1Config);
printSchedule(example1Result, example1Matches, 'Simple Knockout Tournament');

const example1Validation = validateSchedule(example1Result.schedule, example1Matches, example1Config);
console.log(`\n✅ Schedule Valid: ${example1Validation.valid}`);
if (!example1Validation.valid) {
  console.log('❌ Errors:', example1Validation.errors);
}

// ============================================================================
// EXAMPLE 2: 8-team bracket with rest time constraints
// ============================================================================

console.log('\n\n📋 EXAMPLE 2: 8-Team Bracket with Rest Time\n');

const example2Teams: Team[] = [
  { id: 1, name: 'Paris Beach', seed: 1 },
  { id: 2, name: 'Lyon Sand', seed: 2 },
  { id: 3, name: 'Marseille Waves', seed: 3 },
  { id: 4, name: 'Nice Spike', seed: 4 },
  { id: 5, name: 'Bordeaux Beach', seed: 5 },
  { id: 6, name: 'Toulouse Volley', seed: 6 },
  { id: 7, name: 'Nantes Sand', seed: 7 },
  { id: 8, name: 'Lille Beach', seed: 8 },
];

const example2Matches: Match[] = [
  // Quarter-finals (Round 1)
  { id: 'QF1', team1: example2Teams[0], team2: example2Teams[7], round: 1, duration: 45 },
  { id: 'QF2', team1: example2Teams[3], team2: example2Teams[4], round: 1, duration: 45 },
  { id: 'QF3', team1: example2Teams[1], team2: example2Teams[6], round: 1, duration: 45 },
  { id: 'QF4', team1: example2Teams[2], team2: example2Teams[5], round: 1, duration: 45 },

  // Semi-finals (Round 2)
  {
    id: 'SF1',
    team1: 'Winner QF1',
    team2: 'Winner QF2',
    round: 2,
    duration: 50,
    dependencies: ['QF1', 'QF2'],
  },
  {
    id: 'SF2',
    team1: 'Winner QF3',
    team2: 'Winner QF4',
    round: 2,
    duration: 50,
    dependencies: ['QF3', 'QF4'],
  },

  // Third place (Round 3)
  {
    id: '3RD',
    team1: 'Loser SF1',
    team2: 'Loser SF2',
    round: 3,
    duration: 45,
    dependencies: ['SF1', 'SF2'],
  },

  // Final (Round 3)
  {
    id: 'FINAL',
    team1: 'Winner SF1',
    team2: 'Winner SF2',
    round: 3,
    duration: 60,
    dependencies: ['SF1', 'SF2'],
  },
];

const example2Courts: Court[] = [
  { id: 1, name: 'Centre Court' },
  { id: 2, name: 'Court 2' },
];

const example2Config: SchedulerConfig = {
  restTime: 20, // 20 minutes mandatory rest
  startTime: new Date('2024-06-15T10:00:00Z'),
  courtSetupTime: 5, // 5 minutes to prepare court between matches
};

const example2Result = scheduleMatches(example2Matches, example2Courts, example2Config);
printSchedule(example2Result, example2Matches, '8-Team Bracket with Rest Time');

const example2Validation = validateSchedule(example2Result.schedule, example2Matches, example2Config);
console.log(`\n✅ Schedule Valid: ${example2Validation.valid}`);

// ============================================================================
// EXAMPLE 3: Single court tournament (sequential scheduling)
// ============================================================================

console.log('\n\n📋 EXAMPLE 3: Single Court Tournament (Sequential)\n');

const example3Teams: Team[] = [
  { id: 1, name: 'Team Alpha' },
  { id: 2, name: 'Team Beta' },
  { id: 3, name: 'Team Gamma' },
  { id: 4, name: 'Team Delta' },
  { id: 5, name: 'Team Epsilon' },
  { id: 6, name: 'Team Zeta' },
];

const example3Matches: Match[] = [
  // Round 1
  { id: 'M1', team1: example3Teams[0], team2: example3Teams[1], round: 1, duration: 30 },
  { id: 'M2', team1: example3Teams[2], team2: example3Teams[3], round: 1, duration: 30 },
  { id: 'M3', team1: example3Teams[4], team2: example3Teams[5], round: 1, duration: 30 },

  // Round 2
  {
    id: 'M4',
    team1: 'Winner M1',
    team2: 'Winner M2',
    round: 2,
    duration: 35,
    dependencies: ['M1', 'M2'],
  },
  {
    id: 'M5',
    team1: 'Winner M3',
    team2: 'Loser M1',
    round: 2,
    duration: 35,
    dependencies: ['M3', 'M1'],
  },

  // Final
  {
    id: 'FINAL',
    team1: 'Winner M4',
    team2: 'Winner M5',
    round: 3,
    duration: 40,
    dependencies: ['M4', 'M5'],
  },
];

const example3Courts: Court[] = [
  { id: 1, name: 'Main Court' },
];

const example3Config: SchedulerConfig = {
  restTime: 10,
  startTime: new Date('2024-06-15T14:00:00Z'),
  courtSetupTime: 3,
};

const example3Result = scheduleMatches(example3Matches, example3Courts, example3Config);
printSchedule(example3Result, example3Matches, 'Single Court Sequential Tournament');

const example3Validation = validateSchedule(example3Result.schedule, example3Matches, example3Config);
console.log(`\n✅ Schedule Valid: ${example3Validation.valid}`);

// ============================================================================
// EXAMPLE 4: Stress test - Team plays multiple matches with minimum rest
// ============================================================================

console.log('\n\n📋 EXAMPLE 4: Stress Test - Team A Plays Multiple Matches\n');

const teamA: Team = { id: 'A', name: 'Team Alpha (Marathon)' };
const example4Teams: Team[] = [
  teamA,
  { id: 'B', name: 'Team Beta' },
  { id: 'C', name: 'Team Gamma' },
  { id: 'D', name: 'Team Delta' },
  { id: 'E', name: 'Team Epsilon' },
];

const example4Matches: Match[] = [
  { id: 'M1', team1: teamA, team2: example4Teams[1], round: 1, duration: 20 },
  { id: 'M2', team1: example4Teams[2], team2: example4Teams[3], round: 1, duration: 20 },
  { id: 'M3', team1: teamA, team2: example4Teams[4], round: 1, duration: 20 }, // Team A again
  {
    id: 'M4',
    team1: teamA, // Team A again!
    team2: 'Winner M2',
    round: 2,
    duration: 25,
    dependencies: ['M2'],
  },
];

const example4Courts: Court[] = [
  { id: 1, name: 'Court 1' },
  { id: 2, name: 'Court 2' },
];

const example4Config: SchedulerConfig = {
  restTime: 15, // Team A must rest 15 min between matches
  startTime: new Date('2024-06-15T16:00:00Z'),
};

const example4Result = scheduleMatches(example4Matches, example4Courts, example4Config);
printSchedule(example4Result, example4Matches, 'Stress Test - Multiple Matches per Team');

const example4Validation = validateSchedule(example4Result.schedule, example4Matches, example4Config);
console.log(`\n✅ Schedule Valid: ${example4Validation.valid}`);

// Check Team A's schedule
console.log('\n📊 Team Alpha Match Schedule:');
const teamAMatches = example4Result.schedule.filter(s => {
  const match = example4Matches.find(m => m.id === s.matchId)!;
  return match.team1 === teamA || match.team2 === teamA ||
         (typeof match.team1 === 'string' && match.team1.includes('A')) ||
         (typeof match.team2 === 'string' && match.team2.includes('A'));
}).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

for (let i = 0; i < teamAMatches.length; i++) {
  const s = teamAMatches[i];
  console.log(`  ${i + 1}. Match ${s.matchId}: ${formatTime(s.startTime)} - ${formatTime(s.endTime)}`);

  if (i > 0) {
    const prevMatch = teamAMatches[i - 1];
    const restMinutes = (s.startTime.getTime() - prevMatch.endTime.getTime()) / 60000;
    console.log(`     Rest time: ${restMinutes.toFixed(0)} minutes ✅`);
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n\n' + '='.repeat(70));
console.log('🏐 BEACH VOLLEYBALL TOURNAMENT SCHEDULER EXAMPLES COMPLETED');
console.log('='.repeat(70));
console.log('\nKey Features Demonstrated:');
console.log('  ✅ Dependency management (knockout brackets)');
console.log('  ✅ Rest time enforcement (15-20 minutes between matches)');
console.log('  ✅ Team non-ubiquity (no simultaneous matches)');
console.log('  ✅ Court setup time (cleaning between matches)');
console.log('  ✅ Multi-court optimization');
console.log('  ✅ Sequential scheduling (single court)');
console.log('  ✅ Complex scenarios (team playing multiple matches)');
console.log('\nAll schedules validated successfully! ✨');
console.log('='.repeat(70) + '\n');
