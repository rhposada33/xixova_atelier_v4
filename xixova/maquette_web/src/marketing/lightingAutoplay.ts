export const AUTOPLAY_RESUME_MS=5_000;
export type AutoplayMode='running'|'temporary'|'explicit';
export type AutoplayState={mode:AutoplayMode;resumeAt:number|null};

export const temporarilyPause=(state:AutoplayState,now:number,resume=true):AutoplayState=>state.mode==='explicit'?state:{mode:'temporary',resumeAt:resume?now+AUTOPLAY_RESUME_MS:Number.POSITIVE_INFINITY};
export const toggleExplicitPause=(state:AutoplayState):AutoplayState=>state.mode==='explicit'?{mode:'running',resumeAt:null}:{mode:'explicit',resumeAt:null};
export const resolveTemporaryPause=(state:AutoplayState,now:number):AutoplayState=>state.mode==='temporary'&&state.resumeAt!==null&&now>=state.resumeAt?{mode:'running',resumeAt:null}:state;
export const shouldAutoplay=(state:AutoplayState,reducedMotion:boolean)=>state.mode==='running'&&!reducedMotion;
