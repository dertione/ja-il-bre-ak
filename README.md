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

**Développé avec ❤️ pour la communauté Volleyball**
