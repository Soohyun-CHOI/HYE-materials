// An Excel workbook (.xlsx), written whole (#553) — the file the Tools & Equipment list exports.
//
// WRITTEN HERE RATHER THAN BY A LIBRARY, AND THE CELL'S TYPE IS WHY. A workbook is a zip of a
// few XML parts, and what this app needs of one is small and fixed: two sheets of text, whole
// numbers and days, a header row, nothing read back. What it needs most is control over how a
// cell holding somebody's typed words is written, since a note or a name beginning with `=` is
// a formula to whatever opens it the wrong way. Here every text cell is an inline string — no
// part of the file ever holds a formula element — and one whose first character starts a
// formula is marked `quotePrefix`, the mark Excel writes for a value typed after an apostrophe,
// so it stays words when somebody edits the cell and presses Enter as well as when it opens.
// SheetJS's npm release has stood at 0.18.5 since 2022 with advisories fixed only off npm;
// `exceljs` is 21.8 MB unpacked behind `archiver`, `unzipper` and `tmp`; `write-excel-file`, the
// smallest, gives a string no `quotePrefix`. docs/notes/tools.md has the comparison.
//
// SERVER-ONLY, AND OFFLINE-SAFE. It imports `node:zlib` alone, for the deflate and the CRC a zip
// entry carries, so no browser bundle may reach it (the export's button imports none of it) and
// `scripts/tests/offline/asset-export.mjs` runs it under plain `node` — and reads what it writes
// back with `fflate`, a second implementation of the zip and the inflate, since an encoder
// decoding its own output proves only that it agrees with itself (`verification.md`, #351).
//
// WHAT IT DOES NOT TRY TO BE. No shared strings, no themes, no document properties: the format
// asks for only the parts below, and Excel opened what #553 wrote with nothing to repair. A part
// another reader asks for is added when one asks.

import { crc32, deflateRawSync } from "node:zlib";

