import unittest
from api import Request, PrefillOp, StepPlan
from engine import Engine
import fcfs_scheduler
import chunked_prefill_scheduler
import kv_capacity_scheduler
import preemption_scheduler
import priority_preemption_scheduler


class TestLevel1(unittest.TestCase):
    def test_worked_example_level1(self):
        requests = [
            (0, Request("A", prompt_len=6, max_tokens=3)),
            (0, Request("B", prompt_len=3, max_tokens=2)),
            (0, Request("C", prompt_len=5, max_tokens=2)),
        ]
        eng = Engine(requests, fcfs_scheduler.plan_step, max_work=10)
        res = eng.run()

        s0 = res.log[0]
        self.assertEqual(s0.get("prefill"), [["A", 6], ["B", 3]])
        self.assertEqual(s0.get("decode"), None)

        s1 = res.log[1]
        self.assertEqual(s1.get("decode"), ["A", "B"])
        self.assertEqual(s1.get("prefill"), [["C", 5]])
        self.assertEqual(s1.get("finished"), ["B"])

        s2 = res.log[2]
        self.assertEqual(sorted(s2.get("decode")), ["A", "C"])
        self.assertEqual(sorted(s2.get("finished")), ["A", "C"])

    def test_decode_pressure(self):
        requests = [
            (0, Request("R1", prompt_len=2, max_tokens=3)),
            (0, Request("R2", prompt_len=2, max_tokens=3)),
            (0, Request("R3", prompt_len=2, max_tokens=3)),
            (1, Request("R4", prompt_len=3, max_tokens=2)),
        ]
        eng = Engine(requests, fcfs_scheduler.plan_step, max_work=4)
        res = eng.run()

        s1 = res.log[1]
        self.assertEqual(s1.get("decode"), ["R1", "R2"])
        self.assertEqual(s1.get("prefill"), [["R3", 2]])

        s2 = res.log[2]
        self.assertEqual(s2.get("decode"), ["R1", "R2", "R3"])
        self.assertEqual(s2.get("prefill"), None)


class TestLevel2(unittest.TestCase):
    def test_worked_example_level2(self):
        requests = [
            (0, Request("W", prompt_len=2, max_tokens=4)),
            (0, Request("X", prompt_len=13, max_tokens=2)),
            (0, Request("Y", prompt_len=3, max_tokens=2)),
        ]
        eng = Engine(requests, chunked_prefill_scheduler.plan_step, max_work=8, chunked=True)
        res = eng.run()

        s0 = res.log[0]
        self.assertEqual(s0.get("prefill"), [["W", 2], ["X", 6]])
        self.assertEqual(s0.get("decode"), None)

        s1 = res.log[1]
        self.assertEqual(s1.get("decode"), ["W"])
        self.assertEqual(s1.get("prefill"), [["X", 7]])

        s2 = res.log[2]
        self.assertEqual(s2.get("decode"), ["W", "X"])
        self.assertEqual(s2.get("prefill"), [["Y", 3]])
        self.assertEqual(s2.get("finished"), ["X"])

        s3 = res.log[3]
        self.assertEqual(s3.get("decode"), ["W", "Y"])
        self.assertEqual(sorted(s3.get("finished")), ["W", "Y"])


class TestLevel3a(unittest.TestCase):
    def test_worked_example_level3a(self):
        requests = [
            (0, Request("A", prompt_len=2, max_tokens=2)),
            (0, Request("B", prompt_len=4, max_tokens=2)),
            (0, Request("C", prompt_len=2, max_tokens=2)),
        ]
        eng = Engine(requests, kv_capacity_scheduler.plan_step, max_work=10, kv_capacity=6)
        res = eng.run()

        s0 = res.log[0]
        self.assertEqual(s0.get("prefill"), [["A", 2]])
        self.assertEqual(s0.get("decode"), None)

        s1 = res.log[1]
        self.assertEqual(s1.get("decode"), ["A"])
        self.assertEqual(s1.get("finished"), ["A"])

        s2 = res.log[2]
        self.assertEqual(s2.get("prefill"), [["B", 4]])

        s3 = res.log[3]
        self.assertEqual(s3.get("decode"), ["B"])
        self.assertEqual(s3.get("finished"), ["B"])

        s4 = res.log[4]
        self.assertEqual(s4.get("prefill"), [["C", 2]])

        s5 = res.log[5]
        self.assertEqual(s5.get("decode"), ["C"])
        self.assertEqual(s5.get("finished"), ["C"])


class TestLevel3b(unittest.TestCase):
    def test_worked_example_level3b(self):
        requests = [
            (0, Request("A", prompt_len=2, max_tokens=2)),
            (0, Request("B", prompt_len=4, max_tokens=2)),
            (0, Request("C", prompt_len=2, max_tokens=2)),
        ]
        eng = Engine(requests, preemption_scheduler.plan_step, max_work=10, kv_capacity=6)
        res = eng.run()

        s0 = res.log[0]
        self.assertEqual(s0.get("prefill"), [["A", 2], ["B", 4]])

        s1 = res.log[1]
        self.assertEqual(s1.get("preempt"), ["B"])
        self.assertEqual(s1.get("decode"), ["A"])
        self.assertEqual(s1.get("prefill"), [["C", 2]])
        self.assertEqual(s1.get("finished"), ["A"])

        s2 = res.log[2]
        self.assertEqual(s2.get("decode"), ["C"])
        self.assertEqual(s2.get("finished"), ["C"])

        s3 = res.log[3]
        self.assertEqual(s3.get("prefill"), [["B", 5]])
        self.assertEqual(s3.get("finished"), ["B"])


class TestLevel3c(unittest.TestCase):
    def test_worked_example_level3c(self):
        requests = [
            (0, Request("LOW", prompt_len=2, max_tokens=3, priority=0)),
            (0, Request("MID", prompt_len=2, max_tokens=3, priority=1)),
            (2, Request("HI", prompt_len=4, max_tokens=1, priority=2)),
        ]
        eng = Engine(requests, priority_preemption_scheduler.plan_step, max_work=10, kv_capacity=8)
        res = eng.run()

        s0 = res.log[0]
        self.assertEqual(s0.get("prefill"), [["MID", 2], ["LOW", 2]])

        s1 = res.log[1]
        self.assertEqual(s1.get("decode"), ["MID", "LOW"])

        s2 = res.log[2]
        self.assertEqual(s2.get("preempt"), ["LOW"])
        self.assertEqual(s2.get("decode"), ["MID"])
        self.assertEqual(s2.get("prefill"), [["HI", 4]])
        self.assertEqual(sorted(s2.get("finished")), ["HI", "MID"])

        s3 = res.log[3]
        self.assertEqual(s3.get("prefill"), [["LOW", 4]])
        self.assertEqual(s3.get("finished"), ["LOW"])


if __name__ == "__main__":
    unittest.main()

