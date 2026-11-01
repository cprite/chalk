# Chalk: priorities

Rule: new features are taken on only after the whole level above works end to end. After 15:15, only bug fixes.

## P0. Must have today

| Feature | Owner | Done when |
|---|---|---|
| Voice description becomes a `SceneSpec` | cprite | Live calls `set_scene`, the scene is validated, an invalid schema is rejected |
| Screen confirming what was recognised | kwerui | Type, values and assumptions are visible, and can be confirmed or corrected by voice |
| 3D incline simulation: ball and block | KirilBoiko | Motion matches the scene parameters |
| Analytic check and verdict | cprite, reviewed by KirilBoiko | Formula, simulation, difference and verdict are on screen |
| Voice conversation in the browser | kwerui | You can ask a question and interrupt the assistant, and the session stays connected for the whole demo |
| Prediction flow and "what if the mass is doubled" | kwerui, cprite | Prediction before the run, parameter change, new run and an explanation using the numbers |
| Key and input protection | Dart6y | No key in the browser, short-lived token, file size and type checked |
| Run recording and replay mode | cprite, kwerui | The demo works with no network |
| Submission | cprite | README in English, public repository, runs from a clean clone, video, pitch |

## P1. If time allows, in order

1. Drawing: camera and photo analysis (the backend is ready, the interface is needed). kwerui.
2. Projectile scenario: adds variety to the demo. KirilBoiko, cprite.
3. Frontend and backend deployment over HTTPS. Dart6y.
4. Projector-friendly interface and visual polish. kwerui, KirilBoiko.
5. Experiment report: problem, prediction, result, verdict. cprite, kwerui.
6. Clear refusal for unsupported problems. cprite, kwerui.
7. Pendulum and collision. KirilBoiko, cprite.

Move the clear refusal higher if tests show the model producing scenes for unsupported problems.

## P2. Product roadmap, on a slide only today

- Class workspace, assignments and student work
- Assessment mode: hints off, work log, oral defence, the teacher gives the grade
- Accounts, roles, and storing and protecting student data
- More physics topics: electricity, optics, waves, thermodynamics
- Comparing simulations with data from real experiments
- Mapping to the curriculum
- Multilingual lessons
- LMS integration
- Real-time collaboration between students

## Not building today

Accounts, a database, arbitrary scenes, model-generated code, video and music on stage. To avoid a claim we can't back up, we don't say "any experiment" or "replaces the lab".
