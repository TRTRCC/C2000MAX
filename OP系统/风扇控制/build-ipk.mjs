import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const pkgName = 'luci-app-fanctrl';
const displayName = '风扇控制';
const version = '1.0.0';
const arch = 'all';
const root = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const srcDir = path.join(root, 'src');
const outFile = path.join(root, `${displayName}_${version}.ipk`);
const asciiOutFile = path.join(root, `${pkgName}_${version}.ipk`);

const executableDataPaths = new Set([
	'./etc/init.d/fanctrl',
	'./etc/uci-defaults/90-luci-app-fanctrl',
	'./usr/libexec/rpcd/fanctrl',
	'./usr/sbin/fanctrl-refresh-luci',
	'./usr/sbin/fanctrld'
]);

function pad(buf, size) {
	const rem = buf.length % size;
	return rem === 0 ? Buffer.alloc(0) : Buffer.alloc(size - rem);
}

function writeString(header, offset, length, value) {
	header.fill(0, offset, offset + length);
	Buffer.from(String(value)).copy(header, offset, 0, Math.min(length, Buffer.byteLength(String(value))));
}

function writeOctal(header, offset, length, value) {
	const s = value.toString(8).padStart(length - 1, '0') + '\0';
	writeString(header, offset, length, s);
}

function tarHeader(name, size, mode, type = '0') {
	const header = Buffer.alloc(512, 0);
	const normalized = name.replace(/\\/g, '/');
	writeString(header, 0, 100, normalized);
	writeOctal(header, 100, 8, mode);
	writeOctal(header, 108, 8, 0);
	writeOctal(header, 116, 8, 0);
	writeOctal(header, 124, 12, size);
	writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
	header.fill(0x20, 148, 156);
	writeString(header, 156, 1, type);
	writeString(header, 257, 6, 'ustar');
	writeString(header, 263, 2, '00');
	let sum = 0;
	for (const b of header) sum += b;
	writeString(header, 148, 8, sum.toString(8).padStart(6, '0') + '\0 ');
	return header;
}

function makeTar(entries) {
	const parts = [];
	for (const entry of entries) {
		const body = entry.body || Buffer.alloc(0);
		parts.push(tarHeader(entry.name, body.length, entry.mode, entry.type || '0'));
		if (body.length) {
			parts.push(body, pad(body, 512));
		}
	}
	parts.push(Buffer.alloc(1024, 0));
	return Buffer.concat(parts);
}

function addDirEntries(entries, name) {
	const dirName = name.endsWith('/') ? name : `${name}/`;
	if (!entries.some((entry) => entry.name === dirName)) {
		entries.push({ name: dirName, mode: 0o755, type: '5' });
	}
}

function walkData(dir, rel = '.') {
	const entries = [];
	for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
		const abs = path.join(dir, item.name);
		const nextRel = rel === '.' ? `./${item.name}` : `${rel}/${item.name}`;
		if (item.isDirectory()) {
			addDirEntries(entries, nextRel);
			entries.push(...walkData(abs, nextRel));
		} else if (item.isFile()) {
			entries.push({
				name: nextRel,
				mode: executableDataPaths.has(nextRel) ? 0o755 : 0o644,
				body: fs.readFileSync(abs)
			});
		}
	}
	return entries;
}

function installedSizeBytes(entries) {
	return entries.reduce((sum, entry) => sum + (entry.body ? entry.body.length : 0), 0);
}

function makeControlTar(installedSize) {
	const control = `Package: ${pkgName}
Version: ${version}
Depends: libc, rpcd, luci-base, jsonfilter
Source: luci-app-fanctrl
Section: luci
Architecture: ${arch}
Installed-Size: ${installedSize}
Description: 风扇控制
Maintainer: 搞点薯条0007
`;
const postinst = `#!/bin/sh
[ -n "$IPKG_NO_SCRIPT" ] && exit 0
uci -q set fancontrol.settings.enabled='0'
uci commit fancontrol 2>/dev/null
/etc/init.d/fancontrol stop 2>/dev/null
/etc/init.d/fancontrol disable 2>/dev/null
rm -f /usr/lib/lua/luci/controller/fanctrl.lua 2>/dev/null
rm -f /usr/lib/lua/luci/view/fanctrl.htm 2>/dev/null
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null
if [ "$(uci -q get fanctrl.settings.curve_schema_version)" != "2" ]; then
    uci -q set fanctrl.settings.curve_schema_version='2'
    uci -q set fanctrl.silent=curve
    uci -q set fanctrl.silent.temps='45,55,65,75,85,95'
    uci -q set fanctrl.silent.speeds='8,15,28,42,62,82'
    uci -q set fanctrl.balanced=curve
    uci -q set fanctrl.balanced.temps='40,50,60,70,80,90'
    uci -q set fanctrl.balanced.speeds='20,35,52,68,84,100'
    uci -q set fanctrl.performance=curve
    uci -q set fanctrl.performance.temps='35,45,55,65,75,85'
    uci -q set fanctrl.performance.speeds='35,55,70,82,92,100'
    uci -q set fanctrl.custom=curve
    uci -q set fanctrl.custom.temps='35,50,65,80,95'
    uci -q set fanctrl.custom.speeds='20,35,55,75,100'
    uci commit fanctrl 2>/dev/null
fi
/etc/init.d/fanctrl enable 2>/dev/null
/etc/init.d/fanctrl start 2>/dev/null
exit 0
`;
	const prerm = `#!/bin/sh
/etc/init.d/fanctrl stop 2>/dev/null
/etc/init.d/fanctrl disable 2>/dev/null
exit 0
`;
	return makeTar([
		{ name: './control', mode: 0o644, body: Buffer.from(control) },
		{ name: './postinst', mode: 0o755, body: Buffer.from(postinst) },
		{ name: './prerm', mode: 0o755, body: Buffer.from(prerm) }
	]);
}

const dataEntries = walkData(srcDir);
const dataTarGz = zlib.gzipSync(makeTar(dataEntries), { level: 9 });
const controlTarGz = zlib.gzipSync(makeControlTar(installedSizeBytes(dataEntries)), { level: 9 });
const debianBinary = Buffer.from('2.0\n');

const outerTar = makeTar([
	{ name: './debian-binary', mode: 0o644, body: debianBinary },
	{ name: './data.tar.gz', mode: 0o644, body: dataTarGz },
	{ name: './control.tar.gz', mode: 0o644, body: controlTarGz }
]);

const ipkBody = zlib.gzipSync(outerTar, { level: 9 });
fs.writeFileSync(outFile, ipkBody);
fs.writeFileSync(asciiOutFile, ipkBody);

console.log(outFile);
console.log(asciiOutFile);
