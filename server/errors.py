"""Shared exception types for the radar backend."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any


class GitHubRequestError(RuntimeError):
    """A GitHub call failed in a way the HTTP layer can translate.

    status_code maps to the HTTP response; code is a stable machine-readable
    identifier used by the frontend; rate carries GitHub rate-limit metadata
    when it is available.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = HTTPStatus.BAD_GATEWAY,
        code: str = "github_request_failed",
        rate: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.rate = rate or {}
