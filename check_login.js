import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.evaluateOnNewDocument(() => {
        window.addEventListener('unhandledrejection', event => {
            console.log('UNHANDLED REJECTION:', event.reason);
        });
        window.addEventListener('error', event => {
            console.log('UNHANDLED ERROR:', event.error);
        });
    });

    console.log('Navigating to http://localhost:5173/');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    
    console.log('Waiting for .btn-google to be in DOM...');
    await page.waitForSelector('.btn-google', { visible: true, timeout: 15000 });

    console.log('Clicking "Sign in with Google" via evaluate...');
    await page.evaluate(() => {
        document.querySelector('.btn-google').click();
    });

    console.log('Waiting 5 secs to observer behavior...');
    await new Promise(r => setTimeout(r, 5000));

    const url = await page.url();
    console.log('Final Browser URL:', url);

    if (url.includes('localhost:5173')) {
        const buttonText = await page.evaluate(() => {
            const el = document.querySelector('.btn-google');
            return el ? el.innerText : 'NO BUTTON';
        });
        const errorText = await page.evaluate(() => {
            const el = document.querySelector('.login-error');
            return el ? el.innerText : 'NO ERROR';
        });
        console.log('Final Button Text:', buttonText);
        console.log('Final Error Text:', errorText);
    }

    await browser.close();
})();
