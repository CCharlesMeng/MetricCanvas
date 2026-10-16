import type { jsPDF } from 'jspdf';

type NativePng = {width:number;height:number;data:Uint8Array<ArrayBuffer>};
const optimizedStreams = new WeakMap<Uint8Array,NativePng>();

/** Native, opaque RGB PNG only: its zlib stream is already a valid PDF FlateDecode stream.
 * Input comes exclusively from OffscreenCanvas.convertToBlob, never external PNG bytes.
 * Other native encodings retain jsPDF's PNG decoder, including alpha and palettes.
 */
export function opaquePngStream(bytes: Uint8Array): NativePng | undefined {
  if(bytes.length<45 || ![137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let width=0,height=0,total=0,ended=false;
  const chunks:Uint8Array[]=[];
  for(let offset=8;offset+12<=bytes.length;) {
    const size=view.getUint32(offset);
    if(size>bytes.length-offset-12)return;
    const kind=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(offset===8 && (kind!=='IHDR'||size!==13))return;
    if(kind==='IHDR') {
      if(offset!==8)return;
      width=view.getUint32(offset+8);height=view.getUint32(offset+12);
      if(!width||!height||bytes[offset+16]!==8||bytes[offset+17]!==2||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]!==0)return;
    } else if(kind==='tRNS')return;
    else if(kind==='IDAT'){chunks.push(bytes.subarray(offset+8,offset+8+size));total+=size;}
    else if(kind==='IEND'){if(size!==0||offset+12!==bytes.length)return;ended=true;break;}
    offset+=size+12;
  }
  if(!ended||!total)return;
  const data=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return {width,height,data};
}

/** Repack the filtered rows through native streams, without reconstructing PNG pixels.
 * Chromium's fast canvas PNG can otherwise grow substantially versus the existing PDF.
 */
export async function prepareNativePng(bytes:Uint8Array):Promise<void> {
  const png=opaquePngStream(bytes);
  if(!png)return;
  if(typeof CompressionStream!=='undefined'&&typeof DecompressionStream!=='undefined') {
    const stream=new Blob([png.data]).stream()
      .pipeThrough(new DecompressionStream('deflate'))
      .pipeThrough(new CompressionStream('deflate'));
    const compressed=new Uint8Array(await new Response(stream).arrayBuffer());
    if(compressed.length<png.data.length)png.data=compressed;
  }
  optimizedStreams.set(bytes,png);
}

export function reuseNativePng(pdf: jsPDF): void {
  const encoder=pdf as unknown as {
    processPNG(bytes:Uint8Array,index:number,alias:string,compression:string):unknown;
    __addimage__:{arrayBufferToBinaryString(bytes:Uint8Array):string};
  };
  const original=encoder.processPNG;
  encoder.processPNG=function(bytes,index,alias,compression) {
    const png=optimizedStreams.get(bytes)??opaquePngStream(bytes);
    if(!png)return original.call(this,bytes,index,alias,compression);
    return {
      width:png.width,height:png.height,index,alias,
      data:encoder.__addimage__.arrayBufferToBinaryString(png.data),
      colorSpace:'DeviceRGB',bitsPerComponent:8,filter:'FlateDecode',
      decodeParameters:`/Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${png.width}`
    };
  };
}
