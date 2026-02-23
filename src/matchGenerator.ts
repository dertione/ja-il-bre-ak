/**
 * Tournament Match Generator
 *
 * Generates match objects for different tournament formats:
 * - Round-robin (classic pool play)
 * - Brazilian (4-team bracket pools)
 * - Knockout brackets (4 or 8 teams)
 *
 * All generated matches conform to the scheduler's Match interface.
 */

import { Pool, PoolTemplate, Team } from './poolDistribution';
import { Match } from './tournamentScheduler';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Match format configuration (per phase).
 */
export interface MatchFormatConfig {
  setsToWin: 1 | 2;
  pointsPerSet: 15 | 21 | 25;
  decidingSetPoints?: 15;
}

/**
 * Phase identifier for tournament progression.
 */
export type PhaseType =
  | 'qualification-pool'
  | 'qualification-transition'
  | 'main-draw-pool'
  | 'main-draw-transition'
  | 'knockout';

/**
 * A generated match ready for scheduling.
 * Extends the scheduler's Match interface with tournament metadata.
 */
export interface TournamentMatch extends Match {
  phase: PhaseType;
  poolId?: string;
  metadata?: {
    rankOutput?: number;
    description?: string;
    knockoutStage?: 'QF' | 'SF' | 'small-final' | 'final';
  };
}

// ─────────────────────────────────────────────────────────────
// Duration estimation
// ─────────────────────────────────────────────────────────────

const MINUTES_PER_SET: Record<number, number> = { 15: 15, 21: 20, 25: 25 };

/**
 * Estimates match duration in minutes based on format.
 *
 * Heuristic: 15-point set ~ 15min, 21-point ~ 20min, 25-point ~ 25min.
 * Best-of-3: average 2.5 sets.
 */
export function estimateMatchDuration(format: MatchFormatConfig): number {
  const setDuration = MINUTES_PER_SET[format.pointsPerSet] ?? 20;

  if (format.setsToWin === 1) {
    return setDuration;
  }
  // best-of-3: average 2.5 sets
  return Math.round(setDuration * 2.5);
}

// ─────────────────────────────────────────────────────────────
// Round-robin generation (circle method)
// ─────────────────────────────────────────────────────────────

/**
 * Generates round-robin sub-rounds using the circle (rotation) method.
 * Returns array of rounds, each containing match pairings.
 */
function generateCircleMethodRounds(teams: Team[]): Array<[Team, Team][]> {
  const n = teams.length;
  const teamsCopy = [...teams];

  // If odd number of teams, add a bye placeholder
  const hasBye = n % 2 !== 0;
  if (hasBye) {
    teamsCopy.push({ id: '__BYE__', name: 'BYE', seed: -1 });
  }

  const numTeams = teamsCopy.length;
  const numRounds = numTeams - 1;
  const rounds: Array<[Team, Team][]> = [];

  // Fix first team, rotate the rest
  const fixed = teamsCopy[0];
  const rotating = teamsCopy.slice(1);

  for (let r = 0; r < numRounds; r++) {
    const roundMatches: [Team, Team][] = [];

    // First pair: fixed vs last rotating element
    const opponent = rotating[rotating.length - 1];
    if (fixed.id !== '__BYE__' && opponent.id !== '__BYE__') {
      roundMatches.push([fixed, opponent]);
    }

    // Remaining pairs
    for (let i = 0; i < Math.floor((numTeams - 2) / 2); i++) {
      const t1 = rotating[i];
      const t2 = rotating[rotating.length - 2 - i];
      if (t1.id !== '__BYE__' && t2.id !== '__BYE__') {
        roundMatches.push([t1, t2]);
      }
    }

    rounds.push(roundMatches);

    // Rotate: move last element to front
    rotating.unshift(rotating.pop()!);
  }

  return rounds;
}

/**
 * Generates all round-robin matches for a pool (classic format).
 *
 * @param pool - Pool with teams
 * @param format - Match format configuration
 * @param phasePrefix - Phase prefix for match IDs ('Q' or 'MD')
 * @returns Array of TournamentMatch objects
 */
