import json

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.game.service import GameService
from backend.repositories.countries import Countries, normalize


@pytest.fixture
def setup():
    clock = [1000.0]
    key = Fernet.generate_key().decode()
    service = GameService(Countries(), [key], lambda: clock[0])
    with TestClient(create_app(service)) as client:
        yield service, client, clock, key


def prepare(client, **settings):
    response = client.post("/api/v1/games", json=settings)
    assert response.status_code == 200, response.text
    return response.json()


def start(client, game):
    response = client.post(f"/api/v1/games/{game['id']}/start", json={"token": game["token"]})
    assert response.status_code == 200, response.text
    return response.json()


def submit(client, game, answer="", skip=False, **overrides):
    body = {
        "token": game["token"],
        "question_id": game["question"]["id"],
        "sequence": game["question"]["sequence"],
        "submission_id": "test-submit-0001",
        "answer": answer,
        "skip": skip,
        **overrides,
    }
    return client.post(f"/api/v1/games/{game['id']}/answers", json=body)


def correct_answer(service, game):
    asset = service.decode(game["token"], game["id"])["deck"][game["question"]["sequence"]]
    return service.countries.names(asset)[0]


def test_full_game_and_shared_flags(setup):
    _, client, _, _ = setup
    ready = prepare(client, mode="practice", scope="all", country_ids=["FR"])
    game = start(client, ready)
    response = submit(client, game, "Saint Martin")
    assert response.status_code == 200
    result = response.json()
    assert result["score"] == 1 and result["status"] == "finished"
    assert result["history"][0]["accepted_names"] == ["France", "Saint Martin"]
    assert result["eligible_best"] is False
    assert submit(client, game, "France").json()["score"] == 1  # replay doesn't accumulate; not globally consumed


def test_deadline_is_server_controlled(setup):
    service, client, clock, _ = setup
    game = start(client, prepare(client, duration=30, bonus=5))
    good = submit(client, game, correct_answer(service, game)).json()
    assert good["deadline"] == 1035
    clock[0] = 1035
    final = submit(client, good, correct_answer(service, good)).json()
    assert final["score"] == 1 and final["attempts"] == 1
    assert final["status"] == "finished" and final["eligible_best"]
    assert final["finish_reason"] == "time"


def test_skip_wrong_answer_and_safe_history(setup):
    _, client, _, _ = setup
    game = start(client, prepare(client))
    game = submit(client, game, "<img src=x onerror=alert(1)>").json()
    assert game["score"] == 0 and game["last_attempt"]["result"] == "incorrect"
    game = submit(client, game, skip=True).json()
    assert game["skipped"] == 1 and game["attempts"] == 2
    final = client.post(f"/api/v1/games/{game['id']}/finish", json={"token": game["token"]}).json()
    assert final["finish_reason"] == "ended" and not final["eligible_best"]
    assert final["history"][0]["answer"] == "<img src=x onerror=alert(1)>"


def test_no_repeats_and_stale_questions(setup):
    _, client, _, _ = setup
    game = start(client, prepare(client, mode="practice", scope="all"))
    seen = set()
    for _ in range(245):
        assert game["question"]["asset_url"] not in seen
        seen.add(game["question"]["asset_url"])
        old = game
        game = submit(client, game, skip=True).json()
        stale = submit(client, old, token=game["token"])
        assert stale.status_code == 409
    assert game["status"] == "finished" and len(game["history"]) == 245
    assert len(game["token"]) < 65536


def test_instance_and_key_rotation(setup):
    service, client, clock, key = setup
    game = start(client, prepare(client))
    other = GameService(Countries(), [Fernet.generate_key().decode(), key], lambda: clock[0])
    with TestClient(create_app(other)) as second:
        assert submit(second, game, correct_answer(service, game)).json()["score"] == 1
    bad = GameService(Countries(), [Fernet.generate_key().decode()], lambda: clock[0])
    with TestClient(create_app(bad)) as third:
        assert submit(third, game, "test").status_code == 401


def test_expired_token_and_changed_dataset(setup):
    service, client, clock, _ = setup
    game = start(client, prepare(client))
    clock[0] = 5000
    assert submit(client, game, "test").status_code == 401
    clock[0] = 1000
    service.countries.version = "new-version"
    assert submit(client, game, "test").json()["error"]["code"] == "dataset_changed"


@pytest.mark.parametrize(
    "settings",
    [
        {"duration": 0},
        {"bonus": 99},
        {"mode": "ranked"},
        {"score": 999},
        {"country_ids": ["XX"], "mode": "practice"},
        {"country_ids": ["FR"]},
    ],
)
def test_invalid_settings(setup, settings):
    _, client, _, _ = setup
    assert client.post("/api/v1/games", json=settings).status_code in (400, 422)


def test_invalid_requests_and_errors(setup):
    _, client, _, _ = setup
    ready = prepare(client)
    assert submit(client, ready, "France").status_code == 409
    game = start(client, ready)
    assert submit(client, game).status_code == 400
    assert submit(client, game, "x" * 101).status_code == 422
    assert submit(client, game, token=game["token"][:-10] + "aaaaaaaaaa").status_code == 401
    assert client.post("/api/v1/games/other/start", json={"token": ready["token"]}).status_code == 409
    for value in (None, [], "hello", 10):
        assert (
            client.post(
                "/api/v1/games", content=json.dumps(value), headers={"Content-Type": "application/json"}
            ).status_code
            == 422
        )
    assert client.get("/api/missing").status_code == 404
    response = client.post("/api/v1/games", json={})
    assert response.headers["cache-control"] == "no-store"
    assert "X-Request-ID" in response.headers


def test_answer_metadata_not_in_question(setup):
    _, client, _, _ = setup
    game = prepare(client)
    assert set(game["question"]) == {"id", "sequence", "asset_url"}
    assert game["history"] is None and game["last_attempt"] is None
    countries = client.get("/api/v1/countries").json()["countries"]
    assert len(countries) == 250 and "asset" not in countries[0]


def test_normalization_and_alias_collisions():
    countries = Countries()
    assert normalize("  Côte d’Ivoire ") == normalize("cote d'ivoire")
    assert normalize("Türkiye") == normalize("turkiye")
    assert countries.correct(countries.by_id["CI"]["asset"], "Côte d'Ivoire")
    assert countries.correct(countries.by_id["US"]["asset"], "USA")
    # Generic "Congo" cannot identify two distinct flags.
    countries.alias_assets["congo"] = {countries.by_id["CG"]["asset"], countries.by_id["CD"]["asset"]}
    assert not countries.correct(countries.by_id["CG"]["asset"], "Congo")


def test_missing_key_fails_closed():
    with pytest.raises(ValueError, match="SPEEDFLAGS_KEYS"):
        GameService(Countries(), [])
