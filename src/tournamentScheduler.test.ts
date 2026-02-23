/**
 * Test suite for Tournament Scheduler (RCPSP Algorithm)
 */

import {
  scheduleMatches,
  validateSchedule,
  Match,
  Court,
  Team,
  SchedulerConfig,
} from './tournamentScheduler';

// Helper to create teams
function createTeam(id: number, name: string): Team {
  return { id, name };
}

// Helper to create courts
function createCourt(id: number, name: string): Court {
  return { id, name };
}

describe('Tournament Scheduler - Basic Functionality', () => {
  test('should schedule simple matches without dependencies', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
      createTeam(4, 'Team D'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(2);
    expect(result.summary.totalMatches).toBe(2);

    // Both matches should start at the same time (different courts, no conflicts)
    const startTimes = result.schedule.map(s => s.startTime.getTime());
    expect(startTimes[0]).toBe(startTimes[1]);

    // Validate schedule
    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should respect single court limitation', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
      createTeam(4, 'Team D'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')]; // Only ONE court

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(2);

    // With one court, matches must be sequential
    const sorted = result.schedule.sort((a, b) =>
      a.startTime.getTime() - b.startTime.getTime()
    );

    expect(sorted[1].startTime.getTime()).toBeGreaterThanOrEqual(
      sorted[0].endTime.getTime()
    );

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });
});

describe('Tournament Scheduler - Dependencies', () => {
  test('should respect match dependencies (simple knockout)', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
      createTeam(4, 'Team D'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
      {
        id: 'M3',
        team1: 'Winner M1',
        team2: 'Winner M2',
        round: 2,
        duration: 30,
        dependencies: ['M1', 'M2'],
      },
    ];

    const courts = [createCourt(1, 'Court 1')];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(3);

    const scheduleMap = new Map(result.schedule.map(s => [s.matchId, s]));

    const m1 = scheduleMap.get('M1')!;
    const m2 = scheduleMap.get('M2')!;
    const m3 = scheduleMap.get('M3')!;

    // M3 must start after both M1 and M2 end
    expect(m3.startTime.getTime()).toBeGreaterThanOrEqual(m1.endTime.getTime());
    expect(m3.startTime.getTime()).toBeGreaterThanOrEqual(m2.endTime.getTime());

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });

  test('should handle complex dependency graph (8-team bracket)', () => {
    const teams = Array.from({ length: 8 }, (_, i) => createTeam(i + 1, `Team ${i + 1}`));

    const matches: Match[] = [
      // Quarter-finals (Round 1)
      { id: 'QF1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'QF2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
      { id: 'QF3', team1: teams[4], team2: teams[5], round: 1, duration: 30 },
      { id: 'QF4', team1: teams[6], team2: teams[7], round: 1, duration: 30 },

      // Semi-finals (Round 2)
      {
        id: 'SF1',
        team1: 'Winner QF1',
        team2: 'Winner QF2',
        round: 2,
        duration: 30,
        dependencies: ['QF1', 'QF2'],
      },
      {
        id: 'SF2',
        team1: 'Winner QF3',
        team2: 'Winner QF4',
        round: 2,
        duration: 30,
        dependencies: ['QF3', 'QF4'],
      },

      // Final (Round 3)
      {
        id: 'F',
        team1: 'Winner SF1',
        team2: 'Winner SF2',
        round: 3,
        duration: 30,
        dependencies: ['SF1', 'SF2'],
      },
    ];

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(7);

    // Verify all dependencies are respected
    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);

    // Verify rounds are in order
    const byRound = new Map<number, typeof result.schedule>();
    for (const scheduled of result.schedule) {
      if (!byRound.has(scheduled.round)) {
        byRound.set(scheduled.round, []);
      }
      byRound.get(scheduled.round)!.push(scheduled);
    }

    const round1End = Math.max(
      ...byRound.get(1)!.map(s => s.endTime.getTime())
    );
    const round2Start = Math.min(
      ...byRound.get(2)!.map(s => s.startTime.getTime())
    );

    expect(round2Start).toBeGreaterThanOrEqual(round1End);
  });
});

