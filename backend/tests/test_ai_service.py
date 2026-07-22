import pytest

from app.services.ai_service import AIProviderError, parse_structured_output


def test_parse_structured_output_accepts_response_only_payload() -> None:
    output = parse_structured_output('{"response":"ok","board_update":null}')
    assert output.response == "ok"
    assert output.board_update is None


def test_parse_structured_output_rejects_non_json_payload() -> None:
    with pytest.raises(AIProviderError):
        parse_structured_output("not-json")


def test_parse_structured_output_rejects_invalid_board_update_shape() -> None:
    invalid_payload = """
    {
      "response": "attempted update",
      "board_update": {
        "columns": [{"id": "c1", "title": "Todo", "cardIds": ["missing-card"]}],
        "cards": {}
      }
    }
    """
    with pytest.raises(AIProviderError):
        parse_structured_output(invalid_payload)


def test_parse_structured_output_rejects_duplicate_card_reference() -> None:
    invalid_payload = """
    {
      "response": "attempted update",
      "board_update": {
        "columns": [{"id": "c1", "title": "Todo", "cardIds": ["card-1", "card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "Task", "details": ""}}
      }
    }
    """
    with pytest.raises(AIProviderError):
        parse_structured_output(invalid_payload)
