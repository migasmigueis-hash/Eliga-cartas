// Gerado a partir de src/App.jsx (TEAMS + TEAM_RANK) — usado para
// escolher adversários e a sua força na simulação de jornada.

export interface JornadaTeam { id: string; name: string; rank: number; }

export const JORNADA_TEAMS: JornadaTeam[] = [
  {
    "id": "benfica",
    "name": "SL Benfica Esports",
    "rank": 1
  },
  {
    "id": "sporting",
    "name": "Sporting CP | IGW",
    "rank": 5
  },
  {
    "id": "porto",
    "name": "FC Porto | Luna",
    "rank": 8
  },
  {
    "id": "braga",
    "name": "SC Braga | EGN ESPORTS",
    "rank": 16
  },
  {
    "id": "santaclara",
    "name": "Santa Clara",
    "rank": 2
  },
  {
    "id": "estrela",
    "name": "Estrela Amadora Fluxo W7M",
    "rank": 3
  },
  {
    "id": "estoril",
    "name": "Estoril Praia",
    "rank": 12
  },
  {
    "id": "gilvicente",
    "name": "Gil Vicente FC",
    "rank": 11
  },
  {
    "id": "arouca",
    "name": "FC Arouca by Quest | OGM",
    "rank": 7
  },
  {
    "id": "tondela",
    "name": "CD Tondela | Apogee",
    "rank": 13
  },
  {
    "id": "moreirense",
    "name": "Moreirense FC",
    "rank": 4
  },
  {
    "id": "famalicao",
    "name": "FC Famalicão",
    "rank": 9
  },
  {
    "id": "vitoria",
    "name": "Vitória SC | ISG",
    "rank": 15
  },
  {
    "id": "rioave",
    "name": "Rio Ave FC",
    "rank": 14
  },
  {
    "id": "casapia",
    "name": "Casa Pia AC | Grow uP",
    "rank": 17
  },
  {
    "id": "nacional",
    "name": "CD Nacional",
    "rank": 18
  },
  {
    "id": "afs",
    "name": "AFS | TxT Gaming",
    "rank": 6
  },
  {
    "id": "alverca",
    "name": "FC Alverca | GOAT",
    "rank": 10
  }
];

export const TEAM_RANK: Record<string, number> = Object.fromEntries(JORNADA_TEAMS.map((t) => [t.id, t.rank]));
