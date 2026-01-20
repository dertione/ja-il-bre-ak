/**
 * Tournament Crossover Engine
 *
 * Generates matches for the next stage based on pool rankings.
 * Supports multiple transition modes:
 * - Crossover: Standard serpentin pattern for playoffs
 * - Tickets: Best seconds qualification system
 */

import { RankingResult } from './rankingEngine';

/**
 * Pool identifier (A, B, C, D, etc.)
 */
export type PoolId = string;

/**
 * Represents rankings from multiple pools
 */
export interface PoolRankings {
  poolId: PoolId;
  rankings: RankingResult;
}

/**
 * Configuration for crossover mode (standard brackets)
 */
export interface CrossoverConfig {
  mode: 'crossover';
  pattern?: 'ABCD' | 'ABCDEF' | 'serpentin';  // Crossover pattern
  qualifiersPerPool: number;  // How many teams from each pool advance directly
  playoffRounds?: {
    // Optional: specific matchups for playoffs
    round1?: string[];  // e.g., ["2A-3D", "2B-3C", "2C-3B", "2D-3A"]
  };
}

/**
 * Configuration for ticket mode (quota system)
 */
export interface TicketConfig {
  mode: 'tickets';
  totalTickets: number;        // Total number of teams advancing
  directQualifiers?: number;   // First-place teams qualify directly (default: pool count)
  playoffBestSeconds?: boolean; // Remaining tickets go to best seconds (default: true)
}

/**
 * Configuration for direct advancement (no playoffs)
 */
export interface DirectConfig {
  mode: 'direct';
  teamsPerPool: number;  // Top N from each pool advance
}

/**
 * Union type for all transition configs
 */
export type TransitionConfig = CrossoverConfig | TicketConfig | DirectConfig;

/**
 * Generated match for next stage
 */
export interface GeneratedMatch {
  id: string;
  team1: {
    poolId: PoolId;
    rank: number;
    teamId?: string | number;  // Actual team ID if known
  };
  team2: {
    poolId: PoolId;
    rank: number;
    teamId?: string | number;
  };
  round: number;
  type: 'playoff' | 'bracket' | 'qualification';
  description: string;  // Human-readable description
}

/**
 * Result of transition generation
 */
export interface TransitionResult {
  qualified: {
    poolId: PoolId;
    rank: number;
    teamId: string | number;
    method: 'direct' | 'playoff' | 'best-second';
  }[];
  playoffMatches: GeneratedMatch[];
  bracketMatches: GeneratedMatch[];
  summary: {
    totalQualified: number;
    playoffCount: number;
    bracketCount: number;
  };
}

/**
 * Gets teams by rank from pool rankings
 */
function getTeamsByRank(
  poolRankings: PoolRankings[],
  rank: number
): Map<PoolId, string | number> {
  const teams = new Map<PoolId, string | number>();

  for (const pool of poolRankings) {
    const team = pool.rankings.rankings.find(r => r.rank === rank);
    if (team) {
      teams.set(pool.poolId, team.teamId);
    }
  }

  return teams;
}

/**
 * Generates crossover matches using serpentin pattern
 * Pattern for 4 pools (A, B, C, D):
 * - 2A vs 3D
 * - 2B vs 3C
 * - 2C vs 3B
 * - 2D vs 3A
 */
function generateCrossoverMatches(
  poolRankings: PoolRankings[],
  config: CrossoverConfig
): GeneratedMatch[] {
  const matches: GeneratedMatch[] = [];
  const poolIds = poolRankings.map(p => p.poolId).sort();
  const poolCount = poolIds.length;

  // Get second and third place teams
  const seconds = getTeamsByRank(poolRankings, 2);
  const thirds = getTeamsByRank(poolRankings, 3);

  // Generate serpentin crossovers
  for (let i = 0; i < poolCount; i++) {
    const poolA = poolIds[i];
    const poolB = poolIds[poolCount - 1 - i]; // Mirror pool

    const team1Id = seconds.get(poolA);
    const team2Id = thirds.get(poolB);

    if (team1Id && team2Id) {
      matches.push({
        id: `PO-${poolA}${poolB}-${i + 1}`,
        team1: {
          poolId: poolA,
          rank: 2,
          teamId: team1Id,
        },
        team2: {
          poolId: poolB,
          rank: 3,
          teamId: team2Id,
        },
        round: 1,
        type: 'playoff',
        description: `Playoff: 2nd ${poolA} vs 3rd ${poolB}`,
      });
    }
  }

  return matches;
}

/**
 * Ranks second-place teams across all pools for ticket system
 * Uses same FFVB criteria: wins, set ratio, point ratio
 */
