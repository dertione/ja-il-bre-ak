/**
 * FFVB-Compliant Volleyball Pool Distribution with Snake Seeding
 *
 * This module implements the official FFVB (Fédération Française de Volley-Ball)
 * algorithm for distributing teams into pools using the snake seeding method.
 */

/**
 * Represents a team in the tournament
 */
export interface Team {
  id: string | number;
  name: string;
  seed: number; // Position in seeding (1 = strongest team)
  [key: string]: any; // Allow additional properties
}

/**
 * Template types for pool match generation
 */
export enum PoolTemplate {
  BRAZILIAN_4 = "Poule Brésilienne", // For 4-team pools
  STANDARD_4 = "Standard 4",         // Alternative for 4-team pools
  STANDARD_3 = "Poule Standard 3",   // For 3-team pools
}

/**
 * Represents a pool with assigned teams
 */
export interface Pool {
  poolId: string; // Pool identifier (A, B, C, D, etc.)
  teams: Team[];
  size: number;
  template: PoolTemplate;
}

/**
 * Result of the pool distribution
 */
export interface PoolDistributionResult {
  pools: Pool[];
  summary: {
    totalTeams: number;
    totalPools: number;
    poolSizes: {
      size: number;
      count: number;
    }[];
  };
}

/**
 * Configuration options for pool distribution
 */
export interface DistributionConfig {
  templateFor4Teams?: PoolTemplate.BRAZILIAN_4 | PoolTemplate.STANDARD_4;
  templateFor3Teams?: PoolTemplate.STANDARD_3;
}

/**
 * Calculates pool sizes according to FFVB rules:
 * - Larger pools come first (Pool A, B, C, etc.)
 * - If teams don't divide evenly, first pools get extra teams
 *
 * Example: 13 teams / 4 pools = [4, 3, 3, 3]
 *
 * @param teamCount - Total number of teams
 * @param poolCount - Number of pools
 * @returns Array of pool sizes
 */
export function calculatePoolSizes(teamCount: number, poolCount: number): number[] {
  if (poolCount <= 0) {
    throw new Error("Pool count must be greater than 0");
  }

  if (teamCount < poolCount) {
    throw new Error(`Not enough teams (${teamCount}) for ${poolCount} pools`);
  }

  const baseSize = Math.floor(teamCount / poolCount);
  const remainder = teamCount % poolCount;

  const sizes: number[] = [];

  // First 'remainder' pools get baseSize + 1 teams
  // Remaining pools get baseSize teams
  for (let i = 0; i < poolCount; i++) {
    sizes.push(i < remainder ? baseSize + 1 : baseSize);
  }

  return sizes;
}

/**
 * Generates pool identifiers (A, B, C, ..., Z, AA, AB, ...)
 *
 * @param poolCount - Number of pools
 * @returns Array of pool identifiers
 */
export function generatePoolIds(poolCount: number): string[] {
  const poolIds: string[] = [];

  for (let i = 0; i < poolCount; i++) {
    poolIds.push(getPoolLabel(i));
  }

  return poolIds;
}

/**
 * Converts pool index to letter label (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, etc.)
 */
function getPoolLabel(index: number): string {
  let label = '';
  let current = index;

  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return label;
}

/**
 * Implements the Snake Seeding algorithm (Serpentin) for team distribution
 *
 * Algorithm:
 * - Round 1 (forward): Seed 1→A, 2→B, 3→C, 4→D
 * - Round 2 (backward): Seed 5→D, 6→C, 7→B, 8→A
 * - Round 3 (forward): Seed 9→A, 10→B, 11→C, 12→D
 * - And so on...
 *
 * Example for 4 pools with 16 teams:
 * - Pool A: Seeds 1, 8, 9, 16
 * - Pool B: Seeds 2, 7, 10, 15
 * - Pool C: Seeds 3, 6, 11, 14
 * - Pool D: Seeds 4, 5, 12, 13
 *
 * @param teams - Array of teams (must be sorted by seed)
 * @param poolSizes - Array of pool sizes
 * @returns 2D array where each sub-array contains teams for one pool
 */
