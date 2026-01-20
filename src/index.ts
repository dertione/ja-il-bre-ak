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
