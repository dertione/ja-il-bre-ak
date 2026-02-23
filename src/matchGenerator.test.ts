import {
  estimateMatchDuration,
  generateRoundRobinMatches,
  generateBrazilianMatches,
  generateKnockoutBracket,
  generatePoolMatches,
  MatchFormatConfig,
  TournamentMatch,
  KnockoutTeamEntry,
} from './matchGenerator';
import { Pool, PoolTemplate, Team } from './poolDistribution';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeTeam(id: number, seed: number): Team {
  return { id, name: `Team ${id}`, seed };
}

function makePool4Standard(poolId: string): Pool {
  return {
    poolId,
    teams: [makeTeam(1, 1), makeTeam(8, 8), makeTeam(9, 9), makeTeam(16, 16)],
    size: 4,
    template: PoolTemplate.STANDARD_4,
  };
}

function makePool4Brazilian(poolId: string): Pool {
  return {
    poolId,
    teams: [makeTeam(1, 1), makeTeam(8, 8), makeTeam(9, 9), makeTeam(16, 16)],
    size: 4,
    template: PoolTemplate.BRAZILIAN_4,
  };
}

function makePool3(poolId: string): Pool {
  return {
    poolId,
    teams: [makeTeam(1, 1), makeTeam(6, 6), makeTeam(7, 7)],
    size: 3,
    template: PoolTemplate.STANDARD_3,
  };
}

const FORMAT_SINGLE_15: MatchFormatConfig = { setsToWin: 1, pointsPerSet: 15 };
const FORMAT_BO3_21: MatchFormatConfig = { setsToWin: 2, pointsPerSet: 21 };
const FORMAT_BO3_25: MatchFormatConfig = { setsToWin: 2, pointsPerSet: 25 };

// ─────────────────────────────────────────────────────────────
// Tests: estimateMatchDuration
// ─────────────────────────────────────────────────────────────

