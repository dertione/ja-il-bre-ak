/**
 * Test suite for Crossover Engine
 */

import {
  generateNextStageMatches,
  PoolRankings,
  validatePoolRankings,
  formatTransitionResult,
} from './crossoverEngine';
import { calculatePoolRankings, CompletedMatch } from './rankingEngine';

// Helper to create simple pool rankings
function createPoolRankings(
  poolId: string,
  teamIds: string[]
): PoolRankings {
  const matches: CompletedMatch[] = [];

  // Create matches so teams are ranked in order
  for (let i = 0; i < teamIds.length - 1; i++) {
    matches.push({
      id: `M${poolId}-${i}`,
      team1Id: teamIds[i],
      team2Id: teamIds[i + 1],
      team1Sets: 2,
      team2Sets: 0,
      team1Points: 50 - i * 5,
      team2Points: 40,
      winnerId: teamIds[i],
    });
  }

  const rankings = calculatePoolRankings(matches, 'standard');

  return {
    poolId,
    rankings,
  };
}

describe('Crossover Engine - Crossover Mode', () => {
  test('should generate serpentin crossover for 4 pools', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2', 'A3']),
      createPoolRankings('B', ['B1', 'B2', 'B3']),
      createPoolRankings('C', ['C1', 'C2', 'C3']),
      createPoolRankings('D', ['D1', 'D2', 'D3']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'crossover',
      qualifiersPerPool: 1,
      pattern: 'serpentin',
    });

    // 4 first-place teams qualify directly
    expect(result.qualified).toHaveLength(4);
    expect(result.qualified.map(q => q.teamId).sort()).toEqual(['A1', 'B1', 'C1', 'D1']);

    // 4 playoff matches (2nd vs 3rd serpentin)
    expect(result.playoffMatches).toHaveLength(4);

    // Check serpentin pattern: 2A-3D, 2B-3C, 2C-3B, 2D-3A
    const matchups = result.playoffMatches.map(m => ({
      team1: `${m.team1.rank}${m.team1.poolId}`,
      team2: `${m.team2.rank}${m.team2.poolId}`,
    }));

    expect(matchups).toContainEqual({ team1: '2A', team2: '3D' });
    expect(matchups).toContainEqual({ team1: '2B', team2: '3C' });
    expect(matchups).toContainEqual({ team1: '2C', team2: '3B' });
    expect(matchups).toContainEqual({ team1: '2D', team2: '3A' });
  });

  test('should qualify first-place teams directly', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['TeamA1', 'TeamA2']),
      createPoolRankings('B', ['TeamB1', 'TeamB2']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'crossover',
      qualifiersPerPool: 1,
    });

    expect(result.qualified).toHaveLength(2);

    const qualified = result.qualified.map(q => q.teamId);
    expect(qualified).toContain('TeamA1');
    expect(qualified).toContain('TeamB1');

    // All should be direct qualifiers
    expect(result.qualified.every(q => q.method === 'direct')).toBe(true);
  });
});

