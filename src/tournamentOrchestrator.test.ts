import {
  generateTournament,
  validateTournamentConfig,
  suggestPoolCount,
  TournamentConfig,
  TournamentPlan,
} from './tournamentOrchestrator';
import { Team } from './poolDistribution';
import { Court, scheduleMatches } from './tournamentScheduler';
import { MatchFormatConfig } from './matchGenerator';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `T${i + 1}`,
    name: `Team ${i + 1}`,
    seed: i + 1,
  }));
}

function makeCourts(count: number): Court[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `C${i + 1}`,
    name: `Court ${i + 1}`,
  }));
}

const FORMAT_15: MatchFormatConfig = { setsToWin: 1, pointsPerSet: 15 };
const FORMAT_21: MatchFormatConfig = { setsToWin: 2, pointsPerSet: 21 };

function make16TeamQualConfig(
  transitionMode: 'crossover-simple' | 'barrage' | 'direct' = 'crossover-simple',
  qualifyCount: 4 | 6 = 4
): TournamentConfig {
  return {
    name: 'Test Tournament',
    teams: makeTeams(16),
    courts: makeCourts(3),
    format: 'qualification-main-draw',
    qualification: {
      poolPhase: {
        poolCount: 4,
        poolFormat: 'brazilian',
        matchFormat: FORMAT_15,
      },
      transition: {
        qualifyCount,
        mode: transitionMode,
        matchFormat: FORMAT_15,
      },
    },
    mainDraw: {
      type: 'direct-knockout',
      knockout: { matchFormat: FORMAT_21 },
    },
    scheduling: {
      startTime: new Date('2024-06-15T08:00:00Z'),
      restTime: 15,
      courtSetupTime: 5,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Tests: suggestPoolCount
// ─────────────────────────────────────────────────────────────

describe('suggestPoolCount', () => {
  test('should return 4 for 16 teams', () => {
    expect(suggestPoolCount(16)).toBe(4);
  });

  test('should return 4 for 12 teams', () => {
    expect(suggestPoolCount(12)).toBe(3);
  });

  test('should return valid count for 15 teams', () => {
    const count = suggestPoolCount(15);
    expect(count).toBe(4); // 4 pools: [4, 4, 4, 3]
  });

  test('should throw for impossible team counts', () => {
    expect(() => suggestPoolCount(2)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: validateTournamentConfig
// ─────────────────────────────────────────────────────────────

describe('validateTournamentConfig', () => {
  test('should reject fewer than 4 teams', () => {
    const config = make16TeamQualConfig();
    config.teams = makeTeams(3);
    expect(() => validateTournamentConfig(config)).toThrow('at least 4 teams');
  });

  test('should reject 0 courts', () => {
    const config = make16TeamQualConfig();
    config.courts = [];
    expect(() => validateTournamentConfig(config)).toThrow('at least 1 court');
  });

  test('should reject missing qualification config', () => {
    const config = make16TeamQualConfig();
    delete config.qualification;
    expect(() => validateTournamentConfig(config)).toThrow('qualification config required');
  });

  test('should reject pool count producing invalid pool sizes', () => {
    const config = make16TeamQualConfig();
    config.qualification!.poolPhase.poolCount = 7; // 16/7 -> [3,3,2,2,2,2,2]
    expect(() => validateTournamentConfig(config)).toThrow('Only pools of size 3 or 4');
  });

  test('should reject direct mode with wrong qualifyCount', () => {
    const config = make16TeamQualConfig('direct', 4);
    // 4 pools, qualifyCount=4 -> OK (each pool winner qualifies)
    expect(() => validateTournamentConfig(config)).not.toThrow();

    // Change qualifyCount to 6 -> NOT OK for direct
    config.qualification!.transition.qualifyCount = 6;
    config.qualification!.transition.mode = 'direct';
    expect(() => validateTournamentConfig(config)).toThrow('qualifyCount');
  });

  test('should accept valid config', () => {
    const config = make16TeamQualConfig();
    expect(() => validateTournamentConfig(config)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: generateTournament - qualification + main draw
// ─────────────────────────────────────────────────────────────

describe('generateTournament - qualification + main draw', () => {
  test('should generate complete plan for 16 teams, 4 pools, crossover qual, direct knockout', () => {
    const config = make16TeamQualConfig('crossover-simple', 4);
    const plan = generateTournament(config);

    expect(plan.phases).toHaveLength(3); // qual pool, qual transition, knockout
    expect(plan.phases[0].id).toBe('qualification-pool');
    expect(plan.phases[1].id).toBe('qualification-transition');
    expect(plan.phases[2].id).toBe('knockout');

    // 4 Brazilian pools * 4 matches = 16 pool matches
    expect(plan.phases[0].matches).toHaveLength(16);

    // 4 crossover matches
    expect(plan.phases[1].matches).toHaveLength(4);

    // 4-team knockout: 2 SF + 3rd + Final = 4 matches
    expect(plan.phases[2].matches).toHaveLength(4);

    expect(plan.summary.totalMatches).toBe(24);
  });

  test('should chain qualification pool -> transition -> knockout with correct dependencies', () => {
    const config = make16TeamQualConfig('crossover-simple', 4);
    const plan = generateTournament(config);

    // Transition matches should depend on pool matches
    const transMatches = plan.phases[1].matches;
    for (const m of transMatches) {
      expect(m.dependencies).toBeDefined();
      expect(m.dependencies!.length).toBeGreaterThan(0);
      // All dependencies should be pool match IDs
      for (const dep of m.dependencies!) {
        expect(String(dep)).toMatch(/^Q-P[A-D]-M\d+$/);
      }
    }

    // Knockout matches without existing deps should depend on transition matches
    const knockoutMatches = plan.phases[2].matches;
    const sfMatches = knockoutMatches.filter(m => !m.dependencies?.some(
      d => String(d).startsWith('KO-')
    ));
    // SF matches (first round of knockout) should depend on transition matches
    for (const m of sfMatches) {
      expect(m.dependencies).toBeDefined();
      expect(m.dependencies!.some(d => String(d).startsWith('QT-'))).toBe(true);
    }
  });

  test('should use correct match IDs across phases', () => {
    const config = make16TeamQualConfig('crossover-simple', 4);
    const plan = generateTournament(config);

    const allIds = plan.allMatches.map(m => String(m.id));
    const uniqueIds = new Set(allIds);

    // All IDs should be unique
    expect(uniqueIds.size).toBe(allIds.length);

    // Pool matches: Q-P{A-D}-M{1-4}
    const poolIds = allIds.filter(id => id.startsWith('Q-P'));
    expect(poolIds).toHaveLength(16);

    // Transition matches: QT-X{1-4}
    const transIds = allIds.filter(id => id.startsWith('QT-'));
    expect(transIds).toHaveLength(4);

    // Knockout matches: KO-*
    const koIds = allIds.filter(id => id.startsWith('KO-'));
    expect(koIds).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: generateTournament - main draw only
// ─────────────────────────────────────────────────────────────

describe('generateTournament - main draw only', () => {
  test('should generate plan for 8 teams direct knockout', () => {
    const config: TournamentConfig = {
      name: 'Direct KO',
      teams: makeTeams(8),
      courts: makeCourts(2),
      format: 'main-draw-only',
      mainDraw: {
        type: 'direct-knockout',
        knockout: { matchFormat: FORMAT_21 },
      },
      scheduling: {
        startTime: new Date('2024-06-15T08:00:00Z'),
        restTime: 15,
      },
    };

    const plan = generateTournament(config);

    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].id).toBe('knockout');
    // 8-team bracket: 4 QF + 2 SF + 3rd + Final = 8
    expect(plan.summary.totalMatches).toBe(8);
  });

  test('should generate plan for 4 teams direct knockout', () => {
    const config: TournamentConfig = {
      name: 'Small KO',
      teams: makeTeams(4),
      courts: makeCourts(1),
      format: 'main-draw-only',
      mainDraw: {
        type: 'direct-knockout',
        knockout: { matchFormat: FORMAT_15 },
      },
      scheduling: {
        startTime: new Date('2024-06-15T08:00:00Z'),
        restTime: 10,
      },
    };

    const plan = generateTournament(config);

    expect(plan.phases).toHaveLength(1);
    // 4-team bracket: 2 SF + 3rd + Final = 4
    expect(plan.summary.totalMatches).toBe(4);
  });

  test('should generate plan for 16 teams, 4 pools then knockout', () => {
    const config: TournamentConfig = {
      name: 'Pools + KO',
      teams: makeTeams(16),
      courts: makeCourts(3),
      format: 'main-draw-only',
      mainDraw: {
        type: 'pools-then-knockout',
        poolPhase: {
          poolCount: 4,
          poolFormat: 'classic',
          matchFormat: FORMAT_15,
        },
        transition: {
          mode: 'crossover-simple',
          matchFormat: FORMAT_15,
        },
        knockout: { matchFormat: FORMAT_21 },
      },
      scheduling: {
        startTime: new Date('2024-06-15T08:00:00Z'),
        restTime: 15,
      },
    };

    const plan = generateTournament(config);

    // Phases: main-draw-pool, main-draw-transition, knockout
    expect(plan.phases).toHaveLength(3);
    expect(plan.phases[0].id).toBe('main-draw-pool');
    expect(plan.phases[1].id).toBe('main-draw-transition');
    expect(plan.phases[2].id).toBe('knockout');

    // 4 pools of 4 (classic) = 6 * 4 = 24 pool matches
    expect(plan.phases[0].matches).toHaveLength(24);
  });

  test('barrage 2c3: should generate 4 serpentin matches, 8-team QF knockout', () => {
    const config: TournamentConfig = {
      name: 'Barrage 2c3 + QF',
      teams: makeTeams(16),
      courts: makeCourts(3),
      format: 'main-draw-only',
      mainDraw: {
        type: 'pools-then-knockout',
        poolPhase: { poolCount: 4, poolFormat: 'classic', matchFormat: FORMAT_15 },
        transition: { mode: 'barrage', matchFormat: FORMAT_15 },
        knockout: { matchFormat: FORMAT_21 },
      },
      scheduling: { startTime: new Date('2024-06-15T08:00:00Z'), restTime: 15 },
    };

    const plan = generateTournament(config);

    // 3 phases: pool, barrage, knockout
    expect(plan.phases).toHaveLength(3);
    expect(plan.phases[1].id).toBe('main-draw-transition');
    expect(plan.phases[2].id).toBe('knockout');

    // Barrage: 4 matches only (no Tour 2)
    const barrage = plan.phases[1];
    expect(barrage.matches).toHaveLength(4);

    // Serpentin cross-pool: 2nd-A vs 3rd-D, 2nd-B vs 3rd-C, 2nd-C vs 3rd-B, 2nd-D vs 3rd-A
    expect(barrage.matches[0].team1).toBe('2nd-MD-A');
    expect(barrage.matches[0].team2).toBe('3rd-MD-D');
    expect(barrage.matches[1].team1).toBe('2nd-MD-B');
    expect(barrage.matches[1].team2).toBe('3rd-MD-C');
    expect(barrage.matches[2].team1).toBe('2nd-MD-C');
    expect(barrage.matches[2].team2).toBe('3rd-MD-B');
    expect(barrage.matches[3].team1).toBe('2nd-MD-D');
    expect(barrage.matches[3].team2).toBe('3rd-MD-A');

    // Knockout: 8 teams → QF(4) + SF(2) + 3rd + Final = 8 matches
    const ko = plan.phases[2];
    expect(ko.matches).toHaveLength(8);
    const qfMatches = ko.matches.filter(m => m.metadata?.knockoutStage === 'QF');
    expect(qfMatches).toHaveLength(4);

    // Pool winners vs barrage winners (serpentin seeding 1v8, 4v5, 2v7, 3v6)
    expect(qfMatches[0].team1).toBe('1st-MD-A');
    expect(qfMatches[0].team2).toBe('Winner MDT-B4-T1');
    expect(qfMatches[1].team1).toBe('1st-MD-D');
    expect(qfMatches[1].team2).toBe('Winner MDT-B1-T1');
    expect(qfMatches[2].team1).toBe('1st-MD-B');
    expect(qfMatches[2].team2).toBe('Winner MDT-B3-T1');
    expect(qfMatches[3].team1).toBe('1st-MD-C');
    expect(qfMatches[3].team2).toBe('Winner MDT-B2-T1');

    expect(plan.summary.totalMatches).toBe(36); // 24 pool + 4 barrage + 8 knockout
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: Qualification transition modes
// ─────────────────────────────────────────────────────────────

describe('Qualification transitions', () => {
  test('crossover-simple qualifying 4: should generate 4 crossover matches', () => {
    const config = make16TeamQualConfig('crossover-simple', 4);
    const plan = generateTournament(config);

    const transPhase = plan.phases.find(p => p.id === 'qualification-transition')!;
    expect(transPhase.matches).toHaveLength(4);

    // Verify serpentin pattern
    expect(transPhase.matches[0].team1).toBe('1st-A');
    expect(transPhase.matches[0].team2).toBe('2nd-D');
    expect(transPhase.matches[1].team1).toBe('1st-B');
    expect(transPhase.matches[1].team2).toBe('2nd-C');
    expect(transPhase.matches[2].team1).toBe('1st-C');
    expect(transPhase.matches[2].team2).toBe('2nd-B');
    expect(transPhase.matches[3].team1).toBe('1st-D');
    expect(transPhase.matches[3].team2).toBe('2nd-A');
  });

  test('crossover-simple qualifying 6: should generate 6 transition matches', () => {
    // Qualifying 6 into direct-knockout is invalid; use pools-then-knockout
    const config = make16TeamQualConfig('crossover-simple', 6);
    config.mainDraw = {
      type: 'pools-then-knockout',
      poolPhase: {
        poolCount: 2,
        poolFormat: 'classic',
        matchFormat: FORMAT_15,
      },
      knockout: { matchFormat: FORMAT_21 },
    };
    const plan = generateTournament(config);

    const transPhase = plan.phases.find(p => p.id === 'qualification-transition')!;
    // 4 (1st vs 3rd) + 2 (2nd vs 2nd) = 6
    expect(transPhase.matches).toHaveLength(6);
  });

  test('barrage qualifying 4: should generate 8 matches (4 tour1 + 4 tour2)', () => {
    const config = make16TeamQualConfig('barrage', 4);
    const plan = generateTournament(config);

    const transPhase = plan.phases.find(p => p.id === 'qualification-transition')!;
    expect(transPhase.matches).toHaveLength(8);

    // Tour 1 matches (round 10)
    const tour1 = transPhase.matches.filter(m => m.round === 10);
    expect(tour1).toHaveLength(4);

    // Tour 2 matches (round 11)
    const tour2 = transPhase.matches.filter(m => m.round === 11);
    expect(tour2).toHaveLength(4);

    // Tour 2 matches should depend on Tour 1 matches
    for (const m of tour2) {
      expect(m.dependencies).toBeDefined();
      expect(m.dependencies!.length).toBe(1);
      expect(String(m.dependencies![0])).toMatch(/^QT-B\d+-T1$/);
    }
  });

  test('direct qualifying 4: should generate 0 transition matches', () => {
    const config = make16TeamQualConfig('direct', 4);
    const plan = generateTournament(config);

    const transPhase = plan.phases.find(p => p.id === 'qualification-transition')!;
    expect(transPhase.matches).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: Integration with scheduler
// ─────────────────────────────────────────────────────────────

describe('Integration with scheduler', () => {
  test('should produce matches schedulable by scheduleMatches', () => {
    // Use a simpler config: 4 teams direct knockout
    const config: TournamentConfig = {
      name: 'Integration Test',
      teams: makeTeams(4),
      courts: makeCourts(2),
      format: 'main-draw-only',
      mainDraw: {
        type: 'direct-knockout',
        knockout: { matchFormat: FORMAT_15 },
      },
      scheduling: {
        startTime: new Date('2024-06-15T08:00:00Z'),
        restTime: 10,
      },
    };

    const plan = generateTournament(config);

    // Should not throw when passed to scheduler
    const result = scheduleMatches(
      plan.allMatches,
      config.courts,
      {
        restTime: config.scheduling.restTime,
        startTime: config.scheduling.startTime,
      }
    );

    expect(result.schedule).toHaveLength(plan.summary.totalMatches);
  });

  test('all dependencies should reference valid match IDs', () => {
    const config = make16TeamQualConfig('crossover-simple', 4);
    const plan = generateTournament(config);

    const allIds = new Set(plan.allMatches.map(m => String(m.id)));

    for (const match of plan.allMatches) {
      if (match.dependencies) {
        for (const dep of match.dependencies) {
          expect(allIds.has(String(dep))).toBe(true);
        }
      }
    }
  });

  test('no circular dependencies across phases', () => {
    const config = make16TeamQualConfig('barrage', 4);
    const plan = generateTournament(config);

    // Build adjacency list
    const deps = new Map<string, string[]>();
    for (const m of plan.allMatches) {
      deps.set(String(m.id), (m.dependencies || []).map(String));
    }

    // DFS cycle detection
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const id of deps.keys()) {
      color.set(id, WHITE);
    }

    function dfs(id: string): boolean {
      color.set(id, GRAY);
      for (const dep of deps.get(id) || []) {
        if (color.get(dep) === GRAY) return true; // cycle
        if (color.get(dep) === WHITE && dfs(dep)) return true;
      }
      color.set(id, BLACK);
      return false;
    }

    let hasCycle = false;
    for (const id of deps.keys()) {
      if (color.get(id) === WHITE) {
        if (dfs(id)) {
          hasCycle = true;
          break;
        }
      }
    }

    expect(hasCycle).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: Summary
// ─────────────────────────────────────────────────────────────

describe('Tournament plan summary', () => {
  test('should compute correct match count summary', () => {
    const config = make16TeamQualConfig('crossover-simple', 4);
    const plan = generateTournament(config);

    expect(plan.summary.totalMatches).toBe(plan.allMatches.length);
    expect(plan.summary.totalPhases).toBe(plan.phases.length);

    const sumByPhase = plan.summary.matchesByPhase.reduce(
      (sum, p) => sum + p.count, 0
    );
    expect(sumByPhase).toBe(plan.summary.totalMatches);
  });

  test('should have positive estimated duration', () => {
    const config = make16TeamQualConfig();
    const plan = generateTournament(config);
    expect(plan.summary.estimatedDuration).toBeGreaterThan(0);
  });
});
