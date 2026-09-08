import shutil
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from xixova.director_server import create_app

ROOT=Path(__file__).resolve().parents[2]

def project_copy():
    temp=tempfile.TemporaryDirectory(dir=ROOT/'proyectos'); target=Path(temp.name); source=ROOT/'proyectos/apartamento_compacto'
    for path in source.glob('*.yaml'):shutil.copy2(path,target/path.name)
    return temp,target/'proyecto.yaml'

def test_tour_proposal_does_not_replace_active_script():
    temp,project=project_copy()
    try:
        client=TestClient(create_app(project,'natural_lila')); before=client.get('/api/script').json(); areas=[x['id'] for x in client.get('/api/tour-presets').json()['areas']]
        proposal=client.post('/api/tours/propose',json={'areas':areas,'preset':'visita_completa'}); assert proposal.status_code==200
        assert client.get('/api/script').json()==before
        applied=client.post('/api/tours/'+proposal.json()['proposal_id']+'/apply',json={'hash':before['hash'],'nombre':'Visita automática'}); assert applied.status_code==200
        assert client.get('/api/script').json()==before
    finally:temp.cleanup()

def test_artifact_endpoint_blocks_path_traversal():
    temp,project=project_copy()
    try:
        app=create_app(project,'natural_lila'); client=TestClient(app); root=Path(temp.name)/'job'; root.mkdir(); safe=root/'frame_0001.png'; safe.write_bytes(b'png'); secret=Path(temp.name)/'secret.txt'; secret.write_text('private')
        app.state.session.jobs['safe']={'id':'safe','_root':str(root),'_folder':str(root),'_frames':[1],'_labels':{1:'inicio'}}
        assert client.get('/api/jobs/safe/artifacts/frame_0001.png').status_code==200
        assert client.get('/api/jobs/safe/artifacts/%2e%2e/secret.txt').status_code==404
    finally:temp.cleanup()
