import json
from pathlib import Path
import unittest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2] / 'contracts' / 'authored'


class CandidateContractTest(unittest.TestCase):
    def test_shared_candidate_structure_vectors(self):
        turn = json.loads((ROOT / 'authoring-turn.schema.json').read_text())
        candidate = json.loads((ROOT / 'authoring-candidate.schema.json').read_text())
        Draft202012Validator.check_schema(candidate)
        registry = Registry().with_resource(turn['$id'], Resource.from_contents(turn))
        validator = Draft202012Validator(candidate, registry=registry)
        for case in json.loads((ROOT / 'authoring-candidate.conformance.json').read_text())['cases']:
            with self.subTest(case=case['name']):
                self.assertEqual(validator.is_valid(case['input']), case['valid'])
