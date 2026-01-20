# 🏐 FFVB Volleyball Pool Distribution

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Distribution d'équipes en poules selon les règles officielles de la FFVB (Fédération Française de Volley-Ball) avec algorithme du Serpentin (Snake Seeding)**

## 📋 Description

Cette bibliothèque implémente l'algorithme officiel de répartition des équipes en poules pour les tournois de volleyball, conforme aux règles FFVB. Elle gère automatiquement :

- ✅ **Répartition des volumes** : Les poules les plus grosses en premier (Poule A, B, C...)
- ✅ **Algorithme du Serpentin** : Distribution en zigzag pour équilibrer le niveau
- ✅ **Templates de poules** : Attribution automatique des templates de matchs selon la taille
- ✅ **Validation complète** : Vérification des seeds, comptage des équipes, etc.

## 🎯 Règles FFVB Implémentées

### 1. Répartition des Volumes

Si le nombre d'équipes n'est pas un multiple du nombre de poules, les **poules les plus grosses sont les premières** :

**Exemple** : 13 équipes / 4 poules
- Poule A : **4 équipes** ⭐
- Poule B : 3 équipes
- Poule C : 3 équipes
- Poule D : 3 équipes

### 2. Algorithme du Serpentin (Snake Seeding)

Les têtes de série sont placées en **zigzag** pour équilibrer le niveau :

**Pattern pour 4 poules :**

| Tour | Direction | Distribution |
|------|-----------|--------------|
| 1 | Aller → | Seed 1→A, 2→B, 3→C, 4→D |
| 2 | Retour ← | Seed 5→D, 6→C, 7→B, 8→A |
| 3 | Aller → | Seed 9→A, 10→B, 11→C, 12→D |
| 4 | Retour ← | Seed 13→D, 14→C, 15→B, 16→A |

**Résultat pour 16 équipes :**
- Poule A : Seeds 1, 8, 9, 16
- Poule B : Seeds 2, 7, 10, 15
- Poule C : Seeds 3, 6, 11, 14
- Poule D : Seeds 4, 5, 12, 13

### 3. Templates de Poules

- **Poule de 4 équipes** → Template "Poule Brésilienne" (ou "Standard 4")
- **Poule de 3 équipes** → Template "Poule Standard 3"

## 🚀 Installation

```bash
npm install
npm run build
```

## 💻 Usage

### Exemple Basique

```typescript
import { distributeTeamsToPools, Team } from './src';

// Créer vos équipes (doivent avoir des seeds de 1 à N)
const teams: Team[] = [
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

// Distribuer en 4 poules
const result = distributeTeamsToPools(teams, 4);

// Afficher le résultat
console.log(JSON.stringify(result, null, 2));
```

### Sortie JSON

```json
{
  "pools": [
    {
      "poolId": "A",
      "size": 4,
      "template": "Poule Brésilienne",
      "teams": [
        { "id": 1, "name": "Paris VB", "seed": 1 },
        { "id": 8, "name": "Bordeaux VB", "seed": 8 },
        { "id": 9, "name": "Lille VB", "seed": 9 },
        { "id": 13, "name": "Le Havre VB", "seed": 13 }
      ]
    },
    {
      "poolId": "B",
      "size": 3,
      "template": "Poule Standard 3",
      "teams": [
        { "id": 2, "name": "Lyon VB", "seed": 2 },
        { "id": 7, "name": "Strasbourg VB", "seed": 7 },
        { "id": 10, "name": "Rennes VB", "seed": 10 }
      ]
    },
    {
      "poolId": "C",
      "size": 3,
      "template": "Poule Standard 3",
      "teams": [
        { "id": 3, "name": "Marseille VB", "seed": 3 },
        { "id": 6, "name": "Nantes VB", "seed": 6 },
        { "id": 11, "name": "Montpellier VB", "seed": 11 }
      ]
    },
    {
      "poolId": "D",
      "size": 3,
      "template": "Poule Standard 3",
      "teams": [
        { "id": 4, "name": "Toulouse VB", "seed": 4 },
        { "id": 5, "name": "Nice VB", "seed": 5 },
        { "id": 12, "name": "Reims VB", "seed": 12 }
      ]
    }
  ],
  "summary": {
    "totalTeams": 13,
    "totalPools": 4,
    "poolSizes": [
      { "size": 4, "count": 1 },
      { "size": 3, "count": 3 }
    ]
  }
}
```

### Configuration Personnalisée

