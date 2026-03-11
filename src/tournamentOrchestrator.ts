/**
 * Tournament Orchestrator
 *
 * Top-level module that chains pool distribution, match generation,
 * and scheduling into a single tournament plan.
 *
 * Supports:
 * - Qualification + Main Draw format
 * - Main Draw only format
 * - Multiple qualification transition modes (crossover, barrage, direct)
 * - Pools-then-knockout or direct-knockout main draws
 */

import {
  Team,
  Pool,
  PoolTemplate,
  DistributionConfig,
  distributeTeamsToPools,
  calculatePoolSizes,
} from './poolDistribution';
import { Court, DayBoundary } from './tournamentScheduler';
import {
  MatchFormatConfig,
  PhaseType,
  TournamentMatch,
  estimateMatchDuration,
  generatePoolMatches,
  generateKnockoutBracket,
  KnockoutTeamEntry,
} from './matchGenerator';

// ─────────────────────────────────────────────────────────────
// Configuration types (user input)
// ─────────────────────────────────────────────────────────────

/**
 * Pool phase configuration.
 */
export interface PoolPhaseConfig {
  poolCount: number;
  poolFormat: 'classic' | 'brazilian';
  distributionConfig?: DistributionConfig;
  matchFormat: MatchFormatConfig;
}

/**
 * Qualification transition configuration.
 */
export interface QualificationTransitionConfig {
  qualifyCount: 4 | 6;
  mode: 'crossover-simple' | 'barrage' | 'direct';
  matchFormat: MatchFormatConfig;
}

/**
 * Main draw configuration.
 */
export interface MainDrawConfig {
  type: 'pools-then-knockout' | 'direct-knockout';

  // Only if type = 'pools-then-knockout':
  poolPhase?: PoolPhaseConfig;
  transition?: {
    mode: 'barrage' | 'crossover-simple' | 'direct';
    matchFormat: MatchFormatConfig;
  };

  // Knockout configuration (always present):
  knockout: {
    matchFormat: MatchFormatConfig;
  };
}

/**
 * Top-level tournament configuration.
 */
export interface TournamentConfig {
  name: string;
  teams: Team[];
  courts: Court[];

  format: 'qualification-main-draw' | 'main-draw-only';

  // Present only if format = 'qualification-main-draw'
  qualification?: {
    poolPhase: PoolPhaseConfig;
    transition: QualificationTransitionConfig;
  };

  mainDraw: MainDrawConfig;

  scheduling: {
    startTime: Date;
    restTime: number;
    courtSetupTime?: number;
    dayBoundaries?: DayBoundary[];
  };
}

// ─────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────

/**
 * A tournament phase with its matches and metadata.
 */
export interface TournamentPhase {
  id: string;
  type: PhaseType;
  label: string;
  matches: TournamentMatch[];
  pools?: Pool[];
  dependsOn?: string[];
}

/**
 * Complete tournament plan with all phases and matches.
 */
