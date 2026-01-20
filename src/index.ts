/**
 * FFVB Volleyball Pool Distribution Library
 *
 * Main exports for the volleyball pool distribution system
 */

// Pool Distribution (FFVB Snake Seeding)
export {
  // Main function
  distributeTeamsToPools,

  // Helper functions
  calculatePoolSizes,
  generatePoolIds,
  snakeSeeding,
  getPoolTemplate,

  // Types and interfaces
  Team,
  Pool,
  PoolDistributionResult,
  PoolTemplate,
  DistributionConfig,
} from './poolDistribution';

// Tournament Scheduler (RCPSP Algorithm)
export {
  // Main scheduling function
  scheduleMatches,
  validateSchedule,

  // Types and interfaces
  Match,
  Court,
  SchedulerConfig,
  ScheduledMatch,
  ScheduleResult,
} from './tournamentScheduler';

// Ranking Engine (Pool Phase Results)
export {
  // Main ranking function
  calculatePoolRankings,
  getTeamRank,
  getTeamStats,
  formatRankings,

  // Types and interfaces
  CompletedMatch,
  TeamStats,
  RankedTeam,
  RankingResult,
  BrazilianConfig,
} from './rankingEngine';

// Crossover Engine (Stage Transitions)
export {
  // Main transition function
  generateNextStageMatches,
  validatePoolRankings,
  formatTransitionResult,

  // Types and interfaces
  PoolRankings,
  CrossoverConfig,
  TicketConfig,
  DirectConfig,
  TransitionConfig,
  GeneratedMatch,
  TransitionResult,
} from './crossoverEngine';
