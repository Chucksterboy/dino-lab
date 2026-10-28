import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
for(const [width,height] of [[1440,960],[1100,760]]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.goto('http://127.0.0.1:1420');await page.locator('.startup').waitFor({state:'hidden'});
 await page.screenshot({path:`test-results/library-readable-${width}.png`});
 await page.getByRole('button',{name:'Open Allosaurus',exact:true}).click();await page.getByRole('tab',{name:'Overview',exact:true}).waitFor();await page.waitForTimeout(250);
 await page.screenshot({path:`test-results/profile-readable-${width}.png`});
 await page.getByRole('tab',{name:'Survival',exact:true}).click();await page.waitForTimeout(250);
 await page.screenshot({path:`test-results/survival-readable-${width}.png`});
 console.log(JSON.stringify({width,brand:await page.locator('.titlebar-brand>span:first-of-type').evaluate(e=>getComputedStyle(e).fontSize),body:await page.locator('body').evaluate(e=>getComputedStyle(e).fontSize),overflow:await page.locator('.main-content').evaluate(e=>e.scrollWidth>e.clientWidth)}));
 await page.close();
}
await browser.close();
