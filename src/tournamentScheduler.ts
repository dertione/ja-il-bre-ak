/**
 * RCPSP-based Tournament Scheduler for Beach Volleyball
 *
 * Implements a constraint-based scheduling algorithm that handles:
 * - Sequential dependencies (DAG)
 * - Resource constraints (team non-ubiquity)
 * - Rest time requirements (physiological buffer)
 */

/**
 * Represents a team in the tournament
 */
export interface Team {
  id: string | number;
  name: string;
  [key: string]: any;
}

/**
 * Represents a court/field available for matches
 */
export interface Court {
  id: string | number;
  name: string;
  [key: string]: any;
}

/**
 * Represents a match with dependencies
 */
export interface Match {
  id: string | number;
  team1: Team | string | number;  // Can be team object or placeholder like "Winner Match 1"
  team2: Team | string | number;
  round: number;                   // Round number (1, 2, 3, etc.) for priority
  duration: number;                // Expected duration in minutes
  dependencies?: (string | number)[];  // IDs of matches that must complete first
  [key: string]: any;
}

/**
 * Configuration for the scheduler
 */
export interface SchedulerConfig {
  restTime: number;           // Minimum rest time in minutes between matches for a team
  startTime?: Date;           // Tournament start time (defaults to now)
  courtSetupTime?: number;    // Time needed between matches on same court (default: 0)
}

/**
 * Represents a completed match with actual times (for live reschedule)
 */
export interface CompletedScheduledMatch {
  matchId: string | number;
  courtId: string | number;
  actualStartTime: Date;      // When match actually started
  actualEndTime: Date;        // When match actually ended
  team1Id: string | number;   // Actual team 1 (resolved from dependencies)
  team2Id: string | number;   // Actual team 2
}

/**
 * Configuration for live reschedule mode
 */
export interface RescheduleConfig extends SchedulerConfig {
  currentTime: Date;          // Current time in the tournament (matches before this are locked)
  completedMatches: CompletedScheduledMatch[];  // Matches already played with actual times
}

/**
 * Represents a scheduled match
 */
export interface ScheduledMatch {
  matchId: string | number;
  courtId: string | number;
  startTime: Date;
  endTime: Date;
  round: number;
}

/**
 * Result of the scheduling operation
 */
export interface ScheduleResult {
  schedule: ScheduledMatch[];
  summary: {
    totalMatches: number;
    totalDuration: number;  // in minutes
    courtsUsed: number;
    endTime: Date;
  };
}

/**
 * Internal state for tracking team availability
 */
interface TeamState {
  teamId: string | number;
  availableAt: Date;        // When the team becomes available (after rest)
  currentMatch: string | number | null;  // Match currently playing (null if free)
}

/**
 * Internal state for tracking court availability
 */
interface CourtState {
  courtId: string | number;
  availableAt: Date;        // When the court becomes available
  currentMatch: string | number | null;
}

/**
 * Match with tracking metadata
 */
interface MatchTask {
  match: Match;
  remainingDependencies: Set<string | number>;  // Dependencies not yet satisfied
  scheduledAt?: Date;
}

/**
 * Event in the simulation timeline
 */
interface Event {
  time: Date;
  type: 'MATCH_END';
  matchId: string | number;
  courtId: string | number;
  team1Id: string | number;
  team2Id: string | number;
}

/**
 * Extracts team IDs from a match, handling both direct teams and dependency placeholders
 */
function getTeamIds(match: Match): (string | number)[] {
  const teams: (string | number)[] = [];

  if (typeof match.team1 === 'object' && match.team1 !== null) {
    teams.push((match.team1 as Team).id);
  } else if (match.team1) {
    teams.push(match.team1);
  }

  if (typeof match.team2 === 'object' && match.team2 !== null) {
    teams.push((match.team2 as Team).id);
  } else if (match.team2) {
    teams.push(match.team2);
  }

  return teams;
}

