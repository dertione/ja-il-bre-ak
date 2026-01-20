/**
 * Test suite for FFVB Pool Distribution with Snake Seeding
 */

import {
  distributeTeamsToPools,
  calculatePoolSizes,
  generatePoolIds,
  snakeSeeding,
  getPoolTemplate,
  Team,
  PoolTemplate,
} from './poolDistribution';

describe('calculatePoolSizes', () => {
  test('should distribute evenly when teams divide perfectly', () => {
    expect(calculatePoolSizes(12, 4)).toEqual([3, 3, 3, 3]);
    expect(calculatePoolSizes(16, 4)).toEqual([4, 4, 4, 4]);
    expect(calculatePoolSizes(9, 3)).toEqual([3, 3, 3]);
  });

  test('should put larger pools first when uneven distribution (FFVB rule)', () => {
    // 13 teams / 4 pools = 1 pool of 4 + 3 pools of 3
    expect(calculatePoolSizes(13, 4)).toEqual([4, 3, 3, 3]);

    // 14 teams / 4 pools = 2 pools of 4 + 2 pools of 3
    expect(calculatePoolSizes(14, 4)).toEqual([4, 4, 3, 3]);

    // 10 teams / 3 pools = 1 pool of 4 + 2 pools of 3
    expect(calculatePoolSizes(10, 3)).toEqual([4, 3, 3]);

    // 11 teams / 3 pools = 2 pools of 4 + 1 pool of 3
    expect(calculatePoolSizes(11, 3)).toEqual([4, 4, 3]);
  });

  test('should handle single pool', () => {
    expect(calculatePoolSizes(5, 1)).toEqual([5]);
  });

  test('should throw error for invalid inputs', () => {
    expect(() => calculatePoolSizes(4, 0)).toThrow('Pool count must be greater than 0');
    expect(() => calculatePoolSizes(4, -1)).toThrow('Pool count must be greater than 0');
    expect(() => calculatePoolSizes(3, 4)).toThrow('Not enough teams');
  });
});

describe('generatePoolIds', () => {
  test('should generate correct pool labels', () => {
    expect(generatePoolIds(4)).toEqual(['A', 'B', 'C', 'D']);
    expect(generatePoolIds(3)).toEqual(['A', 'B', 'C']);
    expect(generatePoolIds(1)).toEqual(['A']);
  });

  test('should handle more than 26 pools', () => {
    const ids = generatePoolIds(28);
    expect(ids[0]).toBe('A');
    expect(ids[25]).toBe('Z');
    expect(ids[26]).toBe('AA');
    expect(ids[27]).toBe('AB');
  });
});

