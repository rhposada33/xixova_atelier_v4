function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const u32=(b,i)=>((b[i]*2**24)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;
function png(b){
  if(b.length<67||hex(b.slice(0,8))!=="89504e470d0a1a0a")return false;
  let pos=8,head=false,data=false,end=false;
  while(pos+12<=b.length){const len=u32(b,pos),kind=new TextDecoder().decode(b.slice(pos+4,pos+8));if(crc32(b.slice(pos+4,pos+8+len))!==u32(b,pos+8+len))return false;pos+=8;if(len>b.length-pos-4)return false;
    if(!["IHDR","PLTE","tRNS","IDAT","IEND"].includes(kind))return false;
    if(!head){if(kind!=="IHDR"||len!==13)return false;const w=u32(b,pos),h=u32(b,pos+4);if(!w||!h||w>8000||h>8000||w*h>20_000_000)return false;head=true;}
    if(kind==="IDAT")data=true;
    pos+=len+4;
    if(kind==="IEND"){end=len===0;break;}
  }
  return head&&data&&end&&pos===b.length;
}
function jpeg(b){
  if(b.length<100||b[0]!==255||b[1]!==216||b.at(-2)!==255||b.at(-1)!==217)return false;
  let pos=2,dimensions=false,scan=false;
  while(pos<b.length-2){if(b[pos++]!==255)return false;while(b[pos]===255)pos++;const marker=b[pos++];
    if(marker===0xda){scan=true;break;}
    if(marker===0xd9||marker===0x00||marker===0xd8||marker>=0xd0&&marker<=0xd7)return false;
    if(pos+2>b.length)return false;const len=(b[pos]<<8)|b[pos+1];if(len<2||pos+len>b.length)return false;
    if(marker>=0xe1&&marker<=0xef||marker===0xfe)return false; // EXIF, XMP, IPTC, comments and other metadata.
    if(marker===0xc0||marker===0xc2){if(len<7)return false;const h=(b[pos+3]<<8)|b[pos+4],w=(b[pos+5]<<8)|b[pos+6];if(!w||!h||w>8000||h>8000||w*h>20_000_000)return false;dimensions=true;}
    pos+=len;
  }
  return dimensions&&scan;
}
function webp(b){
  if(b.length<40||new TextDecoder().decode(b.slice(0,4))!=="RIFF"||new TextDecoder().decode(b.slice(8,12))!=="WEBP"||u32(new Uint8Array([b[7],b[6],b[5],b[4]]),0)+8!==b.length)return false;
  let pos=12,visual=false;
  while(pos+8<=b.length){const kind=new TextDecoder().decode(b.slice(pos,pos+4)),size=(b[pos+4]|b[pos+5]<<8|b[pos+6]<<16|b[pos+7]<<24)>>>0;pos+=8;if(size>b.length-pos)return false;
    if(!["VP8 ","VP8L","VP8X","ALPH"].includes(kind))return false;
    let w=0,h=0;
    if(kind==="VP8 "){if(size<10||b[pos+3]!==0x9d||b[pos+4]!==1||b[pos+5]!==0x2a)return false;w=(b[pos+6]|b[pos+7]<<8)&16383;h=(b[pos+8]|b[pos+9]<<8)&16383;visual=true;}
    if(kind==="VP8L"){if(size<5||b[pos]!==0x2f)return false;w=1+((b[pos+1]|b[pos+2]<<8)&16383);h=1+((b[pos+2]>>6|b[pos+3]<<2|b[pos+4]<<10)&16383);visual=true;}
    if(kind==="VP8X"){if(size!==10||(b[pos]&0x3e)!==0)return false;w=1+(b[pos+4]|b[pos+5]<<8|b[pos+6]<<16);h=1+(b[pos+7]|b[pos+8]<<8|b[pos+9]<<16);}
    if(kind!=="ALPH"&&(!w||!h||w>8000||h>8000||w*h>20000000))return false;
    pos+=size+(size%2);
  }
  return visual&&pos===b.length;
}
export function validImage(bytes,mime){return mime==="image/png"?png(bytes):mime==="image/jpeg"?jpeg(bytes):mime==="image/webp"?webp(bytes):false;}
