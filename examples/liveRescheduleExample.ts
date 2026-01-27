/**
 * Live Reschedule Example - Real-time Tournament Management
 *
 * This example demonstrates how to handle live rescheduling during an ongoing tournament
 * when matches finish earlier/later than planned, or when there are unexpected delays.
 */

import {
  scheduleMatches,
  rescheduleMatches,
  Match,
  Court,
  Team,
  SchedulerConfig,
  CompletedScheduledMatch,
} from '../src';

console.log('='.repeat(80));
console.log('🏐 LIVE RESCHEDULE EXAMPLE - Real-time Tournament Management');
console.log('='.repeat(80));

// ============================================================================
// SETUP: INITIAL TOURNAMENT SCHEDULE
// ============================================================================

console.log('\n📋 PHASE 1: Initial Tournament Planning\n');

const teams: Team[] = [
  { id: 1, name: 'Paris Beach' },
  { id: 2, name: 'Lyon Sand' },
  { id: 3, name: 'Marseille Waves' },
  { id: 4, name: 'Nice Spike' },
  { id: 5, name: 'Bordeaux Titans' },
  { id: 6, name: 'Toulouse Force' },
  { id: 7, name: 'Nantes Blasters' },
  { id: 8, name: 'Lille United' },
];

const matches: Match[] = [
  // Quarter-finals (Round 1)
  { id: 'QF1', team1: teams[0], team2: teams[7], round: 1, duration: 45 },
  { id: 'QF2', team1: teams[1], team2: teams[6], round: 1, duration: 45 },
  { id: 'QF3', team1: teams[2], team2: teams[5], round: 1, duration: 45 },
  { id: 'QF4', team1: teams[3], team2: teams[4], round: 1, duration: 45 },

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

  // Finals (Round 3)
  {
    id: '3RD',
    team1: 'Loser SF1',
    team2: 'Loser SF2',
    round: 3,
    duration: 45,
    dependencies: ['SF1', 'SF2'],
  },
  {
    id: 'FINAL',
    team1: 'Winner SF1',
    team2: 'Winner SF2',
    round: 3,
    duration: 60,
    dependencies: ['SF1', 'SF2'],
  },
];

const courts: Court[] = [
  { id: 1, name: 'Centre Court' },
  { id: 2, name: 'Court 2' },
];

const config: SchedulerConfig = {
  restTime: 20,        // 20 minutes mandatory rest
  courtSetupTime: 5,   // 5 minutes to prepare court
  startTime: new Date('2024-06-15T09:00:00Z'),
};

// Create initial schedule
console.log('Creating initial schedule...\n');
const initialSchedule = scheduleMatches(matches, courts, config);

console.log('📊 Initial Schedule:');
console.log('─'.repeat(80));

initialSchedule.schedule.forEach(s => {
  const match = matches.find(m => m.id === s.matchId)!;
  const team1 = typeof match.team1 === 'object' ? match.team1.name : match.team1;
  const team2 = typeof match.team2 === 'object' ? match.team2.name : match.team2;

  console.log(
    `[R${s.round}] ${String(s.matchId).padEnd(6)} | ` +
    `Court ${s.courtId} | ` +
    `${formatTime(s.startTime)} - ${formatTime(s.endTime)} | ` +
    `${team1.substring(0, 15).padEnd(15)} vs ${team2.substring(0, 15).padEnd(15)}`
  );
});

console.log(`\nTotal Duration: ${initialSchedule.summary.totalDuration.toFixed(0)} minutes`);
console.log(`Estimated End: ${formatTime(initialSchedule.summary.endTime)}`);

// ============================================================================
// SCENARIO 1: QF1 and QF2 Finish with Delays
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('🎯 SCENARIO 1: QF1 Finishes Late, QF2 Finishes Early');
console.log('='.repeat(80));

console.log('\n📍 Current Time: 2024-06-15 09:55:00 UTC');
console.log('\n✅ Completed Matches:');
console.log('  - QF1: Finished 3 minutes LATE (48 min instead of 45)');
console.log('  - QF2: Finished 5 minutes EARLY (40 min instead of 45)');

