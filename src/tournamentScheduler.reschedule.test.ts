/**
 * Test suite for Tournament Scheduler - Live Reschedule Mode
 */

import {
  rescheduleMatches,
  Match,
  Court,
  Team,
  RescheduleConfig,
  CompletedScheduledMatch,
} from './tournamentScheduler';

// Helper to create teams
function createTeam(id: number, name: string): Team {
  return { id, name };
}

// Helper to create courts
function createCourt(id: number, name: string): Court {
  return { id, name };
}

describe('Tournament Scheduler - Live Reschedule Mode', () => {
  test('should reschedule pending matches after some are completed', () => {
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
        duration: 45,
        dependencies: ['M1', 'M2'],
      },
    ];

    const courts = [createCourt(1, 'Court 1')];

    // M1 is completed (finished 2 minutes late)
    const completedMatches: CompletedScheduledMatch[] = [
      {
        matchId: 'M1',
        courtId: 1,
        actualStartTime: new Date('2024-01-01T09:00:00Z'),
        actualEndTime: new Date('2024-01-01T09:32:00Z'), // 32 min instead of 30
        team1Id: teams[0].id,
        team2Id: teams[1].id,
      },
    ];

    const config: RescheduleConfig = {
      restTime: 15,
      currentTime: new Date('2024-01-01T09:35:00Z'), // 3 min after M1 ended
      startTime: new Date('2024-01-01T09:00:00Z'),
      completedMatches,
    };

    const result = rescheduleMatches(matches, courts, config);

    // Should only return M2 and M3 (not M1 which is completed)
    expect(result.schedule).toHaveLength(2);
    expect(result.schedule.find(s => s.matchId === 'M1')).toBeUndefined();

    // M2 should be scheduled
    const m2 = result.schedule.find(s => s.matchId === 'M2');
    expect(m2).toBeDefined();
    expect(m2!.startTime.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-01T09:35:00Z').getTime() // After current time
    );

    // M3 should wait for M2 to complete
    const m3 = result.schedule.find(s => s.matchId === 'M3');
    expect(m3).toBeDefined();
    expect(m3!.startTime.getTime()).toBeGreaterThanOrEqual(m2!.endTime.getTime());
  });

  test('should respect rest time from completed matches', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
      createTeam(3, 'Team C'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
      { id: 'M2', team1: teams[0], team2: teams[2], round: 1, duration: 30 }, // Team A plays again
    ];

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    const completedMatches: CompletedScheduledMatch[] = [
      {
        matchId: 'M1',
        courtId: 1,
        actualStartTime: new Date('2024-01-01T10:00:00Z'),
        actualEndTime: new Date('2024-01-01T10:30:00Z'),
        team1Id: teams[0].id,
        team2Id: teams[1].id,
      },
    ];

    const config: RescheduleConfig = {
      restTime: 15,
      currentTime: new Date('2024-01-01T10:35:00Z'),
      startTime: new Date('2024-01-01T10:00:00Z'),
      completedMatches,
    };

    const result = rescheduleMatches(matches, courts, config);

    const m2 = result.schedule.find(s => s.matchId === 'M2');
    expect(m2).toBeDefined();

    // Team A finished at 10:30, needs 15 min rest, so available at 10:45
    expect(m2!.startTime.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-01T10:45:00Z').getTime()
    );
  });

  test('should not schedule matches in the past', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')];

    const config: RescheduleConfig = {
      restTime: 0,
      currentTime: new Date('2024-01-01T11:00:00Z'), // Current time
      startTime: new Date('2024-01-01T09:00:00Z'),
      completedMatches: [],
    };

    const result = rescheduleMatches(matches, courts, config);

    const m1 = result.schedule.find(s => s.matchId === 'M1');
    expect(m1).toBeDefined();

    // Match should start at or after current time (not in the past)
    expect(m1!.startTime.getTime()).toBeGreaterThanOrEqual(
      config.currentTime.getTime()
    );
  });

  test('should handle multiple completed matches with cascading dependencies', () => {
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
        duration: 45,
        dependencies: ['M1', 'M2'],
      },
    ];

    const courts = [createCourt(1, 'Court 1')];

    // Both M1 and M2 completed
    const completedMatches: CompletedScheduledMatch[] = [
      {
        matchId: 'M1',
        courtId: 1,
        actualStartTime: new Date('2024-01-01T09:00:00Z'),
        actualEndTime: new Date('2024-01-01T09:30:00Z'),
        team1Id: teams[0].id,
        team2Id: teams[1].id,
      },
      {
        matchId: 'M2',
        courtId: 1,
        actualStartTime: new Date('2024-01-01T09:35:00Z'),
        actualEndTime: new Date('2024-01-01T10:10:00Z'), // 5 min longer
        team1Id: teams[2].id,
        team2Id: teams[3].id,
      },
    ];

    const config: RescheduleConfig = {
      restTime: 15,
      currentTime: new Date('2024-01-01T10:15:00Z'),
      startTime: new Date('2024-01-01T09:00:00Z'),
      completedMatches,
    };

    const result = rescheduleMatches(matches, courts, config);

    // Only M3 should be in the schedule (M1 and M2 are completed)
    expect(result.schedule).toHaveLength(1);
    expect(result.schedule[0].matchId).toBe('M3');

    // M3 should start after all dependencies and rest times
    const m3 = result.schedule[0];

    // Latest team finished at 10:10, needs 15 min rest = 10:25
    expect(m3.startTime.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-01T10:25:00Z').getTime()
    );
  });

  test('should handle court availability from completed matches', () => {
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

    const courts = [createCourt(1, 'Court 1')];

    // M1 finished on Court 1
    const completedMatches: CompletedScheduledMatch[] = [
      {
        matchId: 'M1',
        courtId: 1,
        actualStartTime: new Date('2024-01-01T10:00:00Z'),
        actualEndTime: new Date('2024-01-01T10:30:00Z'),
        team1Id: teams[0].id,
        team2Id: teams[1].id,
      },
    ];

    const config: RescheduleConfig = {
      restTime: 0,
      courtSetupTime: 5, // 5 min court setup time
      currentTime: new Date('2024-01-01T10:32:00Z'),
      startTime: new Date('2024-01-01T10:00:00Z'),
      completedMatches,
    };

    const result = rescheduleMatches(matches, courts, config);

    const m2 = result.schedule.find(s => s.matchId === 'M2');
    expect(m2).toBeDefined();

    // Court 1 available at 10:30 + 5 min setup = 10:35
    expect(m2!.startTime.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-01-01T10:35:00Z').getTime()
    );
  });

  test('should handle empty completed matches (reschedule everything)', () => {
    const teams = [
      createTeam(1, 'Team A'),
      createTeam(2, 'Team B'),
    ];

    const matches: Match[] = [
      { id: 'M1', team1: teams[0], team2: teams[1], round: 1, duration: 30 },
    ];

    const courts = [createCourt(1, 'Court 1')];

    const config: RescheduleConfig = {
      restTime: 15,
      currentTime: new Date('2024-01-01T09:00:00Z'),
      completedMatches: [], // No completed matches
    };

    const result = rescheduleMatches(matches, courts, config);

    expect(result.schedule).toHaveLength(1);
    expect(result.schedule[0].matchId).toBe('M1');
  });

  test('should reschedule realistic tournament scenario with delays', () => {
    const teams = Array.from({ length: 8 }, (_, i) => createTeam(i + 1, `Team ${String(i + 1)}`));

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

    const courts = [createCourt(1, 'Court 1'), createCourt(2, 'Court 2')];

    // QF1 and QF2 are completed (slightly different times than planned)
    const completedMatches: CompletedScheduledMatch[] = [
      {
        matchId: 'QF1',
        courtId: 1,
        actualStartTime: new Date('2024-06-15T09:00:00Z'),
        actualEndTime: new Date('2024-06-15T09:48:00Z'), // 3 min longer
        team1Id: teams[0].id,
        team2Id: teams[7].id,
      },
      {
        matchId: 'QF2',
        courtId: 2,
        actualStartTime: new Date('2024-06-15T09:00:00Z'),
        actualEndTime: new Date('2024-06-15T09:42:00Z'), // 3 min shorter
        team1Id: teams[1].id,
        team2Id: teams[6].id,
      },
    ];

    const config: RescheduleConfig = {
      restTime: 20,
      courtSetupTime: 5,
      currentTime: new Date('2024-06-15T09:50:00Z'),
      startTime: new Date('2024-06-15T09:00:00Z'),
      completedMatches,
    };

    const result = rescheduleMatches(matches, courts, config);

    // Should return 5 pending matches (QF3, QF4, SF1, SF2, FINAL)
    expect(result.schedule).toHaveLength(5);

    // Verify QF1 and QF2 are not in the schedule
    expect(result.schedule.find(s => s.matchId === 'QF1')).toBeUndefined();
    expect(result.schedule.find(s => s.matchId === 'QF2')).toBeUndefined();

    // SF1 should wait for both QF1 and QF2 + rest time
    const sf1 = result.schedule.find(s => s.matchId === 'SF1');
    expect(sf1).toBeDefined();

    // Latest QF ended at 09:48, + 20 min rest = 10:08
    expect(sf1!.startTime.getTime()).toBeGreaterThanOrEqual(
      new Date('2024-06-15T10:08:00Z').getTime()
    );
  });
});
