/**
 * Complete Tournament Flow Example
 *
 * Demonstrates the full tournament lifecycle:
 * 1. Pool Distribution (Snake Seeding)
 * 2. Match Scheduling
 * 3. Pool Rankings
 * 4. Stage Transition (Crossover/Tickets)
 */

import {
  // Pool Distribution
  distributeTeamsToPools,
  Team,

  // Ranking
  calculatePoolRankings,
  CompletedMatch,
  formatRankings,

  // Crossover
  generateNextStageMatches,
  formatTransitionResult,
  PoolRankings,
} from '../src';

console.log('='.repeat(80));
console.log('🏐 COMPLETE BEACH VOLLEYBALL TOURNAMENT EXAMPLE');
console.log('='.repeat(80));

// ============================================================================
// PHASE 1: TEAM REGISTRATION & POOL DISTRIBUTION
// ============================================================================

console.log('\n📋 PHASE 1: Team Registration & Pool Distribution\n');

const teams: Team[] = [
  { id: 1, name: 'Paris Beach Stars', seed: 1, club: 'Paris VB' },
  { id: 2, name: 'Lyon Sand Warriors', seed: 2, club: 'Lyon VB' },
  { id: 3, name: 'Marseille Wave Riders', seed: 3, club: 'Marseille VB' },
  { id: 4, name: 'Nice Spike Force', seed: 4, club: 'Nice VB' },
  { id: 5, name: 'Bordeaux Beach Titans', seed: 5, club: 'Bordeaux VB' },
  { id: 6, name: 'Toulouse Volleyball Club', seed: 6, club: 'Toulouse VB' },
  { id: 7, name: 'Nantes Sand Blasters', seed: 7, club: 'Nantes VB' },
  { id: 8, name: 'Lille Beach United', seed: 8, club: 'Lille VB' },
  { id: 9, name: 'Strasbourg Sand Kings', seed: 9, club: 'Strasbourg VB' },
  { id: 10, name: 'Rennes Volleyball Elite', seed: 10, club: 'Rennes VB' },
  { id: 11, name: 'Montpellier Beach Pro', seed: 11, club: 'Montpellier VB' },
  { id: 12, name: 'Reims Sand Masters', seed: 12, club: 'Reims VB' },
];

console.log(`Total Teams: ${teams.length}`);
console.log('Distribution: 4 pools using FFVB Snake Seeding\n');

const poolDistribution = distributeTeamsToPools(teams, 4);

poolDistribution.pools.forEach(pool => {
  console.log(`\nPool ${pool.poolId} (${pool.size} teams) - ${pool.template}`);
  console.log('-'.repeat(60));
  pool.teams.forEach(team => {
    console.log(`  Seed #${team.seed.toString().padStart(2)} - ${team.name}`);
  });
});

// ============================================================================
// PHASE 2: POOL PHASE - SIMULATE MATCHES & CALCULATE RANKINGS
// ============================================================================

console.log('\n\n📊 PHASE 2: Pool Phase - Matches & Rankings\n');

// Helper function to simulate a match result
function simulateMatch(
  id: string,
  team1Id: number,
  team2Id: number,
  sets1: number,
  sets2: number
): CompletedMatch {
  const basePoints = 25;
  const variability = Math.floor(Math.random() * 5);

  return {
    id,
    team1Id,
    team2Id,
    team1Sets: sets1,
    team2Sets: sets2,
    team1Points: sets1 * basePoints + sets2 * (basePoints - 2) + variability,
    team2Points: sets2 * basePoints + sets1 * (basePoints - 2) + variability,
    winnerId: sets1 > sets2 ? team1Id : team2Id,
  };
}

// Simulate pool matches (simplified for demo)
// In reality, these would be actual match results

const poolAMatches: CompletedMatch[] = [
  simulateMatch('A-M1', 1, 8, 2, 0),  // Seed 1 beats 8
  simulateMatch('A-M2', 9, 12, 2, 1), // Seed 9 beats 12
  simulateMatch('A-M3', 1, 9, 2, 0),  // Seed 1 beats 9
  simulateMatch('A-M4', 8, 12, 2, 1), // Seed 8 beats 12
  simulateMatch('A-M5', 1, 12, 2, 0), // Seed 1 beats 12
  simulateMatch('A-M6', 8, 9, 1, 2),  // Seed 9 beats 8
];

const poolBMatches: CompletedMatch[] = [
  simulateMatch('B-M1', 2, 7, 2, 0),
  simulateMatch('B-M2', 10, 11, 2, 1),
  simulateMatch('B-M3', 2, 10, 2, 1),
  simulateMatch('B-M4', 7, 11, 2, 0),
  simulateMatch('B-M5', 2, 11, 2, 0),
  simulateMatch('B-M6', 7, 10, 2, 1),
];

const poolCMatches: CompletedMatch[] = [
  simulateMatch('C-M1', 3, 6, 2, 1),
  simulateMatch('C-M2', 11, 12, 2, 0), // Note: Using 11, 12 as placeholders
  simulateMatch('C-M3', 3, 11, 2, 0),
  simulateMatch('C-M4', 6, 12, 2, 1),
  simulateMatch('C-M5', 3, 12, 2, 0),
  simulateMatch('C-M6', 6, 11, 1, 2),
];

