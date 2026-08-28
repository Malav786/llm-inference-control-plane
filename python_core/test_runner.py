import sys
import os
import unittest

# Ensure current directory is in sys.path for importing api, engine, scheduler modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    level_arg = sys.argv[1] if len(sys.argv) > 1 else "all"
    trace_arg = sys.argv[2] if len(sys.argv) > 2 else None

    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    from test_levels import TestLevel1, TestLevel2, TestLevel3a, TestLevel3b, TestLevel3c

    level_map = {
        "1": TestLevel1,
        "fcfs": TestLevel1,
        "2": TestLevel2,
        "chunked": TestLevel2,
        "3a": TestLevel3a,
        "kv_capacity": TestLevel3a,
        "3b": TestLevel3b,
        "preemption": TestLevel3b,
        "3c": TestLevel3c,
        "priority": TestLevel3c,
    }

    if level_arg in level_map:
        test_class = level_map[level_arg]
        if trace_arg:
            test_name = f"test_{trace_arg}"
            if hasattr(test_class, test_name):
                suite.addTest(test_class(test_name))
            else:
                print(f"Error: Trace test '{trace_arg}' not found in strategy '{level_arg}'.")
                sys.exit(1)
        else:
            suite.addTests(loader.loadTestsFromTestCase(test_class))
    elif level_arg.lower() in ("all", "all_levels"):
        for cls in [TestLevel1, TestLevel2, TestLevel3a, TestLevel3b, TestLevel3c]:
            suite.addTests(loader.loadTestsFromTestCase(cls))
    else:
        print(f"Unknown strategy or level: {level_arg}")
        print("Usage: python test_runner.py [fcfs|chunked|kv_capacity|preemption|priority|1|2|3a|3b|3c|all] [trace_name]")
        sys.exit(1)

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    if not result.wasSuccessful():
        sys.exit(1)

if __name__ == "__main__":
    main()

