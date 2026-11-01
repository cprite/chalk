# Sprint 1: from a drawing to a validated scene

## What was done

- `POST /api/v1/scenes/analyze`: a photo or text becomes a validated `SceneSpec`. Argon returns JSON, and code checks it strictly.
- `POST /api/v1/verify`: the analytic answer for an incline (block and ball) and a `match` or `mismatch` verdict, with a 2% tolerance.
- `POST /api/v1/scenes/patch`: changes allowed fields and validates again.
- A journal with no images or keys, `REPLAY_MODE`, and `GET /api/v1/replay/{id}`.

## Decisions

- Missing values are filled in and recorded in `assumptions`: g 9.81, mass 1 kg, length 2 m. This is why a drawing without labels works.
- A ball with no stated friction rolls (friction 1.0). If the slope is described as smooth, friction is 0 and the ball slides.
- The angle can be estimated from a drawing, but this is always recorded in `assumptions`.
- A ball with slip uses the sliding formula. Kirill should check the formulas.

## Tested

- Automated tests: `pytest`, no network.
- Real `gemini-4-argon`: 3 incline drawings, a drawing with injected text, a smiley face, 4 text requests. Response time 4–12 s.
- Started the server and checked the API with `curl` from a clean clone.

## Limitations

- `fixtures/drawings/` are synthetic. **Not yet tested on a real hand drawing or a phone photo.**
- The solver covers only the incline so far: for other scenes, `verify` returns `not_applicable`.
- No Live tokens (`/sessions`), rate limiting or CI. These are Damir's area. There is only a minimal `main.py` here.
- Responses take up to 12 s: the interface needs an indicator, and Live should fill the pause with speech.
- Argon rates its own `confidence`, and this has not been calibrated.
