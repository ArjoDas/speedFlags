from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Settings(StrictModel):
    mode: Literal["timed", "practice"] = "timed"
    duration: Literal[30, 45, 60, 120] = 30
    bonus: Literal[0, 5] = 0
    scope: Literal["starter", "all"] = "starter"
    country_ids: list[str] = Field(default_factory=list, max_length=250)


class ContextRequest(StrictModel):
    token: str = Field(min_length=40, max_length=65536)


class AnswerRequest(ContextRequest):
    question_id: str = Field(min_length=1, max_length=100)
    sequence: int = Field(ge=0, le=250, strict=True)
    submission_id: str = Field(pattern=r"^[a-zA-Z0-9-]{8,80}$")
    answer: str = Field(default="", max_length=100)
    skip: bool = False


class Country(BaseModel):
    id: str
    name: str
    aliases: list[str]


class CountryList(BaseModel):
    version: str
    countries: list[Country]


class Question(BaseModel):
    id: str
    sequence: int
    asset_url: str


class Attempt(BaseModel):
    question_id: str
    asset_url: str
    country_ids: list[str]
    accepted_names: list[str]
    answer: str
    result: Literal["correct", "incorrect", "skipped"]


class GameResponse(BaseModel):
    id: str
    token: str
    dataset_version: str
    status: Literal["ready", "playing", "finished"]
    settings: Settings
    server_time: float
    deadline: float | None
    score: int
    attempts: int
    skipped: int
    question: Question | None
    last_attempt: Attempt | None = None
    history: list[Attempt] | None = None
    finish_reason: Literal["time", "deck", "ended", "session"] | None = None
    eligible_best: bool = False


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
