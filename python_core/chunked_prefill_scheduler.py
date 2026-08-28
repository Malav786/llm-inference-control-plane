from api import EngineView, PrefillOp, StepPlan


def plan_step(view: EngineView) -> StepPlan:
    """Level 2 — Chunked prefill:
    Priority order:
    1. Decodes (still oldest first; this avoids having a large prefill stall other requests for many steps).
    2. Already started prefills (we prefer to complete a partial prefill over starting a new prefill).
    3. Then start waiting prefills, oldest first, while the budget allows. A prefill too big for the
       remaining budget is chunked to fill it exactly.
    """
    plan = StepPlan()
    rem_work = view.max_work

    # 1. Decodes for admitted requests whose prefill is complete
    for req in view.admitted:
        if req.prefill_remaining == 0:
            if rem_work > 0:
                plan.decode.append(req.id)
                rem_work -= 1

    # 2. Already started prefills in view.admitted
    for req in view.admitted:
        if req.prefill_remaining > 0:
            tokens = min(req.prefill_remaining, rem_work)
            if tokens > 0:
                plan.prefill.append(PrefillOp(req.id, tokens))
                rem_work -= tokens
            if rem_work == 0:
                break

    # 3. Waiting prefills in view.waiting
    for req in view.waiting:
        if rem_work == 0:
            break
        tokens = min(req.prefill_remaining, rem_work)
        if tokens > 0:
            plan.prefill.append(PrefillOp(req.id, tokens))
            rem_work -= tokens

    return plan
