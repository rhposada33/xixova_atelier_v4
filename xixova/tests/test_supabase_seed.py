from pathlib import Path
import importlib.util
import unittest

ROOT=Path(__file__).resolve().parents[2]
class SupabaseSeedTest(unittest.TestCase):
    def test_seed_is_generated_from_fixture(self):
        path=ROOT/"scripts/generate_supabase_seed.py"
        spec=importlib.util.spec_from_file_location("generate_supabase_seed",path)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        self.assertEqual(module.render(),(ROOT/"supabase/seed.sql").read_text(encoding="utf-8"))

if __name__=="__main__":unittest.main()
