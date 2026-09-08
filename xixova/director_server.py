"""Servidor local de Xixova Director."""
from __future__ import annotations
import asyncio, json, os, subprocess, sys, threading, time, uuid, webbrowser
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from .core import digest
from .director import apply_command, atomic_yaml, compile_script, context, read_or_import, scene_payload, validate_script
from .director_glb import make_glb

class DirectorSession:
    def __init__(self,project,variant):
        self.project=Path(project).resolve(); self.variant=variant; self.bundle,self.script,self.source,self.draft,self.hash=read_or_import(self.project,variant)
        self.undo=[]; self.redo=[]; self.jobs={}; self.lock=threading.Lock(); self.project_sources=dict(self.bundle.get('sincronizacion',{}).get('archivos',{}))
    def sources_current(self):
        import hashlib
        return all(Path(path).is_file() and hashlib.sha256(Path(path).read_bytes()).hexdigest()==value for path,value in self.project_sources.items())
    def save_draft(self): atomic_yaml(self.draft,self.script); self.hash=digest(self.script)
    def command(self,value,expected):
        with self.lock:
            if not self.sources_current():raise ValueError('El proyecto cambió externamente; reinicia Director para evitar una edición obsoleta.')
            if expected!=self.hash:raise ValueError('El guion cambió; recarga antes de editar.')
            before=json.loads(json.dumps(self.script)); updated=apply_command(self.script,value); issues=validate_script(updated,self.bundle)
            if issues:raise ValueError('; '.join(x['explicacion'] for x in issues))
            self.undo.append(before); self.undo=self.undo[-100:]; self.redo.clear(); self.script=updated; self.save_draft(); return self.hash
    def travel(self,direction):
        source,target=(self.undo,self.redo) if direction=='undo' else (self.redo,self.undo)
        if not source:return self.hash
        target.append(self.script); self.script=source.pop(); self.save_draft(); return self.hash
    def _command(self,script,args,scene=None):
        blender=os.path.expandvars(os.path.expanduser(self.bundle['proyecto']['produccion']['blender']))
        command=[blender,'--background','--factory-startup','--disable-autoexec']
        if scene:command.append(str(scene))
        return command+['--python-exit-code','1','--python',str(Path(__file__).parent/script),'--',*map(str,args)]
    def job(self,kind,shot=None,frame=None):
        identifier=uuid.uuid4().hex; record={'id':identifier,'tipo':kind,'estado':'pendiente','inicio':time.time(),'progreso':0,'log':''}; self.jobs[identifier]=record
        def run():
            record['estado']='ejecutando'; record['progreso']=.02
            try:
                compiled=compile_script(self.bundle,self.script); identity=digest({'direccion':self.script,'arquitectura':self.bundle['arquitectura_hash'],'interiorismo':self.bundle['interiorismo']})[:20]
                root=self.draft.parent/'trabajos'/identity; root.mkdir(parents=True,exist_ok=True); datafile=root/'resuelto.json'; datafile.write_text(json.dumps(compiled,ensure_ascii=False))
                scene=root/'escena.blend'; log=root/(kind+'.log'); record['log']=str(log); record['salida']=str(root)
                commands=[]
                if not scene.exists():commands.append(self._command('blender_build.py',['--datos',datafile,'--salida',scene]))
                fps=self.script['fps']; total=round(self.script['duracion']*fps)
                if kind=='frame': frames=[max(1,min(total,int(frame or 1)))]; profile='previa'
                elif kind=='shot':
                    cut=next((x for x in self.script['tomas'] if x['id']==shot or x['camara']==shot),None)
                    if not cut:raise ValueError('Toma inexistente.')
                    first=round(cut['inicio']*fps)+1; last=min(total,round((cut['inicio']+cut['duracion'])*fps)); frames=[first,(first+last)//2,last]; profile='piloto_fotografico'
                else:frames=[]; profile='animatica' if kind=='animatic' else ('fotografico_1080p' if 'fotografico_1080p' in compiled['proyecto']['produccion']['perfiles'] else 'final')
                folder=root/profile; render_args=['--datos',datafile,'--salida',folder,'--perfil',profile]
                if frames:render_args+=['--frames',','.join(map(str,sorted(set(frames))))]
                commands.append(self._command('render.py',render_args,scene))
                for index,command in enumerate(commands):
                    with log.open('a') as stream:
                        process=subprocess.Popen(command,stdout=stream,stderr=subprocess.STDOUT,text=True); record['_process']=process
                        while process.poll() is None:
                            if record['estado']=='cancelado':process.terminate(); process.wait(timeout=10); return
                            produced=len(list(folder.glob('frame_*.png'))) if folder.exists() else 0
                            expected=len(frames) if frames else total; record['progreso']=min(.96,(index+produced/max(1,expected))/len(commands)); time.sleep(.35)
                    if process.returncode:raise RuntimeError('Blender terminó con código '+str(process.returncode))
                if kind in {'animatic','render'}:
                    from .production import ffmpeg_args
                    target=folder/'recorrido.mp4'; temp=folder/'recorrido.tmp.mp4'; encoded={**compiled['proyecto']['produccion']['perfiles'][profile],'postproduccion':compiled['presentacion'].get('postproduccion',{})}
                    with log.open('a') as stream:
                        process=subprocess.Popen(ffmpeg_args(folder,temp,fps,encoded),stdout=subprocess.DEVNULL,stderr=stream); record['_process']=process
                        while process.poll() is None:
                            if record['estado']=='cancelado':process.terminate(); process.wait(timeout=10); return
                            time.sleep(.25)
                    if process.returncode:raise RuntimeError('FFmpeg terminó con código '+str(process.returncode))
                    os.replace(temp,target); record['video']=str(target)
                record['estado']='completo'; record['progreso']=1
            except Exception as exc:record.update(estado='error',progreso=1,log=str(exc))
            record['fin']=time.time()
        threading.Thread(target=run,daemon=True).start(); return record

def create_app(project,variant=None):
    session=DirectorSession(project,variant); app=FastAPI(title='Xixova Director',version='0.1.0')
    @app.get('/api/project')
    def project_state():
        issues=validate_script(session.script,session.bundle); return {'contexto':context(session.bundle,session.script,issues=issues),'script_hash':session.hash,'arquitectura':session.bundle['arquitectura_hash'],'draft':str(session.draft),'source':str(session.source)}
    @app.get('/api/context')
    def director_context():return context(session.bundle,session.script,issues=validate_script(session.script,session.bundle))
    @app.get('/api/scene')
    def scene(): return scene_payload(session.bundle,session.script)
    @app.get('/api/scene.glb')
    def glb(): return Response(make_glb(scene_payload(session.bundle,session.script)),media_type='model/gltf-binary',headers={'ETag':session.bundle['arquitectura_hash']+'-'+session.hash})
    @app.get('/api/script')
    def script(): return {'hash':session.hash,'script':session.script}
    @app.put('/api/script')
    def put_script(body:dict):
        if not session.sources_current():raise HTTPException(409,'El proyecto cambió externamente; reinicia Director.')
        if body.get('hash')!=session.hash:raise HTTPException(409,'El guion cambió; recarga.')
        issues=validate_script(body.get('script',{}),session.bundle)
        if issues:raise HTTPException(422,issues)
        session.undo.append(session.script); session.script=body['script']; session.save_draft()
        if body.get('publish'): atomic_yaml(session.source,session.script)
        return {'ok':True,'hash':session.hash,'publicado':bool(body.get('publish'))}
    @app.post('/api/commands')
    def commands(body:dict):
        try:return {'ok':True,'hash':session.command(body['command'],body['hash']),'script':session.script}
        except ValueError as exc:raise HTTPException(409,str(exc))
    @app.post('/api/undo')
    def undo():return {'hash':session.travel('undo'),'script':session.script}
    @app.post('/api/redo')
    def redo():return {'hash':session.travel('redo'),'script':session.script}
    @app.post('/api/validate')
    def validate():
        issues=validate_script(session.script,session.bundle); return {'ok':not issues,'diagnosticos':issues,'contexto':context(session.bundle,session.script,issues=issues)}
    @app.post('/api/preview/frame')
    def preview_frame(body:dict):return session.job('frame',body.get('toma'),body.get('frame'))
    @app.post('/api/preview/shot')
    def preview_shot(body:dict):return session.job('shot',body.get('toma'))
    @app.post('/api/animatic')
    def animatic():return session.job('animatic')
    @app.post('/api/render')
    def render():return session.job('render')
    @app.delete('/api/jobs/{job_id}')
    def cancel(job_id:str):
        job=session.jobs.get(job_id)
        if not job:raise HTTPException(404,'Trabajo inexistente.')
        job['estado']='cancelado'; process=job.get('_process')
        if process and process.poll() is None:process.terminate()
        return {k:v for k,v in job.items() if not k.startswith('_')}
    @app.websocket('/api/jobs')
    async def jobs(socket:WebSocket):
        await socket.accept()
        try:
            while True:await socket.send_json([{k:v for k,v in x.items() if not k.startswith('_')} for x in session.jobs.values()]); await asyncio.sleep(.5)
        except Exception:return
    static=Path(__file__).resolve().parent/'director_web'/'dist'
    if static.is_dir():app.mount('/',StaticFiles(directory=static,html=True),name='director')
    return app

def serve(project,variant=None,host='127.0.0.1',port=8765,open_browser=True):
    import uvicorn
    if open_browser:threading.Timer(.8,lambda:webbrowser.open(f'http://{host}:{port}')).start()
    uvicorn.run(create_app(project,variant),host=host,port=port,log_level='warning')
