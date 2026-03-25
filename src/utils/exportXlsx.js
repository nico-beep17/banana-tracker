/**
 * exportXlsx(wb, filename)
 * Cross-platform Excel export.
 *
 * Web browser  → standard <a>.click() blob download (works perfectly).
 * Capacitor APK → Android WebViews block <a>.click() blob downloads.
 *   Strategy:
 *   1. Try navigator.share() (Web Share API) — available in Android WebView ≥ Chrome 76.
 *      This opens the native share/save sheet so the user can pick Files, Drive, WhatsApp, etc.
 *   2. Fallback: write a base64 data URI to a new window (works for simple viewing, not saving).
 *   3. Last resort: standard blob link (silent fail on older WebViews).
 */

import { Capacitor } from '@capacitor/core';

export async function exportXlsx(wb, filename) {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const isNative = Capacitor.isNativePlatform();

    if (isNative && typeof navigator.share === 'function' && navigator.canShare) {
        // ── Native APK: Use Web Share API to trigger the native share/save sheet ──
        const file = new File([blob], filename, {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: filename });
                return;
            }
        } catch (err) {
            // User cancelled — not an error
            if (err.name === 'AbortError') return;
            console.warn('Web Share API failed, falling back:', err);
        }
    }

    if (isNative) {
        // ── Native APK fallback: base64 data URI in a new window ──
        // Some Android WebViews can "open" a data URI even if they block blob links.
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUri = reader.result; // "data:application/...;base64,..."
            const win = window.open('about:blank', '_blank');
            if (win) {
                win.document.write(`
                    <html><body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                        <p style="font-size:1.1rem;color:#0f172a;font-weight:700;margin-bottom:1rem;">📥 ${filename}</p>
                        <a href="${dataUri}" download="${filename}" style="background:#16a34a;color:white;padding:0.75rem 2rem;border-radius:12px;text-decoration:none;font-weight:700;font-size:1rem;">
                            Tap here to save the file
                        </a>
                        <p style="font-size:0.8rem;color:#64748b;margin-top:1rem;">If the file doesn't download, use the ⋮ browser menu → Download page.</p>
                    </body></html>
                `);
            }
        };
        reader.readAsDataURL(blob);
        return;
    }

    // ── Web browser: standard blob download ──
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
