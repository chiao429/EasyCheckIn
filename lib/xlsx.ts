import { inflateRawSync } from 'node:zlib';

function xmlEscape(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function columnName(index: number) {
  let name = '';
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function createZip(files: Array<[string, string]>) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content, 'utf8');
    const checksum = crc32(data);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(0, 6);
    local.writeUInt16LE(0, 8); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26); nameBytes.copy(local, 30);
    locals.push(local, data);
    const directory = Buffer.alloc(46 + nameBytes.length);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(0, 8); directory.writeUInt16LE(0, 10); directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(nameBytes.length, 28); directory.writeUInt32LE(offset, 42); nameBytes.copy(directory, 46);
    central.push(directory);
    offset += local.length + data.length;
  }
  const directoryBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
}

export function createXlsxTemplate(headers: string[]) {
  const cells = headers.map((value, index) => `<c r="${columnName(index)}1" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`).join('');
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="名單" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`],
  ];
  return createZip(files);
}

function zipEntries(buffer: Buffer) {
  let endOffset = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index--) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { endOffset = index; break; }
  }
  if (endOffset < 0) throw new Error('檔案不是有效的 XLSX');
  const count = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('XLSX 壓縮目錄格式錯誤');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    if (method === 0) entries.set(name, compressed);
    else if (method === 8) entries.set(name, inflateRawSync(compressed));
    else throw new Error('不支援此 XLSX 壓縮方式');
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXml(value: string) {
  return value.replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
}

export function parseXlsx(buffer: Buffer): string[][] {
  const files = zipEntries(buffer);
  const sheet = files.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('XLSX 找不到第一個工作表');
  const sharedStrings = (files.get('xl/sharedStrings.xml')?.toString('utf8').match(/<si\b[\s\S]*?<\/si>/g) || []).map((item) =>
    [...item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join(''));
  const xml = sheet.toString('utf8');
  const result: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cellMatch[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      let column = 0;
      for (const letter of ref) column = column * 26 + letter.charCodeAt(0) - 64;
      const index = column - 1;
      const type = cellMatch[1].match(/\bt="([^"]+)"/)?.[1];
      const content = cellMatch[2] || '';
      const value = type === 'inlineStr'
        ? [...content.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('')
        : content.match(/<v>([\s\S]*?)<\/v>/)?.[1] || '';
      while (row.length <= index) row.push('');
      row[index] = type === 's' ? sharedStrings[Number(value)] || '' : decodeXml(value);
    }
    result.push(row);
  }
  return result.filter((row) => row.some((value) => value.trim()));
}
