from api import KvEngineView, PrefillOp, StepPlan, Request


def get_victim_key(tup: tuple[int, Request]) -> tuple[int, int]:
    """
    Victim selection order:
    1. Lowest priority first (req.priority ascending)
    2. Ties broken by most recently admitted (-index in admitted)
    """
    index, req = tup
    return (req.priority, -index)


def plan_step(view: KvEngineView) -> StepPlan:
    """Level 3c — Priority tiers:
    1. Victim selection: lowest-priority request, ties broken by most recently admitted.
    2. Preemption for growth: preempt victims until remaining admitted fit in kv_capacity.
    3. Decodes: remaining admitted requests in order of view.admitted.
    4. Admission order: highest priority first, tiebreaker by oldest.
    5. Preemption for admission: if candidate fits work budget but not free memory,
       evict admitted requests of strictly lower priority if it suffices; otherwise stop.
    """
    plan = StepPlan()

    admitted = list(view.admitted)
    preempted_set = set()

    # 2. Preemption for growth
    while admitted:
        needed_slots = sum(req.kv + 1 for req in admitted)
        if needed_slots <= view.kv_capacity:
            break
        
        indexed_admitted = list(enumerate(admitted))
        victim_idx, victim = min(indexed_admitted, key=get_victim_key)
        
        admitted.pop(victim_idx)
        plan.preempt.append(victim.id)
        preempted_set.add(victim.id)

    # 3. Decodes for remaining admitted requests
    for req in admitted:
        plan.decode.append(req.id)

    rem_work = view.max_work - len(plan.decode)
    used_slots = sum(req.kv + 1 for req in admitted)
    free_slots = view.kv_capacity - used_slots

    # 4. Admission order: highest priority first, tiebreaker by oldest (arrival order)
    # view.waiting is in arrival order, so stable sort by priority descending keeps arrival order within tier
    sorted_waiting = sorted(view.waiting, key=lambda r: r.priority, reverse=True)

    # 5. Admission candidate loop
    for candidate in sorted_waiting:
        if candidate.id in preempted_set:
            continue

        cost = candidate.prefill_remaining

        # Check work budget first
        if cost > rem_work:
            break

        # Check memory
        if cost <= free_slots:
            plan.prefill.append(PrefillOp(candidate.id, cost))
            rem_work -= cost
            free_slots -= cost
            admitted.append(candidate)
        else:
            # Check preemption of strictly lower priority requests
            strictly_lower = [
                (idx, req) for idx, req in enumerate(admitted)
                if req in view.admitted and req.priority < candidate.priority
            ]
            strictly_lower.sort(key=get_victim_key)

            sim_free = free_slots
            sim_work = rem_work
            victims_to_evict = []
            possible = False

            for idx, req in strictly_lower:
                if req.id in plan.decode:
                    sim_free += (req.kv + 1)
                    sim_work += 1
                else:
                    sim_free += req.kv

                victims_to_evict.append(req)

                if cost <= sim_free and cost <= sim_work:
                    possible = True
                    break

            if possible:
                for req in victims_to_evict:
                    if req.id in plan.decode:
                        plan.decode.remove(req.id)
                        rem_work += 1
                        free_slots += (req.kv + 1)
                    else:
                        free_slots += req.kv
                    admitted.remove(req)
                    plan.preempt.append(req.id)
                    preempted_set.add(req.id)

                plan.prefill.append(PrefillOp(candidate.id, cost))
                rem_work -= cost
                free_slots -= cost
                admitted.append(candidate)
            else:
                break

    return plan