```typescript
import { distributeTeamsToPools, PoolTemplate } from './src';

const result = distributeTeamsToPools(teams, 4, {
  templateFor4Teams: PoolTemplate.STANDARD_4,  // Au lieu de BRAZILIAN_4
  templateFor3Teams: PoolTemplate.STANDARD_3
});
```

### Équipes avec Propriétés Personnalisées

```typescript
const teams: Team[] = [
  {
    id: 1,
    name: "Paris VB",
    seed: 1,
    club: "Paris Volley",
    ranking: 1500,
    division: "Nationale 1"
  },
  // ... autres équipes
];

// Toutes les propriétés personnalisées sont préservées !
const result = distributeTeamsToPools(teams, 4);
```

## 🧪 Tests

```bash
npm test
```

La suite de tests couvre :
- ✅ Calcul des tailles de poules
- ✅ Algorithme du serpentin (tous les cas)
- ✅ Attribution des templates
- ✅ Validation des seeds
- ✅ Scénarios FFVB réels
- ✅ Cas limites et erreurs

## 📊 Exemples de Scénarios

### Championnat Régional : 10 équipes en 3 poules

```typescript
const result = distributeTeamsToPools(teams, 3);
// Résultat : 1 poule de 4 + 2 poules de 3
// Pool A (4): Seeds 1, 6, 7
// Pool B (4): Seeds 2, 5, 8, 10
// Pool C (3): Seeds 3, 4, 9
```

### Championnat National : 20 équipes en 5 poules

```typescript
const result = distributeTeamsToPools(teams, 5);
// Résultat : 5 poules de 4
// Pool A: Seeds 1, 10, 11, 20
// Pool B: Seeds 2, 9, 12, 19
// Pool C: Seeds 3, 8, 13, 18
// Pool D: Seeds 4, 7, 14, 17
// Pool E: Seeds 5, 6, 15, 16
```

## 🔧 API Reference

### `distributeTeamsToPools(teams, poolCount, config?)`

**Paramètres :**
- `teams: Team[]` - Tableau d'équipes (doivent avoir des seeds de 1 à N)
- `poolCount: number` - Nombre de poules à créer
- `config?: DistributionConfig` - Configuration optionnelle

**Retourne :** `PoolDistributionResult`

### Types

```typescript
interface Team {
  id: string | number;
  name: string;
  seed: number;  // 1 = meilleure équipe
  [key: string]: any;  // Propriétés personnalisées
}

interface Pool {
  poolId: string;      // "A", "B", "C"...
  teams: Team[];
  size: number;
  template: PoolTemplate;
}

enum PoolTemplate {
  BRAZILIAN_4 = "Poule Brésilienne",
  STANDARD_4 = "Standard 4",
  STANDARD_3 = "Poule Standard 3"
}
```

## ⚠️ Règles de Validation

L'algorithme valide strictement :
1. ✅ Les seeds doivent être **séquentielles** (1, 2, 3, 4...)
2. ✅ Nombre d'équipes ≥ nombre de poules
3. ✅ Les tableaux ne peuvent pas être vides
4. ✅ Seules les poules de 3 ou 4 équipes sont supportées

## 📄 Licence

MIT

## 👥 Contribution

Les contributions sont les bienvenues ! Assurez-vous que tous les tests passent avant de soumettre une PR.

---

# 🎯 Tournament Scheduler (RCPSP Algorithm)

## 📋 Description

Le **Tournament Scheduler** implémente un algorithme de planification de tournoi basé sur le **RCPSP** (Resource-Constrained Project Scheduling Problem). Il gère automatiquement la planification des matchs en respectant toutes les contraintes physiques et logiques.

## 🔒 Contraintes Implémentées

### Contraintes Lourdes (Hard Constraints)

1. **Dépendance Séquentielle** (DAG)
   - Un match ne peut démarrer que si tous ses prérequis sont terminés
   - Exemple : La finale nécessite que les demi-finales soient finies

2. **Non-Ubiquité des Équipes**
   - Une équipe ne peut pas jouer deux matchs simultanément
   - Garantit l'intégrité physique du tournoi

3. **Temps de Repos Obligatoire**
   - Après un match, une équipe doit se reposer (ex: 15 minutes)
   - Respecte les contraintes physiologiques

4. **Temps de Préparation des Terrains** (optionnel)
   - Délai entre deux matchs sur le même terrain
   - Pour nettoyage, tracé des lignes, etc.

## 🚀 Usage du Scheduler

### Exemple Simple

