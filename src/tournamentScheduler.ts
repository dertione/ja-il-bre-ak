/**
 * RCPSP-based Tournament Scheduler for Beach Volleyball
 *
 * Implements a constraint-based scheduling algorithm that handles:
 * - Sequential dependencies (DAG with cycle detection)
 * - Resource constraints (team non-ubiquity, court exclusivity)
 * - Rest time requirements (physiological buffer)
 * - Court setup time between matches
 * - Live reschedule mode for ongoing tournaments
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
  availableAt: Date;        // When the court becomes available (after setup)
  currentMatch: string | number | null;
}

/**
 * Match with tracking metadata
 */
interface MatchTask {
  match: Match;
  remainingDependencies: Set<string | number>;  // Dependencies not yet satisfied
}

/**
 * Event in the simulation timeline
 */
interface Event {
  time: Date;
  type: 'MATCH_END';
  matchId: string | number;
  courtId: string | number;
  teamIds: (string | number)[];
}

// ─────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────

/**
 * Extracts team IDs from a match, handling both direct teams and dependency placeholders
 */
function getTeamIds(match: Match): (string | number)[] {
  const teams: (string | number)[] = [];

  if (typeof match.team1 === 'object' && match.team1 !== null) {
    teams.push((match.team1 as Team).id);
  } else if (match.team1 !== undefined && match.team1 !== null) {
    teams.push(match.team1);
  }

  if (typeof match.team2 === 'object' && match.team2 !== null) {
    teams.push((match.team2 as Team).id);
  } else if (match.team2 !== undefined && match.team2 !== null) {
    teams.push(match.team2);
  }

  return teams;
}

/**
 * Calculates when a match can earliest start based on all resource constraints
 * Returns the earliest Date when both teams and at least one court are free.
 */
function calculateEarliestStart(
  match: Match,
  baseTime: Date,
  teamStates: Map<string | number, TeamState>,
  courtStates: CourtState[],
): { startTime: Date; court: CourtState } | null {
  const teamIds = getTeamIds(match);

  // 1. Calculate earliest team availability
  let teamEarliest = baseTime;
  for (const teamId of teamIds) {
    const state = teamStates.get(teamId);
    if (!state) continue;
    // Team must not be in a current match
    if (state.currentMatch !== null) return null;
    if (state.availableAt > teamEarliest) {
      teamEarliest = state.availableAt;
    }
  }

  // 2. Find the best court: free at or before teamEarliest, with no currentMatch
  let bestCourt: CourtState | null = null;
  let bestStartTime = new Date(8640000000000000);

  for (const court of courtStates) {
    if (court.currentMatch !== null) continue; // Court is occupied — skip
    // The actual start is max(teamEarliest, court.availableAt)
    const courtStart = court.availableAt > teamEarliest ? court.availableAt : teamEarliest;
    if (courtStart < bestStartTime) {
      bestStartTime = courtStart;
      bestCourt = court;
    }
  }

  if (!bestCourt) return null;

  return { startTime: bestStartTime, court: bestCourt };
}

/**
 * Creates or gets team state
 */
function ensureTeamState(
  teamId: string | number,
  teamStates: Map<string | number, TeamState>,
  initialTime: Date
): TeamState {
  let state = teamStates.get(teamId);
  if (!state) {
    state = {
      teamId,
      availableAt: initialTime,
      currentMatch: null,
    };
    teamStates.set(teamId, state);
  }
  return state;
}

/**
 * Detects cycles in the dependency DAG using DFS.
 * Throws an error with a clear message if a cycle is found.
 */
function detectCycles(matchMap: Map<string | number, MatchTask>): void {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string | number, number>();

  for (const id of matchMap.keys()) {
    color.set(id, WHITE);
  }

  function dfs(id: string | number, path: (string | number)[]): void {
    color.set(id, GRAY);
    const task = matchMap.get(id);
    if (!task) return;

    for (const depId of task.match.dependencies || []) {
      const depColor = color.get(depId);
      if (depColor === undefined) continue; // dependency outside of match set (invalid ref)
      if (depColor === GRAY) {
        const cycleStart = path.indexOf(depId);
        const cycle = [...path.slice(cycleStart), depId];
        throw new Error(
          `Circular dependency detected: ${cycle.join(' → ')}`
        );
      }
      if (depColor === WHITE) {
        dfs(depId, [...path, depId]);
      }
    }

    color.set(id, BLACK);
  }

  for (const id of matchMap.keys()) {
    if (color.get(id) === WHITE) {
      dfs(id, [id]);
    }
  }
}

/**
 * Validates inputs common to both schedule and reschedule
 */