export function generateRoundRobinMatches(
  pool: Pool,
  format: MatchFormatConfig,
  phasePrefix: 'Q' | 'MD'
): TournamentMatch[] {
  const duration = estimateMatchDuration(format);
  const rounds = generateCircleMethodRounds(pool.teams);
  const phase: PhaseType = phasePrefix === 'Q' ? 'qualification-pool' : 'main-draw-pool';

  const matches: TournamentMatch[] = [];
  let matchNum = 0;

  for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
    for (const [t1, t2] of rounds[roundIdx]) {
      matchNum++;
      matches.push({
        id: `${phasePrefix}-P${pool.poolId}-M${matchNum}`,
        team1: t1,
        team2: t2,
        round: roundIdx + 1,
        duration,
        phase,
        poolId: pool.poolId,
      });
    }
  }

  return matches;
}

// ─────────────────────────────────────────────────────────────
// Brazilian pool generation
// ─────────────────────────────────────────────────────────────

/**
 * Generates matches for a Brazilian pool format (4 teams only).
 *
 * Pattern:
 *   M1: Seed1 vs Seed4
 *   M2: Seed2 vs Seed3
 *   M3: Winner(M1) vs Winner(M2) — Final (rankOutput: 1)
 *   M4: Loser(M1) vs Loser(M2)  — 3rd place (rankOutput: 3)
 *
 * @param pool - Pool with exactly 4 teams
 * @param format - Match format configuration
 * @param phasePrefix - Phase prefix for match IDs
 * @returns Array of 4 TournamentMatch objects with correct dependencies
 */
