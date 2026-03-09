import ExcelJS from 'exceljs';

export const downloadCSV = async (data, filename) => {
    // Keep the name for backward compatibility, but actually export true .xlsx
    exportToExcel(data, filename.replace('.csv', '.xlsx'));
};

export const exportToExcel = async (data, filename) => {
    if (!data || !data.length) {
        alert("No data available to export.");
        return;
    }

    // Sanitize filename for Windows (remove any invalid characters)
    const safeFilename = filename.replace(/[<>:"/\\|?*]+/g, '_');

    let fileHandle = null;

    // Premium modern capability: Show actual Windows/Mac Save Dialog immediately on user click
    // This perfectly bypasses browser blob memory UUID abstraction errors
    if (window.showSaveFilePicker) {
        try {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: safeFilename,
                types: [{
                    description: 'Excel Workbook',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
                }]
            });
        } catch (error) {
            // User aborted the save dialog, silently cancel operation
            if (error.name !== 'AbortError') {
                console.error("FilePicker Error:", error);
            }
            return;
        }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LAVC ERP - Banana Tracker';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Export Data');

    // Extract headers
    const headers = Object.keys(data[0]);

    // Freeze top row for better readability
    worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
    ];

    // Build ExcelJS columns
    worksheet.columns = headers.map(header => {
        let title = header;
        // Only split camelCase if the header doesn't already contain spaces
        if (!title.includes(' ') && /^[a-z]+[A-Z0-9][a-z0-9A-Z]*$/.test(title)) {
            title = title.replace(/([A-Z])/g, ' $1');
            title = title.charAt(0).toUpperCase() + title.slice(1);
        } else if (!title.includes(' ')) {
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }

        let colWidth = Math.max(title.length + 5, 18);
        return {
            header: title,
            key: header,
            width: colWidth
        };
    });

    // Insert all data rows
    worksheet.addRows(data);

    // Premium Styling: Table Header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF166534' } // Lavc Green background for headers
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 25;

    // Premium Styling: Data Rows formatting & Text Wraps
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header
            row.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
            row.font = { name: 'Calibri', size: 11, color: { argb: 'FF333333' } };

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
                    const strVal = String(cell.value);
                    const colInfo = worksheet.getColumn(colNumber);

                    // Auto-adjust column width smartly (max 45)
                    if (strVal.length > colInfo.width && colInfo.width < 45) {
                        colInfo.width = Math.min(strVal.length + 5, 45);
                    }
                }

                // Apply borders
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Safely write to direct disk if modern browser API is supported
    if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    } else {
        // Fallback for Firefox and Safari (No native OS file picker API yet)
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 3000); // Expanded timeout significantly for heavy Safari blobing
    }
};