/** The media type a browser saves the file as. */
export const XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Whether a text cell would start a formula were it typed — `=`, `+`, `-` and `@`, and a tab,
 * a carriage return or a line feed before them, which some readers strip and some treat as
 * the start of a formula of their own (OWASP's CSV injection list, with the line feed besides).
 * Such a cell is written with the `quotePrefix` style. It is asked of every text cell, not of
 * the columns a person types into, so a column added later is covered by being text.
 */
export function startsFormula(text) {
    return /^[=+\-@\t\r\n]/.test(String(text ?? ""));
}

// The characters XML 1.0 cannot carry at all — every control character but the tab, the line
// feed and the carriage return, the two noncharacters at the end of the plane, and a surrogate
// standing alone. A cell drops them rather than producing a part no reader opens.
const UNWRITABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

// A carriage return is written as a reference: a reader of XML turns a literal one in a text
// node into a line feed, so `\r=1` would open as `\n=1`.
function escapeXml(text) {
    return String(text)
        .replace(UNWRITABLE, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\r/g, "&#13;");
}

// The styles a cell takes, by their place in `cellXfs` below.
const STYLE = Object.freeze({ plain: 0, header: 1, words: 2, day: 3 });

// `mm/dd/yyyy`, the app's notation for a day (`lib/format.js`, #463), as a custom number format —
// so a day reads `10/22/2026` in every reader whatever its own locale, and sorts as a day.
const DAY_NUMBER_FORMAT = 164;

const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="1"><numFmt numFmtId="${DAY_NUMBER_FORMAT}" formatCode="mm/dd/yyyy"/></numFmts>` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" quotePrefix="1"/>' +
    `<xf numFmtId="${DAY_NUMBER_FORMAT}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

/** A column's letters: 0 is `A`, 25 `Z`, 26 `AA`. */
function columnName(index) {
    let name = "";
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
}

/**
 * The serial number Excel keeps a day as: days since 1899-12-30, the epoch every reader of the
 * 1900 system counts from, so 2026-10-22 is 46317. `day` is `{ year, month, day }`, a calendar
 * day already in the zone it was asked in — the cell holds no zone, as a day has none.
 */
export function excelDaySerial({ year, month, day }) {
    return Date.UTC(year, month - 1, day) / 86400000 + 25569;
}

// A value beginning or ending in whitespace says so, or a reader trims it.
function textCell(ref, value, style) {
    const space = /^\s|\s$/.test(String(value)) ? ' xml:space="preserve"' : "";
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t${space}>${escapeXml(value)}</t></is></c>`;
}

/**
 * One cell, or nothing for an empty value — a blank stays blank rather than holding an empty
 * string. `kind` is the column's: `text` writes an inline string, `number` a figure and `day` a
 * day's serial under `mm/dd/yyyy`. A text value is written as words whatever it holds.
 */
function cell(ref, kind, value) {
    if (value === null || value === undefined || value === "") return "";
    if (kind === "number") return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : "";
    if (kind === "day") return `<c r="${ref}" s="${STYLE.day}"><v>${excelDaySerial(value)}</v></c>`;
    return textCell(ref, value, startsFormula(value) ? STYLE.words : STYLE.plain);
}

/** One sheet's part: the header row held at the top with a filter over it, then a row per entry. */
function sheetXml({ columns, rows }, first) {
    const last = columnName(columns.length - 1);
    const header = columns.map(({ header: words }, index) => textCell(`${columnName(index)}1`, words, STYLE.header)).join("");
    const body = rows
        .map((values, rowIndex) => {
            const r = rowIndex + 2;
            const cells = columns.map(({ kind }, index) => cell(`${columnName(index)}${r}`, kind, values[index])).join("");
            return `<row r="${r}">${cells}</row>`;
        })
        .join("");
    const widths = columns.map(({ width }, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<dimension ref="A1:${last}${rows.length + 1}"/>` +
        `<sheetViews><sheetView workbookViewId="0"${first ? ' tabSelected="1"' : ""}>` +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="15"/>' +
        `<cols>${widths}</cols>` +
        `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
        `<autoFilter ref="A1:${last}${rows.length + 1}"/>` +
        "</worksheet>"
    );
}

/**
 * The workbook's bytes. `sheets` is `[{ name, columns, rows }]` in tab order: `columns` each
 * `{ header, kind, width }`, and `rows` each an array of values in the columns' order. A sheet's
 * name is at most 31 characters and holds none of `: \ / ? * [ ]`, which Excel refuses; one that
 * does throws here rather than writing a file no reader opens.
 */
export function workbookBytes(sheets) {
    for (const { name } of sheets) {
        if (!name || name.length > 31 || /[:\\/?*[\]]/.test(name)) throw new Error(`workbookBytes: ${JSON.stringify(name)} cannot name a sheet`);
    }
    const sheetEntries = sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet, index === 0)]);
    const parts = [
        [
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
                '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
                sheetEntries
                    .map(([path]) => `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
                    .join("") +
                "</Types>",
        ],
        [
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
                "</Relationships>",
        ],
        [
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                `<sheets>${sheets.map(({ name }, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>` +
                "</workbook>",
        ],
        [
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                sheetEntries
                    .map(([path], index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${path.slice(3)}"/>`)
                    .join("") +
                `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
                "</Relationships>",
        ],
        ["xl/styles.xml", STYLES_XML],
        ...sheetEntries,
    ];
    return zipBytes(parts);
}

/**
 * A zip of `[path, text]` entries, each deflated: a local header and the data per entry, then the
 * central directory and its end record — the whole of what a reader of a zip asks. Every entry
 * carries one fixed moment, 1980-01-01, the format's first, since nothing reads it and a file
 * that is the same for the same rows is easier to compare.
 */
function zipBytes(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const [path, text] of entries) {
        const name = Buffer.from(path, "utf8");
        const data = Buffer.from(text, "utf8");
        const packed = deflateRawSync(data);
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0x0021, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0x0021, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(packed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        locals.push(local, name, packed);
        centrals.push(central, name);
        offset += local.length + name.length + packed.length;
    }
    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return new Uint8Array(Buffer.concat([...locals, directory, end]));
}
