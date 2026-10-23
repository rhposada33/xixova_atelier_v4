import sharp from 'sharp';
sharp.cache(false);sharp.concurrency(1);
export async function normalize(input,mime){
 if(input.length>5242880||!['image/png','image/jpeg','image/webp'].includes(mime))throw Error('invalid_input');
 const image=sharp(input,{failOn:'warning',limitInputPixels:20000000,sequentialRead:true});
 const meta=await image.metadata();
 if(`image/${meta.format==='jpeg'?'jpeg':meta.format}`!==mime||!meta.width||!meta.height||meta.width>8000||meta.height>8000||(meta.pages??1)!==1)throw Error('invalid_format');
 const output=await image.rotate().png({compressionLevel:6}).timeout({seconds:3}).toBuffer();
 if(output.length>5242880)throw Error('output_limit');
 return output;
}