/**
 * Checks if a team is available to play at a given time
 */
function isTeamAvailable(
  teamId: string | number,
  time: Date,
  teamStates: Map<string | number, TeamState>
): boolean {
  const state = teamStates.get(teamId);
  if (!state) {
    return true; // Team not yet tracked, so available
  }

  return state.currentMatch === null && state.availableAt <= time;
}

/**
 * Checks if all teams in a match are available
 */
function areTeamsAvailable(
  match: Match,
  time: Date,
  teamStates: Map<string | number, TeamState>
): boolean {
  const teamIds = getTeamIds(match);
  return teamIds.every(teamId => isTeamAvailable(teamId, time, teamStates));
}

/**
 * Finds the next available court at or after the given time
 */
function findAvailableCourt(
  time: Date,
  courtStates: CourtState[]
): { court: CourtState; availableAt: Date } | null {
  let earliestCourt: CourtState | null = null;
  let earliestTime = new Date(8640000000000000); // Max date

  for (const court of courtStates) {
    if (court.availableAt <= time && court.currentMatch === null) {
      return { court, availableAt: time };
    }

    if (court.availableAt < earliestTime) {
      earliestTime = court.availableAt;
      earliestCourt = court;
    }
  }

  if (earliestCourt) {
    return { court: earliestCourt, availableAt: earliestCourt.availableAt };
  }

  return null;
}

/**
 * Calculates when a match can start based on team availability
 */
function calculateEarliestStartTime(
  match: Match,
  currentTime: Date,
  teamStates: Map<string | number, TeamState>
): Date {
  const teamIds = getTeamIds(match);
  let earliestStart = currentTime;

  for (const teamId of teamIds) {
    const state = teamStates.get(teamId);
    if (state && state.availableAt > earliestStart) {
      earliestStart = state.availableAt;
    }
  }

  return earliestStart;
}

/**
 * Creates or updates team state
 */
function ensureTeamState(
  teamId: string | number,
  teamStates: Map<string | number, TeamState>,
  initialTime: Date
): TeamState {
  if (!teamStates.has(teamId)) {
    const state: TeamState = {
      teamId,
      availableAt: initialTime,
      currentMatch: null,
    };
    teamStates.set(teamId, state);
    return state;
  }
  return teamStates.get(teamId)!;
}

/**
 * Priority queue implementation for match tasks
 * Prioritizes by round number (lower rounds first), then by match ID
 */
class MatchQueue {
  private tasks: MatchTask[] = [];

  enqueue(task: MatchTask): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => {
      // Sort by round first (lower rounds have higher priority)
      if (a.match.round !== b.match.round) {
        return a.match.round - b.match.round;
      }
      // Then by match ID for consistency
      return String(a.match.id).localeCompare(String(b.match.id));
    });
  }

  dequeue(): MatchTask | undefined {
    return this.tasks.shift();
  }

  peek(): MatchTask | undefined {
    return this.tasks[0];
  }

  isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  size(): number {
    return this.tasks.length;
  }

  getAll(): MatchTask[] {
    return [...this.tasks];
  }

  remove(matchId: string | number): boolean {
    const index = this.tasks.findIndex(t => t.match.id === matchId);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      return true;
    }
    return false;
  }
}

/**
 * Main scheduling algorithm - schedules matches respecting all constraints
 *
 * @param matches - List of matches to schedule (with dependencies)
 * @param courts - List of available courts
 * @param config - Configuration (rest time, start time, etc.)
 * @returns Schedule with assigned times and courts for each match
 *
 * @example
 * ```typescript
 * const matches: Match[] = [
 *   { id: 'M1', team1: teamA, team2: teamB, round: 1, duration: 30 },
 *   { id: 'M2', team1: teamC, team2: teamD, round: 1, duration: 30 },
 *   { id: 'M3', team1: 'Winner M1', team2: 'Winner M2', round: 2, duration: 30, dependencies: ['M1', 'M2'] }
 * ];
 *
 * const courts: Court[] = [
 *   { id: 'C1', name: 'Court 1' },
 *   { id: 'C2', name: 'Court 2' }
 * ];
 *
 * const schedule = scheduleMatches(matches, courts, { restTime: 15 });
 * ```
 */
