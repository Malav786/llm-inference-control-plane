"""Types the candidate reads and works with.

This module is the contract between your scheduler and the simulation. You
implement `plan_step(view)`: called once per step, it reads an `EngineView`
and returns the `StepPlan` for that step. Everything here is meant to be
read; none of it depends on the simulator internals in engine.py.

See README.md for the full rules of each level.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Request:
    """A single generation request, and its live state in the engine.

    The request itself:
    id:         unique identifier
    prompt_len: the number of tokens in the prompt
    max_tokens: the most output tokens it may generate (>= 1). Like an API's
                max_tokens, this is an upper bound — a request may stop
                earlier, and you can't know its true length in advance, so
                schedule against this worst case.
    priority:   larger number = more urgent (Level 3c only; 0 elsewhere)

    Live state, managed by the engine:
    prefill_remaining: prompt/context tokens still to be processed before
                       this request can decode (0 means it is decoding)
    kv:                KV cache slots currently held (only tracked when the
                       engine is configured with a kv_capacity)
    """
    id: str
    prompt_len: int
    max_tokens: int
    priority: int = 0
    prefill_remaining: int = 0
    kv: int = 0


@dataclass(frozen=True)
class PrefillOp:
    """Process `tokens` prefill tokens for request `id` this step.

    A prefill must cover the request's full remaining context
    (tokens == prefill_remaining), except under chunked prefill (Level 2),
    where a step may process only part of it.
    """
    id: str
    tokens: int


@dataclass
class StepPlan:
    """What the GPU does in one step.

    preempt: ids of ADMITTED requests to evict (Level 3b). Processed first.
    decode:  ids of ADMITTED, fully-prefilled requests that each generate one
             token this step.
    prefill: PrefillOps against WAITING requests (or, in Level 2, against a
             partially-prefilled admitted request).
    """
    preempt: list[str] = field(default_factory=list)
    decode: list[str] = field(default_factory=list)
    prefill: list[PrefillOp] = field(default_factory=list)


@dataclass(frozen=True)
class EngineView:
    """Read-only snapshot handed to plan_step each step; everything in it,
    Requests included, is immutable.

    The snapshot is taken before your plan runs and does not update as you
    build the StepPlan: counting what your plan consumes — work against
    max_work, slots against kv_capacity — is your job.

    max_work: the most units of work the GPU may do in one step
    waiting: Requests in queue order — oldest arrival first (a preempted
             request rejoins in its original arrival position). Treat this
             order as your arrival tiebreaker; a stable sort by another key
             (e.g. priority) keeps it within ties.
    admitted: Requests in admission order, earliest admitted first — so
             the most recently admitted request is admitted[-1].
    """
    step: int
    max_work: int
    waiting: tuple[Request, ...]
    admitted: tuple[Request, ...]


@dataclass(frozen=True)
class KvEngineView(EngineView):
    """The view at the memory-managed levels, where the engine enforces a
    fixed pool of KV-cache slots.

    kv_capacity: total KV slots in the pool. A prefill of n tokens consumes
                 n slots and each decode 1 more; a request's slots free when
                 it finishes or is preempted. The slots in use right now are
                 the admitted requests' `kv` fields — free is kv_capacity
                 minus their sum.

    Memory is held for the duration of a step: a request that finishes this
    step still occupies (and grows) its slots during the step, and they are
    reclaimed only afterwards. A preempted victim, by contrast, does no work
    this step — its slots are free for this step's prefills immediately.
    """
    kv_capacity: int


# What the engine requires of a scheduler: a `plan_step` called once per
# step that reads the view and returns the StepPlan for that step.
PlanStep = Callable[[EngineView], StepPlan]