function rankSecondPlaceTeams(
  poolRankings: PoolRankings[]
): Array<{ poolId: PoolId; teamId: string | number; stats: any }> {
  const seconds: Array<{ poolId: PoolId; teamId: string | number; stats: any }> = [];

  for (const pool of poolRankings) {
    const secondPlace = pool.rankings.rankings.find(r => r.rank === 2);
    if (secondPlace && secondPlace.stats) {
      seconds.push({
        poolId: pool.poolId,
        teamId: secondPlace.teamId,
        stats: secondPlace.stats,
      });
    }
  }

  // Sort by FFVB criteria
  seconds.sort((a, b) => {
    const statsA = a.stats;
    const statsB = b.stats;

    // 1. Wins
    if (statsA.wins !== statsB.wins) {
      return statsB.wins - statsA.wins;
    }

    // 2. Set ratio
    if (statsA.setRatio !== statsB.setRatio) {
      if (statsA.setRatio === Infinity && statsB.setRatio === Infinity) {
        return statsB.setsWon - statsA.setsWon;
      }
      if (statsA.setRatio === Infinity) return -1;
      if (statsB.setRatio === Infinity) return 1;
      return statsB.setRatio - statsA.setRatio;
    }

    // 3. Point ratio
    if (statsA.pointRatio !== statsB.pointRatio) {
      if (statsA.pointRatio === Infinity && statsB.pointRatio === Infinity) {
        return statsB.pointsFor - statsA.pointsFor;
      }
      if (statsA.pointRatio === Infinity) return -1;
      if (statsB.pointRatio === Infinity) return 1;
      return statsB.pointRatio - statsA.pointRatio;
    }

    return 0;
  });

  return seconds;
}

/**
 * Generates matches using ticket/quota system
 */
function generateTicketMatches(
  poolRankings: PoolRankings[],
  config: TicketConfig
): { qualified: any[]; playoffMatches: GeneratedMatch[] } {
  const qualified: any[] = [];
  const playoffMatches: GeneratedMatch[] = [];

  const poolCount = poolRankings.length;
  const directQualifiers = config.directQualifiers ?? poolCount;

  // First-place teams qualify directly
  const firsts = getTeamsByRank(poolRankings, 1);
  let qualifiedCount = 0;

  for (const [poolId, teamId] of firsts.entries()) {
    if (qualifiedCount < directQualifiers) {
      qualified.push({
        poolId,
        rank: 1,
        teamId,
        method: 'direct',
      });
      qualifiedCount++;
    }
  }

  // Calculate remaining tickets
  const remainingTickets = config.totalTickets - qualifiedCount;

  if (remainingTickets > 0 && config.playoffBestSeconds !== false) {
    // Rank second-place teams
    const rankedSeconds = rankSecondPlaceTeams(poolRankings);

    // Best seconds get remaining tickets
    for (let i = 0; i < Math.min(remainingTickets, rankedSeconds.length); i++) {
      const second = rankedSeconds[i];
      qualified.push({
        poolId: second.poolId,
        rank: 2,
        teamId: second.teamId,
        method: 'best-second',
      });
      qualifiedCount++;
    }

    // If we need playoffs for remaining tickets
    const ticketsLeft = config.totalTickets - qualifiedCount;
    if (ticketsLeft > 0 && rankedSeconds.length > remainingTickets) {
      // Generate playoff matches between next-best seconds
      const playoffCandidates = rankedSeconds.slice(
        remainingTickets,
        remainingTickets + ticketsLeft * 2
      );

      for (let i = 0; i < playoffCandidates.length - 1; i += 2) {
        const team1 = playoffCandidates[i];
        const team2 = playoffCandidates[i + 1];

        if (team1 && team2) {
          playoffMatches.push({
            id: `TICKET-PO-${i / 2 + 1}`,
            team1: {
              poolId: team1.poolId,
              rank: 2,
              teamId: team1.teamId,
            },
            team2: {
              poolId: team2.poolId,
              rank: 2,
              teamId: team2.teamId,
            },
            round: 1,
            type: 'qualification',
            description: `Ticket Playoff: 2nd ${team1.poolId} vs 2nd ${team2.poolId}`,
          });
        }
      }
    }
  }

  return { qualified, playoffMatches };
}

/**
 * Generates direct qualification (no playoffs)
 */
function generateDirectQualification(
  poolRankings: PoolRankings[],
  config: DirectConfig
): any[] {
  const qualified: any[] = [];

  for (const pool of poolRankings) {
    for (let rank = 1; rank <= config.teamsPerPool; rank++) {
      const team = pool.rankings.rankings.find(r => r.rank === rank);
      if (team) {
        qualified.push({
          poolId: pool.poolId,
          rank,
          teamId: team.teamId,
          method: 'direct',
        });
      }
    }
  }

  return qualified;
}