export function snakeSeeding(teams: Team[], poolSizes: number[]): Team[][] {
  const poolCount = poolSizes.length;
  const totalTeams = teams.length;

  // Validate that we have enough teams for the pool sizes
  const requiredTeams = poolSizes.reduce((sum, size) => sum + size, 0);
  if (totalTeams !== requiredTeams) {
    throw new Error(
      `Team count mismatch: have ${totalTeams} teams but pool sizes require ${requiredTeams}`
    );
  }

  // Initialize pools
  const pools: Team[][] = Array.from({ length: poolCount }, () => []);

  let teamIndex = 0;
  let round = 0;

  // Continue until all teams are distributed
  while (teamIndex < totalTeams) {
    const isForwardRound = round % 2 === 0;

    // Determine pool order for this round
    const poolOrder = isForwardRound
      ? Array.from({ length: poolCount }, (_, i) => i)           // Forward: 0, 1, 2, 3
      : Array.from({ length: poolCount }, (_, i) => poolCount - 1 - i); // Backward: 3, 2, 1, 0

    // Assign one team to each pool (if pool still needs teams)
    for (const poolIndex of poolOrder) {
      if (teamIndex >= totalTeams) break;

      // Only assign if this pool still needs teams
      if (pools[poolIndex].length < poolSizes[poolIndex]) {
        pools[poolIndex].push(teams[teamIndex]);
        teamIndex++;
      }
    }

    round++;
  }

  return pools;
}

/**
 * Determines the appropriate template for a pool based on its size
 *
 * @param poolSize - Number of teams in the pool
 * @param config - Configuration options
 * @returns Pool template identifier
 */
export function getPoolTemplate(
  poolSize: number,
  config: DistributionConfig = {}
): PoolTemplate {
  if (poolSize === 4) {
    return config.templateFor4Teams ?? PoolTemplate.BRAZILIAN_4;
  } else if (poolSize === 3) {
    return config.templateFor3Teams ?? PoolTemplate.STANDARD_3;
  } else {
    throw new Error(`Unsupported pool size: ${poolSize}. Only 3 or 4 team pools are supported.`);
  }
}

/**
 * Main function: Distributes teams into pools using FFVB snake seeding algorithm
 *
 * @param teams - Array of teams to distribute (will be sorted by seed)
 * @param poolCount - Number of pools to create
 * @param config - Optional configuration for template selection
 * @returns Complete pool distribution result
 *
 * @example
 * ```typescript
 * const teams: Team[] = [
 *   { id: 1, name: "Team Alpha", seed: 1 },
 *   { id: 2, name: "Team Beta", seed: 2 },
 *   // ... more teams
 * ];
 *
 * const result = distributeTeamsToPools(teams, 4);
 * console.log(result);
 * ```
 */
export function distributeTeamsToPools(
  teams: Team[],
  poolCount: number,
  config: DistributionConfig = {}
): PoolDistributionResult {
  // Validation
  if (!teams || teams.length === 0) {
    throw new Error("Teams array cannot be empty");
  }

  if (poolCount <= 0) {
    throw new Error("Pool count must be greater than 0");
  }

  if (teams.length < poolCount) {
    throw new Error(
      `Not enough teams (${teams.length}) for ${poolCount} pools. Need at least ${poolCount} teams.`
    );
  }

  // Sort teams by seed (ascending: 1, 2, 3, ...)
  const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed);

  // Validate seeds are sequential and start from 1
  for (let i = 0; i < sortedTeams.length; i++) {
    if (sortedTeams[i].seed !== i + 1) {
      throw new Error(
        `Invalid seed sequence. Expected seed ${i + 1} but found ${sortedTeams[i].seed}. ` +
        `Seeds must be sequential starting from 1.`
      );
    }
  }

  // Calculate pool sizes
  const poolSizes = calculatePoolSizes(teams.length, poolCount);

  // Generate pool IDs
  const poolIds = generatePoolIds(poolCount);

  // Apply snake seeding algorithm
  const distributedTeams = snakeSeeding(sortedTeams, poolSizes);

  // Create pool objects with templates
  const pools: Pool[] = distributedTeams.map((poolTeams, index) => ({
    poolId: poolIds[index],
    teams: poolTeams,
    size: poolTeams.length,
    template: getPoolTemplate(poolTeams.length, config),
  }));

  // Calculate summary statistics
  const poolSizeCounts = new Map<number, number>();
  poolSizes.forEach(size => {
    poolSizeCounts.set(size, (poolSizeCounts.get(size) || 0) + 1);
  });

  const summary = {
    totalTeams: teams.length,
    totalPools: poolCount,
    poolSizes: Array.from(poolSizeCounts.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.size - a.size), // Sort by size descending
  };

  return {
    pools,
    summary,
  };
}