export function generateBrazilianMatches(
  pool: Pool,
  format: MatchFormatConfig,
  phasePrefix: 'Q' | 'MD'
): TournamentMatch[] {
  if (pool.size !== 4) {
    throw new Error(`Brazilian format requires exactly 4 teams, got ${pool.size}`);
  }
  if (pool.template !== PoolTemplate.BRAZILIAN_4) {
    throw new Error(`Brazilian format requires BRAZILIAN_4 template, got ${pool.template}`);
  }

  // Sort teams by seed (ascending: best seed first)
  const sorted = [...pool.teams].sort((a, b) => a.seed - b.seed);
  const [seed1, seed2, seed3, seed4] = sorted;

  const duration = estimateMatchDuration(format);
  const phase: PhaseType = phasePrefix === 'Q' ? 'qualification-pool' : 'main-draw-pool';
  const prefix = `${phasePrefix}-P${pool.poolId}`;

  const m1Id = `${prefix}-M1`;
  const m2Id = `${prefix}-M2`;
  const m3Id = `${prefix}-M3`;
  const m4Id = `${prefix}-M4`;

  return [
    {
      id: m1Id,
      team1: seed1,
      team2: seed4,
      round: 1,
      duration,
      phase,
      poolId: pool.poolId,
      metadata: { description: `${seed1.name} vs ${seed4.name}` },
    },
    {
      id: m2Id,
      team1: seed2,
      team2: seed3,
      round: 1,
      duration,
      phase,
      poolId: pool.poolId,
      metadata: { description: `${seed2.name} vs ${seed3.name}` },
    },
    {
      id: m3Id,
      team1: `Winner ${m1Id}`,
      team2: `Winner ${m2Id}`,
      round: 2,
      duration,
      dependencies: [m1Id, m2Id],
      phase,
      poolId: pool.poolId,
      metadata: {
        rankOutput: 1,
        description: 'Final — winner is 1st, loser is 2nd',
      },
    },
    {
      id: m4Id,
      team1: `Loser ${m1Id}`,
      team2: `Loser ${m2Id}`,
      round: 2,
      duration,
      dependencies: [m1Id, m2Id],
      phase,
      poolId: pool.poolId,
      metadata: {
        rankOutput: 3,
        description: '3rd place — winner is 3rd, loser is 4th',
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Knockout bracket generation
// ─────────────────────────────────────────────────────────────

/**
 * Represents a team entering the knockout bracket.
 */
export interface KnockoutTeamEntry {
  teamId: string | number;
  seed?: number;
  label: string;
}

/**
 * Generates a knockout bracket from qualified teams.
 * Supports 4 or 8 qualified teams.
 *
 * For 8 teams: QF(4) -> SF(2) -> Small Final + Final
 * For 4 teams: SF(2) -> Small Final + Final
 *
 * @param qualifiedTeams - Teams entering the knockout (ordered by seed/ranking)
 * @param format - Match format configuration
 * @param startingRound - Round number offset for scheduling priority
 * @returns Array of TournamentMatch objects with knockout dependencies
 */
export function generateKnockoutBracket(
  qualifiedTeams: KnockoutTeamEntry[],
  format: MatchFormatConfig,
  startingRound: number = 40
): TournamentMatch[] {
  const n = qualifiedTeams.length;
  const duration = estimateMatchDuration(format);
  const matches: TournamentMatch[] = [];

  if (n !== 4 && n !== 8) {
    throw new Error(`Knockout bracket supports 4 or 8 teams, got ${n}`);
  }

  if (n === 8) {
    // Standard seeding: 1v8, 4v5, 2v7, 3v6
    const qfMatchups: [number, number][] = [[0, 7], [3, 4], [1, 6], [2, 5]];

    for (let i = 0; i < 4; i++) {
      const [a, b] = qfMatchups[i];
      matches.push({
        id: `KO-QF${i + 1}`,
        team1: qualifiedTeams[a].label,
        team2: qualifiedTeams[b].label,
        round: startingRound,
        duration,
        phase: 'knockout',
        metadata: {
          knockoutStage: 'QF',
          description: `Quarter-Final ${i + 1}: ${qualifiedTeams[a].label} vs ${qualifiedTeams[b].label}`,
        },
      });
    }

    matches.push({
      id: 'KO-SF1',
      team1: 'Winner KO-QF1',
      team2: 'Winner KO-QF2',
      round: startingRound + 10,
      duration,
      dependencies: ['KO-QF1', 'KO-QF2'],
      phase: 'knockout',
      metadata: { knockoutStage: 'SF', description: 'Semi-Final 1' },
    });

    matches.push({
      id: 'KO-SF2',
      team1: 'Winner KO-QF3',
      team2: 'Winner KO-QF4',
      round: startingRound + 10,
      duration,
      dependencies: ['KO-QF3', 'KO-QF4'],
      phase: 'knockout',
      metadata: { knockoutStage: 'SF', description: 'Semi-Final 2' },
    });

    matches.push({
      id: 'KO-3RD',
      team1: 'Loser KO-SF1',
      team2: 'Loser KO-SF2',
      round: startingRound + 20,
      duration,
      dependencies: ['KO-SF1', 'KO-SF2'],
      phase: 'knockout',
      metadata: { knockoutStage: 'small-final', description: 'Small Final (3rd place)' },
    });

    matches.push({
      id: 'KO-F',
      team1: 'Winner KO-SF1',
      team2: 'Winner KO-SF2',
      round: startingRound + 20,
      duration,
      dependencies: ['KO-SF1', 'KO-SF2'],
      phase: 'knockout',
      metadata: { knockoutStage: 'final', description: 'Final' },
    });
  } else {
    // n === 4: SF directly (1v4, 2v3)
    matches.push({
      id: 'KO-SF1',
      team1: qualifiedTeams[0].label,
      team2: qualifiedTeams[3].label,
      round: startingRound,
      duration,
      phase: 'knockout',
      metadata: {
        knockoutStage: 'SF',
        description: `Semi-Final 1: ${qualifiedTeams[0].label} vs ${qualifiedTeams[3].label}`,
      },
    });

    matches.push({
      id: 'KO-SF2',
      team1: qualifiedTeams[1].label,
      team2: qualifiedTeams[2].label,
      round: startingRound,
      duration,
      phase: 'knockout',
      metadata: {
        knockoutStage: 'SF',
        description: `Semi-Final 2: ${qualifiedTeams[1].label} vs ${qualifiedTeams[2].label}`,
      },
    });

    matches.push({
      id: 'KO-3RD',
      team1: 'Loser KO-SF1',
      team2: 'Loser KO-SF2',
      round: startingRound + 10,
      duration,
      dependencies: ['KO-SF1', 'KO-SF2'],
      phase: 'knockout',
      metadata: { knockoutStage: 'small-final', description: 'Small Final (3rd place)' },
    });

    matches.push({
      id: 'KO-F',
      team1: 'Winner KO-SF1',
      team2: 'Winner KO-SF2',
      round: startingRound + 10,
      duration,
      dependencies: ['KO-SF1', 'KO-SF2'],
      phase: 'knockout',
      metadata: { knockoutStage: 'final', description: 'Final' },
    });
  }

  return matches;
}

// ─────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────

/**
 * Dispatches to the correct match generator based on pool template.
 */
export function generatePoolMatches(
  pool: Pool,
  format: MatchFormatConfig,
  phasePrefix: 'Q' | 'MD'
): TournamentMatch[] {
  if (pool.template === PoolTemplate.BRAZILIAN_4) {
    return generateBrazilianMatches(pool, format, phasePrefix);
  }
  return generateRoundRobinMatches(pool, format, phasePrefix);
}
