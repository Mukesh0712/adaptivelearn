"""A stand-in model: no API key, no cost, same answer every time.

Lets the whole feature be built and tested before a real model is chosen.
The answers are labelled as samples so nobody mistakes them for real AI.
They are built from the request (e.g. sentences of the lesson), so the
pages look realistic in a demo.
"""

import json
import re


def _section(prompt: str, tag: str) -> str:
    m = re.search(rf"<{tag}>\n(.*?)\n</{tag}>", prompt, re.S)
    return m.group(1) if m else ""


def _line(prompt: str, label: str) -> str:
    # Only after the lesson, so lesson text can't look like a setting.
    m = re.search(rf"^{label}: (.*)$", prompt.rsplit("</lesson>", 1)[-1], re.M)
    return m.group(1).strip() if m else ""


def _sentences(text: str) -> list[str]:
    # Plain sentences from the lesson text, without Markdown symbols.
    plain = re.sub(r"^\s*(?:[-+]|\d+\.)\s+", "", text, flags=re.M)  # list markers
    plain = re.sub(r"[#*_`>\[\]()|]", " ", plain)
    parts = [re.sub(r"\s+", " ", s).strip() for s in re.split(r"(?<=[.!?])\s+|\n+", plain)]
    return [s for s in parts if len(s) > 15] or ["The lesson explains its main idea"]


def _sample_questions(prompt: str) -> str:
    sentences = _sentences(_section(prompt, "lesson"))
    count = int(_line(prompt, "Number of questions") or "3")
    types = [t.strip() for t in _line(prompt, "Question types").split(",") if t.strip()] or ["true_false"]
    questions = []
    for i in range(count):
        s = sentences[i % len(sentences)][:300]
        t = types[i % len(types)]
        q: dict = {"type": t, "explanation": f"[Sample] The lesson says: {s}", "topic": "Sample"}
        if t == "true_false":
            q |= {"text": f"[Sample {i + 1}] True or false: {s}", "correct_bool": True}
        elif t == "single":
            q |= {
                "text": f"[Sample {i + 1}] Which statement is from the lesson?",
                "options": [s, f"The opposite of: {s}"[:500], "Something the lesson never says"],
                "correct": [0],
            }
        elif t == "multiple":
            other = sentences[(i + 1) % len(sentences)][:300]
            q |= {
                "text": f"[Sample {i + 1}] Which statements are from the lesson?",
                "options": [s, f"Not true: {s}"[:500], other if other != s else f"Also: {s}"[:500], "Unrelated statement"],
                "correct": [0, 2],
            }
        else:
            word = max(re.findall(r"[A-Za-z]{4,}", s) or ["lesson"], key=len)
            q |= {"text": f"[Sample {i + 1}] Which word completes it? {s.replace(word, '_____', 1)}", "accepted_answers": [word]}
        questions.append(q)
    return json.dumps({"questions": questions})


def _sample_chat(prompt: str, question: str) -> str:
    # "Retrieval" by shared words: the lesson sentence with the most words
    # in common with the question.
    words = lambda t: {w for w in re.findall(r"[a-z]{4,}", t.lower())}  # noqa: E731
    asked = words(question)
    best = max(_sentences(_section(prompt, "lesson")), key=lambda s: len(asked & words(s)))
    if not asked & words(best):
        return "**[Sample AI answer]** The lesson doesn't seem to cover that. Try asking your instructor."
    return f"**[Sample AI answer]** The lesson says: {best}"


class MockProvider:
    name = "mock"
    model = "mock-1"

    async def complete(self, *, system: str, prompt: str, max_tokens: int, json_schema: dict | None = None) -> str:
        if json_schema is not None and json_schema.get("title") == "GeneratedQuestions":
            return _sample_questions(prompt)
        question = _section(prompt, "question")
        if question and _section(prompt, "lesson"):
            return _sample_chat(prompt, question)
        correct = _section(prompt, "correct_answer")
        if correct:
            student = " / ".join(_section(prompt, "student_answer").splitlines())
            return (
                f'**[Sample AI explanation]** You answered "{student}", but the correct answer is '
                f'"{" / ".join(correct.splitlines())}". A real AI model would explain here why, and what to revise.'
            )
        lesson = _section(prompt, "lesson")
        if lesson:
            bullets = "\n".join(f"- {s}" for s in _sentences(lesson)[:4])
            return f"**[Sample AI summary]** A real AI model would write the key ideas here.\n\n{bullets}"
        first_line = prompt.strip().splitlines()[0] if prompt.strip() else ""
        return f"[Sample AI answer] This is placeholder text for: {first_line[:120]}"
