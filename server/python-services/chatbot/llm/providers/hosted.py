import json
from typing import Any, Dict, Optional, Sequence

import httpx

from chatbot.llm.exceptions import (
    LLMConfigurationError,
    LLMConnectionError,
    LLMInvalidResponseError,
    LLMModelNotFoundError,
    LLMTimeoutError,
)
from chatbot.llm.models import LLMMessage, LLMResponse, LLMToolCall
from chatbot.llm.providers.base import LLMProvider


class FutureHostedProvider(LLMProvider):
    """
    Provider for hosted services exposing an OpenAI-compatible
    POST /v1/chat/completions endpoint.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 120,
    ) -> None:
        if not base_url:
            raise LLMConfigurationError(
                "HOSTED_LLM_BASE_URL is required."
            )

        if not api_key:
            raise LLMConfigurationError(
                "HOSTED_LLM_API_KEY is required."
            )

        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = httpx.Timeout(timeout_seconds)

    @property
    def provider_name(self) -> str:
        return "hosted"

    @property
    def model_name(self) -> str:
        return self._model

    async def chat(
        self,
        messages: Sequence[LLMMessage],
        temperature: float = 0.2,
        tools: Optional[Sequence[Dict[str, Any]]] = None,
    ) -> LLMResponse:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        serialized_messages = []

        for message in messages:
            serialized_message: Dict[str, Any] = {
                "role": message.role,
                "content": message.content,
            }

            if message.tool_calls:
                serialized_message["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.name,
                            "arguments": json.dumps(tool_call.arguments),
                        },
                    }
                    for tool_call in message.tool_calls
                ]

            if message.role == "tool" and message.tool_call_id:
                serialized_message["tool_call_id"] = (
                    message.tool_call_id
                )

            serialized_messages.append(serialized_message)

        payload: Dict[str, Any] = {
            "model": self._model,
            "messages": serialized_messages,
            "temperature": temperature,
        }

        if tools:
            payload["tools"] = list(tools)

        try:
            async with httpx.AsyncClient(
                timeout=self._timeout
            ) as client:
                response = await client.post(
                    f"{self._base_url}/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(
                "The hosted LLM provider exceeded the timeout."
            ) from exc

        except httpx.ConnectError as exc:
            raise LLMConnectionError(
                "Could not connect to the hosted LLM provider."
            ) from exc

        except httpx.HTTPError as exc:
            raise LLMConnectionError(
                f"Hosted LLM request failed: {exc}"
            ) from exc

        if response.status_code == 404:
            raise LLMModelNotFoundError(
                f"Hosted model '{self._model}' was not found."
            )

        if response.status_code in (401, 403):
            raise LLMConfigurationError(
                "The hosted provider rejected the API key."
            )

        if response.status_code >= 400:
            raise LLMConnectionError(
                f"Hosted provider returned HTTP "
                f"{response.status_code}: {response.text}"
            )

        try:
            data = response.json()
            choice = data["choices"][0]
            response_message = choice["message"]
            content = response_message.get("content") or ""
            raw_tool_calls = response_message.get("tool_calls") or []
        except (
            KeyError,
            IndexError,
            TypeError,
            ValueError,
        ) as exc:
            raise LLMInvalidResponseError(
                "The hosted provider returned an unexpected response."
            ) from exc

        if not isinstance(content, str):
            raise LLMInvalidResponseError(
                "The hosted provider returned invalid message content."
            )

        tool_calls = []

        if not isinstance(raw_tool_calls, list):
            raise LLMInvalidResponseError(
                "The hosted provider returned invalid tool calls."
            )

        for raw_call in raw_tool_calls:
            try:
                function = raw_call["function"]
                name = function["name"]
                raw_arguments = function.get("arguments", "{}")

                if isinstance(raw_arguments, str):
                    arguments = json.loads(raw_arguments)
                else:
                    arguments = raw_arguments
            except (KeyError, TypeError, ValueError) as exc:
                raise LLMInvalidResponseError(
                    "The hosted provider returned an invalid tool call."
                ) from exc

            if not isinstance(name, str) or not name.strip():
                raise LLMInvalidResponseError(
                    "The hosted provider returned a tool call without a name."
                )

            if not isinstance(arguments, dict):
                raise LLMInvalidResponseError(
                    "The hosted provider returned invalid tool arguments."
                )

            tool_calls.append(
                LLMToolCall(
                    name=name.strip(),
                    arguments=arguments,
                    id=raw_call.get("id"),
                )
            )

        if not content.strip() and not tool_calls:
            raise LLMInvalidResponseError(
                "The hosted provider returned an empty response."
            )

        usage = data.get("usage", {})

        return LLMResponse(
            content=content.strip(),
            provider=self.provider_name,
            model=data.get("model", self._model),
            finish_reason=choice.get("finish_reason"),
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            tool_calls=tool_calls,
        )

    async def health_check(self) -> bool:
        # Providers differ in whether they expose a health or models endpoint.
        # Valid configuration is sufficient for this initial implementation.
        return bool(
            self._base_url
            and self._api_key
            and self._model
        )
