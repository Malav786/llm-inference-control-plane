from api import KvEngineView, PrefillOp, StepPlan


def plan_step(view: KvEngineView) -> StepPlan:
    """Level 3a — KV-aware admission:
    1. Decodes first, oldest first (view.admitted).
    2. Prefill the oldest request as before, but admit it only if the peak usage of every
       admitted request plus candidate — each counted at its peak, not its current usage —
       sums to at most kv_capacity. (peak = prompt_len + max_tokens - 1).
    3. Stop at the oldest request that doesn't fit; never skip ahead to newer requests.
    """
    plan = StepPlan()

    # 1. Decodes for admitted requests
    for req in view.admitted:
        plan.decode.append(req.id)

    rem_work = view.max_work - len(plan.decode)
    current_peaks_sum = sum(req.prompt_len + (req.max_tokens - 1) for req in view.admitted)

    # 2. Prefill waiting requests
    for req in view.waiting:
        cost = req.prefill_remaining
        peak = req.prompt_len + (req.max_tokens - 1)

        if cost <= rem_work and (current_peaks_sum + peak) <= view.kv_capacity:
            plan.prefill.append(PrefillOp(req.id, cost))
            rem_work -= cost
            current_peaks_sum += peak
        else:
            break

    return plan
