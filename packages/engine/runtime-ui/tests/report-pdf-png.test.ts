import { describe, expect, it } from 'vitest';
import { deflateSync, inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { jsPDF } from 'jspdf';
import { opaquePngStream, reuseNativePng, prepareNativePng } from '../src/report-pdf-png';

// The fast path consumes native canvas output. Here chunk payloads isolate its RGB/alpha guard.
function png(colorType = 2, raw = Buffer.from([0,255,0,0,0,255,0]), width=2, height=1, level=6) {
  const chunk = (name:string,data:Buffer) => {
    const bytes=Buffer.alloc(data.length+12);bytes.writeUInt32BE(data.length);bytes.write(name,4);data.copy(bytes,8);return bytes;
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=colorType;
  const compressed=deflateSync(raw,{level});
  return {raw,bytes:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed.subarray(0,3)),chunk('IDAT',compressed.subarray(3)),chunk('IEND',Buffer.alloc(0))])};
}

describe('native RGB PNG embedding',()=>{
  it('joins IDAT without decoding or recompressing pixels, and embeds the PNG predictor',()=>{
    const {bytes,raw}=png();const stream=opaquePngStream(bytes)!;
    expect([stream.width,stream.height]).toEqual([2,1]);
    expect(inflateSync(stream.data)).toEqual(raw);
    const pdf=new jsPDF({compress:true});reuseNativePng(pdf);
    pdf.addImage(bytes,'PNG',0,0,210,105,undefined,'FAST');
    const result=Buffer.from(pdf.output('arraybuffer')).toString('latin1');
    expect(result).toContain('/Filter /FlateDecode');
    expect(result).toContain('/Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns 2');
    expect(result).toContain(Buffer.from(stream.data).toString('latin1'));
  });
  it('native stream repacking reduces stored data while preserving every filtered row byte',async()=>{
    const raw=Buffer.alloc((256*3+1)*32);
    const {bytes}=png(2,raw,256,32,0);
    await prepareNativePng(bytes);
    const pdf=new jsPDF();reuseNativePng(pdf);
    const encoder=pdf as unknown as {processPNG(bytes:Uint8Array,index:number,alias:string,compression:string):{data:string}};
    const result=encoder.processPNG(bytes,0,'native','FAST');
    const compressed=Buffer.from(result.data,'latin1');
    expect(compressed.length).toBeLessThan(raw.length/10);
    expect(inflateSync(compressed)).toEqual(raw);
  });
  it('declines alpha, interlacing, truncation and invalid dimensions for the regular PNG decoder',()=>{
    expect(opaquePngStream(png(6).bytes)).toBeUndefined();
    const {bytes}=png();bytes[28]=1;expect(opaquePngStream(bytes)).toBeUndefined();
    expect(opaquePngStream(png().bytes.subarray(0,-1))).toBeUndefined();
    const invalid=png().bytes;invalid.writeUInt32BE(0,16);expect(opaquePngStream(invalid)).toBeUndefined();
  });
  it('keeps the version-locked Worker and screenshot adapter reproducible',()=>{
    execFileSync(process.execPath,['tools/scripts/build-report-pdf.mjs','--check'],{stdio:'pipe'});
  });
});