function validateInputs(matches: Match[], courts: Court[], config: SchedulerConfig): void {
  if (matches.length === 0) {
    throw new Error('No matches to schedule');
  }

  if (courts.length === 0) {
    throw new Error('No courts available');
  }

  if (config.restTime < 0) {
    throw new Error('restTime must be >= 0');
  }

  if (config.courtSetupTime !== undefined && config.courtSetupTime < 0) {
    throw new Error('courtSetupTime must be >= 0');
  }

  // Check for duplicate match IDs
  const ids = new Set<string | number>();
  for (const match of matches) {
    if (ids.has(match.id)) {
      throw new Error(`Duplicate match ID: ${match.id}`);
    }
    ids.add(match.id);
  }

  // Validate match durations
  for (const match of matches) {
    if (match.duration <= 0) {
      throw new Error(`Match ${match.id} has invalid duration: ${match.duration}`);
    }
  }
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
      if (a.match.round !== b.match.round) {
        return a.match.round - b.match.round;
      }
      return String(a.match.id).localeCompare(String(b.match.id));
    });
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

// ─────────────────────────────────────────────────────────────
// Core scheduling engine (shared between schedule and reschedule)
// ─────────────────────────────────────────────────────────────

interface SchedulerContext {
  queue: MatchQueue;
  events: Event[];
  schedule: ScheduledMatch[];
  teamStates: Map<string | number, TeamState>;
  courtStates: CourtState[];
  dependents: Map<string | number, Set<string | number>>;
  matchMap: Map<string | number, MatchTask>;
  restTime: number;
  courtSetupTime: number;
  initialTime: Date;        // Start time for ensureTeamState
  minStartTime: Date;       // Floor for scheduling (= startTime in normal, = currentTime in reschedule)
}

/**
 * Core event-driven scheduling loop.
 * Shared between scheduleMatches and rescheduleMatches.
 */
