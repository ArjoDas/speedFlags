import json
import random
import secrets
import time
import zlib
from collections.abc import Callable

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from backend.models import AnswerRequest, Attempt, GameResponse, Question, Settings
from backend.repositories.countries import Countries

MAX_AGE = 3600
MAX_GAME_SECONDS = 900


class GameError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code, self.message, self.status = code, message, status


class GameService:
    def __init__(self, countries: Countries, keys: list[str], clock: Callable[[], float] = time.time):
        if not keys:
            raise ValueError("Set SPEEDFLAGS_KEYS to a Fernet key. See .env.example.")
        self.countries, self.clock = countries, clock
        self.cipher = MultiFernet([Fernet(key.encode()) for key in keys])

    def encode(self, state: dict) -> str:
        payload = zlib.compress(json.dumps(state, separators=(",", ":")).encode())
        return self.cipher.encrypt_at_time(payload, int(self.clock())).decode()

    def decode(self, token: str, game_id: str) -> dict:
        try:
            payload = self.cipher.decrypt_at_time(token.encode(), MAX_AGE, int(self.clock()))
            inflater = zlib.decompressobj()
            raw = inflater.decompress(payload, 128_000)
            if not inflater.eof or inflater.unconsumed_tail:
                raise ValueError("Oversized state")
            state = json.loads(raw)
        except (InvalidToken, ValueError, zlib.error, UnicodeError):
            raise GameError("invalid_context", "This game has expired or is invalid. Start a new game.", 401) from None
        if state.get("id") != game_id:
            raise GameError("wrong_game", "This answer belongs to another game.", 409)
        if state.get("version") != self.countries.version or state.get("rules") != 1:
            raise GameError("dataset_changed", "The game data has been updated. Start a new game.", 409)
        if self.clock() - state["created"] >= MAX_AGE:
            raise GameError("expired", "This game has expired. Start a new game.", 410)
        return state

    def create(self, settings: Settings) -> GameResponse:
        if settings.country_ids and settings.mode != "practice":
            raise GameError("invalid_settings", "Custom lists are available in practice only.")
        if any(code not in self.countries.by_id for code in settings.country_ids):
            raise GameError("unknown_country", "The practice list contains an unknown country.")
        deck = self.countries.deck(settings.scope, settings.country_ids)
        if not deck:
            raise GameError("empty_deck", "No flags match these settings.")
        random.SystemRandom().shuffle(deck)
        now = self.clock()
        state = {
            "id": secrets.token_hex(16),
            "version": self.countries.version,
            "rules": 1,
            "created": now,
            "start": None,
            "deadline": None,
            "settings": settings.model_dump(),
            "deck": deck,
            "history": [],
            "score": 0,
            "status": "ready",
            "reason": None,
        }
        return self.response(state)

    def start(self, game_id: str, token: str) -> GameResponse:
        state = self.decode(token, game_id)
        if state["status"] != "ready":
            raise GameError("already_started", "This game has already started.", 409)
        now = self.clock()
        state.update(
            status="playing",
            start=now,
            deadline=now + state["settings"]["duration"] if state["settings"]["mode"] == "timed" else None,
        )
        return self.response(state)

    def expire(self, state: dict) -> bool:
        now = self.clock()
        if state["status"] == "playing":
            if now - state["start"] >= MAX_GAME_SECONDS:
                state.update(status="finished", reason="session")
            elif state["deadline"] is not None and now >= state["deadline"]:
                state.update(status="finished", reason="time")
        return state["status"] == "finished"

    def question_id(self, state: dict, index: int) -> str:
        return f"{state['id']}:{index}"

    def answer(self, game_id: str, request: AnswerRequest) -> GameResponse:
        state = self.decode(request.token, game_id)
        if state["status"] != "playing":
            raise GameError("not_playing", "This game is not accepting answers.", 409)
        index = len(state["history"])
        if request.sequence != index or request.question_id != self.question_id(state, index):
            raise GameError("stale_question", "This question has already changed. Retry or start a new game.", 409)
        if self.expire(state):
            return self.response(state)
        if not request.skip and not request.answer.strip():
            raise GameError("empty_answer", "Type an answer or use Skip.")
        asset = state["deck"][index]
        result = (
            "skipped" if request.skip else "correct" if self.countries.correct(asset, request.answer) else "incorrect"
        )
        state["history"].append([request.answer if not request.skip else "", result])
        if result == "correct":
            state["score"] += 1
            if state["deadline"] is not None:
                state["deadline"] = min(
                    state["deadline"] + state["settings"]["bonus"], state["start"] + MAX_GAME_SECONDS
                )
        if len(state["history"]) == len(state["deck"]):
            state.update(status="finished", reason="deck")
        return self.response(state)

    def finish(self, game_id: str, token: str) -> GameResponse:
        state = self.decode(token, game_id)
        if state["status"] == "ready":
            raise GameError("not_started", "Start the game before finishing.", 409)
        if not self.expire(state):
            state.update(status="finished", reason="ended")
        return self.response(state)

    def attempt(self, state: dict, index: int) -> Attempt:
        asset = state["deck"][index]
        answer, result = state["history"][index]
        return Attempt(
            question_id=self.question_id(state, index),
            asset_url=f"/flags/{asset}.svg",
            country_ids=self.countries.ids(asset),
            accepted_names=self.countries.names(asset),
            answer=answer,
            result=result,
        )

    def response(self, state: dict) -> GameResponse:
        index = len(state["history"])
        finished = state["status"] == "finished"
        question = (
            None
            if finished
            else Question(
                id=self.question_id(state, index), sequence=index, asset_url=f"/flags/{state['deck'][index]}.svg"
            )
        )
        return GameResponse(
            id=state["id"],
            token=self.encode(state),
            dataset_version=state["version"],
            status=state["status"],
            settings=state["settings"],
            server_time=self.clock(),
            deadline=state["deadline"],
            score=state["score"],
            attempts=index,
            skipped=sum(row[1] == "skipped" for row in state["history"]),
            question=question,
            last_attempt=self.attempt(state, index - 1) if index else None,
            history=[self.attempt(state, i) for i in range(index)] if finished else None,
            finish_reason=state["reason"],
            eligible_best=finished and state["settings"]["mode"] == "timed" and state["reason"] in {"time", "deck"},
        )
