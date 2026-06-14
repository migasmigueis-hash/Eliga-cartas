// Gerado a partir de src/App.jsx (POOL) — id, raridade, clube/edição.
// Mantém isto em sincronia se adicionares/alterares cartas no jogo.
export type Rarity = "comum" | "rara" | "epica" | "lendaria";

export interface CardRef {
  id: string;
  rarity: Rarity;
  team: string | null;
  isClub: boolean;
  isCaster: boolean;
  edition: string | null;
}

export const CARD_POOL: CardRef[] = [
  {
    "id": "club-benfica",
    "rarity": "epica",
    "team": "benfica",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-sporting",
    "rarity": "rara",
    "team": "sporting",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-porto",
    "rarity": "rara",
    "team": "porto",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-braga",
    "rarity": "comum",
    "team": "braga",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-santaclara",
    "rarity": "epica",
    "team": "santaclara",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-estrela",
    "rarity": "rara",
    "team": "estrela",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-estoril",
    "rarity": "comum",
    "team": "estoril",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-gilvicente",
    "rarity": "comum",
    "team": "gilvicente",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-arouca",
    "rarity": "rara",
    "team": "arouca",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-tondela",
    "rarity": "comum",
    "team": "tondela",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-moreirense",
    "rarity": "rara",
    "team": "moreirense",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-famalicao",
    "rarity": "comum",
    "team": "famalicao",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-vitoria",
    "rarity": "comum",
    "team": "vitoria",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-rioave",
    "rarity": "comum",
    "team": "rioave",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-casapia",
    "rarity": "comum",
    "team": "casapia",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-nacional",
    "rarity": "comum",
    "team": "nacional",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-afs",
    "rarity": "rara",
    "team": "afs",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "club-alverca",
    "rarity": "comum",
    "team": "alverca",
    "isClub": true,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-leks",
    "rarity": "epica",
    "team": "benfica",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-marqzou",
    "rarity": "rara",
    "team": "benfica",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-tundi",
    "rarity": "epica",
    "team": "santaclara",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-gugaferraz",
    "rarity": "epica",
    "team": "santaclara",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-diogopeyroteo",
    "rarity": "rara",
    "team": "sporting",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-bret4o",
    "rarity": "comum",
    "team": "sporting",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-peter16",
    "rarity": "rara",
    "team": "porto",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-diogosilva",
    "rarity": "rara",
    "team": "porto",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-jperes99",
    "rarity": "comum",
    "team": "braga",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-rikhard",
    "rarity": "comum",
    "team": "braga",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-mike27",
    "rarity": "comum",
    "team": "estrela",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-gueric",
    "rarity": "epica",
    "team": "estrela",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-lucanr1",
    "rarity": "epica",
    "team": "moreirense",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-licapu",
    "rarity": "comum",
    "team": "estoril",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-zitsubasa",
    "rarity": "rara",
    "team": "gilvicente",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-jotapb10",
    "rarity": "rara",
    "team": "arouca",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-guiddias",
    "rarity": "comum",
    "team": "arouca",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-darkley11",
    "rarity": "rara",
    "team": "tondela",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-vinagrolih",
    "rarity": "comum",
    "team": "famalicao",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-rodr7gol",
    "rarity": "rara",
    "team": "famalicao",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-dekass",
    "rarity": "comum",
    "team": "vitoria",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-skreibar",
    "rarity": "comum",
    "team": "vitoria",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-phoenix",
    "rarity": "comum",
    "team": "rioave",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-rickyp",
    "rarity": "comum",
    "team": "rioave",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-godrafa",
    "rarity": "comum",
    "team": "casapia",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-ggrilo",
    "rarity": "comum",
    "team": "casapia",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-canha14",
    "rarity": "comum",
    "team": "nacional",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-jsilva29",
    "rarity": "rara",
    "team": "afs",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-npena80",
    "rarity": "comum",
    "team": "afs",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "pl-giobundyy",
    "rarity": "rara",
    "team": "alverca",
    "isClub": false,
    "isCaster": false,
    "edition": null
  },
  {
    "id": "cast-donpablo",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": null
  },
  {
    "id": "cast-pickywiky",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": null
  },
  {
    "id": "cast-dantas",
    "rarity": "rara",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": null
  },
  {
    "id": "cast-mucha",
    "rarity": "rara",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": null
  },
  {
    "id": "cast-zeny",
    "rarity": "rara",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": null
  },
  {
    "id": "cast-loureiro",
    "rarity": "rara",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": null
  },
  {
    "id": "sp-leks-finals",
    "rarity": "lendaria",
    "team": "benfica",
    "isClub": false,
    "isCaster": false,
    "edition": "FINALS 25/26"
  },
  {
    "id": "sp-marqzou-finals",
    "rarity": "lendaria",
    "team": "benfica",
    "isClub": false,
    "isCaster": false,
    "edition": "FINALS 25/26"
  },
  {
    "id": "sp-benfica-finals",
    "rarity": "lendaria",
    "team": "benfica",
    "isClub": true,
    "isCaster": false,
    "edition": "FINALS 25/26"
  },
  {
    "id": "sp-tundi-taca",
    "rarity": "lendaria",
    "team": "santaclara",
    "isClub": false,
    "isCaster": false,
    "edition": "TAÇA eLIGA"
  },
  {
    "id": "sp-leks-e1",
    "rarity": "epica",
    "team": "benfica",
    "isClub": false,
    "isCaster": false,
    "edition": "ETAPA 1"
  },
  {
    "id": "sp-marqzou-e1",
    "rarity": "epica",
    "team": "benfica",
    "isClub": false,
    "isCaster": false,
    "edition": "ETAPA 1"
  },
  {
    "id": "sp-guga-e2",
    "rarity": "epica",
    "team": "santaclara",
    "isClub": false,
    "isCaster": false,
    "edition": "ETAPA 2"
  },
  {
    "id": "sp-gueric-e3",
    "rarity": "epica",
    "team": "estrela",
    "isClub": false,
    "isCaster": false,
    "edition": "ETAPA 3"
  },
  {
    "id": "sp-benfica-e1",
    "rarity": "epica",
    "team": "benfica",
    "isClub": true,
    "isCaster": false,
    "edition": "ETAPA 1"
  },
  {
    "id": "sp-santaclara-e2",
    "rarity": "epica",
    "team": "santaclara",
    "isClub": true,
    "isCaster": false,
    "edition": "ETAPA 2"
  },
  {
    "id": "sp-estrela-e3",
    "rarity": "epica",
    "team": "estrela",
    "isClub": true,
    "isCaster": false,
    "edition": "ETAPA 3"
  },
  {
    "id": "sp-donpablo-gf",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": "GRANDE FINAL"
  },
  {
    "id": "sp-pickywiky-gf",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": "GRANDE FINAL"
  },
  {
    "id": "sp-dantas-gf",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": "GRANDE FINAL"
  },
  {
    "id": "sp-mucha-gf",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": "GRANDE FINAL"
  },
  {
    "id": "sp-zeny-gf",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": "GRANDE FINAL"
  },
  {
    "id": "sp-loureiro-gf",
    "rarity": "epica",
    "team": null,
    "isClub": false,
    "isCaster": true,
    "edition": "GRANDE FINAL"
  }
];