```typescript
import { scheduleMatches, Match, Court, SchedulerConfig } from './src';

// Définir les équipes
const teams = [
  { id: 1, name: 'Paris Beach' },
  { id: 2, name: 'Lyon Sand' },
  { id: 3, name: 'Marseille Waves' },
  { id: 4, name: 'Nice Spike' },
];

// Définir les matchs avec dépendances
const matches: Match[] = [
  // Demi-finales
  { id: 'SF1', team1: teams[0], team2: teams[1], round: 1, duration: 45 },
  { id: 'SF2', team1: teams[2], team2: teams[3], round: 1, duration: 45 },

  // Finale (dépend des demi-finales)
  {
    id: 'FINAL',
    team1: 'Winner SF1',
    team2: 'Winner SF2',
    round: 2,
    duration: 60,
    dependencies: ['SF1', 'SF2']
  }
];

// Définir les terrains disponibles
const courts: Court[] = [
  { id: 1, name: 'Centre Court' },
  { id: 2, name: 'Court 2' }
];

// Configuration
const config: SchedulerConfig = {
  restTime: 15,              // 15 min de repos obligatoire
  courtSetupTime: 5,         // 5 min de préparation du terrain
  startTime: new Date('2024-06-15T09:00:00Z')
};

// Planifier !
const result = scheduleMatches(matches, courts, config);

// Afficher le planning
result.schedule.forEach(s => {
  console.log(
    `Match ${s.matchId}: Court ${s.courtId}, ` +
    `${s.startTime.toISOString()} - ${s.endTime.toISOString()}`
  );
});
```

### Sortie du Scheduler

```json
{
  "schedule": [
    {
      "matchId": "SF1",
      "courtId": 1,
      "startTime": "2024-06-15T09:00:00.000Z",
      "endTime": "2024-06-15T09:45:00.000Z",
      "round": 1
    },
    {
      "matchId": "SF2",
      "courtId": 2,
      "startTime": "2024-06-15T09:00:00.000Z",
      "endTime": "2024-06-15T09:45:00.000Z",
      "round": 1
    },
    {
      "matchId": "FINAL",
      "courtId": 1,
      "startTime": "2024-06-15T10:05:00.000Z",
      "endTime": "2024-06-15T11:05:00.000Z",
      "round": 2
    }
  ],
  "summary": {
    "totalMatches": 3,
    "totalDuration": 125,
    "courtsUsed": 2,
    "endTime": "2024-06-15T11:05:00.000Z"
  }
}
```

## 🎯 Algorithme de Planification

### Architecture : Task Queue + Event Simulation

```
┌─────────────────────────────────────────────────────────────┐
│  1. INITIALISATION                                          │
│     - Créer file d'attente avec matchs sans dépendances     │
│     - Initialiser état des terrains (libres)                │
│     - Initialiser état des équipes (disponibles)            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. BOUCLE DE SIMULATION                                    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ A. Traiter les événements au temps T                 │  │
│  │    - Libérer terrains                                │  │
│  │    - Mettre équipes en repos (T + restTime)          │  │
│  │    - Débloquer matchs dépendants                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ B. Parcourir file d'attente (par priorité: round)   │  │
│  │    Pour chaque match :                                │  │
│  │    - Vérifier disponibilité équipes                   │  │
│  │    - Vérifier terrains libres                         │  │
│  │    - Si OK : PLANIFIER                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ C. Planifier le match                                │  │
│  │    - Assigner au terrain disponible                   │  │
│  │    - Calculer start_time et end_time                  │  │
│  │    - Marquer équipes occupées                         │  │
│  │    - Créer événement de fin                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  Si rien planifié → Avancer au prochain événement          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. RÉSULTAT                                                │
│     - Planning complet (match → court + horaires)           │
│     - Statistiques (durée, terrains utilisés, etc.)         │
└─────────────────────────────────────────────────────────────┘
```

### Priorités de Planification

1. **Round Number** : Les matchs du Round 1 avant Round 2, etc.
2. **Match ID** : Ordre alphabétique pour consistance
3. **Disponibilité** : Dès que toutes les contraintes sont satisfaites

## 🧪 Validation du Planning

Le scheduler inclut une fonction de validation pour vérifier que toutes les contraintes sont respectées :

```typescript
import { validateSchedule } from './src';

const validation = validateSchedule(result.schedule, matches, config);

if (validation.valid) {
  console.log('✅ Planning valide !');
} else {
  console.log('❌ Erreurs détectées :');
  validation.errors.forEach(err => console.log(`  - ${err}`));
}
```

