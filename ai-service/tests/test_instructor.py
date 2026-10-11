import json
import os

os.environ["APP_ENV"] = "test"
os.environ["AI_SERVICE_SECRET"] = "t" * 40
os.environ["AI_PROVIDER"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.tasks.instructor import QuestionsRequest, parse_questions, questions_prompt  # noqa: E402

client = TestClient(app)
KEY = {"X-Internal-Key": "t" * 40}
LESSON = {
    "title": "Queues",
    "content": "A queue is a first-in, first-out structure. Items join at the rear and leave from the front. "
    "Printers use queues to order jobs. A stack is different: it is last-in, first-out.",
}


def req(**kw):
    return QuestionsRequest(**{"lesson": LESSON, "count": 5, "types": ["single", "multiple", "true_false", "short"], **kw})


def test_summary_and_questions_need_the_key():
    assert client.post("/v1/summary", json={"lesson": LESSON}).status_code == 401
    assert client.post("/v1/questions", json={"lesson": LESSON, "count": 3, "types": ["single"]}).status_code == 401


def test_summary_with_the_mock():
    res = client.post("/v1/summary", json={"lesson": LESSON}, headers=KEY)
    assert res.status_code == 200
    assert "Sample AI summary" in res.json()["summary"] and "- A queue is a first-in" in res.json()["summary"]


def test_questions_with_the_mock_follow_the_request():
    body = {"lesson": LESSON, "count": 4, "types": ["single", "true_false"], "difficulty": "easy"}
    res = client.post("/v1/questions", json=body, headers=KEY)
    assert res.status_code == 200
    data = res.json()
    assert len(data["questions"]) == 4 and data["dropped"] == 0
    assert {q["type"] for q in data["questions"]} == {"single", "true_false"}


def test_request_limits():
    for bad in (
        {"lesson": LESSON, "count": 11, "types": ["single"]},
        {"lesson": LESSON, "count": 0, "types": ["single"]},
        {"lesson": LESSON, "count": 3, "types": []},
        {"lesson": LESSON, "count": 3, "types": ["essay"]},
        {"lesson": {**LESSON, "content": "x" * 50_001}, "count": 3, "types": ["single"]},
        {"lesson": LESSON, "count": 3, "types": ["single"], "student": "x"},
    ):
        assert client.post("/v1/questions", json=bad, headers=KEY).status_code == 422


def test_prompt_lists_the_request():
    p = questions_prompt(req(count=3, types=["short", "short", "single"], difficulty="hard"))
    assert "Number of questions: 3" in p and "Question types: short, single" in p and "Hard:" in p


def test_broken_questions_are_dropped_not_repaired():
    answer = json.dumps(
        {
            "questions": [
                {"type": "single", "text": "Good", "options": ["A", "B", "C"], "correct": [1], "explanation": "x"},
                {"type": "single", "text": "Two correct", "options": ["A", "B"], "correct": [0, 1]},
                {"type": "single", "text": "Out of range", "options": ["A", "B"], "correct": [5]},
                {"type": "single", "text": "Same options", "options": ["A", "a"], "correct": [0]},
                {"type": "multiple", "text": "Good multi", "options": ["A", "B", "C"], "correct": [0, 2]},
                {"type": "true_false", "text": "No answer"},
                {"type": "true_false", "text": "Good tf", "correct_bool": False, "options": ["junk"]},
                {"type": "short", "text": "No accepted"},
                {"type": "short", "text": "Good short", "accepted_answers": ["queue"]},
                {"type": "essay", "text": "Unknown type"},
                "not even an object",
            ]
        }
    )
    kept, dropped = parse_questions(answer, req(count=10))
    assert [q.text for q in kept] == ["Good", "Good multi", "Good tf", "Good short"]
    assert dropped == 7
    # Fields that don't belong to the type are cleared.
    assert kept[2].options == []


def test_only_allowed_types_and_count_are_kept():
    answer = json.dumps({"questions": [{"type": "true_false", "text": f"Q{i}", "correct_bool": True} for i in range(5)]})
    kept, dropped = parse_questions(answer, req(count=2, types=["true_false"]))
    assert len(kept) == 2 and dropped == 0
    kept, dropped = parse_questions(answer, req(types=["single"]))
    assert kept == [] and dropped == 5


def test_json_in_a_code_block_is_accepted():
    answer = '```json\n{"questions": [{"type": "true_false", "text": "Q", "correct_bool": true}]}\n```'
    assert len(parse_questions(answer, req())[0]) == 1


def test_unusable_answers_are_a_502(monkeypatch):
    async def prose(**_):
        return "Sure! Here are some questions: ..."

    monkeypatch.setattr(app.state.provider, "complete", prose)
    res = client.post("/v1/questions", json={"lesson": LESSON, "count": 3, "types": ["single"]}, headers=KEY)
    assert res.status_code == 502

    async def none_usable(**_):
        return json.dumps({"questions": [{"type": "single", "text": "x", "options": ["A"], "correct": [3]}]})

    monkeypatch.setattr(app.state.provider, "complete", none_usable)
    res = client.post("/v1/questions", json={"lesson": LESSON, "count": 3, "types": ["single"]}, headers=KEY)
    assert res.status_code == 502
