export interface Audit5SQuestion {
  id: string;
  step: string;      // S1, S2, S3, S4, S5
  title: string;     // "Eliminer" etc.
  subtitle: string;  // the philosophy line
  label: string;     // S11, S12...
  text: string;      // full criterion text
}

export interface Audit5SSection {
  step: string;
  title: string;
  subtitle: string;
  questions: Audit5SQuestion[];
}

const raw: Omit<Audit5SQuestion, 'step' | 'title' | 'subtitle'>[] = [
  // S1 — Eliminer
  { label: 'S11', text: "Pas d'objets inutiles (outils, matériaux, ...) non liés au processus/production en cours (également dans les armoires, casiers)" },
  { label: 'S12', text: "Pas d'affichages inutiles" },
  { label: 'S13', text: 'Les équipements et outillages partagés par plusieurs lignes/postes sont placés dans un espace commun' },
  { label: 'S14', text: "Pas d'objet, outillage, matériel, produit chimique,… présentant un risque sécurité" },
  // S2 — Ranger
  { label: 'S21', text: 'Tous les éléments mobiles (outillage, gabarit) ont un emplacement de stockage défini' },
  { label: 'S22', text: "Les objets fréquemment utilisés sont situés à proximité de leur point d'utilisation" },
  { label: 'S23', text: "Chaque chose à sa place, lorsqu'elle n'est pas utilisée" },
  { label: 'S24', text: 'Tous les objets sont dans leur état standard (armoires électriques, tiroirs, couvercles fermés, produit présentant un risque sécurité, ...)' },
  { label: 'S25', text: 'Un marquage au sol est réalisé' },
  { label: 'S26', text: 'Accès' },
  // S3 — Nettoyer
  { label: 'S31', text: "La zone de travail est propre et en bon état : sol, zoning, machines et équipements, câbles, outillages, conteneurs, postes et table de contrôle, documentation, armoires, racks, étagères, panneaux de signalisation, QRAP, autres panneaux d'information, …" },
  { label: 'S32', text: "Les sources de saleté (fuite d'eau, d'huile) sont détectées et assignées pour l'élimination" },
  { label: 'S33', text: 'Kit de nettoyage disponible, accessible et adapté' },
  { label: 'S34', text: 'Tri sélectif des déchets / rebuts est respecté' },
  // S4 — Standardiser
  { label: 'S41', text: "Chaque lieu de stockage défini pour un objet mobile (outillage, gabarit de contrôle,...) est identifié" },
  { label: 'S42', text: 'Les conditions standards Visuel 5S du périmètre sont respectées (y compris les armoires, tiroirs, luminaires et surfaces en contact direct avec le produit)' },
  { label: 'S43', text: 'Tous les objets/contenants (y compris pour déchets) sont clairement identifiés' },
  { label: 'S44', text: 'Les instructions de nettoyage (s\'ils existent) et de tri sélectif sont définies' },
  { label: 'S45', text: 'Un standard de kit de nettoyage est défini' },
  { label: 'S46', text: 'Un affichage visuel défini le standard du port des EPI' },
  { label: 'S47', text: 'Marquage des zones, des canalisations et des équipements est réalisé' },
  // S5 — Suivre
  { label: 'S51', text: 'Les standards définis dans la zone sont connus et respectés par tous les membres de l\'équipe (y compris les nouveaux arrivants)' },
  { label: 'S52', text: 'Présence et respect du planning 5S' },
  { label: 'S53', text: 'Le personnel porte les EPI' },
  { label: 'S54', text: 'Tableau de marche et indicateurs du tableau de bord à jour' },
  { label: 'S55', text: 'Le flux de production (layout) est clair et respecté' },
];

export const SECTIONS_5S: Audit5SSection[] = [
  {
    step: 'S1',
    title: 'Eliminer',
    subtitle: 'Distinguer entre ce qui est utile et inutile',
    questions: raw.filter((r) => r.label.startsWith('S1')).map((r) => ({ ...r, step: 'S1', title: 'Eliminer', subtitle: 'Distinguer entre ce qui est utile et inutile' })),
  },
  {
    step: 'S2',
    title: 'Ranger',
    subtitle: 'Une place pour chaque chose et chaque chose à sa place',
    questions: raw.filter((r) => r.label.startsWith('S2')).map((r) => ({ ...r, step: 'S2', title: 'Ranger', subtitle: 'Une place pour chaque chose et chaque chose à sa place' })),
  },
  {
    step: 'S3',
    title: 'Nettoyer',
    subtitle: 'Garder un lieu de travail propre',
    questions: raw.filter((r) => r.label.startsWith('S3')).map((r) => ({ ...r, step: 'S3', title: 'Nettoyer', subtitle: 'Garder un lieu de travail propre' })),
  },
  {
    step: 'S4',
    title: 'Standardiser',
    subtitle: 'Standards et règles de travail visuelles',
    questions: raw.filter((r) => r.label.startsWith('S4')).map((r) => ({ ...r, step: 'S4', title: 'Standardiser', subtitle: 'Standards et règles de travail visuelles' })),
  },
  {
    step: 'S5',
    title: 'Suivre',
    subtitle: 'Maintenir et respecter les standards',
    questions: raw.filter((r) => r.label.startsWith('S5')).map((r) => ({ ...r, step: 'S5', title: 'Suivre', subtitle: 'Maintenir et respecter les standards' })),
  },
];

export const ALL_QUESTIONS_5S: Audit5SQuestion[] = SECTIONS_5S.flatMap((s) => s.questions);

export function getSectionForQuestion(label: string): Audit5SSection | undefined {
  return SECTIONS_5S.find((s) => s.questions.some((q) => q.label === label));
}
