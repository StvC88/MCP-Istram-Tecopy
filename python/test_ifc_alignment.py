from pathlib import Path
import tempfile
import unittest

from ifc_alignment import read_axis


class AlignmentReportTest(unittest.TestCase):
    def test_rejects_an_ali_from_a_different_axis_or_with_an_incorrect_length(self):
        header = "# Formato: Istram 26.09.09.04\n"
        with tempfile.TemporaryDirectory() as directory:
            ali, ras = Path(directory, "eje.ali"), Path(directory, "eje.ras")
            ali.write_text(header + "# Eje: 1\n1000\n1 10 30 40 30 40 0 0 0\n0 0 30 50 0 0 0 0 0\n")
            ras.write_text(header + "# Eje: 2\n1000 5 0 0 0 0 0 0\n1010 6 0 0 0 0 10 0\n")
            with self.assertRaisesRegex(ValueError, "same nonempty axis"):
                read_axis(ali, ras)
            ras.write_text(ras.read_text().replace("Eje: 2", "Eje: 1"))
            self.assertEqual(read_axis(ali, ras)[3], [0.0, 10.0])
            ali.write_text(ali.read_text().replace("1 10 30", "1 11 30"))
            with self.assertRaisesRegex(ValueError, "length differs"):
                read_axis(ali, ras)
