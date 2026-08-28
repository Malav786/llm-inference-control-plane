from api import KvEngineView, PrefillOp, StepPlan


def plan_step(view: KvEngineView) -> StepPlan:
    """Level 3b — Preemption:
    1. While there aren't enough memory slots for all decodes to make progress, preempt the
       most recently admitted request (append its id to plan.preempt).
    2. Decode all remaining requests (now guaranteed to fit).
    3. Then admit waiting prefills, oldest first, while work budget and free slots allow —
       counting the slot each scheduled decode grows into this step — and stop at the first that doesn't fit.
    """
    plan = StepPlan()

    admitted = list(view.admitted)
    preempted_set = set()

    # 1. Preempt for decodes until total slots fit in kv_capacity
    while admitted:
        needed_slots = sum(req.kv + 1 for req in admitted)
        if needed_slots <= view.kv_capacity:
            break
        victim = admitted.pop()
        plan.preempt.append(victim.id)
        preempted_set.add(victim.id)

    # 2. Decode remaining admitted requests
    for req in admitted:
        plan.decode.append(req.id)

    rem_work = view.max_work - len(plan.decode)
    used_slots = sum(req.kv + 1 for req in admitted)
    free_slots = view.kv_capacity - used_slots

    # 3. Admit waiting prefills
    for req in view.waiting:
        if req.id in preempted_set:
            continue
        cost = req.prefill_remaining
        if cost <= rem_work and cost <= free_slots:
            plan.prefill.append(PrefillOp(req.id, cost))
            rem_work -= cost
            free_slots -= cost
        else:
            break

    return plan
