import json
import tempfile
import unittest
from pathlib import Path

from xixova.library import (add_candidates, audit_library, load_manifest,
                            register_download, request_search, set_state)


class LibraryTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)/'biblioteca'
        self.candidate={'provider_id':'abc-123','nombre':'Sofá editorial','autor':'Autora',
                        'licencia':'Royalty Free','categoria':'asientos'}

    def tearDown(self): self.temp.cleanup()

    def test_candidates_are_idempotent_and_compact(self):
        self.assertEqual(add_candidates(self.root,[self.candidate])['agregados'],1)
        self.assertEqual(add_candidates(self.root,[self.candidate])['agregados'],0)
        item=load_manifest(self.root)['activos'][0]
        self.assertNotIn('geometry',item); self.assertEqual(item['estado'],'candidato')

    def test_request_is_stable(self):
        a=request_search(self.root,query='luxury sofa',category='asientos',limit=10)
        b=request_search(self.root,query='luxury sofa',category='asientos',limit=10)
        self.assertEqual(a,b); self.assertTrue(a.is_file())

    def test_download_is_hashed_and_not_duplicated(self):
        add_candidates(self.root,[self.candidate]); source=Path(self.temp.name)/'asset.blend'; source.write_bytes(b'blend')
        one=register_download(self.root,'abc-123',source); two=register_download(self.root,'abc-123',source)
        self.assertEqual(one['archivos']['original']['sha256'],two['archivos']['original']['sha256'])
        self.assertEqual(len(list((self.root/'originales'/'abc-123').iterdir())),1)

    def test_rejection_has_lightweight_record(self):
        add_candidates(self.root,[self.candidate]); set_state(self.root,'abc-123','rechazado','texturas ausentes')
        self.assertTrue((self.root/'rechazados'/'abc-123.yaml').is_file())

    def test_accepted_asset_without_audit_fails(self):
        add_candidates(self.root,[self.candidate]); set_state(self.root,'abc-123','aceptado')
        report=audit_library(self.root)
        self.assertFalse(report['ok']); self.assertFalse(report['completo']); self.assertIn('ARCHIVO',{x['codigo'] for x in report['diagnosticos']})


if __name__=='__main__': unittest.main()
