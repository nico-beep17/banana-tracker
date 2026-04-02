import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    // Also inject a listener into the page
    await page.evaluateOnNewDocument(() => {
        window.addEventListener('unhandledrejection', event => {
            console.log('UNHANDLED REJECTION:', event.reason);
        });
        window.addEventListener('error', event => {
            console.log('UNHANDLED ERROR:', event.error);
        });
    });

    console.log('Navigating to https://banana-tracker-five.vercel.app/');
    await page.goto('https://banana-tracker-five.vercel.app/', { waitUntil: 'networkidle0' });
    
    console.log('Waiting 8 seconds...');
    await new Promise(r => setTimeout(r, 8000));

    const content = await page.evaluate(() => document.body.innerText);
    console.log('BODY TEXT:', content.trim());
    
    await browser.close();
})();