/**
 * Main function: Generates matches and qualifications for next tournament stage
 *
 * @param poolRankings - Rankings from all pools
 * @param config - Transition configuration
 * @returns Transition result with qualified teams and generated matches
 *
 * @example Crossover Mode (Standard Playoffs)
 * ```typescript
 * const poolRankings: PoolRankings[] = [
 *   { poolId: 'A', rankings: resultA },
 *   { poolId: 'B', rankings: resultB },
 *   { poolId: 'C', rankings: resultC },
 *   { poolId: 'D', rankings: resultD }
 * ];
 *
 * const result = generateNextStageMatches(poolRankings, {
 *   mode: 'crossover',
 *   qualifiersPerPool: 1,  // 1st place advance directly
 *   pattern: 'serpentin'    // 2nd vs 3rd in serpentin pattern
 * });
 *
 * // Result:
 * // - 4 teams qualified directly (1st from each pool)
 * // - 4 playoff matches: 2A-3D, 2B-3C, 2C-3B, 2D-3A
 * ```
 *
 * @example Ticket Mode (Quota System)
 * ```typescript
 * const result = generateNextStageMatches(poolRankings, {
 *   mode: 'tickets',
 *   totalTickets: 6  // 6 teams advance to next round
 * });
 *
 * // With 4 pools:
 * // - 4 first-place teams qualify directly
 * // - 2 best second-place teams qualify (based on FFVB criteria)
 * // Result: 6 qualified teams, 0 playoff matches
 * ```
 *
 * @example Ticket Mode with Playoffs
 * ```typescript
 * const result = generateNextStageMatches(poolRankings, {
 *   mode: 'tickets',
 *   totalTickets: 5  // 5 teams advance
 * });
 *
 * // With 4 pools:
 * // - 4 first-place teams qualify directly
 * // - 1 remaining ticket
 * // - Best second qualifies, or playoff between 2nd-best seconds if needed
 * ```
 */
export function generateNextStageMatches(
  poolRankings: PoolRankings[],
  config: TransitionConfig
): TransitionResult {
  if (poolRankings.length === 0) {
    throw new Error('No pool rankings provided');
  }

  let qualified: any[] = [];
  let playoffMatches: GeneratedMatch[] = [];
  const bracketMatches: GeneratedMatch[] = [];

  switch (config.mode) {
    case 'crossover': {
      // First-place teams qualify directly
      const firsts = getTeamsByRank(poolRankings, 1);
      for (const [poolId, teamId] of firsts.entries()) {
        qualified.push({
          poolId,
          rank: 1,
          teamId,
          method: 'direct',
        });
      }

      // Generate crossover playoff matches
      playoffMatches = generateCrossoverMatches(poolRankings, config);
      break;
    }

    case 'tickets': {
      const result = generateTicketMatches(poolRankings, config);
      qualified = result.qualified;
      playoffMatches = result.playoffMatches;
      break;
    }

    case 'direct': {
      qualified = generateDirectQualification(poolRankings, config);
      break;
    }

    default:
      throw new Error(`Unknown transition mode: ${(config as any).mode}`);
  }

  return {
    qualified,
    playoffMatches,
    bracketMatches,
    summary: {
      totalQualified: qualified.length,
      playoffCount: playoffMatches.length,
      bracketCount: bracketMatches.length,
    },
  };
}

/**
 * Formats transition result as readable string
 */
export function formatTransitionResult(result: TransitionResult): string {
  let output = '=== Next Stage Transition ===\n\n';

  // Qualified teams
  output += `Direct Qualifiers (${result.qualified.length}):\n`;
  for (const q of result.qualified) {
    output += `  - ${q.rank}${getOrdinalSuffix(q.rank)} ${q.poolId}`;
    output += ` (Team ${q.teamId}) [${q.method}]\n`;
  }

  // Playoff matches
  if (result.playoffMatches.length > 0) {
    output += `\nPlayoff Matches (${result.playoffMatches.length}):\n`;
    for (const match of result.playoffMatches) {
      output += `  ${match.id}: ${match.description}\n`;
    }
  }

  // Bracket matches
  if (result.bracketMatches.length > 0) {
    output += `\nBracket Matches (${result.bracketMatches.length}):\n`;
    for (const match of result.bracketMatches) {
      output += `  ${match.id}: ${match.description}\n`;
    }
  }

  output += `\nSummary: ${result.summary.totalQualified} qualified, `;
  output += `${result.summary.playoffCount} playoffs, `;
  output += `${result.summary.bracketCount} bracket matches\n`;

  return output;
}

/**
 * Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Validates that all pools have consistent ranking data
 */
export function validatePoolRankings(poolRankings: PoolRankings[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (poolRankings.length === 0) {
    errors.push('No pool rankings provided');
    return { valid: false, errors };
  }

  // Check each pool has rankings
  for (const pool of poolRankings) {
    if (!pool.rankings || pool.rankings.rankings.length === 0) {
      errors.push(`Pool ${pool.poolId} has no rankings`);
    }
  }

  // Check all pools use the same ranking method
  const methods = new Set(poolRankings.map(p => p.rankings.method));
  if (methods.size > 1) {
    errors.push(
      `Inconsistent ranking methods: ${Array.from(methods).join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
