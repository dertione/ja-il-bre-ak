/**
 * FFVB Ranking Engine for Pool Phase Results
 *
 * Implements two distinct ranking modes:
 * - Standard: FFVB hierarchy (wins, set ratio, point ratio, head-to-head)
 * - Brazilian: Positional ranking based on template tree position
 */

/**
 * Represents a completed match with all results
 */
export interface CompletedMatch {
  id: string | number;
  team1Id: string | number;
  team2Id: string | number;
  team1Sets: number;       // Sets won by team 1
  team2Sets: number;       // Sets won by team 2
  team1Points: number;     // Total points scored by team 1
  team2Points: number;     // Total points scored by team 2
  winnerId: string | number;  // ID of winning team
  rankOutput?: number;     // For Brazilian mode: final position (1 = 1st place)
  [key: string]: any;
}

/**
 * Team statistics for ranking calculation
 */
export interface TeamStats {
  teamId: string | number;
  matches: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setRatio: number;        // setsWon / setsLost (or Infinity if setsLost = 0)
  pointsFor: number;
  pointsAgainst: number;
  pointRatio: number;      // pointsFor / pointsAgainst
}

/**
 * Ranked team with position
 */
export interface RankedTeam {
  rank: number;            // Final position (1 = 1st place)
  teamId: string | number;
  stats?: TeamStats;       // Only present in Standard mode
  tieBreaker?: string;     // Explanation of how ties were broken
}

/**
 * Result of ranking calculation
 */
export interface RankingResult {
  method: 'standard' | 'brazilian';
  rankings: RankedTeam[];
}

/**
 * Configuration for Brazilian mode ranking
 */
export interface BrazilianConfig {
  finalMatchId?: string | number;  // ID of the final match (highest rank_output)
}

/**
 * Calculates team statistics from completed matches
 */
function calculateTeamStats(
  matches: CompletedMatch[],
  teamIds: Set<string | number>
): Map<string | number, TeamStats> {
  const stats = new Map<string | number, TeamStats>();

  // Initialize stats for all teams
  for (const teamId of teamIds) {
    stats.set(teamId, {
      teamId,
      matches: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setRatio: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointRatio: 0,
    });
  }

  // Calculate stats from matches
  for (const match of matches) {
    const team1Stats = stats.get(match.team1Id);
    const team2Stats = stats.get(match.team2Id);

    if (!team1Stats || !team2Stats) {
      continue; // Skip if team not in our pool
    }

    // Update match counts
    team1Stats.matches++;
    team2Stats.matches++;

    // Update wins/losses
    if (match.winnerId === match.team1Id) {
      team1Stats.wins++;
      team2Stats.losses++;
    } else if (match.winnerId === match.team2Id) {
      team2Stats.wins++;
      team1Stats.losses++;
    }

    // Update sets
    team1Stats.setsWon += match.team1Sets;
    team1Stats.setsLost += match.team2Sets;
    team2Stats.setsWon += match.team2Sets;
    team2Stats.setsLost += match.team1Sets;

    // Update points
    team1Stats.pointsFor += match.team1Points;
    team1Stats.pointsAgainst += match.team2Points;
    team2Stats.pointsFor += match.team2Points;
    team2Stats.pointsAgainst += match.team1Points;
  }

  // Calculate ratios
  for (const teamStats of stats.values()) {
    // Set ratio (handle division by zero)
    if (teamStats.setsLost === 0) {
      teamStats.setRatio = teamStats.setsWon > 0 ? Infinity : 0;
    } else {
      teamStats.setRatio = teamStats.setsWon / teamStats.setsLost;
    }

    // Point ratio
    if (teamStats.pointsAgainst === 0) {
      teamStats.pointRatio = teamStats.pointsFor > 0 ? Infinity : 0;
    } else {
      teamStats.pointRatio = teamStats.pointsFor / teamStats.pointsAgainst;
    }
  }

  return stats;
}

/**
 * Checks head-to-head record between two teams
 * Returns: 1 if team1 won, -1 if team2 won, 0 if tied or no direct match
 */
function getHeadToHeadResult(
  team1Id: string | number,
  team2Id: string | number,
  matches: CompletedMatch[]
): number {
  const directMatches = matches.filter(
    m =>
      (m.team1Id === team1Id && m.team2Id === team2Id) ||
      (m.team1Id === team2Id && m.team2Id === team1Id)
  );

  if (directMatches.length === 0) {
    return 0; // No direct match
  }

  // Find the most recent direct match
  const match = directMatches[directMatches.length - 1];

  if (match.winnerId === team1Id) {
    return 1;
  } else if (match.winnerId === team2Id) {
    return -1;
  }

  return 0; // Draw (shouldn't happen in volleyball)
}

