import unittest
from unittest.mock import patch

from chatbot.llm.models import LLMMessage
from chatbot.llm.providers import hosted
from chatbot.llm.providers.hosted import FutureHostedProvider


class HostedProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_forwards_and_parses_tools(self):
        captured = {}

        class FakeResponse:
            status_code = 200
            text = ""

            @staticmethod
            def json():
                return {
                    "model": "hosted-test-model",
                    "choices": [
                        {
                            "finish_reason": "tool_calls",
                            "message": {
                                "content": None,
                                "tool_calls": [
                                    {
                                        "id": "call-1",
                                        "type": "function",
                                        "function": {
                                            "name": "get_nearby_stations",
                                            "arguments": '{"radius_km": 8}',
                                        },
                                    },
                                ],
                            },
                        }
                    ],
                    "usage": {
                        "prompt_tokens": 10,
                        "completion_tokens": 4,
                    },
                }

        class FakeClient:
            def __init__(self, timeout):
                captured["timeout"] = timeout

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, traceback):
                return False

            async def post(self, url, headers, json):
                captured.update(
                    url=url,
                    headers=headers,
                    payload=json,
                )
                return FakeResponse()

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_nearby_stations",
                    "parameters": {"type": "object"},
                },
            }
        ]
        provider = FutureHostedProvider(
            base_url="https://llm.example.test",
            api_key="test-key",
            model="hosted-test-model",
        )

        with patch.object(hosted.httpx, "AsyncClient", FakeClient):
            response = await provider.chat(
                messages=[
                    LLMMessage(role="user", content="Find a charger")
                ],
                tools=tools,
            )

        self.assertEqual(captured["payload"]["tools"], tools)
        self.assertTrue(
            captured["url"].endswith("/v1/chat/completions")
        )
        self.assertEqual(response.content, "")
        self.assertEqual(len(response.tool_calls), 1)
        self.assertEqual(
            response.tool_calls[0].name,
            "get_nearby_stations",
        )
        self.assertEqual(
            response.tool_calls[0].arguments,
            {"radius_km": 8},
        )
        self.assertEqual(response.tool_calls[0].id, "call-1")


if __name__ == "__main__":
    unittest.main()