function runSchedulingLoop(ctx: SchedulerContext): void {
  let currentTime = new Date(ctx.minStartTime);
  let iterations = 0;
  const maxIterations = ctx.queue.size() * ctx.courtStates.length * 1000 + 10000;

  while (!ctx.queue.isEmpty() || ctx.events.length > 0) {
    iterations++;
    if (iterations > maxIterations) {
      throw new Error(
        `Scheduling exceeded maximum iterations (${maxIterations}). ` +
        `Remaining in queue: ${ctx.queue.size()}, events: ${ctx.events.length}`
      );
    }

    // 1. Process all events at or before currentTime
    while (ctx.events.length > 0 && ctx.events[0].time <= currentTime) {
      const event = ctx.events.shift()!;

      // Free up the court
      const court = ctx.courtStates.find(c => c.courtId === event.courtId);
      if (court) {
        court.currentMatch = null;
        court.availableAt = new Date(event.time.getTime() + ctx.courtSetupTime * 60000);
      }

      // Free up teams and set their rest time
      const restEndTime = new Date(event.time.getTime() + ctx.restTime * 60000);
      for (const teamId of event.teamIds) {
        const teamState = ensureTeamState(teamId, ctx.teamStates, ctx.initialTime);
        teamState.currentMatch = null;
        teamState.availableAt = restEndTime;
      }

      // Unlock dependent matches
      const deps = ctx.dependents.get(event.matchId) || new Set();
      for (const depMatchId of deps) {
        const depTask = ctx.matchMap.get(depMatchId);
        if (depTask) {
          depTask.remainingDependencies.delete(event.matchId);
          if (depTask.remainingDependencies.size === 0) {
            ctx.queue.enqueue(depTask);
          }
        }
      }
    }

    // 2. Try to schedule as many matches as possible at currentTime
    //    Loop until no more matches can be scheduled at this tick
    let scheduledAny = false;
    let scheduledThisPass = true;

    while (scheduledThisPass) {
      scheduledThisPass = false;
      const queueSnapshot = ctx.queue.getAll();

      for (const task of queueSnapshot) {
        const result = calculateEarliestStart(
          task.match,
          currentTime,
          ctx.teamStates,
          ctx.courtStates
        );

        if (!result) continue;

        // Ensure we don't schedule before the minimum allowed time
        const actualStart = result.startTime < ctx.minStartTime
          ? ctx.minStartTime
          : result.startTime;

        // Only schedule if the match can start right now (at currentTime)
        if (actualStart > currentTime) continue;

        // Schedule the match
        const endTime = new Date(actualStart.getTime() + task.match.duration * 60000);
        const teamIds = getTeamIds(task.match);

        ctx.schedule.push({
          matchId: task.match.id,
          courtId: result.court.courtId,
          startTime: actualStart,
          endTime,
          round: task.match.round,
        });

        // Update court state
        result.court.currentMatch = task.match.id;
        result.court.availableAt = endTime;

        // Update team states
        for (const teamId of teamIds) {
          const teamState = ensureTeamState(teamId, ctx.teamStates, ctx.initialTime);
          teamState.currentMatch = task.match.id;
        }

        // Create end event
        ctx.events.push({
          time: endTime,
          type: 'MATCH_END',
          matchId: task.match.id,
          courtId: result.court.courtId,
          teamIds,
        });

        // Keep events sorted by time
        ctx.events.sort((a, b) => a.time.getTime() - b.time.getTime());

        // Remove from queue
        ctx.queue.remove(task.match.id);
        scheduledThisPass = true;
        scheduledAny = true;
        break; // Restart from highest priority after each scheduling
      }
    }

    // 3. If nothing was scheduled, advance time
    if (!scheduledAny) {
      if (ctx.events.length > 0) {
        currentTime = ctx.events[0].time;
      } else if (!ctx.queue.isEmpty()) {
        // No events but queue not empty — advance to earliest resource availability
        let nextTime = new Date(8640000000000000);

        for (const state of ctx.teamStates.values()) {
          if (state.availableAt > currentTime && state.availableAt < nextTime) {
            nextTime = state.availableAt;
          }
        }

        for (const court of ctx.courtStates) {
          if (court.availableAt > currentTime && court.availableAt < nextTime) {
            nextTime = court.availableAt;
          }
        }

        if (ctx.minStartTime > currentTime && ctx.minStartTime < nextTime) {
          nextTime = ctx.minStartTime;
        }

        if (nextTime.getTime() < 8640000000000000) {
          currentTime = nextTime;
        } else {
          const remaining = ctx.queue.getAll().map(t => t.match.id);
          throw new Error(
            `Scheduling deadlock detected. ` +
            `Unable to schedule matches: [${remaining.join(', ')}]. ` +
            `Check for circular dependencies or invalid dependency references.`
          );
        }
      } else {
        break; // Done
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

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
  validateInputs(matches, courts, config);

  const startTime = config.startTime || new Date();
  const restTime = config.restTime;
  const courtSetupTime = config.courtSetupTime || 0;

  // Build dependency graph and detect cycles
  const matchMap = new Map<string | number, MatchTask>();
  const dependents = new Map<string | number, Set<string | number>>();

  for (const match of matches) {
    const deps = match.dependencies || [];
    matchMap.set(match.id, {
      match,
      remainingDependencies: new Set(deps),
    });

    for (const depId of deps) {
      if (!dependents.has(depId)) {
        dependents.set(depId, new Set());
      }
      dependents.get(depId)!.add(match.id);
    }
  }

  // Detect circular dependencies upfront
  detectCycles(matchMap);

  // Validate dependency references
  for (const match of matches) {
    for (const depId of match.dependencies || []) {
      if (!matchMap.has(depId)) {
        throw new Error(
          `Match ${match.id} depends on ${depId} which does not exist in the match list`
        );
      }
    }
  }

  // Initialize state
  const teamStates = new Map<string | number, TeamState>();
  const courtStates: CourtState[] = courts.map(court => ({
    courtId: court.id,
    availableAt: startTime,
    currentMatch: null,
  }));

  // Initialize queue with matches that have no dependencies
  const queue = new MatchQueue();
  for (const [, task] of matchMap.entries()) {
    if (task.remainingDependencies.size === 0) {
      queue.enqueue(task);
    }
  }

  // Run the scheduling loop
  const schedule: ScheduledMatch[] = [];
  const ctx: SchedulerContext = {
    queue,
    events: [],
    schedule,
    teamStates,
    courtStates,
    dependents,
    matchMap,
    restTime,
    courtSetupTime,
    initialTime: startTime,
    minStartTime: startTime,
  };

  runSchedulingLoop(ctx);

  // Verify all matches were scheduled
  if (schedule.length !== matches.length) {
    const scheduledIds = new Set(schedule.map(s => s.matchId));
    const unscheduled = matches.filter(m => !scheduledIds.has(m.id)).map(m => m.id);
    throw new Error(
      `Failed to schedule all matches. Scheduled: ${schedule.length}, Total: ${matches.length}. ` +
      `Unscheduled: [${unscheduled.join(', ')}]. ` +
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

      if (restTimeMinutes < config.restTime - 0.001) { // Tolerance for floating point
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

  // Check 4: No court double-booking
  const courtOccupancy = new Map<string | number, { start: Date; end: Date; matchId: string | number }[]>();

  for (const scheduled of schedule) {
    if (!courtOccupancy.has(scheduled.courtId)) {
      courtOccupancy.set(scheduled.courtId, []);
    }

    const occupancy = courtOccupancy.get(scheduled.courtId)!;

    for (const other of occupancy) {
      if (
        (scheduled.startTime >= other.start && scheduled.startTime < other.end) ||
        (scheduled.endTime > other.start && scheduled.endTime <= other.end) ||
        (scheduled.startTime <= other.start && scheduled.endTime >= other.end)
      ) {
        errors.push(
          `Court ${scheduled.courtId} has overlapping matches: ` +
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

  // Check 5: Court setup time respected
  const setupTime = config.courtSetupTime || 0;
  if (setupTime > 0) {
    for (const [courtId, occupancy] of courtOccupancy.entries()) {
      const sorted = occupancy.sort((a, b) => a.start.getTime() - b.start.getTime());

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const gap = (curr.start.getTime() - prev.end.getTime()) / 60000;

        if (gap < setupTime - 0.001) { // Tolerance for floating point
          errors.push(
            `Court ${courtId} has insufficient setup time between matches ${prev.matchId} and ${curr.matchId}: ` +
            `${gap.toFixed(1)} minutes < ${setupTime} minutes required`
          );
        }
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
 *       actualEndTime: new Date('2024-06-15T09:47:00Z'),
 *       team1Id: 'TeamA',
 *       team2Id: 'TeamB'
 *     }
 *   ]
 * });
 * ```
 */
export function rescheduleMatches(
  matches: Match[],
  courts: Court[],
  config: RescheduleConfig
): ScheduleResult {
  // Validation
  validateInputs(matches, courts, config);

  const currentTime = config.currentTime;
  const completedMatchIds = new Set(config.completedMatches.map(m => m.matchId));
  const restTime = config.restTime;
  const courtSetupTime = config.courtSetupTime || 0;

  // Determine the earliest known time for initialization
  const earliestTime = config.startTime || (
    config.completedMatches.length > 0
      ? new Date(Math.min(...config.completedMatches.map(m => m.actualStartTime.getTime())))
      : currentTime
  );

  // Separate completed and pending matches
  const pendingMatches = matches.filter(m => !completedMatchIds.has(m.id));

  // Initialize team and court states from completed matches
  const teamStates = new Map<string | number, TeamState>();
  const courtStates: CourtState[] = courts.map(court => ({
    courtId: court.id,
    availableAt: earliestTime,
    currentMatch: null,
  }));

  // Paint timeline: process completed matches to set resource availability
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
    const restEnd = new Date(completed.actualEndTime.getTime() + restTime * 60000);

    const team1State = ensureTeamState(completed.team1Id, teamStates, earliestTime);
    if (restEnd > team1State.availableAt) {
      team1State.availableAt = restEnd;
    }

    const team2State = ensureTeamState(completed.team2Id, teamStates, earliestTime);
    if (restEnd > team2State.availableAt) {
      team2State.availableAt = restEnd;
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

    for (const depId of deps) {
      if (!dependents.has(depId)) {
        dependents.set(depId, new Set());
      }
      dependents.get(depId)!.add(match.id);
    }
  }

  // Detect cycles in pending matches
  detectCycles(matchMap);

  // Resolve completed dependencies and initialize queue
  const queue = new MatchQueue();
  for (const [, task] of matchMap.entries()) {
    // Remove completed dependencies
    for (const depId of [...task.remainingDependencies]) {
      if (completedMatchIds.has(depId)) {
        task.remainingDependencies.delete(depId);
      }
    }

    if (task.remainingDependencies.size === 0) {
      queue.enqueue(task);
    }
  }

  // Run the scheduling loop
  const schedule: ScheduledMatch[] = [];
  const ctx: SchedulerContext = {
    queue,
    events: [],
    schedule,
    teamStates,
    courtStates,
    dependents,
    matchMap,
    restTime,
    courtSetupTime,
    initialTime: earliestTime,
    minStartTime: currentTime,  // Cannot schedule in the past
  };

  runSchedulingLoop(ctx);

  // Verify all pending matches were scheduled
  if (schedule.length !== pendingMatches.length) {
    const scheduledIds = new Set(schedule.map(s => s.matchId));
    const unscheduled = pendingMatches.filter(m => !scheduledIds.has(m.id)).map(m => m.id);
    throw new Error(
      `Failed to reschedule all pending matches. ` +
      `Scheduled: ${schedule.length}, Pending: ${pendingMatches.length}. ` +
      `Unscheduled: [${unscheduled.join(', ')}]`
    );
  }

  // Calculate summary
  const allEndTimes = [
    ...schedule.map(s => s.endTime),
    ...config.completedMatches.map(m => m.actualEndTime),
  ];
  const endTime = allEndTimes.reduce(
    (max, t) => t > max ? t : max,
    currentTime
  );

  const totalDuration = (endTime.getTime() - earliestTime.getTime()) / 60000;
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