/**
 * Sorts teams according to FFVB standard rules
 * 1. Wins
 * 2. Set ratio
 * 3. Point ratio
 * 4. Head-to-head
 */
function sortByStandardRules(
  teamIds: (string | number)[],
  stats: Map<string | number, TeamStats>,
  matches: CompletedMatch[]
): RankedTeam[] {
  const sorted = [...teamIds].sort((a, b) => {
    const statsA = stats.get(a)!;
    const statsB = stats.get(b)!;

    // 1. Number of wins (descending)
    if (statsA.wins !== statsB.wins) {
      return statsB.wins - statsA.wins;
    }

    // 2. Set ratio (descending)
    if (statsA.setRatio !== statsB.setRatio) {
      // Handle Infinity
      if (statsA.setRatio === Infinity && statsB.setRatio === Infinity) {
        // Both infinite, compare sets won
        return statsB.setsWon - statsA.setsWon;
      }
      if (statsA.setRatio === Infinity) return -1;
      if (statsB.setRatio === Infinity) return 1;
      return statsB.setRatio - statsA.setRatio;
    }

    // 3. Point ratio (descending)
    if (statsA.pointRatio !== statsB.pointRatio) {
      if (statsA.pointRatio === Infinity && statsB.pointRatio === Infinity) {
        return statsB.pointsFor - statsA.pointsFor;
      }
      if (statsA.pointRatio === Infinity) return -1;
      if (statsB.pointRatio === Infinity) return 1;
      return statsB.pointRatio - statsA.pointRatio;
    }

    // 4. Head-to-head
    const h2h = getHeadToHeadResult(a, b, matches);
    if (h2h !== 0) {
      return -h2h; // Negative because we want winner first
    }

    // 5. If still tied, maintain original order (stable sort)
    return 0;
  });

  return sorted.map((teamId, index) => {
    const stat = stats.get(teamId)!;
    let tieBreaker = 'wins';

    // Determine what broke the tie
    if (index > 0) {
      const prevStats = stats.get(sorted[index - 1])!;
      if (stat.wins === prevStats.wins) {
        if (stat.setRatio === prevStats.setRatio) {
          if (stat.pointRatio === prevStats.pointRatio) {
            tieBreaker = 'head-to-head';
          } else {
            tieBreaker = 'point-ratio';
          }
        } else {
          tieBreaker = 'set-ratio';
        }
      }
    }

    return {
      rank: index + 1,
      teamId,
      stats: stat,
      tieBreaker: index === 0 ? 'n/a' : tieBreaker,
    };
  });
}

/**
 * Sorts teams according to Brazilian positional rules
 * Uses rank_output from template metadata
 */
function sortByBrazilianRules(
  matches: CompletedMatch[],
  config?: BrazilianConfig
): RankedTeam[] {
  // Find all matches with rank_output
  const rankedMatches = matches.filter(m => m.rankOutput !== undefined);

  if (rankedMatches.length === 0) {
    throw new Error(
      'Brazilian mode requires matches with rankOutput metadata. ' +
      'Ensure your template includes rank_output for final placement matches.'
    );
  }

  // Build team positions
  const teamPositions = new Map<string | number, number>();

  for (const match of rankedMatches) {
    const rankOutput = match.rankOutput!;

    // In Brazilian system, rank_output indicates the position awarded
    // Winner of the match gets the higher position (lower number)
    // Loser gets the lower position (higher number)

    // Determine positions based on match structure
    if (match.winnerId === match.team1Id) {
      teamPositions.set(match.team1Id, rankOutput);
      teamPositions.set(match.team2Id, rankOutput + 1);
    } else if (match.winnerId === match.team2Id) {
      teamPositions.set(match.team2Id, rankOutput);
      teamPositions.set(match.team1Id, rankOutput + 1);
    }
  }

  // Convert to sorted array
  const rankings: RankedTeam[] = Array.from(teamPositions.entries())
    .map(([teamId, rank]) => ({
      rank,
      teamId,
      tieBreaker: 'template-position',
    }))
    .sort((a, b) => a.rank - b.rank);

  // Renumber ranks to be sequential (1, 2, 3, 4...)
  rankings.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return rankings;
}

