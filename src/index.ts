/**
 * FFVB Volleyball Pool Distribution Library
 *
 * Main exports for the volleyball pool distribution system
 */

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
