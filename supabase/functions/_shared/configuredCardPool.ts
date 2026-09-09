import { CARD_POOL, type CardRef } from "./cardpool.ts";

type ConfigRecord = Record<string, unknown>;

export interface PublishedCardBatch {
  id: string;
  name: string;
  cards: CardRef[];
}

const toCardRef = (card: ConfigRecord): CardRef => ({
  id: card.id as string,
  rarity: card.rarity as CardRef["rarity"],
  team: typeof card.team === "string" ? card.team : null,
  isClub: card.isClub === true,
  isCaster: card.isCaster === true,
  edition: typeof card.edition === "string" ? card.edition : null,
});

export function publishedCardBatches(config: ConfigRecord): PublishedCardBatch[] {
  const batches = Array.isArray(config.customBatches) ? config.customBatches as ConfigRecord[] : [];
  return batches
    .filter((batch) => batch.status === "published" && typeof batch.id === "string" && Array.isArray(batch.cards))
    .map((batch) => ({
      id: batch.id as string,
      name: typeof batch.name === "string" ? batch.name : "Edição especial",
      cards: (batch.cards as ConfigRecord[]).map(toCardRef),
    }))
    .filter((batch) => batch.cards.length > 0);
}

export function configuredCardPool(config: ConfigRecord): CardRef[] {
  const overrides = config.baseCardOverrides && typeof config.baseCardOverrides === "object"
    ? config.baseCardOverrides as Record<string, ConfigRecord>
    : {};
  const baseCards = CARD_POOL.map((card) => {
    const override = overrides[card.id] || {};
    return toCardRef({ ...card, ...override, id: card.id, edition: card.edition });
  });
  return [...baseCards, ...publishedCardBatches(config).flatMap((batch) => batch.cards)];
}