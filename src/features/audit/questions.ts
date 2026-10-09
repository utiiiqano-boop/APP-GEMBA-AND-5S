export type AuditType = 'gemba' | '5s';

export interface AuditQuestion {
  id: string;
  category: string;
  title: string;
  criteria: string[];
}

export const GEMBA_QUESTIONS: AuditQuestion[] = [
  {
    id: 'gemba-mo-1',
    category: "Main d'œuvre",
    title: 'Qualification (Grille de polyvalence)',
    criteria: [
      'Grille de polyvalence lisible et compréhensible',
      'Grille de polyvalence contenant les personnes (MOD/MOI) formés de la ligne/poste',
      'Grille de polyvalence validée par les concernés',
    ],
  },
  {
    id: 'gemba-ma-1',
    category: 'Matière',
    title: 'Etat de rebut',
    criteria: [
      'Quantité de rebut (fini, semi-fini ou composant) entre le réel dans les bennes, les cartes de contrôle aux attributs et sur le galion',
    ],
  },
  {
    id: 'gemba-me-1',
    category: 'Méthode',
    title: 'OK démarrage',
    criteria: [
      'Fiche acceptation et validation de démarrage + check-list de démarrage (si applicable) lisible et remplie',
      'Pièce de démarrage présente sur le poste et bien identifiée avec les fiches de validation démarrage',
    ],
  },
  {
    id: 'gemba-me-2',
    category: 'Méthode',
    title: 'Dossier de Fabrication',
    criteria: [
      'Dossier de fabrication présent sur le poste',
      'Bon état du dossier de fabrication',
      'Dossier de fabrication à jour et validé par les concernés',
    ],
  },
  {
    id: 'gemba-me-3',
    category: 'Méthode',
    title: 'Formulaire (Prod/Qualité)',
    criteria: [
      'Tout formulaire exigé et présent dans le DF : fiche de suivi, fiche de contrôle, … doit être présent sur le poste, lisible et remplie',
      'Les tableaux de marche et les tableaux de bord doivent être à jour et bien remplis',
    ],
  },
  {
    id: 'gemba-me-4',
    category: 'Méthode',
    title: 'HSE',
    criteria: [
      'Un affichage visuel défini le standard du port des EPI',
      'Tout le personnel porte les EPI',
      'Respect tri sélectif',
    ],
  },
  {
    id: 'gemba-mi-1',
    category: 'Milieu',
    title: '5S',
    criteria: [
      "Les 5 axes sont respectés : pas d'objet inutile, chaque chose à sa place et une place pour chaque chose, poste/ligne propre, tous les standards sont affichés et respectés (marquage, instruction de nettoyage, éclairage du poste de contrôle…), dernier résultat 5S affiché",
    ],
  },
  {
    id: 'gemba-mc-1',
    category: 'Machine',
    title: 'Préventif niveau 1',
    criteria: [
      'Check-list maintenance préventive n°1 présente, remplie et respectée',
      "Instruction maintenance préventive n°1 présente et affichée sur le poste",
    ],
  },
  {
    id: 'gemba-mc-2',
    category: 'Machine',
    title: 'Préventif niveau 2',
    criteria: ['Planning de maintenance préventive n°2 affiché et respecté sur le poste'],
  },
  {
    id: 'gemba-mc-3',
    category: 'Machine',
    title: 'POKA YOKE (N/A)',
    criteria: [
      'Fiche de vérification poka yoke présente (dans le DF), remplie et respectée',
      'Liste des poka yoke affichée sur le poste',
    ],
  },
];

export function getQuestions(type: AuditType): AuditQuestion[] {
  return GEMBA_QUESTIONS;
}