describe('estimateMatchDuration', () => {
  test('should return 15 for single 15-point set', () => {
    expect(estimateMatchDuration({ setsToWin: 1, pointsPerSet: 15 })).toBe(15);
  });

  test('should return 20 for single 21-point set', () => {
    expect(estimateMatchDuration({ setsToWin: 1, pointsPerSet: 21 })).toBe(20);
  });

  test('should return 25 for single 25-point set', () => {
    expect(estimateMatchDuration({ setsToWin: 1, pointsPerSet: 25 })).toBe(25);
  });

  test('should return 50 for best-of-3 with 21-point sets', () => {
    expect(estimateMatchDuration({ setsToWin: 2, pointsPerSet: 21 })).toBe(50);
  });

  test('should return 63 for best-of-3 with 25-point sets', () => {
    expect(estimateMatchDuration({ setsToWin: 2, pointsPerSet: 25 })).toBe(63);
  });

  test('should return 38 for best-of-3 with 15-point sets', () => {
    expect(estimateMatchDuration({ setsToWin: 2, pointsPerSet: 15 })).toBe(38);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: generateRoundRobinMatches
// ─────────────────────────────────────────────────────────────

describe('generateRoundRobinMatches', () => {
  test('should generate 6 matches for 4-team pool', () => {
    const pool = makePool4Standard('A');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');
    expect(matches).toHaveLength(6);
  });

  test('should generate 3 matches for 3-team pool', () => {
    const pool = makePool3('B');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');
    expect(matches).toHaveLength(3);
  });

  test('should assign correct match IDs with phase prefix', () => {
    const pool = makePool4Standard('C');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');

    for (const m of matches) {
      expect(String(m.id)).toMatch(/^Q-PC-M\d+$/);
    }
  });

  test('should assign correct match IDs for MD prefix', () => {
    const pool = makePool4Standard('A');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'MD');

    for (const m of matches) {
      expect(String(m.id)).toMatch(/^MD-PA-M\d+$/);
    }
  });

  test('should set correct duration from match format', () => {
    const pool = makePool4Standard('A');
    const matches = generateRoundRobinMatches(pool, FORMAT_BO3_25, 'Q');

    for (const m of matches) {
      expect(m.duration).toBe(63);
    }
  });

  test('should set no dependencies for pool matches', () => {
    const pool = makePool4Standard('A');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');

    for (const m of matches) {
      expect(m.dependencies).toBeUndefined();
    }
  });

  test('should set phase and poolId metadata', () => {
    const pool = makePool4Standard('D');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');

    for (const m of matches) {
      expect(m.phase).toBe('qualification-pool');
      expect(m.poolId).toBe('D');
    }
  });

  test('should assign round sub-rounds using circle method', () => {
    const pool = makePool4Standard('A');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');

    // 4 teams -> 3 rounds of 2 matches each
    const rounds = new Set(matches.map(m => m.round));
    expect(rounds.size).toBe(3);
    expect(rounds).toContain(1);
    expect(rounds).toContain(2);
    expect(rounds).toContain(3);

    // Each round should have 2 matches
    for (const round of rounds) {
      const roundMatches = matches.filter(m => m.round === round);
      expect(roundMatches).toHaveLength(2);
    }
  });

  test('should have each team play every other team exactly once', () => {
    const pool = makePool4Standard('A');
    const matches = generateRoundRobinMatches(pool, FORMAT_SINGLE_15, 'Q');

    const pairings = new Set<string>();
    for (const m of matches) {
      const t1 = typeof m.team1 === 'object' ? (m.team1 as Team).id : m.team1;
      const t2 = typeof m.team2 === 'object' ? (m.team2 as Team).id : m.team2;
      const pair = [t1, t2].sort().join('-');
      expect(pairings.has(pair)).toBe(false);
      pairings.add(pair);
    }

    // For 4 teams, should be 6 unique pairings
    expect(pairings.size).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: generateBrazilianMatches
// ─────────────────────────────────────────────────────────────

describe('generateBrazilianMatches', () => {
  test('should generate exactly 4 matches', () => {
    const pool = makePool4Brazilian('A');
    const matches = generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');
    expect(matches).toHaveLength(4);
  });

  test('should match seed1 vs seed4 and seed2 vs seed3 in round 1', () => {
    const pool = makePool4Brazilian('A');
    const matches = generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');

    const m1 = matches[0];
    const m2 = matches[1];

    // M1: seed 1 vs seed 16
    expect((m1.team1 as Team).seed).toBe(1);
    expect((m1.team2 as Team).seed).toBe(16);
    expect(m1.round).toBe(1);

    // M2: seed 8 vs seed 9
    expect((m2.team1 as Team).seed).toBe(8);
    expect((m2.team2 as Team).seed).toBe(9);
    expect(m2.round).toBe(1);
  });

  test('should set correct dependencies for round 2 matches', () => {
    const pool = makePool4Brazilian('A');
    const matches = generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');

    const m3 = matches[2]; // Final
    const m4 = matches[3]; // 3rd place

    expect(m3.dependencies).toEqual(['Q-PA-M1', 'Q-PA-M2']);
    expect(m4.dependencies).toEqual(['Q-PA-M1', 'Q-PA-M2']);
    expect(m3.round).toBe(2);
    expect(m4.round).toBe(2);
  });

  test('should set rankOutput metadata on round 2 matches', () => {
    const pool = makePool4Brazilian('B');
    const matches = generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');

    const m3 = matches[2];
    const m4 = matches[3];

    expect(m3.metadata?.rankOutput).toBe(1);
    expect(m4.metadata?.rankOutput).toBe(3);
  });

  test('should use placeholder strings for round 2 teams', () => {
    const pool = makePool4Brazilian('A');
    const matches = generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');

    const m3 = matches[2];
    const m4 = matches[3];

    expect(m3.team1).toBe('Winner Q-PA-M1');
    expect(m3.team2).toBe('Winner Q-PA-M2');
    expect(m4.team1).toBe('Loser Q-PA-M1');
    expect(m4.team2).toBe('Loser Q-PA-M2');
  });

  test('should throw for non-4-team pool', () => {
    const pool = makePool3('A');
    (pool as any).template = PoolTemplate.BRAZILIAN_4;
    (pool as any).size = 3;

    expect(() => {
      generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');
    }).toThrow('exactly 4 teams');
  });

  test('should throw for non-BRAZILIAN_4 template', () => {
    const pool = makePool4Standard('A');

    expect(() => {
      generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');
    }).toThrow('BRAZILIAN_4 template');
  });

  test('should order teams by seed regardless of pool.teams ordering', () => {
    // Scramble team order
    const pool: Pool = {
      poolId: 'X',
      teams: [makeTeam(16, 16), makeTeam(1, 1), makeTeam(9, 9), makeTeam(8, 8)],
      size: 4,
      template: PoolTemplate.BRAZILIAN_4,
    };

    const matches = generateBrazilianMatches(pool, FORMAT_SINGLE_15, 'Q');

    // M1 should still be seed 1 vs seed 16
    expect((matches[0].team1 as Team).seed).toBe(1);
    expect((matches[0].team2 as Team).seed).toBe(16);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: generateKnockoutBracket
// ─────────────────────────────────────────────────────────────

describe('generateKnockoutBracket', () => {
  function makeEntries(n: number): KnockoutTeamEntry[] {
    return Array.from({ length: n }, (_, i) => ({
      teamId: `T${i + 1}`,
      seed: i + 1,
      label: `Seed ${i + 1}`,
    }));
  }

  test('should generate 8 matches for 8 teams (4 QF + 2 SF + 3RD + F)', () => {
    const matches = generateKnockoutBracket(makeEntries(8), FORMAT_SINGLE_15);
    expect(matches).toHaveLength(8);

    const qf = matches.filter(m => m.metadata?.knockoutStage === 'QF');
    const sf = matches.filter(m => m.metadata?.knockoutStage === 'SF');
    const smallFinal = matches.filter(m => m.metadata?.knockoutStage === 'small-final');
    const final = matches.filter(m => m.metadata?.knockoutStage === 'final');

    expect(qf).toHaveLength(4);
    expect(sf).toHaveLength(2);
    expect(smallFinal).toHaveLength(1);
    expect(final).toHaveLength(1);
  });

  test('should generate 4 matches for 4 teams (2 SF + 3RD + F)', () => {
    const matches = generateKnockoutBracket(makeEntries(4), FORMAT_SINGLE_15);
    expect(matches).toHaveLength(4);

    const sf = matches.filter(m => m.metadata?.knockoutStage === 'SF');
    const smallFinal = matches.filter(m => m.metadata?.knockoutStage === 'small-final');
    const final = matches.filter(m => m.metadata?.knockoutStage === 'final');

    expect(sf).toHaveLength(2);
    expect(smallFinal).toHaveLength(1);
    expect(final).toHaveLength(1);
  });

  test('should set correct seeding matchups for 8 teams (1v8, 4v5, 2v7, 3v6)', () => {
    const entries = makeEntries(8);
    const matches = generateKnockoutBracket(entries, FORMAT_SINGLE_15);

    const qf1 = matches.find(m => m.id === 'KO-QF1')!;
    const qf2 = matches.find(m => m.id === 'KO-QF2')!;
    const qf3 = matches.find(m => m.id === 'KO-QF3')!;
    const qf4 = matches.find(m => m.id === 'KO-QF4')!;

    expect(qf1.team1).toBe('Seed 1');
    expect(qf1.team2).toBe('Seed 8');
    expect(qf2.team1).toBe('Seed 4');
    expect(qf2.team2).toBe('Seed 5');
    expect(qf3.team1).toBe('Seed 2');
    expect(qf3.team2).toBe('Seed 7');
    expect(qf4.team1).toBe('Seed 3');
    expect(qf4.team2).toBe('Seed 6');
  });

  test('should set correct seeding for 4 teams (1v4, 2v3)', () => {
    const entries = makeEntries(4);
    const matches = generateKnockoutBracket(entries, FORMAT_SINGLE_15);

    const sf1 = matches.find(m => m.id === 'KO-SF1')!;
    const sf2 = matches.find(m => m.id === 'KO-SF2')!;

    expect(sf1.team1).toBe('Seed 1');
    expect(sf1.team2).toBe('Seed 4');
    expect(sf2.team1).toBe('Seed 2');
    expect(sf2.team2).toBe('Seed 3');
  });

  test('should set correct dependencies (SF depends on QF, F depends on SF)', () => {
    const matches = generateKnockoutBracket(makeEntries(8), FORMAT_SINGLE_15);

    const sf1 = matches.find(m => m.id === 'KO-SF1')!;
    const sf2 = matches.find(m => m.id === 'KO-SF2')!;
    const third = matches.find(m => m.id === 'KO-3RD')!;
    const final = matches.find(m => m.id === 'KO-F')!;

    expect(sf1.dependencies).toEqual(['KO-QF1', 'KO-QF2']);
    expect(sf2.dependencies).toEqual(['KO-QF3', 'KO-QF4']);
    expect(third.dependencies).toEqual(['KO-SF1', 'KO-SF2']);
    expect(final.dependencies).toEqual(['KO-SF1', 'KO-SF2']);
  });

  test('should use placeholder strings for winner/loser references', () => {
    const matches = generateKnockoutBracket(makeEntries(8), FORMAT_SINGLE_15);

    const sf1 = matches.find(m => m.id === 'KO-SF1')!;
    expect(sf1.team1).toBe('Winner KO-QF1');
    expect(sf1.team2).toBe('Winner KO-QF2');

    const third = matches.find(m => m.id === 'KO-3RD')!;
    expect(third.team1).toBe('Loser KO-SF1');
    expect(third.team2).toBe('Loser KO-SF2');
  });

  test('should throw for unsupported team count', () => {
    expect(() => {
      generateKnockoutBracket(makeEntries(6), FORMAT_SINGLE_15);
    }).toThrow('4 or 8 teams');

    expect(() => {
      generateKnockoutBracket(makeEntries(3), FORMAT_SINGLE_15);
    }).toThrow('4 or 8 teams');
  });

  test('should use custom starting round', () => {
    const matches = generateKnockoutBracket(makeEntries(4), FORMAT_SINGLE_15, 50);

    const sf = matches.filter(m => m.metadata?.knockoutStage === 'SF');
    expect(sf[0].round).toBe(50);

    const final = matches.find(m => m.id === 'KO-F')!;
    expect(final.round).toBe(60); // 50 + 10
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: generatePoolMatches (dispatcher)
// ─────────────────────────────────────────────────────────────

describe('generatePoolMatches', () => {
  test('should dispatch to round-robin for STANDARD_4 template', () => {
    const pool = makePool4Standard('A');
    const matches = generatePoolMatches(pool, FORMAT_SINGLE_15, 'Q');
    expect(matches).toHaveLength(6); // round-robin: C(4,2) = 6
  });

  test('should dispatch to round-robin for STANDARD_3 template', () => {
    const pool = makePool3('B');
    const matches = generatePoolMatches(pool, FORMAT_SINGLE_15, 'Q');
    expect(matches).toHaveLength(3); // round-robin: C(3,2) = 3
  });

  test('should dispatch to Brazilian for BRAZILIAN_4 template', () => {
    const pool = makePool4Brazilian('C');
    const matches = generatePoolMatches(pool, FORMAT_SINGLE_15, 'Q');
    expect(matches).toHaveLength(4); // Brazilian: 4 matches
  });
});
