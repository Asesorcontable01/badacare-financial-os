/**
 * ARCHIVIO: cashflow.gs
 * Versione 44.0 - JSON API Bridge + Mobile Frontend
 *
 * Identico a v43.0 lato backend. Il frontend è stato reso responsive
 * (sidebar drawer mobile, breakpoint a 768px e 1024px, viewport meta).
 *
 * DEPLOY:
 *   1. Editor Apps Script → Deploy → New deployment
 *   2. Type: Web app
 *   3. Execute as: Me (your account)
 *   4. Who has access: Anyone
 *   5. Deploy → Authorize → copia l'URL "/exec"
 *   6. Incolla l'URL nel file Index.html (costante API_URL)
 *
 * SICUREZZA: la costante SHARED_SECRET deve coincidere con API_SECRET
 *            in Index.html. Cambia entrambe se vuoi ruotare la chiave.
 */

const SHARED_SECRET = "Badacare2026!";

/* ==================== ROUTER ==================== */
function doGet(e) {
  return jsonOut({
    app: "Badacare Financial OS API",
    version: "v43.0",
    status: "ok",
    note: "POST { fn, args, secret } in JSON body."
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ error: "Empty body" });
    }
    const body = JSON.parse(e.postData.contents);

    if (body.secret !== SHARED_SECRET) {
      return jsonOut({ error: "Unauthorized" });
    }

    const handlers = {
      getDashboardData: getDashboardData,
      manageCategory: manageCategory,
      bulkUpdateCategory: bulkUpdateCategory,
      bulkUpdateStato: bulkUpdateStato,
      deleteTransactions: deleteTransactions,
      updateRecord: updateRecord,
      deleteFileFromDrive: deleteFileFromDrive,
      uploadFile: uploadFile
    };

    const fn = body.fn;
    const args = Array.isArray(body.args) ? body.args : [];

    if (!fn || !handlers[fn]) {
      return jsonOut({ error: "Unknown function: " + fn });
    }

    const result = handlers[fn].apply(null, args);
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.toString() });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ==================== CORE LOGIC ==================== */
function getDashboardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();

    const idx = {
      data: 0, conto: 1, desc: 2, importo: 3, categoria: 4,
      verificato: 5, docRic: 6, note: 8, movimento: 10,
      periodo: 11, docUrl: 12
    };

    let rawData = [];
    let monthsSet = new Set();
    let accountsSet = new Set();

    let masterCats = [];
    const catSheet = ss.getSheetByName("CATEGORIA");
    if (catSheet) {
      let catData = catSheet.getDataRange().getValues();
      for (let i = 1; i < catData.length; i++) {
        let n = catData[i][0] ? catData[i][0].toString().trim() : "";
        let c = catData[i][1] ? catData[i][1].toString().trim() : "#3b82f6";
        if (n) masterCats.push({name: n, color: c});
      }
    }

    for (let s = 0; s < sheets.length; s++) {
      let sheet = sheets[s];
      let sheetName = sheet.getName();

      if (sheetName.toUpperCase() === "CATEGORIA") continue;

      let data = sheet.getDataRange().getValues();
      if (data.length < 2) continue;

      let headerStr = data[0].join("").toUpperCase();
      if (!headerStr.includes("IMPORTO") && !headerStr.includes("CONTO")) continue;

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[idx.importo] === "" || row[idx.importo] === null || row[idx.importo] === undefined) continue;

        let monto = typeof row[idx.importo] === 'number' ? row[idx.importo] : parseFloat(row[idx.importo].toString().replace(/[^\d.,-]/g, '').replace(',', '.'));
        if (isNaN(monto)) continue;

        let movRaw = (row[idx.movimento] || "").toString().toUpperCase();
        let tipo = movRaw.includes("ENTRATE") ? "ENTRATE" : "USCITE";
        let mes = (row[idx.periodo] || "N/D").toString().trim();
        let cuenta = (row[idx.conto] || sheetName).toString().trim();
        let cat = (row[idx.categoria] || "Generale").toString().trim();
        let ok = (row[idx.verificato] || "").toString().toLowerCase() === "ok";
        let docR = (row[idx.docRic] || "").toString().trim();
        let nota = (row[idx.note] || "").toString().trim();
        let doc = (row[idx.docUrl] || "").toString().trim();
        let desc = (row[idx.desc] || "Operazione").toString().trim();

        let dVal = row[idx.data];
        let dateString = "--/--/--";
        let ts = 0;

        if (dVal instanceof Date) {
          dateString = Utilities.formatDate(dVal, "GMT+1", "dd/MM/yyyy");
          ts = dVal.getTime();
        } else if (dVal) {
          dateString = dVal.toString();
          let parts = dateString.split(/[-/]/);
          if(parts.length === 3) {
            if(parts[2].length === 4) ts = new Date(parts[2], parts[1]-1, parts[0]).getTime();
            else ts = Date.parse(dVal) || 0;
          }
        }

        if (mes !== "N/D" && mes !== "") monthsSet.add(mes);
        accountsSet.add(cuenta);

        rawData.push({
          m: Math.abs(monto), t: tipo, c: cat, p: mes, acc: cuenta,
          d: desc, dt: dateString, ts: ts, ok: ok,
          docRic: docR, note: nota, docUrl: doc, rowIdx: i + 1, sheetName: sheetName
        });
      }
    }

    return {
      rows: rawData,
      availableMonths: Array.from(monthsSet).sort().reverse(),
      availableAccounts: Array.from(accountsSet).sort(),
      availableCategories: masterCats.sort((a,b) => a.name.localeCompare(b.name))
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

function manageCategory(action, oldName, newName, newColor) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const catSheet = ss.getSheetByName("CATEGORIA");
    if(!catSheet) return {error: "Foglio 'CATEGORIA' non trovato."};

    let data = catSheet.getDataRange().getValues();

    if (action === 'ADD') {
      catSheet.appendRow([newName, newColor]);
    }
    else if (action === 'DELETE' || action === 'EDIT') {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === oldName) {
          if (action === 'DELETE') {
            catSheet.deleteRow(i + 1);
          } else if (action === 'EDIT') {
            catSheet.getRange(i + 1, 1).setValue(newName);
            catSheet.getRange(i + 1, 2).setValue(newColor);
            if (oldName !== newName) updateCategoryAcrossAllSheets(ss, oldName, newName);
          }
          break;
        }
      }
    }
    return { success: true };
  } catch(e) { return { error: e.toString() }; }
}