const scenario1Completed: CompletedScheduledMatch[] = [
  {
    matchId: 'QF1',
    courtId: 1,
    actualStartTime: new Date('2024-06-15T09:00:00Z'),
    actualEndTime: new Date('2024-06-15T09:48:00Z'),   // +3 min delay
    team1Id: teams[0].id,
    team2Id: teams[7].id,
  },
  {
    matchId: 'QF2',
    courtId: 2,
    actualStartTime: new Date('2024-06-15T09:00:00Z'),
    actualEndTime: new Date('2024-06-15T09:40:00Z'),   // -5 min early
    team1Id: teams[1].id,
    team2Id: teams[6].id,
  },
];

const scenario1Result = rescheduleMatches(matches, courts, {
  ...config,
  currentTime: new Date('2024-06-15T09:55:00Z'),
  completedMatches: scenario1Completed,
});

console.log('\n📊 Rescheduled Plan (Pending Matches Only):');
console.log('─'.repeat(80));

scenario1Result.schedule.forEach(s => {
  const match = matches.find(m => m.id === s.matchId)!;
  const team1 = typeof match.team1 === 'object' ? match.team1.name : match.team1;
  const team2 = typeof match.team2 === 'object' ? match.team2.name : match.team2;

  const original = initialSchedule.schedule.find(x => x.matchId === s.matchId);
  const shift = original ? (s.startTime.getTime() - original.startTime.getTime()) / 60000 : 0;
  const shiftText = shift > 0 ? ` (+${shift.toFixed(0)}min)` : shift < 0 ? ` (${shift.toFixed(0)}min)` : '';

  console.log(
    `[R${s.round}] ${String(s.matchId).padEnd(6)} | ` +
    `Court ${s.courtId} | ` +
    `${formatTime(s.startTime)} - ${formatTime(s.endTime)}${shiftText.padEnd(10)} | ` +
    `${team1.substring(0, 15).padEnd(15)} vs ${team2.substring(0, 15).padEnd(15)}`
  );
});

console.log(`\nNew Estimated End: ${formatTime(scenario1Result.summary.endTime)}`);

// ============================================================================
// SCENARIO 2: All Quarter-Finals Complete, Rescheduling Semi-Finals
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('🎯 SCENARIO 2: All Quarter-Finals Complete');
console.log('='.repeat(80));

console.log('\n📍 Current Time: 2024-06-15 10:45:00 UTC');
console.log('\n✅ All Quarter-Finals Completed:');

const scenario2Completed: CompletedScheduledMatch[] = [
  {
    matchId: 'QF1',
    courtId: 1,
    actualStartTime: new Date('2024-06-15T09:00:00Z'),
    actualEndTime: new Date('2024-06-15T09:48:00Z'),
    team1Id: teams[0].id,  // Paris wins
    team2Id: teams[7].id,
  },
  {
    matchId: 'QF2',
    courtId: 2,
    actualStartTime: new Date('2024-06-15T09:00:00Z'),
    actualEndTime: new Date('2024-06-15T09:40:00Z'),
    team1Id: teams[1].id,  // Lyon wins
    team2Id: teams[6].id,
  },
  {
    matchId: 'QF3',
    courtId: 1,
    actualStartTime: new Date('2024-06-15T09:53:00Z'),
    actualEndTime: new Date('2024-06-15T10:35:00Z'), // -3 min early
    team1Id: teams[2].id,  // Marseille wins
    team2Id: teams[5].id,
  },
  {
    matchId: 'QF4',
    courtId: 2,
    actualStartTime: new Date('2024-06-15T09:45:00Z'),
    actualEndTime: new Date('2024-06-15T10:32:00Z'), // +2 min late
    team1Id: teams[3].id,  // Nice wins
    team2Id: teams[4].id,
  },
];

scenario2Completed.forEach(m => {
  const match = matches.find(x => x.id === m.matchId)!;
  const winner = teams.find(t => t.id === m.team1Id)!;
  console.log(
    `  - ${String(m.matchId).padEnd(4)}: ` +
    `${formatTime(m.actualStartTime)} - ${formatTime(m.actualEndTime)} | ` +
    `Winner: ${winner.name}`
  );
});

const scenario2Result = rescheduleMatches(matches, courts, {
  ...config,
  currentTime: new Date('2024-06-15T10:45:00Z'),
  completedMatches: scenario2Completed,
});

console.log('\n📊 Remaining Matches:');
console.log('─'.repeat(80));

scenario2Result.schedule.forEach(s => {
  const match = matches.find(m => m.id === s.matchId)!;

  console.log(
    `[R${s.round}] ${String(s.matchId).padEnd(6)} | ` +
    `Court ${s.courtId} | ` +
    `${formatTime(s.startTime)} - ${formatTime(s.endTime)} | ` +
    `${String(match.team1).padEnd(20)} vs ${String(match.team2).padEnd(20)}`
  );
});

