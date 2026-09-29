"""Observed process RAM and GPU usage; unavailable measurements stay null."""
import os, subprocess, threading, time
from pathlib import Path

class RenderMonitor:
    def __init__(self):
        self.ram_mb=None; self.vram_mb=None; self.stop_event=threading.Event()
    def sample(self):
        try:
            fields=Path(f'/proc/{os.getpid()}/status').read_text().splitlines()
            value=next(float(x.split()[1])/1024 for x in fields if x.startswith('VmRSS:'))
            self.ram_mb=max(self.ram_mb or 0,value)
        except (OSError,StopIteration,ValueError): pass
        try:
            output=subprocess.check_output(['nvidia-smi','--query-compute-apps=pid,used_gpu_memory','--format=csv,noheader,nounits'],timeout=2,text=True,stderr=subprocess.DEVNULL)
            for row in output.splitlines():
                pid,memory=row.split(',')
                if int(pid)==os.getpid():self.vram_mb=max(self.vram_mb or 0,float(memory))
        except (OSError,ValueError,subprocess.SubprocessError): pass
    def run(self):
        while not self.stop_event.is_set():self.sample(); self.stop_event.wait(.5)
    def __enter__(self):
        self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start();return self
    def __exit__(self,*args):
        self.stop_event.set();self.thread.join(timeout=3);self.sample()
    def report(self):return {'ram_proceso_pico_mb':self.ram_mb,'vram_proceso_pico_mb':self.vram_mb,'intervalo_s':.5}