describe('Tournament Scheduler - Rest Time Constraints', () => {
  test('should enforce minimum rest time between matches', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      {
        id: 'M2',
        team1: teams[0], // Team A plays again
        team2: teams[2],
        round: 1,
        duration: 30,
      },
    ];

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const config: SchedulerConfig = {
      restTime: 15, // 15 minutes rest required
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    const scheduleMap = new Map(result.schedule.map(s => [s.matchId, s]));
    const m1 = scheduleMap.get('M1')!;
    const m2 = scheduleMap.get('M2')!;

    // Team A must have 15 minutes rest
    const restTime = (m2.startTime.getTime() - m1.endTime.getTime()) / 60000;
    expect(restTime).toBeGreaterThanOrEqual(15);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });

  test('should handle rest time with dependencies', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
      createTeam(4, 'Team D'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
      {
        id: 'M3',
        team1: 'Winner M1',
        team2: 'Winner M2',
        round: 2,
        duration: 30,
        dependencies: ['M1', 'M2'],
      },
    ];

    const courts = [createCourt(1, 'Court 1')];

    const config: SchedulerConfig = {
      restTime: 20, // 20 minutes rest
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);

    const scheduleMap = new Map(result.schedule.map(s => [s.matchId, s]));
    const m1 = scheduleMap.get('M1')!;
    const m2 = scheduleMap.get('M2')!;
    const m3 = scheduleMap.get('M3')!;

    // M3 must start after both M1 and M2 end (dependency constraint)
    expect(m3.startTime.getTime()).toBeGreaterThanOrEqual(m1.endTime.getTime());
    expect(m3.startTime.getTime()).toBeGreaterThanOrEqual(m2.endTime.getTime());

    // Note: Rest time for placeholder teams ("Winner M1", "Winner M2") cannot be
    // tracked because the scheduler doesn't know which actual team won.
    // Rest time is correctly enforced for matches with concrete team IDs.
    // The dependency constraint is the primary safeguard for knockout rounds.
  });
});

describe('Tournament Scheduler - Team Non-Ubiquity', () => {
  test('should prevent team from playing multiple matches simultaneously', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[0], team2: teams[2], round: 1, duration: 30 }, // Team A again!
    ];

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    const scheduleMap = new Map(result.schedule.map(s => [s.matchId, s]));
    const m1 = scheduleMap.get('M1')!;
    const m2 = scheduleMap.get('M2')!;

    // Matches cannot overlap (Team A plays in both)
    const noOverlap =
      m2.startTime.getTime() >= m1.endTime.getTime() ||
      m1.startTime.getTime() >= m2.endTime.getTime();

    expect(noOverlap).toBe(true);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });
});

