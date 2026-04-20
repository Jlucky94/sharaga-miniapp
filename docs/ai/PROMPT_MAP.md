# Prompt Map

Execution prompts are stored as separate files in `prompts/`.

Important: do not read or scan `prompts/` during normal project work. Open a prompt file only when the user gives an explicit path or directly asks to work with the prompt library.

## Structure

```text
prompts/
  _system/
    README.txt
    PROLOG_BUILD.txt
    PROLOG_CHECK.txt
  phases/
    P0.txt
    P1.txt
    P2.txt
    P3.txt
    P4.txt
  check/
    C0.txt
    C1.txt
    C2.txt
    C3.txt
    C4.txt
  service/
    SCOPE_RESET.txt
    DOCS_SYNC.txt
```

## Execution model

- One task = one prompt file.
- Build prompts use `prompts/_system/PROLOG_BUILD.txt`.
- Check prompts use `prompts/_system/PROLOG_CHECK.txt`.
- Service prompts are standalone.
- Do not combine multiple prompts unless explicitly instructed.

## Files

| File | Purpose |
| --- | --- |
| `prompts/_system/README.txt` | Guardrails for the prompt library |
| `prompts/_system/PROLOG_BUILD.txt` | Shared prelude for build phases |
| `prompts/_system/PROLOG_CHECK.txt` | Shared prelude for control checks |
| `prompts/phases/P0.txt` | BUILD-P0 project operating system |
| `prompts/phases/P1.txt` | BUILD-P1 first user value |
| `prompts/phases/P2.txt` | BUILD-P2 async social world |
| `prompts/phases/P3.txt` | BUILD-P3 cooperative Exam |
| `prompts/phases/P4.txt` | BUILD-P4 alpha candidate |
| `prompts/check/C0.txt` | CHECK-C0 project OS control |
| `prompts/check/C1.txt` | CHECK-C1 first value control |
| `prompts/check/C2.txt` | CHECK-C2 async social loop control |
| `prompts/check/C3.txt` | CHECK-C3 cooperative event control |
| `prompts/check/C4.txt` | CHECK-C4 alpha gate |
| `prompts/service/SCOPE_RESET.txt` | Return agent to active phase scope |
| `prompts/service/DOCS_SYNC.txt` | Sync docs with current repository facts |
