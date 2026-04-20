# Game Design

## Product model

The game is a campus social progression game with three connected loops:

1. Personal loop: short action, energy, soft currency, archetype progress, profile level.
2. Async social world: players contribute to shared campus projects, leave visible traces, and receive gratitude.
3. Cooperative culmination: 3-5 players form a party for the weekly Exam event, where class composition matters.

The game should create autonomy, competence, and relatedness:

- autonomy through archetype choice;
- competence through readable progress and stronger class identity;
- relatedness through useful contributions, thanks, parties, and shared outcomes.

## Base archetypes

| Archetype | Fantasy | Social role | Example strengths |
| --- | --- | --- | --- |
| `botan` | Clever student who prepares everyone | Reduces Exam failure risk and strengthens study projects | notes, exam prep, hints, safer outcomes |
| `sportsman` | Physical, reliable teammate | Speeds activity/event progress and stabilizes party readiness | gym, logistics, stamina, momentum |
| `partygoer` | Social connector and campus spark | Boosts reputation, invites, feed effects, and festival/social projects | parties, thanks, social rewards, reactivation |

Archetypes are not skins. Each class must change how the player helps others.

## MVP scope

| Block | MVP decision |
| --- | --- |
| Auth | Telegram initData auth, profile creation, autologin |
| Identity | Choose one of three archetypes: `botan`, `sportsman`, `partygoer` |
| Personal loop | 1 energy, 1 soft currency, 4-5 short actions, 1 timer cycle |
| Progression | Profile level, archetype level, 1 passive class perk |
| Async world | 2-3 public projects: notes, gym, festival stage |
| Social reflection | Feed entries for help, reuse, thanks/likes |
| Cooperation | Party of 3-5, auto/manual join, simple class roles |
| Weekly event | One Exam event with class-composition synergy |
| Return | Daily quest and 3-4 weekly goals |
| Analytics | Event logging, retention, first social action, party creation, async usage |
| Communications | Ask write access only after first value moment; 2-3 bot notification templates |

## Core actions

Actions must produce both a reward and an interpretation.

Good reward copy:

- "Your notes helped 3 classmates."
- "Your party passed the mock exam without a fail."
- "You finished the last piece of the festival stage and unlocked a shortcut for others."

Weak reward copy:

- "+12 points"
- "+1 resource"
- "Claimed"

## Async campus projects

Start with 2-3 projects:

| Project | Main contributor fit | Benefit |
| --- | --- | --- |
| Notes | `botan` | Better Exam prep and study action bonus |
| Gym | `sportsman` | More readiness/stamina for party events |
| Festival stage | `partygoer` | More social reward and invite energy |

The emotional promise is "my contribution helped someone else." If reuse is invisible, the feature fails.

## Cooperative Exam

Exam is the weekly culmination, not a separate combat game.

Rules:

- party size target is 3-5;
- mixed archetypes should be stronger than one-class spam;
- result can be success or partial failure;
- both outcomes should write to social space;
- rewards must be idempotent.

Example role effects:

- `botan`: lowers chance of critical failure;
- `sportsman`: increases readiness and consistency;
- `partygoer`: improves morale, social reward, and invite/fill dynamics.

## What to postpone

Do not add in MVP:

- PvP;
- big campus map;
- complex inventory;
- 5+ rarity levels;
- guild politics;
- custom rooms/houses;
- marketplace;
- battle pass;
- more than 2 currencies;
- punitive timers;
- resource grinding for its own sake.

## Telegram UX rules

- Design moments of value, not just screens.
- First screen should lead quickly to archetype choice and one obvious action.
- Ask `requestWriteAccess` after first value, not on first launch.
- Use fullscreen, haptics, main/back buttons, sharing, add-to-home-screen, and emoji status only when they support a real product moment.
- Social sharing should be concrete: "we need a sportsman for the exam" beats "invite a friend for a bonus."
- Add-to-home-screen belongs after the second or third return, not during first entry.

## Tone

School/university setting can be playful, but avoid humiliation, hard toxicity, and criminal/cringe shells. Use local status and campus usefulness instead of global domination.