export interface TournamentPlan {
  config: TournamentConfig;
  phases: TournamentPhase[];
  allMatches: TournamentMatch[];
  summary: {
    totalMatches: number;
    totalPhases: number;
    estimatedDuration: number;
    matchesByPhase: { phaseId: string; count: number }[];
  };
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validates the tournament configuration.
 * Throws on invalid config.
 */
export function validateTournamentConfig(config: TournamentConfig): void {
  if (config.teams.length < 4) {
    throw new Error(`Need at least 4 teams, got ${config.teams.length}`);
  }

  if (config.courts.length < 1) {
    throw new Error('Need at least 1 court');
  }

  if (config.format === 'qualification-main-draw') {
    if (!config.qualification) {
      throw new Error('qualification config required when format is qualification-main-draw');
    }

    const qpc = config.qualification.poolPhase.poolCount;
    const sizes = calculatePoolSizes(config.teams.length, qpc);
    if (!sizes.every(s => s === 3 || s === 4)) {
      throw new Error(
        `Pool count ${qpc} for ${config.teams.length} teams produces pools of size [${sizes.join(',')}]. ` +
        `Only pools of size 3 or 4 are supported.`
      );
    }

    if (config.qualification.transition.mode === 'direct' &&
        config.qualification.transition.qualifyCount !== qpc) {
      throw new Error(
        `Direct qualification requires qualifyCount (${config.qualification.transition.qualifyCount}) ` +
        `to equal poolCount (${qpc})`
      );
    }
  }

  if (config.mainDraw.type === 'pools-then-knockout' && !config.mainDraw.poolPhase) {
    throw new Error('poolPhase config required when mainDraw type is pools-then-knockout');
  }

  // Validate knockout team count for direct-knockout
  if (config.mainDraw.type === 'direct-knockout') {
    const qualCount = config.format === 'qualification-main-draw'
      ? config.qualification!.transition.qualifyCount
      : config.teams.length;
    if (qualCount !== 4 && qualCount !== 8) {
      throw new Error(
        `direct-knockout requires 4 or 8 qualified teams, got ${qualCount}. ` +
        `Use pools-then-knockout for other team counts.`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Suggests a pool count that produces pools of only size 3 or 4.
 */
export function suggestPoolCount(teamCount: number): number {
  for (let pools = Math.ceil(teamCount / 4); pools <= Math.floor(teamCount / 3); pools++) {
    const sizes = calculatePoolSizes(teamCount, pools);
    if (sizes.every(s => s === 3 || s === 4)) return pools;
  }
  throw new Error(`Cannot find valid pool count for ${teamCount} teams (pools of 3 or 4 only)`);
}

/**
 * Collects all match IDs from a pool within a phase.
 */
function poolMatchIds(matches: TournamentMatch[], poolId: string): string[] {
  return matches
    .filter(m => m.poolId === poolId)
    .map(m => String(m.id));
}

/**
 * Collects all match IDs from a list.
 */
function allMatchIds(matches: TournamentMatch[]): string[] {
  return matches.map(m => String(m.id));
}

// ─────────────────────────────────────────────────────────────
// Qualification pool phase
// ─────────────────────────────────────────────────────────────

function generateQualificationPools(config: TournamentConfig): TournamentPhase {
  const qualConfig = config.qualification!;
  const poolFormat = qualConfig.poolPhase.poolFormat;

  const distConfig: DistributionConfig = {
    ...qualConfig.poolPhase.distributionConfig,
    templateFor4Teams: poolFormat === 'brazilian'
      ? PoolTemplate.BRAZILIAN_4
      : PoolTemplate.STANDARD_4,
  };

  const distribution = distributeTeamsToPools(
    config.teams,
    qualConfig.poolPhase.poolCount,
    distConfig
  );

  const allMatches: TournamentMatch[] = [];
  for (const pool of distribution.pools) {
    const poolMatches = generatePoolMatches(
      pool,
      qualConfig.poolPhase.matchFormat,
      'Q'
    );
    allMatches.push(...poolMatches);
  }

  return {
    id: 'qualification-pool',
    type: 'qualification-pool',
    label: 'Qualification Pools',
    matches: allMatches,
    pools: distribution.pools,
  };
}

// ─────────────────────────────────────────────────────────────
// Qualification transition phases
// ─────────────────────────────────────────────────────────────

function generateQualificationTransition(
  config: TournamentConfig,
  qualPoolPhase: TournamentPhase
): TournamentPhase {
  const transConfig = config.qualification!.transition;
  const pools = qualPoolPhase.pools!;
  const poolIds = pools.map(p => p.poolId).sort();
  const format = transConfig.matchFormat;
  const duration = estimateMatchDuration(format);
  const phase: PhaseType = 'qualification-transition';

  const matches: TournamentMatch[] = [];

  switch (transConfig.mode) {
    case 'crossover-simple': {
      if (transConfig.qualifyCount === 4) {
        // 1st vs 2nd serpentin: 1A vs 2D, 1B vs 2C, 1C vs 2B, 1D vs 2A
        for (let i = 0; i < poolIds.length; i++) {
          const pool1 = poolIds[i];
          const pool2 = poolIds[poolIds.length - 1 - i];
          const deps = [
            ...poolMatchIds(qualPoolPhase.matches, pool1),
            ...poolMatchIds(qualPoolPhase.matches, pool2),
          ];
          matches.push({
            id: `QT-X${i + 1}`,
            team1: `1st-${pool1}`,
            team2: `2nd-${pool2}`,
            round: 10,
            duration,
            dependencies: deps,
            phase,
            metadata: {
              description: `Crossover: 1st ${pool1} vs 2nd ${pool2}`,
            },
          });
        }
      } else {
        // qualifyCount === 6
        // 1st vs 3rd serpentin (4 matches) + 2nd vs 2nd serpentin (2 matches)
        for (let i = 0; i < poolIds.length; i++) {
          const pool1 = poolIds[i];
          const pool2 = poolIds[poolIds.length - 1 - i];
          const deps = [
            ...poolMatchIds(qualPoolPhase.matches, pool1),
            ...poolMatchIds(qualPoolPhase.matches, pool2),
          ];
          matches.push({
            id: `QT-X${i + 1}`,
            team1: `1st-${pool1}`,
            team2: `3rd-${pool2}`,
            round: 10,
            duration,
            dependencies: deps,
            phase,
            metadata: {
              description: `Crossover: 1st ${pool1} vs 3rd ${pool2}`,
            },
          });
        }

        // 2nd vs 2nd serpentin: with 4 pools, pairs are (A,D) and (B,C)
        const halfCount = Math.floor(poolIds.length / 2);
        for (let i = 0; i < halfCount; i++) {
          const pool1 = poolIds[i];
          const pool2 = poolIds[poolIds.length - 1 - i];
          const deps = [
            ...poolMatchIds(qualPoolPhase.matches, pool1),
            ...poolMatchIds(qualPoolPhase.matches, pool2),
          ];
          matches.push({
            id: `QT-X${poolIds.length + i + 1}`,
            team1: `2nd-${pool1}`,
            team2: `2nd-${pool2}`,
            round: 10,
            duration,
            dependencies: deps,
            phase,
            metadata: {
              description: `Crossover: 2nd ${pool1} vs 2nd ${pool2}`,
            },
          });
        }
      }
      break;
    }

    case 'barrage': {
      if (transConfig.qualifyCount === 4) {
        // Tour 1: 2nd vs 3rd from each pool
        for (let i = 0; i < poolIds.length; i++) {
          const poolId = poolIds[i];
          const deps = poolMatchIds(qualPoolPhase.matches, poolId);
          matches.push({
            id: `QT-B${i + 1}-T1`,
            team1: `2nd-${poolId}`,
            team2: `3rd-${poolId}`,
            round: 10,
            duration,
            dependencies: deps,
            phase,
            metadata: {
              description: `Barrage Tour 1: 2nd ${poolId} vs 3rd ${poolId}`,
            },
          });
        }

        // Tour 2: Tour 1 winners vs 1st from each pool
        for (let i = 0; i < poolIds.length; i++) {
          const poolId = poolIds[i];
          const t1MatchId = `QT-B${i + 1}-T1`;
          matches.push({
            id: `QT-B${i + 1}-T2`,
            team1: `Winner ${t1MatchId}`,
            team2: `1st-${poolId}`,
            round: 11,
            duration,
            dependencies: [t1MatchId],
            phase,
            metadata: {
              description: `Barrage Tour 2: Winner B${i + 1} vs 1st ${poolId}`,
            },
          });
        }
      } else {
        // qualifyCount === 6, barrage mode
        // Simplified: 1st from each pool qualify directly (4),
        // Best 2 of the 2nds qualify via playoff
        // Tour 1: 2nd vs 2nd serpentin
        const halfCount = Math.floor(poolIds.length / 2);
        for (let i = 0; i < halfCount; i++) {
          const pool1 = poolIds[i];
          const pool2 = poolIds[poolIds.length - 1 - i];
          const deps = [
            ...poolMatchIds(qualPoolPhase.matches, pool1),
            ...poolMatchIds(qualPoolPhase.matches, pool2),
          ];
          matches.push({
            id: `QT-B${i + 1}-T1`,
            team1: `2nd-${pool1}`,
            team2: `2nd-${pool2}`,
            round: 10,
            duration,
            dependencies: deps,
            phase,
            metadata: {
              description: `Barrage: 2nd ${pool1} vs 2nd ${pool2}`,
            },
          });
        }
      }
      break;
    }

    case 'direct': {
      // No transition matches needed — 1st from each pool qualifies
      break;
    }
  }

  return {
    id: 'qualification-transition',
    type: 'qualification-transition',
    label: 'Qualification Transition',
    matches,
    dependsOn: ['qualification-pool'],
  };
}

// ─────────────────────────────────────────────────────────────
// Main draw phases
// ─────────────────────────────────────────────────────────────

function generateMainDrawPoolPhase(
  config: TournamentConfig,
  qualifiedCount: number,
  priorPhaseMatchIds: string[]
): TournamentPhase {
  const mdPoolConfig = config.mainDraw.poolPhase!;
  const poolFormat = mdPoolConfig.poolFormat;

  const distConfig: DistributionConfig = {
    ...mdPoolConfig.distributionConfig,
    templateFor4Teams: poolFormat === 'brazilian'
      ? PoolTemplate.BRAZILIAN_4
      : PoolTemplate.STANDARD_4,
  };

  // Create placeholder teams for the main draw pools
  const placeholderTeams: Team[] = [];
  for (let i = 0; i < qualifiedCount; i++) {
    placeholderTeams.push({
      id: `MD-team-${i + 1}`,
      name: `Qualified #${i + 1}`,
      seed: i + 1,
    });
  }

  const distribution = distributeTeamsToPools(
    placeholderTeams,
    mdPoolConfig.poolCount,
    distConfig
  );

  const allMatches: TournamentMatch[] = [];
  for (const pool of distribution.pools) {
    const poolMatches = generatePoolMatches(
      pool,
      mdPoolConfig.matchFormat,
      'MD'
    );

    // Offset rounds to main-draw range
    for (const m of poolMatches) {
      m.round = m.round + 19; // round 1 -> 20, round 2 -> 21, etc.
      // Add dependencies on prior phase
      m.dependencies = [...(m.dependencies || []), ...priorPhaseMatchIds];
    }

    allMatches.push(...poolMatches);
  }

  return {
    id: 'main-draw-pool',
    type: 'main-draw-pool',
    label: 'Main Draw Pools',
    matches: allMatches,
    pools: distribution.pools,
    dependsOn: ['qualification-transition'],
  };
}

function generateMainDrawTransition(
  config: TournamentConfig,
  mdPoolPhase: TournamentPhase
): TournamentPhase {
  const transConfig = config.mainDraw.transition!;
  const pools = mdPoolPhase.pools!;
  const poolIds = pools.map(p => p.poolId).sort();
  const format = transConfig.matchFormat;
  const duration = estimateMatchDuration(format);
  const phase: PhaseType = 'main-draw-transition';

  const matches: TournamentMatch[] = [];

  switch (transConfig.mode) {
    case 'crossover-simple': {
      for (let i = 0; i < poolIds.length; i++) {
        const pool1 = poolIds[i];
        const pool2 = poolIds[poolIds.length - 1 - i];
        const deps = [
          ...poolMatchIds(mdPoolPhase.matches, pool1),
          ...poolMatchIds(mdPoolPhase.matches, pool2),
        ];
        matches.push({
          id: `MDT-X${i + 1}`,
          team1: `1st-MD-${pool1}`,
          team2: `2nd-MD-${pool2}`,
          round: 30,
          duration,
          dependencies: deps,
          phase,
          metadata: {
            description: `MD Crossover: 1st ${pool1} vs 2nd ${pool2}`,
          },
        });
      }
      break;
    }

    case 'barrage': {
      // Serpentin cross-pool: 2nd-A vs 3rd-D, 2nd-B vs 3rd-C, etc.
      // Pool winners (1st) advance directly to knockout — no Tour 2.
      for (let i = 0; i < poolIds.length; i++) {
        const pool1 = poolIds[i];
        const pool2 = poolIds[poolIds.length - 1 - i];
        const deps = [
          ...poolMatchIds(mdPoolPhase.matches, pool1),
          ...poolMatchIds(mdPoolPhase.matches, pool2),
        ];
        matches.push({
          id: `MDT-B${i + 1}-T1`,
          team1: `2nd-MD-${pool1}`,
          team2: `3rd-MD-${pool2}`,
          round: 30,
          duration,
          dependencies: deps,
          phase,
          metadata: {
            description: `MD Barrage: 2nd ${pool1} vs 3rd ${pool2}`,
          },
        });
      }
      break;
    }

    case 'direct': {
      // No matches needed
      break;
    }
  }

  return {
    id: 'main-draw-transition',
    type: 'main-draw-transition',
    label: 'Main Draw Transition',
    matches,
    dependsOn: ['main-draw-pool'],
  };
}

function generateKnockoutPhase(
  config: TournamentConfig,
  knockoutTeamCount: number,
  priorPhaseMatchIds: string[],
  entriesOverride?: KnockoutTeamEntry[]
): TournamentPhase {
  const entries: KnockoutTeamEntry[] = entriesOverride ?? Array.from(
    { length: knockoutTeamCount },
    (_, i) => ({ teamId: `KO-seed-${i + 1}`, seed: i + 1, label: `Seed ${i + 1}` })
  );

  const matches = generateKnockoutBracket(
    entries,
    config.mainDraw.knockout.matchFormat,
    40
  );

  // Add dependencies on prior phase for QF/SF matches with no existing dependencies
  for (const m of matches) {
    if (!m.dependencies || m.dependencies.length === 0) {
      m.dependencies = [...priorPhaseMatchIds];
    }
  }

  return {
    id: 'knockout',
    type: 'knockout',
    label: 'Knockout',
    matches,
  };
}

// ─────────────────────────────────────────────────────────────
// Determine qualified counts
// ─────────────────────────────────────────────────────────────

function getQualifiedCount(config: TournamentConfig): number {
  if (config.format === 'main-draw-only') {
    return config.teams.length;
  }

  const qual = config.qualification!;
  return qual.transition.qualifyCount;
}

function getKnockoutTeamCount(config: TournamentConfig, qualifiedCount: number): number {
  if (config.mainDraw.type === 'direct-knockout') {
    return qualifiedCount;
  }

  // pools-then-knockout: depends on pool count and transition
  const mdPoolConfig = config.mainDraw.poolPhase!;
  const mdTransition = config.mainDraw.transition;

  if (!mdTransition) {
    // No transition: top 2 from each pool advance (standard convention)
    return mdPoolConfig.poolCount * 2;
  }

  if (mdTransition.mode === 'direct') {
    // Direct: top 2 from each pool advance
    return mdPoolConfig.poolCount * 2;
  }

  if (mdTransition.mode === 'crossover-simple') {
    // Crossover: all pool firsts + crossover match winners
    // With N pools: N crossover matches, N winners advance
    // Plus N firsts who bypass crossover (already qualified)
    // Total = 2 * poolCount
    return mdPoolConfig.poolCount * 2;
  }

  if (mdTransition.mode === 'barrage') {
    // N pool winners (direct) + N barrage winners = 2N teams in knockout
    return mdPoolConfig.poolCount * 2;
  }

  return mdPoolConfig.poolCount;
}

// ─────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────

/**
 * Generates a complete tournament plan from configuration.
 *
 * @param config - Full tournament configuration
 * @returns Complete tournament plan with all phases and matches
 */
export function generateTournament(config: TournamentConfig): TournamentPlan {
  validateTournamentConfig(config);

  const phases: TournamentPhase[] = [];
  const qualifiedCount = getQualifiedCount(config);

  // Step 1: Qualification phase (if applicable)
  if (config.format === 'qualification-main-draw') {
    const qualPoolPhase = generateQualificationPools(config);
    phases.push(qualPoolPhase);

    const qualTransition = generateQualificationTransition(config, qualPoolPhase);
    phases.push(qualTransition);
  }

  // Step 2: Main draw
  if (config.mainDraw.type === 'pools-then-knockout') {
    // Get match IDs from prior phase for dependencies
    const priorMatchIds = phases.length > 0
      ? allMatchIds(phases[phases.length - 1].matches)
      : [];

    const mdPoolPhase = generateMainDrawPoolPhase(config, qualifiedCount, priorMatchIds);
    phases.push(mdPoolPhase);

    if (config.mainDraw.transition) {
      const mdTransition = generateMainDrawTransition(config, mdPoolPhase);
      phases.push(mdTransition);
    }

    const knockoutTeamCount = getKnockoutTeamCount(config, qualifiedCount);
    const priorKnockoutDeps = phases.length > 0
      ? allMatchIds(phases[phases.length - 1].matches)
      : [];

    let knockoutEntries: KnockoutTeamEntry[] | undefined;
    if (config.mainDraw.transition?.mode === 'barrage' && mdPoolPhase.pools) {
      const pIds = mdPoolPhase.pools.map(p => p.poolId).sort();
      knockoutEntries = [
        // Seeds 1..N : pool winners, direct qualifiers
        ...pIds.map((pid, i) => ({
          teamId: `ko-1st-${pid}`,
          seed: i + 1,
          label: `1st-MD-${pid}`,
        })),
        // Seeds N+1..2N : barrage match winners
        ...pIds.map((_, i) => ({
          teamId: `ko-bar-${i + 1}`,
          seed: pIds.length + i + 1,
          label: `Winner MDT-B${i + 1}-T1`,
        })),
      ];
    }

    const knockoutPhase = generateKnockoutPhase(config, knockoutTeamCount, priorKnockoutDeps, knockoutEntries);
    phases.push(knockoutPhase);
  } else {
    // direct-knockout
    const priorMatchIds = phases.length > 0
      ? allMatchIds(phases[phases.length - 1].matches)
      : [];

    const knockoutPhase = generateKnockoutPhase(config, qualifiedCount, priorMatchIds);
    phases.push(knockoutPhase);
  }

  // Step 3: Flatten all matches
  const allMatches = phases.flatMap(p => p.matches);

  // Step 4: Calculate summary
  const totalDuration = allMatches.reduce((sum, m) => sum + m.duration, 0);

  return {
    config,
    phases,
    allMatches,
    summary: {
      totalMatches: allMatches.length,
      totalPhases: phases.length,
      estimatedDuration: totalDuration,
      matchesByPhase: phases.map(p => ({
        phaseId: p.id,
        count: p.matches.length,
      })),
    },
  };
}
