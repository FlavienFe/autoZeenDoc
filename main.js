const pptr = require('puppeteer-core');
const find = require('find-process');
const process = require('node:process');

const stamp_id_valide = 1; // ID du tampon
const stamp_id_refuse = 2; // ID du tampon
const chemin_chrome = "C:\\Program\ Files\\Google\\Chrome\\Application\\chrome.exe"; // Normalement ne change pas
const chemin_userData = "C:\\Users\\FlFe\\AppData\\Local\\Google\\Chrome\\ZeenDocData"; // Profile Path (On peut créer un dossier vide)

async function clickOnElement(elem,p, f=p, x = null, y = null) {
    const rect = await f.evaluate(el => {
      const { top, left, width, height } = el.getBoundingClientRect();
      return { top, left, width, height };
    }, elem);
    // Use given position or default to center
    const _x = x !== null ? x : rect.width / 2;
    const _y = y !== null ? y : rect.height / 2;

    await p.mouse.click(rect.left + _x, rect.top + _y);
  }

async function keyBindListener(p){
      await p.evaluate((id1,id2)=>{
        console.log("defining stampkeypressed")
        parent.window.stampkeypressed = 0
        parent.window.docNumber = 0
        window.addEventListener('keydown',(event)=>{
          var name = event.key;
          var code = event.code;
          if(name === 'Control'){
            return;
          }
          if (!event.ctrlKey){
            console.log(code)
            parent.window.docNumber = Number(parent.window.$('div[style="height: 170px; margin: 0px; padding: 5px; background: none rgb(255, 185, 151); border: none; width: 110px;"]')[0]?.className.split(" ")[1][15]); // a pour simple but de parse le chiffre de la page sélectionnée
            console.log("Doc Number:", parent.window.docNumber)
            if(code === "KeyV"){
              console.log("placement tampon validé")
              parent.window.stampkeypressed = id1
            }
            if(code === "KeyR"){
              console.log("placement tampon refusé")
              parent.window.stampkeypressed = id2
            }
          }else{
            return;
          }
        });
      },stamp_id_valide,stamp_id_refuse)
}

async function putStampDown(p, inFrame = 0){
  var f = p;
  await p.waitForFunction("window.stampkeypressed",{timeout:false}).then(async ()=>{
        if(inFrame){
          var currentframenb = await p.evaluate(()=>window.docNumber)
          f = await p.waitForSelector("#Iframe_"+currentframenb).then((e)=>e.contentFrame());
        }
        var stampID = await p.evaluate(()=>window.stampkeypressed);
        await f.$eval("#Bouton_Ajouter_Tampon",(el)=>{el.click()})
        var frameHandle = await f.$("iframe[class='fancybox-iframe']");
        var frame = await frameHandle.contentFrame();
        await frame.waitForSelector(".Stamp")
        await new Promise(r => setTimeout(r, 400));
        console.log("#Stamp_"+stampID)
        await frame.$eval("#Stamp_"+stampID,(el)=>{el.click()}).catch((err)=>{console.log(err)})
        var elem = await f.waitForSelector("#ZDV_Pages")
        await new Promise(r => setTimeout(r, 800));
        await clickOnElement(elem, p, f);
        console.log("Tampon ID:" + stampID + " placé");
      }).catch((err)=>{console.log("le tampon n’a pas été placé: ", err)})
}

(async ()=>{
  //await find("name","chrome").then((list)=>{
    //console.log(list)
    //for (const proc of list){
      //console.log(proc)
      //process.kill(proc.pid)
    //}
  //})
  pptr.launch({
    defaultViewport:false,
    headless:false,
    executablePath: chemin_chrome,
    userDataDir: chemin_userData,
  }).then(async browser=>{
    browser.version().then(v=>console.log(v));
    const bs = await browser.waitForTarget((target)=> target.url().includes("blank"))
    const page = await bs.page();
    await page.goto("https://armoires.zeendoc.com/");
    await page.waitForSelector("#connexion")
    await new Promise(r => setTimeout(r, 500));
    await page.$eval("#connexion",(el)=>{el.click()})
    var indexDoc = 0;
    do{
      var popup = await browser.waitForTarget((target)=> target.url().includes("View/docs_view.php") || target.url().includes("Search/Indexation.php"),{timeout:false})
      console.log("Popup trouvée")
      var popupPage = await popup.page();
      await popupPage.addScriptTag({path: "jquery.js"}) 
      if (popup.url().includes("Search/Indexation.php")){
        await new Promise(r => setTimeout(r, 200));
        //var nbPages = await popupPage.$eval("#Conteneur_Iframes",(el)=>{console.log(el); return(el.children.length);})
        var nbPages = await popupPage.$eval(".column_documents",(el)=>el.children.length)
        console.log(nbPages)
        for(let i=0; i<nbPages; i++){
          console.log("adding listener " + i)
          await keyBindListener(await popupPage.waitForSelector("#Iframe_"+i).then((e)=>e.contentFrame())).catch((err)=>{console.log("erreur dans keybindlistener: ", err)})
        }
        await putStampDown(popupPage, 1).then(async()=>{
          var liste = await popupPage.$$(".column_documents>li").catch("page fermée");
          indexDoc = await popupPage.evaluate(()=>window.docNumber)
          if(indexDoc<liste.length-1){
            await new Promise(r => setTimeout(r, 500));
            liste[indexDoc + 1].click();
          }
          else{
            //await popupPage.close().then(async()=>{
              //while(!popupPage.isClosed()){
              //await new Promise(r => setTimeout(r, 200));
              //}
            //}).catch((err)=>{console.log("page fermée")});
          }
        }).catch((err)=>(console.log("page fermée à putStampDown")));
      }
      else{
        await keyBindListener(popupPage);
        await putStampDown(popupPage);
        await new Promise(r => setTimeout(r, 500));
        await popupPage.close().then(async()=>{
          while(!popupPage.isClosed()){
           await new Promise(r => setTimeout(r, 200));
          }
        }).catch((err)=>{console.log("page fermée manuellement")});
        
      }
    }while(true)
  }).catch(async error =>{console.log(error)});
})();
