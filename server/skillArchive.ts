import { crc32 } from 'node:zlib';

// Small, uncompressed ZIP archive. UTF-8 file names, CRC-32 and standard headers;
// no temporary files, executable content or extra archive dependency.
export function skillArchive(files:{name:string;text:string}[]){
  if(files.length>65535)throw new Error('Too many archive entries');
  const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const file of files){
    if(!/^[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.includes('..')||file.name.startsWith('/'))throw new Error('Unsafe archive path');
    const name=Buffer.from(file.name),body=Buffer.from(file.text),checksum=crc32(body);
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(checksum,14);header.writeUInt32LE(body.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(name.length,26);
    local.push(header,name,body);
    const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(checksum,16);entry.writeUInt32LE(body.length,20);entry.writeUInt32LE(body.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);
    offset+=header.length+name.length+body.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