describe('Tournament Scheduler - Court Setup Time', () => {
  test('should respect court setup time between matches', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
      createTeam(4, 'Team D'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')]; // Single court

    const config: SchedulerConfig = {
      restTime: 0,
      courtSetupTime: 5, // 5 minutes between matches on same court
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    const sorted = result.schedule.sort((a, b) =>
      a.startTime.getTime() - b.startTime.getTime()
    );

    // Second match should start at least 5 minutes after first ends
    const gapMinutes =
      (sorted[1].startTime.getTime() - sorted[0].endTime.getTime()) / 60000;

    expect(gapMinutes).toBeGreaterThanOrEqual(5);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });
});

describe('Tournament Scheduler - Input Validation', () => {
  test('should throw error when no courts available', () => {
    const matches: Match[] = [
      { id: 'M1', team1: createTeam(1, 'A'), team2: createTeam(2, 'B'), round: 1, duration: 30 },
    ];

    expect(() => {
      scheduleMatches(matches, [], { restTime: 0 });
    }).toThrow('No courts available');
  });

  test('should throw error when no matches provided', () => {
    const courts = [createCourt(1, 'Court 1')];

    expect(() => {
      scheduleMatches([], courts, { restTime: 0 });
    }).toThrow('No matches to schedule');
  });

  test('should throw error for duplicate match IDs', () => {
    const matches: Match[] = [
      { id: 'M1', team1: createTeam(1, 'A'), team2: createTeam(2, 'B'), round: 1, duration: 30 },
      { id: 'M1', team1: createTeam(3, 'C'), team2: createTeam(4, 'D'), round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')];

    expect(() => {
      scheduleMatches(matches, courts, { restTime: 0 });
    }).toThrow('Duplicate match ID: M1');
  });

  test('should throw error for negative restTime', () => {
    const matches: Match[] = [
      { id: 'M1', team1: createTeam(1, 'A'), team2: createTeam(2, 'B'), round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')];

    expect(() => {
      scheduleMatches(matches, courts, { restTime: -5 });
    }).toThrow('restTime must be >= 0');
  });

  test('should throw error for invalid match duration', () => {
    const matches: Match[] = [
      { id: 'M1', team1: createTeam(1, 'A'), team2: createTeam(2, 'B'), round: 1, duration: 0 },
    ];

    const courts = [createCourt(1, 'Court 1')];

    expect(() => {
      scheduleMatches(matches, courts, { restTime: 0 });
    }).toThrow('invalid duration');
  });

  test('should throw error for circular dependencies', () => {
    const matches: Match[] = [
      { id: 'M1', team1: 'A', team2: 'B', round: 1, duration: 30, dependencies: ['M2'] },
      { id: 'M2', team1: 'C', team2: 'D', round: 1, duration: 30, dependencies: ['M1'] },
    ];

    const courts = [createCourt(1, 'Court 1')];

    expect(() => {
      scheduleMatches(matches, courts, { restTime: 0 });
    }).toThrow('Circular dependency detected');
  });

  test('should throw error for invalid dependency reference', () => {
    const matches: Match[] = [
      {
        id: 'M1',
        team1: 'Winner M999',
        team2: createTeam(2, 'B'),
        round: 1,
        duration: 30,
        dependencies: ['M999'],
      },
    ];

    const courts = [createCourt(1, 'Court 1')];

    expect(() => {
      scheduleMatches(matches, courts, { restTime: 0 });
    }).toThrow('does not exist');
  });

  test('should handle match with string team IDs', () => {
    const matches: Match[] = [
      { id: 'M1', team1: 'TeamA', team2: 'TeamB', round: 1, duration: 30 },
      { id: 'M2', team1: 'TeamC', team2: 'TeamD', round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(2);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });
});

describe('Tournament Scheduler - Multi-Match Per Tick', () => {
  test('should schedule multiple matches simultaneously when courts are available', () => {
    const teams = Array.from({ length: 8 }, (_, i) => createTeam(i + 1, `Team ${i + 1}`));

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[2], team2: teams[3], round: 1, duration: 30 },
      { id: 'M3', team1: teams[4], team2: teams[5], round: 1, duration: 30 },
      { id: 'M4', team1: teams[6], team2: teams[7], round: 1, duration: 30 },
    ];

    const courts = [
      createCourt(1, 'Court 1'),
      createCourt(2, 'Court 2'),
      createCourt(3, 'Court 3'),
      createCourt(4, 'Court 4'),
    ];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(4);

    // All 4 matches should start at the same time (4 courts, 4 independent matches)
    const startTimes = new Set(result.schedule.map(s => s.startTime.getTime()));
    expect(startTimes.size).toBe(1);

    // All 4 different courts should be used
    const courtsUsed = new Set(result.schedule.map(s => s.courtId));
    expect(courtsUsed.size).toBe(4);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });
});

describe('Tournament Scheduler - Court Conflict Validation', () => {
  test('validateSchedule should detect court double-booking', () => {
    const matches: Match[] = [
      { id: 'M1', team1: createTeam(1, 'A'), team2: createTeam(2, 'B'), round: 1, duration: 30 },
      { id: 'M2', team1: createTeam(3, 'C'), team2: createTeam(4, 'D'), round: 1, duration: 30 },
    ];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    // Manually create a bad schedule with court conflict
    const badSchedule = [
      {
        matchId: 'M1' as string | number,
        courtId: 1 as string | number,
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T09:30:00Z'),
        round: 1,
      },
      {
        matchId: 'M2' as string | number,
        courtId: 1 as string | number, // Same court!
        startTime: new Date('2024-01-01T09:10:00Z'), // Overlaps!
        endTime: new Date('2024-01-01T09:40:00Z'),
        round: 1,
      },
    ];

    const validation = validateSchedule(badSchedule, matches, config);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('overlapping matches'))).toBe(true);
  });

  test('validateSchedule should detect insufficient court setup time', () => {
    const matches: Match[] = [
      { id: 'M1', team1: createTeam(1, 'A'), team2: createTeam(2, 'B'), round: 1, duration: 30 },
      { id: 'M2', team1: createTeam(3, 'C'), team2: createTeam(4, 'D'), round: 1, duration: 30 },
    ];

    const config: SchedulerConfig = {
      restTime: 0,
      courtSetupTime: 10,
      startTime: new Date('2024-01-01T09:00:00Z'),
    };

    // Schedule with insufficient setup time
    const badSchedule = [
      {
        matchId: 'M1' as string | number,
        courtId: 1 as string | number,
        startTime: new Date('2024-01-01T09:00:00Z'),
        endTime: new Date('2024-01-01T09:30:00Z'),
        round: 1,
      },
      {
        matchId: 'M2' as string | number,
        courtId: 1 as string | number,
        startTime: new Date('2024-01-01T09:35:00Z'), // Only 5 min gap, needs 10
        endTime: new Date('2024-01-01T10:05:00Z'),
        round: 1,
      },
    ];

    const validation = validateSchedule(badSchedule, matches, config);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('insufficient setup time'))).toBe(true);
  });
});

describe('Tournament Scheduler - Real-World Scenarios', () => {
  test('Beach Volleyball Tournament: 8 teams, 2 courts, 15min rest', () => {
    const teams = [
      createTeam(1, 'Paris Beach'),
      createTeam(2, 'Lyon Sand'),
      createTeam(3, 'Marseille Waves'),
      createTeam(4, 'Nice Spike'),
      createTeam(5, 'Bordeaux Beach'),
      createTeam(6, 'Toulouse Volley'),
      createTeam(7, 'Nantes Sand'),
      createTeam(8, 'Lille Beach'),
    ];

    const matches: Match[] = [
      // Quarter-finals
      { id: 'QF1', team1: teams[0], team2: teams[7], round: 1, duration: 45 },
      { id: 'QF2', team1: teams[1], team2: teams[6], round: 1, duration: 45 },
      { id: 'QF3', team1: teams[2], team2: teams[5], round: 1, duration: 45 },
      { id: 'QF4', team1: teams[3], team2: teams[4], round: 1, duration: 45 },

      // Semi-finals
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

      // Third place match
      {
        id: '3RD',
        team1: 'Loser SF1',
        team2: 'Loser SF2',
        round: 3,
        duration: 45,
        dependencies: ['SF1', 'SF2'],
      },

      // Final
      {
        id: 'FINAL',
        team1: 'Winner SF1',
        team2: 'Winner SF2',
        round: 3,
        duration: 60,
        dependencies: ['SF1', 'SF2'],
      },
    ];

    const courts = [
      createCourt(1, 'Centre Court'),
      createCourt(2, 'Court 2'),
    ];

    const config: SchedulerConfig = {
      restTime: 15,
      startTime: new Date('2024-06-15T09:00:00Z'),
      courtSetupTime: 5,
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(8);
    expect(result.summary.courtsUsed).toBeLessThanOrEqual(2);

    // Tournament should complete in reasonable time (< 6 hours)
    expect(result.summary.totalDuration).toBeLessThan(360);

    // Validate all constraints
    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('Pool play then knockout: 12 teams, 3 courts', () => {
    const teams = Array.from({ length: 12 }, (_, i) =>
      createTeam(i + 1, `Team ${i + 1}`)
    );

    // Simulate pool play results (top 2 from each pool advance)
    const poolAWinner = teams[0];
    const poolARunner = teams[1];
    const poolBWinner = teams[4];
    const poolBRunner = teams[5];
    const poolCWinner = teams[8];
    const poolCRunner = teams[9];

    const matches: Match[] = [
      // Semi-finals
      { id: 'SF1', team1: poolAWinner, team2: poolBRunner, round: 1, duration: 40 },
      { id: 'SF2', team1: poolBWinner, team2: poolCRunner, round: 1, duration: 40 },
      { id: 'SF3', team1: poolCWinner, team2: poolARunner, round: 1, duration: 40 },

      // Finals (top 2)
      {
        id: 'F1',
        team1: 'Winner SF1',
        team2: 'Winner SF2',
        round: 2,
        duration: 45,
        dependencies: ['SF1', 'SF2'],
      },
      {
        id: 'F2',
        team1: 'Winner SF3',
        team2: 'Loser SF1',
        round: 2,
        duration: 45,
        dependencies: ['SF3', 'SF1'],
      },
    ];

    const courts = [
      createCourt(1, 'Court 1'),
      createCourt(2, 'Court 2'),
      createCourt(3, 'Court 3'),
    ];

    const config: SchedulerConfig = {
      restTime: 20,
      startTime: new Date('2024-06-15T14:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(5);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });

  test('Large pool play: 6 teams round-robin (15 matches), 2 courts', () => {
    const teams = Array.from({ length: 6 }, (_, i) => createTeam(i + 1, `Team ${i + 1}`));

    // Generate all round-robin matches
    const matches: Match[] = [];
    let matchId = 1;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `M${matchId}`,
          team1: teams[i],
          team2: teams[j],
          round: 1,
          duration: 25,
        });
        matchId++;
      }
    }

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const config: SchedulerConfig = {
      restTime: 10,
      startTime: new Date('2024-01-01T08:00:00Z'),
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(15);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Multi-Day Support Tests
// ─────────────────────────────────────────────────────────────

describe('Tournament Scheduler - Multi-Day Support', () => {
  const teamA = createTeam(1, 'Team A');
  const teamB = createTeam(2, 'Team B');
  const teamC = createTeam(3, 'Team C');
  const teamD = createTeam(4, 'Team D');
  const courts = [createCourt(1, 'Court 1')];

  test('should not schedule match that would cross day boundary', () => {
    // Day ends at 17:00, next day starts at 08:00
    const matches: Match[] = [
      { id: 'M1', team1: teamA, team2: teamB, round: 1, duration: 30 },
      { id: 'M2', team1: teamC, team2: teamD, round: 1, duration: 30 },
    ];

    const config: SchedulerConfig = {
      restTime: 0,
      courtSetupTime: 0,
      startTime: new Date('2024-06-15T16:40:00Z'), // 16:40 — M1 fits (ends 17:10) but...
      dayBoundaries: [{
        dayEndTime: new Date('2024-06-15T17:00:00Z'),
        nextDayStartTime: new Date('2024-06-16T08:00:00Z'),
      }],
    };

    const result = scheduleMatches(matches, courts, config);

    // M1 starts at 16:40, would end at 17:10 — crosses boundary, pushed to next day
    // Actually M1 starts at 16:40 and can't fit 30min before 17:00, so pushed
    for (const s of result.schedule) {
      const validation = validateSchedule(result.schedule, matches, config);
      expect(validation.valid).toBe(true);
    }
  });

  test('should push match to next day when it cannot fit before day end', () => {
    // Day ends at 17:00, next day starts at 08:00
    // Start at 16:45 with a 30-min match -> would end at 17:15 -> push to 08:00 next day
    const matches: Match[] = [
      { id: 'M1', team1: teamA, team2: teamB, round: 1, duration: 30 },
    ];

    const config: SchedulerConfig = {
      restTime: 0,
      startTime: new Date('2024-06-15T16:45:00Z'),
      dayBoundaries: [{
        dayEndTime: new Date('2024-06-15T17:00:00Z'),
        nextDayStartTime: new Date('2024-06-16T08:00:00Z'),
      }],
    };

    const result = scheduleMatches(matches, courts, config);

    expect(result.schedule[0].startTime).toEqual(new Date('2024-06-16T08:00:00Z'));
    expect(result.schedule[0].endTime).toEqual(new Date('2024-06-16T08:30:00Z'));
  });

  test('should correctly handle rest time across day boundary', () => {
    // Team A plays M1, then needs rest. But the overnight break should satisfy rest time.
    const matches: Match[] = [
      { id: 'M1', team1: teamA, team2: teamB, round: 1, duration: 30 },
      { id: 'M2', team1: teamA, team2: teamC, round: 2, duration: 30, dependencies: ['M1'] },
    ];

    const config: SchedulerConfig = {
      restTime: 15, // 15 min rest, but overnight gap is much larger
      startTime: new Date('2024-06-15T16:00:00Z'),
      courtSetupTime: 0,
      dayBoundaries: [{
        dayEndTime: new Date('2024-06-15T17:00:00Z'),
        nextDayStartTime: new Date('2024-06-16T08:00:00Z'),
      }],
    };

    const result = scheduleMatches(matches, courts, config);
    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);

    // M1 starts at 16:00, ends at 16:30. Team A available at 16:45.
    // M2 needs 30 min, starting at 16:45 would end at 17:15 -> crosses boundary -> pushed to 08:00
    const m2 = result.schedule.find(s => s.matchId === 'M2')!;
    expect(m2.startTime).toEqual(new Date('2024-06-16T08:00:00Z'));
  });

  test('should validate schedule against day boundaries', () => {
    // Manually create a schedule that crosses a day boundary and validate
    const matches: Match[] = [
      { id: 'M1', team1: teamA, team2: teamB, round: 1, duration: 30 },
    ];

    // Fake a schedule that crosses the boundary
    const badSchedule = [{
      matchId: 'M1' as string | number,
      courtId: 1 as string | number,
      startTime: new Date('2024-06-15T16:45:00Z'),
      endTime: new Date('2024-06-15T17:15:00Z'),
      round: 1,
    }];

    const config: SchedulerConfig = {
      restTime: 0,
      dayBoundaries: [{
        dayEndTime: new Date('2024-06-15T17:00:00Z'),
        nextDayStartTime: new Date('2024-06-16T08:00:00Z'),
      }],
    };

    const validation = validateSchedule(badSchedule, matches, config);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0]).toContain('crosses day boundary');
  });

  test('should handle 2-day tournament with many matches', () => {
    // 4 teams, 6 round-robin matches + semis + final
    const twoCourts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const matches: Match[] = [
      // Round-robin
      { id: 'M1', team1: teamA, team2: teamB, round: 1, duration: 30 },
      { id: 'M2', team1: teamC, team2: teamD, round: 1, duration: 30 },
      { id: 'M3', team1: teamA, team2: teamC, round: 2, duration: 30 },
      { id: 'M4', team1: teamB, team2: teamD, round: 2, duration: 30 },
      { id: 'M5', team1: teamA, team2: teamD, round: 3, duration: 30 },
      { id: 'M6', team1: teamB, team2: teamC, round: 3, duration: 30 },
      // Semis
      { id: 'SF1', team1: 'Winner Pool', team2: 'Runner Pool', round: 4, duration: 45,
        dependencies: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'] },
      { id: 'SF2', team1: '3rd Pool', team2: '4th Pool', round: 4, duration: 45,
        dependencies: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'] },
      // Final
      { id: 'F', team1: 'Winner SF1', team2: 'Winner SF2', round: 5, duration: 45,
        dependencies: ['SF1', 'SF2'] },
    ];

    // Day 1: 14:00 - 18:00, Day 2: 08:00 - 18:00
    const config: SchedulerConfig = {
      restTime: 15,
      courtSetupTime: 5,
      startTime: new Date('2024-06-15T14:00:00Z'),
      dayBoundaries: [{
        dayEndTime: new Date('2024-06-15T18:00:00Z'),
        nextDayStartTime: new Date('2024-06-16T08:00:00Z'),
      }],
    };

    const result = scheduleMatches(matches, twoCourts, config);

    expect(result.schedule).toHaveLength(9);

    const validation = validateSchedule(result.schedule, matches, config);
    expect(validation.valid).toBe(true);
  });
});
