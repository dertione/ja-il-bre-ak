/**
 * Practical examples of FFVB pool distribution
 */

import { distributeTeamsToPools, Team, PoolTemplate } from '../src';

// Example 1: Classic FFVB case - 13 teams in 4 pools
console.log("=== EXEMPLE 1: 13 équipes en 4 poules (Cas FFVB classique) ===\n");

const teams13: Team[] = [
  { id: 1, name: "Paris VB", seed: 1 },
  { id: 2, name: "Lyon VB", seed: 2 },
  { id: 3, name: "Marseille VB", seed: 3 },
  { id: 4, name: "Toulouse VB", seed: 4 },
  { id: 5, name: "Nice VB", seed: 5 },
  { id: 6, name: "Nantes VB", seed: 6 },
  { id: 7, name: "Strasbourg VB", seed: 7 },
  { id: 8, name: "Bordeaux VB", seed: 8 },
  { id: 9, name: "Lille VB", seed: 9 },
  { id: 10, name: "Rennes VB", seed: 10 },
  { id: 11, name: "Montpellier VB", seed: 11 },
  { id: 12, name: "Reims VB", seed: 12 },
  { id: 13, name: "Le Havre VB", seed: 13 },
];

const result1 = distributeTeamsToPools(teams13, 4);

console.log(`Total: ${result1.summary.totalTeams} équipes en ${result1.summary.totalPools} poules`);
console.log(`Répartition: ${result1.summary.poolSizes.map(s => `${s.count}×${s.size}`).join(', ')}\n`);

result1.pools.forEach(pool => {
  console.log(`\nPoule ${pool.poolId} (${pool.size} équipes) - ${pool.template}`);
  console.log("─".repeat(60));
  pool.teams.forEach(team => {
    console.log(`  Seed #${team.seed.toString().padStart(2)} - ${team.name}`);
  });
});

// Example 2: Perfect division - 16 teams in 4 pools
console.log("\n\n=== EXEMPLE 2: 16 équipes en 4 poules (Division parfaite) ===\n");

const teams16: Team[] = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  name: `Équipe ${i + 1}`,
  seed: i + 1,
}));

const result2 = distributeTeamsToPools(teams16, 4);

result2.pools.forEach(pool => {
  const seeds = pool.teams.map(t => t.seed).join(', ');
  console.log(`Poule ${pool.poolId}: Seeds [${seeds}]`);
});

// Example 3: Regional tournament - 10 teams in 3 pools
console.log("\n\n=== EXEMPLE 3: Tournoi Régional - 10 équipes en 3 poules ===\n");

const teams10: Team[] = [
  { id: 1, name: "AS Cannes", seed: 1, division: "N1" },
  { id: 2, name: "Tours VB", seed: 2, division: "N1" },
  { id: 3, name: "Arago de Sète", seed: 3, division: "N2" },
  { id: 4, name: "Saint-Nazaire VB", seed: 4, division: "N2" },
  { id: 5, name: "Ajaccio VB", seed: 5, division: "N2" },
  { id: 6, name: "Cambrai VB", seed: 6, division: "N3" },
  { id: 7, name: "Martigues VB", seed: 7, division: "N3" },
  { id: 8, name: "Fréjus VB", seed: 8, division: "N3" },
  { id: 9, name: "Calais VB", seed: 9, division: "Reg" },
  { id: 10, name: "Béziers VB", seed: 10, division: "Reg" },
];

const result3 = distributeTeamsToPools(teams10, 3);

result3.pools.forEach(pool => {
  console.log(`\nPoule ${pool.poolId} (${pool.size} équipes) - ${pool.template}`);
  console.log("─".repeat(60));
  pool.teams.forEach(team => {
    console.log(`  #${team.seed} ${team.name.padEnd(25)} [${team.division}]`);
  });
});

// Example 4: Custom template configuration
console.log("\n\n=== EXEMPLE 4: Configuration personnalisée des templates ===\n");

const teams8: Team[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: `Club ${String.fromCharCode(65 + i)}`,
  seed: i + 1,
}));

const result4 = distributeTeamsToPools(teams8, 2, {
  templateFor4Teams: PoolTemplate.STANDARD_4,  // Instead of BRAZILIAN_4
});

result4.pools.forEach(pool => {
  console.log(`Poule ${pool.poolId}: ${pool.template}`);
  console.log(`  Équipes: ${pool.teams.map(t => t.name).join(', ')}`);
});

// Example 5: Verification of snake seeding balance
console.log("\n\n=== EXEMPLE 5: Vérification de l'équilibre du Serpentin ===\n");

const teams20: Team[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Équipe ${i + 1}`,
  seed: i + 1,
}));

const result5 = distributeTeamsToPools(teams20, 5);

console.log("Somme des seeds par poule (plus c'est proche, mieux c'est équilibré):\n");

result5.pools.forEach(pool => {
  const seedSum = pool.teams.reduce((sum, team) => sum + team.seed, 0);
  const avgSeed = (seedSum / pool.teams.length).toFixed(1);
  console.log(`Poule ${pool.poolId}: Somme=${seedSum.toString().padStart(3)}, Moyenne=${avgSeed.padStart(4)}`);
});

console.log("\n✅ Tous les exemples ont été exécutés avec succès!");