export function scheduleMatches(
  matches: Match[],
  courts: Court[],
  config: SchedulerConfig
): ScheduleResult {
  // Validation
  if (matches.length === 0) {
    throw new Error('No matches to schedule');
  }

  if (courts.length === 0) {
    throw new Error('No courts available');
  }

  const startTime = config.startTime || new Date();
  const restTime = config.restTime;
  const courtSetupTime = config.courtSetupTime || 0;

  // Initialize data structures
  const schedule: ScheduledMatch[] = [];
  const teamStates = new Map<string | number, TeamState>();
  const courtStates: CourtState[] = courts.map(court => ({
    courtId: court.id,
    availableAt: startTime,
    currentMatch: null,
  }));

  // Build dependency graph
  const matchMap = new Map<string | number, MatchTask>();
  const dependents = new Map<string | number, Set<string | number>>();

  for (const match of matches) {
    const deps = match.dependencies || [];
    matchMap.set(match.id, {
      match,
      remainingDependencies: new Set(deps),
    });

    // Build reverse mapping (match -> its dependents)
    for (const depId of deps) {
      if (!dependents.has(depId)) {
        dependents.set(depId, new Set());
      }
      dependents.get(depId)!.add(match.id);
    }
  }

  // Initialize queue with matches that have no dependencies
  const queue = new MatchQueue();
  for (const [matchId, task] of matchMap.entries()) {
    if (task.remainingDependencies.size === 0) {
      queue.enqueue(task);
    }
  }

  // Event queue for simulation
  const events: Event[] = [];
  let currentTime = new Date(startTime);

  // Main scheduling loop
  while (!queue.isEmpty() || events.length > 0) {
    // Process all events at current time
    while (events.length > 0 && events[0].time <= currentTime) {
      const event = events.shift()!;

      // Free up the court
      const court = courtStates.find(c => c.courtId === event.courtId);
      if (court) {
        court.currentMatch = null;
        court.availableAt = new Date(event.time.getTime() + courtSetupTime * 60000);
      }

      // Free up teams and set their rest time
      const restEndTime = new Date(event.time.getTime() + restTime * 60000);

      const team1State = ensureTeamState(event.team1Id, teamStates, startTime);
      team1State.currentMatch = null;
      team1State.availableAt = restEndTime;

      const team2State = ensureTeamState(event.team2Id, teamStates, startTime);
      team2State.currentMatch = null;
      team2State.availableAt = restEndTime;

      // Unlock dependent matches
      const deps = dependents.get(event.matchId) || new Set();
      for (const depMatchId of deps) {
        const depTask = matchMap.get(depMatchId);
        if (depTask) {
          depTask.remainingDependencies.delete(event.matchId);

          // If all dependencies satisfied, add to queue
          if (depTask.remainingDependencies.size === 0) {
            queue.enqueue(depTask);
          }
        }
      }
    }

    // Try to schedule matches from queue
    let scheduled = false;
    const queueSnapshot = queue.getAll();

    for (const task of queueSnapshot) {
      // Check if teams are available
      if (!areTeamsAvailable(task.match, currentTime, teamStates)) {
        continue;
      }

      // Find available court
      const courtResult = findAvailableCourt(currentTime, courtStates);
      if (!courtResult) {
        continue;
      }

      // Calculate actual start time (may be later than current time if teams need rest)
      const teamEarliestStart = calculateEarliestStartTime(task.match, currentTime, teamStates);
      const actualStartTime = new Date(Math.max(
        courtResult.availableAt.getTime(),
        teamEarliestStart.getTime()
      ));

      // If start time is in the future, skip for now
      if (actualStartTime > currentTime) {
        continue;
      }

      // Schedule the match!
      const endTime = new Date(actualStartTime.getTime() + task.match.duration * 60000);

      schedule.push({
        matchId: task.match.id,
        courtId: courtResult.court.courtId,
        startTime: actualStartTime,
        endTime,
        round: task.match.round,
      });

      // Update court state
      courtResult.court.currentMatch = task.match.id;
      courtResult.court.availableAt = endTime;

      // Update team states
      const teamIds = getTeamIds(task.match);
      for (const teamId of teamIds) {
        const teamState = ensureTeamState(teamId, teamStates, startTime);
        teamState.currentMatch = task.match.id;
        // Note: availableAt will be set when match ends
      }

      // Create end event
      events.push({
        time: endTime,
        type: 'MATCH_END',
        matchId: task.match.id,
        courtId: courtResult.court.courtId,
        team1Id: teamIds[0],
        team2Id: teamIds[1],
      });

      // Sort events by time
      events.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Remove from queue
      queue.remove(task.match.id);
      scheduled = true;
      break; // Start over to maintain priority order
    }

    // If nothing was scheduled, advance time to next event
    if (!scheduled) {
      if (events.length > 0) {
        currentTime = events[0].time;
      } else if (!queue.isEmpty()) {
        // No events but queue not empty - need to advance time
        // Find earliest time when any team or court becomes available
        let nextTime = new Date(8640000000000000); // Max date

        for (const state of teamStates.values()) {
          if (state.availableAt > currentTime && state.availableAt < nextTime) {
            nextTime = state.availableAt;
          }
        }

        for (const court of courtStates) {
          if (court.availableAt > currentTime && court.availableAt < nextTime) {
            nextTime = court.availableAt;
          }
        }

        if (nextTime.getTime() < 8640000000000000) {
          currentTime = nextTime;
        } else {
          // Should not happen if algorithm is correct
          throw new Error('Scheduling deadlock detected');
        }
      } else {
        break; // Done
      }
    }
  }

  // Verify all matches were scheduled
  if (schedule.length !== matches.length) {
    throw new Error(
      `Failed to schedule all matches. Scheduled: ${schedule.length}, Total: ${matches.length}. ` +
      `Possible circular dependency or invalid dependency reference.`
    );
  }

  // Calculate summary
  const endTime = schedule.reduce(
    (max, s) => s.endTime > max ? s.endTime : max,
    startTime
  );

  const totalDuration = (endTime.getTime() - startTime.getTime()) / 60000;
  const courtsUsedSet = new Set(schedule.map(s => s.courtId));

  return {
    schedule: schedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    summary: {
      totalMatches: schedule.length,
      totalDuration,
      courtsUsed: courtsUsedSet.size,
      endTime,
    },
  };
}

