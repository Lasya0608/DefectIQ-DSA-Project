"""Disjoint Sparse Table for immutable arrays and associative operations."""
from typing import Callable

class DisjointSparseTable:
    def __init__(self, values: list[int], operation: Callable[[int, int], int]):
        if not values:
            raise ValueError('At least one value is required')
        self.values = values[:]
        self.operation = operation
        self.n = len(values)
        self.levels = (self.n - 1).bit_length()
        self.table = [[None] * self.n for _ in range(self.levels)]
        for level in range(self.levels):
            half = 1 << level
            block_size = half * 2
            for block_start in range(0, self.n, block_size):
                middle = min(block_start + half, self.n)
                end = min(block_start + block_size, self.n)
                if middle > block_start:
                    self.table[level][middle - 1] = values[middle - 1]
                    for i in range(middle - 2, block_start - 1, -1):
                        self.table[level][i] = operation(values[i], self.table[level][i + 1])
                if middle < end:
                    self.table[level][middle] = values[middle]
                    for i in range(middle + 1, end):
                        self.table[level][i] = operation(self.table[level][i - 1], values[i])

    def query(self, left: int, right: int) -> int:
        if not (0 <= left <= right < self.n):
            raise ValueError(f'Invalid inclusive range [{left}, {right}] for {self.n} values')
        if left == right:
            return self.values[left]
        level = (left ^ right).bit_length() - 1
        return self.operation(self.table[level][left], self.table[level][right])

class DefectAnalyzer:
    def __init__(self, records: list[dict]):
        self.records = records
        counts = [int(r['defects']) for r in records]
        self.minimum = DisjointSparseTable(counts, min)
        self.maximum = DisjointSparseTable(counts, max)

    def query(self, left: int, right: int) -> dict:
        return {'minimum': self.minimum.query(left, right),
                'maximum': self.maximum.query(left, right),
                'left': left, 'right': right, 'count': right-left+1}
