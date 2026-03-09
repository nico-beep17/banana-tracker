const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE_ERROR:', error));

    await page.goto('http://localhost:5173/');
    await new Promise(r => setTimeout(r, 2000));

    // Click Skip Login
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent && b.textContent.includes('Skip Login'));
        if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    // Click Payroll & HR
    await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const tab = tabs.find(t => t.textContent && t.textContent.includes('Payroll & HR'));
        if (tab) tab.click();
    });

    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