const poolDMatches: CompletedMatch[] = [
  simulateMatch('D-M1', 4, 5, 2, 1),
  simulateMatch('D-M2', 12, 10, 1, 2), // Placeholders
  simulateMatch('D-M3', 4, 12, 2, 0),
  simulateMatch('D-M4', 5, 10, 2, 1),
  simulateMatch('D-M5', 4, 10, 2, 1),
  simulateMatch('D-M6', 5, 12, 2, 0),
];

// Calculate rankings for each pool
const poolARankings = calculatePoolRankings(poolAMatches, 'standard');
const poolBRankings = calculatePoolRankings(poolBMatches, 'standard');
const poolCRankings = calculatePoolRankings(poolCMatches, 'standard');
const poolDRankings = calculatePoolRankings(poolDMatches, 'standard');

console.log('Pool A Final Standings:');
console.log(formatRankings(poolARankings));

console.log('\nPool B Final Standings:');
console.log(formatRankings(poolBRankings));

console.log('\nPool C Final Standings:');
console.log(formatRankings(poolCRankings));

console.log('\nPool D Final Standings:');
console.log(formatRankings(poolDRankings));

// ============================================================================
// PHASE 3: STAGE TRANSITION - GENERATE PLAYOFF MATCHES
// ============================================================================

console.log('\n\n🎯 PHASE 3: Stage Transition - Playoff Generation\n');

const poolRankings: PoolRankings[] = [
  { poolId: 'A', rankings: poolARankings },
  { poolId: 'B', rankings: poolBRankings },
  { poolId: 'C', rankings: poolCRankings },
  { poolId: 'D', rankings: poolDRankings },
];

// ============================================================================
// SCENARIO 1: Crossover Mode (Standard FFVB Playoffs)
// ============================================================================

console.log('--- SCENARIO 1: Crossover Mode (Serpentin Pattern) ---\n');

const crossoverResult = generateNextStageMatches(poolRankings, {
  mode: 'crossover',
  qualifiersPerPool: 1,
  pattern: 'serpentin',
});

console.log(formatTransitionResult(crossoverResult));

console.log('\n📋 Playoff Bracket:');
crossoverResult.playoffMatches.forEach((match, idx) => {
  const team1 = teams.find(t => t.id === match.team1.teamId);
  const team2 = teams.find(t => t.id === match.team2.teamId);

  console.log(
    `  Match ${idx + 1}: ${team1?.name || `2nd ${match.team1.poolId}`} ` +
    `vs ${team2?.name || `3rd ${match.team2.poolId}`}`
  );
});

// ============================================================================
// SCENARIO 2: Ticket Mode (Quota System)
// ============================================================================

console.log('\n\n--- SCENARIO 2: Ticket Mode (6 Teams Advance) ---\n');

const ticketResult = generateNextStageMatches(poolRankings, {
  mode: 'tickets',
  totalTickets: 6,
});

console.log(formatTransitionResult(ticketResult));

console.log('\n✅ Qualified Teams:');
ticketResult.qualified.forEach((q, idx) => {
  const team = teams.find(t => t.id === q.teamId);
  console.log(
    `  ${idx + 1}. ${team?.name || `Team ${q.teamId}`} ` +
    `(${q.rank}${getOrdinalSuffix(q.rank)} ${q.poolId}) ` +
    `[${q.method}]`
  );
});

// ============================================================================
// SCENARIO 3: Direct Mode (Top 2 Per Pool)
// ============================================================================

console.log('\n\n--- SCENARIO 3: Direct Qualification (Top 2 Per Pool) ---\n');

const directResult = generateNextStageMatches(poolRankings, {
  mode: 'direct',
  teamsPerPool: 2,
});

console.log(formatTransitionResult(directResult));

console.log('\n✅ Qualified Teams by Pool:');
['A', 'B', 'C', 'D'].forEach(poolId => {
  const poolQualified = directResult.qualified.filter(q => q.poolId === poolId);
  console.log(`\n  Pool ${poolId}:`);
  poolQualified.forEach(q => {
    const team = teams.find(t => t.id === q.teamId);
    console.log(`    ${q.rank}. ${team?.name || `Team ${q.teamId}`}`);
  });
});

// ============================================================================
// SUMMARY & NEXT STEPS
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('📊 TOURNAMENT SUMMARY');
console.log('='.repeat(80));

console.log('\n✅ Completed Phases:');
console.log('  1. Team Registration & Pool Distribution (12 teams → 4 pools)');
console.log('  2. Pool Phase Matches & Rankings (FFVB Standard)');
console.log('  3. Stage Transition Analysis (3 scenarios)');

console.log('\n🎯 Available Transition Modes:');
console.log('  • Crossover: First-place direct + 2nd vs 3rd playoffs (serpentin)');
console.log('  • Tickets: Quota system with best seconds');
console.log('  • Direct: Top N from each pool advance');

console.log('\n📈 Key Features Demonstrated:');
console.log('  ✓ FFVB Snake Seeding for pool distribution');
console.log('  ✓ FFVB Ranking hierarchy (wins > set ratio > point ratio > h2h)');
console.log('  ✓ Flexible stage transitions with multiple strategies');
console.log('  ✓ Automatic playoff generation with serpentin pattern');
console.log('  ✓ Best-second ranking across pools');

console.log('\n🚀 Next Steps:');
console.log('  → Schedule playoff matches using RCPSP scheduler');
console.log('  → Generate bracket visualization');
console.log('  → Export results to tournament management system');

console.log('\n' + '='.repeat(80));
console.log('Tournament management complete! 🏐');
console.log('='.repeat(80) + '\n');

// Helper function
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