// ============================================================================
// SCENARIO 3: One Semi-Final Complete, Major Delay on the Other
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('🎯 SCENARIO 3: SF1 Complete, SF2 Delayed by 15 Minutes');
console.log('='.repeat(80));

console.log('\n📍 Current Time: 2024-06-15 11:40:00 UTC');
console.log('\n✅ SF1 completed normally');
console.log('⏰ SF2 had a 15-minute delay (injury timeout)');

const scenario3Completed: CompletedScheduledMatch[] = [
  ...scenario2Completed,
  {
    matchId: 'SF1',
    courtId: 1,
    actualStartTime: new Date('2024-06-15T10:55:00Z'),
    actualEndTime: new Date('2024-06-15T11:45:00Z'),  // Normal 50 min
    team1Id: teams[0].id,  // Paris (from QF1)
    team2Id: teams[1].id,  // Lyon (from QF2)
  },
  {
    matchId: 'SF2',
    courtId: 2,
    actualStartTime: new Date('2024-06-15T10:55:00Z'),
    actualEndTime: new Date('2024-06-15T12:00:00Z'),  // 65 min (15 min delay!)
    team1Id: teams[2].id,  // Marseille (from QF3)
    team2Id: teams[3].id,  // Nice (from QF4)
  },
];

console.log('\n  - SF1: Paris vs Lyon → Finished at 11:45 (normal)');
console.log('  - SF2: Marseille vs Nice → Finished at 12:00 (15 min delay)');

const scenario3Result = rescheduleMatches(matches, courts, {
  ...config,
  currentTime: new Date('2024-06-15T12:05:00Z'),
  completedMatches: scenario3Completed,
});

console.log('\n📊 Finals Schedule (Adjusted for Delay):');
console.log('─'.repeat(80));

scenario3Result.schedule.forEach(s => {
  const match = matches.find(m => m.id === s.matchId)!;
  const original = initialSchedule.schedule.find(x => x.matchId === s.matchId);
  const shift = original ? (s.startTime.getTime() - original.startTime.getTime()) / 60000 : 0;

  console.log(
    `${String(s.matchId).padEnd(8)} | ` +
    `Court ${s.courtId} | ` +
    `${formatTime(s.startTime)} - ${formatTime(s.endTime)} | ` +
    `Delay: +${shift.toFixed(0)} minutes from original plan`
  );
});

console.log(`\n⏱️  Original End Time: ${formatTime(initialSchedule.summary.endTime)}`);
console.log(`⏱️  Updated End Time:  ${formatTime(scenario3Result.summary.endTime)}`);
console.log(
  `⏱️  Total Delay:      +${
    ((scenario3Result.summary.endTime.getTime() - initialSchedule.summary.endTime.getTime()) / 60000).toFixed(0)
  } minutes`
);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('📊 LIVE RESCHEDULE SUMMARY');
console.log('='.repeat(80));

console.log('\n✅ Key Features Demonstrated:');
console.log('  1. Timeline Painting: Completed matches mark resources as occupied');
console.log('  2. Dynamic Rescheduling: Pending matches adjust to actual times');
console.log('  3. No Past Scheduling: All matches start at or after current time');
console.log('  4. Rest Time Enforcement: Teams get mandatory rest after matches');
console.log('  5. Court Setup Time: Courts need preparation between matches');
console.log('  6. Dependency Respect: Finals wait for semis, even with delays');

console.log('\n🎯 Use Cases:');
console.log('  • Live tournaments with real-time updates');
console.log('  • Handling unexpected delays (injuries, weather, etc.)');
console.log('  • Optimizing remaining schedule based on actual progress');
console.log('  • Providing accurate ETAs to teams and spectators');

console.log('\n💡 Best Practices:');
console.log('  • Update schedule after each match completion');
console.log('  • Track actual start/end times (not just planned)');
console.log('  • Use current_time to prevent past scheduling');
console.log('  • Communicate schedule changes to affected teams');

console.log('\n' + '='.repeat(80));
console.log('Live reschedule example complete! 🏐');
console.log('='.repeat(80) + '\n');

// Helper function
function formatTime(date: Date): string {
  return date.toISOString().substring(11, 16);
}