### Vérifications Effectuées

- ✅ Aucune équipe ne joue plusieurs matchs simultanément
- ✅ Temps de repos respecté entre chaque match
- ✅ Dépendances respectées (ordre chronologique)
- ✅ Tous les matchs sont planifiés

## 📊 Exemples de Scénarios

### Tournoi à 8 Équipes (2 Terrains)

```typescript
// 4 quarts de finale → 2 demi-finales → finale + 3e place
const matches = [
  // Quarts
  { id: 'QF1', team1: t1, team2: t8, round: 1, duration: 45 },
  { id: 'QF2', team1: t4, team2: t5, round: 1, duration: 45 },
  { id: 'QF3', team1: t2, team2: t7, round: 1, duration: 45 },
  { id: 'QF4', team1: t3, team2: t6, round: 1, duration: 45 },

  // Demi-finales
  { id: 'SF1', team1: 'Winner QF1', team2: 'Winner QF2',
    round: 2, duration: 50, dependencies: ['QF1', 'QF2'] },
  { id: 'SF2', team1: 'Winner QF3', team2: 'Winner QF4',
    round: 2, duration: 50, dependencies: ['QF3', 'QF4'] },

  // Finales
  { id: '3RD', team1: 'Loser SF1', team2: 'Loser SF2',
    round: 3, duration: 45, dependencies: ['SF1', 'SF2'] },
  { id: 'FINAL', team1: 'Winner SF1', team2: 'Winner SF2',
    round: 3, duration: 60, dependencies: ['SF1', 'SF2'] }
];

const result = scheduleMatches(matches, courts, {
  restTime: 20,
  courtSetupTime: 5
});

// Durée totale : ~4h30 avec 2 terrains
console.log(`Durée: ${(result.summary.totalDuration / 60).toFixed(1)}h`);
```

### Terrain Unique (Séquentiel)

```typescript
const courts = [{ id: 1, name: 'Court Unique' }];

// Avec un seul terrain, tous les matchs sont séquentiels
// L'algorithme optimise l'ordre pour respecter les dépendances
const result = scheduleMatches(matches, courts, config);

// Les matchs sans dépendances sont planifiés en premier
// Puis les matchs dépendants dès que possible
```

## 🔧 API Reference

### `scheduleMatches(matches, courts, config)`

Planifie tous les matchs en respectant les contraintes.

**Paramètres :**
- `matches: Match[]` - Liste des matchs avec dépendances
- `courts: Court[]` - Terrains disponibles
- `config: SchedulerConfig` - Configuration

**Retourne :** `ScheduleResult`

### Types Principaux

```typescript
interface Match {
  id: string | number;
  team1: Team | string | number;  // Team object ou "Winner M1"
  team2: Team | string | number;
  round: number;                   // Priorité (1, 2, 3...)
  duration: number;                // Durée en minutes
  dependencies?: (string | number)[];  // IDs des matchs prérequis
}

interface Court {
  id: string | number;
  name: string;
}

interface SchedulerConfig {
  restTime: number;           // Minutes de repos entre matchs
  startTime?: Date;           // Heure de début du tournoi
  courtSetupTime?: number;    // Minutes de préparation du terrain
}

interface ScheduledMatch {
  matchId: string | number;
  courtId: string | number;
  startTime: Date;
  endTime: Date;
  round: number;
}
```

## ⚡ Performance

- **Complexité** : O(M × C × T) où M = matchs, C = terrains, T = temps
- **Optimisé pour** : Tournois jusqu'à 100+ matchs
- **Simulation événementielle** : Avance uniquement aux moments critiques
- **File de priorité** : Traite les matchs par round pour optimisation

## 🎓 Cas d'Usage

✅ **Tournois Beach Volley** (2v2, terrains limités, repos important)
✅ **Tournois Indoor** (multi-terrains, phase de poules + KO)
✅ **Compétitions par équipes** (avec contraintes de disponibilité)
✅ **Simulations** (planification hypothétique de tournois)
✅ **Edge Functions** (Deno/Supabase compatible)

## 🐛 Détection d'Erreurs

Le scheduler détecte automatiquement :
- 🔴 Dépendances circulaires (A dépend de B qui dépend de A)
- 🔴 Références invalides (dépendance vers match inexistant)
- 🔴 Deadlocks (situation où aucun match ne peut être planifié)
- 🔴 Configuration invalide (pas de terrains, pas de matchs)

---

**Développé avec ❤️ pour la communauté Volleyball**