/**
 * Validates that the schedule respects all constraints
 * Useful for testing and debugging
 */
export function validateSchedule(
  schedule: ScheduledMatch[],
  matches: Match[],
  config: SchedulerConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const matchMap = new Map(matches.map(m => [m.id, m]));

  // Check 1: No team plays multiple matches simultaneously
  const teamOccupancy = new Map<string | number, { start: Date; end: Date; matchId: string | number }[]>();

  for (const scheduled of schedule) {
    const match = matchMap.get(scheduled.matchId);
    if (!match) continue;

    const teamIds = getTeamIds(match);
    for (const teamId of teamIds) {
      if (!teamOccupancy.has(teamId)) {
        teamOccupancy.set(teamId, []);
      }

      const occupancy = teamOccupancy.get(teamId)!;

      // Check for overlap
      for (const other of occupancy) {
        if (
          (scheduled.startTime >= other.start && scheduled.startTime < other.end) ||
          (scheduled.endTime > other.start && scheduled.endTime <= other.end) ||
          (scheduled.startTime <= other.start && scheduled.endTime >= other.end)
        ) {
          errors.push(
            `Team ${teamId} plays multiple matches simultaneously: ` +
            `${scheduled.matchId} and ${other.matchId}`
          );
        }
      }

      occupancy.push({
        start: scheduled.startTime,
        end: scheduled.endTime,
        matchId: scheduled.matchId,
      });
    }
  }

  // Check 2: Rest time between matches for each team
  for (const [teamId, occupancy] of teamOccupancy.entries()) {
    const sorted = occupancy.sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const restTimeMinutes = (curr.start.getTime() - prev.end.getTime()) / 60000;

      if (restTimeMinutes < config.restTime) {
        errors.push(
          `Team ${teamId} has insufficient rest between matches ${prev.matchId} and ${curr.matchId}: ` +
          `${restTimeMinutes.toFixed(1)} minutes < ${config.restTime} minutes required`
        );
      }
    }
  }

  // Check 3: Dependencies are respected
  const scheduleMap = new Map(schedule.map(s => [s.matchId, s]));

  for (const match of matches) {
    const scheduled = scheduleMap.get(match.id);
    if (!scheduled) continue;

    const deps = match.dependencies || [];
    for (const depId of deps) {
      const depScheduled = scheduleMap.get(depId);
      if (!depScheduled) {
        errors.push(`Match ${match.id} depends on ${depId} which is not scheduled`);
        continue;
      }

      if (scheduled.startTime < depScheduled.endTime) {
        errors.push(
          `Match ${match.id} starts before its dependency ${depId} ends: ` +
          `${scheduled.startTime.toISOString()} < ${depScheduled.endTime.toISOString()}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Live reschedule mode - Reschedules pending matches based on completed ones
 *
 * This function handles real-time rescheduling during an ongoing tournament.
 * It "paints" the timeline with completed matches and only reschedules pending ones.
 *
 * @param matches - All matches (both completed and pending)
 * @param courts - Available courts
 * @param config - Reschedule configuration with current time and completed matches
 * @returns Schedule with only future matches (past matches are excluded)
 *
 * @example
 * ```typescript
 * const result = rescheduleMatches(allMatches, courts, {
 *   restTime: 15,
 *   currentTime: new Date('2024-06-15T10:30:00Z'),
 *   completedMatches: [
 *     {
 *       matchId: 'M1',
 *       courtId: 1,
 *       actualStartTime: new Date('2024-06-15T09:00:00Z'),
 *       actualEndTime: new Date('2024-06-15T09:47:00Z'),  // 2 min longer than planned
 *       team1Id: 'TeamA',
 *       team2Id: 'TeamB'
 *     }
 *   ]
 * });
 *
 * // Result contains only pending matches, rescheduled from current time
 * ```
 */
export function rescheduleMatches(
  matches: Match[],
  courts: Court[],
  config: RescheduleConfig
): ScheduleResult {
  // Validation
  if (matches.length === 0) {
    throw new Error('No matches to schedule');
  }

  if (courts.length === 0) {
    throw new Error('No courts available');
  }

  const currentTime = config.currentTime;
  const completedMatchIds = new Set(config.completedMatches.map(m => m.matchId));
  const restTime = config.restTime;
  const courtSetupTime = config.courtSetupTime || 0;

  // Separate completed and pending matches
  const pendingMatches = matches.filter(m => !completedMatchIds.has(m.id));
  const completedMatchMap = new Map(config.completedMatches.map(m => [m.matchId, m]));

  // Initialize schedule with completed matches (for validation purposes)
  const schedule: ScheduledMatch[] = [];

  // Add completed matches to schedule
  for (const completed of config.completedMatches) {
    schedule.push({
      matchId: completed.matchId,
      courtId: completed.courtId,
      startTime: completed.actualStartTime,
      endTime: completed.actualEndTime,
      round: matches.find(m => m.id === completed.matchId)?.round || 0,
    });
  }

  // Paint timeline with completed matches - initialize team and court states
  const teamStates = new Map<string | number, TeamState>();
  const courtStates: CourtState[] = courts.map(court => ({
    courtId: court.id,
    availableAt: config.startTime || currentTime,
    currentMatch: null,
  }));

  // Process completed matches to set resource availability
  for (const completed of config.completedMatches) {
    // Update court availability
    const court = courtStates.find(c => c.courtId === completed.courtId);
    if (court) {
      const courtAvailableAt = new Date(
        completed.actualEndTime.getTime() + courtSetupTime * 60000
      );
      if (courtAvailableAt > court.availableAt) {
        court.availableAt = courtAvailableAt;
      }
    }

    // Update team availability (with rest time)
    const team1RestEnd = new Date(completed.actualEndTime.getTime() + restTime * 60000);
    const team2RestEnd = new Date(completed.actualEndTime.getTime() + restTime * 60000);

    const team1State = ensureTeamState(completed.team1Id, teamStates, currentTime);
    if (team1RestEnd > team1State.availableAt) {
      team1State.availableAt = team1RestEnd;
    }

    const team2State = ensureTeamState(completed.team2Id, teamStates, currentTime);
    if (team2RestEnd > team2State.availableAt) {
      team2State.availableAt = team2RestEnd;
    }
  }

  // Build dependency graph for pending matches
  const matchMap = new Map<string | number, MatchTask>();
  const dependents = new Map<string | number, Set<string | number>>();

  for (const match of pendingMatches) {
    const deps = match.dependencies || [];
    matchMap.set(match.id, {
      match,
      remainingDependencies: new Set(deps),
    });

    // Build reverse mapping
    for (const depId of deps) {
      if (!dependents.has(depId)) {
        dependents.set(depId, new Set());
      }
      dependents.get(depId)!.add(match.id);
    }
  }

  // Initialize queue with matches whose dependencies are satisfied
  // (either no dependencies, or all dependencies are in completed matches)
  const queue = new MatchQueue();
  for (const [matchId, task] of matchMap.entries()) {
    // Check if all dependencies are satisfied (completed)
    let allDepsSatisfied = true;
    for (const depId of task.remainingDependencies) {
      if (!completedMatchIds.has(depId)) {
        allDepsSatisfied = false;
        break;
      }
    }

    if (allDepsSatisfied) {
      task.remainingDependencies.clear();
      queue.enqueue(task);
    }
  }

  // Event queue for simulation
  const events: Event[] = [];
  let simTime = new Date(currentTime);

  // Main scheduling loop (similar to original but starting from current time)
  while (!queue.isEmpty() || events.length > 0) {
    // Process all events at current simulation time
    while (events.length > 0 && events[0].time <= simTime) {
      const event = events.shift()!;

      // Free up the court
      const court = courtStates.find(c => c.courtId === event.courtId);
      if (court) {
        court.currentMatch = null;
        court.availableAt = new Date(event.time.getTime() + courtSetupTime * 60000);
      }

      // Free up teams and set their rest time
      const restEndTime = new Date(event.time.getTime() + restTime * 60000);

      const team1State = ensureTeamState(event.team1Id, teamStates, currentTime);
      team1State.currentMatch = null;
      team1State.availableAt = restEndTime;

      const team2State = ensureTeamState(event.team2Id, teamStates, currentTime);
      team2State.currentMatch = null;
      team2State.availableAt = restEndTime;

      // Unlock dependent matches
      const deps = dependents.get(event.matchId) || new Set();
      for (const depMatchId of deps) {
        const depTask = matchMap.get(depMatchId);
        if (depTask) {
          depTask.remainingDependencies.delete(event.matchId);

          // If all dependencies satisfied, add to queue
          if (depTask.remainingDependencies.size === 0) {
            queue.enqueue(depTask);
          }
        }
      }
    }

    // Try to schedule matches from queue
    let scheduled = false;
    const queueSnapshot = queue.getAll();

    for (const task of queueSnapshot) {
      // Check if teams are available
      if (!areTeamsAvailable(task.match, simTime, teamStates)) {
        continue;
      }

      // Find available court
      const courtResult = findAvailableCourt(simTime, courtStates);
      if (!courtResult) {
        continue;
      }

      // Calculate actual start time (respecting current time constraint)
      const teamEarliestStart = calculateEarliestStartTime(task.match, simTime, teamStates);
      const actualStartTime = new Date(Math.max(
        courtResult.availableAt.getTime(),
        teamEarliestStart.getTime(),
        currentTime.getTime()  // CRITICAL: Cannot schedule in the past
      ));

      // If start time is in the future relative to sim time, skip for now
      if (actualStartTime > simTime) {
        continue;
      }

      // Schedule the match!
      const endTime = new Date(actualStartTime.getTime() + task.match.duration * 60000);

      schedule.push({
        matchId: task.match.id,
        courtId: courtResult.court.courtId,
        startTime: actualStartTime,
        endTime,
        round: task.match.round,
      });

      // Update court state
      courtResult.court.currentMatch = task.match.id;
      courtResult.court.availableAt = endTime;

      // Update team states
      const teamIds = getTeamIds(task.match);
      for (const teamId of teamIds) {
        const teamState = ensureTeamState(teamId, teamStates, currentTime);
        teamState.currentMatch = task.match.id;
      }

      // Create end event
      events.push({
        time: endTime,
        type: 'MATCH_END',
        matchId: task.match.id,
        courtId: courtResult.court.courtId,
        team1Id: teamIds[0],
        team2Id: teamIds[1],
      });

      // Sort events by time
      events.sort((a, b) => a.time.getTime() - b.time.getTime());

      // Remove from queue
      queue.remove(task.match.id);
      scheduled = true;
      break; // Start over to maintain priority order
    }

    // If nothing was scheduled, advance time to next event
    if (!scheduled) {
      if (events.length > 0) {
        simTime = events[0].time;
      } else if (!queue.isEmpty()) {
        // No events but queue not empty - need to advance time
        let nextTime = new Date(8640000000000000); // Max date

        for (const state of teamStates.values()) {
          if (state.availableAt > simTime && state.availableAt < nextTime) {
            nextTime = state.availableAt;
          }
        }

        for (const court of courtStates) {
          if (court.availableAt > simTime && court.availableAt < nextTime) {
            nextTime = court.availableAt;
          }
        }

        // Also consider current time as minimum
        if (currentTime > simTime && currentTime < nextTime) {
          nextTime = currentTime;
        }

        if (nextTime.getTime() < 8640000000000000) {
          simTime = nextTime;
        } else {
          throw new Error('Scheduling deadlock detected in reschedule mode');
        }
      } else {
        break; // Done
      }
    }
  }

  // Verify all pending matches were scheduled
  const scheduledPendingCount = schedule.filter(s => !completedMatchIds.has(s.matchId)).length;
  if (scheduledPendingCount !== pendingMatches.length) {
    throw new Error(
      `Failed to reschedule all pending matches. ` +
      `Scheduled: ${scheduledPendingCount}, Pending: ${pendingMatches.length}`
    );
  }

  // Filter to return only future matches (exclude completed)
  const futureSchedule = schedule.filter(s => !completedMatchIds.has(s.matchId));

  // Calculate summary
  const endTime = schedule.reduce(
    (max, s) => s.endTime > max ? s.endTime : max,
    currentTime
  );

  const totalDuration = (endTime.getTime() - (config.startTime || currentTime).getTime()) / 60000;
  const courtsUsedSet = new Set(futureSchedule.map(s => s.courtId));

  return {
    schedule: futureSchedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    summary: {
      totalMatches: futureSchedule.length,
      totalDuration,
      courtsUsed: courtsUsedSet.size,
      endTime,
    },
  };
}