/**
 * Main ranking function - calculates pool rankings using specified method
 *
 * @param matches - List of completed matches from the pool
 * @param method - Ranking method: 'standard' or 'brazilian'
 * @param config - Optional configuration (for Brazilian mode)
 * @returns Ranking result with sorted teams
 *
 * @example Standard Mode
 * ```typescript
 * const matches: CompletedMatch[] = [
 *   { id: 'M1', team1Id: 'A', team2Id: 'B', team1Sets: 2, team2Sets: 0,
 *     team1Points: 50, team2Points: 40, winnerId: 'A' },
 *   { id: 'M2', team1Id: 'A', team2Id: 'C', team1Sets: 2, team2Sets: 1,
 *     team1Points: 60, team2Points: 55, winnerId: 'A' },
 *   // ... more matches
 * ];
 *
 * const result = calculatePoolRankings(matches, 'standard');
 * // Returns rankings sorted by: wins > set ratio > point ratio > head-to-head
 * ```
 *
 * @example Brazilian Mode
 * ```typescript
 * const matches: CompletedMatch[] = [
 *   { id: 'M1', team1Id: 'A', team2Id: 'B', team1Sets: 2, team2Sets: 0,
 *     team1Points: 50, team2Points: 40, winnerId: 'A' },
 *   { id: 'M2', team1Id: 'C', team2Id: 'D', team1Sets: 2, team2Sets: 1,
 *     team1Points: 55, team2Points: 50, winnerId: 'C' },
 *   { id: 'M3', team1Id: 'A', team2Id: 'C', team1Sets: 2, team2Sets: 1,
 *     team1Points: 60, team2Points: 58, winnerId: 'A', rankOutput: 1 }, // Final
 *   { id: 'M4', team1Id: 'B', team2Id: 'D', team1Sets: 2, team2Sets: 0,
 *     team1Points: 50, team2Points: 45, winnerId: 'B', rankOutput: 3 }, // 3rd place
 * ];
 *
 * const result = calculatePoolRankings(matches, 'brazilian');
 * // Returns: 1st: A, 2nd: C, 3rd: B, 4th: D (based on template tree positions)
 * ```
 */
export function calculatePoolRankings(
  matches: CompletedMatch[],
  method: 'standard' | 'brazilian' = 'standard',
  config?: BrazilianConfig
): RankingResult {
  if (matches.length === 0) {
    throw new Error('No matches provided for ranking');
  }

  if (method === 'brazilian') {
    return {
      method: 'brazilian',
      rankings: sortByBrazilianRules(matches, config),
    };
  }

  // Standard mode
  // Extract all unique team IDs
  const teamIds = new Set<string | number>();
  for (const match of matches) {
    teamIds.add(match.team1Id);
    teamIds.add(match.team2Id);
  }

  // Calculate statistics
  const stats = calculateTeamStats(matches, teamIds);

  // Sort by FFVB rules
  const rankings = sortByStandardRules(Array.from(teamIds), stats, matches);

  return {
    method: 'standard',
    rankings,
  };
}

/**
 * Helper function to get team stats by ID (for Standard mode)
 */
export function getTeamStats(
  teamId: string | number,
  result: RankingResult
): TeamStats | null {
  if (result.method !== 'standard') {
    return null;
  }

  const ranked = result.rankings.find(r => r.teamId === teamId);
  return ranked?.stats || null;
}

/**
 * Helper function to get team rank by ID
 */
export function getTeamRank(
  teamId: string | number,
  result: RankingResult
): number | null {
  const ranked = result.rankings.find(r => r.teamId === teamId);
  return ranked?.rank || null;
}

/**
 * Formats ranking result as a readable string (for debugging/display)
 */
export function formatRankings(result: RankingResult): string {
  let output = `=== Pool Rankings (${result.method.toUpperCase()}) ===\n\n`;

  for (const ranked of result.rankings) {
    output += `${ranked.rank}. Team ${ranked.teamId}`;

    if (ranked.stats) {
      const s = ranked.stats;
      output += ` - ${s.wins}W-${s.losses}L`;
      output += ` | Sets: ${s.setsWon}-${s.setsLost}`;
      output += ` (${s.setRatio === Infinity ? '∞' : s.setRatio.toFixed(2)})`;
      output += ` | Points: ${s.pointsFor}-${s.pointsAgainst}`;
      output += ` (${s.pointRatio.toFixed(2)})`;
      if (ranked.tieBreaker && ranked.tieBreaker !== 'n/a') {
        output += ` | Tie: ${ranked.tieBreaker}`;
      }
    } else {
      output += ` (${ranked.tieBreaker})`;
    }

    output += '\n';
  }

  return output;
}
