from api import EngineView, PrefillOp, StepPlan


def plan_step(view: EngineView) -> StepPlan:
    """Level 1 — Basic scheduling:
    1. Schedule a decode for all admitted requests, oldest first (the order of view.admitted).
    2. In arrival order (view.waiting), schedule each waiting prefill while the total work
       stays at most view.max_work units.
    3. Stop at the first waiting prefill that doesn't fit — don't skip ahead to a smaller, later one.
    """
    plan = StepPlan()

    for req in view.admitted:
        plan.decode.append(req.id)

    rem_work = view.max_work - len(plan.decode)

    for req in view.waiting:
        if req.prefill_remaining <= rem_work:
            plan.prefill.append(PrefillOp(req.id, req.prefill_remaining))
            rem_work -= req.prefill_remaining
        else:
            break

    return plan
