/**
 * Test suite for Ranking Engine
 */

import {
  calculatePoolRankings,
  CompletedMatch,
  getTeamRank,
  getTeamStats,
  formatRankings,
} from './rankingEngine';

describe('Ranking Engine - Standard Mode', () => {
  test('should rank by number of wins', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
      },
      {
        id: 'M2',
        team1Id: 'A',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 60,
        team2Points: 55,
        winnerId: 'A',
      },
      {
        id: 'M3',
        team1Id: 'B',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'B',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    expect(result.method).toBe('standard');
    expect(result.rankings).toHaveLength(3);

    // Team A: 2 wins
    expect(getTeamRank('A', result)).toBe(1);
    expect(getTeamStats('A', result)?.wins).toBe(2);

    // Team B: 1 win
    expect(getTeamRank('B', result)).toBe(2);
    expect(getTeamStats('B', result)?.wins).toBe(1);

    // Team C: 0 wins
    expect(getTeamRank('C', result)).toBe(3);
    expect(getTeamStats('C', result)?.wins).toBe(0);
  });

  test('should use set ratio as tiebreaker', () => {
    const matches: CompletedMatch[] = [
      // Team A: 1 win, 2-0 sets
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
      },
      // Team B: 1 win, 2-1 sets
      {
        id: 'M2',
        team1Id: 'B',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 60,
        team2Points: 55,
        winnerId: 'B',
      },
      // A vs B (doesn't matter for this test)
      {
        id: 'M3',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 0,
        team2Sets: 2,
        team1Points: 40,
        team2Points: 50,
        winnerId: 'B',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    // Both A and B have 1 win, but A has better set ratio
    const rankA = getTeamRank('A', result);
    const rankB = getTeamRank('B', result);

    const statsA = getTeamStats('A', result);
    const statsB = getTeamStats('B', result);

    expect(statsA?.wins).toBe(statsB?.wins); // Same wins
    expect(statsA?.setRatio).toBeGreaterThan(statsB?.setRatio || 0);
  });

  test('should handle division by zero in set ratio', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    const statsA = getTeamStats('A', result);
    const statsB = getTeamStats('B', result);

    // Team A: 2 sets won, 0 lost = Infinity
    expect(statsA?.setRatio).toBe(Infinity);

    // Team B: 0 sets won, 2 lost = 0
    expect(statsB?.setRatio).toBe(0);

    expect(getTeamRank('A', result)).toBe(1);
    expect(getTeamRank('B', result)).toBe(2);
  });

  test('should use point ratio as third tiebreaker', () => {
    const matches: CompletedMatch[] = [
      // A and B both have 1 win, same set ratio
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 65,
        team2Points: 55,
        winnerId: 'A',
      },
      {
        id: 'M2',
        team1Id: 'B',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 60,
        team2Points: 55,
        winnerId: 'B',
      },
      {
        id: 'M3',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 1,
        team2Sets: 2,
        team1Points: 55,
        team2Points: 60,
        winnerId: 'B',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    const statsA = getTeamStats('A', result);
    const statsB = getTeamStats('B', result);

    // Both have 1 win
    expect(statsA?.wins).toBe(1);
    expect(statsB?.wins).toBe(1);

    // Check point ratios differ
    expect(statsA?.pointRatio).not.toBe(statsB?.pointRatio);
  });

  test('should use head-to-head as final tiebreaker', () => {
    const matches: CompletedMatch[] = [
      // A and B have identical stats except head-to-head
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 60,
        team2Points: 55,
        winnerId: 'A',
      },
      {
        id: 'M2',
        team1Id: 'A',
        team2Id: 'C',
        team1Sets: 0,
        team2Sets: 2,
        team1Points: 40,
        team2Points: 50,
        winnerId: 'C',
      },
      {
        id: 'M3',
        team1Id: 'B',
        team2Id: 'C',
        team1Sets: 0,
        team2Sets: 2,
        team1Points: 40,
        team2Points: 50,
        winnerId: 'C',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    // A and B both have 1 win
    const statsA = getTeamStats('A', result);
    const statsB = getTeamStats('B', result);

    expect(statsA?.wins).toBe(statsB?.wins);

    // A won head-to-head vs B
    expect(getTeamRank('A', result)).toBeLessThan(getTeamRank('B', result) || Infinity);
  });

  test('should handle 4-team round robin correctly', () => {
    const matches: CompletedMatch[] = [
      // Round 1
      { id: 'M1', team1Id: 'A', team2Id: 'B', team1Sets: 2, team2Sets: 0, team1Points: 50, team2Points: 40, winnerId: 'A' },
      { id: 'M2', team1Id: 'C', team2Id: 'D', team1Sets: 2, team2Sets: 1, team1Points: 60, team2Points: 55, winnerId: 'C' },
      // Round 2
      { id: 'M3', team1Id: 'A', team2Id: 'C', team1Sets: 2, team2Sets: 0, team1Points: 50, team2Points: 45, winnerId: 'A' },
      { id: 'M4', team1Id: 'B', team2Id: 'D', team1Sets: 2, team2Sets: 1, team1Points: 55, team2Points: 50, winnerId: 'B' },
      // Round 3
      { id: 'M5', team1Id: 'A', team2Id: 'D', team1Sets: 2, team2Sets: 0, team1Points: 50, team2Points: 40, winnerId: 'A' },
      { id: 'M6', team1Id: 'B', team2Id: 'C', team1Sets: 0, team2Sets: 2, team1Points: 45, team2Points: 50, winnerId: 'C' },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    expect(result.rankings).toHaveLength(4);

    // Team A: 3 wins (should be 1st)
    expect(getTeamRank('A', result)).toBe(1);
    expect(getTeamStats('A', result)?.wins).toBe(3);

    // Team C: 2 wins (should be 2nd)
    expect(getTeamRank('C', result)).toBe(2);
    expect(getTeamStats('C', result)?.wins).toBe(2);

    // Team B: 1 win
    expect(getTeamRank('B', result)).toBe(3);

    // Team D: 0 wins
    expect(getTeamRank('D', result)).toBe(4);
  });
});

describe('Ranking Engine - Brazilian Mode', () => {
  test('should rank by template position (rankOutput)', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
      },
      {
        id: 'M2',
        team1Id: 'C',
        team2Id: 'D',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 55,
        team2Points: 50,
        winnerId: 'C',
      },
      {
        id: 'M3',
        team1Id: 'A',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 60,
        team2Points: 58,
        winnerId: 'A',
        rankOutput: 1, // Final (1st/2nd)
      },
      {
        id: 'M4',
        team1Id: 'B',
        team2Id: 'D',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'B',
        rankOutput: 3, // 3rd place match
      },
    ];

    const result = calculatePoolRankings(matches, 'brazilian');

    expect(result.method).toBe('brazilian');
    expect(result.rankings).toHaveLength(4);

    // Winner of final (rankOutput: 1) = 1st
    expect(getTeamRank('A', result)).toBe(1);

    // Loser of final = 2nd
    expect(getTeamRank('C', result)).toBe(2);

    // Winner of 3rd place match = 3rd
    expect(getTeamRank('B', result)).toBe(3);

    // Loser of 3rd place match = 4th
    expect(getTeamRank('D', result)).toBe(4);
  });

  test('should throw error if no rankOutput metadata', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
        // No rankOutput!
      },
    ];

    expect(() => {
      calculatePoolRankings(matches, 'brazilian');
    }).toThrow('Brazilian mode requires matches with rankOutput metadata');
  });

  test('should handle 3-team Brazilian pool correctly', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
      },
      {
        id: 'M2',
        team1Id: 'A',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 55,
        team2Points: 50,
        winnerId: 'A',
        rankOutput: 1, // A wins = 1st
      },
      {
        id: 'M3',
        team1Id: 'B',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'B',
        rankOutput: 2, // B wins = 2nd (C = 3rd)
      },
    ];

    const result = calculatePoolRankings(matches, 'brazilian');

    expect(getTeamRank('A', result)).toBe(1);
    expect(getTeamRank('B', result)).toBe(2);
    expect(getTeamRank('C', result)).toBe(3);
  });
});

