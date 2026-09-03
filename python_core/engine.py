"""Simulation harness for the Inference Engine exercise.

THIS FILE IS PROVIDED COMPLETE — YOU SHOULD NOT NEED TO READ OR EDIT IT.

The engine owns the simulation: it advances time, tracks request state,
applies your scheduling decisions, enforces the rules of each level, and
records the step-by-step log that the tests check. Your job (in
level1.py .. level3c.py) is to implement `plan_step(view)`, returning a
`StepPlan` describing what the GPU should do this step.

The types you actually work with live in api.py. See README.md for the full
rules of each level.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, replace
from typing import NoReturn, Optional

from api import (
    EngineView,
    KvEngineView,
    PlanStep,
    PrefillOp,
    Request,
    StepPlan,
)


class SchedulingError(Exception):
    """Raised when a StepPlan violates the rules of the simulation."""


@dataclass
class SimResult:
    """log:   one dict per step, indexed by step: the actions taken, e.g.
             {"preempt": [ids], "decode": [ids], "prefill": [[id, tokens]],
              "finished": [ids]} (absent keys mean no such action)
    steps: total number of steps simulated
    """
    log: list[dict[str, list]]
    steps: int


class Engine:
    def __init__(self, requests: Iterable[tuple[int, Request]],
                 plan_step: PlanStep, *,
                 max_work: int,
                 kv_capacity: Optional[int] = None,
                 chunked: bool = False) -> None:
        # requests are (arrival step, request) pairs
        requests = list(requests)  # may be a one-shot iterable; we reread it
        ids = [r.id for _, r in requests]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate request ids")
        for arrival, r in requests:
            if r.prompt_len < 1 or r.max_tokens < 1 or arrival < 0:
                raise ValueError(f"invalid request {r.id!r}")
        if max_work < 1:
            raise ValueError("max_work must be >= 1")
        if chunked and kv_capacity is not None:
            raise ValueError("chunked prefill and KV tracking are not "
                             "combined in this exercise")
        self.requests = requests
        self.plan_step = plan_step
        self.max_work = max_work
        self.kv_capacity = kv_capacity
        self.chunked = chunked

    def run(self) -> SimResult:
        kv_capacity = self.kv_capacity
        track_kv = kv_capacity is not None
        # the live snapshot of each request; Request is frozen, so every
        # state change swaps in a fresh object
        states: dict[str, Request] = {
            r.id: replace(r, prefill_remaining=r.prompt_len)
            for _, r in self.requests}
        generated: dict[str, int] = {r.id: 0 for _, r in self.requests}
        arrivals: dict[int, list[str]] = {}
        # sorted is stable: input order is preserved within an arrival step
        order = sorted(self.requests, key=lambda pair: pair[0])
        seq = {r.id: i for i, (_, r) in enumerate(order)}  # arrival order
        for arrival, r in order:
            arrivals.setdefault(arrival, []).append(r.id)

        waiting: list[str] = []
        admitted: list[str] = []
        log: list[dict[str, list]] = []
        unfinished = len(self.requests)
        step = 0

        while unfinished > 0:
            waiting.extend(arrivals.pop(step, []))

            # promised to plan_step at the non-chunked levels: every
            # waiting prefill fits max_work in one step
            if not self.chunked:
                assert all(
                    0 < states[i].prefill_remaining <= self.max_work
                    for i in waiting
                ), "trace error: a waiting prefill exceeds max_work"

            if kv_capacity is not None:
                view = KvEngineView(
                    step=step, max_work=self.max_work,
                    waiting=tuple(states[i] for i in waiting),
                    admitted=tuple(states[i] for i in admitted),
                    kv_capacity=kv_capacity)
            else:
                view = EngineView(
                    step=step, max_work=self.max_work,
                    waiting=tuple(states[i] for i in waiting),
                    admitted=tuple(states[i] for i in admitted))
            plan = self.plan_step(view)
            self._validate(plan, waiting, admitted, states, step)

            finished: list[str] = []

            # 1. preemptions
            preempted = set(plan.preempt)
            if preempted:
                admitted = [i for i in admitted if i not in preempted]
                for i in plan.preempt:
                    s = states[i]
                    states[i] = replace(
                        s, kv=0,
                        prefill_remaining=s.prompt_len + generated[i])
                waiting.extend(plan.preempt)
                # a preempted request rejoins in arrival order
                waiting.sort(key=lambda i: seq[i])

            # 2. decodes
            for rid in plan.decode:
                generated[rid] += 1
                if track_kv:
                    states[rid] = replace(states[rid], kv=states[rid].kv + 1)
                if generated[rid] == states[rid].max_tokens:
                    finished.append(rid)

            # 3. prefills
            for op in plan.prefill:
                if op.id in waiting:
                    waiting.remove(op.id)
                    admitted.append(op.id)
                s = states[op.id]
                states[op.id] = replace(
                    s, prefill_remaining=s.prefill_remaining - op.tokens,
                    kv=(s.kv + op.tokens) if track_kv else s.kv)
                if states[op.id].prefill_remaining == 0:
                    generated[op.id] += 1  # a completed prefill emits a token
                    if generated[op.id] == states[op.id].max_tokens:
                        finished.append(op.id)

            for i in finished:
                admitted.remove(i)
                unfinished -= 1

            entry: dict[str, list] = {}
            if plan.preempt:
                entry["preempt"] = list(plan.preempt)
            if plan.decode:
                entry["decode"] = list(plan.decode)
            if plan.prefill:
                entry["prefill"] = [[op.id, op.tokens] for op in plan.prefill]
            if finished:
                entry["finished"] = list(finished)
            log.append(entry)

            step += 1

        return SimResult(log=log, steps=step)

    # ------------------------------------------------------------------
    # Additive stepwise API (does not change run() or any existing test)
    # ------------------------------------------------------------------

    def run_stepwise(self, extra_requests_source=None):
        """Generator that yields one (step_index, log_entry) per simulation tick.

        This is an *additive* API — it does not modify run() or any existing
        behaviour. The simulation harness (engine.py) is a provided exercise
        contract; this method was added solely to support real-time backend
        stepping without breaking that contract.

        Parameters
        ----------
        extra_requests_source : callable | None
            Called at the *start* of each step with the current step index:
            ``extra_requests_source(step) -> list[(arrival_offset, Request)]``
            Return value is merged into the pending arrivals so injected
            requests enter the simulation at the correct step.  Pass None
            (default) for a closed, fixed workload.

        Yields
        ------
        (step : int, entry : dict[str, list])
            ``step``  is the zero-based simulation step index.
            ``entry`` has the same schema as SimResult.log[step]:
            keys "prefill", "decode", "preempt", "finished" (absent = no action).
        """
        from collections.abc import Iterator  # local import keeps top-level clean

        kv_capacity = self.kv_capacity
        track_kv = kv_capacity is not None

        states: dict[str, Request] = {
            r.id: replace(r, prefill_remaining=r.prompt_len)
            for _, r in self.requests}
        generated: dict[str, int] = {r.id: 0 for _, r in self.requests}
        arrivals: dict[int, list[str]] = {}
        order = sorted(self.requests, key=lambda pair: pair[0])
        seq: dict[str, int] = {r.id: i for i, (_, r) in enumerate(order)}
        for arrival, r in order:
            arrivals.setdefault(arrival, []).append(r.id)

        waiting: list[str] = []
        admitted: list[str] = []
        unfinished = len(self.requests)
        step = 0

        while unfinished > 0:
            # --- inject externally provided requests for this step ---
            if extra_requests_source is not None:
                new_reqs: list = extra_requests_source(step)
                for offset, req in new_reqs:
                    arrival_step = step + offset
                    if req.id not in states:
                        states[req.id] = replace(req, prefill_remaining=req.prompt_len)
                        generated[req.id] = 0
                        unfinished += 1
                        # Insert into arrival order after existing requests
                        seq[req.id] = len(seq)
                    arrivals.setdefault(arrival_step, []).append(req.id)

            waiting.extend(arrivals.pop(step, []))

            if not self.chunked:
                # Skip requests that exceed max_work (can happen for injected reqs)
                waiting = [i for i in waiting
                           if states[i].prefill_remaining <= self.max_work]

            if kv_capacity is not None:
                view = KvEngineView(
                    step=step, max_work=self.max_work,
                    waiting=tuple(states[i] for i in waiting),
                    admitted=tuple(states[i] for i in admitted),
                    kv_capacity=kv_capacity)
            else:
                view = EngineView(
                    step=step, max_work=self.max_work,
                    waiting=tuple(states[i] for i in waiting),
                    admitted=tuple(states[i] for i in admitted))

            plan = self.plan_step(view)
            self._validate(plan, waiting, admitted, states, step)

            finished: list[str] = []

            preempted = set(plan.preempt)
            if preempted:
                admitted = [i for i in admitted if i not in preempted]
                for i in plan.preempt:
                    s = states[i]
                    states[i] = replace(
                        s, kv=0,
                        prefill_remaining=s.prompt_len + generated[i])
                waiting.extend(plan.preempt)
                waiting.sort(key=lambda i: seq[i])

            for rid in plan.decode:
                generated[rid] += 1
                if track_kv:
                    states[rid] = replace(states[rid], kv=states[rid].kv + 1)
                if generated[rid] == states[rid].max_tokens:
                    finished.append(rid)

            for op in plan.prefill:
                if op.id in waiting:
                    waiting.remove(op.id)
                    admitted.append(op.id)
                s = states[op.id]
                states[op.id] = replace(
                    s, prefill_remaining=s.prefill_remaining - op.tokens,
                    kv=(s.kv + op.tokens) if track_kv else s.kv)
                if states[op.id].prefill_remaining == 0:
                    generated[op.id] += 1
                    if generated[op.id] == states[op.id].max_tokens:
                        finished.append(op.id)

            for i in finished:
                admitted.remove(i)
                unfinished -= 1

            entry: dict[str, list] = {}
            if plan.preempt:
                entry["preempt"] = list(plan.preempt)
            if plan.decode:
                entry["decode"] = list(plan.decode)
            if plan.prefill:
                entry["prefill"] = [[op.id, op.tokens] for op in plan.prefill]
            if finished:
                entry["finished"] = list(finished)

            yield step, entry
            step += 1

    def _validate(self, plan: StepPlan, waiting: list[str],
                  admitted: list[str],
                  states: dict[str, Request], step: int) -> None:
        def err(msg: str) -> NoReturn:
            raise SchedulingError(f"step {step}: {msg}")

        if not isinstance(plan, StepPlan):
            err("plan_step must return a StepPlan")
        # every plan must do work unless the system is empty; this is what
        # guarantees the simulation terminates (a step that only preempts,
        # or does nothing at all, makes no forward progress)
        if not plan.decode and not plan.prefill and (waiting or admitted):
            err("no decode or prefill scheduled, but requests are waiting "
                "or admitted — the schedule cannot make progress")
        waiting_ids = set(waiting)
        admitted_ids = set(admitted)

        # preemptions
        seen = set()
        for rid in plan.preempt:
            if rid in seen:
                err(f"{rid!r} preempted twice")
            seen.add(rid)
            if rid not in admitted_ids:
                err(f"cannot preempt {rid!r}: not admitted")
            if states[rid].prefill_remaining > 0:
                err(f"cannot preempt {rid!r} mid-prefill")
        if plan.preempt and self.kv_capacity is None:
            err("preemption is only used when kv_capacity is set")
        preempted = set(plan.preempt)

        # decodes
        for rid in plan.decode:
            if rid in seen:
                err(f"{rid!r} scheduled twice")
            seen.add(rid)
            if rid not in admitted_ids:
                err(f"cannot decode {rid!r}: not admitted")
            if rid in preempted:
                err(f"cannot decode {rid!r}: preempted this step")
            if states[rid].prefill_remaining > 0:
                err(f"cannot decode {rid!r}: prefill not finished")

        # prefills
        for op in plan.prefill:
            if not isinstance(op, PrefillOp):
                err("plan.prefill entries must be PrefillOps")
            if op.id in seen:
                err(f"{op.id!r} scheduled twice")
            seen.add(op.id)
            if op.id in preempted:
                err(f"cannot prefill {op.id!r}: preempted this step")
            partial = (self.chunked and op.id in admitted_ids
                       and states[op.id].prefill_remaining > 0)
            if op.id not in waiting_ids and not partial:
                err(f"cannot prefill {op.id!r}: not in the waiting queue")
            s = states[op.id]
            if op.tokens < 1:
                err(f"prefill of {op.id!r} must process at least one token")
            if self.chunked:
                if op.tokens > s.prefill_remaining:
                    err(f"prefill of {op.id!r} overshoots its "
                        "remaining context")
            else:
                if op.tokens != s.prefill_remaining:
                    err(f"prefill of {op.id!r} must cover its full context: "
                        f"tokens={op.tokens} remaining={s.prefill_remaining}")

        total_tokens = len(plan.decode) + sum(op.tokens for op in plan.prefill)
        if total_tokens > self.max_work:
            err(f"max_work exceeded: {total_tokens} > {self.max_work}")

        if self.kv_capacity is not None:
            after = (sum(states[i].kv for i in admitted if i not in preempted)
                     + len(plan.decode)
                     + sum(op.tokens for op in plan.prefill))
            if after > self.kv_capacity:
                err(f"KV capacity exceeded: {after} > {self.kv_capacity}")
