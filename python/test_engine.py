import unittest
import engine


class QuoteTests(unittest.TestCase):
    def test_plain_plans(self):
        self.assertEqual([engine.quote(p, 0, 0, 0, False)["total"] for p in (0, 1, 2)], [199, 319, 549])

    def test_included_integrations_are_free(self):
        self.assertEqual(engine.quote(1, 0, 1, 0, False)["total"], 319)      # 1 included
        self.assertEqual(engine.quote(1, 0, 3, 0, False)["total"], 319 + 2 * 45)

    def test_pages_gateways_and_rush(self):
        q = engine.quote(2, 4, 2, 1, True)   # 549 + 60 pages + 0 integrations + 60 gateway = 669, +20% = 134
        self.assertEqual(q["breakdown"]["rush"], 134)
        self.assertEqual(q["total"], 803)

    def test_errors(self):
        for args in [(3, 0, 0, 0, False), (0, 0, 0, 1, False), (0, 99, 0, 0, False)]:
            with self.assertRaises(engine.QuoteError):
                engine.quote(*args)


if __name__ == "__main__":
    unittest.main()