describe('Ranking Engine - Edge Cases', () => {
  test('should throw error for empty match array', () => {
    expect(() => {
      calculatePoolRankings([], 'standard');
    }).toThrow('No matches provided');
  });

  test('should handle single match', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'A',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    expect(result.rankings).toHaveLength(2);
    expect(getTeamRank('A', result)).toBe(1);
    expect(getTeamRank('B', result)).toBe(2);
  });

  test('should handle all teams with same record', () => {
    // Circular: A beats B, B beats C, C beats A
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'A',
        team2Id: 'B',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'A',
      },
      {
        id: 'M2',
        team1Id: 'B',
        team2Id: 'C',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'B',
      },
      {
        id: 'M3',
        team1Id: 'C',
        team2Id: 'A',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'C',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    // All have 1 win, 1 loss, identical stats
    const rankings = result.rankings;
    expect(rankings).toHaveLength(3);

    // They should all have same stats
    const stats0 = rankings[0].stats!;
    const stats1 = rankings[1].stats!;
    const stats2 = rankings[2].stats!;

    expect(stats0.wins).toBe(stats1.wins);
    expect(stats1.wins).toBe(stats2.wins);
  });

  test('formatRankings should produce readable output', () => {
    const matches: CompletedMatch[] = [
      {
        id: 'M1',
        team1Id: 'Paris',
        team2Id: 'Lyon',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'Paris',
      },
      {
        id: 'M2',
        team1Id: 'Paris',
        team2Id: 'Marseille',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 60,
        team2Points: 55,
        winnerId: 'Paris',
      },
      {
        id: 'M3',
        team1Id: 'Lyon',
        team2Id: 'Marseille',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'Lyon',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');
    const formatted = formatRankings(result);

    expect(formatted).toContain('Pool Rankings');
    expect(formatted).toContain('STANDARD');
    expect(formatted).toContain('1. Team Paris');
    expect(formatted).toContain('2. Team Lyon');
    expect(formatted).toContain('3. Team Marseille');
    expect(formatted).toContain('2W-0L');
  });
});

describe('Ranking Engine - Real-World Scenarios', () => {
  test('FFVB 4-team pool: complete round-robin', () => {
    // Simulate a realistic pool with varied results
    const matches: CompletedMatch[] = [
      // Match 1: A vs B (A wins)
      {
        id: 'M1',
        team1Id: 'TeamA',
        team2Id: 'TeamB',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 75,
        team2Points: 70,
        winnerId: 'TeamA',
      },
      // Match 2: C vs D (C wins)
      {
        id: 'M2',
        team1Id: 'TeamC',
        team2Id: 'TeamD',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'TeamC',
      },
      // Match 3: A vs C (A wins)
      {
        id: 'M3',
        team1Id: 'TeamA',
        team2Id: 'TeamC',
        team1Sets: 2,
        team2Sets: 1,
        team1Points: 65,
        team2Points: 60,
        winnerId: 'TeamA',
      },
      // Match 4: B vs D (B wins)
      {
        id: 'M4',
        team1Id: 'TeamB',
        team2Id: 'TeamD',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 45,
        winnerId: 'TeamB',
      },
      // Match 5: A vs D (A wins)
      {
        id: 'M5',
        team1Id: 'TeamA',
        team2Id: 'TeamD',
        team1Sets: 2,
        team2Sets: 0,
        team1Points: 50,
        team2Points: 40,
        winnerId: 'TeamA',
      },
      // Match 6: B vs C (C wins)
      {
        id: 'M6',
        team1Id: 'TeamB',
        team2Id: 'TeamC',
        team1Sets: 1,
        team2Sets: 2,
        team1Points: 60,
        team2Points: 65,
        winnerId: 'TeamC',
      },
    ];

    const result = calculatePoolRankings(matches, 'standard');

    console.log('\n' + formatRankings(result));

    // Expected rankings:
    // 1. TeamA: 3-0
    // 2. TeamC: 2-1
    // 3. TeamB: 1-2
    // 4. TeamD: 0-3

    expect(getTeamRank('TeamA', result)).toBe(1);
    expect(getTeamRank('TeamC', result)).toBe(2);
    expect(getTeamRank('TeamB', result)).toBe(3);
    expect(getTeamRank('TeamD', result)).toBe(4);

    expect(getTeamStats('TeamA', result)?.wins).toBe(3);
    expect(getTeamStats('TeamC', result)?.wins).toBe(2);
    expect(getTeamStats('TeamB', result)?.wins).toBe(1);
    expect(getTeamStats('TeamD', result)?.wins).toBe(0);
  });
});
