"""Servidor local de Xixova Director."""
from __future__ import annotations
import asyncio, copy, json, os, re, subprocess, sys, threading, time, uuid, webbrowser
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.responses import FileResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from .core import digest
from .director import apply_command, atomic_yaml, compile_script, context, import_legacy, read_or_import, sample, scene_payload, validate_script
from .director_glb import make_glb
from .tour import PRESETS, propose_tour

class DirectorSession:
    def __init__(self,project,variant):
        self.project=Path(project).resolve(); self.variant=variant; self.bundle,self.script,self.source,self.draft,self.hash=read_or_import(self.project,variant)
        selected=variant or next(iter(self.bundle['proyecto']['variantes'])); self.director_root=self.project.parent/'.director'/selected
        self.scripts_root=self.director_root/'guiones'; self.drafts_root=self.director_root/'borradores'; self.active_id='principal'; self.active_name='Guion principal'; self.dirty=self.draft.is_file(); self.loaded_draft=self.draft
        self.meta_path=self.director_root/'biblioteca.yaml'; self.meta={}
        if self.meta_path.is_file():
            import yaml
            self.meta=yaml.safe_load(self.meta_path.read_text()) or {}
        self.undo=[]; self.redo=[]; self.jobs={}; self.proposals={}; self.lock=threading.Lock(); self.project_sources=dict(self.bundle.get('sincronizacion',{}).get('archivos',{}))
        self.restore_render_history()

    def restore_render_history(self):
        """Discover persisted CLI output without rewriting project or render files."""
        from .cli import output
        current=output(self.bundle)
        for root in sorted(current.parent.glob('*')):
            if not root.is_dir() or not (root/'resuelto.json').is_file(): continue
            for profile in ('piloto_fotografico','previa','animatica'):
                folder=root/profile
                if not folder.is_dir() or not any(folder.glob('frame_*.png')): continue
                identifier='cli_'+root.name+'_'+profile
                record={'id':identifier,'tipo':'script','estado':'completo','progreso':1,'origen':'CLI','historico':root!=current,'perfil':profile,'inicio':folder.stat().st_mtime,'_root':str(root),'_folder':str(folder),'log':str(root/'logs'/f'{profile}.log')}
                record['artefactos']=self.artifacts(record); self.jobs[identifier]=record
    def sources_current(self):
        import hashlib
        return all(Path(path).is_file() and hashlib.sha256(Path(path).read_bytes()).hexdigest()==value for path,value in self.project_sources.items())
    def draft_path(self,identifier=None):return self.drafts_root/f'{identifier or self.active_id}.yaml'
    def script_path(self,identifier=None):return self.scripts_root/f'{identifier or self.active_id}.yaml'
    def save_draft(self):
        target=self.draft_path(); atomic_yaml(target,self.script)
        if self.loaded_draft!=target and self.loaded_draft.is_file():self.loaded_draft.unlink()
        self.draft=target; self.loaded_draft=target; self.hash=digest(self.script); self.dirty=True
    def library(self):
        entries=[]; seen=set()
        def add(identifier,name,path,state,origin):
            if identifier in seen or not path.is_file():return
            seen.add(identifier); data=__import__('yaml').safe_load(path.read_text()) or {}; stat=path.stat()
            metadata=self.meta.get(identifier,{})
            entries.append({'id':identifier,'nombre':metadata.get('nombre',name),'estado':'archivado' if metadata.get('estado')=='archivado' else state,'origen':origin,'duracion':data.get('duracion'), 'fps':data.get('fps'),'hash':digest(data),'modificado':stat.st_mtime,'activo':identifier==self.active_id,'cambios':identifier==self.active_id and self.dirty})
        identifiers={p.stem for p in self.scripts_root.glob('*.yaml')}|{p.stem for p in self.drafts_root.glob('*.yaml')}
        for identifier in sorted(identifiers):
            draft=self.draft_path(identifier); published=self.script_path(identifier); add(identifier,identifier.replace('_',' ').title(),draft if draft.is_file() else published,'borrador' if draft.is_file() else 'publicado','director')
        for path in sorted((self.director_root/'archivados').glob('*.yaml')):add(path.stem,path.stem.replace('_',' ').title(),path,'archivado','director')
        add('principal','Guion principal',self.loaded_draft if self.dirty else self.source,'borrador' if self.dirty else 'publicado','guion_direccion')
        legacy=self.bundle['proyecto'].get('guion_camara')
        if legacy and (self.project.parent/legacy).is_file():entries.append({'id':'legacy_camara','nombre':'Guion de cámara original','estado':'importado','origen':'guion_camara','duracion':self.script.get('duracion'),'fps':self.script.get('fps'),'hash':None,'modificado':(self.project.parent/legacy).stat().st_mtime,'activo':False,'cambios':False})
        return sorted(entries,key=lambda x:(not x['activo'],-x['modificado']))
    def activate(self,identifier):
        if self.dirty:raise ValueError('El guion activo tiene cambios en borrador; publícalos antes de cambiar.')
        path=self.draft_path(identifier) if self.draft_path(identifier).is_file() else self.script_path(identifier)
        if identifier=='principal' and not path.is_file():path=self.source
        if not path.is_file():raise ValueError('Guion inexistente.')
        import yaml
        candidate=yaml.safe_load(path.read_text()); issues=validate_script(candidate,self.bundle)
        if issues:raise ValueError('; '.join(x['explicacion'] for x in issues))
        self.active_id=identifier; self.active_name=identifier.replace('_',' ').title(); self.script=candidate; self.hash=digest(candidate); self.draft=self.draft_path(); self.loaded_draft=self.draft; self.source=self.script_path(); self.dirty=self.draft.is_file(); self.undo=[]; self.redo=[]
    def create_script(self,name,source=None):
        identifier=re.sub(r'[^a-z0-9]+','_',name.lower()).strip('_') or 'guion'; base=identifier; counter=2
        while self.script_path(identifier).exists() or self.draft_path(identifier).exists():identifier=f'{base}_{counter}';counter+=1
        candidate=copy.deepcopy(source or self.script); atomic_yaml(self.draft_path(identifier),candidate); self.meta[identifier]={'nombre':name,'estado':'borrador'}; atomic_yaml(self.meta_path,self.meta); return identifier
    def rename(self,identifier,name):
        self.meta.setdefault(identifier,{})['nombre']=name; atomic_yaml(self.meta_path,self.meta)
    def archive(self,identifier):
        if identifier==self.active_id:raise ValueError('No se puede archivar el guion activo.')
        archive=self.director_root/'archivados'; archive.mkdir(parents=True,exist_ok=True)
        for path in (self.draft_path(identifier),self.script_path(identifier)):
            if path.is_file():os.replace(path,archive/f'{identifier}.yaml')
        self.meta.setdefault(identifier,{})['estado']='archivado'; atomic_yaml(self.meta_path,self.meta)
    def publish(self):
        atomic_yaml(self.script_path(),self.script)
        if self.active_id=='principal':atomic_yaml(self.source,self.script)
        draft=self.draft_path()
        if draft.is_file():draft.unlink()
        self.loaded_draft=draft; self.meta.setdefault(self.active_id,{})['estado']='publicado'; atomic_yaml(self.meta_path,self.meta); self.dirty=False
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
    def artifacts(self,record):
        root=Path(record.get('_root',''))
        if not root.is_dir():return []
        frames=record.get('_frames',[]); labels=record.get('_labels',{}); scan=Path(record.get('_folder',root))
        result=[]
        for path in sorted(scan.glob('frame_*.png')):
            try:frame=int(path.stem.split('_')[-1])
            except ValueError:frame=None
            if frames and frame not in frames:continue
            relative=path.relative_to(root).as_posix(); result.append({'id':relative,'tipo':'imagen','nombre':path.name,'frame':frame,'rol':labels.get(frame,'fotograma'),'url':f"/api/jobs/{record['id']}/artifacts/{relative}",'descarga':f"/api/jobs/{record['id']}/artifacts/{relative}?download=1"})
        for path in sorted(scan.glob('*.mp4')):
            relative=path.relative_to(root).as_posix();result.append({'id':relative,'tipo':'video','nombre':path.name,'url':f"/api/jobs/{record['id']}/artifacts/{relative}",'descarga':f"/api/jobs/{record['id']}/artifacts/{relative}?download=1"})
        for path in sorted(scan.glob('contacto.jpg')):
            relative=path.relative_to(root).as_posix();result.append({'id':relative,'tipo':'contacto','nombre':path.name,'rol':'hoja de contactos','url':f"/api/jobs/{record['id']}/artifacts/{relative}",'descarga':f"/api/jobs/{record['id']}/artifacts/{relative}?download=1"})
        for item in result:
            if item.get('frame'):
                cut=next((x for x in self.script['tomas'] if round(x['inicio']*self.script['fps'])+1<=item['frame']<=round((x['inicio']+x['duracion'])*self.script['fps'])),None)
                item['toma']=cut['id'] if cut else None; item['tiempo']=round((item['frame']-1)/self.script['fps'],3)
                if cut:
                    track=next((x for x in self.script['pistas'] if x['objetivo']==cut['camara'] and x['propiedad']=='lente'),None); item['lente']=sample(track,item['tiempo']) if track else None
        return result
    def job(self,kind,shot=None,frame=None):
        identifier=uuid.uuid4().hex; record={'id':identifier,'tipo':kind,'toma':shot,'frame':frame,'estado':'pendiente','inicio':time.time(),'progreso':0,'log':''}; self.jobs[identifier]=record
        def run():
            record['estado']='ejecutando'; record['progreso']=.02
            try:
                from .cli import output
                compiled=compile_script(self.bundle,self.script); identity=digest({'direccion':self.script,'produccion':str(output(compiled))})[:20]
                root=self.draft.parent/'trabajos'/identity; root.mkdir(parents=True,exist_ok=True); record['_root']=str(root); datafile=root/'resuelto.json'; datafile.write_text(json.dumps(compiled,ensure_ascii=False))
                if kind=='render':
                    audit=root/'auditoria_fotografia.json'; review=root/'revision_visual.json'
                    if not audit.is_file() or not json.loads(audit.read_text()).get('auditoria_fotografica',False) or not review.is_file() or json.loads(review.read_text()).get('hash')!=identity:
                        raise ValueError('Render final bloqueado: falta auditoría fotográfica y revisión visual para este guion.')
                scene=root/'escena.blend'; log=root/(kind+'.log'); record['log']=str(log); record['salida']=str(root)
                commands=[]
                if not scene.exists():commands.append(self._command('blender_build.py',['--datos',datafile,'--salida',scene]))
                fps=self.script['fps']; total=round(self.script['duracion']*fps)
                if kind=='frame': frames=[max(1,min(total,int(frame or 1)))]; profile='previa'
                elif kind=='shot':
                    cut=next((x for x in self.script['tomas'] if x['id']==shot or x['camara']==shot),None)
                    if not cut:raise ValueError('Toma inexistente.')
                    first=round(cut['inicio']*fps)+1; last=min(total,round((cut['inicio']+cut['duracion'])*fps)); frames=[first,(first+last)//2,last]; profile='piloto_fotografico'
                elif kind=='script':
                    frames=[]
                    for cut in self.script['tomas']:
                        first=round(cut['inicio']*fps)+1; last=min(total,round((cut['inicio']+cut['duracion'])*fps)); frames.extend([first,(first+last)//2,last])
                    profile='piloto_fotografico'
                else:frames=[]; profile='animatica' if kind=='animatic' else ('fotografico_1080p' if 'fotografico_1080p' in compiled['proyecto']['produccion']['perfiles'] else 'final')
                record['_frames']=sorted(set(frames))
                labels={}
                for cut in self.script['tomas']:
                    first=round(cut['inicio']*fps)+1; last=min(total,round((cut['inicio']+cut['duracion'])*fps)); middle=(first+last)//2
                    labels.update({first:'inicio',middle:'centro',last:'final'})
                record['_labels']=labels; folder=root/profile; record['_folder']=str(folder); render_args=['--datos',datafile,'--salida',folder,'--perfil',profile]
                if frames:render_args+=['--frames',','.join(map(str,sorted(set(frames))))]
                commands.append(self._command('render.py',render_args,scene))
                for index,command in enumerate(commands):
                    with log.open('a') as stream:
                        process=subprocess.Popen(command,stdout=stream,stderr=subprocess.STDOUT,text=True); record['_process']=process
                        while process.poll() is None:
                            if record['estado']=='cancelado':process.terminate(); process.wait(timeout=10); return
                            produced=len(list(folder.glob('frame_*.png'))) if folder.exists() else 0
                            record['artefactos']=self.artifacts(record)
                            expected=len(frames) if frames else total; record['progreso']=min(.96,(index+produced/max(1,expected))/len(commands)); time.sleep(.35)
                    if process.returncode:raise RuntimeError('Blender terminó con código '+str(process.returncode))
                if kind=='script':
                    previews=sorted(folder.glob('frame_*.png')); rows=max(1,(len(previews)+2)//3)
                    if previews:subprocess.run(['ffmpeg','-v','error','-y','-pattern_type','glob','-i',str(folder/'frame_*.png'),'-vf',f'scale=320:-1,tile=3x{rows}','-frames:v','1',str(folder/'contacto.jpg')],check=True)
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
                record['artefactos']=self.artifacts(record); record['estado']='completo'; record['progreso']=1
            except Exception as exc:record.update(estado='error',progreso=1,error=str(exc),artefactos=self.artifacts(record))
            record['fin']=time.time()
        threading.Thread(target=run,daemon=True).start(); return record

def create_app(project,variant=None):
    session=DirectorSession(project,variant); app=FastAPI(title='Xixova Director',version='0.1.0'); app.state.session=session
    maquette_preview=session.director_root/'maqueta_preview'; maquette_preview.mkdir(parents=True,exist_ok=True)
    @app.get('/api/project')
    def project_state():
        issues=validate_script(session.script,session.bundle); return {'contexto':context(session.bundle,session.script,issues=issues),'script_hash':session.hash,'arquitectura':session.bundle['arquitectura_hash'],'draft':str(session.draft),'source':str(session.source)}
    @app.get('/api/context')
    def director_context():
        value=context(session.bundle,session.script,issues=validate_script(session.script,session.bundle))
        if getattr(session,'last_proposal',None):
            proposal=session.last_proposal['value']; value['recorrido_propuesto']={'id':session.last_proposal['id'],'preset':proposal['preset'],'areas':proposal['areas'],'duracion':proposal['duracion'],'diagnosticos':proposal['diagnosticos']}
        return value
    @app.get('/api/maqueta/manifest')
    def maquette_manifest():
        from .maquette import audit, build_payload
        payload=build_payload(session.bundle); return {'escena':payload,'auditoria':audit(session.bundle,payload)}
    @app.post('/api/maqueta/export')
    def maquette_export(body:dict={}):
        from .maquette import export
        identifier='maqueta_'+uuid.uuid4().hex[:10]; session.jobs[identifier]={'id':identifier,'tipo':'maqueta','estado':'ejecutando','progreso':.1,'inicio':time.time()}
        try:
            result=export(session.bundle,maquette_preview); session.jobs[identifier].update(estado='completo',progreso=1,fin=time.time(),resultado=result)
        except Exception as exc:
            session.jobs[identifier].update(estado='error',progreso=1,fin=time.time(),error=str(exc))
        return {**session.jobs[identifier],'url':'/maqueta-publica/index.html' if session.jobs[identifier]['estado']=='completo' else None}
    @app.get('/api/maqueta/status/{job_id}')
    def maquette_status(job_id:str):
        job=session.jobs.get(job_id)
        if not job or job.get('tipo')!='maqueta':raise HTTPException(404,'Exportación de maqueta inexistente.')
        return {k:v for k,v in job.items() if not k.startswith('_')}
    @app.get('/api/scene')
    def scene(): return scene_payload(session.bundle,session.script)
    @app.get('/api/scene.glb')
    def glb(): return Response(make_glb(scene_payload(session.bundle,session.script)),media_type='model/gltf-binary',headers={'ETag':session.bundle['arquitectura_hash']+'-'+session.hash})
    @app.get('/api/script')
    def script(): return {'hash':session.hash,'script':session.script}
    @app.get('/api/scripts')
    def scripts():return {'activo':session.active_id,'cambios':session.dirty,'guiones':session.library()}
    @app.post('/api/scripts')
    def create_script(body:dict):
        identifier=session.create_script(body.get('nombre','Nuevo guion')); return {'ok':True,'id':identifier,'guiones':session.library()}
    @app.post('/api/scripts/import')
    def import_script(body:dict):
        if body.get('origen')=='legacy_camara':candidate=import_legacy(session.bundle); name=body.get('nombre','Importado de guion_camara')
        elif isinstance(body.get('script'),dict):candidate=body['script']; name=body.get('nombre','Guion importado')
        else:raise HTTPException(422,'Indica origen legacy_camara o un script válido.')
        issues=validate_script(candidate,session.bundle)
        if issues:raise HTTPException(422,issues)
        identifier=session.create_script(name,candidate); return {'ok':True,'id':identifier,'guiones':session.library()}
    @app.post('/api/scripts/{identifier}/duplicate')
    def duplicate_script(identifier:str,body:dict):
        path=session.draft_path(identifier) if session.draft_path(identifier).is_file() else session.script_path(identifier)
        if identifier=='principal' and not path.is_file():path=session.source
        if not path.is_file():raise HTTPException(404,'Guion inexistente.')
        import yaml
        created=session.create_script(body.get('nombre',identifier+' copia'),yaml.safe_load(path.read_text())); return {'ok':True,'id':created,'guiones':session.library()}
    @app.post('/api/scripts/{identifier}/activate')
    def activate_script(identifier:str):
        try:session.activate(identifier); return {'ok':True,'id':identifier,'hash':session.hash,'script':session.script}
        except ValueError as exc:raise HTTPException(409,str(exc))
    @app.patch('/api/scripts/{identifier}')
    def rename_script(identifier:str,body:dict):
        if not body.get('nombre'):raise HTTPException(422,'El nombre es obligatorio.')
        session.rename(identifier,body['nombre']); return {'ok':True,'guiones':session.library()}
    @app.post('/api/scripts/{identifier}/archive')
    def archive_script(identifier:str):
        try:session.archive(identifier); return {'ok':True,'guiones':session.library()}
        except ValueError as exc:raise HTTPException(409,str(exc))
    @app.put('/api/script')
    def put_script(body:dict):
        if not session.sources_current():raise HTTPException(409,'El proyecto cambió externamente; reinicia Director.')
        if body.get('hash')!=session.hash:raise HTTPException(409,'El guion cambió; recarga.')
        issues=validate_script(body.get('script',{}),session.bundle)
        if issues:raise HTTPException(422,issues)
        session.undo.append(session.script); session.script=body['script']; session.save_draft()
        if body.get('publish'):session.publish()
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
    @app.post('/api/preview/script')
    def preview_script():return session.job('script')
    @app.post('/api/animatic')
    def animatic():return session.job('animatic')
    @app.post('/api/render')
    def render():return session.job('render')
    @app.get('/api/jobs/{job_id}')
    def get_job(job_id:str):
        job=session.jobs.get(job_id)
        if not job:raise HTTPException(404,'Trabajo inexistente.')
        job['artefactos']=session.artifacts(job); return {k:v for k,v in job.items() if not k.startswith('_')}
    @app.get('/api/jobs/{job_id}/artifacts')
    def get_artifacts(job_id:str):
        job=session.jobs.get(job_id)
        if not job:raise HTTPException(404,'Trabajo inexistente.')
        return {'artefactos':session.artifacts(job)}
    @app.get('/api/jobs/{job_id}/artifacts/{artifact:path}')
    def get_artifact(job_id:str,artifact:str,download:bool=False):
        job=session.jobs.get(job_id)
        if not job or not job.get('_root'):raise HTTPException(404,'Trabajo inexistente.')
        root=Path(job['_root']).resolve(); target=(root/artifact).resolve()
        if root not in target.parents or not target.is_file():raise HTTPException(404,'Artefacto inexistente.')
        return FileResponse(target,filename=target.name if download else None)
    @app.get('/api/jobs/{job_id}/log')
    def get_job_log(job_id:str):
        job=session.jobs.get(job_id); path=Path(job.get('log','')) if job else None
        if not path or not path.is_file():raise HTTPException(404,'Log inexistente.')
        return PlainTextResponse(path.read_text(errors='replace')[-20000:])
    @app.get('/api/tour-presets')
    def tour_presets():return {'presets':[{'id':key,**value} for key,value in PRESETS.items()],'areas':[{'id':x['id'],'tipo':__import__('xixova.tour',fromlist=['room_kind']).room_kind(x['id'])} for x in session.bundle['arquitectura']['espacios']]}
    @app.post('/api/tours/propose')
    def propose(body:dict):
        try:value=propose_tour(session.bundle,body.get('areas'),body.get('preset','visita_completa'),body.get('orden','natural'))
        except ValueError as exc:raise HTTPException(422,str(exc))
        identifier=uuid.uuid4().hex[:12]; session.proposals[identifier]={'hash':session.hash,'value':value,'created':time.time()}; session.last_proposal={'id':identifier,**session.proposals[identifier]}; return {'proposal_id':identifier,**value}
    @app.post('/api/tours/{proposal_id}/apply')
    def apply_tour(proposal_id:str,body:dict):
        proposal=session.proposals.get(proposal_id)
        if not proposal:raise HTTPException(404,'Propuesta inexistente o vencida.')
        if body.get('hash')!=session.hash or proposal['hash']!=session.hash:raise HTTPException(409,'El guion cambió; genera nuevamente la propuesta.')
        if not proposal['value']['ok']:raise HTTPException(422,proposal['value']['diagnosticos'])
        identifier=session.create_script(body.get('nombre','Recorrido automático'),proposal['value']['guion']); return {'ok':True,'id':identifier,'guiones':session.library()}
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
    app.mount('/maqueta-publica',StaticFiles(directory=maquette_preview,html=True),name='maqueta-publica')
    static=Path(__file__).resolve().parent/'director_web'/'dist'
    if static.is_dir():app.mount('/',StaticFiles(directory=static,html=True),name='director')
    return app

def serve(project,variant=None,host='127.0.0.1',port=8765,open_browser=True):
    import uvicorn
    if open_browser:threading.Timer(.8,lambda:webbrowser.open(f'http://{host}:{port}')).start()
    uvicorn.run(create_app(project,variant),host=host,port=port,log_level='warning')