describe('snakeSeeding', () => {
  test('should implement correct snake pattern for 16 teams in 4 pools', () => {
    const teams: Team[] = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const pools = snakeSeeding(teams, [4, 4, 4, 4]);

    // Pool A: Seeds 1, 8, 9, 16
    expect(pools[0].map(t => t.seed)).toEqual([1, 8, 9, 16]);

    // Pool B: Seeds 2, 7, 10, 15
    expect(pools[1].map(t => t.seed)).toEqual([2, 7, 10, 15]);

    // Pool C: Seeds 3, 6, 11, 14
    expect(pools[2].map(t => t.seed)).toEqual([3, 6, 11, 14]);

    // Pool D: Seeds 4, 5, 12, 13
    expect(pools[3].map(t => t.seed)).toEqual([4, 5, 12, 13]);
  });

  test('should handle 13 teams in 4 pools (uneven distribution)', () => {
    const teams: Team[] = Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const pools = snakeSeeding(teams, [4, 3, 3, 3]);

    // Pool A (4 teams): Seeds 1, 8, 9
    expect(pools[0].map(t => t.seed)).toEqual([1, 8, 9, 13]);

    // Pool B (3 teams): Seeds 2, 7, 10
    expect(pools[1].map(t => t.seed)).toEqual([2, 7, 10]);

    // Pool C (3 teams): Seeds 3, 6, 11
    expect(pools[2].map(t => t.seed)).toEqual([3, 6, 11]);

    // Pool D (3 teams): Seeds 4, 5, 12
    expect(pools[3].map(t => t.seed)).toEqual([4, 5, 12]);
  });

  test('should handle 12 teams in 3 pools', () => {
    const teams: Team[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const pools = snakeSeeding(teams, [4, 4, 4]);

    // Pool A: Seeds 1, 6, 7, 12
    expect(pools[0].map(t => t.seed)).toEqual([1, 6, 7, 12]);

    // Pool B: Seeds 2, 5, 8, 11
    expect(pools[1].map(t => t.seed)).toEqual([2, 5, 8, 11]);

    // Pool C: Seeds 3, 4, 9, 10
    expect(pools[2].map(t => t.seed)).toEqual([3, 4, 9, 10]);
  });

  test('should throw error for team count mismatch', () => {
    const teams: Team[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    expect(() => snakeSeeding(teams, [4, 4, 4])).toThrow('Team count mismatch');
  });
});

describe('getPoolTemplate', () => {
  test('should return correct template for 4-team pools', () => {
    expect(getPoolTemplate(4)).toBe(PoolTemplate.BRAZILIAN_4);
    expect(getPoolTemplate(4, { templateFor4Teams: PoolTemplate.STANDARD_4 }))
      .toBe(PoolTemplate.STANDARD_4);
  });

  test('should return correct template for 3-team pools', () => {
    expect(getPoolTemplate(3)).toBe(PoolTemplate.STANDARD_3);
  });

  test('should throw error for unsupported pool sizes', () => {
    expect(() => getPoolTemplate(2)).toThrow('Unsupported pool size');
    expect(() => getPoolTemplate(5)).toThrow('Unsupported pool size');
  });
});

describe('distributeTeamsToPools - Full Integration', () => {
  test('should correctly distribute 16 teams into 4 pools', () => {
    const teams: Team[] = Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const result = distributeTeamsToPools(teams, 4);

    expect(result.pools).toHaveLength(4);
    expect(result.summary.totalTeams).toBe(16);
    expect(result.summary.totalPools).toBe(4);

    // All pools should have 4 teams
    expect(result.pools.every(p => p.size === 4)).toBe(true);
    expect(result.pools.every(p => p.template === PoolTemplate.BRAZILIAN_4)).toBe(true);

    // Verify snake seeding
    expect(result.pools[0].teams.map(t => t.seed)).toEqual([1, 8, 9, 16]);
    expect(result.pools[1].teams.map(t => t.seed)).toEqual([2, 7, 10, 15]);
    expect(result.pools[2].teams.map(t => t.seed)).toEqual([3, 6, 11, 14]);
    expect(result.pools[3].teams.map(t => t.seed)).toEqual([4, 5, 12, 13]);

    // Verify pool IDs
    expect(result.pools.map(p => p.poolId)).toEqual(['A', 'B', 'C', 'D']);
  });

  test('should correctly distribute 13 teams into 4 pools (FFVB example)', () => {
    const teams: Team[] = Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const result = distributeTeamsToPools(teams, 4);

    expect(result.pools).toHaveLength(4);

    // Pool A should have 4 teams, others should have 3
    expect(result.pools[0].size).toBe(4);
    expect(result.pools[1].size).toBe(3);
    expect(result.pools[2].size).toBe(3);
    expect(result.pools[3].size).toBe(3);

    // Pool A gets Brazilian template (4 teams), others get Standard 3
    expect(result.pools[0].template).toBe(PoolTemplate.BRAZILIAN_4);
    expect(result.pools[1].template).toBe(PoolTemplate.STANDARD_3);
    expect(result.pools[2].template).toBe(PoolTemplate.STANDARD_3);
    expect(result.pools[3].template).toBe(PoolTemplate.STANDARD_3);

    // Verify summary
    expect(result.summary.poolSizes).toEqual([
      { size: 4, count: 1 },
      { size: 3, count: 3 },
    ]);
  });

  test('should work with unsorted teams', () => {
    const teams: Team[] = [
      { id: 3, name: 'Team C', seed: 3 },
      { id: 1, name: 'Team A', seed: 1 },
      { id: 2, name: 'Team B', seed: 2 },
      { id: 4, name: 'Team D', seed: 4 },
    ];

    const result = distributeTeamsToPools(teams, 2);

    expect(result.pools).toHaveLength(2);
    expect(result.pools[0].teams.map(t => t.seed)).toEqual([1, 4]);
    expect(result.pools[1].teams.map(t => t.seed)).toEqual([2, 3]);
  });

  test('should use custom templates when provided', () => {
    const teams: Team[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const result = distributeTeamsToPools(teams, 2, {
      templateFor4Teams: PoolTemplate.STANDARD_4,
    });

    expect(result.pools.every(p => p.template === PoolTemplate.STANDARD_4)).toBe(true);
  });

  test('should handle edge case: 3 teams in 3 pools', () => {
    const teams: Team[] = [
      { id: 1, name: 'Team 1', seed: 1 },
      { id: 2, name: 'Team 2', seed: 2 },
      { id: 3, name: 'Team 3', seed: 3 },
    ];

    const result = distributeTeamsToPools(teams, 3);

    expect(result.pools).toHaveLength(3);
    expect(result.pools[0].teams.map(t => t.seed)).toEqual([1]);
    expect(result.pools[1].teams.map(t => t.seed)).toEqual([2]);
    expect(result.pools[2].teams.map(t => t.seed)).toEqual([3]);
  });

  test('should throw error for empty teams array', () => {
    expect(() => distributeTeamsToPools([], 4)).toThrow('Teams array cannot be empty');
  });

  test('should throw error for invalid pool count', () => {
    const teams: Team[] = [
      { id: 1, name: 'Team 1', seed: 1 },
    ];

    expect(() => distributeTeamsToPools(teams, 0)).toThrow('Pool count must be greater than 0');
    expect(() => distributeTeamsToPools(teams, -1)).toThrow('Pool count must be greater than 0');
  });

  test('should throw error when not enough teams for pools', () => {
    const teams: Team[] = [
      { id: 1, name: 'Team 1', seed: 1 },
      { id: 2, name: 'Team 2', seed: 2 },
    ];

    expect(() => distributeTeamsToPools(teams, 4)).toThrow('Not enough teams');
  });

  test('should throw error for non-sequential seeds', () => {
    const teams: Team[] = [
      { id: 1, name: 'Team 1', seed: 1 },
      { id: 2, name: 'Team 2', seed: 3 }, // Missing seed 2!
      { id: 3, name: 'Team 3', seed: 4 },
    ];

    expect(() => distributeTeamsToPools(teams, 3)).toThrow('Invalid seed sequence');
  });

  test('should preserve additional team properties', () => {
    const teams: Team[] = [
      { id: 1, name: 'Team Alpha', seed: 1, club: 'Club A', ranking: 100 },
      { id: 2, name: 'Team Beta', seed: 2, club: 'Club B', ranking: 90 },
      { id: 3, name: 'Team Gamma', seed: 3, club: 'Club C', ranking: 80 },
      { id: 4, name: 'Team Delta', seed: 4, club: 'Club D', ranking: 70 },
    ];

    const result = distributeTeamsToPools(teams, 2);

    // Check that additional properties are preserved
    expect(result.pools[0].teams[0]).toHaveProperty('club');
    expect(result.pools[0].teams[0]).toHaveProperty('ranking');
    expect(result.pools[0].teams[0].club).toBe('Club A');
  });
});

describe('Real-world FFVB scenarios', () => {
  test('Scenario: Regional tournament with 10 teams in 3 pools', () => {
    const teams: Team[] = [
      { id: 1, name: 'Paris VB', seed: 1 },
      { id: 2, name: 'Lyon VB', seed: 2 },
      { id: 3, name: 'Marseille VB', seed: 3 },
      { id: 4, name: 'Toulouse VB', seed: 4 },
      { id: 5, name: 'Nice VB', seed: 5 },
      { id: 6, name: 'Nantes VB', seed: 6 },
      { id: 7, name: 'Strasbourg VB', seed: 7 },
      { id: 8, name: 'Bordeaux VB', seed: 8 },
      { id: 9, name: 'Lille VB', seed: 9 },
      { id: 10, name: 'Rennes VB', seed: 10 },
    ];

    const result = distributeTeamsToPools(teams, 3);

    // Should have 1 pool of 4 and 2 pools of 3
    expect(result.summary.poolSizes).toEqual([
      { size: 4, count: 1 },
      { size: 3, count: 3 },
    ]);

    // Verify snake distribution balances strength
    const poolA = result.pools[0].teams.map(t => t.seed);
    const poolB = result.pools[1].teams.map(t => t.seed);
    const poolC = result.pools[2].teams.map(t => t.seed);

    expect(poolA).toEqual([1, 6, 7]);
    expect(poolB).toEqual([2, 5, 8, 10]);
    expect(poolC).toEqual([3, 4, 9]);
  });

  test('Scenario: National championship with 20 teams in 5 pools', () => {
    const teams: Team[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Team ${i + 1}`,
      seed: i + 1,
    }));

    const result = distributeTeamsToPools(teams, 5);

    // All pools should have 4 teams
    expect(result.pools.every(p => p.size === 4)).toBe(true);
    expect(result.pools).toHaveLength(5);

    // Verify pool IDs
    expect(result.pools.map(p => p.poolId)).toEqual(['A', 'B', 'C', 'D', 'E']);

    // Check snake pattern for first and last seeds
    const allSeeds = result.pools.map(p => p.teams.map(t => t.seed));
    expect(allSeeds[0]).toContain(1);  // Best seed in Pool A
    expect(allSeeds[4]).toContain(5);  // 5th seed in Pool E (after first round)
  });
});
