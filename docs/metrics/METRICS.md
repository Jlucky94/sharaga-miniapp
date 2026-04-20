# Metrics

## North Star

Share of WAU who perform at least one meaningful social action.

Meaningful social actions include:

- contributing to a campus project;
- using another player's contribution;
- giving thanks/like;
- creating or joining a party;
- helping in Exam;
- sending a concrete invite tied to a party/project need.

Do not optimize early product direction around DAU, total XP, or raw clicks.

## Early targets

| Metric | Why it matters | Early target |
| --- | --- | --- |
| Tutorial completion | First-session clarity | > 70% |
| Time to first meaningful action | Core-loop access | < 60 seconds |
| Time to first social action | Social-core clarity | < 5 minutes |
| D1 retention | Basic value understood | 20-30% soft-launch range |
| D7 retention | Weekly rhythm works | 8-12% starting target |
| WAU/MAU | Weekly ritual exists | > 35% |
| Party creation rate | Cooperation forms | > 15% of active users |
| Party fill rate | Events can start | > 60% of created parties |
| Async contribution participation | Public-goods loop understood | > 25% of active users |
| Contribution reuse rate | Traces are useful | > 30% of active users |
| Like/thanks rate | Gratitude is visible | > 20% of users who encounter another contribution |

## Product events

Track these as server-accepted events when the corresponding features exist:

- `class_selected`
- `action_completed`
- `async_project_contributed`
- `project_used_by_other`
- `like_received`
- `party_created`
- `party_joined`
- `exam_started`
- `exam_completed`
- `quest_claimed`
- `write_access_granted`

## Experiment rules

- Test big differences first: first loop, social visibility, party fill, and notification timing.
- Avoid A/B testing tiny copy or cosmetic changes before the core loop is proven.
- Seeded social feed is allowed for activation tests if it is clearly implemented as seed/system data, not fake user deception.
- Prefer social-action lift over claim-rate lift when they conflict.
