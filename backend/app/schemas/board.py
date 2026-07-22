from pydantic import BaseModel, Field, model_validator


class CardPayload(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str = ""


class ColumnPayload(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    cardIds: list[str] = Field(default_factory=list)


class BoardPayload(BaseModel):
    columns: list[ColumnPayload] = Field(default_factory=list)
    cards: dict[str, CardPayload] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_references(self) -> "BoardPayload":
        known_card_ids = set(self.cards.keys())
        referenced_card_ids: list[str] = []
        for column in self.columns:
            referenced_card_ids.extend(column.cardIds)

        dangling = [card_id for card_id in referenced_card_ids if card_id not in known_card_ids]
        if dangling:
            raise ValueError(f"columns reference unknown card ids: {', '.join(sorted(set(dangling)))}")

        seen_card_ids: set[str] = set()
        duplicate_card_ids: set[str] = set()
        for card_id in referenced_card_ids:
            if card_id in seen_card_ids:
                duplicate_card_ids.add(card_id)
            seen_card_ids.add(card_id)
        if duplicate_card_ids:
            raise ValueError(
                f"card ids referenced more than once across columns: {', '.join(sorted(duplicate_card_ids))}"
            )

        column_ids = [column.id for column in self.columns]
        duplicate_column_ids = {column_id for column_id in column_ids if column_ids.count(column_id) > 1}
        if duplicate_column_ids:
            raise ValueError(f"duplicate column ids: {', '.join(sorted(duplicate_column_ids))}")

        return self


class BoardResponse(BaseModel):
    username: str
    board: BoardPayload
