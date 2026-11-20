import unittest
import numpy as np
from railing_variant import middle_rail


class RailingVariantTest(unittest.TestCase):
    def test_middle_only_and_shape_guard(self):
        section = [(x, 0, z + level) for level in (0, -.33, -.65)
                   for x, z in [(0, 0), (.1, 0), (.1, -.1), (0, -.1), (0, 0)]]
        points = np.concatenate([section, np.array(section) + [0, 1, .25]])
        changed = middle_rail(points, .05)
        expected = points.copy()
        expected.reshape(2, 3, 5, 3)[:, 1, :, 2] += .05
        np.testing.assert_allclose(changed, expected)
        self.assertIsNone(middle_rail(points[:-1], .05))
        points[6, 2] += .02
        self.assertIsNone(middle_rail(points, .05))
