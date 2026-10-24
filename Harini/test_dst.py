"""Harini's tests for DefectIQ Disjoint Sparse Table."""

import sys
import unittest
from pathlib import Path

# Import Lasya's DST implementation from the team repository.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "Lasya"))

from dst import DisjointSparseTable, DefectAnalyzer


class TestDefectIQ(unittest.TestCase):

    def setUp(self):
        self.defects = [8, 15, 3, 22, 11, 6, 30, 4]
        self.minimum = DisjointSparseTable(self.defects, min)
        self.maximum = DisjointSparseTable(self.defects, max)

    def test_minimum_query(self):
        self.assertEqual(self.minimum.query(0, 4), 3)

    def test_maximum_query(self):
        self.assertEqual(self.maximum.query(0, 4), 22)

    def test_single_element(self):
        self.assertEqual(self.minimum.query(3, 3), 22)
        self.assertEqual(self.maximum.query(3, 3), 22)

    def test_complete_range(self):
        self.assertEqual(self.minimum.query(0, 7), 3)
        self.assertEqual(self.maximum.query(0, 7), 30)

    def test_invalid_range(self):
        with self.assertRaises(ValueError):
            self.minimum.query(5, 2)

    def test_negative_index(self):
        with self.assertRaises(ValueError):
            self.maximum.query(-1, 4)

    def test_out_of_bounds(self):
        with self.assertRaises(ValueError):
            self.minimum.query(0, 20)

    def test_empty_input(self):
        with self.assertRaises(ValueError):
            DisjointSparseTable([], min)

    def test_defect_analyzer(self):
        records = [{"defects": x} for x in self.defects]
        analyzer = DefectAnalyzer(records)

        result = analyzer.query(2, 6)

        self.assertEqual(result["minimum"], 3)
        self.assertEqual(result["maximum"], 30)
        self.assertEqual(result["count"], 5)


if __name__ == "__main__":
    unittest.main(verbosity=2)