describe('Crossover Engine - Ticket Mode', () => {
  test('should distribute tickets with direct qualifiers + best seconds', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2', 'A3']),
      createPoolRankings('B', ['B1', 'B2', 'B3']),
      createPoolRankings('C', ['C1', 'C2', 'C3']),
      createPoolRankings('D', ['D1', 'D2', 'D3']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'tickets',
      totalTickets: 6, // 4 firsts + 2 best seconds
    });

    // Should have 6 qualified teams total
    expect(result.qualified).toHaveLength(6);

    // 4 first-place teams
    const firsts = result.qualified.filter(q => q.rank === 1);
    expect(firsts).toHaveLength(4);
    expect(firsts.every(q => q.method === 'direct')).toBe(true);

    // 2 best seconds
    const seconds = result.qualified.filter(q => q.rank === 2);
    expect(seconds).toHaveLength(2);
    expect(seconds.every(q => q.method === 'best-second')).toBe(true);

    // No playoff matches needed
    expect(result.playoffMatches).toHaveLength(0);
  });

  test('should handle exact fit (totalTickets = pool count)', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2']),
      createPoolRankings('B', ['B1', 'B2']),
      createPoolRankings('C', ['C1', 'C2']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'tickets',
      totalTickets: 3, // Exactly the number of pools
    });

    // Only first-place teams qualify
    expect(result.qualified).toHaveLength(3);
    expect(result.qualified.every(q => q.rank === 1)).toBe(true);
    expect(result.playoffMatches).toHaveLength(0);
  });

  test('should handle more tickets than pools', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2', 'A3', 'A4']),
      createPoolRankings('B', ['B1', 'B2', 'B3', 'B4']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'tickets',
      totalTickets: 5, // 2 firsts + 3 more = need 3 from seconds
    });

    expect(result.qualified.length).toBeGreaterThanOrEqual(2);

    const firsts = result.qualified.filter(q => q.rank === 1);
    expect(firsts).toHaveLength(2);
  });

  test('should rank best seconds correctly by FFVB criteria', () => {
    // Create pools where second-place teams have different records
    const poolA: PoolRankings = {
      poolId: 'A',
      rankings: calculatePoolRankings(
        [
          {
            id: 'MA1',
            team1Id: 'A1',
            team2Id: 'A2',
            team1Sets: 2,
            team2Sets: 0,
            team1Points: 50,
            team2Points: 40,
            winnerId: 'A1',
          },
          {
            id: 'MA2',
            team1Id: 'A2',
            team2Id: 'A3',
            team1Sets: 2,
            team2Sets: 1,
            team1Points: 60,
            team2Points: 55,
            winnerId: 'A2',
          },
        ],
        'standard'
      ),
    };

    const poolB: PoolRankings = {
      poolId: 'B',
      rankings: calculatePoolRankings(
        [
          {
            id: 'MB1',
            team1Id: 'B1',
            team2Id: 'B2',
            team1Sets: 2,
            team2Sets: 0,
            team1Points: 50,
            team2Points: 40,
            winnerId: 'B1',
          },
          {
            id: 'MB2',
            team1Id: 'B2',
            team2Id: 'B3',
            team1Sets: 2,
            team2Sets: 0,
            team1Points: 50,
            team2Points: 45,
            winnerId: 'B2',
          },
        ],
        'standard'
      ),
    };

    const result = generateNextStageMatches([poolA, poolB], {
      mode: 'tickets',
      totalTickets: 3, // 2 firsts + 1 best second
    });

    expect(result.qualified).toHaveLength(3);

    const bestSecond = result.qualified.find(q => q.rank === 2);
    expect(bestSecond).toBeDefined();

    // B2 has better record than A2 (2-0 sets vs 2-1 sets)
    expect(bestSecond?.teamId).toBe('B2');
  });
});

describe('Crossover Engine - Direct Mode', () => {
  test('should qualify top N from each pool', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2', 'A3', 'A4']),
      createPoolRankings('B', ['B1', 'B2', 'B3', 'B4']),
      createPoolRankings('C', ['C1', 'C2', 'C3', 'C4']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'direct',
      teamsPerPool: 2, // Top 2 from each pool
    });

    // 3 pools × 2 teams = 6 qualified
    expect(result.qualified).toHaveLength(6);

    // Check that we have 1st and 2nd from each pool
    const poolA = result.qualified.filter(q => q.poolId === 'A');
    expect(poolA).toHaveLength(2);
    expect(poolA.map(q => q.rank).sort()).toEqual([1, 2]);

    const poolB = result.qualified.filter(q => q.poolId === 'B');
    expect(poolB).toHaveLength(2);

    const poolC = result.qualified.filter(q => q.poolId === 'C');
    expect(poolC).toHaveLength(2);

    // No playoff matches in direct mode
    expect(result.playoffMatches).toHaveLength(0);
  });

  test('should handle top 1 from each pool', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2']),
      createPoolRankings('B', ['B1', 'B2']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'direct',
      teamsPerPool: 1,
    });

    expect(result.qualified).toHaveLength(2);
    expect(result.qualified.every(q => q.rank === 1)).toBe(true);
  });
});

describe('Crossover Engine - Validation', () => {
  test('should validate pool rankings', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2']),
      createPoolRankings('B', ['B1', 'B2']),
    ];

    const validation = validatePoolRankings(poolRankings);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should detect empty pool rankings', () => {
    const validation = validatePoolRankings([]);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('No pool rankings provided');
  });

  test('should detect pool with no rankings', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2']),
      {
        poolId: 'B',
        rankings: {
          method: 'standard',
          rankings: [],
        },
      },
    ];

    const validation = validatePoolRankings(poolRankings);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('Pool B has no rankings'))).toBe(true);
  });

  test('should throw error for empty pool rankings array', () => {
    expect(() => {
      generateNextStageMatches([], {
        mode: 'direct',
        teamsPerPool: 1,
      });
    }).toThrow('No pool rankings provided');
  });
});

