export const TRIVIA = [
  { q: "Quem venceu as Finals 25/26 e é campeão nacional?", opts: ["SL Benfica", "Santa Clara", "Estrela Amadora", "FC Porto"], a: 0 },
  { q: "Que clube venceu a Taça eLiga 25/26?", opts: ["SL Benfica", "Santa Clara", "Sporting CP", "Moreirense"], a: 1 },
  { q: "Quem venceu a Etapa 1 da época 25/26?", opts: ["Santa Clara", "Estrela Amadora", "SL Benfica", "AFS"], a: 2 },
  { q: "Quem venceu a Etapa 2 da época 25/26?", opts: ["Santa Clara", "SL Benfica", "FC Porto", "Arouca"], a: 0 },
  { q: "Quem venceu a Etapa 3 da época 25/26?", opts: ["Moreirense", "Famalicão", "Gil Vicente", "Estrela Amadora"], a: 3 },
  { q: "Que clube terminou em 1º na classificação geral por pontos?", opts: ["SL Benfica", "Santa Clara", "Estrela Amadora", "Sporting CP"], a: 1 },
  { q: "Quantos golos marcou o Luca-NR1 na época 25/26?", opts: ["98", "112", "130", "85"], a: 2 },
  { q: "Quem teve a melhor percentagem de vitórias da época (87.5%)?", opts: ["GugaFerraz", "Leks", "Tundi", "Gueric"], a: 1 },
  { q: "Quantos clubes participam na eLiga Portugal?", opts: ["16", "18", "20", "12"], a: 1 },
  { q: "Que jogador do Alverca marcou 112 golos na época?", opts: ["Giobundyy", "Rodr7gol", "phoenix3687", "Jotapb10"], a: 0 },
  { q: "Qual foi a média de golos por jogo do Leks?", opts: ["4.87", "5.68", "6.13", "6.59"], a: 2 },
  { q: "Quem disputou mais jogos na época 25/26 (22 jogos)?", opts: ["Leks", "Luca-NR1", "Jotapb10", "DiogoPeyroteo9"], a: 1 },
  { q: "Que clube representa o GugaFerraz?", opts: ["SL Benfica", "FC Porto", "Santa Clara", "Braga"], a: 2 },
  { q: "Que clube terminou a geral com 0 pontos?", opts: ["Casa Pia", "Nacional", "Braga", "Rio Ave"], a: 1 },
  { q: "Quem é o pivot da equipa de transmissão da eLiga?", opts: ["Don Pablo", "Dantas", "PickyWiky", "Mucha"], a: 2 },
  { q: "Que clube representa o Gueric, vencedor da Etapa 3?", opts: ["Estrela Amadora", "Moreirense", "Tondela", "Estoril"], a: 0 },
] as const;

export const triviaForDay = (day: string) => {
  const dayNumber = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86400000);
  return TRIVIA[dayNumber % TRIVIA.length];
};