function updateCategoryAcrossAllSheets(ss, oldCat, newCat) {
  const sheets = ss.getSheets();
  for (let s = 0; s < sheets.length; s++) {
    let sheet = sheets[s];
    if (sheet.getName().toUpperCase() === "CATEGORIA") continue;
    let maxRow = sheet.getLastRow();
    if (maxRow < 2) continue;

    let range = sheet.getRange(1, 5, maxRow, 1);
    let values = range.getValues();
    let modified = false;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] && values[i][0].toString().trim() === oldCat) {
        values[i][0] = newCat;
        modified = true;
      }
    }
    if (modified) range.setValues(values);
  }
}

// ====== MOTOR MASIVO RAM: CATEGORÍAS (Anti-Cuelgues) ======
function bulkUpdateCategory(itemsStr, newCat) {
  try {
    let itemsToUpdate = JSON.parse(itemsStr);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let grouped = {};

    itemsToUpdate.forEach(item => {
      if (!grouped[item.sheetName]) grouped[item.sheetName] = [];
      grouped[item.sheetName].push(item.rowIdx);
    });

    for (let sheetName in grouped) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;

      let maxRow = sheet.getLastRow();
      if (maxRow < 2) continue;

      let range = sheet.getRange(1, 5, maxRow, 1);
      let values = range.getValues();

      grouped[sheetName].forEach(r => {
         if (r - 1 < values.length) {
             values[r - 1][0] = newCat;
         }
      });

      range.setValues(values);
    }
    return { success: true };
  } catch(e) { return { error: e.toString() }; }
}

// ====== MOTOR MASIVO RAM: ESTADO (Anti-Cuelgues) ======
function bulkUpdateStato(itemsStr, isOk) {
  try {
    let itemsToUpdate = JSON.parse(itemsStr);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let grouped = {};

    itemsToUpdate.forEach(item => {
      if (!grouped[item.sheetName]) grouped[item.sheetName] = [];
      grouped[item.sheetName].push(item.rowIdx);
    });

    const statusStr = isOk ? "Ok" : "Da verificare";
    for (let sheetName in grouped) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;

      let maxRow = sheet.getLastRow();
      if (maxRow < 2) continue;

      let range = sheet.getRange(1, 6, maxRow, 1);
      let values = range.getValues();

      grouped[sheetName].forEach(r => {
         if (r - 1 < values.length) {
             values[r - 1][0] = statusStr;
         }
      });

      range.setValues(values);
    }
    return { success: true };
  } catch(e) { return { error: e.toString() }; }
}

// ====== MOTOR MASIVO RAM: BORRADO AGRUPADO ======
function deleteTransactions(itemsStr) {
  try {
    let itemsToDelete = JSON.parse(itemsStr);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let grouped = {};

    itemsToDelete.forEach(item => {
      if (!grouped[item.sheetName]) grouped[item.sheetName] = [];
      grouped[item.sheetName].push(item.rowIdx);
    });

    for (let sheetName in grouped) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;

      let rows = grouped[sheetName].sort((a, b) => b - a);

      let i = 0;
      while (i < rows.length) {
        let startRow = rows[i];
        let count = 1;
        while (i + 1 < rows.length && rows[i + 1] === startRow - count) {
          count++;
          i++;
        }
        sheet.deleteRows(startRow - count + 1, count);
        i++;
      }
    }
    return { success: true };
  } catch(e) { return { error: e.toString() }; }
}

function updateRecord(sheetName, rowIdx, cat, isOk, note, docRic) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    sheet.getRange(rowIdx, 5).setValue(cat);
    sheet.getRange(rowIdx, 6).setValue(isOk ? "Ok" : "Da verificare");
    sheet.getRange(rowIdx, 7).setValue(docRic);
    sheet.getRange(rowIdx, 9).setValue(note);
    return { success: true };
  } catch(e) { return { error: e.toString() }; }
}

function deleteFileFromDrive(fileUrl, sheetName, rowIdx) {
  try {
    if(fileUrl) {
      const fileIdMatch = fileUrl.match(/[-\w]{25,}/);
      if(fileIdMatch && fileIdMatch[0]) DriveApp.getFileById(fileIdMatch[0]).setTrashed(true);
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    sheet.getRange(rowIdx, 13).clearContent();
    return { success: true };
  } catch(e) { return { error: e.toString() }; }
}

function uploadFile(base64Data, fileName, mimeType, sheetName, rowIdx, oldFileUrl) {
  try {
    if(oldFileUrl) {
      try {
        const oldIdMatch = oldFileUrl.match(/[-\w]{25,}/);
        if(oldIdMatch && oldIdMatch[0]) DriveApp.getFileById(oldIdMatch[0]).setTrashed(true);
      } catch(ignore) {}
    }
    const folderId = "1gi2OGx2M0g2E8p4PaBXaZo-2huYG5ld1";
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    const file = folder.createFile(blob);
    const url = file.getUrl();
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    sheet.getRange(rowIdx, 13).setValue(url);
    return { success: true, url: url };
  } catch(e) { return { error: e.toString() }; }
}