describe('Crossover Engine - Output Formatting', () => {
  test('formatTransitionResult should produce readable output', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['Paris', 'Lyon', 'Marseille']),
      createPoolRankings('B', ['Nice', 'Bordeaux', 'Toulouse']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'crossover',
      qualifiersPerPool: 1,
    });

    const formatted = formatTransitionResult(result);

    expect(formatted).toContain('Next Stage Transition');
    expect(formatted).toContain('Direct Qualifiers');
    expect(formatted).toContain('Playoff Matches');
    expect(formatted).toContain('1st A');
    expect(formatted).toContain('1st B');
  });
});

describe('Crossover Engine - Real-World Scenarios', () => {
  test('FFVB Championship: 4 pools, top 1 direct + 2v3 playoffs', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['Paris VB', 'Lyon VB', 'Marseille VB', 'Toulouse VB']),
      createPoolRankings('B', ['Nice VB', 'Bordeaux VB', 'Nantes VB', 'Strasbourg VB']),
      createPoolRankings('C', ['Lille VB', 'Rennes VB', 'Montpellier VB', 'Reims VB']),
      createPoolRankings('D', ['Le Havre VB', 'Tours VB', 'Arago VB', 'Cannes VB']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'crossover',
      qualifiersPerPool: 1,
      pattern: 'serpentin',
    });

    console.log('\n' + formatTransitionResult(result));

    // 4 pool winners advance directly
    expect(result.qualified).toHaveLength(4);
    expect(result.summary.totalQualified).toBe(4);

    // 4 playoff matches
    expect(result.playoffMatches).toHaveLength(4);
    expect(result.summary.playoffCount).toBe(4);

    // Check playoff matchups follow serpentin
    const playoffTeams = result.playoffMatches.map(m => ({
      t1: `${m.team1.rank}${m.team1.poolId}`,
      t2: `${m.team2.rank}${m.team2.poolId}`,
    }));

    // Should have 2nd vs 3rd crossovers
    playoffTeams.forEach(match => {
      expect(match.t1.startsWith('2')).toBe(true);
      expect(match.t2.startsWith('3')).toBe(true);
    });
  });

  test('Regional Tournament: 3 pools, 8 tickets total', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['A1', 'A2', 'A3', 'A4']),
      createPoolRankings('B', ['B1', 'B2', 'B3', 'B4']),
      createPoolRankings('C', ['C1', 'C2', 'C3', 'C4']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'tickets',
      totalTickets: 8, // 3 firsts + 5 more
    });

    console.log('\n' + formatTransitionResult(result));

    // Should qualify 8 teams
    expect(result.qualified.length).toBeGreaterThanOrEqual(3);

    // 3 first-place teams
    const firsts = result.qualified.filter(q => q.rank === 1);
    expect(firsts).toHaveLength(3);
  });

  test('National Championship: Direct qualification, top 2 per pool', () => {
    const poolRankings: PoolRankings[] = [
      createPoolRankings('A', ['TeamA1', 'TeamA2', 'TeamA3']),
      createPoolRankings('B', ['TeamB1', 'TeamB2', 'TeamB3']),
      createPoolRankings('C', ['TeamC1', 'TeamC2', 'TeamC3']),
      createPoolRankings('D', ['TeamD1', 'TeamD2', 'TeamD3']),
    ];

    const result = generateNextStageMatches(poolRankings, {
      mode: 'direct',
      teamsPerPool: 2,
    });

    console.log('\n' + formatTransitionResult(result));

    // 4 pools × 2 teams = 8 qualified
    expect(result.qualified).toHaveLength(8);
    expect(result.playoffMatches).toHaveLength(0);

    // Each pool should have 2 teams
    ['A', 'B', 'C', 'D'].forEach(poolId => {
      const poolTeams = result.qualified.filter(q => q.poolId === poolId);
      expect(poolTeams).toHaveLength(2);
      expect(poolTeams.map(t => t.rank).sort()).toEqual([1, 2]);
    });
  });
});
